//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * A seeded, synthetic scenario for the Business Impact preview: DataHub
 * adoption, agent and cost signals beside the process outcomes Business
 * Process Solutions (BPS) publishes in its Fabric Gold layer. Every figure is
 * illustrative. Nothing here is read from a model, BPS or SAP.
 */

export const SCENARIO_SEED = 4217;
export const ROLLOUT_WEEK = 13;
export const WEEKS = 26;
export const scenarioRange = "4 May – 26 Oct 2026";

export type Domain = "Finance" | "Procurement" | "Sales";
export type Evidence = "Estimated" | "Observed" | "Attributable";

export interface Persona {
    id: string;
    name: string;
    domain: Domain;
    /** The BPS process the persona's outcomes come from. */
    process: string;
    people: number;
    copilotActive: number;
    agentUsers: number;
    habit: number;
    /** DataHub behaviour-based estimate, hours per person per month. */
    estHoursPerPerson: number;
    topTasks: readonly string[];
    kpi: string;
    unit: string;
    /** Whether a fall in the KPI is an improvement. */
    lowerIsBetter: boolean;
    baseline: number;
    current: number;
    /** Change in a comparable not-yet-rolled-out group over the same period. */
    comparisonChange: number;
    /** Half-width of the 90% interval on the attributable estimate. */
    interval: number;
    evidence: Evidence;
}

export const personas: readonly Persona[] = [
    {
        id: "ap", name: "Accounts payable specialist", domain: "Finance", process: "Invoice to pay",
        people: 64, copilotActive: 0.86, agentUsers: 0.72, habit: 0.64, estHoursPerPerson: 9.4,
        topTasks: ["Email", "Data & Analysis", "Document Summarisation"],
        kpi: "Invoice cycle time", unit: "days", lowerIsBetter: true,
        baseline: 8.6, current: 6.1, comparisonChange: -0.6, interval: 0.7, evidence: "Attributable",
    },
    {
        id: "ar", name: "Collections specialist", domain: "Finance", process: "Order to cash (collections)",
        people: 38, copilotActive: 0.79, agentUsers: 0.55, habit: 0.57, estHoursPerPerson: 7.8,
        topTasks: ["Email", "Meetings", "Search & Research"],
        kpi: "Days sales outstanding", unit: "days", lowerIsBetter: true,
        baseline: 52, current: 47, comparisonChange: -1.5, interval: 2.4, evidence: "Attributable",
    },
    {
        id: "r2r", name: "Financial controller", domain: "Finance", process: "Record to report",
        people: 22, copilotActive: 0.91, agentUsers: 0.41, habit: 0.68, estHoursPerPerson: 11.2,
        topTasks: ["Data & Analysis", "Presentations", "Document Creation"],
        kpi: "Days to close", unit: "days", lowerIsBetter: true,
        baseline: 7.0, current: 6.0, comparisonChange: -0.2, interval: 0.9, evidence: "Observed",
    },
    {
        id: "buyer", name: "Buyer", domain: "Procurement", process: "Procure to pay (sourcing)",
        people: 46, copilotActive: 0.68, agentUsers: 0.33, habit: 0.44, estHoursPerPerson: 6.1,
        topTasks: ["Email", "Document Creation", "Search & Research"],
        kpi: "Purchase order cycle time", unit: "days", lowerIsBetter: true,
        baseline: 5.4, current: 4.9, comparisonChange: -0.3, interval: 0.6, evidence: "Observed",
    },
    {
        id: "category", name: "Category manager", domain: "Procurement", process: "Source to contract",
        people: 18, copilotActive: 0.83, agentUsers: 0.28, habit: 0.5, estHoursPerPerson: 8.3,
        topTasks: ["Data & Analysis", "Presentations", "Meetings"],
        kpi: "Spend under contract", unit: "%", lowerIsBetter: false,
        baseline: 71, current: 76, comparisonChange: 1.0, interval: 4.2, evidence: "Observed",
    },
    {
        id: "salesops", name: "Sales operations analyst", domain: "Sales", process: "Quote to order",
        people: 34, copilotActive: 0.58, agentUsers: 0.21, habit: 0.36, estHoursPerPerson: 5.2,
        topTasks: ["Data & Analysis", "Email", "General Chat & Q&A"],
        kpi: "Quote to order", unit: "days", lowerIsBetter: true,
        baseline: 11.5, current: 11.0, comparisonChange: -0.4, interval: 1.3, evidence: "Estimated",
    },
];

/** The persona's own change: current minus baseline. */
export const observedChange = (p: Persona) => p.current - p.baseline;

/** Difference in differences: the persona's change less the comparison group's. */
export const attributableChange = (p: Persona) => observedChange(p) - p.comparisonChange;

/** Whether the 90% interval on the attributable change excludes zero. */
export const isConclusive = (p: Persona) => Math.abs(attributableChange(p)) > p.interval;

/** A change expressed so that positive is always better. */
export const improvement = (p: Persona, change: number) => (p.lowerIsBetter ? -change : change);

