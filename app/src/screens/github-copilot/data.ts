//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * A seeded, synthetic GitHub Copilot cohort for the demo: seats, and weekly
 * usage per person by feature, model and language, shaped like the Viva
 * Insights GitHub Copilot export. The metrics follow the GitHub Copilot
 * report's definitions: the four rungs, "the line", reach, habit and depth.
 */

const SEED = 20261119;

/** Reportable weeks start here; the four weeks before only feed the habit lookback. */
export const DATA_FROM = "2026-06-01";
export const DATA_TO = "2026-08-30";
const HISTORY_FROM = "2026-05-04";
const WEEK_COUNT = 17;
const DAYS_PER_MONTH = 30.4375;

export const RUNGS = ["Suggest", "Edit", "Review", "Delegate"] as const;
export type Rung = (typeof RUNGS)[number];
export const RUNG_MEANINGS: Readonly<Record<Rung, string>> = {
    Suggest: "Copilot proposes a line or an answer; the person carries on typing",
    Edit: "Copilot changes code the person is looking at",
    Review: "Copilot plans or reviews a change for the person to approve",
    Delegate: "Copilot carries out a whole task, in agent mode or the CLI",
};
/** Review and Delegate sit above the line: a whole task is handed over. */
const ABOVE_THE_LINE: readonly Rung[] = ["Review", "Delegate"];
export const RUNG_VARS = ["--vl-slate", "--vl-periwinkle-data", "--vl-navy", "--vl-teal"] as const;
export const RUNG_FALLBACKS = ["#8793a3", "#7088b8", "#0b2c57", "#09b39d"] as const;

export const FEATURES = [
    { id: "code_completion", label: "Code completion", rung: "Suggest" },
    { id: "chat_inline", label: "Inline chat", rung: "Suggest" },
    { id: "chat_panel_ask_mode", label: "Chat, ask mode", rung: "Suggest" },
    { id: "chat_panel_unknown_mode", label: "Chat, mode not reported", rung: "Suggest" },
    { id: "chat_panel_edit_mode", label: "Chat, edit mode", rung: "Edit" },
    { id: "chat_panel_custom_mode", label: "Chat, custom mode", rung: "Edit" },
    { id: "agent_edit", label: "Agent edit", rung: "Edit" },
    { id: "chat_panel_plan_mode", label: "Chat, plan mode", rung: "Review" },
    { id: "copilot_app", label: "Copilot app", rung: "Review" },
    { id: "chat_panel_agent_mode", label: "Agent mode", rung: "Delegate" },
    { id: "copilot_cli", label: "Copilot CLI", rung: "Delegate" },
] as const satisfies readonly { id: string; label: string; rung: Rung }[];
type FeatureId = (typeof FEATURES)[number]["id"];
const AGENT_FEATURES: ReadonlySet<FeatureId> = new Set<FeatureId>(["agent_edit", "chat_panel_agent_mode", "copilot_cli"]);

export const MODEL_CLASSES = ["Powerful", "Versatile", "Lightweight", "Unclassified"] as const;
export type ModelClass = (typeof MODEL_CLASSES)[number];
/** Premium-request multipliers here are illustrative, not GitHub's price list. */
export const MODELS = [
    { name: "GPT-5.3-Codex", family: "OpenAI", class: "Powerful", multiplier: 3 },
    { name: "Claude Opus 5", family: "Anthropic", class: "Powerful", multiplier: 3 },
    { name: "GPT-5.6 Sol", family: "OpenAI", class: "Powerful", multiplier: 3 },
    { name: "Gemini 3.1 Pro", family: "Google", class: "Powerful", multiplier: 3 },
    { name: "Claude Sonnet 5", family: "Anthropic", class: "Versatile", multiplier: 1 },
    { name: "GPT-5.6 Terra", family: "OpenAI", class: "Versatile", multiplier: 1 },
    { name: "GPT-5.4", family: "OpenAI", class: "Versatile", multiplier: 1 },
    { name: "Claude Haiku 4.5", family: "Anthropic", class: "Lightweight", multiplier: 0.33 },
    { name: "GPT-5.6 Luna", family: "OpenAI", class: "Lightweight", multiplier: 0.33 },
    { name: "MAI-Code-1-Flash", family: "Microsoft", class: "Lightweight", multiplier: 0.33 },
    { name: "Auto", family: "Not reported", class: "Unclassified", multiplier: 0.9 },
] as const satisfies readonly { name: string; family: string; class: ModelClass; multiplier: number }[];
type Model = (typeof MODELS)[number];
type ModelName = Model["name"];
const modelOf = new Map<string, Model>(MODELS.map((model) => [model.name, model]));
const LIGHTWEIGHT_MULTIPLIER = 0.33;

