import { personas, processAgents, processVolume, type Domain } from "./scenario";

/**
 * Authored examples of persona and process discovery, not a discovery engine.
 * Titles, fit and initial approval statuses are fixtures. Persona counts come
 * from the scenario so the two pages cannot disagree.
 */

export type Status = "Confirmed" | "Proposed" | "Needs a decision" | "Waiting for source";
export type Fit = "High" | "Medium" | "Low" | "None";

export interface ProcessEntry {
    name: string;
    source: "SAP" | "D365";
    models: string;
    volume: number | null;
    unit: string;
    readiness: "Ready" | "Check first" | "Not connected";
    note: string;
    owner: string;
}

/** Authored catalogue of SAP processes and a later D365 source. */
export const catalogue: readonly ProcessEntry[] = [
    { name: "Invoice to pay", source: "SAP", models: "Accounts Payable Insights", volume: processVolume["Invoice to pay"], unit: "invoices", readiness: "Ready", note: "Supplier items and invoice flags are populated.", owner: "Finance operations" },
    { name: "Order to cash (collections)", source: "SAP", models: "Accounts Receivable Insights", volume: processVolume["Order to cash (collections)"], unit: "customer items", readiness: "Ready", note: "Due dates and dunning levels are populated.", owner: "Credit control" },
    { name: "Record to report", source: "SAP", models: "Finance Insights", volume: processVolume["Record to report"], unit: "journal entries", readiness: "Ready", note: "Ledger lines carry reversal flags.", owner: "Controllership" },
    { name: "Procure to pay (sourcing)", source: "SAP", models: "Spend Insights", volume: processVolume["Procure to pay (sourcing)"], unit: "purchase orders", readiness: "Check first", note: "Requisition-to-order links are only partly populated.", owner: "Procurement operations" },
    { name: "Source to contract", source: "SAP", models: "Spend Insights", volume: processVolume["Source to contract"], unit: "contracts", readiness: "Check first", note: "Agree which categories need a contract first.", owner: "Procurement excellence" },
    { name: "Quote to order", source: "SAP", models: "Sales & Billing Insights", volume: processVolume["Quote to order"], unit: "quotes", readiness: "Check first", note: "Sales-employee fields are often blank.", owner: "Sales operations" },
    { name: "Lead to opportunity", source: "D365", models: "Lead and opportunity (Dataverse)", volume: null, unit: "leads", readiness: "Not connected", note: "Added when a D365 source is connected.", owner: "Sales operations" },
];

export const sapProcesses = catalogue.filter(p => p.source === "SAP").map(p => p.name);
export const d365Process = "Lead to opportunity";

export interface Group {
    id: string;
    name: string;
    domain: Domain;
    scope: "sap" | "d365";
    /** Job titles in the org data that fall into the group. */
    titles: readonly string[];
    people: number;
    copilotActive: number;
    agentUsers: number;
    topTasks: readonly string[];
    /** The scenario persona the group maps to, or null while none fits. */
    persona: string | null;
    /** The process the group is proposed or confirmed for. */
    process: string | null;
    /** A process worth considering while the group still needs a decision. */
    suggestion: string | null;
    fit: Fit;
    status: Status;
    /** Other processes the group touches. These never add to coverage. */
    also: readonly string[];
    note: string;
}

function fromPersona(id: string, titles: readonly string[], status: Status, fit: Fit, also: readonly string[], note: string): Group {
    const p = personas.find(x => x.id === id)!;
    return {
        id, name: p.name, domain: p.domain, scope: "sap", titles, people: p.people, copilotActive: p.copilotActive,
        agentUsers: p.agentUsers, topTasks: p.topTasks, persona: p.id, process: p.process, suggestion: null,
        fit, status, also, note,
    };
}

