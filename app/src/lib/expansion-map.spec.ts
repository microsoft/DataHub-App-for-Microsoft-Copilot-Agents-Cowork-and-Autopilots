//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

// @vitest-environment node
// Vega builds the full scenegraph without a DOM, and jsdom's stub canvas only
// adds noise (its getContext throws during text measurement).

import { describe, expect, it, vi } from "vitest";
import { compile, type TopLevelSpec } from "vega-lite";
import { parse, View } from "vega";
import "@/test/vega-formats";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import {
    EXPANSION_TIER_FALLBACKS,
    expansionHeadline,
    expansionSpec,
    planExpansion,
    scoreDomain,
    type ExpansionFields,
} from "./expansion-map";

const FIELDS: ExpansionFields = { label: "Organization", score: "Priority Score", people: "People" };

function table(rows: [string, number | null, number][]): DataTable {
    return {
        columns: [{ name: "Organization" }, { name: "Priority Score" }, { name: "People" }],
        rows,
    } as unknown as DataTable;
}

/** Four teams, one in each corner, around a middle score of 50 and middle team of 30. */
const CORNERS = table([
    ["Sales", 70, 60],
    ["Legal", 65, 10],
    ["IT", 30, 50],
    ["HR", 25, 5],
]);

describe("planExpansion", () => {
    it("places each team by the middle team's score and size", () => {
        const plan = planExpansion(CORNERS, FIELDS);

        expect(plan.scoreMid).toBe(47.5);
        expect(plan.peopleMid).toBe(30);
        expect(plan.teams.map((team) => [team.label, team.tier])).toEqual([
            ["Sales", "Expand next"],
            ["Legal", "Quick wins"],
            ["IT", "Build habits first"],
            ["HR", "Later"],
        ]);
    });

    it("counts a team level with the middle as ready and large", () => {
        const plan = planExpansion(table([["A", 40, 20], ["B", 50, 30], ["C", 60, 40]]), FIELDS);
        expect(plan.teams.find((team) => team.label === "B")?.tier).toBe("Expand next");
    });

    it("leaves out teams without a score or anyone to reach", () => {
        const plan = planExpansion(table([["A", 40, 20], ["B", null, 30], ["C", 60, 0]]), FIELDS);
        expect(plan.teams.map((team) => team.label)).toEqual(["A"]);
        expect(plan.table.rows).toHaveLength(1);
    });

    it("places nobody when a column is missing, and says which", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const plan = planExpansion(CORNERS, { ...FIELDS, score: "Readiness Score" });
        expect(plan.teams).toEqual([]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('"Readiness Score"'));
        warn.mockRestore();
    });

    it("places nobody for an answer with no rows or columns", () => {
        expect(planExpansion({ columns: [], rows: [] } as unknown as DataTable, FIELDS).teams).toEqual([]);
    });
});

describe("scoreDomain", () => {
    it("widens tightly bunched scores to ten points around them", () => {
        expect(scoreDomain([50, 55])).toEqual([47.5, 57.5]);
    });

    it("pads a wide spread by a tenth each side", () => {
        expect(scoreDomain([20, 80])).toEqual([14, 86]);
    });

    it("stays inside 0 to 100", () => {
        expect(scoreDomain([98, 100])).toEqual([90, 100]);
        expect(scoreDomain([0, 1])).toEqual([0, 10]);
    });
});

describe("expansionHeadline", () => {
    it("names the teams to expand to next, and the people they hold", () => {
        expect(expansionHeadline(planExpansion(CORNERS, FIELDS), "people")).toBe("Expand next: Sales (60 people)");
    });

    it("shortens a long list", () => {
        const plan = planExpansion(
            table([["A", 90, 90], ["B", 80, 80], ["C", 70, 70], ["D", 60, 60], ["E", 10, 10], ["F", 10, 10], ["G", 10, 10]]),
            FIELDS,
        );
        expect(expansionHeadline(plan, "people")).toBe("Expand next: A, B and 2 more (300 people)");
    });

    it("falls back to the quick wins when no team is both ready and large", () => {
        const plan = planExpansion(CORNERS, FIELDS);
        const noLeader = { ...plan, teams: plan.teams.filter((team) => team.tier !== "Expand next") };
        expect(expansionHeadline(noLeader, "people")).toBe("Start with quick wins: Legal (10 people)");
    });

    it("says nothing when every team sits in one tier", () => {
        expect(expansionHeadline(planExpansion(table([["A", 50, 5], ["B", 50, 5]]), FIELDS), "people")).toBeUndefined();
    });
});

