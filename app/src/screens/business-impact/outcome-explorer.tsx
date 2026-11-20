import { useState } from "react";
import { stageAnchor } from "@/components/destinations";
import { Section } from "@/components/section";
import { useVisualGuide } from "@/components/visual-guide";
import data from "@/demo/outcome-samples.json";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import apacheLicense from "@/demo/LICENSE-Apache-2.0.txt?url";
import { Chart } from "../cross-vendor/insights";
import { ImpactTable } from "./impact-table";
import { AgentMeasurement } from "./impact-lineage";
import { TONE_STYLE } from "./live-visuals";
import volumeSpec from "./sample-volume.json";

type SampleKey = keyof typeof data;
type Sample = (typeof data)[SampleKey];
type Journey = {
    role: string;
    process: string;
    sample?: SampleKey;
    mapping: string;
    agent: string;
    step: string;
    mode: string;
    outcome: string;
    guardrail: string;
};
const journeys: readonly Journey[] = [
    { role: "IT service desk", process: "Resolve incidents", sample: "service", mapping: "An assignment group would need an approved match to a DataHub support team. An anonymous group identifier is not employee membership.",
        agent: "Incident resolution agent", step: "Triage an incident, propose remediation and verify the result", mode: "Human-approved remediation; straight-through only for explicitly authorised runbooks", outcome: "Elapsed resolution time and closed incidents", guardrail: "Reopens and reassignments; add SLA, failure and intervention events" },
    { role: "Sales operations", process: "Close opportunities", sample: "sales", mapping: "Match opportunity ownership or territory to an approved sales team, effective on the close date. Closed opportunities include both wins and losses.",
        agent: "Opportunity follow-up agent", step: "Identify stalled opportunities and prepare next actions", mode: "Human-assisted; seller approves outreach and commercial decisions", outcome: "Closed-deal cycle and win rate, not a claim that the agent won the deal", guardrail: "Add margin, outreach quality and customer opt-out evidence" },
    { role: "Finance · Accounts payable", process: "Clear supplier invoices", sample: "finance", mapping: "The public log follows purchase-order items through invoice clearing. It does not identify individual invoices, AP employees or the time they spent.",
        agent: "Invoice exception agent", step: "Investigate matching exceptions and propose a correction", mode: "Human-approved correction; payment approval stays with the authorised owner", outcome: "PO-item clearing coverage here; invoice payment time needs invoice-level dates and keys", guardrail: "Add duplicate-payment, erroneous-posting and approval evidence; repeated receipts are not proof of error" },
    { role: "Procurement operations", process: "Track purchase-to-pay", sample: "finance", mapping: "Procurement and AP use the same purchase-order items here. They are two views of one population, not additive teams or outcomes.",
        agent: "Purchase-order exception agent", step: "Investigate receipt mismatches and recommend a follow-up", mode: "Human-assisted; buyer approves order or supplier changes", outcome: "PO-item receipt and clearing coverage; use the same population as AP without double-counting", guardrail: "Add promised-delivery, compliance and human-intervention evidence" },
    { role: "Customer support", process: "Close customer cases", sample: "customer", mapping: "Map a case queue to an approved support cohort. A closed case is not necessarily a resolved issue, and it is not an IT incident.",
        agent: "Customer case resolution agent", step: "Retrieve an answer, propose a response and verify the customer's issue is resolved", mode: "Human-approved response; autonomous closure requires verified resolution evidence", outcome: "Elapsed closure time and case closure rate; closure is not verified resolution", guardrail: "Add reopen, escalation, satisfaction and policy-compliance events" },
    { role: "Campaign management", process: "Measure campaign response", sample: "marketing", mapping: "The records describe campaign recipients, not marketers. Campaign-to-team ownership would need to be supplied separately.",
        agent: "Campaign planning agent", step: "Prepare an audience and message for campaign review", mode: "Human-assisted; campaign owner approves audience, consent and content", outcome: "Subscription rate; the sample has no dates for a rollout comparison", guardrail: "Add opt-outs, complaints, consent and campaign-cost evidence" },
    { role: "Operations · Field service", process: "Complete work orders", mapping: "Needs work-order and booking history, completion dates and an approved operations-team mapping. A purchase receipt is not a completed field visit.",
        agent: "Work-order scheduling agent", step: "Propose technician assignments and appointment changes", mode: "Human-approved scheduling; safety decisions stay with qualified staff", outcome: "Time to completion and first-time fix, once work-order outcomes are connected", guardrail: "Add repeat visits, safety exceptions and customer-confirmed completion" },
    { role: "Workforce · Recruitment", process: "Fill vacancies", mapping: "Needs approved requisition, offer and hire dates from HR. An org directory can describe the team but cannot measure time to hire.",
        agent: "Interview scheduling agent", step: "Coordinate interview availability and send approved invitations", mode: "Human-approved coordination; no automated candidate selection", outcome: "Scheduling lead time; time to hire is a broader outcome requiring a comparison", guardrail: "Add rescheduling, accessibility, consent and recruiter-handoff evidence" },
];
const systems = [
    { name: "ServiceNow", route: "Fabric ServiceNow copy connector", example: "Anonymised incident log", role: 0, needs: "Read access to incidents and history; agree on elapsed versus business hours." },
    { name: "Salesforce", route: "Objects / Service Cloud copy, or Data 360 sharing", example: "CRM test records, not a Data 360 export", role: 1, needs: "The OneLake shortcut is in preview. An eligible edition and an approved, shareable DLO are required; DLO filters are not preserved." },
    { name: "SAP / ERP", route: "Customer's curated process tables", example: "Public purchase-to-pay event log, not an SAP extract", role: 2, needs: "For true payment time, link posting and clearing at invoice grain; a PO item may have multiple receipts." },
    { name: "Marketing analytics", route: "Approved campaign-response export", example: "Historical telephone campaign", role: 5, needs: "Add campaign ownership, spend and complete dates before measuring team cost or changes over time." },
    { name: "Dynamics 365", route: "Dataverse Link to Fabric", example: "No native sample loaded", role: 6, needs: "Select the required Sales, Customer Service or Field Service tables in an authorised test environment." },
    { name: "HR / Workday", route: "Approved HR extract", example: "No HR outcomes sample loaded", role: 7, needs: "Approve purpose, cohort size and access before using recruiting or onboarding history." },
] as const;
const views = ["Persona scorecard", "Agents & automation", "Business systems", "AI cost scenario"] as const;
type View = (typeof views)[number];
const control = "rounded-md border border-border bg-card px-300 py-200 text-foreground focus-visible:outline-2 focus-visible:outline-primary";
const link = "font-semibold text-primary underline underline-offset-4";
const heading = cn(BODY, "font-semibold");
const muted = cn(SMALL, "text-muted-foreground");
const whole = (n: number) => n.toLocaleString("en-US");
const dollars = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });

