//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { stageAnchor, type StageId } from "@/components/destinations";
import { KpiCard } from "@/components/kpi-card";
import { Section } from "@/components/section";
import { useStageFilter } from "@/hooks/stage-filter.context";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { Chart } from "../cross-vendor/insights";
import {
    apTrend, attributableChange, availabilityMeaning, benefitLadder, costToServe, coverage, dataContract, d365SalesPreview, financialCategories, headlineMeasures, improvement,
    isConclusive, measureFor, measureKinds, observedChange, opportunities, personaJoins, personas, personaTaskMix, processAgents, processScorecard,
    readMeasure, readinessChecks, rolloutDate, scenarioRange, teamScatter, throughputFor, type Availability, type Evidence, type MeasureRead, type Persona, type ProcessMeasure,
} from "./scenario";

const panel = "rounded-xl border border-border bg-card p-500";
const pct = (v: number) => `${Math.round(v * 100)}%`;
const whole = (v: number) => v.toLocaleString("en-US");
const num = (v: number, unit: string) => `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}${unit === "%" ? "%" : ` ${unit}`}`;
const signed = (v: number, unit: string) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v), unit)}`;
/** Changes in a percentage are percentage points. */
const delta = (v: number, unit: string) => signed(v, unit === "%" ? "pts" : unit);
const money = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v < 10 ? 2 : 0 });

const EVIDENCE_STYLE: Record<Evidence, string> = {
    Estimated: "border-border bg-muted text-muted-foreground",
    Observed: "border-primary/40 bg-card text-primary",
    Attributable: "border-primary bg-primary text-primary-foreground",
};

const EVIDENCE_MEANING: Record<Evidence, string> = {
    Estimated: "DataHub's behaviour-based estimate. A planning figure.",
    Observed: "A before/after change in a process KPI. Not proof Copilot caused it. All values in this preview are synthetic.",
    Attributable: "A comparison-adjusted estimate with an interval, subject to study assumptions. Simulated here, not causal proof.",
};

function EvidenceBadge({ level }: { level: Evidence }) {
    return <span title={EVIDENCE_MEANING[level]} className={cn(SMALL, "inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border px-200 py-100 font-semibold", EVIDENCE_STYLE[level])}>{level}</span>;
}

const AVAILABILITY_STYLE: Record<Availability, string> = {
    Computed: "border-primary/40 text-primary",
    Proxy: "border-border text-foreground",
    "Needs source": "border-border text-muted-foreground",
};

function AvailabilityBadge({ level, basis }: { level: Availability; basis?: string }) {
    return <span title={basis ?? availabilityMeaning[level]} className={cn(SMALL, "inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border px-200 py-100", AVAILABILITY_STYLE[level])}>{level}</span>;
}

function Table({ caption, headers, rows }: { caption: string; headers: string[]; rows: React.ReactNode[][] }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className={cn(SMALL, "w-full text-left")}>
                <caption className="p-400 text-left text-muted-foreground">{caption}</caption>
                <thead className="bg-muted text-muted-foreground"><tr>{headers.map(h => <th scope="col" key={h} className="p-400 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{rows.map((cells, i) => <tr key={i} className="border-t border-border">{cells.map((c, j) => <td key={j} className="p-400 align-top">{c}</td>)}</tr>)}</tbody>
            </table>
        </div>
    );
}

const people = personas.reduce((sum, p) => sum + p.people, 0);
const agentSessions = processAgents.reduce((sum, a) => sum + a.sessions, 0);
const outcomes = processScorecard.filter(m => m.kind !== "Quality check");
const qualityChecks = processScorecard.filter(m => m.kind === "Quality check");
const improved = outcomes.filter(m => readMeasure(m) === "Improved").length;
const qualityHeld = qualityChecks.filter(m => readMeasure(m) !== "Worse").length;
const estHours = personas.reduce((sum, p) => sum + p.people * p.estHoursPerPerson, 0);

const READ_STYLE: Record<MeasureRead, string> = {
    Improved: "font-semibold text-primary",
    "Not conclusive": "text-muted-foreground",
    Held: "font-semibold",
    Worse: "font-semibold text-destructive",
};

function OutcomeCard({ measure: m }: { measure: ProcessMeasure }) {
    const read = readMeasure(m);
    return (
        <article aria-label={`${m.measure} outcome`} className={cn(panel, "flex flex-col gap-200")}>
            <h3 className={cn(BODY, "font-semibold")}>{m.measure}</h3>
            <p className={cn(SMALL, "text-muted-foreground")}>{m.process} · {m.kind}</p>
            <AvailabilityBadge level={m.availability} basis={m.basis} />
            <p className="font-numeric text-[length:var(--text-hero-800)] leading-hero-800 font-semibold tabular-nums">{num(m.current, m.unit)}</p>
            <p className={SMALL}>Before: {num(m.baseline, m.unit)} · {delta(observedChange(m), m.unit)} observed</p>
            <p className={cn(SMALL, "text-muted-foreground")}>{m.basis}</p>
            <div className={cn(SMALL, "mt-auto border-t border-border pt-200")}>
                <p>{delta(attributableChange(m), m.unit)} beyond comparison</p>
                <p className="text-muted-foreground">90% interval: ±{num(m.interval, m.unit === "%" ? "pts" : m.unit)}</p>
                <p className={READ_STYLE[read]}>{read}</p>
            </div>
        </article>
    );
}

function D365Preview() {
    return (
        <div className="flex flex-col gap-400">
            <div className="flex flex-col gap-200">
                <h3 className={cn(BODY, "font-semibold")}>D365 Sales: a second optional source</h3>
                <p className={cn(SMALL, "text-muted-foreground")}>A separate invented sales cohort, 12 weeks before vs after. These are illustrative observed changes only: no comparison group, no attribution claim and no D365 connection. D365 would use a Dataverse adapter, not BPS ingestion.</p>
            </div>
            <div className="grid gap-400 md:grid-cols-3">
                {d365SalesPreview.map(m => (
                    <article key={m.measure} aria-label={`${m.measure} preview`} className={cn(panel, "flex flex-col gap-200")}>
                        <h4 className={cn(BODY, "font-semibold")}>{m.measure}</h4>
                        <p className={cn(SMALL, "text-muted-foreground")}>{m.persona}</p>
                        <p className="font-numeric text-[length:var(--text-hero-800)] leading-hero-800 font-semibold tabular-nums">{num(m.current, m.unit)}</p>
                        <p className={SMALL}>Before: {num(m.baseline, m.unit)} · {delta(m.current - m.baseline, m.unit)} observed</p>
                        <p className={cn(SMALL, "mt-auto border-t border-border pt-200 text-muted-foreground")}>{m.definition}</p>
                    </article>
                ))}
            </div>
        </div>
    );
}

function BottomLine() {
    return (
        <Section id={stageAnchor("impact-summary")} title="From usage to business outcomes" description="Speed, throughput, cash and quality beside DataHub's adoption, consumption and value story. Synthetic BPS/SAP scenario, with a separate D365 Sales preview. No live sources are connected.">
            <div className="grid gap-400 sm:grid-cols-2 xl:grid-cols-4">
                {headlineMeasures.map(m => <OutcomeCard key={m.measure} measure={m} />)}
            </div>
            <p className={cn(SMALL, "text-muted-foreground")}>BPS/SAP examples, 12 weeks before vs after rollout. “Beyond comparison” subtracts the change in a team not yet rolled out. Intervals and effects are simulated, not evidence that AI caused an improvement. Each card says how it would be read from BPS: Computed from Gold fields, Proxy (indirect or team-level), or Needs source.</p>
            <div className={cn(SMALL, "flex flex-wrap gap-x-600 gap-y-200")}>
                <a href="#/business-impact/impact-processes" className="font-semibold text-primary underline-offset-4 hover:underline">Explore all {processScorecard.length} process measures</a>
                <a href="#/business-impact/impact-personas" className="font-semibold text-primary underline-offset-4 hover:underline">See the functional personas</a>
                <a href="#/value/estimated-value" className="font-semibold text-primary underline-offset-4 hover:underline">Compare with estimated value</a>
            </div>
            <dl className={cn(panel, "grid gap-400 sm:grid-cols-2 xl:grid-cols-4")}>
                {[
                    ["People in functional personas", whole(people), `${pct(coverage.peopleWithPersona)} of scenario staff mapped`],
                    ["Mapped agent sessions", whole(agentSessions), `${processAgents.length} agents, last 30 days`],
                    ["Process outcomes improved", `${improved} / ${outcomes.length}`, "Beyond comparison in this scenario"],
                    ["Quality checks held", `${qualityHeld} / ${qualityChecks.length}`, "No conclusive deterioration; not proof of no harm"],
                ].map(([label, value, detail]) => (
                    <div key={label} className="flex flex-col gap-100">
                        <dt className={SMALL}>{label}</dt>
                        <dd className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">{value}</dd>
                        <dd className={cn(SMALL, "text-muted-foreground")}>{detail}</dd>
                    </div>
                ))}
            </dl>
            <p className={BODY}>In this scenario, invoice processing and collections show the strongest signals; journal and procurement outcomes still need more evidence. Value estimates the effort represented by AI work. Business impact asks whether process outcomes changed as well, without adding the two into a single ROI.</p>
            <D365Preview />
            <div className="flex flex-col gap-200">
                <h3 className={cn(BODY, "font-semibold")}>How to read the evidence: the AP worked example</h3>
                <p className={cn(SMALL, "text-muted-foreground")}>The same Value estimation approach, followed by observed and comparison-adjusted outcomes. This scenario is separate from the public CSV cohort used on the Value page; its totals do not reconcile to that page.</p>
            </div>
            <div className="grid gap-400 md:grid-cols-3">
                {benefitLadder.map(rung => (
                    <article key={rung.level} className={cn(panel, "flex flex-col gap-200")}>
                        <EvidenceBadge level={rung.level} />
                        <h3 className={cn(SMALL, "text-muted-foreground")}>{rung.label}</h3>
                        <p className="text-[length:var(--text-600)] font-semibold">{rung.value}</p>
                        <p className={cn(SMALL, "text-muted-foreground")}>{rung.basis}</p>
                    </article>
                ))}
            </div>
            <p className={cn(SMALL, "text-muted-foreground")}>Three levels of evidence, read from left to right. Each is reported on its own and never added to another.</p>
            <Chart
                title="Invoice posting to payment time: pilot team vs comparison team"
                subtitle={`Weekly average days from invoice posting to payment (BPS AP open items). Copilot and the invoice exception agent rolled out to the pilot team on ${rolloutDate}.`}
                rows={apTrend()}
                height={300}
                spec={{
                    layer: [
                        { mark: { type: "line", strokeWidth: 2, point: true }, encoding: { x: { field: "Week", type: "temporal", title: null }, y: { field: "Days", type: "quantitative", title: "Days", scale: { zero: false } }, color: { field: "Group", type: "nominal", title: null, legend: { orient: "top", labelLimit: 260 } }, tooltip: [{ field: "Week", type: "temporal" }, { field: "Group" }, { field: "Days", type: "quantitative", format: ".1f" }] } },
                        { data: { values: [{ Rollout: rolloutDate }] }, mark: { type: "rule", strokeDash: [4, 4] }, encoding: { x: { field: "Rollout", type: "temporal" } } },
                        { data: { values: [{ Rollout: rolloutDate, Label: "Rollout" }] }, mark: { type: "text", align: "left", dx: 4, dy: -6, baseline: "top" }, encoding: { x: { field: "Rollout", type: "temporal" }, y: { value: 0 }, text: { field: "Label" } } },
                    ],
                }}
            />
        </Section>
    );
}

function PersonaCard({ p }: { p: Persona }) {
    const did = attributableChange(p);
    const throughput = throughputFor(p);
    const kpi = measureFor(p);
    const bars: [string, number][] = [["Copilot active", p.copilotActive], ["Using agents", p.agentUsers], ["Habit (weekly 3+ days)", p.habit]];
    return (
        <article className={cn(panel, "flex flex-col gap-300")}>
            <div className="flex items-start justify-between gap-200">
                <div>
                    <h3 className={cn(BODY, "font-semibold")}>{p.name}</h3>
                    <p className={cn(SMALL, "text-muted-foreground")}>{p.domain} · {p.process} · {p.people} people</p>
                </div>
                <EvidenceBadge level={p.evidence} />
            </div>
            <dl className="flex flex-col gap-200">
                {bars.map(([label, v]) => (
                    <div key={label} className="flex flex-col gap-100">
                        <div className="flex justify-between"><dt className={SMALL}>{label}</dt><dd className={cn(SMALL, "font-semibold")}>{pct(v)}</dd></div>
                        <div className="h-100 rounded-full bg-muted" aria-hidden="true"><div className="h-100 rounded-full bg-primary" style={{ width: pct(v) }} /></div>
                    </div>
                ))}
            </dl>
            <p className={SMALL}><span className="text-muted-foreground">Top AI tasks: </span>{p.topTasks.join(", ")}</p>
            <p className={SMALL}><span className="text-muted-foreground">Expert-equivalent hours (Value page): </span>{p.estHoursPerPerson} h per person per month</p>
            {throughput && <p className={SMALL}><span className="text-muted-foreground">{throughput.measure} (BPS): </span>{whole(throughput.baseline)} → {whole(throughput.current)} <span className="text-muted-foreground">({readMeasure(throughput) === "Improved" ? "beyond comparison" : "not conclusive"})</span></p>}
            <div className="rounded-lg bg-muted p-300">
                <div className="flex items-start justify-between gap-200">
                    <p className={cn(SMALL, "text-muted-foreground")}>{p.kpi} (BPS)</p>
                    {kpi && <AvailabilityBadge level={kpi.availability} basis={kpi.basis} />}
                </div>
                <p className="text-[length:var(--text-500)] font-semibold">{num(p.baseline, p.unit)} → {num(p.current, p.unit)}</p>
                <p className={SMALL}>
                    {delta(did, p.unit)} beyond the comparison group <span className="text-muted-foreground">(±{num(p.interval, p.unit === "%" ? "pts" : p.unit)})</span>
                    {isConclusive(p) ? "" : <span className="text-muted-foreground"> · not conclusive yet</span>}
                </p>
            </div>
        </article>
    );
}

function Personas() {
    return (
        <Section id={stageAnchor("impact-personas")} title="Functional personas" description="BPS records outcomes against teams, cost centres and purchasing groups, and people only by SAP user. Personas therefore join at team level by default, through job titles and Entra cost centres. Person-level views need an explicit, customer-supplied SAP-user mapping.">
            <div className="grid gap-400 md:grid-cols-2 xl:grid-cols-3">
                {personas.map(p => <PersonaCard key={p.id} p={p} />)}
            </div>
            <Table
                caption={`The Value page's measures by persona, with the BPS outcome each persona owns. ${whole(Math.round(estHours))} expert-equivalent hours a month in total: an estimate, not a saving.`}
                headers={["Persona", "People", "Habit (weekly 3+ days)", "Expert-equivalent hours per person", "Expert-equivalent hours a month", "BPS outcome", "Evidence"]}
                rows={personas.map(p => [
                    <strong>{p.name}</strong>, whole(p.people), pct(p.habit), `${p.estHoursPerPerson} h`, `${whole(Math.round(p.people * p.estHoursPerPerson))} h`,
                    `${p.kpi}: ${delta(attributableChange(p), p.unit)} beyond comparison`, <EvidenceBadge level={p.evidence} />,
                ])}
            />
            <div className="grid gap-400 lg:grid-cols-2">
                <Chart
                    title="What each persona uses AI for"
                    subtitle="Share of each persona's Copilot and agent tasks by task category, last 30 days"
                    rows={personaTaskMix}
                    height={300}
                    spec={{
                        encoding: { x: { field: "Task", type: "nominal", title: null, sort: null, axis: { orient: "top", labelAngle: -30, labelLimit: 120 } }, y: { field: "Persona", type: "nominal", title: null, sort: null, axis: { labelLimit: 180 } } },
                        layer: [
                            { mark: { type: "rect", stroke: "white", strokeWidth: 1 }, encoding: { color: { field: "Share", type: "quantitative", legend: null, scale: { scheme: "blues" } }, tooltip: [{ field: "Persona" }, { field: "Task" }, { field: "Share", type: "quantitative", format: ".0%" }] } },
                            { mark: { type: "text", fontSize: 11 }, encoding: { text: { field: "Share", type: "quantitative", format: ".0%" }, color: { condition: { test: "datum['Share'] > 0.2", value: "white" }, value: "black" } } },
                        ],
                    }}
                />
                <Chart
                    title="Teams using agents more improved more"
                    subtitle="Each dot is a team: agent adoption vs improvement in its BPS KPI since rollout. Correlation, not cause."
                    rows={teamScatter()}
                    height={300}
                    spec={{
                        mark: { type: "circle", opacity: 0.8 },
                        encoding: {
                            x: { field: "AgentAdoption", type: "quantitative", title: "People using agents", axis: { format: ".0%" } },
                            y: { field: "Improvement", type: "quantitative", title: "KPI improvement", axis: { format: ".0%" } },
                            color: { field: "Persona", type: "nominal", title: null, legend: { orient: "bottom", columns: 3, labelLimit: 180 } },
                            size: { field: "People", type: "quantitative", legend: null },
                            tooltip: [{ field: "Team" }, { field: "AgentAdoption", title: "Using agents", type: "quantitative", format: ".0%" }, { field: "Improvement", type: "quantitative", format: ".1%" }, { field: "People", type: "quantitative" }],
                        },
                    }}
                />
            </div>
            <D365Preview />
        </Section>
    );
}

