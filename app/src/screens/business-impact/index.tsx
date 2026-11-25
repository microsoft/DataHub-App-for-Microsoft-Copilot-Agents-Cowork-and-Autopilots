//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { stageAnchor, type StageId } from "@/components/destinations";
import { StageRun } from "@/components/stage-detail";
import { LineOfSight, SurfaceMap } from "@/components/line-of-sight";
import { Section } from "@/components/section";
import { useStageFilter } from "@/hooks/stage-filter.context";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { businessImpactLive, outcomeSamplesOn } from "@/lib/optional-modules";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { Chart } from "../cross-vendor/insights";
import { ConnectStage, DiscoveredPersonas, ProcessCatalogue } from "./discovery-view";
import { ImpactTable as Table } from "./impact-table";
import { IMPACT_HINTS } from "./hints";
import { AgentMeasurement } from "./impact-lineage";
import { LiveBusinessImpactScreen } from "./live";
import { delta, EVIDENCE_MEANING, money, num, pct, READ_STYLE, signed, whole } from "./format";
import {
    attributableChange, availabilityMeaning, costToServe, coverage, dataContract, d365SalesPreview, headlineMeasures, measureFor, observedChange, opportunities, personaJoins, personas,
    personaTaskMix, processAgents, processScorecard, readMeasure, readinessChecks, scenarioRange, teamScatter, throughputFor, type Availability, type Evidence,
} from "./scenario";
import {
    AgentLanes, AgentOutcomeDumbbell, AgentReadiness, AgentSessionsCases, ApTrend, AvailabilityBadge, AvailabilityByProcess, Chips, CoverageBars, CostPerCase, CostStack, Dumbbells,
    EvidenceBadge, EvidenceLadder, OutcomeLollipop, PersonaAdoption, PersonaHours, ProcessIntervals, ProcessKindHeatmap, ReadScoreboard, StepFlow,
    ValueStrip, panel,
} from "./visuals";

const SampleExplorer = lazy(() => import("./outcome-explorer"));
const qualityChecks = processScorecard.filter(m => m.kind === "Quality check");
const estHours = personas.reduce((sum, p) => sum + p.people * p.estHoursPerPerson, 0);
const link = "font-semibold text-primary underline-offset-4 hover:underline";

const TASK_SHORT: Record<string, string> = {
    "Data & Analysis": "Data", "Document Summarisation": "Summary", "Document Creation": "Drafting", "Search & Research": "Search", Presentations: "Slides", "Specialist Support": "Support",
};
const taskMix = personaTaskMix.map(r => ({ ...r, Label: TASK_SHORT[r.Task] ?? r.Task }));
const TASK_LABELS = [...new Set(taskMix.map(r => r.Label))];
const SHORT_ROLE: Record<string, string> = {
    "Accounts payable specialist": "AP specialist", "Collections specialist": "Collections", "Financial controller": "Controller", "Category manager": "Category mgr", "Sales operations analyst": "Sales ops",
};

/** Prose and tables stay one click away, so each stage leads with a picture. */
function Details({ title, children }: { title: string; children: ReactNode }) {
    return (
        <details className={SMALL}>
            <summary className="w-fit cursor-pointer font-semibold">{title}</summary>
            <div className="mt-300 flex flex-col gap-400">{children}</div>
        </details>
    );
}

function D365Preview() {
    return (
        <section aria-label="D365 Sales preview" className={cn(panel, "flex flex-col gap-300")}>
            <div className="flex flex-wrap items-center gap-200">
                <h3 className={cn(BODY, "font-semibold")}>D365 Sales: a second optional source</h3>
                <span className={cn(SMALL, "rounded-full border border-border bg-muted px-300 py-100 text-muted-foreground")}>Separate cohort</span>
            </div>
            <Dumbbells
                legend={["start", "end"]}
                rows={d365SalesPreview.map(m => ({ label: m.measure, sub: m.persona, unit: m.unit, points: [{ name: "Before", value: m.baseline, tone: "start" }, { name: "After", value: m.current, tone: "end" }] }))}
            />
            <p className={cn(SMALL, "text-muted-foreground")}>Illustrative observed changes, 12 weeks before vs after: no comparison group, no attribution claim and no D365 connection.</p>
            <Details title="Definitions and how D365 would connect">
                <dl className="flex flex-col gap-200">
                    {d365SalesPreview.map(m => <div key={m.measure}><dt className="font-semibold">{m.measure}</dt><dd className="text-muted-foreground">{m.definition}</dd></div>)}
                </dl>
                <p className="text-muted-foreground">D365 would use its own Dataverse adapter, separate from SAP ingestion. It is not part of the SAP scorecard totals.</p>
            </Details>
        </section>
    );
}

