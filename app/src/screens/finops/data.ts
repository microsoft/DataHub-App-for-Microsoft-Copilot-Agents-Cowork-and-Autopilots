//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * A seeded, synthetic set of daily cloud and AI charges for the demo, shaped
 * like a FOCUS (FinOps Open Cost and Usage Specification) export: one row per
 * day, service, model and tag combination, with list, contracted, effective
 * and billed cost kept apart. Providers, prices and totals are invented for
 * the mock-up; none is a vendor's price list or a real customer's bill.
 */

const SEED = 20261120;

export const DATA_FROM = "2026-06-01";
export const DATA_TO = "2026-10-25";

export const PROVIDERS = ["Azure", "AWS", "Google Cloud", "Anthropic", "OpenAI"] as const;
export type Provider = (typeof PROVIDERS)[number];
export type ProviderChoice = Provider | "All providers";
export const PROVIDER_VARS = ["--vl-navy", "--vl-amber", "--vl-blue", "--vl-plum", "--vl-slate"] as const;
export const PROVIDER_FALLBACKS = ["#0b2c57", "#f1963a", "#4f73b8", "#7f215d", "#8793a3"] as const;

export const BASES = ["Billed", "Effective", "List", "Contracted"] as const;
export type Basis = (typeof BASES)[number];
export const BASIS_MEANINGS: Readonly<Record<Basis, string>> = {
    Billed: "What the invoice asks for. Prepaid purchases land in the month they were bought",
    Effective: "Billed cost with commitments and prepaid credits spread over the usage they cover. Use it for showback",
    List: "Usage at public list prices, before any discount",
    Contracted: "Usage at the negotiated unit price, before commitment or credit effects",
};

export const CATEGORIES = ["Compute", "Storage", "Databases", "Analytics", "Networking", "AI and ML"] as const;
export type Category = (typeof CATEGORIES)[number];
export type CommitmentKind = "None" | "Reservation" | "Savings plan" | "Provisioned throughput" | "Prepaid credits";
export type Environment = "Production" | "Test" | "Unspecified";

export const UNASSIGNED = "Unassigned";
export const UNTAGGED = "Untagged";

export interface Charge {
    date: string;
    month: string;
    provider: Provider;
    service: string;
    category: Category;
    /** The AI model, or empty for a cloud service. */
    model: string;
    application: string;
    costCentre: string;
    environment: Environment;
    charge: "Usage" | "Purchase";
    commitment: CommitmentKind;
    list: number;
    contracted: number;
    effective: number;
    billed: number;
    /** What the usage would have cost at list price pay-as-you-go, even when a fixed fee was charged instead. */
    payg: number;
    /** Millions of tokens, by bucket. Zero when the token feed had no detail for the day. */
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    tokenData: boolean;
    outcomes: number;
}

export interface Application {
    id: string;
    /** What one unit of the application's work is. */
    outcome: string;
    /** Minutes a person would take to do one outcome by hand: a planning assumption. */
    refMinutes: number;
    /** People using it in the first month, or 0 when it serves customers or runs as a batch. */
    people: number;
    peopleGrowth: number;
    /** The Business impact agent this application is declared to serve, if any. */
    agent?: string;
}

export const APPLICATIONS: readonly Application[] = [
    { id: "support-assistant", outcome: "conversations resolved", refMinutes: 12, people: 140, peopleGrowth: 0.06 },
    { id: "meeting-summaries", outcome: "meetings summarised", refMinutes: 8, people: 900, peopleGrowth: 0.04 },
    { id: "claims-triage", outcome: "claims triaged", refMinutes: 9, people: 120, peopleGrowth: 0.03 },
    { id: "doc-extraction", outcome: "documents processed", refMinutes: 6, people: 0, peopleGrowth: 0, agent: "Invoice exception agent" },
    { id: "research-synthesis", outcome: "briefs drafted", refMinutes: 45, people: 25, peopleGrowth: 0 },
    { id: "code-review-agent", outcome: "pull requests reviewed", refMinutes: 20, people: 220, peopleGrowth: 0.05 },
    { id: "analyst-copilot", outcome: "analyses completed", refMinutes: 30, people: 70, peopleGrowth: 0.04, agent: "Finance posting agent" },
    { id: "customer-chat", outcome: "chats handled", refMinutes: 10, people: 0, peopleGrowth: 0 },
    { id: "classification-batch", outcome: "records classified", refMinutes: 0, people: 0, peopleGrowth: 0 },
    { id: "prompt-lab", outcome: "experiments run", refMinutes: 0, people: 0, peopleGrowth: 0 },
];

