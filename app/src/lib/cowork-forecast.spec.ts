//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
    calculateForecast, forecastExportTable, parseForecastNumber, readForecastBaseline,
    type ForecastBaseline, type ForecastScenario, type ForecastSeries,
} from "./cowork-forecast";
import { coworkWeekly } from "@/queries/consumption/cowork";
import weeklyRows from "@/queries/consumption/__fixtures__/cowork-weekly.rows.json";
import type { DataTable } from "@microsoft/fabric-visuals-core";

const columns = coworkWeekly("consumption").columnMetadata;
const fixture: DataTable = {
    columns: Object.values(columns),
    rows: weeklyRows.map((row) => Object.keys(columns).map((key) => (row as Record<string, string | number | null>)[key])),
};

// Small, explicit arithmetic inputs for the planning model, not substitute ingestion.
const baseline: ForecastBaseline = {
    periodStart: "2026-07-05", periodEnd: "2026-08-01", weeks: 4,
    weeklyCredits: 100 * 12 / 52, monthlyCredits: 100, weeklyActiveUsers: 10,
};
const defaults: ForecastScenario = {
    startMonth: "2026-09", horizonMonths: 3, monthlyGrowthPercent: 0, intensityFactor: 1,
    sensitivityPercent: 20, availablePrepaidCredits: 150, prepaidRate: 0.005, paygRate: 0.01,
    waves: [], topUps: [],
};
function bands(patch: Partial<ForecastScenario> = {}, source = baseline): ForecastSeries[] {
    const result = calculateForecast(source, { ...defaults, ...patch });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result.series;
}
const base = (patch: Partial<ForecastScenario> = {}, source = baseline) => bands(patch, source)[1];

describe("forecast ingestion baseline", () => {
    it("uses the last four completed weeks from the existing query fixture, excluding an in-progress week", () => {
        const result = readForecastBaseline(fixture, "2026-07-30")!;
        const sample = weeklyRows.filter((row) => row["[Week Start]"] >= "2026-06-28" && row["[Week Start]"] < "2026-07-26");
        expect(sample).toHaveLength(4);
        expect(result.periodStart).toBe("2026-06-28");
        expect(result.periodEnd).toBe("2026-07-25");
        expect(result.weeklyCredits).toBeCloseTo(sample.reduce((sum, row) => sum + row["[Credits]"], 0) / 4);
        expect(result.weeklyActiveUsers).toBeCloseTo(sample.reduce((sum, row) => sum + row["[Active Users]"], 0) / 4);
        expect(result.monthlyCredits).toBeCloseTo(result.weeklyCredits * 52 / 12);
    });

    it("does not fill missing weeks with zeros or mix a partial user sample into per-user intensity", () => {
        const sparse = {
            ...fixture,
            rows: fixture.rows.filter((row) => row[1] !== "2026-07-12T00:00:00").map((row) => row[1] === "2026-07-19T00:00:00" ? [...row.slice(0, 3), null, ...row.slice(4)] : row),
        };
        const result = readForecastBaseline(sparse, "2026-07-30")!;
        expect(result.weeks).toBe(3);
        expect(result.weeklyActiveUsers).toBeUndefined();
        expect(result.periodStart).toBe("2026-06-28");
    });

    it("has no baseline for empty, invalid or not-yet-complete data", () => {
        expect(readForecastBaseline(undefined, "2026-07-30")).toBeUndefined();
        expect(readForecastBaseline({ ...fixture, rows: [] }, "2026-07-30")).toBeUndefined();
        expect(readForecastBaseline(fixture, "2026-05-04")).toBeUndefined();
        expect(readForecastBaseline(fixture, "2026-02-30")).toBeUndefined();
        expect(readForecastBaseline({ ...fixture, rows: fixture.rows.map((row) => [row[0], row[1], Number.NaN, ...row.slice(3)]) }, "2026-07-30")).toBeUndefined();
    });
});

