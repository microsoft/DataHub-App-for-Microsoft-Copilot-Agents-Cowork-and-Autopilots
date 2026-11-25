//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useState } from "react";
import { stageAnchor } from "@/components/destinations";
import { Section } from "@/components/section";
import { useVisualGuide, type GuideItem } from "@/components/visual-guide";
import { useFilterContext, useOrgAttribute } from "@/hooks/filter.context";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { impactPersonas } from "@/queries/business-impact";
import {
    agentLinks, agentSummary, sapProcesses, bridgeSummary, catalogue, cellFor, d365Process, decide, discoverySources, groups, NO_PROCESS,
    peopleInProcess, setupChecks, type AgentLink, type AgentSummary, type BridgeSummary, type Decisions, type Fit, type Group, type SetupCheck, type Status,
} from "./discovery";
import { ImpactTable as Table } from "./impact-table";
import { Details, Meter, StatusMatrix, TONE_STYLE, type MatrixRow, type Tone } from "./live-visuals";

const panel = "rounded-xl border border-border bg-card p-500";
const pct = (v: number) => `${Math.round(v * 100)}%`;
const whole = (v: number) => v.toLocaleString("en-US");
const button = "rounded-md border border-border bg-card px-300 py-200 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const STATUS_STYLE: Record<Status, string> = {
    Confirmed: "border-primary bg-primary text-primary-foreground",
    Proposed: "border-dashed border-primary text-primary",
    "Needs a decision": "border-foreground text-foreground",
    "Waiting for source": "border-dashed border-border text-muted-foreground",
};

function StatusBadge({ status }: { status: Status }) {
    return <span className={cn(SMALL, "inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border px-200 py-100 font-semibold", STATUS_STYLE[status])}>{status}</span>;
}

const FIT_NOTE: Record<Fit, string> = {
    High: "Authored example: titles match the process's usual roles. Not a calculated score.",
    Medium: "Authored example: role boundaries overlap. Not a calculated score.",
    Low: "Authored example: the role only partly fits the process. Not a calculated score.",
    None: "Authored example: no process fits.",
};

function FitLabel({ fit }: { fit: Fit }) {
    return <span title={FIT_NOTE[fit]}>{fit === "None" ? "No fit" : `${fit} fit`}</span>;
}

/** Lists a visual that is not its own component in the section's info overlay. */
function Guide(item: GuideItem) {
    useVisualGuide(item);
    return null;
}