function BottomLine() {
    return (
        <Section id={stageAnchor("impact-summary")} title="From usage to business outcomes" description="Did business processes get faster, cheaper or better where people use AI?">
            <Chips items={["Synthetic SAP scenario", "12 weeks before vs after rollout", "Simulated effects, not proof AI caused them"]} />
            <ApTrend />
            <div className="grid gap-400 lg:grid-cols-2">
                <OutcomeLollipop />
                <ReadScoreboard />
            </div>
            <EvidenceLadder />
            <D365Preview />
            <Details title={`Table: the ${headlineMeasures.length} headline measures and how each is read`}>
                <Table
                    caption="“Beyond comparison” subtracts the change in a team not yet rolled out. Availability says how a measure would be read from the process data: Computed from source fields, Proxy (indirect or team-level), or Needs source."
                    headers={["Measure", "Process", "Before", "After", "Beyond comparison (90%)", "Read", "Availability", "Basis"]}
                    rows={headlineMeasures.map(m => [
                        <strong>{m.measure}</strong>, m.process, num(m.baseline, m.unit), num(m.current, m.unit),
                        `${delta(attributableChange(m), m.unit)} ±${num(m.interval, m.unit === "%" ? "pts" : m.unit)}`,
                        <span className={READ_STYLE[readMeasure(m)]}>{readMeasure(m)}</span>,
                        <AvailabilityBadge level={m.availability} basis={m.basis} />, <span className="text-muted-foreground">{m.basis}</span>,
                    ])}
                />
            </Details>
            <div className={cn(SMALL, "flex flex-wrap gap-x-600 gap-y-200")}>
                <a href="#/business-impact/impact-processes" className={link}>Explore all {processScorecard.length} process measures</a>
                <a href="#/business-impact/impact-personas" className={link}>See the functional personas</a>
                <a href="#/business-impact/impact-agents" className={link}>Trace agents to business outcomes</a>
                <a href="#/value/estimated-value" className={link}>Compare with estimated value</a>
            </div>
        </Section>
    );
}