const LANGUAGES = ["TypeScript", "Python", "C#", "Java", "SQL", "PowerShell", "YAML", "Markdown"] as const;
type Language = (typeof LANGUAGES)[number];

export type Plan = "Business" | "Enterprise";
type Profile = "dormant" | "occasional" | "habitual" | "deep";
const PROFILES = ["dormant", "occasional", "habitual", "deep"] as const satisfies readonly Profile[];

/** The stated assumptions. Seat prices are GitHub's list prices; the rest are illustrative. */
export const ASSUMPTIONS = {
    seatCost: { Business: 19, Enterprise: 39 } as Readonly<Record<Plan, number>>,
    allowance: { Business: 300, Enterprise: 1000 } as Readonly<Record<Plan, number>>,
    premiumPrice: 0.04,
    uplift: 0.15,
    loadedCost: 120_000,
    enablementPerSeat: 150,
    deepThreshold: 0.1,
    habitWeeks: 3,
    habitWindow: 4,
} as const;
export const UPLIFT_CHOICES = [0.1, 0.15, 0.2, 0.25] as const;

export interface RosterPerson {
    user: string;
    name: string;
    org: string;
    job: string;
    country: string;
}
interface Seat extends RosterPerson {
    plan: Plan;
    costCentre: string;
    profile: Profile;
}
interface UsageRow {
    week: string;
    user: string;
    feature: FeatureId;
    rung: Rung;
    model: ModelName | "";
    language: Language;
    interactions: number;
    suggested: number;
    accepted: number;
    premium: number;
}
export interface GithubData {
    roster: readonly RosterPerson[];
    seats: Seat[];
    rows: UsageRow[];
    weeks: string[];
}

const SEATS_BY_ORG: Readonly<Record<string, number>> = {
    Engineering: 14,
    IT: 15,
    Operations: 8,
    Finance: 4,
    "Supply Chain": 3,
    Sales: 3,
    Marketing: 2,
    "Risk & Compliance": 2,
    Strategy: 2,
    "Customer Service": 2,
    HR: 1,
    Legal: 1,
    Procurement: 1,
};
/** Shares of each org's seats that are dormant, occasional, habitual and deep. */
const PROFILE_MIX: Readonly<Record<string, readonly number[]>> = {
    Engineering: [0.07, 0.14, 0.29, 0.5],
    IT: [0.13, 0.2, 0.34, 0.33],
    Operations: [0.25, 0.25, 0.38, 0.12],
};
const DEFAULT_MIX = [0.3, 0.35, 0.25, 0.1];
const COST_CENTRES: Readonly<Record<string, string>> = {
    Engineering: "Product Engineering",
    IT: "Platform & Infrastructure",
    Operations: "Digital Operations",
    "Supply Chain": "Digital Operations",
    Procurement: "Digital Operations",
    Finance: "Corporate Systems",
    "Risk & Compliance": "Corporate Systems",
    Legal: "Corporate Systems",
    Strategy: "Corporate Systems",
    "Executive Office": "Corporate Systems",
};
const LANGUAGE_MIX: Readonly<Record<string, readonly number[]>> = {
    Engineering: [0.3, 0.2, 0.18, 0.1, 0.07, 0.03, 0.08, 0.04],
    IT: [0.08, 0.17, 0.1, 0.02, 0.1, 0.25, 0.2, 0.08],
};
const DEFAULT_LANGUAGES = [0.02, 0.32, 0.02, 0, 0.3, 0.08, 0.04, 0.22];
/** Weights over MODELS, in order, for each kind of user. */
const MODEL_MIX: Readonly<Record<Exclude<Profile, "dormant">, readonly number[]>> = {
    occasional: [0.02, 0.04, 0.01, 0.01, 0.15, 0.2, 0.05, 0.1, 0.07, 0.02, 0.33],
    habitual: [0.05, 0.07, 0.03, 0.02, 0.25, 0.18, 0.1, 0.06, 0.06, 0.02, 0.16],
    deep: [0.15, 0.12, 0.08, 0.05, 0.25, 0.14, 0.04, 0.04, 0.03, 0.02, 0.08],
};
const FEATURE_MIX: Readonly<Record<Rung, readonly (readonly [FeatureId, number])[]>> = {
    Suggest: [
        ["code_completion", 0.66],
        ["chat_inline", 0.14],
        ["chat_panel_ask_mode", 0.16],
        ["chat_panel_unknown_mode", 0.04],
    ],
    Edit: [
        ["chat_panel_edit_mode", 0.45],
        ["agent_edit", 0.45],
        ["chat_panel_custom_mode", 0.1],
    ],
    Review: [
        ["chat_panel_plan_mode", 0.72],
        ["copilot_app", 0.28],
    ],
    Delegate: [
        ["chat_panel_agent_mode", 0.7],
        ["copilot_cli", 0.3],
    ],
};
/** The same, for people who haven't tried agents: edits stay in chat, and handed-over work stays at Review. */
const NO_AGENT_EDIT: readonly (readonly [FeatureId, number])[] = [
    ["chat_panel_edit_mode", 0.85],
    ["chat_panel_custom_mode", 0.15],
];
const USAGE: Readonly<
    Record<Exclude<Profile, "dormant">, { base: [number, number]; drift: number; edit: number; volume: [number, number]; weekly: number; acceptance: number; agents: number }>
