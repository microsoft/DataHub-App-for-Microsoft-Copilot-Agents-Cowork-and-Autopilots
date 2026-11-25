//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * The calculations behind the Cloud and AI spend views, kept apart from the
 * screen so each rule can be tested. Every figure is derived from the daily
 * charges; nothing here is typed in. Cost bases are never mixed: each view
 * names the basis it reads, and credits, tokens and requests are never added
 * into one total.
 */

import {
    APPLICATIONS,
    BUDGETS,
    CATEGORIES,
    COMMITMENTS,
    COST_CENTRE_NAMES,
    DATA_FROM,
    DATA_TO,
    FEEDS,
    INVOICE_VARIANCE,
    MONTHS,
    PACK,
    PROVIDERS,
    UNASSIGNED,
    UNTAGGED,
    addDays,
    daysBetween,
    daysInMonth,
    monthName,
    monthOf,
    nextMonth,
    type Application,
    type Basis,
    type Charge,
    type CommitmentRecord,
    type Feed,
    type FinopsData,
    type Provider,
    type ProviderChoice,
} from "./data";

export interface View {
    basis: Basis;
    provider: ProviderChoice;
    /** Inclusive ISO dates; undefined means the whole data window. */
    from?: string;
    to?: string;
}

export const ASSUMPTIONS = {
    /** A loaded cost for an hour of someone's time: a planning assumption. */
    hourly: 62,
    saved: [0.25, 0.5, 0.75] as const,
    defaultSaved: 0.5,
    expand: [100, 250, 500, 1000] as const,
    /** Faster adoption grows this many times as fast as the recent trend. */
    fasterAdoption: 1.5,
};

const COST_FIELD = { Billed: "billed", Effective: "effective", List: "list", Contracted: "contracted" } as const satisfies Record<Basis, keyof Charge>;
export const costOf = (charge: Charge, basis: Basis): number => charge[COST_FIELD[basis]];
const sum = (rows: readonly Charge[], value: (charge: Charge) => number) => rows.reduce((total, row) => total + value(row), 0);
const share = (part: number, total: number) => (total > 0 ? part / total : 0);
export const isAi = (charge: Charge) => charge.category === "AI and ML";

function groupSum(rows: readonly Charge[], key: (charge: Charge) => string, value: (charge: Charge) => number): Map<string, number> {
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(key(row), (totals.get(key(row)) ?? 0) + value(row));
    return totals;
}

// ── Dates and windows ───────────────────────────────────────────────────

export interface Window {
    from: string;
    to: string;
    days: number;
}