export interface Prices {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
}
/** Dollars per million tokens. Illustrative, not any vendor's price list. */
const PRICES = {
    opus: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
    sonnet: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    haiku: { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
    sol: { input: 5, output: 20, cacheRead: 1.25, cacheWrite: 0 },
    luna: { input: 0.4, output: 1.6, cacheRead: 0.1, cacheWrite: 0 },
    gemini: { input: 2.5, output: 12, cacheRead: 0.625, cacheWrite: 0 },
} as const satisfies Record<string, Prices>;
export const PRICE_NOTE = "Illustrative prices per million tokens, not any vendor's price list";

type Mix = readonly [input: number, output: number, cacheRead: number, cacheWrite: number];
interface AiSpec {
    model: string;
    prices: Prices;
    mixStart: Mix;
    mixEnd: Mix;
    /** Millions of tokens on a weekday at the start of the line. */
    tokens: number;
    /** Thousands of tokens an outcome takes at the start. */
    perOutcome: number;
    /** How much more an outcome takes each month. */
    perOutcomeDrift?: number;
}
interface Line {
    provider: Provider;
    service: string;
    category: Category;
    application: string;
    costCentre: string;
    environment: "Production" | "Test";
    discount: number;
    growth: number;
    weekend: number;
    start?: string;
    /** List cost on a weekday at the start, for a cloud service. */
    base?: number;
    /** The share of the line's charges with no usable tags, at the start and at the end of the range. */
    unassigned: readonly [number, number];
    ai?: AiSpec;
    commitment?: { kind: CommitmentKind; cover: number; discount: number };
    /** A fixed daily fee for reserved model capacity. */
    ptuDaily?: number;
    pack?: boolean;
    spike?: { from: string; to: string; multiple: number };
    noTokensFrom?: string;
}

const COST_CENTRES = {
    product: "Product Engineering",
    platform: "Platform & Infrastructure",
    operations: "Digital Operations",
    corporate: "Corporate Systems",
    success: "Customer Success",
    research: "Research",
} as const;
export const COST_CENTRE_NAMES: readonly string[] = Object.values(COST_CENTRES);

const cloud = (line: Omit<Line, "environment">): Line => ({ ...line, environment: "Production" });

const LINES: readonly Line[] = [
    cloud({ provider: "Azure", service: "Virtual Machines", category: "Compute", application: "core-platform", costCentre: COST_CENTRES.platform, base: 3400, growth: 0.012, weekend: 0.94, discount: 0.14, unassigned: [0.05, 0.04], commitment: { kind: "Reservation", cover: 0.72, discount: 0.3 } }),
    cloud({ provider: "Azure", service: "Azure SQL Database", category: "Databases", application: "core-platform", costCentre: COST_CENTRES.platform, base: 1500, growth: 0.01, weekend: 0.97, discount: 0.14, unassigned: [0.05, 0.04] }),
    cloud({ provider: "Azure", service: "Storage", category: "Storage", application: "data-platform", costCentre: COST_CENTRES.platform, base: 900, growth: 0.03, weekend: 1, discount: 0.14, unassigned: [0.06, 0.05] }),
    cloud({ provider: "Azure", service: "Microsoft Fabric", category: "Analytics", application: "data-platform", costCentre: COST_CENTRES.operations, base: 1700, growth: 0.022, weekend: 0.9, discount: 0.14, unassigned: [0.04, 0.03] }),
    cloud({ provider: "Azure", service: "Networking", category: "Networking", application: "core-platform", costCentre: COST_CENTRES.platform, base: 520, growth: 0.008, weekend: 1, discount: 0.14, unassigned: [0.05, 0.04] }),
    cloud({ provider: "AWS", service: "EC2", category: "Compute", application: "web-services", costCentre: COST_CENTRES.product, base: 3000, growth: 0.012, weekend: 0.93, discount: 0.12, unassigned: [0.24, 0.12], commitment: { kind: "Savings plan", cover: 0.55, discount: 0.25 } }),
    cloud({ provider: "AWS", service: "S3", category: "Storage", application: "data-lake", costCentre: COST_CENTRES.product, base: 800, growth: 0.035, weekend: 1, discount: 0.12, unassigned: [0.25, 0.14] }),
    cloud({ provider: "AWS", service: "RDS", category: "Databases", application: "web-services", costCentre: COST_CENTRES.product, base: 1300, growth: 0.008, weekend: 0.98, discount: 0.12, unassigned: [0.2, 0.1] }),
    cloud({ provider: "AWS", service: "Data transfer", category: "Networking", application: "web-services", costCentre: COST_CENTRES.product, base: 450, growth: 0.01, weekend: 0.95, discount: 0.12, unassigned: [0.28, 0.16] }),
    cloud({ provider: "Google Cloud", service: "Compute Engine", category: "Compute", application: "research-compute", costCentre: COST_CENTRES.research, base: 1700, growth: 0.015, weekend: 0.9, discount: 0.1, unassigned: [0.1, 0.07] }),
    cloud({ provider: "Google Cloud", service: "BigQuery", category: "Analytics", application: "research-compute", costCentre: COST_CENTRES.research, base: 1100, growth: 0.04, weekend: 0.9, discount: 0.1, unassigned: [0.09, 0.06], spike: { from: "2026-09-17", to: "2026-09-19", multiple: 2.6 } }),
    cloud({ provider: "Google Cloud", service: "Cloud Storage", category: "Storage", application: "research-compute", costCentre: COST_CENTRES.research, base: 380, growth: 0.02, weekend: 1, discount: 0.1, unassigned: [0.1, 0.08] }),
    {
        provider: "Azure", service: "Azure OpenAI", category: "AI and ML", application: "support-assistant", costCentre: COST_CENTRES.success, environment: "Production",
        discount: 0.22, growth: 0.06, weekend: 0.45, unassigned: [0.04, 0.03], commitment: { kind: "Provisioned throughput", cover: 0, discount: 0 }, ptuDaily: 1050,
        ai: { model: "GPT-5.6 Sol", prices: PRICES.sol, mixStart: [0.38, 0.12, 0.47, 0.03], mixEnd: [0.3, 0.12, 0.55, 0.03], tokens: 75, perOutcome: 137 },
    },
    {
        provider: "Azure", service: "Azure OpenAI", category: "AI and ML", application: "meeting-summaries", costCentre: COST_CENTRES.operations, environment: "Production",
        discount: 0.14, growth: 0.09, weekend: 0.5, unassigned: [0.06, 0.05], spike: { from: "2026-09-09", to: "2026-09-11", multiple: 3.4 },
        ai: { model: "GPT-5.6 Luna", prices: PRICES.luna, mixStart: [0.55, 0.1, 0.33, 0.02], mixEnd: [0.45, 0.1, 0.43, 0.02], tokens: 420, perOutcome: 1640 },
    },
    {
        provider: "Azure", service: "Azure OpenAI", category: "AI and ML", application: "prompt-lab", costCentre: COST_CENTRES.product, environment: "Test",
        discount: 0.14, growth: 0.02, weekend: 0.3, unassigned: [0.1, 0.08],
        ai: { model: "GPT-5.6 Luna", prices: PRICES.luna, mixStart: [0.6, 0.12, 0.26, 0.02], mixEnd: [0.6, 0.12, 0.26, 0.02], tokens: 40, perOutcome: 0 },
    },
    {
        provider: "AWS", service: "Bedrock", category: "AI and ML", application: "claims-triage", costCentre: COST_CENTRES.operations, environment: "Production",
        discount: 0.12, growth: 0.07, weekend: 0.8, unassigned: [0.22, 0.12], noTokensFrom: "2026-10-22",
        ai: { model: "Claude Sonnet 5", prices: PRICES.sonnet, mixStart: [0.4, 0.1, 0.45, 0.05], mixEnd: [0.32, 0.1, 0.53, 0.05], tokens: 260, perOutcome: 364 },
    },
    {
        provider: "AWS", service: "Bedrock", category: "AI and ML", application: "doc-extraction", costCentre: COST_CENTRES.corporate, environment: "Production",
        discount: 0.12, growth: 0.08, weekend: 0.85, unassigned: [0.22, 0.12], noTokensFrom: "2026-10-22",
        ai: { model: "Claude Haiku 4.5", prices: PRICES.haiku, mixStart: [0.7, 0.1, 0.15, 0.05], mixEnd: [0.62, 0.1, 0.23, 0.05], tokens: 380, perOutcome: 450 },
    },
    {
        provider: "Google Cloud", service: "Vertex AI", category: "AI and ML", application: "research-synthesis", costCentre: COST_CENTRES.research, environment: "Production",
        discount: 0.1, growth: 0, weekend: 0.4, unassigned: [0.08, 0.08], start: "2026-10-12",
        ai: { model: "Gemini 3.1 Pro", prices: PRICES.gemini, mixStart: [0.5, 0.12, 0.38, 0], mixEnd: [0.5, 0.12, 0.38, 0], tokens: 120, perOutcome: 1500 },
    },
    {
        provider: "Anthropic", service: "Claude API", category: "AI and ML", application: "code-review-agent", costCentre: COST_CENTRES.product, environment: "Production",
        discount: 0.06, growth: 0.11, weekend: 0.55, unassigned: [0.16, 0.1],
        ai: { model: "Claude Opus 5", prices: PRICES.opus, mixStart: [0.12, 0.08, 0.72, 0.08], mixEnd: [0.09, 0.09, 0.75, 0.07], tokens: 80, perOutcome: 700, perOutcomeDrift: 0.06 },
    },
    {
        provider: "Anthropic", service: "Claude API", category: "AI and ML", application: "analyst-copilot", costCentre: COST_CENTRES.corporate, environment: "Production",
        discount: 0.06, growth: 0.08, weekend: 0.5, unassigned: [0.16, 0.1],
        ai: { model: "Claude Sonnet 5", prices: PRICES.sonnet, mixStart: [0.15, 0.1, 0.7, 0.05], mixEnd: [0.15, 0.1, 0.7, 0.05], tokens: 130, perOutcome: 1170 },
    },
    {
        provider: "OpenAI", service: "OpenAI API", category: "AI and ML", application: "customer-chat", costCentre: COST_CENTRES.success, environment: "Production",
        discount: 0.05, growth: 0.1, weekend: 0.75, unassigned: [0.08, 0.05], start: "2026-08-17", pack: true, commitment: { kind: "Prepaid credits", cover: 0, discount: 0 },
        ai: { model: "GPT-5.6 Sol", prices: PRICES.sol, mixStart: [0.42, 0.13, 0.45, 0], mixEnd: [0.36, 0.13, 0.51, 0], tokens: 105, perOutcome: 216 },
    },
    {
        provider: "OpenAI", service: "OpenAI API", category: "AI and ML", application: "classification-batch", costCentre: COST_CENTRES.operations, environment: "Production",
        discount: 0.05, growth: 0.05, weekend: 1, unassigned: [0.08, 0.05], start: "2026-08-17", pack: true, commitment: { kind: "Prepaid credits", cover: 0, discount: 0 },
        ai: { model: "GPT-5.6 Luna", prices: PRICES.luna, mixStart: [0.6, 0.05, 0.35, 0], mixEnd: [0.6, 0.05, 0.35, 0], tokens: 400, perOutcome: 6 },
    },
];

export const MODEL_PRICES: readonly { provider: Provider; model: string; prices: Prices }[] = LINES.flatMap((line) =>
    line.ai ? [{ provider: line.provider, model: line.ai.model, prices: line.ai.prices }] : [],
).filter((row, index, all) => all.findIndex((other) => other.provider === row.provider && other.model === row.model) === index);

export const PACK = { provider: "OpenAI" as Provider, date: "2026-08-17", amount: 60_000, label: "OpenAI prepaid credits" };

export interface CommitmentRecord {
    provider: Provider;
    kind: CommitmentKind;
    name: string;
    term: string;
    monthlyCommit: number;
    /** By month from June: the share of eligible spend the commitment covers, and how much of it was used. */
    coverage: readonly number[];
    utilisation: readonly number[];
    asOf: string;
}
export const COMMITMENTS: readonly CommitmentRecord[] = [
    { provider: "Azure", kind: "Reservation", name: "Virtual machine reservations", term: "3 years", monthlyCommit: 38_000, coverage: [0.7, 0.71, 0.72, 0.72, 0.73], utilisation: [0.95, 0.96, 0.96, 0.95, 0.96], asOf: "2026-10-22" },
    { provider: "AWS", kind: "Savings plan", name: "Compute savings plan", term: "1 year", monthlyCommit: 21_000, coverage: [0.56, 0.55, 0.55, 0.53, 0.51], utilisation: [0.93, 0.92, 0.91, 0.9, 0.88], asOf: "2026-10-25" },
];

export type FeedStatus = "Current" | "Late" | "Estimated" | "Failed" | "Empty";
export interface Feed {
    provider: string;
    feed: string;
    status: FeedStatus;
    latest: string | null;
    note: string;
    /** What the gap does to the views: the figures that stay trustworthy and the ones that don't. */
    effect: string;
}
export const FEEDS: readonly Feed[] = [
    { provider: "Azure", feed: "Cost Management export", status: "Current", latest: "2026-10-25", note: "Daily FOCUS export", effect: "Cost, tags and commitments are complete" },
    { provider: "Azure", feed: "Reservation utilisation", status: "Late", latest: "2026-10-22", note: "Three days behind", effect: "Utilisation is as of 22 Oct; cost is unaffected" },
    { provider: "AWS", feed: "Cost and Usage Report", status: "Current", latest: "2026-10-25", note: "Daily, FOCUS conversion", effect: "Cost, tags and commitments are complete" },
    { provider: "AWS", feed: "Bedrock invocation logs", status: "Failed", latest: "2026-10-21", note: "Last good load 21 Oct", effect: "Cost is complete; token detail is missing from 22 Oct, so unit costs leave those days out" },
    { provider: "Google Cloud", feed: "Billing export", status: "Current", latest: "2026-10-25", note: "Daily export to BigQuery", effect: "Cost and tags are complete" },
    { provider: "Anthropic", feed: "Usage and cost API", status: "Estimated", latest: "2026-10-25", note: "October invoice not issued", effect: "October is an estimate until the invoice arrives" },
    { provider: "OpenAI", feed: "Usage and cost API", status: "Current", latest: "2026-10-25", note: "Daily, by project", effect: "Cost and tokens are complete" },
    { provider: "Oracle Cloud", feed: "Cost and usage report", status: "Empty", latest: null, note: "Connected, no charges", effect: "A true zero, not a failure: nothing was billed in the range" },
];

export interface ProviderVariance {
    provider: Provider;
    /** By month from June: the invoice's difference to the data as a share of billed cost, or null while the month is open. */
    variance: readonly (number | null)[];
    reason: string;
}
export const INVOICE_VARIANCE: readonly ProviderVariance[] = [
    { provider: "Azure", variance: [-0.001, 0.0004, -0.0007, 0.0002, null], reason: "Rounding" },
    { provider: "AWS", variance: [0, 0.0003, 0, 0.0005, null], reason: "Rounding" },
    { provider: "Google Cloud", variance: [0.0061, 0.0058, 0.0072, 0.0065, null], reason: "Invoiced in local currency; exchange-rate rounding" },
    { provider: "Anthropic", variance: [0, 0, 0.0012, 0.0187, null], reason: "Not yet explained" },
    { provider: "OpenAI", variance: [0, 0, 0, 0.0004, null], reason: "Rounding" },
];

export const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"] as const;
/** A monthly budget for all spend and for AI spend, on the effective basis. */
export const BUDGETS = {
    total: { "2026-06": 500_000, "2026-07": 520_000, "2026-08": 540_000, "2026-09": 560_000, "2026-10": 575_000, "2026-11": 590_000, "2026-12": 600_000, "2027-01": 610_000 } as Readonly<Record<string, number>>,
    ai: { "2026-06": 90_000, "2026-07": 100_000, "2026-08": 112_000, "2026-09": 124_000, "2026-10": 130_000, "2026-11": 138_000, "2026-12": 146_000, "2027-01": 154_000 } as Readonly<Record<string, number>>,
};

// ── Dates ───────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const addDays = (iso: string, days: number) => new Date(toTime(iso) + days * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY);
export const monthOf = (iso: string) => iso.slice(0, 7);
export const daysInMonth = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
export const monthName = (month: string) => MONTH_NAMES[Number(month.slice(5, 7)) - 1];
export const nextMonth = (month: string) => monthOf(addDays(`${month}-01`, daysInMonth(month)));
const DAYS = Array.from({ length: daysBetween(DATA_FROM, DATA_TO) + 1 }, (_, i) => addDays(DATA_FROM, i));

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

export interface FinopsData {
    charges: Charge[];
}

type Amounts = Pick<Charge, "list" | "contracted" | "effective" | "billed" | "payg" | "input" | "output" | "cacheRead" | "cacheWrite" | "outcomes">;

const scaleAmounts = (a: Amounts, s: number): Amounts => ({
    list: a.list * s, contracted: a.contracted * s, effective: a.effective * s, billed: a.billed * s, payg: a.payg * s,
    input: a.input * s, output: a.output * s, cacheRead: a.cacheRead * s, cacheWrite: a.cacheWrite * s, outcomes: a.outcomes * s,
});

export function generateFinopsData(seed = SEED): FinopsData {
    const rand = random(seed);
    const charges: Charge[] = [];
    let packBalance = 0;
    const last = DAYS.length - 1;

    const push = (line: Line, date: string, amounts: Amounts, extra: Partial<Charge> = {}) => {
        charges.push({
            date, month: monthOf(date), provider: line.provider, service: line.service, category: line.category,
            model: line.ai?.model ?? "", application: line.application, costCentre: line.costCentre, environment: line.environment,
            charge: "Usage", commitment: line.commitment?.kind ?? "None", tokenData: Boolean(line.ai), ...amounts, ...extra,
        });
    };

    DAYS.forEach((date, day) => {
        if (date === PACK.date) {
            const line = LINES.find((l) => l.pack)!;
            packBalance += PACK.amount;
            push(line, date, { list: 0, contracted: 0, effective: 0, billed: PACK.amount, payg: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, outcomes: 0 }, { charge: "Purchase", model: "", tokenData: false });
        }
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        const weekend = weekday === 0 || weekday === 6;
        const progress = day / last;
        for (const line of LINES) {
            if (line.start && date < line.start) continue;
            const months = daysBetween(line.start ?? DATA_FROM, date) / 30.4375;
            const spike = line.spike && date >= line.spike.from && date <= line.spike.to ? line.spike.multiple : 1;
            const factor = (1 + line.growth) ** months * (weekend ? line.weekend : 1) * (1 + (rand() * 2 - 1) * 0.045) * spike;
            const ai = line.ai;
            let payg: number;
            let tokens = 0;
            let buckets = [0, 0, 0, 0];
            if (ai) {
                tokens = ai.tokens * factor;
                const mix = ai.mixStart.map((from, i) => from + (ai.mixEnd[i] - from) * progress);
                buckets = mix.map((share) => tokens * share);
                payg = buckets[0] * ai.prices.input + buckets[1] * ai.prices.output + buckets[2] * ai.prices.cacheRead + buckets[3] * ai.prices.cacheWrite;
            } else {
                payg = (line.base ?? 0) * factor;
            }
            const list = line.ptuDaily ?? payg;
            const contracted = list * (1 - line.discount);
            const effective = contracted * (1 - (line.commitment ? line.commitment.cover * line.commitment.discount : 0));
            let billed = effective;
            if (line.pack) {
                const covered = Math.min(packBalance, effective);
                packBalance -= covered;
                billed = effective - covered;
            }
            const outcomes = ai && ai.perOutcome > 0 ? (tokens * 1000) / (ai.perOutcome * (1 + (ai.perOutcomeDrift ?? 0)) ** months) : 0;
            const tokenData = Boolean(ai) && !(line.noTokensFrom && date >= line.noTokensFrom);
            const unassigned = line.unassigned[0] + (line.unassigned[1] - line.unassigned[0]) * progress;
            const whole: Amounts = {
                list, contracted, effective, billed, payg, outcomes,
                input: tokenData ? buckets[0] : 0, output: tokenData ? buckets[1] : 0, cacheRead: tokenData ? buckets[2] : 0, cacheWrite: tokenData ? buckets[3] : 0,
            };
            push(line, date, scaleAmounts(whole, 1 - unassigned), { tokenData });
            push(line, date, scaleAmounts(whole, unassigned), { tokenData, costCentre: UNASSIGNED, application: UNTAGGED, environment: "Unspecified" });
        }
    });
    return { charges };
}