> = {
    occasional: { base: [0.005, 0.025], drift: 0.01, edit: 0.12, volume: [8, 35], weekly: 0.3, acceptance: 0.22, agents: 0.35 },
    habitual: { base: [0.03, 0.09], drift: 0.04, edit: 0.3, volume: [50, 140], weekly: 0.88, acceptance: 0.28, agents: 0.75 },
    deep: { base: [0.13, 0.28], drift: 0.08, edit: 0.42, volume: [110, 260], weekly: 0.94, acceptance: 0.33, agents: 1 },
};

/** A small seeded generator (mulberry32), so the demo looks the same on every load. */
function random(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pick<T>(items: readonly T[], weights: readonly number[], roll: number): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let at = roll * total;
    for (const [index, weight] of weights.entries()) {
        at -= weight;
        if (at < 0) return items[index];
    }
    return items[items.length - 1];
}

/** Splits a whole number by weights, giving what's left over to the largest fractions. */
function split(total: number, weights: readonly number[]): number[] {
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const exact = weights.map((weight) => (total * weight) / sum);
    const whole = exact.map(Math.floor);
    let left = total - whole.reduce((a, b) => a + b, 0);
    const byFraction = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction);
    for (const { index } of byFraction) {
        if (left <= 0) break;
        whole[index] += 1;
        left -= 1;
    }
    return whole;
}

const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const ALL_WEEKS = Array.from({ length: WEEK_COUNT }, (_, index) => addDays(HISTORY_FROM, index * 7));