export const taskCategories = [
    "Email", "Data & Analysis", "Document Summarisation", "Document Creation",
    "Meetings", "Search & Research", "Presentations", "Specialist Support",
] as const;

const TASK_MIX: Record<string, readonly number[]> = {
    ap: [0.29, 0.22, 0.17, 0.06, 0.04, 0.07, 0.01, 0.14],
    ar: [0.34, 0.12, 0.09, 0.08, 0.16, 0.13, 0.02, 0.06],
    r2r: [0.12, 0.31, 0.09, 0.15, 0.08, 0.06, 0.16, 0.03],
    buyer: [0.31, 0.11, 0.1, 0.19, 0.09, 0.15, 0.03, 0.02],
    category: [0.16, 0.27, 0.08, 0.1, 0.14, 0.09, 0.15, 0.01],
    salesops: [0.22, 0.29, 0.07, 0.08, 0.09, 0.11, 0.06, 0.08],
};

/** Persona × task category: the share of each persona's AI tasks. */
export const personaTaskMix = personas.flatMap((p) =>
    taskCategories.map((task, i) => ({ Persona: p.name, Task: task, Share: TASK_MIX[p.id][i] })),
);

function mulberry32(seed: number) {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function weekLabel(index: number) {
    return new Date(Date.UTC(2026, 4, 4) + index * 7 * 86_400_000).toISOString().slice(0, 10);
}

export const rolloutDate = weekLabel(ROLLOUT_WEEK - 1);

/**
 * Weekly invoice cycle time for the AP pilot team and a comparable team that
 * had not yet been rolled out to.
 */
export function apTrend() {
    const random = mulberry32(SCENARIO_SEED);
    const rows: { Week: string; Group: string; Days: number }[] = [];
    for (let w = 0; w < WEEKS; w++) {
        const ramp = Math.min(1, Math.max(0, w - ROLLOUT_WEEK + 1) / 6);
        const seasonal = Math.sin(w / 4) * 0.2;
        const pilot = 8.6 - 0.03 * w - 2.0 * ramp + seasonal + (random() - 0.5) * 0.5;
        const comparison = 8.4 - 0.03 * w + seasonal + (random() - 0.5) * 0.5;
        rows.push({ Week: weekLabel(w), Group: "Pilot team (rolled out)", Days: +pilot.toFixed(2) });
        rows.push({ Week: weekLabel(w), Group: "Comparison team (not yet)", Days: +comparison.toFixed(2) });
    }
    return rows;
}

/** Teams within each persona: agent adoption beside outcome improvement. */
export function teamScatter() {
    const random = mulberry32(SCENARIO_SEED + 1);
    return personas.flatMap((p) =>
        Array.from({ length: 5 }, (_, i) => {
            const adoption = Math.min(0.97, Math.max(0.15, p.agentUsers + (random() - 0.5) * 0.4));
            const base = improvement(p, observedChange(p)) / Math.abs(p.baseline);
            const outcome = base * (0.4 + adoption) + (random() - 0.5) * 0.06;
            return {
                Persona: p.name,
                Team: `${p.name}, team ${i + 1}`,
                AgentAdoption: +adoption.toFixed(2),
                Improvement: +outcome.toFixed(3),
                People: 6 + Math.round(random() * 10),
            };
        }),
    );
}

export interface ProcessAgent {
    name: string;
    origin: "BPS template" | "Copilot Studio" | "Agent 365";
    process: string;
    persona: string;
    sessions: number;
    resolution: number;
    credits: number;
    /** Business cases the agent's runs are linked to by case ID, where instrumented. */
    linkedCases?: number;
    owner: string;
    review: "Up to date" | "Due" | "Missing owner";
}

export const processAgents: readonly ProcessAgent[] = [
    { name: "Invoice exception agent", origin: "Copilot Studio", process: "Invoice to pay", persona: "ap", sessions: 6380, resolution: 0.77, credits: 51_000, linkedCases: 5210, owner: "AP operations", review: "Up to date" },
    { name: "Collections follow-up agent", origin: "Copilot Studio", process: "Order to cash (collections)", persona: "ar", sessions: 2950, resolution: 0.69, credits: 23_600, linkedCases: 2140, owner: "Credit control", review: "Due" },
    { name: "Finance posting agent", origin: "BPS template", process: "Record to report", persona: "r2r", sessions: 1240, resolution: 0.81, credits: 18_600, linkedCases: 1105, owner: "Finance systems", review: "Up to date" },
    { name: "Supplier risk agent", origin: "Agent 365", process: "Source to contract", persona: "category", sessions: 610, resolution: 0.74, credits: 7_300, owner: "Procurement excellence", review: "Up to date" },
    { name: "Pipeline health agent", origin: "BPS template", process: "Quote to order", persona: "salesops", sessions: 480, resolution: 0.58, credits: 5_800, owner: "", review: "Missing owner" },
];

export const CREDIT_PRICE = 0.01;
export const LICENCE_PRICE = 30;

/** Monthly business volume BPS reports for each process. */
export const processVolume: Record<string, number> = {
    "Invoice to pay": 42_000,
    "Order to cash (collections)": 18_500,
    "Record to report": 2_400,
    "Procure to pay (sourcing)": 9_800,
    "Source to contract": 620,
    "Quote to order": 7_100,
};

export function costToServe() {
    return processAgents.map((a) => {
        const p = personas.find((x) => x.id === a.persona)!;
        const licenceCost = p.people * LICENCE_PRICE;
        const agentCost = Math.round(a.credits * CREDIT_PRICE);
        const volume = processVolume[a.process];
        return {
            process: a.process,
            agent: a.name,
            agentCost,
            licenceCost,
            volume,
            costPerTransaction: (agentCost + licenceCost) / volume,
            costPerResolvedCase: a.linkedCases ? agentCost / (a.linkedCases * a.resolution) : undefined,
        };
    });
}

/** The evidence ladder for the AP pilot, one rung per evidence level. */
export const benefitLadder: readonly { level: Evidence; label: string; value: string; basis: string }[] = [
    { level: "Estimated", label: "Hours saved (DataHub estimate)", value: "602 h / month", basis: "Behaviour-based task times × AI tasks for 64 AP specialists. A planning figure, not measured." },
    { level: "Observed", label: "Invoice cycle time", value: "8.6 → 6.1 days", basis: "BPS invoice facts for the pilot team, 12 weeks before vs after rollout. Not adjusted for anything else that changed." },
    { level: "Attributable", label: "Beyond the comparison team", value: "−1.9 days (±0.7)", basis: "Difference in differences against a matched team not yet rolled out. 90% interval." },
];

/** Value categories, kept apart and never summed. */
export const financialCategories = [
    { category: "Released capacity", value: "≈ 12 FTE equivalent", note: "1,750 estimated hours a month across the six personas. Hours, not payroll savings, unless roles are redeployed or not backfilled." },
    { category: "Working capital", value: "≈ 2.6M one-off", note: "From the attributable DSO change. Cash timing, not revenue or profit, and not recurring." },
    { category: "Cash savings", value: "≈ 38k / month", note: "Early-payment discounts captured on invoices now approved inside terms." },
    { category: "Avoided cost", value: "≈ 9k / month", note: "Late-payment fees no longer incurred. Shown apart from discounts." },
];

export const opportunities = [
    { process: "Quote to order", persona: "Sales operations analyst", volume: 7_100, gap: 0.38, agentAdoption: 0.21, candidate: "Pipeline health agent (BPS template), once it has an owner", priority: "High" },
    { process: "Procure to pay (sourcing)", persona: "Buyer", volume: 9_800, gap: 0.23, agentAdoption: 0.33, candidate: "Extend the invoice exception agent to PO mismatches", priority: "High" },
    { process: "Order to cash (collections)", persona: "Collections specialist", volume: 18_500, gap: 0.12, agentAdoption: 0.55, candidate: "Lift the collections agent's resolution rate: review its failing topics", priority: "Medium" },
    { process: "Record to report", persona: "Financial controller", volume: 2_400, gap: 0.2, agentAdoption: 0.41, candidate: "A close-checklist agent: low volume, high visibility", priority: "Medium" },
    { process: "Invoice to pay", persona: "Accounts payable specialist", volume: 42_000, gap: 0.04, agentAdoption: 0.72, candidate: "Sustain, and use as the reference rollout", priority: "Low" },
] as const;

/** What the optional module would read. BPS table names are illustrative; confirm them against your deployment. */
export const dataContract = [
    { source: "BPS Gold (shortcut)", table: "Accounts payable invoice facts", grain: "Invoice", use: "Cycle time, first-time match, discounts and late fees" },
    { source: "BPS Gold (shortcut)", table: "Accounts receivable open items", grain: "Open item per day", use: "Days sales outstanding" },
    { source: "BPS Gold (shortcut)", table: "Purchase order facts", grain: "PO line", use: "PO cycle time, spend under contract" },
    { source: "BPS Gold (shortcut)", table: "Sales quote and order facts", grain: "Document", use: "Quote to order" },
    { source: "BPS Gold (shortcut)", table: "Cost centre and company code", grain: "Cost centre, effective-dated", use: "Org mapping" },
    { source: "DataHub (new)", table: "impact_org_map", grain: "Cost centre → org group, with validity dates", use: "Joins BPS outcomes to DataHub org data" },
    { source: "DataHub (new)", table: "impact_persona_map", grain: "Job title or role → persona", use: "Functional personas" },
    { source: "DataHub (new)", table: "impact_agent_process_map", grain: "Agent → process", use: "Agents in the process; optional case-ID link" },
    { source: "DataHub (new)", table: "impact_kpi_weekly", grain: "Org group × persona × process × week", use: "The one table this page reads" },
] as const;

export const coverage = { costCentresMapped: 0.87, peopleWithPersona: 0.81, agentsMapped: 5, agentsTotal: 7, bpsRefreshed: "26 Oct 2026, 04:10 UTC" };
