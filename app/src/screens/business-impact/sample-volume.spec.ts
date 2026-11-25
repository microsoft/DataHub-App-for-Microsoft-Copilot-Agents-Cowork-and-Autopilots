// @vitest-environment node
import { describe, expect, it } from "vitest";
import { compile, type TopLevelSpec } from "vega-lite";
import { parse, View } from "vega";
import samples from "@/demo/outcome-samples.json";
import spec from "./sample-volume.json";

describe("monthly sample volumes", () => {
    it("renders distinct, proportional bars for the public incident counts", async () => {
        const values = samples.service.trend;
        const result = compile({ ...spec, width: 640, height: 200, data: { values } } as TopLevelSpec);
        const chart = new View(parse(result.spec), { renderer: "none" });
        try {
            await chart.runAsync();
            // Use Vega's actual rect mark scene, not the source tuples alone.
            type Bar = { x: number; width: number; height: number; datum: { count: number } };
            const scene = chart.scenegraph() as unknown as { root: { items: { items: { marktype: string; items: Bar[] }[] }[] } };
            const bars = scene.root.items[0].items.find(item => item.marktype === "rect")!.items;
            expect(bars.length).toBe(values.length);
            expect(new Set(bars.map(b => b.x)).size).toBe(values.length);
            const nonzero = bars.filter(b => b.datum.count > 0);
            const tallest = Math.max(...nonzero.map(b => b.height));
            const largest = Math.max(...nonzero.map(b => b.datum.count));
            for (const b of nonzero) {
                expect(b.width).toBeGreaterThan(0);
                expect(b.height / tallest).toBeCloseTo(b.datum.count / largest, 5);
            }
        } finally { chart.finalize(); }
    });
});
