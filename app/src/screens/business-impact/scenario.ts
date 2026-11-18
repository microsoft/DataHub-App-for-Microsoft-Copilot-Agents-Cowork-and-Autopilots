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
 * illustrative. Nothing here is read from a model, BPS or SAP. Measure
 * definitions follow the generic SAP document model BPS extracts (dates,
 * statuses, amounts and flags), not any particular deployment.
 */

export const SCENARIO_SEED = 4217;
export const ROLLOUT_WEEK = 13;
export const WEEKS = 26;
export const scenarioRange = "4 May – 26 Oct 2026";

export type Domain = "Finance" | "Procurement" | "Sales";
export type Evidence = "Estimated" | "Observed" | "Attributable";

/** How directly a BPS Gold deployment can supply a measure. */
export type Availability = "Computed" | "Proxy" | "Needs source";
export const availabilityMeaning: Record<Availability, string> = {
    Computed: "Calculated directly from BPS Gold dates, statuses, amounts or flags.",
    Proxy: "Approximated: the link or field is indirect, or it is a team average because BPS holds no user on the document.",
    "Needs source": "Not in BPS's default SAP models: needs an extra source, model or calendar.",
};

/** A BPS measure read before and after rollout, against a comparison group. */
export interface Measured {
    unit: string;
    /** Whether a fall in the measure is an improvement. */
    lowerIsBetter: boolean;
    baseline: number;
    current: number;
    /** Change in a comparable not-yet-rolled-out group over the same period. */
    comparisonChange: number;
    /** Half-width of the 90% interval on the attributable estimate. */
    interval: number;
}

export interface Persona extends Measured {
    id: string;
    name: string;
    domain: Domain;
    /** The BPS process the persona's outcomes come from. */
    process: string;
    people: number;
    copilotActive: number;
    agentUsers: number;
    habit: number;
    /** The Value page's expert-equivalent hours, per person per month. */
    estHoursPerPerson: number;
    topTasks: readonly string[];
    kpi: string;
    evidence: Evidence;
}