function SourceNote({ sample }: { sample: Sample }) {
    const apache = sample === data.sales || sample === data.customer;
    return <footer className={cn(muted, "border-t border-border pt-300")}>
        Source: <a className={link} href={sample.url} target="_blank" rel="noreferrer">{sample.source}</a>
        {" · "}{sample.credit}{" · "}
        <a className={link} href={apache ? apacheLicense : "https://creativecommons.org/licenses/by/4.0/"} target="_blank" rel="noreferrer">{sample.license}</a>.
        {" "}Aggregated for this demo; original dates retained.
    </footer>;
}

function ProcessHistory({ sample }: { sample: Sample }) {
    const [selection, select] = useState(sample.outcomeSeries.length ? "0" : "volume");
    const series = selection === "volume" ? undefined : sample.outcomeSeries[Number(selection)];
    const label = series?.label ?? "Transaction volume";
    const unit = series?.unit ?? "Transactions";
    const basis = series?.basis ?? sample.trendBasis;
    const rows = series ? series.points.map(p => ({ period: p.period, count: p.value, eligible: p.eligible })) : sample.trend;
    const spec = { ...volumeSpec, encoding: { ...volumeSpec.encoding, y: { ...volumeSpec.encoding.y, title: unit },
        tooltip: [{ field: "period", title: "Source month" }, { field: "count", type: "quantitative", title: unit, format: ",.2~f" },
            ...(series ? [{ field: "eligible", type: "quantitative", title: "Eligible records", format: ",d" }] : [])] } };
    return <>
        <label className={cn(muted, "flex w-fit max-w-full flex-col gap-100")}>Monthly measure<select className={cn(control, BODY, "max-w-full")} value={selection} onChange={e => select(e.target.value)}>
            {sample.outcomeSeries.map((s, i) => <option key={s.label} value={String(i)}>{s.label}</option>)}
            <option value="volume">Transaction volume</option>
        </select></label>
        <Chart title={`${label} by month`} subtitle={basis} rows={rows} spec={spec} height={215} />
        <details className={SMALL}><summary className="w-fit cursor-pointer font-semibold">Monthly figures and coverage</summary>
            <ImpactTable caption={basis} headers={series ? ["Source month", unit, "Eligible records"] : ["Source month", unit]}
                rows={series ? series.points.map(p => [p.period, p.value.toLocaleString("en-US", { maximumFractionDigits: 2 }), whole(p.eligible)]) : sample.trend.map(p => [p.period, whole(p.count)])} />
        </details>
    </>;
}

