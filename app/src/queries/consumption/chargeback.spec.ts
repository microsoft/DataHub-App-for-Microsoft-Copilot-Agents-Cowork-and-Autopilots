import { describe, expect, it } from "vitest";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { applyDaxFilters, dateBetween } from "@/lib/dax-filters";
import { withCommercialTerms } from "./commercial-terms";
import { chargeback, readChargeback } from "./chargeback";

function allocationTable(rows: unknown[][]): DataTable {
    return {
        columns: ["Part", "Credits", "Assigned Credits", "Reconciled Credits", "Total", "Estimated Cost"].map(name => ({ name })),
        rows,
    };
}

describe("chargeback query", () => {
    it("allocates weekly policies or unique EAV values without reapplying capacity to each group", () => {
        expect(chargeback().query).toContain('VAR _Basis = "policy"');
        const query = chargeback("cost-centre").query;
        expect(query).toContain("VALUES('Org Attribute Source'[Value])");
        expect(query).toContain('TRIM(\'Org Attribute Source\'[Value]) <> "(Not set)"');
        expect(query).toContain('"Ambiguous cost centre"');
        expect(query).toContain("'CreditsWeekly'[SpendingPolicyId]");
        expect(query).not.toContain("'CoworkBilling'[SpendingPolicyId]");
        expect(query).toContain("_Mapped, [Allocation], [Policy ID], [Allocation Status]");
        expect(query.match(/\[Cowork Capacity Pack Balance Value\]/g)).toHaveLength(1);
        expect(query).toContain('DIVIDE([Credits], _PoolCredits) * _PoolPrepaid');
        expect(query).toContain("REMOVEFILTERS('Org'), REMOVEFILTERS('Date'), KEEPFILTERS(_Dates)");
        expect(query).toContain("REMOVEFILTERS('Date'), KEEPFILTERS(_Dates)");
    });

    it("keeps the reporting window in the outer filter context and applies saved terms", () => {
        const priced = withCommercialTerms(chargeback().query, { creditRate: 0.02, prepaidCreditRate: 0.01, prepaidCreditBalance: 100 });
        const filtered = applyDaxFilters(priced, [dateBetween("'Reporting Date'[Date]", "2026-01-01", "2026-01-31")]);
        expect(filtered).toContain("MEASURE 'Settings'[Cowork Capacity Pack Balance Value] = 100");
        expect(filtered).toMatch(/EVALUATE\s+CALCULATETABLE\(\s*VAR _Basis/);
        expect(filtered).toContain("'Reporting Date'[Date] >= DATE(2026, 1, 1)");
        expect(filtered).not.toContain("REMOVEFILTERS('Reporting Date')");
        expect(filtered).not.toContain("__ALLOCATION_BASIS__");
    });
});

describe("allocation reconciliation", () => {
    it("preserves unallocated usage and tolerates only floating-point noise", () => {
        const result = readChargeback(allocationTable([
            ["Summary", 100, 75, 100 + 1e-10, 2, 1],
            ["Allocation", 75, null, null, 2, 0.75],
            ["Allocation", 25, null, null, 2, 0.25],
        ]));
        expect(result).toMatchObject({ credits: 100, unallocated: 25, coverage: 0.75, complete: true, reconciles: true });
    });

    it("does not claim complete reconciliation for missing or inconsistent results", () => {
        expect(readChargeback(undefined)).toBeUndefined();
        expect(readChargeback(allocationTable([]))).toBeUndefined();
        expect(readChargeback(allocationTable([
            ["Summary", 100, 75, 100, 1, 1],
            ["Allocation", 75, null, null, 1, 0.75],
        ]))?.reconciles).toBe(false);
        expect(readChargeback(allocationTable([
            ["Summary", null, 0, null, 0, null],
        ]))?.credits).toBeUndefined();
    });

    it("retains full-query reconciliation when the displayed group list is capped", () => {
        expect(readChargeback(allocationTable([
            ["Summary", 100, 100, 100, 2, 1],
            ["Allocation", 75, null, null, 2, 0.75],
        ]))).toMatchObject({ complete: false, reconciles: true, total: 2 });
    });
});