export function windowOf(from?: string, to?: string): Window {
    const start = from && from > DATA_FROM ? from : DATA_FROM;
    const end = to && to < DATA_TO ? to : DATA_TO;
    return { from: start, to: end, days: Math.max(daysBetween(start, end) + 1, 0) };
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
const dayOfMonth = (iso: string) => Number(iso.slice(8));
export const shortDay = (iso: string) => `${dayOfMonth(iso)} ${monthName(iso.slice(0, 7))}`;

/** A month's label, saying so when the range or the data covers only part of it. */
export function monthLabel(month: string, w: Window = { from: DATA_FROM, to: DATA_TO, days: 0 }): string {
    const start = `${month}-01`;
    const end = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
    const from = w.from > start ? w.from : start;
    const to = w.to < end ? w.to : end;
    const name = monthName(month);
    const year = month.slice(0, 4) === DATA_FROM.slice(0, 4) ? "" : ` ${month.slice(0, 4)}`;
    if (start > w.to) return `${name}${year}`;
    if (from === start && to === end) return `${name}${year}`;
    if (from === start) return `${name}${year} (to ${ordinal(dayOfMonth(to))})`;
    if (to === end) return `${name}${year} (from ${ordinal(dayOfMonth(from))})`;
    return `${name}${year} (${ordinal(dayOfMonth(from))}–${ordinal(dayOfMonth(to))})`;
}

export function monthsIn(w: Window): string[] {
    return MONTHS.filter((month) => `${month}-01` <= w.to && addDays(`${month}-01`, daysInMonth(month) - 1) >= w.from);
}

const inWindow = (charge: Charge, w: Window) => charge.date >= w.from && charge.date <= w.to;
const forProvider = (data: FinopsData, provider: ProviderChoice) =>
    provider === "All providers" ? data.charges : data.charges.filter((charge) => charge.provider === provider);

export interface Compare {
    days: number;
    current: { from: string; to: string };
    prior: { from: string; to: string };
    label: string;
}

/** The last 30 days of the range against the 30 before; a shorter range compares equal lengths. */
export function comparison(w: Window): Compare | null {
    const days = Math.min(30, w.days);
    if (days < 7) return null;
    const current = { from: addDays(w.to, -(days - 1)), to: w.to };
    const prior = { from: addDays(current.from, -days), to: addDays(current.from, -1) };
    if (prior.from < DATA_FROM) return null;
    return { days, current, prior, label: `Last ${days} days to ${shortDay(w.to)}, against the ${days} before` };
}

export interface Change {
    current: number;
    prior: number;
    delta: number;
    pct: number | null;
    /** There was no spend in the prior period, so no percentage means anything. */
    isNew: boolean;
}
export const changeOf = (current: number, prior: number): Change => ({
    current,
    prior,
    delta: current - prior,
    pct: prior > 0 ? (current - prior) / prior : null,
    isNew: prior <= 0 && current > 0,
});

interface Selection {
    w: Window;
    /** Charges for the provider choice, across all dates. */
    all: Charge[];
    /** The same charges inside the date range. */
    rows: Charge[];
    cmp: Compare | null;
}
function select(data: FinopsData, view: View): Selection {
    const w = windowOf(view.from, view.to);
    const all = forProvider(data, view.provider);
    return { w, all, rows: all.filter((charge) => inWindow(charge, w)), cmp: comparison(w) };
}
const totalBetween = (rows: readonly Charge[], basis: Basis, span: { from: string; to: string }) =>
    sum(rows.filter((c) => c.date >= span.from && c.date <= span.to), (c) => costOf(c, basis));

// ── Waterfalls ──────────────────────────────────────────────────────────

export interface WaterfallStep {
    label: string;
    start: number;
    end: number;
    value: number;
    kind: "Total" | "Increase" | "Decrease";
}
export type WaterfallItem = { label: string; delta: number } | { label: string; total: true };

/** Steps run from a starting total through each change; a subtotal is the running sum, so the chart always adds up. */
export function waterfall(start: { label: string; value: number }, items: readonly WaterfallItem[]): WaterfallStep[] {
    const steps: WaterfallStep[] = [{ label: start.label, start: 0, end: start.value, value: start.value, kind: "Total" }];
    let running = start.value;
    for (const item of items) {
        if ("total" in item) {
            steps.push({ label: item.label, start: 0, end: running, value: running, kind: "Total" });
        } else {
            steps.push({ label: item.label, start: running, end: running + item.delta, value: item.delta, kind: item.delta >= 0 ? "Increase" : "Decrease" });
            running += item.delta;
        }
    }
    return steps;
}

// ── Overview ────────────────────────────────────────────────────────────

export interface Mover {
    service: string;
    provider: Provider;
    current: number;
    prior: number;
    delta: number;
    pct: number | null;
    isNew: boolean;
}

function moversOf(rows: readonly Charge[], cmp: Compare, basis: Basis): Mover[] {
    const keyOf = (c: Charge) => `${c.provider}|${c.service}`;
    const current = groupSum(rows.filter((c) => c.date >= cmp.current.from && c.date <= cmp.current.to), keyOf, (c) => costOf(c, basis));
    const prior = groupSum(rows.filter((c) => c.date >= cmp.prior.from && c.date <= cmp.prior.to), keyOf, (c) => costOf(c, basis));
    return [...new Set([...current.keys(), ...prior.keys()])]
        .map((key) => {
            const [provider, service] = key.split("|") as [Provider, string];
            const change = changeOf(current.get(key) ?? 0, prior.get(key) ?? 0);
            return { service, provider, ...change };
        })
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export interface Overview {
    empty: boolean;
    window: Window;
    total: number;
    ai: number;
    aiShare: number;
    byProvider: { provider: Provider; value: number; share: number }[];
    change: (Change & { label: string }) | null;
    topMover: Mover | null;
    feeds: { total: number; needAttention: number; empty: number };
}

export function overview(data: FinopsData, view: View): Overview {
    const { w, all, rows, cmp } = select(data, view);
    const total = sum(rows, (c) => costOf(c, view.basis));
    const ai = sum(rows.filter(isAi), (c) => costOf(c, view.basis));
    const providerTotals = groupSum(rows, (c) => c.provider, (c) => costOf(c, view.basis));
    const change = cmp ? { ...changeOf(totalBetween(all, view.basis, cmp.current), totalBetween(all, view.basis, cmp.prior)), label: cmp.label } : null;
    const movers = cmp ? moversOf(all, cmp, view.basis).filter((m) => m.delta > 0) : [];
    return {
        empty: rows.length === 0,
        window: w,
        total,
        ai,
        aiShare: share(ai, total),
        byProvider: PROVIDERS.map((provider) => ({ provider, value: providerTotals.get(provider) ?? 0, share: share(providerTotals.get(provider) ?? 0, total) })).filter((p) => p.value > 0),
        change,
        topMover: movers[0] ?? null,
        feeds: {
            total: FEEDS.length,
            needAttention: FEEDS.filter((f) => f.status === "Late" || f.status === "Failed" || f.status === "Estimated").length,
            empty: FEEDS.filter((f) => f.status === "Empty").length,
        },
    };
}

// ── Portfolio ───────────────────────────────────────────────────────────

export interface ProviderStrip {
    provider: Provider;
    value: number;
    share: number;
    change: Change | null;
    /** Weekly totals, oldest first, full weeks only. */
    series: number[];
    feeds: Feed[];
}
export interface Portfolio {
    empty: boolean;
    window: Window;
    compare: Compare | null;
    monthOrder: string[];
    monthly: { Month: string; Provider: string; Cost: number }[];
    kinds: { Month: string; Kind: string; Cost: number }[];
    providers: ProviderStrip[];
}

function weeklySeries(rows: readonly Charge[], w: Window, basis: Basis): number[] {
    const weeks = Math.floor(w.days / 7);
    if (weeks < 2) return [];
    const totals = Array.from({ length: weeks }, () => 0);
    for (const row of rows) {
        const index = weeks - 1 - Math.floor(daysBetween(row.date, w.to) / 7);
        if (index >= 0) totals[index] += costOf(row, basis);
    }
    return totals;
}

export const AI_KIND = "AI and ML";
export const OTHER_KIND = "Other cloud";

export function portfolio(data: FinopsData, view: View): Portfolio {
    const { w, all, rows, cmp } = select(data, view);
    const months = monthsIn(w);
    const labels = months.map((month) => monthLabel(month, w));
    const monthly: Portfolio["monthly"] = [];
    const kinds: Portfolio["kinds"] = [];
    months.forEach((month, index) => {
        const inMonth = rows.filter((c) => c.month === month);
        for (const provider of PROVIDERS) {
            const cost = sum(inMonth.filter((c) => c.provider === provider), (c) => costOf(c, view.basis));
            if (cost !== 0) monthly.push({ Month: labels[index], Provider: provider, Cost: cost });
        }
        kinds.push({ Month: labels[index], Kind: AI_KIND, Cost: sum(inMonth.filter(isAi), (c) => costOf(c, view.basis)) });
        kinds.push({ Month: labels[index], Kind: OTHER_KIND, Cost: sum(inMonth.filter((c) => !isAi(c)), (c) => costOf(c, view.basis)) });
    });
    const total = sum(rows, (c) => costOf(c, view.basis));
    const providers = PROVIDERS.flatMap((provider) => {
        const own = rows.filter((c) => c.provider === provider);
        const value = sum(own, (c) => costOf(c, view.basis));
        if (own.length === 0) return [];
        const allOwn = all.filter((c) => c.provider === provider);
        return [{
            provider,
            value,
            share: share(value, total),
            change: cmp ? changeOf(totalBetween(allOwn, view.basis, cmp.current), totalBetween(allOwn, view.basis, cmp.prior)) : null,
            series: weeklySeries(own, w, view.basis),
            feeds: FEEDS.filter((f) => f.provider === provider),
        }];
    });
    return { empty: rows.length === 0, window: w, compare: cmp, monthOrder: labels, monthly, kinds, providers };
}

// ── Explorer ────────────────────────────────────────────────────────────

export interface ServiceRow {
    Service: string;
    Provider: Provider;
    Category: string;
    Cost: number;
    Share: number;
    change: Change | null;
}
export interface Explorer {
    empty: boolean;
    window: Window;
    compare: Compare | null;
    waterfall: WaterfallStep[];
    movers: Mover[];
    services: ServiceRow[];
    monthOrder: string[];
    heat: { Category: string; Month: string; Cost: number }[];
}

const MOVERS_SHOWN = 7;

export function explorer(data: FinopsData, view: View): Explorer {
    const { w, all, rows, cmp } = select(data, view);
    const months = monthsIn(w);
    const labels = months.map((month) => monthLabel(month, w));
    const total = sum(rows, (c) => costOf(c, view.basis));
    const movers = cmp ? moversOf(all, cmp, view.basis) : [];
    let steps: WaterfallStep[] = [];
    if (cmp) {
        const priorTotal = totalBetween(all, view.basis, cmp.prior);
        const currentTotal = totalBetween(all, view.basis, cmp.current);
        const top = movers.slice(0, MOVERS_SHOWN);
        const other = currentTotal - priorTotal - top.reduce((t, m) => t + m.delta, 0);
        steps = waterfall(
            { label: `Prior ${cmp.days} days`, value: priorTotal },
            [...top.map((m) => ({ label: m.service, delta: m.delta })), ...(Math.abs(other) >= 1 ? [{ label: "Other services", delta: other }] : []), { label: `Last ${cmp.days} days`, total: true }],
        );
    }
    const byService = new Map<string, Charge[]>();
    for (const row of rows) byService.set(`${row.provider}|${row.service}`, [...(byService.get(`${row.provider}|${row.service}`) ?? []), row]);
    const services = [...byService.entries()]
        .map(([key, own]) => {
            const [provider, service] = key.split("|") as [Provider, string];
            const cost = sum(own, (c) => costOf(c, view.basis));
            const mover = movers.find((m) => m.provider === provider && m.service === service);
            return { Service: service, Provider: provider, Category: own[0].category, Cost: cost, Share: share(cost, total), change: mover ? changeOf(mover.current, mover.prior) : null };
        })
        .sort((a, b) => b.Cost - a.Cost);
    const heat: Explorer["heat"] = [];
    months.forEach((month, index) => {
        for (const category of CATEGORIES) {
            const cost = sum(rows.filter((c) => c.month === month && c.category === category), (c) => costOf(c, view.basis));
            heat.push({ Category: category, Month: labels[index], Cost: Math.round(cost) });
        }
    });
    return { empty: rows.length === 0, window: w, compare: cmp, waterfall: steps, movers, services, monthOrder: labels, heat };
}

// ── Models ──────────────────────────────────────────────────────────────

export const BUCKETS = ["Input", "Output", "Cache read", "Cache write"] as const;
export interface ModelRow {
    Model: string;
    model: string;
    provider: Provider;
    Cost: number;
    /** Millions of tokens, on days with token detail. */
    Tokens: number;
    buckets: Record<(typeof BUCKETS)[number], number>;
    perMillion: number | null;
    cacheShare: number;
    /** The share of this model's cost on days with token detail. */
    detail: number;
}
export interface Models {
    empty: boolean;
    window: Window;
    monthOrder: string[];
    rows: ModelRow[];
    mix: { Model: string; Bucket: string; Share: number }[];
    trend: { Month: string; Model: string; "Per million tokens": number }[];
    missingDays: boolean;
}

const tokensOf = (c: Charge) => c.input + c.output + c.cacheRead + c.cacheWrite;
export const modelLabel = (model: string, provider: Provider) => `${model} · ${provider}`;

export function models(data: FinopsData, view: View): Models {
    const { w, rows } = select(data, view);
    const usage = rows.filter((c) => c.charge === "Usage" && c.model !== "");
    const groups = new Map<string, Charge[]>();
    for (const row of usage) groups.set(`${row.provider}|${row.model}`, [...(groups.get(`${row.provider}|${row.model}`) ?? []), row]);
    const months = monthsIn(w);
    const labels = months.map((month) => monthLabel(month, w));
    const result: ModelRow[] = [];
    const trend: Models["trend"] = [];
    for (const [key, own] of groups) {
        const [provider, model] = key.split("|") as [Provider, string];
        const withDetail = own.filter((c) => c.tokenData);
        const tokens = sum(withDetail, tokensOf);
        const cost = sum(own, (c) => costOf(c, view.basis));
        const detailCost = sum(withDetail, (c) => costOf(c, view.basis));
        const label = modelLabel(model, provider);
        result.push({
            Model: label,
            model,
            provider,
            Cost: cost,
            Tokens: tokens,
            buckets: { Input: sum(withDetail, (c) => c.input), Output: sum(withDetail, (c) => c.output), "Cache read": sum(withDetail, (c) => c.cacheRead), "Cache write": sum(withDetail, (c) => c.cacheWrite) },
            perMillion: tokens > 0 ? detailCost / tokens : null,
            cacheShare: share(sum(withDetail, (c) => c.cacheRead), tokens),
            detail: share(detailCost, cost),
        });
        const points = months.flatMap((month, index) => {
            const inMonth = withDetail.filter((c) => c.month === month);
            const monthTokens = sum(inMonth, tokensOf);
            return monthTokens > 0 ? [{ Month: labels[index], Model: label, "Per million tokens": sum(inMonth, (c) => costOf(c, view.basis)) / monthTokens }] : [];
        });
        if (points.length >= 2) trend.push(...points);
    }
    result.sort((a, b) => b.Cost - a.Cost);
    return {
        empty: usage.length === 0,
        window: w,
        monthOrder: labels,
        rows: result,
        mix: result.flatMap((r) => BUCKETS.map((bucket) => ({ Model: r.Model, Bucket: bucket, Share: share(r.buckets[bucket], r.Tokens) }))),
        trend,
        missingDays: usage.some((c) => !c.tokenData),
    };
}

// ── Unit economics ──────────────────────────────────────────────────────

export interface UnitRow {
    app: Application;
    cost: number;
    outcomes: number;
    perOutcome: number | null;
    personMonths: number;
    perPersonMonth: number | null;
    /** What one outcome would cost by hand at the reference loaded rate, before any share saved. */
    handCost: number;
}
export interface Unit {
    empty: boolean;
    window: Window;
    rows: UnitRow[];
    untaggedShare: number;
}

const monthsSinceStart = (month: string) => (Number(month.slice(0, 4)) - Number(MONTHS[0].slice(0, 4))) * 12 + Number(month.slice(5, 7)) - Number(MONTHS[0].slice(5, 7));
const peopleIn = (app: Application, month: string) => app.people * (1 + app.peopleGrowth) ** monthsSinceStart(month);

/** Cost per outcome and per person on the Effective basis; days without token detail are left out of both sides. */
export function unit(data: FinopsData, view: View): Unit {
    const { w, rows } = select(data, { ...view, basis: "Effective", provider: "All providers" });
    const ai = rows.filter((c) => isAi(c) && c.charge === "Usage" && c.tokenData);
    const result = APPLICATIONS.flatMap((app) => {
        const own = ai.filter((c) => c.application === app.id);
        const outcomes = sum(own, (c) => c.outcomes);
        if (outcomes <= 0) return [];
        const cost = sum(own, (c) => c.effective);
        const days = new Set(own.map((c) => c.date));
        const personMonths = app.people > 0 ? [...days].reduce((t, d) => t + peopleIn(app, monthOf(d)) / daysInMonth(monthOf(d)), 0) : 0;
        return [{
            app,
            cost,
            outcomes,
            perOutcome: cost / outcomes,
            personMonths,
            perPersonMonth: personMonths > 0 ? cost / personMonths : null,
            handCost: (app.refMinutes / 60) * ASSUMPTIONS.hourly,
        }];
    }).sort((a, b) => b.cost - a.cost);
    const aiTotal = sum(ai, (c) => c.effective);
    return { empty: result.length === 0, window: w, rows: result, untaggedShare: share(sum(ai.filter((c) => c.application === UNTAGGED), (c) => c.effective), aiTotal) };
}

// ── Rates, commitments and credits ──────────────────────────────────────

export interface RateRow {
    provider: Provider | "All";
    list: number;
    contracted: number;
    effective: number;
    negotiated: number;
    commitmentEffect: number;
}
export interface CommitmentView {
    record: CommitmentRecord;
    coverage: number;
    utilisation: number;
    coverageStart: number;
    utilisationStart: number;
    unused: number;
    late: boolean;
}
export interface PtuView {
    utilisation: number;
    fee: number;
    payg: number;
    days: number;
}
export interface PackView {
    purchased: number;
    drawn: number;
    balance: number;
    burnPerDay: number;
    daysLeft: number | null;
    exhausts: string | null;
    /** What OpenAI usage costs a month once the credits run out, at the recent pace. */
    monthlyAfter: number;
    series: { Date: string; Balance: number; Kind: "Actual" | "Projected" }[];
}
export interface Rates {
    empty: boolean;
    window: Window;
    rows: RateRow[];
    total: RateRow;
    commitments: CommitmentView[];
    ptu: PtuView | null;
}

const rateRow = (provider: RateRow["provider"], rows: readonly Charge[]): RateRow => {
    const list = sum(rows, (c) => c.list);
    const contracted = sum(rows, (c) => c.contracted);
    const effective = sum(rows, (c) => c.effective);
    return { provider, list, contracted, effective, negotiated: list - contracted, commitmentEffect: contracted - effective };
};

export function rates(data: FinopsData, view: View): Rates {
    const { w, rows } = select(data, { ...view, provider: "All providers" });
    const usage = rows.filter((c) => c.charge === "Usage");
    const ptuRows = usage.filter((c) => c.commitment === "Provisioned throughput");
    const fee = sum(ptuRows, (c) => c.list);
    return {
        empty: usage.length === 0,
        window: w,
        rows: PROVIDERS.map((p) => rateRow(p, usage.filter((c) => c.provider === p))).filter((r) => r.list > 0),
        total: rateRow("All", usage),
        commitments: COMMITMENTS.map((record) => {
            const last = record.coverage.length - 1;
            return {
                record,
                coverage: record.coverage[last],
                utilisation: record.utilisation[last],
                coverageStart: record.coverage[0],
                utilisationStart: record.utilisation[0],
                unused: record.monthlyCommit * (1 - record.utilisation[last]),
                late: record.asOf < DATA_TO,
            };
        }),
        ptu: ptuRows.length ? { utilisation: share(sum(ptuRows, (c) => c.payg), fee), fee, payg: sum(ptuRows, (c) => c.payg), days: new Set(ptuRows.map((c) => c.date)).size } : null,
    };
}

/** The prepaid pack's balance to the end of the data, and when it runs out at the last week's pace. */
export function pack(data: FinopsData): PackView {
    const rows = data.charges.filter((c) => c.provider === PACK.provider);
    const purchased = sum(rows.filter((c) => c.charge === "Purchase"), (c) => c.billed);
    const coveredOn = groupSum(rows.filter((c) => c.charge === "Usage"), (c) => c.date, (c) => c.effective - c.billed);
    const usageOn = groupSum(rows.filter((c) => c.charge === "Usage"), (c) => c.date, (c) => c.effective);
    let balance = 0;
    const series: PackView["series"] = [];
    for (let date = PACK.date; date <= DATA_TO; date = addDays(date, 1)) {
        if (date === PACK.date) balance += purchased;
        balance -= coveredOn.get(date) ?? 0;
        series.push({ Date: date, Balance: balance, Kind: "Actual" });
    }
    const recent = Array.from({ length: 7 }, (_, i) => addDays(DATA_TO, -i));
    const burnPerDay = recent.reduce((t, d) => t + (coveredOn.get(d) ?? 0), 0) / 7;
    const usagePerDay = recent.reduce((t, d) => t + (usageOn.get(d) ?? 0), 0) / 7;
    const daysLeft = burnPerDay > 0 ? balance / burnPerDay : null;
    const exhausts = daysLeft === null ? null : addDays(DATA_TO, Math.ceil(daysLeft));
    if (exhausts) {
        series.push({ Date: DATA_TO, Balance: balance, Kind: "Projected" }, { Date: exhausts, Balance: 0, Kind: "Projected" });
    }
    return { purchased, drawn: purchased - balance, balance, burnPerDay, daysLeft, exhausts, monthlyAfter: usagePerDay * 30.4375, series };
}

// ── Allocation ──────────────────────────────────────────────────────────

export interface Allocation {
    empty: boolean;
    window: Window;
    centres: string[];
    heatProviders: Provider[];
    heat: { "Cost centre": string; Provider: string; Cost: number }[];
    monthOrder: string[];
    monthly: { Month: string; Kind: string; Cost: number }[];
    unassigned: number;
    unassignedShare: number;
    total: number;
    coverage: { Provider: string; Month: string; Share: number }[];
}

export function allocation(data: FinopsData, view: View): Allocation {
    const { w, rows } = select(data, { ...view, basis: "Effective" });
    const usage = rows.filter((c) => c.charge === "Usage");
    const total = sum(usage, (c) => c.effective);
    const unassigned = sum(usage.filter((c) => c.costCentre === UNASSIGNED), (c) => c.effective);
    const byCentre = groupSum(usage.filter((c) => c.costCentre !== UNASSIGNED), (c) => c.costCentre, (c) => c.effective);
    const centres = [...COST_CENTRE_NAMES].filter((n) => byCentre.has(n)).sort((a, b) => (byCentre.get(b) ?? 0) - (byCentre.get(a) ?? 0));
    const providers = PROVIDERS.filter((p) => usage.some((c) => c.provider === p));
    const months = monthsIn(w);
    const labels = months.map((m) => monthLabel(m, w));
    const heat = [...centres, UNASSIGNED].flatMap((centre) =>
        providers.map((provider) => ({ "Cost centre": centre, Provider: provider, Cost: Math.round(sum(usage.filter((c) => c.costCentre === centre && c.provider === provider), (c) => c.effective)) })),
    );
    const monthly = months.flatMap((month, index) => {
        const inMonth = usage.filter((c) => c.month === month);
        const missing = sum(inMonth.filter((c) => c.costCentre === UNASSIGNED), (c) => c.effective);
        return [
            { Month: labels[index], Kind: "Allocated", Cost: sum(inMonth, (c) => c.effective) - missing },
            { Month: labels[index], Kind: UNASSIGNED, Cost: missing },
        ];
    });
    const coverage = providers.flatMap((provider) =>
        months.flatMap((month, index) => {
            const own = usage.filter((c) => c.provider === provider && c.month === month);
            const all = sum(own, (c) => c.effective);
            return all > 0 ? [{ Provider: provider, Month: labels[index], Share: 1 - share(sum(own.filter((c) => c.costCentre === UNASSIGNED), (c) => c.effective), all) }] : [];
        }),
    );
    return { empty: usage.length === 0, window: w, centres, heatProviders: providers, heat, monthOrder: labels, monthly, unassigned, unassignedShare: share(unassigned, total), total, coverage };
}

// ── Trust: feeds, coverage and the invoice ──────────────────────────────

export type CellState = "Good" | "Watch" | "Gap" | "None";
export interface CoverageCell {
    label: string;
    text: string;
    state: CellState;
}
export interface CoverageRow {
    provider: string;
    cells: CoverageCell[];
}
export const COVERAGE_COLUMNS = ["Cost", "Tags", "Commitments", "Token detail", "Invoice"] as const;

const pctText = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
const signed = (v: number, digits = 2) => `${v >= 0 ? "+" : "−"}${(Math.abs(v) * 100).toFixed(digits)}%`;

/** What each provider's data can and cannot support, as of the last day of data. */
export function coverage(data: FinopsData): CoverageRow[] {
    const closed = MONTHS.length - 2;
    const rows = PROVIDERS.map((provider): CoverageRow => {
        const own = data.charges.filter((c) => c.provider === provider && c.charge === "Usage");
        const feed = FEEDS.find((f) => f.provider === provider && /cost|billing|usage/i.test(f.feed));
        const cost: CoverageCell = feed?.status === "Estimated"
            ? { label: "Cost", text: "Estimated: invoice not issued", state: "Watch" }
            : { label: "Cost", text: `Current to ${shortDay(feed?.latest ?? DATA_TO)}`, state: "Good" };
        const allocated = 1 - share(sum(own.filter((c) => c.costCentre === UNASSIGNED), (c) => c.effective), sum(own, (c) => c.effective));
        const tags: CoverageCell = { label: "Tags", text: `${pctText(allocated)} allocated`, state: allocated >= 0.95 ? "Good" : allocated >= 0.85 ? "Watch" : "Gap" };
        const record = COMMITMENTS.find((r) => r.provider === provider);
        const commitments: CoverageCell = !record && !own.some((c) => c.commitment === "Provisioned throughput")
            ? { label: "Commitments", text: "None", state: "None" }
            : record
                ? { label: "Commitments", text: `As of ${shortDay(record.asOf)}`, state: record.asOf < DATA_TO ? "Watch" : "Good" }
                : { label: "Commitments", text: "Reserved capacity, from cost", state: "Good" };
        const aiRows = own.filter(isAi);
        const missing = aiRows.filter((c) => !c.tokenData);
        const firstMissing = missing.map((c) => c.date).sort()[0];
        const tokens: CoverageCell = aiRows.length === 0
            ? { label: "Token detail", text: "No AI usage", state: "None" }
            : missing.length === 0
                ? { label: "Token detail", text: "Complete", state: "Good" }
                : { label: "Token detail", text: `Missing from ${shortDay(firstMissing)}`, state: "Gap" };
        const variance = INVOICE_VARIANCE.find((v) => v.provider === provider);
        const latest = variance?.variance[closed];
        const invoice: CoverageCell = latest === null || latest === undefined
            ? { label: "Invoice", text: "Not reconciled", state: "None" }
            : Math.abs(latest) < 0.001
                ? { label: "Invoice", text: `${monthName(MONTHS[closed])}: ${signed(latest)}, rounding`, state: "Good" }
                : variance!.reason === "Not yet explained"
                    ? { label: "Invoice", text: `${monthName(MONTHS[closed])}: ${signed(latest)}, not explained`, state: "Gap" }
                    : { label: "Invoice", text: `${monthName(MONTHS[closed])}: ${signed(latest)}, explained`, state: "Watch" };
        return { provider, cells: [cost, tags, commitments, tokens, invoice] };
    });
    const empty = FEEDS.filter((f) => f.status === "Empty");
    return [
        ...rows,
        ...empty.map((f): CoverageRow => ({
            provider: f.provider,
            cells: [{ label: "Cost", text: "Connected, no charges", state: "None" }, ...COVERAGE_COLUMNS.slice(1).map((label) => ({ label, text: "Nothing to cover", state: "None" as const }))],
        })),
    ];
}

export interface ReconcileRow {
    provider: Provider;
    billed: number;
    invoiced: number | null;
    difference: number | null;
    variance: number | null;
    reason: string;
}
export interface Reconciliation {
    month: string;
    open: boolean;
    steps: WaterfallStep[];
    rows: ReconcileRow[];
    residual: number;
}

const OPEN_NOTE = "The invoice has not been issued";

/** Contracted usage to the invoice for one month, with every difference named. */
export function reconcile(data: FinopsData, month: string): Reconciliation {
    const rows = data.charges.filter((c) => c.month === month);
    const usage = rows.filter((c) => c.charge === "Usage");
    const contracted = sum(usage, (c) => c.contracted);
    const commitmentEffect = sum(usage, (c) => c.contracted - c.effective);
    const credits = sum(usage, (c) => c.effective - c.billed);
    const bought = sum(rows.filter((c) => c.charge === "Purchase"), (c) => c.billed);
    const index = MONTHS.indexOf(month as (typeof MONTHS)[number]);
    const providerRows: ReconcileRow[] = PROVIDERS.flatMap((provider) => {
        const billed = sum(rows.filter((c) => c.provider === provider), (c) => c.billed);
        if (billed === 0) return [];
        const variance = INVOICE_VARIANCE.find((v) => v.provider === provider)?.variance[index] ?? null;
        const reason = INVOICE_VARIANCE.find((v) => v.provider === provider)?.reason ?? "";
        return [{ provider, billed, variance, invoiced: variance === null ? null : billed * (1 + variance), difference: variance === null ? null : billed * variance, reason: variance === null ? OPEN_NOTE : reason }];
    });
    const open = providerRows.every((r) => r.variance === null);
    const noticeable = providerRows.filter((r) => r.difference !== null && Math.abs(r.variance ?? 0) >= 0.001);
    const rounding = providerRows.filter((r) => r.difference !== null && Math.abs(r.variance ?? 0) < 0.001).reduce((t, r) => t + (r.difference ?? 0), 0);
    const items: WaterfallItem[] = [
        { label: "Commitments and reservations", delta: -commitmentEffect },
        { label: "Prepaid credits used", delta: -credits },
        { label: "Prepaid credits bought", delta: bought },
        { label: "Billed in the data", total: true },
        ...(open ? [] : [
            ...noticeable.map((r) => ({ label: `${r.provider} difference`, delta: r.difference ?? 0 })),
            { label: "Rounding, other providers", delta: rounding },
            { label: "Invoiced", total: true as const },
        ]),
    ];
    return {
        month,
        open,
        steps: waterfall({ label: "Usage at contracted rates", value: contracted }, items),
        rows: providerRows,
        residual: providerRows.reduce((t, r) => t + (r.difference ?? 0), 0),
    };
}

// ── Forecast ────────────────────────────────────────────────────────────

export const SCENARIOS = ["Flat", "Recent trend", "Faster adoption"] as const;
export type Scenario = (typeof SCENARIOS)[number];
export type ForecastScope = "All spend" | "AI spend";

export interface ProjectionMonth {
    month: string;
    label: string;
    budget: number | null;
    values: Record<Scenario, number | null>;
}
export interface Projection {
    complete: string[];
    toDate: number;
    pace: number;
    growth: number | null;
    months: ProjectionMonth[];
    reasons: Partial<Record<Scenario, string>>;
}

const INSUFFICIENT = "Insufficient history";
const AHEAD = 3;

function project(rows: readonly Charge[], budget: Readonly<Record<string, number>> | null): Projection {
    const daily = groupSum(rows, (c) => c.date, (c) => c.effective);
    const monthly = groupSum(rows, (c) => c.month, (c) => c.effective);
    const first = [...daily.keys()].sort()[0];
    const current = monthOf(DATA_TO);
    const complete = MONTHS.filter((month) => month < current && first !== undefined && first <= `${month}-01`);
    const toDate = monthly.get(current) ?? 0;
    const recentDaily = Array.from({ length: 7 }, (_, i) => daily.get(addDays(DATA_TO, -i)) ?? 0).reduce((t, v) => t + v, 0) / 7;
    const pace = toDate + recentDaily * (daysInMonth(current) - dayOfMonth(DATA_TO));
    const reasons: Projection["reasons"] = {};
    const enoughDays = first !== undefined && daysBetween(first, DATA_TO) + 1 >= 30;
    let growth: number | null = null;
    if (complete.length >= 3) {
        const [older, , newest] = complete.slice(-3);
        const dailyIn = (month: string) => (monthly.get(month) ?? 0) / daysInMonth(month);
        growth = dailyIn(older) > 0 ? (dailyIn(newest) / dailyIn(older)) ** 0.5 - 1 : null;
    }
    if (!enoughDays) for (const s of SCENARIOS) reasons[s] = `${INSUFFICIENT}: needs 30 days of data`;
    else if (growth === null) {
        reasons["Recent trend"] = `${INSUFFICIENT}: needs three complete months`;
        reasons["Faster adoption"] = `${INSUFFICIENT}: needs three complete months`;
    } else if (growth <= 0) {
        reasons["Faster adoption"] = "Not applicable: spend is not growing";
    }
    const perDay = pace / daysInMonth(current);
    let month = current;
    const months: ProjectionMonth[] = [];
    for (let k = 1; k <= AHEAD; k++) {
        month = nextMonth(month);
        const flat = perDay * daysInMonth(month);
        const at = (rate: number) => perDay * (1 + rate) ** k * daysInMonth(month);
        months.push({
            month,
            label: monthLabel(month),
            budget: budget?.[month] ?? null,
            values: {
                Flat: enoughDays ? flat : null,
                "Recent trend": enoughDays && growth !== null ? at(growth) : null,
                "Faster adoption": enoughDays && growth !== null && growth > 0 ? at(growth * ASSUMPTIONS.fasterAdoption) : null,
            },
        });
    }
    return { complete, toDate, pace, growth, months, reasons };
}

export interface Crossing {
    month: string;
    label: string;
    budget: number;
    toDate: number;
    date: string | null;
    crossed: boolean;
}
export interface Forecast extends Projection {
    scope: ForecastScope;
    actual: { month: string; label: string; value: number }[];
    crossing: Crossing | null;
    chart: { Series: string; Month: string; Value: number }[];
    monthOrder: string[];
    outlook: { provider: Provider; projection: Projection }[];
}

export const PACE_SERIES = "Current month at pace";

export function forecast(data: FinopsData, scope: ForecastScope): Forecast {
    const rows = data.charges.filter((c) => c.charge === "Usage" && (scope === "All spend" || isAi(c)));
    const budget = scope === "All spend" ? BUDGETS.total : BUDGETS.ai;
    const projection = project(rows, budget);
    const current = monthOf(DATA_TO);
    const monthly = groupSum(rows, (c) => c.month, (c) => c.effective);
    const actual = projection.complete.map((month) => ({ month, label: monthLabel(month), value: monthly.get(month) ?? 0 }));
    const dailyCurrent = groupSum(rows.filter((c) => c.month === current), (c) => c.date, (c) => c.effective);
    const limit = budget[current];
    let crossing: Crossing | null = null;
    if (limit !== undefined) {
        const remainingDays = daysInMonth(current) - dayOfMonth(DATA_TO);
        const perDay = remainingDays > 0 ? (projection.pace - projection.toDate) / remainingDays : 0;
        let date: string | null = null;
        let running = 0;
        for (const day of [...dailyCurrent.keys()].sort()) {
            running += dailyCurrent.get(day) ?? 0;
            if (running >= limit) { date = day; break; }
        }
        if (date === null && perDay > 0) {
            const candidate = addDays(DATA_TO, Math.ceil((limit - projection.toDate) / perDay));
            if (monthOf(candidate) === current) date = candidate;
        }
        crossing = { month: current, label: monthLabel(current, { from: DATA_FROM, to: DATA_TO, days: 0 }), budget: limit, toDate: projection.toDate, date, crossed: projection.toDate >= limit };
    }
    const chart: Forecast["chart"] = [];
    for (const a of actual) chart.push({ Series: "Actual", Month: a.label, Value: a.value });
    const lastActual = actual.at(-1);
    const currentLabel = monthLabel(current);
    if (lastActual) chart.push({ Series: PACE_SERIES, Month: lastActual.label, Value: lastActual.value });
    chart.push({ Series: PACE_SERIES, Month: currentLabel, Value: projection.pace });
    for (const scenario of SCENARIOS) {
        if (projection.months.every((m) => m.values[scenario] === null)) continue;
        chart.push({ Series: scenario, Month: currentLabel, Value: projection.pace });
        for (const m of projection.months) if (m.values[scenario] !== null) chart.push({ Series: scenario, Month: m.label, Value: m.values[scenario]! });
    }
    const monthOrder = [...projection.complete.map((m) => monthLabel(m)), currentLabel, ...projection.months.map((m) => m.label)];
    const budgetMonths = [...projection.complete, current, ...projection.months.map((m) => m.month)];
    for (const month of budgetMonths) if (budget[month] !== undefined) chart.push({ Series: "Budget", Month: monthLabel(month), Value: budget[month] });
    const outlook = PROVIDERS.map((provider) => ({ provider, projection: project(data.charges.filter((c) => c.provider === provider && c.charge === "Usage"), null) }));
    return { ...projection, scope, actual, crossing, chart, monthOrder, outlook };
}

export interface Expansion {
    perPerson: number;
    people: number;
    extra: number;
    nextLabel: string;
    headroom: number | null;
    supports: number | null;
}

/** What adding people would cost a month at today's blended AI cost per person, against next month's headroom. */
export function expansion(data: FinopsData, adds: number): Expansion {
    const span = { from: addDays(DATA_TO, -29), to: DATA_TO };
    const recent = data.charges.filter((c) => c.charge === "Usage" && isAi(c) && c.date >= span.from && c.date <= span.to);
    const peopleApps = APPLICATIONS.filter((a) => a.people > 0);
    const people = peopleApps.reduce((t, a) => t + peopleIn(a, monthOf(DATA_TO)), 0);
    const cost = sum(recent.filter((c) => peopleApps.some((a) => a.id === c.application)), (c) => c.effective);
    const perPerson = people > 0 ? cost / people : 0;
    const ai = forecast(data, "AI spend");
    const next = ai.months[0];
    const headroom = next?.budget != null && next.values.Flat !== null ? next.budget - next.values.Flat : null;
    return {
        perPerson,
        people,
        extra: perPerson * adds,
        nextLabel: next?.label ?? "",
        headroom,
        supports: headroom === null || perPerson <= 0 ? null : Math.max(0, Math.floor(headroom / perPerson)),
    };
}

// ── Review queue ────────────────────────────────────────────────────────

export interface Finding {
    id: string;
    tone: "Review" | "Watch";
    area: "Spend" | "Rates" | "Data";
    title: string;
    changed: string;
    scope: string;
    period: string;
    evidence: string;
    owner: string;
    next: string;
    href: string;
    link: string;
    amount: number | null;
}

const money = (v: number) => (Math.abs(v) >= 10_000 ? `$${Math.round(v / 1000)}k` : Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`);

function ownerOf(rows: readonly Charge[]): string {
    const totals = groupSum(rows.filter((c) => c.costCentre !== UNASSIGNED), (c) => c.costCentre, (c) => c.effective);
    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? UNASSIGNED;
}
const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
};

export interface Spike {
    provider: Provider;
    service: string;
    application: string;
    from: string;
    to: string;
    multiple: number;
    extra: number;
}

/** Runs of days where tagged cost for one service and application exceeded twice its median of the 14 days before. */
export function spikes(data: FinopsData): Spike[] {
    const keys = new Map<string, Charge[]>();
    for (const c of data.charges) {
        if (c.charge !== "Usage" || c.application === UNTAGGED) continue;
        const key = `${c.provider}|${c.service}|${c.application}`;
        keys.set(key, [...(keys.get(key) ?? []), c]);
    }
    const found: Spike[] = [];
    for (const [key, own] of keys) {
        const [provider, service, application] = key.split("|") as [Provider, string, string];
        const byDay = groupSum(own, (c) => c.date, (c) => c.effective);
        const days = [...byDay.keys()].sort();
        const flagged: { date: string; value: number; baseline: number }[] = [];
        days.forEach((date, i) => {
            if (i < 14) return;
            const baseline = median(days.slice(i - 14, i).map((d) => byDay.get(d) ?? 0));
            const value = byDay.get(date) ?? 0;
            if (baseline > 0 && value > 2 * baseline) flagged.push({ date, value, baseline });
        });
        let run: typeof flagged = [];
        const close = () => {
            if (run.length) {
                const extra = run.reduce((t, d) => t + d.value - d.baseline, 0);
                if (extra >= 500) found.push({ provider, service, application, from: run[0].date, to: run.at(-1)!.date, multiple: run.reduce((t, d) => t + d.value, 0) / run.reduce((t, d) => t + d.baseline, 0), extra });
            }
            run = [];
        };
        for (const f of flagged) {
            if (run.length && daysBetween(run.at(-1)!.date, f.date) > 1) close();
            run.push(f);
        }
        close();
    }
    return found.sort((a, b) => b.extra - a.extra);
}

/** Findings are rules over the data, not a model's opinion: each states what changed, where, how well the evidence covers it, who owns it and what to look at next. */
export function findings(data: FinopsData): Finding[] {
    const list: Finding[] = [];
    const recent = { from: addDays(DATA_TO, -29), to: DATA_TO };
    const lastThirty = data.charges.filter((c) => c.date >= recent.from && c.date <= recent.to);
    const trailing = `Last 30 days to ${shortDay(DATA_TO)}`;

    const ptu = rates(data, { basis: "Effective", provider: "All providers", from: recent.from, to: recent.to }).ptu;
    if (ptu && ptu.utilisation < 0.5) {
        const owner = ownerOf(lastThirty.filter((c) => c.commitment === "Provisioned throughput"));
        list.push({
            id: "ptu-underused", tone: "Review", area: "Rates",
            title: `Reserved model capacity is ${pctText(ptu.utilisation)} used`,
            changed: `The fixed fee was ${money(ptu.fee)} and the same usage at pay-as-you-go list prices would have cost ${money(ptu.payg)}.`,
            scope: "Azure OpenAI provisioned throughput, support assistant", period: trailing,
            evidence: `${ptu.days} of ${ptu.days} days with cost and token detail. Peak demand is not in this data, so the gap is a prompt to check, not a saving.`,
            owner, next: "Compare peak hourly demand with the reserved units and whether a smaller reservation or pay-as-you-go covers it.",
            href: "#/finops/fin-rates", link: "See rates and commitments", amount: ptu.fee - ptu.payg,
        });
    }

    const prepaid = pack(data);
    if (prepaid.exhausts && prepaid.daysLeft !== null && prepaid.daysLeft <= 45) {
        list.push({
            id: "pack-running-out", tone: "Review", area: "Rates",
            title: `OpenAI prepaid credits run out about ${shortDay(prepaid.exhausts)}`,
            changed: `${money(prepaid.balance)} of the ${money(prepaid.purchased)} pack is left, used at ${money(prepaid.burnPerDay)} a day. After that OpenAI usage is billed at about ${money(prepaid.monthlyAfter)} a month.`,
            scope: "OpenAI API, customer chat and classification batch", period: `Since ${shortDay(PACK.date)}`,
            evidence: "Cost and tokens complete for every day. The date assumes the last 7 days' pace continues.",
            owner: ownerOf(data.charges.filter((c) => c.provider === PACK.provider)),
            next: "Decide whether to buy another pack or move to pay-as-you-go, and update the Billed forecast.",
            href: "#/finops/fin-rates", link: "See the credit burn-down", amount: prepaid.monthlyAfter,
        });
    }

    for (const record of COMMITMENTS) {
        const view = rates(data, { basis: "Effective", provider: "All providers" }).commitments.find((c) => c.record === record)!;
        if (view.coverage <= view.coverageStart - 0.03 || view.utilisation <= view.utilisationStart - 0.04) {
            list.push({
                id: `commitment-${record.provider.toLowerCase().replace(/\W/g, "")}`, tone: "Watch", area: "Rates",
                title: `${record.provider} ${record.kind.toLowerCase()} coverage is falling`,
                changed: `Coverage went from ${pctText(view.coverageStart)} to ${pctText(view.coverage)} and utilisation from ${pctText(view.utilisationStart)} to ${pctText(view.utilisation)}, about ${money(view.unused)} a month of the commitment unused.`,
                scope: record.name, period: `${monthName(MONTHS[0])} to ${monthName(MONTHS.at(-1)!)}`,
                evidence: `Utilisation is as of ${shortDay(record.asOf)}.`,
                owner: ownerOf(data.charges.filter((c) => c.provider === record.provider)),
                next: "Check whether workloads moved to services the plan does not cover before buying more.",
                href: "#/finops/fin-rates", link: "See commitments", amount: view.unused * 12,
            });
        }
    }

    for (const spike of spikes(data)) {
        const own = data.charges.filter((c) => c.provider === spike.provider && c.service === spike.service && c.application === spike.application);
        list.push({
            id: `spike-${spike.application}-${spike.from}`, tone: "Watch", area: "Spend",
            title: `${spike.service} cost ran ×${spike.multiple.toFixed(1)} the usual for ${spike.from === spike.to ? "a day" : `${daysBetween(spike.from, spike.to) + 1} days`}`,
            changed: `About ${money(spike.extra)} above its median of the 14 days before, on ${spike.from === spike.to ? shortDay(spike.from) : `${shortDay(spike.from)} to ${shortDay(spike.to)}`}.`,
            scope: `${spike.provider} ${spike.service}, ${spike.application}`, period: `${shortDay(spike.from)} – ${shortDay(spike.to)}`,
            evidence: "Daily cost complete. Cost returned to its usual level afterwards.",
            owner: ownerOf(own), next: "Ask the owner what ran; check for a retry loop, a backfill or a one-off job.",
            href: "#/finops/fin-explorer", link: "See the explorer", amount: spike.extra,
        });
    }

    const firstSeen = new Map<string, string>();
    for (const c of data.charges) if (c.charge === "Usage" && (!firstSeen.has(`${c.provider}|${c.service}`) || c.date < firstSeen.get(`${c.provider}|${c.service}`)!)) firstSeen.set(`${c.provider}|${c.service}`, c.date);
    for (const [key, date] of firstSeen) {
        if (date <= recent.from) continue;
        const [provider, service] = key.split("|") as [Provider, string];
        const own = data.charges.filter((c) => c.provider === provider && c.service === service);
        const cost = sum(own, (c) => c.effective);
        list.push({
            id: `new-${service.toLowerCase().replace(/\W+/g, "-")}`, tone: "Watch", area: "Spend",
            title: `${service} is new spend`,
            changed: `${provider} ${service} first appeared on ${shortDay(date)} and has cost ${money(cost)} since. With no earlier period there is no percentage change.`,
            scope: `${provider} ${service}, ${[...new Set(own.map((c) => c.application))].filter((a) => a !== UNTAGGED).join(", ")}`, period: `${shortDay(date)} – ${shortDay(DATA_TO)}`,
            evidence: `${daysBetween(date, DATA_TO) + 1} days of cost; the application tag is present on most of it.`,
            owner: ownerOf(own), next: "Confirm it is an approved pilot and set a budget before it scales.",
            href: "#/finops/fin-explorer", link: "See the movers", amount: cost,
        });
    }

    const failed = FEEDS.filter((f) => f.status === "Failed");
    for (const feed of failed) {
        const rows = data.charges.filter((c) => c.provider === feed.provider && isAi(c) && c.charge === "Usage" && !c.tokenData);
        const apps = [...new Set(rows.map((c) => c.application))].filter((a) => a !== UNTAGGED);
        const days = new Set(rows.map((c) => c.date));
        list.push({
            id: "feed-failed", tone: "Review", area: "Data",
            title: `${feed.provider} token detail stopped on ${shortDay(feed.latest ?? DATA_TO)}`,
            changed: `${feed.feed} has not loaded since. Cost is complete, but unit costs leave ${days.size} ${days.size === 1 ? "day" : "days"} out.`,
            scope: apps.join(", "), period: `${shortDay(addDays(feed.latest ?? DATA_TO, 1))} – ${shortDay(DATA_TO)}`,
            evidence: `Cost present for every day; token detail missing for ${days.size} of ${daysBetween(DATA_FROM, DATA_TO) + 1} days.`,
            owner: ownerOf(rows), next: "Restore the log delivery. Until then, cost per outcome for these applications is as of the last good day.",
            href: "#/finops/fin-trust", link: "See data trust", amount: null,
        });
    }

    const tokenTrend = APPLICATIONS.flatMap((app) => {
        const perMonth = MONTHS.slice(0, -1).map((month) => {
            const own = data.charges.filter((c) => c.application === app.id && c.month === month && c.tokenData && c.outcomes > 0);
            return own.length ? (sum(own, tokensOf) * 1000) / sum(own, (c) => c.outcomes) : null;
        });
        const series = perMonth.filter((v): v is number => v !== null);
        if (series.length < 4) return [];
        const growth = (series.at(-1)! / series[0]) ** (1 / (series.length - 1)) - 1;
        const rising = series.every((v, i) => i === 0 || v > series[i - 1]);
        return rising && growth >= 0.04 ? [{ app, growth, from: series[0], to: series.at(-1)! }] : [];
    });
    for (const t of tokenTrend) {
        const own = data.charges.filter((c) => c.application === t.app.id);
        list.push({
            id: `tokens-${t.app.id}`, tone: "Watch", area: "Spend",
            title: `${t.app.id} uses more tokens for each ${t.app.outcome.replace(/s$/, "").split(" ").at(-1) === "reviewed" ? "pull request" : "outcome"} every month`,
            changed: `Tokens per outcome rose about ${pctText(t.growth)} a month, from ${Math.round(t.from)}k to ${Math.round(t.to)}k, so cost per outcome is rising with no change in price.`,
            scope: `${own[0].provider} ${own[0].model}, ${t.app.id}`, period: `${monthName(MONTHS[0])} to ${monthName(MONTHS.at(-2)!)}`,
            evidence: "Four complete months with token detail and outcome counts. Outcome counts come from the application's own telemetry.",
            owner: ownerOf(own), next: "Check whether prompts, context or retrieval sizes have grown, and whether caching is working.",
            href: "#/finops/fin-models", link: "See models", amount: null,
        });
    }

    const closed = MONTHS.length - 2;
    for (const v of INVOICE_VARIANCE) {
        const latest = v.variance[closed];
        if (latest !== null && v.reason === "Not yet explained" && Math.abs(latest) >= 0.01) {
            const billed = sum(data.charges.filter((c) => c.provider === v.provider && c.month === MONTHS[closed]), (c) => c.billed);
            list.push({
                id: `invoice-${v.provider.toLowerCase()}`, tone: "Review", area: "Data",
                title: `${v.provider} ${monthName(MONTHS[closed])} invoice is ${pctText(latest, 2)} above the data`,
                changed: `The invoice is ${money(billed * latest)} higher than the billed cost in the data and the difference has no explanation yet.`,
                scope: `${v.provider}, all services`, period: `${monthName(MONTHS[closed])} invoice`,
                evidence: "The data was complete for the month; the gap is between data and invoice, not missing days.",
                owner: ownerOf(data.charges.filter((c) => c.provider === v.provider)), next: "Ask the provider for the invoice line items and check for taxes, support charges or credits outside the export.",
                href: "#/finops/fin-trust", link: "See the reconciliation", amount: billed * latest,
            });
        }
    }

    return list.sort((a, b) => (a.tone === b.tone ? (b.amount ?? 0) - (a.amount ?? 0) : a.tone === "Review" ? -1 : 1));
}