function Processes() {
    const rows = personas.map(p => {
        const effect = improvement(p, attributableChange(p)) / Math.abs(p.baseline);
        const half = p.interval / Math.abs(p.baseline);
        return { Process: `${p.process} · ${p.kpi}`, Effect: +effect.toFixed(3), Low: +(effect - half).toFixed(3), High: +(effect + half).toFixed(3), Evidence: isConclusive(p) ? "Interval excludes zero" : "Not conclusive" };
    });
    return (
        <Section id={stageAnchor("impact-processes")} title="Process outcomes" description="For each process, the change in its BPS KPI after rollout, less the change in a comparable group not yet rolled out (difference in differences).">
            <Chart
                title="Improvement beyond the comparison group"
                subtitle="Attributable change as a share of the baseline, with a 90% interval. Right of zero is better."
                rows={rows}
                height={280}
                spec={{
                    layer: [
                        { mark: { type: "rule", strokeWidth: 2 }, encoding: { y: { field: "Process", type: "nominal", title: null, sort: null, axis: { labelLimit: 280 } }, x: { field: "Low", type: "quantitative", title: "Improvement vs baseline", axis: { format: ".0%" } }, x2: { field: "High" }, color: { field: "Evidence", type: "nominal", title: null, legend: { orient: "top", labelLimit: 200 } } } },
                        { mark: { type: "point", filled: true, size: 90 }, encoding: { y: { field: "Process", type: "nominal", sort: null }, x: { field: "Effect", type: "quantitative", title: "Improvement vs baseline", axis: { format: ".0%" } }, color: { field: "Evidence", type: "nominal" }, tooltip: [{ field: "Process" }, { field: "Effect", type: "quantitative", format: ".1%" }, { field: "Low", type: "quantitative", format: ".1%" }, { field: "High", type: "quantitative", format: ".1%" }] } },
                        { data: { values: [{ Zero: 0 }] }, mark: { type: "rule", strokeDash: [4, 4] }, encoding: { x: { field: "Zero", type: "quantitative", title: "Improvement vs baseline", axis: { format: ".0%" } } } },
                    ],
                }}
            />
            <Table
                caption="BPS KPI by process: 12 weeks before vs 12 weeks after rollout. Comparison groups are matched on process, region and baseline volume."
                headers={["Process", "KPI", "Before", "After", "Change", "Comparison group", "Attributable (90%)", "Evidence"]}
                rows={personas.map(p => [
                    <><strong>{p.process}</strong><p className="text-muted-foreground">{p.name}</p></>,
                    p.kpi, num(p.baseline, p.unit), num(p.current, p.unit), signed(observedChange(p), p.unit), signed(p.comparisonChange, p.unit),
                    `${signed(attributableChange(p), p.unit)} ±${num(p.interval, p.unit)}`,
                    <EvidenceBadge level={p.evidence} />,
                ])}
            />
            <div className="grid gap-400 sm:grid-cols-2 lg:grid-cols-4">
                {measureKinds.map(kind => {
                    const ms = processScorecard.filter(m => m.kind === kind);
                    const good = ms.filter(m => kind === "Quality check" ? readMeasure(m) !== "Worse" : readMeasure(m) === "Improved").length;
                    return <KpiCard key={kind} label={kind === "Quality check" ? "Quality checks held" : `${kind} measures improved`} value={good} detail={`Of ${ms.length} tracked`} />;
                })}
            </div>
            <Table
                caption="The fuller BPS scorecard. Speed, throughput and cash measures count only when they improve beyond the comparison group. Quality checks only need to hold: they show faster work has not meant more errors. “How computed” describes the BPS fields each measure would use; hover a badge for what it means."
                headers={["Process", "Type", "Measure", "Availability", "How computed", "Before", "After", "Attributable (90%)", "Read"]}
                rows={processScorecard.map(m => {
                    const read = readMeasure(m);
                    return [m.process, m.kind, m.measure, <AvailabilityBadge level={m.availability} />, <span className="text-muted-foreground">{m.basis}</span>, num(m.baseline, m.unit), num(m.current, m.unit), `${delta(attributableChange(m), m.unit)} ±${num(m.interval, m.unit === "%" ? "pts" : m.unit)}`, <span className={READ_STYLE[read]}>{read}</span>];
                })}
            />
        </Section>
    );
}

