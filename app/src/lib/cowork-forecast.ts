//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { DataTable } from "@microsoft/fabric-visuals-core";

/** An average calendar month, not four weeks and not a billing period. */
export const FORECAST_WEEKS_PER_MONTH = 52 / 12;
const DAY = 86_400_000;
const MAX_CREDITS = 1e15;

export interface ForecastBaseline {
    periodStart: string;
    periodEnd: string;
    weeks: number;
    weeklyCredits: number;
    /** Mean weekly active users, not distinct monthly active users. */
    weeklyActiveUsers?: number;
    monthlyCredits: number;
}

function dateValue(value: unknown): number | undefined {
    const text = value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : value;
    if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(text)) return undefined;
    const date = text.slice(0, 10);
    const time = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time : undefined;
}

function nonnegative(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Mean of the reported, completed weeks in the latest four-week window.
 * Missing/invalid weeks are not zero-filled; an in-progress week is excluded.
 * Active users must be available for that same whole sample to derive intensity.
 */
export function readForecastBaseline(table: DataTable | undefined, today: string): ForecastBaseline | undefined {
    if (!table) return undefined;
    const now = dateValue(today);
    if (now === undefined) return undefined;
    const index = (name: string) => table.columns.findIndex((column) => column.name === name);
    const date = index("Week Start");
    const credits = index("Credits");
    const users = index("Active Users");
    const weeks = table.rows.flatMap((row) => {
        const start = dateValue(row[date]);
        const used = row[credits];
        if (start === undefined || start + 7 * DAY > now || !nonnegative(used)) return [];
        return [{ start, credits: used, users: nonnegative(row[users]) ? Number(row[users]) : undefined }];
    }).sort((a, b) => a.start - b.start);
    if (!weeks.length) return undefined;
    const latest = weeks[weeks.length - 1].start;
    const recent = weeks.filter((week) => week.start >= latest - 21 * DAY).slice(-4);
    const weeklyCredits = recent.reduce((sum, week) => sum + week.credits, 0) / recent.length;
    const meanUsers = recent.every((week) => week.users !== undefined)
        ? recent.reduce((sum, week) => sum + week.users!, 0) / recent.length
        : undefined;
    if (!Number.isFinite(weeklyCredits) || weeklyCredits > MAX_CREDITS) return undefined;
    return {
        periodStart: new Date(recent[0].start).toISOString().slice(0, 10),
        periodEnd: new Date(latest + 6 * DAY).toISOString().slice(0, 10),
        weeks: recent.length,
        weeklyCredits,
        weeklyActiveUsers: meanUsers && Number.isFinite(meanUsers) ? meanUsers : undefined,
        monthlyCredits: weeklyCredits * FORECAST_WEEKS_PER_MONTH,
    };
}

export interface ForecastWave {
    month: string;
    additionalUsers: number;
}

export interface ForecastTopUp {
    month: string;
    credits: number;
}

export interface ForecastScenario {
    /** Calendar month in YYYY-MM format; every projected month is a full month. */
    startMonth: string;
    horizonMonths: number;
    monthlyGrowthPercent: number;
    intensityFactor: number;
    sensitivityPercent: number;
    startingUsers?: number;
    availablePrepaidCredits: number;
    prepaidRate: number;
    paygRate: number;
    waves: readonly ForecastWave[];
    topUps: readonly ForecastTopUp[];
}

export type ForecastErrors = Record<string, string>;
export type ForecastSensitivity = "Low" | "Base" | "High";

export interface ForecastMonth {
    month: string;
    activeUsers?: number;
    additionalUsers: number;
    credits: number;
    openingPrepaidCredits: number;
    topUpCredits: number;
    prepaidCredits: number;
    paygCredits: number;
    closingPrepaidCredits: number;
    consumedCost: number;
    /** Only new top-ups in this month. Opening credits are already held. */
    committedPurchases: number;
    paygCost: number;
}

export interface ForecastSeries {
    sensitivity: ForecastSensitivity;
    factor: number;
    months: ForecastMonth[];
    totalCredits: number;
    consumedCost: number;
    committedPurchases: number;
    paygCost: number;
    closingPrepaidCredits: number;
    firstPaygMonth?: string;
    firstDepletionMonth?: string;
}

export type ForecastResult =
    | { ok: false; errors: ForecastErrors }
    | { ok: true; series: ForecastSeries[] };

export function isForecastMonth(value: string): boolean {
    return /^(?:[1-9]\d{3})-(?:0[1-9]|1[0-2])$/.test(value);
}

export function shiftForecastMonth(month: string, offset: number): string {
    const [year, part] = month.split("-").map(Number);
    return new Date(Date.UTC(year, part - 1 + offset, 1)).toISOString().slice(0, 7);
}

/** Blank, exponent notation, Infinity and partly numeric text are not zero. */
export function parseForecastNumber(text: string): number {
    const clean = text.trim();
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean) ? Number(clean) : Number.NaN;
}

