import { describe, expect, it } from "vitest";
import { rightSizing, rightSizingPeople, summarizeRightSizing } from "./right-sizing";

describe("right-sizing queries", () => {
    it("reads actual model recommendations without date or price calculations", () => {
        const source = rightSizing();
        expect(source.query).toContain("'CoworkBilling'[Seat Action]");
        expect(source.query).toContain("'CoworkBilling'[UsageCohort Label]");
        expect(source.query).toContain("'CoworkBilling'[Recommended Limit]");
        expect(source.query).not.toMatch(/0\.25|RANKX|[Pp]repaid|Rate Value|Reporting Start/);
        expect(source.filters.dateRange).toMatchObject({ reason: expect.stringContaining("latest billing snapshot") });
    });

    it("escapes the action drill and handles absent recommendations without inventing an action", () => {
        expect(rightSizingPeople('Review "special"').query).toContain('TREATAS({"Review ""special"""}, \'CoworkBilling\'[Seat Action])');
        expect(rightSizingPeople("(No recommendation)").query).toContain("ISBLANK('CoworkBilling'[Seat Action])");
        expect(rightSizingPeople().query).toContain("TOPN(500");
        expect(rightSizingPeople().query).toContain('"Total", _Total');
    });

    it("withholds full-scope KPIs for capped or incomplete groups", () => {
        const columns = ["People", "Current Allowance", "Credits Used", "Recommended Allowance", "Allowance Delta", "Total"].map(name => ({ name }));
        const table = { columns, rows: [[2, 1000, 700, 900, 100, 2], [1, 500, 600, 750, -250, 2]] };
        expect(summarizeRightSizing(table)).toEqual({ people: 3, current: 1500, used: 1300, recommended: 1650, delta: -150 });
        expect(summarizeRightSizing({ ...table, rows: table.rows.slice(0, 1) })).toBeUndefined();
        expect(summarizeRightSizing({ columns, rows: [[1, null, 0, 0, null, 1]] })?.current).toBeUndefined();
    });
});