function Agents() {
    return (
        <Section id={stageAnchor("impact-agents")} title="Agents in the process" description="Each agent is mapped to the SAP process it serves. Where its runs carry a business case ID, sessions link to invoices, open items or postings in BPS.">
            <Table
                caption="Last 30 days. Credits from DataHub's consumption data; linked cases from BPS where the agent writes the document or case ID."
                headers={["Agent", "Built with", "Process", "Sessions", "Resolved", "Credits", "Linked BPS cases", "Owner", "Review"]}
                rows={processAgents.map(a => [
                    <strong>{a.name}</strong>, a.origin, a.process, whole(a.sessions), pct(a.resolution), whole(a.credits),
                    a.linkedCases ? whole(a.linkedCases) : <span className="text-muted-foreground">Not instrumented</span>,
                    a.owner || <span className="font-semibold text-destructive">None</span>,
                    <span className={a.review === "Up to date" ? "" : "font-semibold text-destructive"}>{a.review}</span>,
                ])}
            />
            <p className={cn(SMALL, "text-muted-foreground")}>BPS ships agent templates for finance, procurement and sales. Mapping them here brings them under the same governance, evaluation and cost views as every other agent in DataHub.</p>
        </Section>
    );
}

function CostPerTransaction() {
    const rows = costToServe();
    return (
        <Section id={stageAnchor("impact-cost")} title="Cost per transaction" description="AI cost per SAP business transaction, and the value categories BPS outcomes support. The Value page compares cost with estimated value; this adds the cost of each process outcome. Categories stay separate: they are different kinds of money.">
            <Table
                caption="Monthly. Agent cost at the scenario credit price; licence cost is the persona's share of Copilot licences. Volume is BPS document count."
                headers={["Process", "Agent", "Agent cost", "Licence cost", "BPS volume", "AI cost per transaction", "Agent cost per resolved case"]}
                rows={rows.map(r => [r.process, r.agent, money(r.agentCost), money(r.licenceCost), whole(r.volume), money(r.costPerTransaction), r.costPerResolvedCase === undefined ? <span className="text-muted-foreground">Needs case IDs</span> : money(r.costPerResolvedCase)])}
            />
            <div className="grid gap-400 sm:grid-cols-2 lg:grid-cols-4">
                {financialCategories.map(c => (
                    <article key={c.category} className={cn(panel, "flex flex-col gap-200")}>
                        <h3 className={cn(SMALL, "text-muted-foreground")}>{c.category}</h3>
                        <p className="text-[length:var(--text-600)] font-semibold">{c.value}</p>
                        <p className={cn(SMALL, "text-muted-foreground")}>{c.note}</p>
                    </article>
                ))}
            </div>
            <p className={cn(SMALL, "text-muted-foreground")}>No total is shown on purpose. Released hours, one-off cash, recurring savings and avoided cost cannot be added into one ROI figure.</p>
        </Section>
    );
}