export function validateForecast(baseline: ForecastBaseline, scenario: ForecastScenario): ForecastErrors {
    const errors: ForecastErrors = {};
    const check = (key: string, value: number, min: number, max: number, whole = false) => {
        if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
            errors[key] = `Enter ${whole ? "a whole number" : "a number"} from ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}.`;
        }
    };
    check("horizonMonths", scenario.horizonMonths, 1, 24, true);
    check("monthlyGrowthPercent", scenario.monthlyGrowthPercent, -100, 100);
    check("intensityFactor", scenario.intensityFactor, 0, 10);
    check("sensitivityPercent", scenario.sensitivityPercent, 0, 100);
    check("availablePrepaidCredits", scenario.availablePrepaidCredits, 0, MAX_CREDITS);
    check("prepaidRate", scenario.prepaidRate, 0, 1);
    check("paygRate", scenario.paygRate, 0, 1);
    if (scenario.startingUsers !== undefined) check("startingUsers", scenario.startingUsers, 0.01, 1e9);
    if (!isForecastMonth(scenario.startMonth) || scenario.startMonth > "9997-12") {
        errors.startMonth = "Choose a valid forecast start month.";
    }
    if (!nonnegative(baseline.monthlyCredits) || baseline.monthlyCredits > MAX_CREDITS) {
        errors.baseline = "The recent credit baseline is not usable.";
    }
    if (baseline.weeklyActiveUsers !== undefined && (!nonnegative(baseline.weeklyActiveUsers) || baseline.weeklyActiveUsers === 0)) {
        errors.baseline = "The active-user baseline is not usable.";
    }
    const end = !errors.startMonth && !errors.horizonMonths
        ? shiftForecastMonth(scenario.startMonth, scenario.horizonMonths - 1)
        : undefined;
    const checkMonth = (key: string, month: string) => {
        if (!isForecastMonth(month) || (end && (month < scenario.startMonth || month > end))) {
            errors[key] = "Choose a month inside the forecast horizon, or remove this entry.";
        }
    };
    if (scenario.waves.length > 24) errors.waves = "Use at most 24 rollout waves.";
    if (scenario.topUps.length > 24) errors.topUps = "Use at most 24 top-ups.";
    scenario.waves.forEach((wave, i) => {
        checkMonth(`waves.${i}.month`, wave.month);
        check(`waves.${i}.additionalUsers`, wave.additionalUsers, 1, 1e9, true);
    });
    scenario.topUps.forEach((topUp, i) => {
        checkMonth(`topUps.${i}.month`, topUp.month);
        check(`topUps.${i}.credits`, topUp.credits, 1, MAX_CREDITS, true);
    });
    if (scenario.waves.length && scenario.startingUsers === undefined && baseline.weeklyActiveUsers === undefined) {
        errors.startingUsers = "Enter assumed starting users to translate rollout waves into credits.";
    }
    return errors;
}

/**
 * Demand compounds from month two; waves join at each month's start and grow
 * thereafter. Sensitivity varies credit intensity, not user count. Packs carry
 * forward once, never reset monthly; top-ups arrive before that month's use.
 */
