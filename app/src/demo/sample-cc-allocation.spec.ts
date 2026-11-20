import { describe, expect, it } from "vitest";
import { applyDaxFilters, dateBetween, treatAs } from "@/lib/dax-filters";
import { toDataTable } from "@/lib/to-data-table";
import { chargeback, readChargeback } from "@/queries/consumption/chargeback";
import { withCommercialTerms } from "@/queries/consumption/commercial-terms";
import { rightSizing, rightSizingPeople } from "@/queries/efficiency/right-sizing";
import { samples } from "./sample-data";
import { syntheticQueryResult } from "./synthetic-model";

function read(query: string) {
    const metadata = chargeback().columnMetadata;
    const result = syntheticQueryResult(query, metadata);
    if (result.status !== "success") throw new Error(result.error.message);
    return readChargeback(toDataTable(result.table, metadata))!;
}

describe("source-backed allocation sample", () => {
    it("applies the prepaid balance once and reconciles every group to the source export", () => {
        const query = withCommercialTerms(chargeback().query, { prepaidCreditBalance: 100, prepaidCreditRate: 0.01, creditRate: 0.02 });
        const result = read(query);
        const expected = samples.consumption.PersonServiceCreditsMetrics.reduce((sum, row) => sum + Number(row["Total Copilot Credits used"]), 0);
        const index = result.allocations.columns.findIndex(column => column.name === "Prepaid Credits");
        expect(result.credits).toBeCloseTo(expected);
        expect(result.cost).toBeCloseTo(1 + (expected - 100) * 0.02);
        expect(result.allocations.rows.reduce((sum, row) => sum + Number(row[index]), 0)).toBeCloseTo(100);
        expect(result).toMatchObject({ reconciles: true, complete: true, coverage: 1 });
    });

    it("narrows selected usage without resetting the viewer pool and aligns both to the same dates", () => {
        const first = samples.consumption.PersonServiceCreditsMetrics[0];
        const person = samples.consumption.PersonPolicyMap.find(row => row.PersonId === first.PersonId)!;
        const org = samples.consumption.entra_org.find(row => row.userPrincipalName === person.userPrincipalName)!;
        const dated = applyDaxFilters(chargeback().query, [dateBetween("'Reporting Date'[Date]", first.MetricDate, first.MetricDate)]);
        const full = read(dated);
        const scoped = read(applyDaxFilters(dated, [treatAs("'Org Attribute Source'[Value]", [org.department])]));
        expect(scoped.poolCredits).toBe(full.poolCredits);
        expect(scoped.poolCost).toBe(full.poolCost);
        expect(scoped.credits).toBeLessThanOrEqual(full.credits!);
        expect(scoped.cost).toBeCloseTo(scoped.credits! / scoped.poolCredits! * scoped.poolCost!);
        expect(scoped.from).toBe(first.MetricDate);
        expect(scoped.to).toBe(first.MetricDate);
        expect(scoped.reconciles).toBe(true);
    });

    it("does not invent a custom cost-centre attribute or missing recommendation snapshot", () => {
        expect(read(chargeback("cost-centre").query)).toMatchObject({ assigned: 0, coverage: 0, reconciles: true });
        for (const source of [rightSizing(), rightSizingPeople()]) {
            const result = syntheticQueryResult(source.query, source.columnMetadata);
            expect(result.status).toBe("success");
            if (result.status === "success") expect(result.table.rows).toEqual([]);
        }
    });

    it("returns an explicit empty allocation for a window without source rows", () => {
        const result = read(applyDaxFilters(chargeback().query, [dateBetween("'Reporting Date'[Date]", "2001-01-01", "2001-01-02")]));
        expect(result.total).toBe(0);
        expect(result.allocations.rows).toEqual([]);
    });

    it("does not merge separate policy IDs when current display names coincide", () => {
        const policies = samples.consumption.SpendingPolicyMetadata;
        const names = policies.map(row => row.Name);
        const before = read(chargeback().query);
        try {
            policies.forEach(row => { row.Name = "Shared display name"; });
            const result = read(chargeback().query);
            expect(result.total).toBe(before.total);
            expect(result.credits).toBeCloseTo(before.credits!);
            expect(result.reconciles).toBe(true);
        } finally {
            policies.forEach((row, index) => { row.Name = names[index]; });
        }
    });
});
