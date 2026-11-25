// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compile, type TopLevelSpec } from "vega-lite";
import { parse, View } from "vega";
import type { QueryTable } from "@microsoft/fabric-app-data";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import "@/test/vega-formats";
import { toDataTable } from "@/lib/to-data-table";
import { impactOpportunities, processScorecard, toImpactReadings } from "./process-scorecard";
import { processHistory } from "./process-history";

// Private SDK captures are supplied at test time, never checked into the repository.
const fixtures = process.env.DATAHUB_IMPACT_FIXTURES;
function capture(name: string): { table: QueryTable; selectionYear?: number } {
    if (!fixtures) throw new Error("Set DATAHUB_IMPACT_FIXTURES to the private SDK capture directory.");
    return JSON.parse(readFileSync(join(fixtures, name), "utf8"));
}

describe("Business impact query contract", () => {
    it("rejects invalid year filters instead of injecting them into DAX", () => {
        for (const year of [NaN, Infinity, -1, 0, 1.5, 10000]) {
            expect(() => processScorecard(year)).toThrow("whole calendar year");
        }
        expect(processScorecard().query).toContain("REMOVEFILTERS('Date')");
        expect(processScorecard(2030).query).toContain("TREATAS({2030}, 'Date'[Year])");
    });

    it("reports a mismatched model contract", () => {
        expect(() => toImpactReadings({ columns: [], rows: [] })).toThrow("missing the Id column");
    });

    it.runIf(Boolean(fixtures))("reads the captured live schema and keeps unavailable measures blank", () => {
        const config = processScorecard();
        const live = capture("scorecard.json");
        expect(Object.keys(config.columnMetadata).sort()).toEqual(live.table.columns.map(column => column.name).sort());
        const rows = toImpactReadings(toDataTable(live.table, config.columnMetadata));
        expect(rows.some(row => row.eligible > 0)).toBe(true);
        const empty = toImpactReadings(toDataTable(capture("scorecard-empty.json").table, config.columnMetadata));
        expect(empty.length).toBe(rows.length);
        expect(empty.every(row => row.value === null && row.eligible === 0 && row.population === 0)).toBe(true);
        expect(impactOpportunities(empty).rows).toHaveLength(0);
    });

    it.runIf(Boolean(fixtures))("does not mistake incomplete or duplicate results for valid observations", () => {
        const table = toDataTable(capture("scorecard.json").table, processScorecard().columnMetadata);
        expect(() => toImpactReadings({ ...table, rows: table.rows.slice(1) })).toThrow("incomplete scorecard");
        expect(() => toImpactReadings({ ...table, rows: [...table.rows, table.rows[0]] })).toThrow("duplicate metric");
    });
});

async function marks(spec: object, table: DataTable, field: string) {
    const values = table.rows.map(row => Object.fromEntries(table.columns.map((column, i) => [column.name, row[i]])));
    const sized = { ...spec, width: 640, height: 300, data: { values } } as TopLevelSpec;
    const view = new View(parse(compile(sized).spec), { renderer: "none" });
    await view.runAsync();
    const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
    const number = (value: unknown): number => {
        if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Chart mark has invalid geometry.");
        return value;
    };
    const result: { value: number; width: number; bounds: { x1: number; x2: number; y1: number; y2: number } }[] = [];
    const walk = (node: unknown) => {
        if (!record(node) || !Array.isArray(node.items)) return;
        if (node.marktype === "rect") {
            for (const item of node.items) {
                if (!record(item) || !record(item.datum) || typeof item.datum[field] !== "number") continue;
                if (!record(item.bounds)) throw new Error("Chart mark has no bounds.");
                result.push({
                    value: number(item.datum[field]), width: number(item.width),
                    bounds: {
                        x1: number(item.bounds.x1), x2: number(item.bounds.x2),
                        y1: number(item.bounds.y1), y2: number(item.bounds.y2),
                    },
                });
            }
        }
        for (const item of node.items) walk(item);
    };
    const graph: unknown = view.scenegraph();
    if (!record(graph) || !("root" in graph)) throw new Error("Chart has no scenegraph root.");
    walk(graph.root);
    await view.finalize();
    return result;
}

describe.runIf(Boolean(fixtures))("Business impact live chart geometry", () => {
    it("draws review-signal bars proportional to their actual rates", async () => {
        const config = processScorecard();
        const readings = toImpactReadings(toDataTable(capture("scorecard.json").table, config.columnMetadata));
        const table = impactOpportunities(readings);
        const bars = await marks(config.vegaLiteSpec, table, "Rate");
        expect(bars).toHaveLength(table.rows.length);
        const maximum = Math.max(...bars.map(bar => bar.value));
        const widest = Math.max(...bars.map(bar => bar.width));
        for (const bar of bars) {
            expect(bar.bounds.y2).toBeGreaterThan(bar.bounds.y1);
            expect(bar.width / widest).toBeCloseTo(bar.value / maximum, 6);
            if (bar.value > 0) expect(bar.bounds.x2).toBeGreaterThan(bar.bounds.x1);
        }
    });

    it("draws a distinct non-empty cell for each captured process-year observation", async () => {
        const config = processHistory();
        const table = toDataTable(capture("history.json").table, config.columnMetadata);
        const cells = await marks(config.vegaLiteSpec, table, "Year");
        expect(cells).toHaveLength(table.rows.length);
        expect(new Set(cells.map(cell => `${cell.bounds.x1}:${cell.bounds.y1}`)).size).toBe(cells.length);
        for (const cell of cells) {
            expect(cell.bounds.x2).toBeGreaterThan(cell.bounds.x1);
            expect(cell.bounds.y2).toBeGreaterThan(cell.bounds.y1);
        }
    });
});