export function calculateForecast(baseline: ForecastBaseline, scenario: ForecastScenario): ForecastResult {
    const errors = validateForecast(baseline, scenario);
    if (Object.keys(errors).length) return { ok: false, errors };
    const startingUsers = scenario.startingUsers ?? baseline.weeklyActiveUsers;
    const referenceUsers = baseline.weeklyActiveUsers ?? startingUsers;
    const creditsPerUser = referenceUsers === undefined ? undefined : baseline.monthlyCredits / referenceUsers;
    const growth = 1 + scenario.monthlyGrowthPercent / 100;
    const bands: { sensitivity: ForecastSensitivity; factor: number }[] = [
        { sensitivity: "Low", factor: 1 - scenario.sensitivityPercent / 100 },
        { sensitivity: "Base", factor: 1 },
        { sensitivity: "High", factor: 1 + scenario.sensitivityPercent / 100 },
    ];
    const series = bands.map(({ sensitivity, factor }): ForecastSeries => {
        let balance = scenario.availablePrepaidCredits;
        let users = startingUsers;
        const months: ForecastMonth[] = [];
        for (let i = 0; i < scenario.horizonMonths; i++) {
            const month = shiftForecastMonth(scenario.startMonth, i);
            const additionalUsers = scenario.waves.filter((wave) => wave.month === month).reduce((sum, wave) => sum + wave.additionalUsers, 0);
            const topUpCredits = scenario.topUps.filter((topUp) => topUp.month === month).reduce((sum, topUp) => sum + topUp.credits, 0);
            if (users !== undefined) users = users * (i === 0 ? 1 : growth) + additionalUsers;
            const demand = users !== undefined && creditsPerUser !== undefined
                ? users * creditsPerUser
                : baseline.monthlyCredits * growth ** i;
            const credits = demand * scenario.intensityFactor * factor;
            const openingPrepaidCredits = balance;
            const available = balance + topUpCredits;
            // Fractional credits can leave floating-point dust at exact depletion.
            const tolerance = Math.min(1e-6, Number.EPSILON * Math.max(1, available, credits) * 8);
            const exactlyCovered = Math.abs(available - credits) <= tolerance;
            const prepaidCredits = exactlyCovered ? credits : Math.min(available, credits);
            const paygCredits = Math.max(0, credits - prepaidCredits);
            balance = exactlyCovered ? 0 : Math.max(0, available - prepaidCredits);
            const paygCost = paygCredits * scenario.paygRate;
            months.push({
                month, activeUsers: users, additionalUsers, credits, openingPrepaidCredits, topUpCredits,
                prepaidCredits, paygCredits, closingPrepaidCredits: balance,
                consumedCost: prepaidCredits * scenario.prepaidRate + paygCost,
                committedPurchases: topUpCredits * scenario.prepaidRate,
                paygCost,
            });
        }
        return {
            sensitivity, factor, months,
            totalCredits: months.reduce((sum, month) => sum + month.credits, 0),
            consumedCost: months.reduce((sum, month) => sum + month.consumedCost, 0),
            committedPurchases: months.reduce((sum, month) => sum + month.committedPurchases, 0),
            paygCost: months.reduce((sum, month) => sum + month.paygCost, 0),
            closingPrepaidCredits: balance,
            firstPaygMonth: months.find((month) => month.paygCredits > 0)?.month,
            firstDepletionMonth: months.find((month) => month.credits > 0 && month.closingPrepaidCredits === 0)?.month,
        };
    });
    const safe = (value: unknown) => typeof value !== "number" || (Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER);
    if (series.some((band) => !Object.values(band).every(safe) || band.months.some((month) => !Object.values(month).every(safe)))) {
        return { ok: false, errors: { scenario: "The projection is too large to calculate reliably. Reduce growth, users, intensity or credits." } };
    }
    return { ok: true, series };
}

export function forecastChartTable(series: readonly ForecastSeries[]): DataTable {
    const base = series.find((band) => band.sensitivity === "Base")!;
    const low = series.find((band) => band.sensitivity === "Low")!;
    const high = series.find((band) => band.sensitivity === "High")!;
    return {
        columns: [
            { name: "Month", displayName: "Month" },
            { name: "Low", displayName: "Low credits", format: "#,##0" },
            { name: "Base", displayName: "Base credits", format: "#,##0" },
            { name: "High", displayName: "High credits", format: "#,##0" },
        ],
        rows: base.months.map((month, i) => [`${month.month}-01T00:00:00Z`, low.months[i].credits, month.credits, high.months[i].credits]),
    };
}

/** Export assumptions with the estimates so a detached CSV is not mistaken for actual billing. */
export function forecastExportTable(baseline: ForecastBaseline, scenario: ForecastScenario, series: readonly ForecastSeries[]): DataTable {
    const names = [
        "Estimate — sensitivity", "Month", "Active users (weekly equivalent)", "Rollout users", "Credits",
        "Opening prepaid credits", "Top-up credits", "Prepaid credits consumed", "PAYG credits", "Closing prepaid credits",
        "Consumed cost (USD)", "Top-up purchases (USD)", "PAYG cost (USD)", "Source period start", "Source period end",
        "Reported weeks", "Weekly credits baseline", "Weeks per month", "Monthly growth (%)", "Intensity factor",
        "Sensitivity (+/- %)", "Starting users", "Initial available credits (assumption)", "Prepaid rate (USD)", "PAYG rate (USD)", "Exclusions",
    ];
    return {
        columns: names.map((name) => ({ name, displayName: name })),
        rows: series.flatMap((band) => band.months.map((month) => [
            band.sensitivity, month.month, month.activeUsers ?? null, month.additionalUsers, month.credits,
            month.openingPrepaidCredits, month.topUpCredits, month.prepaidCredits, month.paygCredits, month.closingPrepaidCredits,
            month.consumedCost, month.committedPurchases, month.paygCost, baseline.periodStart, baseline.periodEnd,
            baseline.weeks, baseline.weeklyCredits, FORECAST_WEEKS_PER_MONTH, scenario.monthlyGrowthPercent, scenario.intensityFactor,
            scenario.sensitivityPercent, scenario.startingUsers ?? baseline.weeklyActiveUsers ?? null, scenario.availablePrepaidCredits,
            scenario.prepaidRate, scenario.paygRate, "Expiry; tax; invoice reconciliation; licences; other products. Sensitivity is not a confidence interval.",
        ])),
    };
}