function Scorecard({ sample, onCost, onAgents }: { sample: Sample; onCost: () => void; onAgents: () => void }) {
    useVisualGuide({
        kind: "Headline figures",
        title: "Process measures",
        what: `${sample.kind}. ${sample.period}`,
        how: "Each tile is one measure from the public sample. The line under the figure says which records it counts.",
    });
    return <>
        <p className={BODY}><strong>{sample.kind}.</strong> {sample.period}</p>
        <dl aria-label="Process measures" className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-300">
            {sample.metrics.map(metric => <div key={metric.label} className="flex flex-col gap-100 rounded-lg border border-border bg-card p-400">
                <dt className={cn(SMALL, "font-semibold")}>{metric.label}</dt>
                <dd className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">{metric.value}</dd>
                <dd className={muted}>{metric.basis}</dd>
            </div>)}
        </dl>
        <p className={cn(BODY, "rounded-lg bg-muted p-300")}><strong>What to watch: </strong>{sample.limitation}</p>
        {sample.trend.length > 0 ? <ProcessHistory key={sample.unit} sample={sample} /> :
            <p className={muted}><strong>Monthly trend unavailable.</strong> {sample.trendBasis}</p>}
        <p className={muted}><strong>AI adoption and agent activity: not linked.</strong> No common team, rollout date or case-level AI evidence exists for this sample.</p>
        <div className="flex flex-wrap gap-300">
            <button type="button" className={cn(control, BODY, "w-fit font-semibold hover:bg-muted")} onClick={onAgents}>Explore agents for this process</button>
            <button type="button" className={cn(control, BODY, "w-fit font-semibold hover:bg-muted")} onClick={onCost}>Model AI cost for this process</button>
        </div>
    </>;
}