export const personas: readonly Persona[] = [
    {
        id: "ap", name: "Accounts payable specialist", domain: "Finance", process: "Invoice to pay",
        people: 64, copilotActive: 0.86, agentUsers: 0.72, habit: 0.64, estHoursPerPerson: 9.4,
        topTasks: ["Email", "Data & Analysis", "Document Summarisation"],
        kpi: "Invoice posting to payment time", unit: "days", lowerIsBetter: true,
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
        kpi: "Manual journals", unit: "%", lowerIsBetter: true,
        baseline: 34, current: 32, comparisonChange: -1, interval: 2.5, evidence: "Observed",
    },
    {
        id: "buyer", name: "Buyer", domain: "Procurement", process: "Procure to pay (sourcing)",
        people: 46, copilotActive: 0.68, agentUsers: 0.33, habit: 0.44, estHoursPerPerson: 6.1,
        topTasks: ["Email", "Document Creation", "Search & Research"],
        kpi: "Requisition to PO time", unit: "days", lowerIsBetter: true,
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

/** The group's own change: current minus baseline. */
export const observedChange = (m: Measured) => m.current - m.baseline;

/** Difference in differences: the group's change less the comparison group's. */
export const attributableChange = (m: Measured) => observedChange(m) - m.comparisonChange;

/** Whether the 90% interval on the attributable change excludes zero. */
export const isConclusive = (m: Measured) => Math.abs(attributableChange(m)) > m.interval;

/** A change expressed so that positive is always better. */
export const improvement = (m: Measured, change: number) => (m.lowerIsBetter ? -change : change);

export type MeasureKind = "Speed" | "Throughput" | "Quality check" | "Cash";
export const measureKinds: readonly MeasureKind[] = ["Speed", "Throughput", "Quality check", "Cash"];

export interface ProcessMeasure extends Measured {
    process: string;
    kind: MeasureKind;
    measure: string;
    availability: Availability;
    /** The generic BPS model and fields the measure is read from, and any caveat. */
    basis: string;
}

export type MeasureRead = "Improved" | "Not conclusive" | "Held" | "Worse";

/**
 * Speed, throughput and cash measures need an improvement beyond the
 * comparison group to count. A quality check only needs to hold: it is there
 * to show that faster work hasn't produced more errors.
 */
export function readMeasure(m: ProcessMeasure): MeasureRead {
    const better = improvement(m, attributableChange(m));
    if (isConclusive(m)) return better > 0 ? "Improved" : "Worse";
    return m.kind === "Quality check" ? "Held" : "Not conclusive";
}

const measure = (process: string, kind: MeasureKind, name: string, unit: string, lowerIsBetter: boolean, baseline: number, current: number, comparisonChange: number, interval: number, availability: Availability, basis: string): ProcessMeasure =>
    ({ process, kind, measure: name, unit, lowerIsBetter, baseline, current, comparisonChange, interval, availability, basis });

/**
 * The fuller BPS scorecard: measures the BPS finance, procurement and sales
 * data models should support, each 12 weeks before vs after rollout.
 * Illustrative: confirm field population and link coverage in your own BPS
 * deployment before relying on any one.
 */
export const processScorecard: readonly ProcessMeasure[] = [
    measure("Invoice to pay", "Speed", "Invoice posting to payment time", "days", true, 8.6, 6.1, -0.6, 0.7, "Computed", "Accounts Payable Insights: AP open item posting date to clearing date. Starts at posting, not receipt: no invoice-receipt timestamp is assumed."),
    measure("Invoice to pay", "Throughput", "Invoices per specialist a month", "invoices", false, 610, 700, 10, 30, "Proxy", "Supplier invoices posted by the team, divided by the persona's headcount. Per-person output needs the invoice creator mapped to a person, so this is a team average."),
    measure("Invoice to pay", "Quality check", "Invoice items without a variance flag", "%", false, 78, 83, 1, 2.5, "Proxy", "Supplier invoice items with no price, quantity, quality, date or other tolerance-variance flag: a first-time-match proxy."),
    measure("Invoice to pay", "Quality check", "Payment-blocked items", "%", true, 6.2, 5.4, -0.2, 0.5, "Computed", "Accounts Payable Insights: open items carrying a payment blocking reason."),
    measure("Invoice to pay", "Cash", "Eligible discounts captured", "%", false, 58, 71, 2, 5, "Computed", "Open items with cash-discount terms cleared on or before the discount due date. Needs payment terms populated."),
    measure("Invoice to pay", "Cash", "Invoices paid late", "%", true, 9.1, 6.4, -0.5, 1.2, "Computed", "Open items cleared after the net due date."),
    measure("Order to cash (collections)", "Speed", "Days sales outstanding", "days", true, 52, 47, -1.5, 2.4, "Computed", "Accounts Receivable Insights: customer balances and open items."),
    measure("Order to cash (collections)", "Speed", "Dispute resolution time", "days", true, 14, 11.5, -0.5, 1.6, "Needs source", "SAP dispute-case data is not in BPS's default models; needs a dispute-management extract."),
    measure("Order to cash (collections)", "Throughput", "Open items cleared per specialist a month", "items", false, 410, 455, 8, 30, "Proxy", "Receivable items cleared by the team, divided by headcount. Per-collector output needs an assignment field, so this is a team average."),
    measure("Order to cash (collections)", "Quality check", "Receivables overdue", "%", true, 18, 16.5, -0.4, 1.5, "Computed", "Open receivables past their net due date."),
    measure("Order to cash (collections)", "Cash", "Collection effectiveness", "%", false, 82, 86, 1, 2.4, "Computed", "Cleared receivables against receivables due, from customer balances."),
    measure("Order to cash (collections)", "Cash", "Receivables reaching dunning", "%", true, 4.4, 3.8, -0.2, 0.7, "Computed", "Receivable open items with a dunning level above zero."),
    measure("Record to report", "Speed", "Days to close", "days", true, 7, 6, -0.2, 0.9, "Needs source", "A close calendar or task log is not part of the default BPS models; needs the close schedule from a close-management source."),
    measure("Record to report", "Throughput", "Journals per accountant a month", "journals", false, 120, 131, 3, 9, "Proxy", "Journal entries posted by the team, divided by headcount. The creator is an SAP user, so per-person views need an identity mapping."),
    measure("Record to report", "Quality check", "Manual journals", "%", true, 34, 32, -1, 2.5, "Proxy", "Finance Insights: share of journal lines by accounting document type and reference type that are not system-generated."),
    measure("Record to report", "Quality check", "Journal reversals", "%", true, 2.1, 2.0, 0, 0.4, "Computed", "Finance Insights: journal lines flagged as reversals."),
    measure("Procure to pay (sourcing)", "Speed", "Requisition to PO time", "days", true, 5.4, 4.9, -0.3, 0.6, "Proxy", "Purchase requisition item creation to its purchase order's creation. Depends on the requisition-to-PO link being populated: check coverage first."),
    measure("Procure to pay (sourcing)", "Speed", "Requisition release time", "days", true, 3.6, 3.2, -0.2, 0.6, "Computed", "Purchase requisition item creation date to release date."),
    measure("Procure to pay (sourcing)", "Throughput", "Purchase orders per buyer a month", "POs", false, 213, 226, 4, 12, "Proxy", "Purchase orders created by the purchasing group, divided by headcount. Per-buyer needs the PO creator's SAP user mapped."),
    measure("Procure to pay (sourcing)", "Quality check", "Supplier on-time delivery", "%", false, 88, 89, 0.5, 2, "Proxy", "Goods movements against purchase order schedule dates. Needs the Goods movements and Deliveries models enabled."),
    measure("Source to contract", "Speed", "Contract cycle time", "days", true, 34, 30, -1, 4.5, "Needs source", "Contract authoring and approval is not in BPS's default models; needs a contract-lifecycle source."),
    measure("Source to contract", "Quality check", "Spend outside contracts", "%", true, 9, 7.8, -0.3, 1.2, "Computed", "Spend Insights: purchase order item net amount with no purchase-contract reference."),
    measure("Source to contract", "Cash", "Spend under contract", "%", false, 71, 76, 1, 4.2, "Computed", "Spend Insights: purchase order item net amount that references a purchase contract."),
    measure("Quote to order", "Speed", "Quote to order", "days", true, 11.5, 11.0, -0.4, 1.3, "Proxy", "Sales Orders: quotation creation to the follow-on order via document flow. Confirm quotations are extracted."),
    measure("Quote to order", "Throughput", "Quotes per rep a month", "quotes", false, 208, 214, 3, 14, "Proxy", "Quotations created by the team, divided by headcount. The sales-employee field can be blank: check it before any per-person view."),
    measure("Quote to order", "Quality check", "Orders held by a delivery or billing block", "%", true, 2.4, 2.1, -0.1, 0.5, "Computed", "Sales & Billing Insights: sales document items with a delivery or billing block reason."),
    measure("Quote to order", "Quality check", "Forecast accuracy", "%", false, 74, 76, 1, 4, "Needs source", "Needs Opportunity Insights (Salesforce) or a planning source; not in the default SAP extraction."),
    measure("Quote to order", "Cash", "Win rate", "%", false, 27, 28, 0.5, 3, "Needs source", "Opportunity Insights (Salesforce) or D365: won over won-or-lost opportunities."),
];

const headlineMeasureNames = new Set([
    "Invoice posting to payment time", "Invoices per specialist a month", "Invoice items without a variance flag",
    "Eligible discounts captured", "Days sales outstanding", "Manual journals",
    "Requisition to PO time", "Spend under contract",
]);
export const headlineMeasures = processScorecard.filter(m => headlineMeasureNames.has(m.measure));

/** The scorecard measure behind a persona's headline KPI. */
export const measureFor = (p: Persona) => processScorecard.find(m => m.measure === p.kpi);

/** Separate invented Dataverse cohort, not a BPS export or a connected environment. */
export const d365SalesPreview = [
    { measure: "Lead qualification rate", baseline: 32, current: 38, unit: "%", definition: "Qualified leads / all qualified or disqualified leads; open leads excluded.", persona: "Sales development representative" },
    { measure: "Opportunity win rate", baseline: 27, current: 28, unit: "%", definition: "Won opportunities / all won or lost opportunities; open opportunities excluded.", persona: "Account executive" },
    { measure: "Opportunity sales cycle", baseline: 42, current: 37, unit: "days", definition: "Median days from creation to close for won opportunities.", persona: "Account executive" },
] as const;

/** The throughput measure for a persona's process, if BPS has one. */
export const throughputFor = (p: Persona) => processScorecard.find(m => m.process === p.process && m.kind === "Throughput");

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
 * Weekly invoice posting-to-payment time for the AP pilot team and a comparable team that
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
    { level: "Estimated", label: "Expert-equivalent hours (Value method)", value: "602 h / month", basis: "64 illustrative AP specialists × 9.4 hours. Uses Value's estimation concept, not its separate demo cohort or measured savings." },
    { level: "Observed", label: "Invoice posting to payment time", value: "8.6 → 6.1 days", basis: "Illustrative AP open items for the pilot team, 12 weeks before vs after rollout. Not adjusted for anything else that changed." },
    { level: "Attributable", label: "Beyond the comparison team", value: "−1.9 days (±0.7)", basis: "Simulated difference in differences against a matched team not yet rolled out. 90% interval; study assumptions still matter." },
];

/** Value categories, kept apart and never summed. */
export const financialCategories = [
    { category: "Released capacity", value: "≈ 12 FTE equivalent", note: "1,750 expert-equivalent hours a month across the six personas, from the Value page's estimate. Hours, not payroll savings, unless roles are redeployed or not backfilled." },
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

/** What the optional module would read. Model names follow the BPS documentation; confirm entities and field population against your deployment. */
export const dataContract = [
    { source: "BPS Gold (shortcut)", table: "Accounts Payable Insights: AP open items; supplier invoices (header, item)", grain: "Open item; invoice item", use: "Posting to payment time, payment blocks, discounts, late payment, invoice variance flags" },
    { source: "BPS Gold (shortcut)", table: "Accounts Receivable Insights: AR open items; customer balances", grain: "Open item; customer, fiscal period", use: "Days sales outstanding, overdue share, collection effectiveness, dunning" },
    { source: "BPS Gold (shortcut)", table: "Finance Insights: general ledger line items", grain: "Journal line", use: "Manual and reversed journals, journals posted by the team" },
    { source: "BPS Gold (shortcut)", table: "Spend Insights: purchase requisitions and purchase orders", grain: "Requisition item; PO item", use: "Requisition release and requisition-to-PO time, spend under or outside contracts, POs by purchasing group" },
    { source: "BPS Gold (shortcut)", table: "Sales & Billing Insights: sales orders, deliveries, billing", grain: "Sales document item; billing item", use: "Quote to order, delivery and billing blocks, quotes by team" },
    { source: "BPS Gold (shortcut)", table: "Cost centre, company code, purchasing group, person and work agreement", grain: "Entity, effective-dated", use: "Org mapping; SAP people appear by user and personnel number, not UPN" },
    { source: "BPS Opportunity Insights (optional)", table: "Salesforce opportunities", grain: "Opportunity", use: "Win rate, forecast accuracy: only if a Salesforce source is connected" },
    { source: "D365 / Dataverse (proposed)", table: "Lead and opportunity", grain: "Record with status, owner and lifecycle timestamps", use: "Qualification rate, win rate and sales cycle; history needed for before/after cohorts" },
    { source: "D365 / Dataverse (proposed)", table: "Account, business unit and owner mappings", grain: "Account or owner, effective-dated", use: "Sales personas and org groups after identity mapping is validated" },
    { source: "DataHub (new)", table: "impact_org_map", grain: "Cost centre or purchasing group → org group, with validity dates", use: "Joins BPS outcomes to DataHub org data" },
    { source: "DataHub (new)", table: "impact_persona_map", grain: "Job title or role → persona", use: "Functional personas" },
    { source: "DataHub (new)", table: "impact_user_map (optional)", grain: "SAP user or personnel number → UPN", use: "Person-level views only, after privacy review; customer-supplied, never inferred" },
    { source: "DataHub (new)", table: "impact_agent_process_map", grain: "Agent → process", use: "Agents in the process; optional case-ID link" },
    { source: "DataHub (new)", table: "impact_kpi_weekly", grain: "Org group × persona × process × week", use: "The one table this page reads" },
] as const;

/** How BPS outcomes can be joined to DataHub's people data, from safest to most revealing. */
export const personaJoins = [
    { level: "Team (default)", join: "Purchasing group, cost centre or company code → org group", shows: "Group outcomes beside the group's AI use, for groups of at least 5 people", needs: "impact_org_map" },
    { level: "Role", join: "Job title or authorisation group → persona", shows: "Functional personas across teams", needs: "impact_persona_map" },
    { level: "Person (opt-in)", join: "SAP user or personnel number → UPN", shows: "Whose documents an agent touched; individual-level analysis", needs: "impact_user_map from the customer, plus privacy review" },
] as const;

/** Checks before trusting a BPS-derived measure. */
export const readinessChecks = [
    { check: "Data window", why: "History must cover both the before and after windows, not just the latest extract." },
    { check: "Last load", why: "A stale load understates the after period and makes recent rollouts look flat." },
    { check: "Link coverage", why: "Share of requisitions linked to purchase orders and of cost centres mapped. Low coverage turns a measure into a proxy." },
    { check: "Field population", why: "Payment terms, contract references, discount dates and sales-employee fields can be blank, and flags can be rare. Check a rate has a meaningful count behind it." },
    { check: "Volume", why: "Rates on small monthly counts swing: confirm the count behind each KPI before comparing groups." },
] as const;

export const coverage = { costCentresMapped: 0.87, peopleWithPersona: 0.81, agentsMapped: 5, agentsTotal: 7, bpsRefreshed: "26 Oct 2026, 04:10 UTC" };