/** The cohort for a roster. The same roster and seed always give the same data. */
export function generateGithubData(roster: readonly RosterPerson[], seed = SEED): GithubData {
    const roll = random(seed);
    const seats: Seat[] = [];
    const byOrg = new Map<string, RosterPerson[]>();
    for (const person of roster) byOrg.set(person.org, [...(byOrg.get(person.org) ?? []), person]);
    for (const [org, people] of [...byOrg].sort(([a], [b]) => a.localeCompare(b))) {
        const wanted = Math.min(SEATS_BY_ORG[org] ?? 0, people.length);
        if (wanted === 0) continue;
        const chosen = people
            .map((person) => ({ person, order: roll() }))
            .sort((a, b) => a.order - b.order)
            .slice(0, wanted)
            .map(({ person }) => person);
        const counts = split(wanted, PROFILE_MIX[org] ?? DEFAULT_MIX);
        const profiles = PROFILES.flatMap((profile, index) => Array.from({ length: counts[index] }, () => profile));
        // The heaviest users hold the Enterprise seats, as they tend to.
        const enterprise = org === "Engineering" || org === "IT" ? Math.round(wanted * 0.6) : 0;
        for (const [index, person] of chosen.entries()) {
            seats.push({
                ...person,
                profile: profiles[index],
                plan: index >= wanted - enterprise ? "Enterprise" : "Business",
                costCentre: COST_CENTRES[org] ?? "Business Apps",
            });
        }
    }

    const rows: UsageRow[] = [];
    for (const seat of seats) {
        if (seat.profile === "dormant") continue;
        const usage = USAGE[seat.profile];
        const models = MODEL_MIX[seat.profile];
        const base = usage.base[0] + roll() * (usage.base[1] - usage.base[0]);
        const typical = usage.volume[0] + roll() * (usage.volume[1] - usage.volume[0]);
        const acceptance = usage.acceptance + (roll() - 0.5) * 0.06;
        const agents = roll() < usage.agents;
        const languages = LANGUAGE_MIX[seat.org] ?? DEFAULT_LANGUAGES;
        for (const [index, week] of ALL_WEEKS.entries()) {
            const t = index / (ALL_WEEKS.length - 1);
            const chance = usage.weekly + (seat.profile === "occasional" ? 0.2 * t : 0);
            if (roll() > chance) continue;
            const total = Math.max(1, Math.round(typical * (0.75 + roll() * 0.5)));
            const handedOver = Math.min(0.6, base + usage.drift * t);
            const below = 1 - handedOver;
            const rungCounts = split(total, [below * (1 - usage.edit), below * usage.edit, handedOver * (agents ? 0.4 : 1), agents ? handedOver * 0.6 : 0]);
            for (const [r, rung] of RUNGS.entries()) {
                const mix = rung === "Edit" && !agents ? NO_AGENT_EDIT : FEATURE_MIX[rung];
                for (const [f, count] of split(rungCounts[r], mix.map(([, weight]) => weight)).entries()) {
                    const feature = mix[f][0];
                    for (const part of count > 3 ? split(count, [0.65, 0.35]) : [count]) {
                        if (part === 0) continue;
                        const language = pick(LANGUAGES, languages, roll());
                        if (feature === "code_completion") {
                            const rate = Math.min(0.6, Math.max(0.1, acceptance + (roll() - 0.5) * 0.04));
                            rows.push({ week, user: seat.user, feature, rung, model: "", language, interactions: part, suggested: Math.round(part / rate), accepted: part, premium: 0 });
                        } else {
                            const model = pick(MODELS, models, roll());
                            const premium = Math.round(part * model.multiplier * 100) / 100;
                            rows.push({ week, user: seat.user, feature, rung, model: model.name, language, interactions: part, suggested: 0, accepted: 0, premium });
                        }
                    }
                }
            }
        }
    }
    return { roster, seats, rows, weeks: ALL_WEEKS };
}

type SeatField = "org" | "country" | "job" | "user";

/** The roster field for a Group By column, as the demo's model maps it. */
export function seatField(column: string): SeatField {
    if (column === "PersonId_Normalized") return "user";
    if (/country/i.test(column)) return "country";
    if (/job/i.test(column)) return "job";
    return "org";
}

export interface ViewOptions {
    from?: string;
    to?: string;
    /** The Group By column. */
    attribute: string;
    /** Selected values of the Group By column; empty means everyone. */
    values: readonly string[];
}

interface Totals {
    interactions: number;
    above: number;
    delegate: number;
    suggested: number;
    accepted: number;
    premium: number;
    agent: number;
}
const emptyTotals = (): Totals => ({ interactions: 0, above: 0, delegate: 0, suggested: 0, accepted: 0, premium: 0, agent: 0 });
const TOTAL_KEYS = Object.keys(emptyTotals()) as (keyof Totals)[];
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
const monthOf = (week: string) => week.slice(0, 7);
const monthLabel = (month: string) =>
    new Date(`${month}-01T00:00:00Z`).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

function add(target: Totals, row: UsageRow): void {
    target.interactions += row.interactions;
    if (ABOVE_THE_LINE.includes(row.rung)) target.above += row.interactions;
    if (row.rung === "Delegate") target.delegate += row.interactions;
    target.suggested += row.suggested;
    target.accepted += row.accepted;
    target.premium += row.premium;
    if (AGENT_FEATURES.has(row.feature)) target.agent += row.interactions;
}

export interface GroupRow {
    Group: string;
    Seats: number;
    Active: number;
    Habitual: number;
    Deep: number;
    Activation: number;
    "Habit conversion": number;
    "Depth conversion": number;
    "Delegation rate": number;
    "Autonomous share": number;
    "Idle seats": number;
    "Powerful share of Suggest work": number;
    "Habitual, not deep": number;
    Cost: number;
}
export interface IdleSeat {
    name: string;
    group: string;
    plan: Plan;
    lastActive: string;
    cost: number;
}