function AgentPlan({ journey }: { journey: Journey }) {
    useVisualGuide({
        kind: "Step flow",
        title: `${journey.agent}: proposed mapping`,
        what: "How a proposed agent would connect to this process. A design, not an installed agent.",
        how: "Read the four boxes in order: the step the agent would change, how far it would automate, the outcome to track, and the checks that guard quality.",
    });
    const steps = [
        ["Process step", journey.step],
        ["Intended automation", journey.mode],
        ["Business outcome to track", journey.outcome],
        ["Quality checks", journey.guardrail],
    ] as const;
    return <div className="flex flex-col gap-400">
        <div className="flex flex-col gap-100"><h3 className={heading}>{journey.agent}</h3>
            <p className={muted}><strong>Proposed agent concept · not connected.</strong> This is a mapping design, not an installed agent or evidence that AI was used in the public sample.</p></div>
        <ol aria-label="Proposed agent process mapping" className="grid grid-cols-1 gap-300 md:grid-cols-2 xl:grid-cols-4">
            {steps.map(([label, detail], index) => <li key={label} className="flex flex-col gap-200 rounded-lg border border-border bg-card p-400">
                <span className="flex items-center gap-200">
                    <span aria-hidden="true" className={cn(SMALL, "inline-flex size-[24px] shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground")}>{index + 1}</span>
                    <span className={heading}>{label}</span>
                </span>
                <span className={SMALL}>{detail}</span>
            </li>)}
        </ol>
        <p className={SMALL}><strong>Impact evidence: not linked.</strong> {journey.sample ? "The sample supplies process observations, not agent actions." : "No outcome source is loaded for this process."} Automation coverage, human effort, agent costs and attributable change are unavailable, not zero.</p>
        <AgentMeasurement />
        <details className={SMALL}><summary className="w-fit cursor-pointer font-semibold">What makes this a real mapping?</summary>
            <p className="pt-300">Approve a source/environment-scoped agent ID and version, process step, persona/team, owner, rollout date and validity window. Link run/action IDs to source-scoped case keys and outcomes. Compare the same eligible population before and after rollout, with a suitable comparison group. Never infer a link from an agent name.</p>
            <p className="pt-200">Deduplicate business cases across agents and steps. Finance and Procurement can touch the same case; their outcomes and savings are not additive.</p>
        </details>
    </div>;
}

/** The scenario budget as one bar, with the share given to this process filled in. */
function BudgetSplit({ share }: { share: number }) {
    useVisualGuide({
        kind: "Split bar",
        title: "Budget allocated to this process",
        what: "Your what-if budget, and the part you assigned to this process.",
        how: "The whole bar is the scenario budget; the filled part is the allocation. Both are your inputs, not a bill.",
    });
    return <div className="mt-300 flex max-w-[40rem] flex-col gap-100">
        <p className={cn(SMALL, "flex justify-between gap-200")}><span>Share of the scenario budget</span><span className="font-numeric font-semibold tabular-nums">{Math.round(share * 1000) / 10}%</span></p>
        <div aria-hidden="true" className="h-200 rounded-sm bg-muted">
            <div className="h-full rounded-sm bg-primary" style={{ width: `${Math.min(1, Math.max(0, share)) * 100}%` }} />
        </div>
    </div>;
}

function CostScenario({ sample }: { sample: Sample }) {
    const [budgetText, setBudget] = useState("10000");
    const [shareText, setShare] = useState("25");
    const budget = Number(budgetText), share = Number(shareText);
    const valid = budgetText.trim() !== "" && shareText.trim() !== "" && Number.isFinite(budget) && budget >= 0 &&
        Number.isFinite(share) && share >= 0 && share <= 100 && sample.completed > 0;
    const allocated = budget * (share / 100);
    return <div className="flex flex-col gap-400">
        <div><h3 className={heading}>What would the allocated AI cost be?</h3>
            <p className={muted}>What-if only. Enter a total AI budget for the full sample period ({sample.period}) and the share assigned to this process. Neither input comes from a bill.</p></div>
        <div className="flex flex-wrap gap-400">
            <label className={cn(SMALL, "flex flex-col gap-100")}>Scenario budget (USD)<input className={control} type="number" min="0" step="any" value={budgetText} onChange={event => setBudget(event.target.value)} /></label>
            <label className={cn(SMALL, "flex flex-col gap-100")}>Process allocation (%)<input className={control} type="number" min="0" max="100" step="any" value={shareText} onChange={event => setShare(event.target.value)} /></label>
        </div>
        <div className="border-y border-border py-400" aria-live="polite">
            {valid ? <><p className={BODY}><strong className="font-numeric text-[length:var(--text-600)] tabular-nums">{dollars(allocated / sample.completed)}</strong> per {sample.unit}</p>
                <p className={muted}>{dollars(budget)} × {share}% = {dollars(allocated)} allocated, divided by {whole(sample.completed)} ({sample.unit}).</p>
                <BudgetSplit share={share / 100} /></>
                : <p className={BODY}>Enter a nonnegative budget and an allocation from 0 to 100% to calculate unit cost.</p>}
        </div>
        <p className={muted}><strong>Which records count?</strong> {sample.metrics[0].basis}</p>
        <p className={muted}>The denominator includes the full stated population, not AI-assisted cases. Adoption, agent involvement and attributable savings are not observed. Actual unit cost needs same-period spend, an approved allocation rule and a verified transaction count.</p>
    </div>;
}

