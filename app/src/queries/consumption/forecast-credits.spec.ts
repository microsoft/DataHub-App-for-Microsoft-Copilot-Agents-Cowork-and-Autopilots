//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parse, View, type Scene, type SceneItem } from "vega";
import { compile, type TopLevelSpec } from "vega-lite";
import { calculateForecast, forecastChartTable, readForecastBaseline } from "@/lib/cowork-forecast";
import { coworkWeekly } from "./cowork";
import weeklyRows from "./__fixtures__/cowork-weekly.rows.json";
import spec from "./forecast-credits.json";

describe("forecast credit geometry", () => {
    it.each([1, 12, 24])("renders finite, chronological base points and a sensitivity band for %i months", async (horizonMonths) => {
        const metadata = coworkWeekly("consumption").columnMetadata;
        const baseline = readForecastBaseline({
            columns: Object.values(metadata),
            rows: weeklyRows.map((row) => Object.keys(metadata).map((key) => (row as Record<string, string | number | null>)[key])),
        }, "2026-08-10")!;
        const result = calculateForecast(baseline, {
            startMonth: "2026-09", horizonMonths, monthlyGrowthPercent: 5, intensityFactor: 1,
            sensitivityPercent: 20, availablePrepaidCredits: 0, prepaidRate: 0.005, paygRate: 0.01, waves: [], topUps: [],
        });
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        const table = forecastChartTable(result.series);
        const values = table.rows.map((row) => Object.fromEntries(table.columns.map((column, i) => [column.name, row[i]])));
        const view = new View(parse(compile({ ...spec, width: 640, height: 300, data: { values } } as TopLevelSpec).spec), { renderer: "none" });
        try {
            await view.runAsync();
            const symbols: SceneItem[] = [];
            const areas: SceneItem[] = [];
            const walk = (node: Scene | SceneItem) => {
                const scene = node as Scene;
                if (scene.marktype === "symbol") symbols.push(...scene.items as SceneItem[]);
                if (scene.marktype === "area") areas.push(...scene.items as SceneItem[]);
                for (const child of (scene.items ?? []) as (Scene | SceneItem)[]) {
                    if ((child as Scene).items) walk(child);
                }
            };
            walk((view.scenegraph() as unknown as { root: Scene }).root);
            expect(symbols).toHaveLength(horizonMonths);
            expect(areas.length).toBeGreaterThan(0);
            for (const point of [...symbols, ...areas]) {
                expect([point.bounds.x1, point.bounds.y1, point.bounds.x2, point.bounds.y2].every(Number.isFinite)).toBe(true);
            }
            expect(symbols.every((point) => point.bounds.width() > 0 && point.bounds.height() > 0)).toBe(true);
            const xs = symbols.map((point) => point.bounds.x1);
            expect(xs).toEqual([...xs].sort((a, b) => a - b));
            if (horizonMonths > 1) {
                expect(xs[xs.length - 1] - xs[0]).toBeGreaterThan(500);
                expect(areas.some((area) => area.bounds.height() > 20)).toBe(true);
            }
        } finally {
            view.finalize();
        }
    });
});