export const groups: readonly Group[] = [
    fromPersona("ap", ["AP specialist", "AP analyst", "Accounts payable clerk"], "Confirmed", "High", [], "Titles match the process's usual roles."),
    fromPersona("ar", ["Credit controller", "Collections analyst"], "Confirmed", "High", [], "Titles match the process's usual roles."),
    fromPersona("r2r", ["Financial controller", "GL accountant"], "Confirmed", "High", ["Invoice to pay"], "Also reviews supplier postings at close."),
    fromPersona("buyer", ["Buyer", "Purchasing agent"], "Confirmed", "High", ["Source to contract"], "Titles match the process's usual roles."),
    fromPersona("category", ["Category manager", "Sourcing lead"], "Proposed", "Medium", ["Procure to pay (sourcing)"], "Some titles also appear in buying teams."),
    fromPersona("salesops", ["Sales ops analyst", "Quote desk analyst"], "Proposed", "Medium", [], "Quote desk titles vary by region."),
    {
        id: "procurement-coordinator", name: "Procurement coordinator", domain: "Procurement", scope: "sap",
        titles: ["Procurement coordinator", "Purchasing assistant"], people: 12, copilotActive: 0.66, agentUsers: 0.27,
        topTasks: ["Email", "Document Creation", "Search & Research"], persona: null, process: "Procure to pay (sourcing)",
        suggestion: null, fit: "Medium", status: "Proposed", also: [], note: "Suggested as a new persona: none of the six fits.",
    },
    {
        id: "finance-analyst", name: "Finance analyst", domain: "Finance", scope: "sap",
        titles: ["Finance analyst", "FP&A analyst"], people: 19, copilotActive: 0.74, agentUsers: 0.31,
        topTasks: ["Data & Analysis", "Presentations", "Email"], persona: null, process: null,
        suggestion: "Record to report", fit: "Low", status: "Needs a decision", also: [], note: "Planning work sits outside the ledger measures.",
    },
    {
        id: "treasury", name: "Treasury analyst", domain: "Finance", scope: "sap",
        titles: ["Treasury analyst"], people: 9, copilotActive: 0.81, agentUsers: 0.22,
        topTasks: ["Data & Analysis", "Email", "Specialist Support"], persona: null, process: null,
        suggestion: null, fit: "None", status: "Needs a decision", also: [], note: "No process in this catalogue covers treasury today.",
    },
    {
        id: "sales-manager", name: "Sales manager", domain: "Sales", scope: "sap",
        titles: ["Sales manager", "Regional sales lead"], people: 7, copilotActive: 0.62, agentUsers: 0.18,
        topTasks: ["Meetings", "Email", "Presentations"], persona: null, process: null,
        suggestion: "Quote to order", fit: "Low", status: "Needs a decision", also: [], note: "Managers see team outcomes, not a personal process.",
    },
    {
        id: "facilities-buyer", name: "Facilities buyer", domain: "Procurement", scope: "sap",
        titles: ["Facilities buyer"], people: 5, copilotActive: 0.6, agentUsers: 0.2,
        topTasks: ["Email", "Document Creation", "Search & Research"], persona: null, process: null,
        suggestion: "Procure to pay (sourcing)", fit: "Low", status: "Needs a decision", also: [], note: "Buys outside the catalogue; confirm before grouping with buyers.",
    },
    {
        id: "sdr", name: "Sales development representative", domain: "Sales", scope: "d365",
        titles: ["SDR", "Business development rep"], people: 26, copilotActive: 0.71, agentUsers: 0.38,
        topTasks: ["Email", "Search & Research", "Data & Analysis"], persona: null, process: d365Process,
        suggestion: null, fit: "High", status: "Waiting for source", also: [], note: "Counted once D365 lead data is connected.",
    },
    {
        id: "ae", name: "Account executive", domain: "Sales", scope: "d365",
        titles: ["Account executive", "Enterprise account manager"], people: 41, copilotActive: 0.69, agentUsers: 0.29,
        topTasks: ["Email", "Meetings", "Presentations"], persona: null, process: d365Process,
        suggestion: null, fit: "High", status: "Waiting for source", also: [], note: "Counted once D365 opportunity data is connected.",
    },
];

export interface AgentLink {
    id: string;
    name: string;
    origin: "Process template" | "Copilot Studio" | "Agent 365";
    owner: string;
    process: string | null;
    suggestion: string | null;
    status: Status;
    note: string;
}

const agentNote: Record<string, string> = {
    "Pipeline health agent": "No owner is declared yet, so it stays proposed.",
};