function SystemCards({ onOpen }: { onOpen: (role: number) => void }) {
    useVisualGuide({
        kind: "Source cards",
        title: "Which systems could supply these measures?",
        what: "One card per business system: how it could connect and what it needs first.",
        how: "The tag shows whether this demo has a public sample for that system. Open the example link to see that sample, or what is missing.",
    });
    return <>
        <div className="flex flex-col gap-100"><h3 className={heading}>Which systems could supply these measures?</h3>
            <p className={muted}>Connection options are documented routes, not installed connectors. Open an example to see the sample or the missing inputs.</p></div>
        <ul aria-label="Business systems" className="grid grid-cols-1 gap-300 md:grid-cols-2 xl:grid-cols-3">
            {systems.map(s => {
                const loaded = Boolean(journeys[s.role].sample);
                return <li key={s.name} className="flex flex-col gap-200 rounded-lg border border-border bg-card p-400">
                    <span className="flex flex-wrap items-center justify-between gap-200">
                        <span className={heading}>{s.name}</span>
                        <span className={cn(SMALL, "inline-flex w-fit items-center rounded-full border px-200 py-100 font-semibold", TONE_STYLE[loaded ? "partial" : "missing"])}>{loaded ? "Public sample" : "No sample"}</span>
                    </span>
                    <span className={SMALL}>{s.route}</span>
                    <span className={muted}>{s.needs}</span>
                    <span className={cn(SMALL, "mt-auto border-t border-border pt-200")}>Example: <button type="button" className={cn(link, "text-left")} onClick={() => onOpen(s.role)}>{s.example}</button></span>
                </li>;
            })}
        </ul>
    </>;
}

export default function OutcomeExplorer() {
    const [index, setIndex] = useState(0);
    const [view, setView] = useState<View>("Persona scorecard");
    const journey = journeys[index];
    const sample = journey.sample && data[journey.sample];
    return <Section id={stageAnchor("impact-samples")} title="Business outcome explorer" description="Explore process outcomes, map candidate agent workflows, and model AI cost. Public observations and proposed automation stay separate.">
        <div role="group" aria-label="Explorer views" className="flex flex-wrap gap-200">
            {views.map(v => <button key={v} type="button" aria-pressed={v === view} onClick={() => setView(v)} className={cn(control, SMALL, "font-semibold", v === view ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{v}</button>)}
        </div>
        {view === "Business systems" ? <SystemCards onOpen={role => { setIndex(role); setView("Persona scorecard"); }} /> : <>
            <label className={cn(SMALL, "flex w-fit max-w-full flex-col gap-100")}>Functional persona<select className={cn(control, BODY, "w-full min-w-0 font-semibold")} value={index} onChange={e => setIndex(Number(e.target.value))}>
                {journeys.map((j, i) => <option key={j.role} value={i}>{j.role}</option>)}
            </select></label>
            <div className="flex flex-col gap-100"><h3 className="text-[length:var(--text-500)] font-semibold">{journey.process}</h3>
                <p className={muted}><strong>Role template · membership not mapped.</strong> {journey.mapping}</p></div>
            {view === "Agents & automation" ? <AgentPlan journey={journey} /> : !sample ? <div className="border-y border-border py-400"><h4 className={heading}>Source required</h4>
                <p className={muted}>No representative outcome records are loaded for this process. Measures, headcount and unit cost are withheld.</p>
                <button className={cn(link, SMALL, "mt-200")} onClick={() => setView("Business systems")}>See source requirements</button></div>
                : <>{view === "Persona scorecard" ? <Scorecard sample={sample} onCost={() => setView("AI cost scenario")} onAgents={() => setView("Agents & automation")} /> : <CostScenario key={index} sample={sample} />}
                    <SourceNote sample={sample} /></>}
        </>}
    </Section>;
}