function Personas() {
    return (
        <Section id={stageAnchor("impact-personas")} title="Functional personas" description="Who does the work, the process each role owns, and how its outcome moved.">
            <Chips items={["Roles are authored examples", "Groups of 5 or more people only"]} />
            <div className="grid gap-400 lg:grid-cols-2">
                <PersonaAdoption />
                <PersonaHours />
            </div>
            <div className="grid gap-400 lg:grid-cols-[3fr_2fr]">
                <Chart
                    title="What each persona uses AI for"
                    subtitle="Share of each persona's Copilot and agent tasks, last 30 days"
                    rows={taskMix}
                    height={340}
                    spec={{
                        encoding: { x: { field: "Label", type: "nominal", title: null, sort: TASK_LABELS, axis: { orient: "top", labelAngle: 0, labelLimit: 80, labelFontSize: 10 } }, y: { field: "Persona", type: "nominal", title: null, sort: null, axis: { labelLimit: 180 } } },
                        layer: [
                            { mark: { type: "rect", stroke: "white", strokeWidth: 1 }, encoding: { color: { field: "Share", type: "quantitative", legend: null, scale: { scheme: "blues" } }, tooltip: [{ field: "Persona" }, { field: "Task" }, { field: "Share", type: "quantitative", format: ".0%" }] } },
                            { mark: { type: "text", fontSize: 11 }, encoding: { text: { field: "Share", type: "quantitative", format: ".0%" }, color: { condition: { test: "datum['Share'] > 0.2", value: "white" }, value: "black" } } },
                        ],
                    }}
                />
                <Chart
                    title="Teams using agents improved more"
                    subtitle="Each dot is a team. Correlation, not cause."
                    rows={teamScatter().map(r => ({ ...r, Role: SHORT_ROLE[r.Persona] ?? r.Persona }))}
                    height={340}
                    spec={{
                        mark: { type: "circle", opacity: 0.8 },
                        encoding: {
                            x: { field: "AgentAdoption", type: "quantitative", title: "People using agents", axis: { format: ".0%" } },
                            y: { field: "Improvement", type: "quantitative", title: "KPI improvement", axis: { format: ".0%" } },
                            color: { field: "Role", type: "nominal", title: null, legend: { orient: "bottom", columns: 3, labelLimit: 110, symbolLimit: 20 } },
                            size: { field: "People", type: "quantitative", legend: null },
                            tooltip: [{ field: "Team" }, { field: "AgentAdoption", title: "Using agents", type: "quantitative", format: ".0%" }, { field: "Improvement", type: "quantitative", format: ".1%" }, { field: "People", type: "quantitative" }],
                        },
                    }}
                />
            </div>
            <Details title="Table: personas, top tasks and the outcome each owns">
                <Table
                    caption={`The Value page's measures by persona, with the business outcome each persona owns. ${whole(Math.round(estHours))} expert-equivalent hours a month in total: an estimate, not a saving.`}
                    headers={["Persona", "Process", "People", "Using agents", "Habit (weekly 3+ days)", "Top AI tasks", "Expert-equivalent hours a month", "Business outcome", "Evidence"]}
                    rows={personas.map(p => {
                        const throughput = throughputFor(p);
                        return [
                            <strong>{p.name}</strong>, p.process, whole(p.people), pct(p.agentUsers), pct(p.habit), p.topTasks.join(", "),
                            `${whole(Math.round(p.people * p.estHoursPerPerson))} h (${p.estHoursPerPerson} h each)`,
                            <>{p.kpi}: {delta(attributableChange(p), p.unit)} beyond comparison{throughput && <span className="block text-muted-foreground">{throughput.measure}: {whole(throughput.baseline)} → {whole(throughput.current)}</span>}</>,
                            <EvidenceBadge level={p.evidence} />,
                        ];
                    })}
                />
            </Details>
            <Details title="Persona discovery: how roles would be found">
                <DiscoveredPersonas />
            </Details>
        </Section>
    );
}

function Processes() {
    return (
        <Section id={stageAnchor("impact-processes")} title="Process outcomes" description="Change after rollout, less the change in a group not yet rolled out.">
            <ProcessIntervals />
            <div className="grid gap-400 lg:grid-cols-2">
                <ProcessKindHeatmap />
                <AvailabilityByProcess />
            </div>
            <Details title="Table: each persona's business KPI">
                <Table
                    caption="Business KPI by process: 12 weeks before vs 12 weeks after rollout. Comparison groups are matched on process, region and baseline volume."
                    headers={["Process", "KPI", "Before", "After", "Change", "Comparison group", "Attributable (90%)", "Evidence"]}
                    rows={personas.map(p => [
                        <><strong>{p.process}</strong><p className="text-muted-foreground">{p.name}</p></>,
                        p.kpi, num(p.baseline, p.unit), num(p.current, p.unit), signed(observedChange(p), p.unit), signed(p.comparisonChange, p.unit),
                        `${signed(attributableChange(p), p.unit)} ±${num(p.interval, p.unit)}`,
                        <EvidenceBadge level={p.evidence} />,
                    ])}
                />
            </Details>
            <Details title={`Table: all ${processScorecard.length} process measures`}>
                <Table
                    caption="Speed, throughput and cash measures count only when they improve beyond the comparison group. Quality checks only need to hold: they show faster work has not meant more errors. “How computed” describes the source fields each measure would use."
                    headers={["Process", "Type", "Measure", "Availability", "How computed", "Before", "After", "Attributable (90%)", "Read"]}
                    rows={processScorecard.map(m => {
                        const read = readMeasure(m);
                        return [m.process, m.kind, m.measure, <AvailabilityBadge level={m.availability} />, <span className="text-muted-foreground">{m.basis}</span>, num(m.baseline, m.unit), num(m.current, m.unit), `${delta(attributableChange(m), m.unit)} ±${num(m.interval, m.unit === "%" ? "pts" : m.unit)}`, <span className={READ_STYLE[read]}>{read}</span>];
                    })}
                />
            </Details>
            <Details title="Process catalogue: how processes would be found">
                <ProcessCatalogue />
            </Details>
        </Section>
    );
}