export const agentLinks: readonly AgentLink[] = [
    ...processAgents.map((a): AgentLink => ({
        id: a.name, name: a.name, origin: a.origin, owner: a.owner, process: a.process, suggestion: null,
        status: a.owner ? "Confirmed" : "Proposed", note: agentNote[a.name] ?? "Owner approved.",
    })),
    { id: "Purchase order chaser", name: "Purchase order chaser", origin: "Copilot Studio", owner: "Procurement operations", process: null, suggestion: "Procure to pay (sourcing)", status: "Needs a decision", note: "Owner declared; process not yet chosen." },
    { id: "Expense policy agent", name: "Expense policy agent", origin: "Agent 365", owner: "", process: null, suggestion: null, status: "Needs a decision", note: "No owner and no process; may sit outside this catalogue." },
];

/** Reviewer choices, keyed by group or agent id. */
export type Decisions = Readonly<Record<string, Status>>;

export function decide<T extends { id: string; status: Status }>(items: readonly T[], decisions: Decisions): T[] {
    return items.map(item => (decisions[item.id] ? { ...item, status: decisions[item.id] } : item));
}

export interface BridgeSummary {
    scope: number;
    confirmed: number;
    proposed: number;
    unmapped: number;
    withPersona: number;
    share: number;
    toReview: number;
}

/** People in the SAP-scenario functions, by how settled their mapping is. D365-only groups are counted apart. */
export function bridgeSummary(list: readonly Group[]): BridgeSummary {
    const sap = list.filter(g => g.scope === "sap");
    const sum = (test: (g: Group) => boolean) => sap.filter(test).reduce((n, g) => n + g.people, 0);
    const scope = sum(() => true);
    const withPersona = sum(g => g.persona !== null);
    return {
        scope,
        confirmed: sum(g => g.status === "Confirmed"),
        proposed: sum(g => g.status === "Proposed"),
        unmapped: sum(g => g.status === "Needs a decision"),
        withPersona,
        share: scope === 0 ? 0 : withPersona / scope,
        toReview: sap.filter(g => g.status !== "Confirmed").length,
    };
}

export interface AgentSummary {
    total: number;
    mapped: number;
    confirmed: number;
    toReview: number;
}

export function agentSummary(list: readonly AgentLink[]): AgentSummary {
    return {
        total: list.length,
        mapped: list.filter(a => a.process !== null).length,
        confirmed: list.filter(a => a.status === "Confirmed").length,
        toReview: list.filter(a => a.status !== "Confirmed").length,
    };
}

/** How a group relates to a process column in the connect grid. */
export type Cell = "primary" | "also" | "none";

export const NO_PROCESS = "No process yet";

export function cellFor(group: Group, column: string): Cell {
    if (column === NO_PROCESS) return group.process === null ? "primary" : "none";
    if (group.process === column) return "primary";
    return group.also.includes(column) ? "also" : "none";
}

/** People in the SAP-scenario groups whose confirmed or proposed process is the one given. */
export function peopleInProcess(list: readonly Group[], process: string): number {
    return list.filter(g => g.scope === "sap" && g.process === process).reduce((n, g) => n + g.people, 0);
}

export interface SetupCheck {
    label: string;
    done: boolean;
    detail: string;
}

export function setupChecks(people: BridgeSummary, agents: AgentSummary): SetupCheck[] {
    return [
        { label: "Group people by an org attribute", done: true, detail: "Illustrated with fixed sample groups, each of at least 5 people. Group by does not regroup this preview." },
        { label: "Approve the persona list", done: people.toReview === 0, detail: people.toReview === 0 ? "Every group is confirmed." : `${people.toReview} of the groups still need a review.` },
        { label: "Approve the agent-to-process list", done: agents.toReview === 0, detail: agents.toReview === 0 ? "Every agent is confirmed." : `${agents.toReview} of ${agents.total} agents still need a review.` },
        { label: "Keep person-level mapping off", done: true, detail: "Team and role only. Person-level needs the customer's list and a privacy review." },
    ];
}

/** Planned discovery inputs; no reads or classification are implemented here. */
export const discoverySources = [
    { source: "Org data", reads: "Job title, department and cost centre for each person", yields: "Candidate groups" },
    { source: "SAP process data", reads: "Source system, company code, cost centre and purchasing group behind each process", yields: "Process measures and team scope; not employee personas" },
    { source: "D365 (later)", reads: "Business unit, owner and lead or opportunity records", yields: "Sales groups and the Lead to opportunity process" },
    { source: "Agent registry", reads: "Stable agent ID, owner and declared purpose", yields: "An owner-reviewed agent-to-process classification" },
] as const;