describe("cumulative pack depletion", () => {
    it("draws down one opening balance across months instead of resetting it", () => {
        const result = base();
        expect(result.months.map((month) => month.prepaidCredits)).toEqual([100, 50, 0]);
        expect(result.months.map((month) => month.paygCredits)).toEqual([0, 50, 100]);
        expect(result.months.map((month) => month.closingPrepaidCredits)).toEqual([50, 0, 0]);
        expect(result.firstPaygMonth).toBe("2026-10");
        expect(result.firstDepletionMonth).toBe("2026-10");
        expect(result.consumedCost).toBeCloseTo(2.25);
        expect(result.committedPurchases).toBe(0);
    });

    it("separates exact depletion from the later first PAYG month", () => {
        const result = base({ availablePrepaidCredits: 100 });
        expect(result.firstDepletionMonth).toBe("2026-09");
        expect(result.firstPaygMonth).toBe("2026-10");
        expect(base({ availablePrepaidCredits: 0 }).firstPaygMonth).toBe("2026-09");
        expect(base({ availablePrepaidCredits: 1_000 }).firstPaygMonth).toBeUndefined();
    });

    it("does not mistake fractional-credit roundoff for the start of PAYG", () => {
        const result = base({ availablePrepaidCredits: 0.3, horizonMonths: 3 }, { ...baseline, monthlyCredits: 0.1 });
        expect(result.firstPaygMonth).toBeUndefined();
        expect(result.closingPrepaidCredits).toBe(0);
        expect(result.months.map((month) => month.paygCredits)).toEqual([0, 0, 0]);
    });

    it("applies dated top-ups once, restores prepaid coverage and separates purchases from consumption", () => {
        const result = base({ availablePrepaidCredits: 0, topUps: [{ month: "2026-10", credits: 150 }, { month: "2026-10", credits: 100 }] });
        expect(result.months.map((month) => month.topUpCredits)).toEqual([0, 250, 0]);
        expect(result.months.map((month) => month.paygCredits)).toEqual([100, 0, 0]);
        expect(result.months.map((month) => month.closingPrepaidCredits)).toEqual([0, 150, 50]);
        expect(result.committedPurchases).toBeCloseTo(1.25);
        expect(result.consumedCost).toBeCloseTo(2);
        expect(result.paygCost).toBe(1);
        expect(result.firstPaygMonth).toBe("2026-09");
    });
});

describe("adoption, waves and scenario sensitivity", () => {
    it("adds waves only from their month, then compounds the added cohort", () => {
        const result = base({
            monthlyGrowthPercent: 10,
            waves: [{ month: "2026-10", additionalUsers: 5 }, { month: "2026-10", additionalUsers: 2 }],
        });
        expect(result.months.map((month) => month.activeUsers)).toEqual([10, 18, 19.8]);
        expect(result.months[0].credits).toBe(100);
        expect(result.months[1].credits).toBe(180);
        expect(result.months[2].credits).toBe(198);
        expect(base({ waves: [{ month: "2026-09", additionalUsers: 5 }] }).months[0].credits).toBe(150);
    });

    it("prices low/base/high with independent balances and shared purchase commitments", () => {
        const result = bands({ topUps: [{ month: "2026-11", credits: 20 }] });
        expect(result.map((band) => band.totalCredits)).toEqual([240, 300, 360]);
        expect(result.map((band) => band.months[1].paygCredits)).toEqual([10, 50, 90]);
        expect(result.map((band) => band.committedPurchases)).toEqual([0.1, 0.1, 0.1]);
        expect(result[0].consumedCost).toBeLessThan(result[1].consumedCost);
        expect(result[1].consumedCost).toBeLessThan(result[2].consumedCost);
        expect(result.map((band) => band.months[0].activeUsers)).toEqual([10, 10, 10]);
    });

    it("handles absent active-user data without making up users and requires an assumption for waves", () => {
        const source = { ...baseline, weeklyActiveUsers: undefined };
        const noUsers = base({ monthlyGrowthPercent: 10 }, source);
        expect(noUsers.months[1].credits).toBeCloseTo(110);
        expect(noUsers.months[1].activeUsers).toBeUndefined();
        const invalid = calculateForecast(source, { ...defaults, waves: [{ month: "2026-10", additionalUsers: 5 }] });
        expect(invalid.ok).toBe(false);
        if (!invalid.ok) expect(invalid.errors.startingUsers).toMatch(/assumed starting users/);
        const assumed = base({ startingUsers: 20, waves: [{ month: "2026-10", additionalUsers: 10 }] }, source);
        expect(assumed.months.map((month) => month.credits)).toEqual([100, 150, 150]);
    });

    it("scales a known per-user baseline when starting users or intensity changes", () => {
        expect(base({ startingUsers: 20, intensityFactor: 1.5 }).months[0].credits).toBe(300);
        expect(base({ intensityFactor: 0 }).consumedCost).toBe(0);
        expect(bands({ sensitivityPercent: 100 })[0].totalCredits).toBe(0);
        expect(base({ monthlyGrowthPercent: -100 }).months.map((month) => month.credits)).toEqual([100, 0, 0]);
    });

    it("supports 24 full months across year boundaries", () => {
        const result = base({ startMonth: "2026-12", horizonMonths: 24 });
        expect(result.months).toHaveLength(24);
        expect(result.months[23].month).toBe("2028-11");
    });
});