interface Item {
    datum?: Record<string, unknown>;
    text?: string;
    align?: string;
    stroke?: string;
    x?: number;
    bounds?: { x1: number; x2: number };
}
interface Node {
    marktype?: string;
    role?: string;
    items?: (Node & Item)[];
}

/** Every mark item of `type` in the scene with `role`. */
function itemsOf(node: Node, type: string, role: string, found: Item[] = []): Item[] {
    for (const item of node.items ?? []) {
        if (node.marktype === type && node.role === role) found.push(item);
        itemsOf(item, type, role, found);
    }
    return found;
}

/** Team names, without the halos drawn behind them. */
function namesOf(scene: Node): Item[] {
    return itemsOf(scene, "text", "mark").filter((item) => item.datum?.Organization !== undefined && item.stroke === undefined);
}

async function render(data: DataTable) {
    const plan = planExpansion(data, FIELDS);
    const spec = expansionSpec(plan, {
        fields: FIELDS,
        titles: { label: "Organization", score: "Priority score", people: "Active unlicensed users" },
        colors: EXPANSION_TIER_FALLBACKS,
    });
    const values = plan.table.rows.map((row) =>
        Object.fromEntries(plan.table.columns.map((column, index) => [column.name, row[index]])),
    );
    const sized = { ...(spec as object), width: 600, height: 400, data: { values } } as TopLevelSpec;
    const view = new View(parse(compile(sized).spec), { renderer: "none" });
    await view.runAsync();
    return { plan, view, scene: (view.scenegraph() as unknown as { root: Node }).root };
}

describe("expansionSpec renders", () => {
    it("draws a bubble per team, one tinted corner and the two middle lines", async () => {
        const { scene } = await render(CORNERS);

        expect(itemsOf(scene, "symbol", "mark").map((item) => item.datum?.Organization)).toEqual(["Sales", "Legal", "IT", "HR"]);
        expect(itemsOf(scene, "rect", "mark")).toHaveLength(1);
        expect(itemsOf(scene, "rule", "mark")).toHaveLength(2);
    });

    it("names only the larger teams, each on the side with room", async () => {
        const { scene } = await render(CORNERS);
        const names = namesOf(scene);
        const halos = itemsOf(scene, "text", "mark").filter((item) => item.stroke !== undefined);

        expect(halos.map((item) => item.datum?.Organization)).toEqual(["Sales", "IT"]);
        expect(names.map((item) => [item.datum?.Organization, item.align])).toEqual([
            ["Sales", "right"],
            ["IT", "left"],
        ]);
        const sales = names.find((item) => item.datum?.Organization === "Sales");
        expect(sales?.bounds?.x2).toBeLessThan(sales?.x ?? 0);
    });

    it("names one of two teams that sit on the same spot", async () => {
        const { scene } = await render(table([["Sales", 15, 4], ["Risk", 15, 4], ["Marketing", 16, 4], ["HR", 10, 1], ["IT", 20, 2]]));
        expect(namesOf(scene).map((item) => item.datum?.Organization)).toEqual(["Marketing"]);
    });

    it("tints the expand-next corner from the middle lines to the plot's far edges", async () => {
        const { plan, view, scene } = await render(CORNERS);
        const [tint] = itemsOf(scene, "rect", "mark") as (Item & { x: number; x2?: number; width: number; y: number; height: number })[];
        const x = view.scale("x") as (value: number) => number;
        const y = view.scale("y") as (value: number) => number;
        expect(tint.x).toBeCloseTo(x(plan.scoreMid));
        expect(tint.x + tint.width).toBeCloseTo(600);
        expect(tint.y).toBeCloseTo(0);
        expect(tint.y + tint.height).toBeCloseTo(y(plan.peopleMid));
    });

    it("keeps the score axis to the planned domain, unrounded", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { plan, view } = await render(CORNERS);
        expect(view.scale("x").domain()).toEqual(plan.scoreDomain);
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it("titles the axes with the score and the people", async () => {
        const { scene } = await render(CORNERS);
        const titles = itemsOf(scene, "text", "axis-title").map((item) => item.text);
        expect(titles.sort()).toEqual(["Active unlicensed users", "Priority score"]);
    });

    it("keeps the corners' tier names", async () => {
        const { scene } = await render(CORNERS);
        const corners = itemsOf(scene, "text", "mark")
            .filter((item) => item.datum?.Organization === undefined)
            .map((item) => item.text);
        expect(corners.sort()).toEqual(["Build habits first", "Expand next", "Later", "Quick wins"]);
    });
});