export interface GithubView {
    /** No weeks in the range, or no seats in the selection. */
    empty: boolean;
    from: string;
    to: string;
    weeks: string[];
    months: number;
    funnel: { licensed: number; active: number; habitual: number; deep: number };
    delegationRate: number;
    agentAdoption: number;
    acceptance: { all: number; deep: number; rest: number };
    weeklyStages: { Week: string; Stage: string; People: number }[];
    weeklyRungs: { Week: string; Rung: Rung; Interactions: number }[];
    groups: GroupRow[];
    cost: {
        seat: number;
        overage: number;
        total: number;
        premiumRequests: number;
        monthly: { Month: string; Order: number; Kind: string; Cost: number }[];
        byModel: { Model: string; Class: ModelClass; Family: string; "Premium requests": number; Interactions: number }[];
        byCostCentre: { "Cost centre": string; Seats: number; "Seat cost": number; "Premium requests": number; Overage: number; Total: number }[];
    };
    idle: { seats: IdleSeat[]; cost: number };
    planFit: { candidates: number; monthlySaving: number };
    modelFit: { powerfulSuggestShare: number; powerfulSuggestRequests: number; avoidableRequests: number };
    governance: {
        autonomousShare: number;
        unreportedShare: number;
        modelsInUse: number;
        familiesInUse: number;
        topFamily: { family: string; share: number };
        byFamily: { Family: string; Interactions: number; Share: number }[];
        byLanguage: { Language: string; Interactions: number; "Delegation rate": number }[];
    };
    seatCandidates: { Group: string; People: number; Jobs: string }[];
}

export const STAGES = ["Active, not yet habitual", "Habitual, below the line", "Deep: above the line"] as const;

