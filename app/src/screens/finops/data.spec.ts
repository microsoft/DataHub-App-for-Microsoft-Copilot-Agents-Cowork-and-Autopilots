import { describe, expect, it } from "vitest";
import {
    allocation,
    changeOf,
    coverage,
    explorer,
    findings,
    forecast,
    overview,
    pack,
    portfolio,
    rates,
    reconcile,
    spikes,
    unit,
    waterfall,
    type View,
} from "./analysis";
import { DATA_FROM, DATA_TO, MONTHS, UNASSIGNED, generateFinopsData } from "./data";

const data = generateFinopsData();
const all: View = { basis: "Effective", provider: "All providers" };
const near = (a: number, b: number, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

describe("generateFinopsData", () => {
    it("is the same on every run and changes with the seed", () => {
        expect(generateFinopsData().charges).toEqual(data.charges);
        expect(generateFinopsData(7).charges).not.toEqual(data.charges);
    });

    it("keeps list ≥ contracted ≥ effective for usage, and billed differs from effective only through prepaid credits", () => {
        for (const c of data.charges.filter((row) => row.charge === "Usage")) {
            expect(c.list + 1e-6).toBeGreaterThanOrEqual(c.contracted);
            expect(c.contracted + 1e-6).toBeGreaterThanOrEqual(c.effective);
            if (c.provider !== "OpenAI") expect(near(c.billed, c.effective, 1e-6)).toBe(true);
        }
        const covered = data.charges.filter((c) => c.provider === "OpenAI" && c.charge === "Usage").reduce((t, c) => t + c.effective - c.billed, 0);
        expect(covered).toBeGreaterThan(0);
    });
});

describe("overview and windows", () => {
    it("is empty outside the data window and narrows by provider", () => {
        expect(overview(data, { ...all, from: "2027-01-01", to: "2027-01-31" }).empty).toBe(true);
        const everything = overview(data, all);
        const azure = overview(data, { ...all, provider: "Azure" });
        expect(azure.total).toBeLessThan(everything.total);
        expect(azure.byProvider.map((p) => p.provider)).toEqual(["Azure"]);
        expect(near(everything.byProvider.reduce((t, p) => t + p.value, 0), everything.total, 0.5)).toBe(true);
    });

    it("shows a zero prior period as new spend, with no percentage", () => {
        expect(changeOf(500, 0)).toMatchObject({ isNew: true, pct: null });
        expect(changeOf(500, 400)).toMatchObject({ isNew: false });
        const vertex = explorer(data, all).movers.find((m) => m.service.includes("Vertex"));
        expect(vertex?.isNew).toBe(true);
    });

    it("never mixes bases: the portfolio total follows the basis chosen", () => {
        const list = overview(data, { ...all, basis: "List" }).total;
        const effective = overview(data, all).total;
        expect(list).toBeGreaterThan(effective);
    });
});

describe("waterfalls and allocation", () => {
    it("adds up: the explorer waterfall ends on the last-30-day total", () => {
        const steps = explorer(data, all).waterfall;
        const last = steps.at(-1)!;
        expect(last.kind).toBe("Total");
        expect(near(last.end, steps.slice(1, -1).reduce((t, s) => t + s.value, steps[0].value), 0.5)).toBe(true);
        expect(waterfall({ label: "a", value: 10 }, [{ label: "b", delta: -4 }, { label: "c", total: true }]).at(-1)?.value).toBe(6);
    });

    it("keeps unassigned spend visible and sums to the total", () => {
        const a = allocation(data, all);
        expect(a.unassigned).toBeGreaterThan(0);
        expect(a.heat.some((h) => h["Cost centre"] === UNASSIGNED)).toBe(true);
        const heatTotal = a.heat.reduce((t, h) => t + h.Cost, 0);
        expect(near(heatTotal, a.total, a.heat.length)).toBe(true);
        expect(a.unassignedShare).toBeLessThan(0.2);
    });
});

describe("rates, credits and trust", () => {
    it("runs the prepaid pack out in November, from the recent pace", () => {
        const p = pack(data);
        expect(p.exhausts && p.exhausts > "2026-11-01" && p.exhausts < "2026-12-15").toBe(true);
        expect(p.drawn).toBeGreaterThan(40_000);
        expect(p.balance).toBeGreaterThan(0);
    });

    it("reports commitments and underused reserved capacity", () => {
        const r = rates(data, all);
        expect(r.commitments).toHaveLength(2);
        expect(r.total.list).toBeGreaterThan(r.total.contracted);
        expect(r.total.contracted).toBeGreaterThan(r.total.effective);
        expect(r.ptu?.utilisation).toBeLessThan(0.5);
    });

    it("keeps a failed feed, an estimate and an empty source apart", () => {
        const rows = coverage(data);
        const bedrock = rows.find((r) => r.provider === "AWS")!;
        expect(bedrock.cells.find((c) => c.label === "Token detail")?.state).toBe("Gap");
        expect(rows.find((r) => r.provider === "Anthropic")!.cells[0].state).toBe("Watch");
        const oracle = rows.find((r) => r.provider === "Oracle Cloud")!;
        expect(oracle.cells[0].text).toMatch(/no charges/);
    });

    it("reconciles September with named differences and leaves October open", () => {
        const sep = reconcile(data, "2026-09");
        expect(sep.open).toBe(false);
        expect(sep.rows.find((r) => r.provider === "Anthropic")?.reason).toBe("Not yet explained");
        expect(reconcile(data, MONTHS.at(-1)!).open).toBe(true);
    });
});

describe("forecast and findings", () => {
    it("gives three scenarios and finds the budget crossing dates at the end of October", () => {
        const ai = forecast(data, "AI spend");
        const total = forecast(data, "All spend");
        expect(ai.months).toHaveLength(3);
        expect(ai.months[0].values["Recent trend"]).toBeGreaterThan(ai.months[0].values.Flat ?? 0);
        expect(ai.crossing?.date && ai.crossing.date >= "2026-10-25" && ai.crossing.date <= "2026-10-31").toBe(true);
        expect(total.crossing?.date && total.crossing.date >= "2026-10-25" && total.crossing.date <= "2026-10-31").toBe(true);
    });

    it("says insufficient history for OpenAI's trend and leaves per-person cost undefined for apps with no people", () => {
        const openai = forecast(data, "All spend").outlook.find((o) => o.provider === "OpenAI")!;
        expect(openai.projection.reasons["Recent trend"]).toMatch(/Insufficient history/);
        const rows = unit(data, all).rows;
        expect(rows.find((r) => r.app.id === "doc-extraction")?.perPersonMonth).toBeNull();
        expect(rows.find((r) => r.app.id === "meeting-summaries")?.perPersonMonth).toBeGreaterThan(0);
    });

    it("detects both known spikes and lists deterministic findings", () => {
        const found = spikes(data);
        expect(found.some((s) => s.application === "meeting-summaries" && s.from === "2026-09-09")).toBe(true);
        expect(found.some((s) => s.service.includes("BigQuery") && s.from === "2026-09-17")).toBe(true);
        const list = findings(data);
        expect(list.map((f) => f.id)).toEqual(expect.arrayContaining(["ptu-underused", "pack-running-out", "feed-failed", "invoice-anthropic"]));
        expect(findings(data)).toEqual(list);
    });

    it("covers every day from the first to the last", () => {
        const dates = new Set(data.charges.map((c) => c.date));
        expect(dates.has(DATA_FROM) && dates.has(DATA_TO)).toBe(true);
        expect(portfolio(data, all).providers.length).toBeGreaterThanOrEqual(4);
    });
});