describe("forecast validation and portable export", () => {
    it.each(["", " ", "Infinity", "NaN", "1e9", "2oops", "0x10", "1,000"])("rejects ambiguous numeric input %j", (value) => {
        expect(Number.isNaN(parseForecastNumber(value))).toBe(true);
    });

    it("accepts zero, decimal and signed inputs without treating an empty field as zero", () => {
        expect(parseForecastNumber("0")).toBe(0);
        expect(parseForecastNumber(" -2.5 ")).toBe(-2.5);
        expect(parseForecastNumber(".01")).toBe(0.01);
    });

    it.each([
        { horizonMonths: 25 }, { horizonMonths: 0 }, { horizonMonths: 1.5 },
        { monthlyGrowthPercent: -101 }, { intensityFactor: -1 }, { sensitivityPercent: 101 },
        { paygRate: Number.NaN }, { prepaidRate: Infinity }, { availablePrepaidCredits: -10 },
        { startingUsers: 0 }, { startMonth: "2026-13" },
        { waves: [{ month: "2026-12", additionalUsers: 5 }] },
        { waves: [{ month: "2026-10", additionalUsers: 1.5 }] },
        { topUps: [{ month: "2026-08", credits: 100 }] },
        { topUps: [{ month: "2026-10", credits: -1 }] },
    ])("rejects invalid scenario %j rather than calculating misleading zero costs", (patch) => {
        expect(calculateForecast(baseline, { ...defaults, ...patch }).ok).toBe(false);
    });

    it("refuses projections beyond reliable numeric precision", () => {
        const result = calculateForecast({ ...baseline, monthlyCredits: 1e15 }, { ...defaults, horizonMonths: 24, monthlyGrowthPercent: 100 });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errors.scenario).toMatch(/too large/);
    });

    it("exports all three scenarios, purchase/consumption separation, source period and assumptions", () => {
        const table = forecastExportTable(baseline, defaults, bands());
        expect(table.rows).toHaveLength(9);
        const cell = (name: string) => table.rows[0][table.columns.findIndex((column) => column.name === name)];
        expect(cell("Estimate — sensitivity")).toBe("Low");
        expect(cell("Source period end")).toBe("2026-08-01");
        expect(cell("Weeks per month")).toBe(52 / 12);
        expect(cell("Initial available credits (assumption)")).toBe(150);
        expect(cell("Consumed cost (USD)")).toBe(0.4);
        expect(cell("Top-up purchases (USD)")).toBe(0);
        expect(cell("Exclusions")).toMatch(/Expiry; tax; invoice reconciliation/);
    });
});