function Fact({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
    return (
        <li title={title} className={cn(SMALL, "flex items-baseline gap-200 rounded-full border border-border bg-muted px-300 py-100")}>
            <span className="text-muted-foreground">{label}</span><span className="font-semibold">{children}</span>
        </li>
    );
}

function Agents() {
    const [selected, setSelected] = useState(0);
    const agent = processAgents[selected];
    const persona = personas.find(p => p.id === agent.persona)!;
    const measure = measureFor(persona);
    const quality = qualityChecks.filter(m => m.process === agent.process);
    return (
        <Section id={stageAnchor("impact-agents")} title="Agents & automation" description="Which agent changes which process step, for which persona, and with what business result?">
            <Chips items={["Synthetic mapping preview", "Intended modes, not observed autonomy", "Process change is not an agent's own effect"]} />
            <AgentLanes selected={selected} onSelect={setSelected} />
            <section aria-label="Selected agent" className={cn(panel, "flex flex-col gap-300")}>
                {measure ? <>
                    <h3 className={cn(BODY, "font-semibold")}>{measure.measure}</h3>
                    <AgentOutcomeDumbbell measure={measure} />
                    <p className={cn(SMALL, "text-muted-foreground")}>Simulated process-level comparison, not this agent's causal effect. Agent and Copilot contributions are not separately identified.</p>
                </> : <p role="alert" className={SMALL}>No process outcome is mapped to this agent's persona. Review the scenario mapping.</p>}
                <ul aria-label={`${agent.name}: mapping facts`} className="flex flex-wrap gap-200">
                    <Fact label="Intended mode" title="Actual intervention history is not available.">{agent.mode}</Fact>
                    <Fact label="Owner">{agent.owner || "Missing owner - mapping needs review"}</Fact>
                    <Fact label="Review">{agent.review}</Fact>
                    <Fact label="Case evidence" title="Linked cases come from the synthetic last-30-days sample. They are not a count of autonomous or successful completions, and sit apart from the 12-week outcome comparison.">
                        {agent.linkedCases === undefined ? "Not instrumented." : `${whole(agent.linkedCases)} linked cases`}
                    </Fact>
                </ul>
                {quality.length > 0 && (
                    <ul aria-label="Quality guardrails" className={cn(SMALL, "flex flex-wrap items-baseline gap-200")}>
                        <li className="text-muted-foreground">Read alongside speed and cost:</li>
                        {quality.map(m => <li key={m.measure} className="rounded-full border border-border px-300 py-100">{m.measure}</li>)}
                    </ul>
                )}
            </section>
            <div className="grid gap-400 lg:grid-cols-2">
                <AgentReadiness />
                <AgentSessionsCases />
            </div>
            <AgentMeasurement />
            <Details title="Table: usage, ownership and review for all scenario agents">
                <Table
                    caption="Synthetic last 30 days. Credits illustrate consumption data; linked cases illustrate runs carrying a document or case ID. Process templates here are illustrative agent concepts, not agents installed by DataHub."
                    headers={["Agent", "Origin", "Process", "Sessions", "Session resolution", "Credits", "Linked cases", "Owner", "Review"]}
                    rows={processAgents.map(a => [
                        <strong>{a.name}</strong>, a.origin, a.process, whole(a.sessions), pct(a.resolution), whole(a.credits),
                        a.linkedCases ? whole(a.linkedCases) : <span className="text-muted-foreground">Not instrumented</span>,
                        a.owner || <span className="font-semibold text-destructive">None</span>,
                        <span className={a.review === "Up to date" ? "" : "font-semibold text-destructive"}>{a.review}</span>,
                    ])}
                />
            </Details>
            <Details title="Beyond agents: Autopilots, Cowork and Copilot">
                <p className="max-w-[90ch] text-muted-foreground">Agents and Autopilots can be mapped to a process one by one. Cowork and Copilot work for a person, so they join through that person's team and the use-case table, and show a contribution to the process rather than a share of it. An approved agent-to-process mapping would connect usage to the same governance, evaluation and cost views as other agents.</p>
                <SurfaceMap />
            </Details>
        </Section>
    );
}

function CostPerTransaction() {
    const rows = costToServe();
    return (
        <Section id={stageAnchor("impact-cost")} title="Cost per transaction" description="AI cost per business transaction. Value categories stay separate because they are different kinds of money.">
            <div className="grid gap-400 lg:grid-cols-2">
                <CostStack />
                <CostPerCase />
            </div>
            <ValueStrip />
            <Details title="Table: cost to serve by process">
                <Table
                    caption="Monthly scenario. Agent cost uses the scenario credit price; licence cost is the persona's share of Copilot licences. Linked cases are not verified successful completions. A session-resolution rate cannot supply that denominator."
                    headers={["Process", "Agent", "Agent cost", "Licence cost", "Document volume", "AI cost per transaction", "Agent cost per linked case"]}
                    rows={rows.map(r => [r.process, r.agent, money(r.agentCost), money(r.licenceCost), whole(r.volume), money(r.costPerTransaction), r.costPerLinkedCase === undefined ? <span className="text-muted-foreground">Needs case IDs</span> : money(r.costPerLinkedCase)])}
                />
            </Details>
        </Section>
    );
}

function Opportunities() {
    const top = opportunities[0];
    return (
        <Section id={stageAnchor("impact-opportunities")} title="Where to go next" description="High-volume processes furthest from target, with low agent adoption: the best next places for AI.">
            <Chart
                title={`${top.process} is the biggest gap: ${pct(top.gap)} from target, ${pct(top.agentAdoption)} using agents`}
                subtitle="Gap to the process target against people using agents. Bubble size is monthly volume. Top left is the opportunity."
                rows={opportunities.map(o => ({ Process: o.process, Gap: o.gap, Adoption: o.agentAdoption, Volume: o.volume, Priority: o.priority }))}
                height={340}
                spec={{
                    layer: [
                        { mark: { type: "circle", opacity: 0.75 }, encoding: { x: { field: "Adoption", type: "quantitative", title: "People using agents", axis: { format: ".0%" }, scale: { domain: [0, 0.8] } }, y: { field: "Gap", type: "quantitative", title: "Gap to target", axis: { format: ".0%" } }, size: { field: "Volume", type: "quantitative", legend: null, scale: { range: [80, 1600] } }, color: { field: "Priority", type: "nominal", sort: ["High", "Medium", "Low"], legend: { orient: "top" } }, tooltip: [{ field: "Process" }, { field: "Gap", type: "quantitative", format: ".0%" }, { field: "Adoption", type: "quantitative", format: ".0%" }, { field: "Volume", type: "quantitative", format: "," }] } },
                        { mark: { type: "text", dy: -24, fontSize: 11 }, encoding: { x: { field: "Adoption", type: "quantitative", title: "People using agents", axis: { format: ".0%" }, scale: { domain: [0, 0.8] } }, y: { field: "Gap", type: "quantitative", title: "Gap to target", axis: { format: ".0%" } }, text: { field: "Process" } } },
                    ],
                }}
            />
            <Details title="Table: ranked next steps">
                <Table
                    caption="Ranked by gap, volume and adoption headroom."
                    headers={["Priority", "Process", "Persona", "Monthly volume", "Gap to target", "Using agents", "Suggested next step"]}
                    rows={opportunities.map(o => [<strong>{o.priority}</strong>, o.process, o.persona, whole(o.volume), pct(o.gap), pct(o.agentAdoption), o.candidate])}
                />
            </Details>
        </Section>
    );
}

function Method() {
    const availabilityLevels = Object.keys(availabilityMeaning) as Availability[];
    const countOf = (level: Availability) => processScorecard.filter(m => m.availability === level).length;
    return (
        <Section id={stageAnchor("impact-method")} title="Data and method" description="An optional DataHub Business impact module concept with SAP and D365 input routes. Both are off by default; the rest of DataHub is unchanged.">
            <Chips items={[`Every number is synthetic (${scenarioRange})`, "No SAP or D365 connection", "D365 is a separate cohort", `${processScorecard.length} measures across ${personas.length} processes`]} />
            <StepFlow />
            <CoverageBars />
            <LineOfSight detailed scenario current={["process", "impact"]} />
            <Details title="Scope and caveats">
                <p className="max-w-[90ch] text-muted-foreground">No SAP system, D365 environment or tenant data is connected. Source areas and fields are illustrative: confirm availability and population against your deployment. D365 sales examples are a separate cohort and are not included in the SAP scorecard totals. App-wide date and org filters do not apply to these fixed scenarios. Simulated refresh: {coverage.processRefreshed}. Source ingestion in the DataHub installer is planned, not implemented here; the Connect preview only changes local sample statuses.</p>
            </Details>
            <Details title="Table: proposed source and mapping contract">
                <Table
                    caption="Proposed source and mapping contract. Ingestion and mapping tables are not implemented here."
                    headers={["Source", "Table", "Grain", "Used for"]}
                    rows={dataContract.map(d => [d.source, <code>{d.table}</code>, d.grain, d.use])}
                />
                <Table
                    caption="How process outcomes could join to people. SAP user and personnel numbers are not UPNs, so start with an approved team-level mapping."
                    headers={["Level", "Join", "What it shows", "Needs"]}
                    rows={personaJoins.map(j => [<strong>{j.level}</strong>, j.join, j.shows, j.needs])}
                />
                <Table
                    caption="Readiness checks before trusting a process measure."
                    headers={["Check", "Why it matters"]}
                    rows={readinessChecks.map(r => [<strong>{r.check}</strong>, r.why])}
                />
            </Details>
            <Details title="Reading the evidence">
                <ul className="flex list-disc flex-col gap-100 pl-500">
                    {availabilityLevels.map(level => <li key={level}><strong>{level} ({countOf(level)} of {processScorecard.length}):</strong> {availabilityMeaning[level]}</li>)}
                    {(Object.keys(EVIDENCE_MEANING) as Evidence[]).map(level => <li key={level}><strong>{level}:</strong> {EVIDENCE_MEANING[level]}</li>)}
                    <li>Persona and team views report groups of at least 5 people, so no individual's output is shown next to their AI use.</li>
                    <li>Process KPIs also move with volume, staffing, policy and season. A comparison group removes shared changes, not changes unique to the pilot team.</li>
                </ul>
            </Details>
        </Section>
    );
}

export function BusinessImpactScreen() {
    const { show } = useStageFilter();
    const live = businessImpactLive();
    const demo = import.meta.env.VITE_BUSINESS_IMPACT_DEMO === "true";
    if (!live && !demo) return <p className={BODY}>The Business impact preview is not enabled for this build.</p>;
    const samples = outcomeSamplesOn() && show("impact-samples") &&
        <Suspense fallback={<p role="status" className={SMALL}>Loading public reference data…</p>}><SampleExplorer /></Suspense>;
    if (samples && !show("impact-summary")) return samples;
    if (live) return <><LiveBusinessImpactScreen />{samples}</>;
    const stages: [StageId, () => React.JSX.Element][] = [
        ["impact-summary", BottomLine], ["impact-personas", Personas], ["impact-processes", Processes], ["impact-connect", ConnectStage], ["impact-agents", Agents],
        ["impact-cost", CostPerTransaction], ["impact-opportunities", Opportunities], ["impact-method", Method],
    ];
    return (
        <div className="flex flex-col gap-600">
            <StageRun stages={stages} hints={IMPACT_HINTS} open={["impact-processes", "impact-cost"]} />
            {samples}
        </div>
    );
}