function Opportunities() {
    return (
        <Section id={stageAnchor("impact-opportunities")} title="Where to go next" description="High-volume processes that are furthest from target and where agent adoption is still low: the best places for the next rollout or agent.">
            <Chart
                title="Process gap vs agent adoption"
                subtitle="Gap to the process target (BPS) against people using agents. Bubble size is monthly volume. Top left is the opportunity."
                rows={opportunities.map(o => ({ Process: o.process, Gap: o.gap, Adoption: o.agentAdoption, Volume: o.volume, Priority: o.priority }))}
                height={280}
                spec={{
                    layer: [
                        { mark: { type: "circle", opacity: 0.75 }, encoding: { x: { field: "Adoption", type: "quantitative", title: "People using agents", axis: { format: ".0%" }, scale: { domain: [0, 0.8] } }, y: { field: "Gap", type: "quantitative", title: "Gap to target", axis: { format: ".0%" } }, size: { field: "Volume", type: "quantitative", legend: null, scale: { range: [80, 1600] } }, color: { field: "Priority", type: "nominal", sort: ["High", "Medium", "Low"], legend: { orient: "top" } }, tooltip: [{ field: "Process" }, { field: "Gap", type: "quantitative", format: ".0%" }, { field: "Adoption", type: "quantitative", format: ".0%" }, { field: "Volume", type: "quantitative", format: "," }] } },
                        { mark: { type: "text", dy: -24, fontSize: 11 }, encoding: { x: { field: "Adoption", type: "quantitative", title: "People using agents", axis: { format: ".0%" }, scale: { domain: [0, 0.8] } }, y: { field: "Gap", type: "quantitative", title: "Gap to target", axis: { format: ".0%" } }, text: { field: "Process" } } },
                    ],
                }}
            />
            <Table
                caption="Ranked by gap, volume and adoption headroom."
                headers={["Priority", "Process", "Persona", "Monthly volume", "Gap to target", "Using agents", "Suggested next step"]}
                rows={opportunities.map(o => [<strong>{o.priority}</strong>, o.process, o.persona, whole(o.volume), pct(o.gap), pct(o.agentAdoption), o.candidate])}
            />
        </Section>
    );
}