/** Everything the GitHub Copilot views show, for one date range, Group By and selection. */
export function analyse(data: GithubData, options: ViewOptions): GithubView {
    const field = seatField(options.attribute);
    const chosen = new Set(options.values);
    const inSelection = (person: RosterPerson) => chosen.size === 0 || chosen.has(person[field]);
    const seats = data.seats.filter(inSelection);
    const seatOf = new Map(seats.map((seat) => [seat.user, seat]));
    const from = options.from && options.from > DATA_FROM ? options.from : DATA_FROM;
    const to = options.to && options.to < DATA_TO ? options.to : DATA_TO;
    // A week counts when any of its days falls in the range.
    const weeks = data.weeks.filter((week) => week >= DATA_FROM && week <= to && addDays(week, 6) >= from);
    const windowWeeks = new Set(weeks);
    const months = (weeks.length * 7) / DAYS_PER_MONTH;
    const lastWeek = weeks.at(-1);

    const perWeek = new Map<string, Map<string, Totals>>();
    const inWindow = new Map<string, Totals>();
    for (const row of data.rows) {
        if (!seatOf.has(row.user)) continue;
        const user = perWeek.get(row.user) ?? new Map<string, Totals>();
        perWeek.set(row.user, user);
        const week = user.get(row.week) ?? emptyTotals();
        user.set(row.week, week);
        add(week, row);
        if (windowWeeks.has(row.week)) {
            const total = inWindow.get(row.user) ?? emptyTotals();
            inWindow.set(row.user, total);
            add(total, row);
        }
    }
    const weekOf = (user: string, week: string) => perWeek.get(user)?.get(week);
    const lookback = (week: string) => Array.from({ length: ASSUMPTIONS.habitWindow }, (_, k) => addDays(week, -7 * k));
    const habitualAt = (user: string, week: string) =>
        lookback(week).filter((w) => (weekOf(user, w)?.interactions ?? 0) > 0).length >= ASSUMPTIONS.habitWeeks;
    // Habit and depth are both read over the four weeks to a given week, so the range's last week gives the headline.
    const deepAt = (user: string, week: string) => {
        const back = lookback(week).flatMap((w) => weekOf(user, w) ?? []);
        return ratio(back.reduce((s, t) => s + t.above, 0), back.reduce((s, t) => s + t.interactions, 0)) > ASSUMPTIONS.deepThreshold;
    };
    const sumOver = (people: readonly Seat[], key: keyof Totals) => people.reduce((total, seat) => total + (inWindow.get(seat.user)?.[key] ?? 0), 0);

    const active = seats.filter((seat) => (inWindow.get(seat.user)?.interactions ?? 0) > 0);
    const habitual = lastWeek ? active.filter((seat) => habitualAt(seat.user, lastWeek)) : [];
    const deep = lastWeek ? habitual.filter((seat) => deepAt(seat.user, lastWeek)) : [];
    const activeSet = new Set(active.map((seat) => seat.user));
    const habitualSet = new Set(habitual.map((seat) => seat.user));
    const deepSet = new Set(deep.map((seat) => seat.user));
    const rest = active.filter((seat) => !deepSet.has(seat.user));
    const all = emptyTotals();
    for (const totals of inWindow.values()) for (const key of TOTAL_KEYS) all[key] += totals[key];

    const weeklyStages = weeks.flatMap((week) => {
        const counts = [0, 0, 0];
        for (const seat of seats) {
            if (habitualAt(seat.user, week)) counts[deepAt(seat.user, week) ? 2 : 1] += 1;
            else if ((weekOf(seat.user, week)?.interactions ?? 0) > 0) counts[0] += 1;
        }
        return STAGES.map((Stage, index) => ({ Week: week, Stage, People: counts[index] }));
    });

    const rungByWeek = new Map<string, number[]>();
    const familyCount = new Map<string, number>();
    const modelCount = new Map<string, { interactions: number; premium: number }>();
    const languageCount = new Map<string, { interactions: number; above: number }>();
    const groupSuggest = new Map<string, { chat: number; powerful: number }>();
    let chat = 0;
    let suggestChat = 0;
    let powerfulSuggest = 0;
    let powerfulSuggestRequests = 0;
    let avoidable = 0;
    for (const row of data.rows) {
        const seat = seatOf.get(row.user);
        if (!seat || !windowWeeks.has(row.week)) continue;
        const counts = rungByWeek.get(row.week) ?? [0, 0, 0, 0];
        counts[RUNGS.indexOf(row.rung)] += row.interactions;
        rungByWeek.set(row.week, counts);
        const language = languageCount.get(row.language) ?? { interactions: 0, above: 0 };
        language.interactions += row.interactions;
        if (ABOVE_THE_LINE.includes(row.rung)) language.above += row.interactions;
        languageCount.set(row.language, language);
        const model = modelOf.get(row.model);
        if (!model) continue;
        chat += row.interactions;
        familyCount.set(model.family, (familyCount.get(model.family) ?? 0) + row.interactions);
        const used = modelCount.get(model.name) ?? { interactions: 0, premium: 0 };
        used.interactions += row.interactions;
        used.premium += row.premium;
        modelCount.set(model.name, used);
        if (row.rung !== "Suggest") continue;
        const group = groupSuggest.get(seat[field]) ?? { chat: 0, powerful: 0 };
        groupSuggest.set(seat[field], group);
        group.chat += row.interactions;
        suggestChat += row.interactions;
        if (model.class === "Powerful") {
            group.powerful += row.interactions;
            powerfulSuggest += row.interactions;
            powerfulSuggestRequests += row.premium;
            avoidable += row.premium - row.interactions * LIGHTWEIGHT_MULTIPLIER;
        }
    }

    // Seats and allowances are charged week by week, so a part month costs its share.
    const weekShare = 7 / DAYS_PER_MONTH;
    const overageOf = new Map<string, number>();
    const monthly = new Map<string, { seat: number; overage: number }>();
    for (const seat of seats) {
        const byMonth = new Map<string, { premium: number; weeks: number }>();
        for (const week of weeks) {
            const month = byMonth.get(monthOf(week)) ?? { premium: 0, weeks: 0 };
            month.premium += weekOf(seat.user, week)?.premium ?? 0;
            month.weeks += 1;
            byMonth.set(monthOf(week), month);
        }
        for (const [month, used] of byMonth) {
            const share = used.weeks * weekShare;
            const over = Math.max(0, used.premium - ASSUMPTIONS.allowance[seat.plan] * share) * ASSUMPTIONS.premiumPrice;
            overageOf.set(seat.user, (overageOf.get(seat.user) ?? 0) + over);
            const entry = monthly.get(month) ?? { seat: 0, overage: 0 };
            entry.seat += ASSUMPTIONS.seatCost[seat.plan] * share;
            entry.overage += over;
            monthly.set(month, entry);
        }
    }
    const seatCostOf = (seat: Seat) => ASSUMPTIONS.seatCost[seat.plan] * months;
    const costOf = (seat: Seat) => seatCostOf(seat) + (overageOf.get(seat.user) ?? 0);
    const seatTotal = seats.reduce((total, seat) => total + seatCostOf(seat), 0);
    const overageTotal = [...overageOf.values()].reduce((a, b) => a + b, 0);

    const groups = [...new Set(seats.map((seat) => seat[field]))]
        .map((group): GroupRow => {
            const members = seats.filter((seat) => seat[field] === group);
            const activeCount = members.filter((seat) => activeSet.has(seat.user)).length;
            const habitCount = members.filter((seat) => habitualSet.has(seat.user)).length;
            const deepCount = members.filter((seat) => deepSet.has(seat.user)).length;
            const interactions = sumOver(members, "interactions");
            const suggest = groupSuggest.get(group);
            return {
                Group: group,
                Seats: members.length,
                Active: activeCount,
                Habitual: habitCount,
                Deep: deepCount,
                Activation: ratio(activeCount, members.length),
                "Habit conversion": ratio(habitCount, activeCount),
                "Depth conversion": ratio(deepCount, habitCount),
                "Delegation rate": ratio(sumOver(members, "above"), interactions),
                "Autonomous share": ratio(sumOver(members, "delegate"), interactions),
                "Idle seats": members.length - activeCount,
                "Powerful share of Suggest work": ratio(suggest?.powerful ?? 0, suggest?.chat ?? 0),
                "Habitual, not deep": habitCount - deepCount,
                Cost: members.reduce((total, seat) => total + costOf(seat), 0),
            };
        })
        .sort((a, b) => b.Seats - a.Seats || a.Group.localeCompare(b.Group));

    const lastActive = (user: string) =>
        [...(perWeek.get(user) ?? [])]
            .filter(([week, totals]) => week <= (lastWeek ?? DATA_TO) && totals.interactions > 0)
            .map(([week]) => week)
            .sort()
            .at(-1) ?? "";
    const idleSeats = seats
        .filter((seat) => !activeSet.has(seat.user))
        .map((seat): IdleSeat => ({ name: seat.name, group: seat[field], plan: seat.plan, lastActive: lastActive(seat.user), cost: seatCostOf(seat) }))
        .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name));
    // Active Enterprise seats whose monthly premium requests would fit in a Business allowance.
    const planFit = active.filter(
        (seat) => seat.plan === "Enterprise" && ratio(inWindow.get(seat.user)?.premium ?? 0, months) < ASSUMPTIONS.allowance.Business,
    );

    const byFamily = [...familyCount]
        .map(([Family, Interactions]) => ({ Family, Interactions, Share: ratio(Interactions, chat) }))
        .sort((a, b) => b.Interactions - a.Interactions);
    const named = byFamily.filter((row) => row.Family !== "Not reported");
    const namedTotal = named.reduce((sum, row) => sum + row.Interactions, 0);
    // People without a seat whose job matches a seat holder already working above the line.
    const deepJobs = new Set(data.seats.filter((seat) => seat.profile === "deep").map((seat) => seat.job));
    const seatHolders = new Set(data.seats.map((seat) => seat.user));
    const candidates = data.roster.filter((person) => !seatHolders.has(person.user) && deepJobs.has(person.job) && inSelection(person));

    return {
        empty: weeks.length === 0 || seats.length === 0,
        from,
        to,
        weeks,
        months,
        funnel: { licensed: seats.length, active: active.length, habitual: habitual.length, deep: deep.length },
        delegationRate: ratio(all.above, all.interactions),
        agentAdoption: ratio(active.filter((seat) => (inWindow.get(seat.user)?.agent ?? 0) > 0).length, active.length),
        acceptance: {
            all: ratio(all.accepted, all.suggested),
            deep: ratio(sumOver(deep, "accepted"), sumOver(deep, "suggested")),
            rest: ratio(sumOver(rest, "accepted"), sumOver(rest, "suggested")),
        },
        weeklyStages,
        weeklyRungs: weeks.flatMap((week) => {
            const counts = rungByWeek.get(week) ?? [0, 0, 0, 0];
            return RUNGS.map((Rung, r) => ({ Week: week, Rung, Interactions: counts[r] }));
        }),
        groups,
        cost: {
            seat: seatTotal,
            overage: overageTotal,
            total: seatTotal + overageTotal,
            premiumRequests: Math.round(all.premium),
            monthly: [...monthly]
                .sort(([a], [b]) => a.localeCompare(b))
                .flatMap(([month, cost], order) => [
                    { Month: monthLabel(month), Order: order, Kind: "Seats", Cost: cost.seat },
                    { Month: monthLabel(month), Order: order, Kind: "Premium requests over allowance", Cost: cost.overage },
                ]),
            byModel: [...modelCount]
                .flatMap(([name, used]) => {
                    const model = modelOf.get(name);
                    return model
                        ? [{ Model: name, Class: model.class, Family: model.family, "Premium requests": Math.round(used.premium), Interactions: used.interactions }]
                        : [];
                })
                .sort((a, b) => b["Premium requests"] - a["Premium requests"]),
            byCostCentre: [...new Set(seats.map((seat) => seat.costCentre))]
                .map((centre) => {
                    const members = seats.filter((seat) => seat.costCentre === centre);
                    const seatCost = members.reduce((total, seat) => total + seatCostOf(seat), 0);
                    const overage = members.reduce((total, seat) => total + (overageOf.get(seat.user) ?? 0), 0);
                    return {
                        "Cost centre": centre,
                        Seats: members.length,
                        "Seat cost": seatCost,
                        "Premium requests": Math.round(sumOver(members, "premium")),
                        Overage: overage,
                        Total: seatCost + overage,
                    };
                })
                .sort((a, b) => b.Total - a.Total),
        },
        idle: { seats: idleSeats, cost: idleSeats.reduce((total, seat) => total + seat.cost, 0) },
        planFit: { candidates: planFit.length, monthlySaving: planFit.length * (ASSUMPTIONS.seatCost.Enterprise - ASSUMPTIONS.seatCost.Business) },
        modelFit: {
            powerfulSuggestShare: ratio(powerfulSuggest, suggestChat),
            powerfulSuggestRequests: Math.round(powerfulSuggestRequests),
            avoidableRequests: Math.round(avoidable),
        },
        governance: {
            autonomousShare: ratio(all.delegate, all.interactions),
            unreportedShare: ratio(familyCount.get("Not reported") ?? 0, chat),
            modelsInUse: modelCount.size,
            familiesInUse: named.length,
            topFamily: { family: named[0]?.Family ?? "", share: ratio(named[0]?.Interactions ?? 0, namedTotal) },
            byFamily,
            byLanguage: [...languageCount]
                .map(([Language, used]) => ({ Language, Interactions: used.interactions, "Delegation rate": ratio(used.above, used.interactions) }))
                .sort((a, b) => b["Delegation rate"] - a["Delegation rate"]),
        },
        seatCandidates: [...new Set(candidates.map((person) => person[field]))]
            .map((group) => {
                const people = candidates.filter((person) => person[field] === group);
                return { Group: group, People: people.length, Jobs: [...new Set(people.map((person) => person.job))].sort().join(", ") };
            })
            .sort((a, b) => b.People - a.People || a.Group.localeCompare(b.Group)),
    };
}

export interface ValueEstimate {
    capacity: number;
    value: number;
    investment: number;
    net: number;
    roi: number;
    enablement: number;
    stillOnTable: number;
    stillOnTableValue: number;
}

/** Capacity and value from the people working above the line, given the uplift. */
export function estimateValue(view: GithubView, uplift: number = ASSUMPTIONS.uplift): ValueEstimate {
    const yearShare = view.months / 12;
    const capacity = view.funnel.deep * uplift;
    const value = capacity * ASSUMPTIONS.loadedCost * yearShare;
    const enablement = view.funnel.licensed * ASSUMPTIONS.enablementPerSeat;
    const investment = view.cost.total + enablement;
    const net = value - investment;
    const stillOnTable = (view.funnel.habitual - view.funnel.deep) * uplift;
    return {
        capacity,
        value,
        investment,
        net,
        roi: ratio(net, investment),
        enablement,
        stillOnTable,
        stillOnTableValue: stillOnTable * ASSUMPTIONS.loadedCost * yearShare,
    };
}