/** Everyone in the sample functions as one bar, split by how settled their group's mapping is. */
function PeopleBar({ summary }: { summary: BridgeSummary }) {
    const rest = Math.max(0, summary.scope - summary.confirmed - summary.proposed - summary.unmapped);
    const parts = [
        { label: "Confirmed", value: summary.confirmed, swatch: "bg-primary" },
        { label: "Proposed", value: summary.proposed, swatch: "bg-primary/35" },
        { label: "Needs a decision", value: summary.unmapped + rest, swatch: "bg-muted-foreground/40" },
    ];
    const share = (value: number) => summary.scope === 0 ? 0 : value / summary.scope;
    useVisualGuide({
        kind: "Stacked bar",
        title: "Where the sample people stand",
        what: "Everyone in the sample functions, split by how far their group's mapping has got.",
        how: "The whole bar is all the people. Each colour is a status, with its count underneath. It updates as you confirm groups.",
    });
    return (
        <div className={cn(panel, "flex flex-col gap-300")}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-300 gap-y-100">
                <h3 className={cn(BODY, "font-semibold")}>Where the sample people stand</h3>
                <p className={cn(SMALL, "text-muted-foreground")}>{whole(summary.scope)} people in sample functions</p>
            </div>
            <div aria-hidden="true" className="flex h-400 overflow-hidden rounded-md bg-muted">
                {parts.map(part => part.value > 0 && <div key={part.label} className={part.swatch} style={{ width: `${share(part.value) * 100}%` }} />)}
            </div>
            <dl className="grid grid-cols-1 gap-300 sm:grid-cols-3">
                {parts.map(part => (
                    <div key={part.label} className="flex flex-col gap-100">
                        <dt className={cn(SMALL, "flex items-center gap-100 text-muted-foreground")}>
                            <span aria-hidden="true" className={cn("inline-block size-[12px] shrink-0 rounded-sm", part.swatch)} />{part.label}
                        </dt>
                        <dd className="font-numeric text-[length:var(--text-500)] font-semibold tabular-nums">
                            {whole(part.value)} <span className={cn(SMALL, "font-normal text-muted-foreground")}>{pct(share(part.value))}</span>
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

/** Sample agents with a process, and how many an owner has confirmed, out of all sample agents. */
function AgentBar({ agents }: { agents: AgentSummary }) {
    useVisualGuide({
        kind: "Progress bars",
        title: "Agents linked to a process",
        what: "Sample agents with a process assigned, and how many an owner has confirmed.",
        how: "Each bar is out of all the sample agents; the figure above it gives the count.",
    });
    const rows = [["Have a process", agents.mapped], ["Confirmed by an owner", agents.confirmed]] as const;
    return (
        <div className={cn(panel, "flex flex-col gap-300")}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-300 gap-y-100">
                <h3 className={cn(BODY, "font-semibold")}>Agents linked to a process</h3>
                <p className={cn(SMALL, "text-muted-foreground")}>{agents.total} sample agents</p>
            </div>
            {rows.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-100">
                    <p className={cn(SMALL, "flex justify-between gap-200")}>
                        <span>{label}</span>
                        <span className="font-numeric font-semibold tabular-nums">{value} of {agents.total}</span>
                    </p>
                    <Meter share={agents.total === 0 ? 0 : value / agents.total} />
                </div>
            ))}
        </div>
    );
}

/** The set-up steps as a strip: a solid bar is done, a dashed one is still to do. */
function Setup({ checks }: { checks: SetupCheck[] }) {
    const done = checks.filter(check => check.done).length;
    useVisualGuide({
        kind: "Step tracker",
        title: "Ready to set up?",
        what: "The steps a real persona and agent mapping needs.",
        how: "One step per column. A solid bar on top means done; a dashed bar means still to do.",
    });
    return (
        <div className={cn(panel, "flex flex-col gap-300")}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-300 gap-y-100">
                <h3 className={cn(BODY, "font-semibold")}>Ready to set up?</h3>
                <p className={cn(SMALL, "text-muted-foreground")}>{done} of {checks.length} steps done</p>
            </div>
            <ol className="grid grid-cols-1 gap-400 sm:grid-cols-2 xl:grid-cols-4">
                {checks.map((check, index) => (
                    <li key={check.label} className={cn("flex flex-col gap-100 border-t-4 pt-200", check.done ? "border-primary" : "border-dashed border-border")}>
                        <span className={cn(SMALL, "font-semibold", check.done ? "text-primary" : "text-muted-foreground")}>Step {index + 1} · {check.done ? "Done" : "To do"}</span>
                        <p className={cn(BODY, "font-semibold")}>{check.label}</p>
                        <p className={cn(SMALL, "text-muted-foreground")}>{check.detail}</p>
                    </li>
                ))}
            </ol>
        </div>
    );
}

/** Planned inputs and the mapping rules, kept behind one disclosure. */
function SourcesAndRules({ caption }: { caption: string }) {
    return (
        <Details title="More detail: data sources and mapping rules">
            <Table caption={caption} headers={["Source", "Fields needed", "Purpose"]} rows={discoverySources.map(s => [<strong>{s.source}</strong>, s.reads, s.yields])} />
            <Rules />
        </Details>
    );
}

function Rules() {
    return (
        <div className={cn(panel, "flex flex-col gap-200")}>
            <h3 className={cn(BODY, "font-semibold")}>Rules for the planned mapping</h3>
            <ul className={cn(SMALL, "flex max-w-[90ch] list-disc flex-col gap-100 pl-500")}>
                <li>Proposals would need approval before being used in a join. Automatic discovery and persisted approvals are not implemented here.</li>
                <li>Start with teams and roles, with a minimum group size of 5. Never infer employee identity from supplier, customer or document-creator IDs.</li>
                <li><strong>Observed</strong> would mean counted from connected usage. <strong>Declared</strong> means an approved membership or process assignment. Preview counts, fit labels and statuses are all authored examples.</li>
                <li>A group that touches more than one process is counted once, under its main process.</li>
            </ul>
        </div>
    );
}

function TaskList({ tasks }: { tasks: readonly string[] }) {
    return <span>{tasks.join(", ")}</span>;
}

function GroupName({ group }: { group: Group }) {
    return (
        <div className="flex flex-col gap-100">
            <strong>{group.name}</strong>
            <span className="text-muted-foreground">{group.titles.join(", ")}</span>
        </div>
    );
}

function mapping(group: Group) {
    if (group.process) return <span><span className="text-muted-foreground">{group.persona ? "Existing persona" : "New persona"} → </span>{group.process}</span>;
    return <span className="text-muted-foreground">{group.suggestion ? `Suggested: ${group.suggestion}` : "No process fits"}</span>;
}

/** Authored sample groups illustrating a future org-data discovery workflow. */
export function DiscoveredPersonas() {
    const sap = groups.filter(g => g.scope === "sap");
    const d365 = groups.filter(g => g.scope === "d365");
    const summary = bridgeSummary(groups);
    return (
        <div className="flex flex-col gap-400">
            <div className="flex flex-col gap-200">
                <h3 className={cn(BODY, "font-semibold")}>Persona discovery preview</h3>
                <p className={cn(SMALL, "max-w-[90ch] text-muted-foreground")}>
                    These are authored sample groups, not a scan of your organisation: {whole(summary.scope)} illustrative people in {sap.length} groups. Titles, counts, fit labels and initial approval statuses are fixed examples, not calculated matches. Try the approval interaction on the <a className="font-semibold text-primary underline-offset-4 hover:underline" href="#/business-impact/impact-connect">Connect</a> page; it does not save mappings or change these groups.
                </p>
            </div>
            <PeopleBar summary={summary} />
            <Table
                caption="Authored job-title groups with assigned personas and processes. People, usage, fit and status are synthetic; no classifier or org-data scan runs here."
                headers={["Group and titles", "People", "Copilot active", "Using agents", "Top AI tasks", "Persona → process", "Match", "Status"]}
                rows={sap.map(g => [
                    <GroupName group={g} />, whole(g.people), pct(g.copilotActive), pct(g.agentUsers), <TaskList tasks={g.topTasks} />,
                    mapping(g), <FitLabel fit={g.fit} />, <StatusBadge status={g.status} />,
                ])}
            />
            <Table
                caption="Sales groups that wait for a D365 source. They are listed so the grouping is ready, and are left out of the counts above."
                headers={["Group and titles", "People", "Copilot active", "Using agents", "Top AI tasks", "Process source", "Status"]}
                rows={d365.map(g => [
                    <GroupName group={g} />, whole(g.people), pct(g.copilotActive), pct(g.agentUsers), <TaskList tasks={g.topTasks} />,
                    <span>{g.process}<span className="text-muted-foreground"> · D365, not connected</span></span>, <StatusBadge status={g.status} />,
                ])}
            />
        </div>
    );
}

const READINESS_STYLE = {
    Ready: "border-primary bg-primary text-primary-foreground",
    "Check first": "border-foreground text-foreground",
    "Not connected": "border-dashed border-border text-muted-foreground",
} as const;

/** An authored process catalogue, not an automatic source inventory. */
export function ProcessCatalogue() {
    const sap = catalogue.filter(p => p.source === "SAP");
    return (
        <div className="flex flex-col gap-400">
            <div className="flex flex-col gap-200">
                <h3 className={cn(BODY, "font-semibold")}>Business process catalogue preview</h3>
                <p className={cn(SMALL, "max-w-[90ch] text-muted-foreground")}>
                    {sap.length} authored SAP process examples, each with an invented monthly volume, plus a future D365 example. Readiness labels illustrate the checks a connected source would need; they are not results of a source scan.
                </p>
            </div>
            <Table
                caption="Process catalogue. Volumes are the invented monthly counts the scorecard below uses."
                headers={["Process", "Source", "Monthly volume", "Readiness", "Process owner", "Note"]}
                rows={catalogue.map(p => [
                    <strong>{p.name}</strong>,
                    <span>{p.source}<span className="block text-muted-foreground">{p.models}</span></span>,
                    p.volume === null ? <span className="text-muted-foreground">Not connected</span> : `${whole(p.volume)} ${p.unit}`,
                    <span className={cn(SMALL, "inline-flex w-fit whitespace-nowrap rounded-full border px-200 py-100 font-semibold", READINESS_STYLE[p.readiness])}>{p.readiness}</span>,
                    p.owner, <span className="text-muted-foreground">{p.note}</span>,
                ])}
            />
        </div>
    );
}

const COLUMNS = [...sapProcesses, d365Process, NO_PROCESS];

function cellLabel(group: Group, column: string) {
    const unit = group.people === 1 ? "person" : "people";
    const base = `${group.name}, ${column}, ${group.people} ${unit}, ${group.status}`;
    return group.status === "Confirmed" ? `${base}. Select to unconfirm` : `${base}. Select to confirm`;
}

function GridCell({ group, column, onToggle }: { group: Group; column: string; onToggle: (group: Group) => void }) {
    const cell = cellFor(group, column);
    const base = "px-200 py-200 text-center";
    if (cell === "none") return <td className={cn(base, "text-muted-foreground")}><span aria-hidden="true">·</span><span className="sr-only">Not mapped</span></td>;
    if (cell === "also") return <td className={cn(base, SMALL, "text-muted-foreground")}><span title="Also works in this process. Not counted here.">also</span></td>;
    const togglable = group.scope === "sap" && (group.status === "Confirmed" || group.status === "Proposed");
    if (!togglable) {
        const waiting = group.status === "Waiting for source";
        return (
            <td className={base}>
                <span className={cn("inline-flex min-w-14 justify-center rounded-md border border-dashed px-300 py-200 font-numeric font-semibold tabular-nums", waiting ? "border-border text-muted-foreground" : "border-foreground text-foreground")}>
                    {whole(group.people)}<span className="sr-only">, {group.name}, {group.status}</span>
                </span>
            </td>
        );
    }
    return (
        <td className={base}>
            <button
                type="button"
                aria-label={cellLabel(group, column)}
                onClick={() => onToggle(group)}
                className={cn("inline-flex min-h-10 min-w-14 items-center justify-center rounded-md border px-300 py-200 font-numeric font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", group.status === "Confirmed" ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-dashed border-primary bg-card text-primary hover:bg-primary/5")}
            >
                {whole(group.people)}
            </button>
        </td>
    );
}

function Legend() {
    const sample = "inline-flex min-w-10 justify-center rounded-md border px-200 py-100 font-numeric font-semibold tabular-nums";
    return (
        <ul className={cn(SMALL, "flex flex-wrap items-center gap-x-500 gap-y-200 text-muted-foreground")} aria-label="Legend">
            <li className="flex items-center gap-200"><span aria-hidden="true" className={cn(sample, "border-primary bg-primary text-primary-foreground")}>64</span>Confirmed. Select to unconfirm.</li>
            <li className="flex items-center gap-200"><span aria-hidden="true" className={cn(sample, "border-dashed border-primary text-primary")}>18</span>Proposed. Select to confirm.</li>
            <li className="flex items-center gap-200"><span aria-hidden="true" className={cn(sample, "border-dashed border-foreground text-foreground")}>9</span>Needs a decision from the process owner.</li>
            <li className="flex items-center gap-200"><span aria-hidden="true">also</span>Works here too. Not counted twice.</li>
        </ul>
    );
}

function AgentRow(agent: AgentLink, onToggle: (agent: AgentLink) => void) {
    const settled = agent.status === "Confirmed" || agent.status === "Proposed";
    return [
        <strong>{agent.name}</strong>,
        agent.origin,
        agent.owner || <span className="font-semibold text-destructive">None</span>,
        agent.process ?? <span className="text-muted-foreground">{agent.suggestion ? `Suggested: ${agent.suggestion}` : "No process"}</span>,
        <StatusBadge status={agent.status} />,
        settled
            ? <button type="button" className={cn(button, SMALL)} aria-label={`${agent.status === "Confirmed" ? "Unconfirm" : "Confirm"} ${agent.name}`} onClick={() => onToggle(agent)}>{agent.status === "Confirmed" ? "Unconfirm" : "Confirm"}</button>
            : <span className="text-muted-foreground">{agent.owner ? "Choose a process" : "Needs an owner first"}</span>,
        <span className="text-muted-foreground">{agent.note}</span>,
    ];
}

/** Where a person approves what discovery proposed. The choices live on this page only. */
export function ConnectStage() {
    const [decisions, setDecisions] = useState<Decisions>({});
    const list = decide(groups, decisions);
    const agentList = decide(agentLinks, decisions);
    const summary = bridgeSummary(list);
    const agents = agentSummary(agentList);
    const sap = list.filter(g => g.scope === "sap");
    const d365 = list.filter(g => g.scope === "d365");
    const unassigned = sap.filter(g => g.process === null).reduce((n, g) => n + g.people, 0);
    const toggle = (item: { id: string; status: Status }) => setDecisions(d => ({ ...d, [item.id]: item.status === "Confirmed" ? "Proposed" : "Confirmed" }));
    const changed = Object.keys(decisions).length > 0;
    return (
        <Section id={stageAnchor("impact-connect")} title="Connect personas to processes" description="Try confirming the authored sample assignments. Confirm changes only this page's temporary status and totals; it does not discover people, save a mapping, unlock another page or join live data.">
            <div className="grid grid-cols-1 items-stretch gap-400 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <PeopleBar summary={summary} />
                <AgentBar agents={agents} />
            </div>
            <div className="flex flex-col gap-300">
                <Guide
                    kind="Interactive grid"
                    title="Which group works in which process"
                    what="Each sample group, placed under the process it mainly works in."
                    how="A number is the people in that group. A solid number is confirmed; a dashed one is proposed: select it to confirm or undo. 'also' marks a second process, not counted twice. The bottom row totals each process."
                />
                <div className="flex flex-wrap items-end justify-between gap-300">
                    <h3 className={cn(BODY, "font-semibold")}>Which group works in which process</h3>
                    {changed && <button type="button" className={cn(button, SMALL)} onClick={() => setDecisions({})}>Reset sample choices</button>}
                </div>
                <div role="region" aria-label="Persona to process grid, scrolls sideways on a narrow screen" tabIndex={0} className="overflow-x-auto rounded-xl border border-border bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <table className={cn(SMALL, "w-full min-w-[60rem] border-collapse text-left")}>
                        <caption className="sr-only">Number of people in each group, by business process. Select a number to confirm or unconfirm the group.</caption>
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th scope="col" className="sticky left-0 z-10 w-44 bg-muted p-300 font-semibold sm:w-64">Group</th>
                                {COLUMNS.map(c => <th scope="col" key={c} className="w-28 px-200 py-300 text-center align-bottom font-semibold">{c === d365Process ? `${c} (D365, later)` : c}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {sap.map(g => (
                                <tr key={g.id} className="border-t border-border">
                                    <th scope="row" className="sticky left-0 z-10 bg-card p-300 text-left font-normal">
                                        <strong>{g.name}</strong>
                                        <span className="block text-muted-foreground">{g.suggestion ? `Suggested: ${g.suggestion}, ${g.fit.toLowerCase()} match` : g.note}</span>
                                    </th>
                                    {COLUMNS.map(c => <GridCell key={c} group={g} column={c} onToggle={toggle} />)}
                                </tr>
                            ))}
                        </tbody>
                        <tbody>
                            <tr className="border-t border-border bg-muted"><th scope="rowgroup" colSpan={COLUMNS.length + 1} className="sticky left-0 p-300 text-left font-semibold text-muted-foreground">Waiting for D365</th></tr>
                            {d365.map(g => (
                                <tr key={g.id} className="border-t border-border">
                                    <th scope="row" className="sticky left-0 z-10 bg-card p-300 text-left font-normal">
                                        <strong>{g.name}</strong>
                                        <span className="block text-muted-foreground">{g.note}</span>
                                    </th>
                                    {COLUMNS.map(c => <GridCell key={c} group={g} column={c} onToggle={toggle} />)}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-border bg-muted font-semibold">
                                <th scope="row" className="sticky left-0 z-10 bg-muted p-300 text-left">People in each process</th>
                                {COLUMNS.map(c => (
                                    <td key={c} className="px-200 py-300 text-center font-numeric tabular-nums">
                                        {c === d365Process ? <span className="text-muted-foreground">Not counted</span> : whole(c === NO_PROCESS ? unassigned : peopleInProcess(list, c))}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <Legend />
                <p role="status" className={cn(SMALL, "text-muted-foreground")}>
                    {whole(summary.confirmed)} of {whole(summary.scope)} people are in a confirmed group; {summary.toReview} {summary.toReview === 1 ? "group still needs" : "groups still need"} a review. Choices on this page are a demonstration and are not saved.
                </p>
            </div>
            <div className="flex flex-col gap-300">
                <h3 className={cn(BODY, "font-semibold")}>Which process each agent serves</h3>
                <Table
                    caption="Sample agents have explicit process assignments. Initial Confirmed status is seeded from a non-empty owner field, not evidence of a real approval or a run-to-document link."
                    headers={["Agent", "Origin", "Owner", "Process", "Status", "Action", "Note"]}
                    rows={agentList.map(a => AgentRow(a, toggle))}
                />
            </div>
            <Setup checks={setupChecks(summary, agents)} />
            <SourcesAndRules caption="Planned inputs for real discovery. This preview reads local fixtures instead." />
        </Section>
    );
}

const INPUT_NEEDS = {
    persona: "Proposed impact_persona_map: approved title or role rules with organisation scope. No importer is wired yet.",
    scope: "Proposed impact_org_map: source system, company and cost centre or purchasing group to DataHub org, with effective dates. No importer is wired yet.",
    person: "Needs the customer's SAP-user list and a privacy review. Not used here.",
};

/** The connected build starts with no approved list, so it says what is missing rather than showing people. */
export function LiveDiscoveredPersonas() {
    const org = useOrgAttribute();
    const { orgAttributes } = useFilterContext();
    const orgNeed = `Used elsewhere in DataHub, not yet for persona membership. ${orgAttributes.length > 1 ? `${orgAttributes.length} attributes are available in Group by.` : "Choose another attribute in Group by."}`;
    const inputs: readonly { label: string; state: string; tone: Tone }[] = [
        { label: "Org data attribute", state: `Selected: ${org.label}`, tone: "partial" },
        { label: "Job title → persona list", state: "Not configured", tone: "missing" },
        { label: "Team → process scope", state: "Not configured", tone: "missing" },
        { label: "Person-level mapping", state: "Off", tone: "missing" },
    ];
    useVisualGuide({
        kind: "Status tiles",
        title: "Persona mapping is not configured",
        what: "The four inputs persona grouping needs, and where each stands in this connection.",
        how: "One tile per input. A tinted pill is partly in place; a dashed pill is not set up yet. 'More detail' says what each one needs.",
    });
    return (
        <div className={cn(panel, "flex flex-col gap-300")}>
            <h3 className={cn(BODY, "font-semibold")}>Persona mapping is not configured</h3>
            <p className={cn(SMALL, "max-w-[90ch] text-muted-foreground")}>
                The six roles below are authored templates, not grouped people. Mapping import and saved approvals are not built yet, so headcount, adoption and time stay withheld. The <a className="font-semibold text-primary underline-offset-4 hover:underline" href="#/business-impact/impact-connect">Connect</a> page lists the requirements, not a working setup form.
            </p>
            <ul aria-label="Persona mapping inputs" className="grid grid-cols-1 gap-300 sm:grid-cols-2 xl:grid-cols-4">
                {inputs.map(input => (
                    <li key={input.label} className="flex flex-col gap-200 rounded-lg border border-border p-300">
                        <span className={cn(SMALL, "text-muted-foreground")}>{input.label}</span>
                        <span className={cn(SMALL, "inline-flex w-fit items-center rounded-full border px-200 py-100 font-semibold", TONE_STYLE[input.tone])}>{input.state}</span>
                    </li>
                ))}
            </ul>
            <Details title="More detail: what each input needs">
                <Table
                    caption="What discovery needs, and where it stands in this connection."
                    headers={["Input", "State", "What is needed"]}
                    rows={[
                        ["Org data attribute", `Selected: ${org.label}`, orgNeed],
                        ["Job title to persona list", "Not configured", INPUT_NEEDS.persona],
                        ["Team to process scope", "Not configured", INPUT_NEEDS.scope],
                        ["Person-level mapping", "Off", INPUT_NEEDS.person],
                    ]}
                />
            </Details>
        </div>
    );
}

/** The connected Connect page: the declared lists, all unset, and what would fill them. */
export function LiveConnectStage() {
    const org = useOrgAttribute();
    const checks: SetupCheck[] = [
        { label: "Group people by an org attribute", done: false, detail: `${org.label} is selected in DataHub. Persona grouping and its minimum group size are not built yet.` },
        { label: "Approve the persona list", done: false, detail: "Not configured. Planned table: impact_persona_map, title or role plus org scope to persona." },
        { label: "Approve the agent-to-process list", done: false, detail: "Not configured. Planned table: impact_agent_process_map, agent ID to process with an owner. A name match is not evidence." },
        { label: "Keep person-level mapping off", done: true, detail: "Team and role only. Person-level needs the customer's list and a privacy review." },
    ];
    const rows: MatrixRow[] = impactPersonas.map(p => ({
        label: p.process,
        sub: p.name,
        cells: [
            { state: "Template", tone: "partial", detail: "Authored role template. No members yet." },
            { state: "Not mapped", tone: "missing", detail: "Needs an approved persona list." },
            { state: "Not mapped", tone: "missing", detail: "Needs an approved agent-to-process list." },
            { state: "Not declared", tone: "missing", detail: "Needs a named process owner." },
        ],
    }));
    return (
        <Section id={stageAnchor("impact-connect")} title="Connect personas to processes" description="This page describes the planned mapping workflow. Automatic discovery, mapping-table ingestion and saved approvals are not implemented in this connection. No people or agents are mapped to a process.">
            <StatusMatrix
                title="Nothing is mapped yet"
                subtitle="Six role templates, one per SAP process. People, agents and owners need approved lists first."
                columns={["Role template", "People", "Agents", "Process owner"]}
                rows={rows}
            />
            <Setup checks={checks} />
            <SourcesAndRules caption="Planned inputs for persona and agent mappings. This page does not query these inputs." />
        </Section>
    );
}