function Method() {
    const steps = [
        "Choose an optional source: read existing BPS Gold through a OneLake shortcut, or link approved D365 / Dataverse tables to Fabric. D365 is a separate adapter, not a BPS source.",
        "Run the readiness checks below, then fill in three small mapping tables: cost centre or purchasing group to org group, job title to persona, and agent to process.",
        "In the proposed implementation, a source-specific adapter would write impact_kpi_weekly. This preview reads local fixtures; neither adapter is implemented or connected here.",
        "Pick a comparison group for each rollout before it starts, so the attributable estimate is fair.",
    ];
    const availabilityLevels = Object.keys(availabilityMeaning) as Availability[];
    const countOf = (level: Availability) => processScorecard.filter(m => m.availability === level).length;
    return (
        <Section id={stageAnchor("impact-method")} title="Data and method" description="An optional module concept with BPS and D365 input routes. Both are off by default; the rest of DataHub is unchanged.">
            <div className={cn(panel, "flex flex-col gap-200")}>
                <p className={cn(BODY, "font-semibold")}>Synthetic preview</p>
                <p className={SMALL}>Every number on this page is synthetic ({scenarioRange}). No SAP system, BPS deployment, D365 environment or tenant data is connected. BPS model names follow its public documentation; the fields each measure uses are generic, so confirm them and their population against your deployment. D365 sales examples are a separate cohort and are not included in the BPS scorecard totals. App-wide date and org filters do not apply to these fixed scenarios.</p>
            </div>
            <div className="grid gap-400 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Cost centres mapped" value={coverage.costCentresMapped} format="percent" detail="BPS cost centres with a DataHub org group" />
                <KpiCard label="People with a persona" value={coverage.peopleWithPersona} format="percent" detail="Finance, procurement and sales staff" />
                <KpiCard label="Agents mapped to a process" value={coverage.agentsMapped} detail={`Of ${coverage.agentsTotal} finance, procurement and sales agents`} />
                <KpiCard label="Process measures" value={processScorecard.length} detail={`Across ${personas.length} processes. Simulated refresh: ${coverage.bpsRefreshed}`} />
            </div>
            <ol className={cn(BODY, "flex list-decimal flex-col gap-200 pl-500")}>{steps.map(s => <li key={s}>{s}</li>)}</ol>
            <Table
                caption="What the module reads and writes."
                headers={["Source", "Table", "Grain", "Used for"]}
                rows={dataContract.map(d => [d.source, <code>{d.table}</code>, d.grain, d.use])}
            />
            <div className="grid gap-400 sm:grid-cols-3">
                {availabilityLevels.map(level => (
                    <article key={level} className={cn(panel, "flex flex-col gap-200")}>
                        <div className="flex items-center justify-between gap-200">
                            <AvailabilityBadge level={level} />
                            <p className="text-[length:var(--text-600)] font-semibold tabular-nums">{countOf(level)} of {processScorecard.length}</p>
                        </div>
                        <p className={cn(SMALL, "text-muted-foreground")}>{availabilityMeaning[level]}</p>
                    </article>
                ))}
            </div>
            <Table
                caption="How BPS outcomes join to people. SAP records people by user or personnel number, not by UPN, so the join defaults to the team."
                headers={["Level", "Join", "What it shows", "Needs"]}
                rows={personaJoins.map(j => [<strong>{j.level}</strong>, j.join, j.shows, j.needs])}
            />
            <Table
                caption="Readiness checks before trusting a BPS-derived measure."
                headers={["Check", "Why it matters"]}
                rows={readinessChecks.map(r => [<strong>{r.check}</strong>, r.why])}
            />
            <div className={cn(panel, "flex flex-col gap-200")}>
                <p className={cn(BODY, "font-semibold")}>Reading the evidence</p>
                <ul className={cn(SMALL, "flex list-disc flex-col gap-100 pl-500")}>
                    {(Object.keys(EVIDENCE_MEANING) as Evidence[]).map(level => <li key={level}><strong>{level}:</strong> {EVIDENCE_MEANING[level]}</li>)}
                    <li>Persona and team views report groups of at least 5 people, so no individual's output is shown next to their AI use.</li>
                    <li>Process KPIs also move with volume, staffing, policy and season. A comparison group removes shared changes, not changes unique to the pilot team.</li>
                </ul>
            </div>
        </Section>
    );
}

export function BusinessImpactScreen() {
    const { show } = useStageFilter();
    const stages: [StageId, () => React.JSX.Element][] = [
        ["impact-summary", BottomLine], ["impact-personas", Personas], ["impact-processes", Processes], ["impact-agents", Agents],
        ["impact-cost", CostPerTransaction], ["impact-opportunities", Opportunities], ["impact-method", Method],
    ];
    if (import.meta.env.VITE_BUSINESS_IMPACT_DEMO !== "true") return <p className={BODY}>The Business impact preview is not enabled for this build.</p>;
    return (
        <div className="flex flex-col gap-600">
            {stages.map(([id, Screen]) => show(id) && <Screen key={id} />)}
        </div>
    );
}
