//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useState } from "react";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { stageAnchor } from "@/components/destinations";
import { LineOfSight, SurfaceMap } from "@/components/line-of-sight";
import { Section } from "@/components/section";
import { StageRun } from "@/components/stage-detail";
import { VegaVisual, type VisualizationSpec } from "@/components/vega-visual";
import { useVisualGuide } from "@/components/visual-guide";
import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
import { useThemeContext } from "@/hooks/theme.context";
import { toDataTable } from "@/lib/to-data-table";
import { rowChartHeight } from "@/lib/chart-height";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import {
    impactMetrics, impactOpportunities, impactPersonas, processHistory, processScorecard,
    toImpactReadings, type ImpactReading,
} from "@/queries/business-impact";
import { ImpactTable } from "./impact-table";
import { IMPACT_HINTS } from "./hints";
import { AgentLineage, AgentMeasurement, PersonaLineage } from "./impact-lineage";
import { LiveConnectStage, LiveDiscoveredPersonas } from "./discovery-view";
import { AvailabilityBadge, Chips } from "./visuals";
import {
    amount, coverage, Details, LiveCoverage, LiveDays, LiveRates, LiveVolume, LOW_COVERAGE, Meter, panel, percent,
    ReadingKey, StatusMatrix, ToneLegend, TONE_STYLE, whole, type MatrixCell, type Tone,
} from "./live-visuals";

const link = "font-semibold text-primary underline-offset-4 hover:underline";
const button = "rounded-md border border-border bg-card px-300 py-200 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const headlineFor = (readings: readonly ImpactReading[], id: string) => readings.find(row => row.metric.id === id)!;

function QueryError({ message, retry }: { message: string; retry: () => void }) {
    return <div role="alert" className={cn(panel, SMALL, "border-destructive text-destructive")}>
        <p className="font-semibold">The source query could not be loaded</p>
        <p className="mt-200 break-words">{message}</p>
        <p className="mt-200">No demonstration values have been substituted.</p>
        <button type="button" className={cn(button, "mt-300")} onClick={retry}>Try again</button>
    </div>;
}

/** How many of a measure's items it can speak for, as a bar and a sentence. */
function Measurable({ reading }: { reading: ImpactReading }) {
    if (reading.eligible === 0) return <p className={cn(SMALL, "text-muted-foreground")}>No measurable items in this scope.</p>;
    const share = coverage(reading);
    return <div className="flex flex-col gap-100">
        <Meter share={share} low={share < LOW_COVERAGE} />
        <p className={cn(SMALL, "text-muted-foreground")}>{whole(reading.eligible)} of {whole(reading.population)} items measurable</p>
    </div>;
}

function Outcome({ reading }: { reading: ImpactReading }) {
    return <article aria-label={`${reading.metric.name} outcome`} className={cn(panel, "flex flex-col gap-300")}>
        <div className="flex items-start justify-between gap-200">
            <p className={cn(SMALL, "text-primary")}>{reading.metric.process}</p>
            <AvailabilityBadge level={reading.metric.availability} basis={reading.metric.basis} />
        </div>
        <h3 className={cn(BODY, "font-semibold")}>{reading.metric.name}</h3>
        <p className={reading.value === null ? cn(BODY, "text-muted-foreground") : "font-numeric text-[length:var(--text-hero-800)] leading-hero-800 font-semibold tabular-nums"}>{amount(reading)}</p>
        <div className="mt-auto"><Measurable reading={reading} /></div>
    </article>;
}

function Outcomes({ readings }: { readings: readonly ImpactReading[] }) {
    useVisualGuide({
        kind: "Measure cards",
        title: "Headline process measures",
        what: "One card per headline measure, straight from the connected source.",
        how: "The big number is the measure across its measurable items. The bar shows how many of the process's items had the data it needs; amber means under a quarter, so read that card with care. The badge says whether it is computed directly or a proxy.",
    });
    return <div className="grid gap-400 sm:grid-cols-2 xl:grid-cols-4">
        {readings.filter(row => row.metric.headline).map(row => <Outcome key={row.metric.id} reading={row} />)}
    </div>;
}

function Connected({ readings }: { readings: readonly ImpactReading[] }) {
    useVisualGuide({
        kind: "Progress bars",
        title: "What is connected today",
        how: "Each bar fills as more of that link is connected. An empty bar is not set up yet.",
    });
    const processes = new Set(readings.filter(row => row.eligible > 0).map(row => row.metric.process)).size;
    const measures = readings.filter(row => row.value !== null).length;
    const items = [
        { label: "Processes with data", value: `${processes} of ${impactPersonas.length}`, share: processes / impactPersonas.length },
        { label: "Measures with a value", value: `${measures} of ${impactMetrics.length}`, share: measures / impactMetrics.length },
        { label: "People-to-process bridge", value: "Not configured", share: 0 },
        { label: "Agent-to-process mapping", value: "Not configured", share: 0 },
    ];
    return <div className={cn(panel, "flex flex-col gap-300")}>
        <h3 className={cn(BODY, "font-semibold")}>What is connected today</h3>
        <dl className="grid gap-400 sm:grid-cols-2 xl:grid-cols-4">
            {items.map(item => <div key={item.label} className="flex flex-col gap-100">
                <dt className={cn(SMALL, "text-muted-foreground")}>{item.label}</dt>
                <dd className={cn(BODY, "font-semibold tabular-nums")}>{item.value}</dd>
                <dd><Meter share={item.share} /></dd>
            </div>)}
        </dl>
    </div>;
}

function EvidenceBoundary() {
    return <div className={cn(panel, "grid gap-400 md:grid-cols-3")}>
        {[
            ["Estimated effort", "Read DataHub's Value page", "Behaviour-based time and value estimates stay separate from these process records."],
            ["Observed process performance", "Source-backed measures", "Historical SAP line items, dates and status flags. The period and eligible population are explicit."],
            ["AI-attributable impact", "Not established", "Needs aligned cohorts, an approved rollout date, a comparison design and uncertainty analysis."],
        ].map(([label, value, detail]) => <div key={label} className="flex flex-col gap-200">
            <h3 className={cn(SMALL, "font-semibold")}>{label}</h3>
            <p className={cn(BODY, "font-semibold")}>{value}</p>
            <p className={cn(SMALL, "text-muted-foreground")}>{detail}</p>
        </div>)}
    </div>;
}

interface HistoryState {
    table?: DataTable;
    loading: boolean;
    error?: string;
    retry: () => void;
}

function History({ state }: { state: HistoryState }) {
    const { theme } = useThemeContext();
    if (state.error) return null;
    if (state.loading || !state.table) return <p role="status" className={SMALL}>Loading source-history coverage...</p>;
    if (state.table.rows.length === 0) return <p className={SMALL}>No dated activity is available in this source.</p>;
    const processIndex = state.table.columns.findIndex(column => column.name === "Process");
    const processes = new Set(state.table.rows.map(row => row[processIndex])).size;
    return <div style={{ height: rowChartHeight(processes, { chrome: 190 }) }}>
        <VegaVisual
            label="When the source activity happened"
            spec={processHistory().vegaLiteSpec as VisualizationSpec}
            data={state.table}
            theme={theme}
            containerClassName={panel}
            about="Dated SAP line items per process and year. Not people, and not finished cases."
            header={{ title: "When the source activity happened", subtitle: "Darker cells hold more dated line items (log scale). Shows every year, whatever year you pick." }}
        />
    </div>;
}

function BottomLine({ readings, history }: { readings: ImpactReading[]; history: HistoryState }) {
    return <Section id={stageAnchor("impact-summary")} title="From usage to business outcomes" description="What the connected SAP process history shows today. These are process facts, not AI savings.">
        <Chips items={["Real source data", "No before/after comparison yet", "Not linked to AI use yet"]} />
        <ReadingKey />
        <Outcomes readings={readings} />
        <Connected readings={readings} />
        <History state={history} />
        <div className={cn(SMALL, "flex flex-wrap gap-400")}>
            <a className={link} href="#/business-impact/impact-processes">Explore all process measures</a>
            <a className={link} href="#/business-impact/impact-personas">Explore functional personas</a>
            <a className={link} href="#/business-impact/impact-agents">Trace agents to business outcomes</a>
            <a className={link} href="#/business-impact/impact-connect">Connect personas to processes</a>
            <a className={link} href="#/value/estimated-value">View DataHub estimated value separately</a>
        </div>
        <Details title="More detail: definitions and evidence limits">
            <ImpactTable caption="How each headline measure is defined" headers={["Measure", "Process", "Type", "Definition"]} rows={readings.filter(row => row.metric.headline).map(row => [
                row.metric.name, row.metric.process, row.metric.availability, row.metric.basis,
            ])} />
            <LineOfSight current={["process", "impact"]} />
            <EvidenceBoundary />
            <p className="text-muted-foreground">D365 is a later, separate optional adapter. No D365 data or invented sales cohort is included in this connected view.</p>
        </Details>
    </Section>;
}

const processCell = (reading: ImpactReading): MatrixCell => reading.eligible > 0
    ? { state: "Connected", tone: "ready", detail: `${whole(reading.eligible)} measurable items in this scope` }
    : { state: "Connected, no items", tone: "ready", detail: "The source is connected, but this scope has no measurable items" };
const notYet = (detail: string): MatrixCell => ({ state: "Not yet", tone: "missing", detail });

function PersonaCards({ readings }: { readings: readonly ImpactReading[] }) {
    useVisualGuide({
        kind: "Persona cards",
        title: "One card per role",
        what: "Each role template, its process and the main measure it owns.",
        how: "The number is that process's main measure. The bar shows how many of its items could be measured; amber means under a quarter.",
    });
    return <div className="grid gap-400 md:grid-cols-2 xl:grid-cols-3">
        {impactPersonas.map(persona => {
            const reading = headlineFor(readings, persona.headline);
            return <article key={persona.name} aria-label={`${persona.name} persona`} className={cn(panel, "flex flex-col gap-300")}>
                <div><p className={cn(SMALL, "text-primary")}>{persona.process}</p><h3 className={cn(BODY, "mt-100 font-semibold")}>{persona.name}</h3></div>
                <div className="flex flex-col gap-100">
                    <p className={cn(SMALL, "text-muted-foreground")}>{reading.metric.name}</p>
                    <p className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">{amount(reading)}</p>
                </div>
                <Measurable reading={reading} />
                <p className={cn(SMALL, "mt-auto border-t border-border pt-200 text-muted-foreground")}>{persona.work}</p>
            </article>;
        })}
    </div>;
}

function Personas({ readings }: { readings: ImpactReading[] }) {
    return <Section id={stageAnchor("impact-personas")} title="Functional personas, grounded in the process" description="Six DataHub role templates, each tied to one SAP process. Roles are authored, not inferred from the source; headcount and AI use are withheld until membership is mapped.">
        <Chips items={["Role templates, not real people", "Headcount withheld", "AI use not mapped yet"]} />
        <PersonaCards readings={readings} />
        <StatusMatrix
            title="Only process data is connected so far"
            subtitle="What each persona has today. People, AI use, agents and cost appear once their mappings exist."
            columns={["Process data", "Role template", "People", "AI usage", "Agents", "AI cost"]}
            rows={impactPersonas.map(persona => ({
                label: persona.name, sub: persona.process, cells: [
                    processCell(headlineFor(readings, persona.headline)),
                    { state: "Template", tone: "partial", detail: "Authored by DataHub; not taken from the source" },
                    notYet("Needs approved role membership and identity mapping"),
                    notYet("Needs the people mapping first"),
                    notYet("Needs an approved agent-to-process mapping"),
                    notYet("Needs an allocation rule and finished-case counts"),
                ],
            }))}
        />
        <LiveDiscoveredPersonas />
        <Details title="More detail: how personas connect, and privacy">
            <PersonaLineage />
            <ImpactTable caption="What each persona still needs" headers={["Persona", "Process", "Bridge needed"]} rows={impactPersonas.map(persona => [persona.name, persona.process, persona.bridge])} />
            <p className="text-muted-foreground">Do not join a supplier, customer or document creator directly to an Entra user. An approved team-level bridge can support aggregate comparison first; person- or case-level attribution needs stronger keys and privacy controls.</p>
        </Details>
    </Section>;
}

const unmeasured = [
    ["Invoice receipt to payment", "A verified receipt timestamp and consistent invoice-to-clearing grain."],
    ["First-time invoice match", "Match-attempt events; tolerance flags alone remain a proxy."],
    ["Requisition to PO time", "Validated requisition-item / PO-item links and matching event dates."],
    ["Spend under contract", "An agreed spend denominator and currency-normalised amounts; item coverage is not spend coverage."],
    ["On-time delivery and close-cycle days", "Promised versus actual delivery events, and an approved accounting close calendar."],
    ["Discount capture and margin impact", "Validated financial definitions, eligibility, amounts and currency treatment."],
    ["AI-driven change and cost per case", "Rollout/comparison cohorts, agent-process mappings, allocation rules and completed-case keys."],
];

function Processes({ readings }: { readings: ImpactReading[] }) {
    return <Section id={stageAnchor("impact-processes")} title="Process outcomes with their denominators" description="Each measure uses only the items that have its data. Computed measures and proxies stay distinct.">
        <Chips items={["Line items, not completed cases", "Populations overlap: never add them", "Blank means no data, not zero"]} />
        <ReadingKey />
        <div className="grid gap-400 lg:grid-cols-[3fr_2fr]">
            <LiveRates readings={readings} />
            <LiveDays readings={readings} />
        </div>
        <LiveCoverage readings={readings} />
        <div className={cn(panel, "flex flex-col gap-300")}>
            <div className="flex flex-col gap-100">
                <h3 className={cn(BODY, "font-semibold")}>Not measured yet</h3>
                <p className={cn(SMALL, "text-muted-foreground")}>These outcomes need more source data or mapping. Hover over one for what it needs.</p>
            </div>
            <ul className="flex flex-wrap gap-200">
                {unmeasured.map(([name, need]) => <li key={name} title={need} className={cn(SMALL, "rounded-full border border-dashed border-border px-300 py-100 text-muted-foreground")}>{name}</li>)}
            </ul>
        </div>
        <Details title="More detail: all measures and what each missing one needs">
            <ImpactTable caption="Selected source-year scope. Counts are line items; these overlapping populations must not be added together." headers={["Process / measure", "Value", "Measurable / all items", "Evidence and definition"]} rows={readings.map(row => [
                <div key="metric"><p className="font-semibold">{row.metric.name}</p><p className="mt-100 text-muted-foreground">{row.metric.process}</p></div>,
                amount(row), `${whole(row.eligible)} / ${whole(row.population)}`,
                <div key="basis"><p className="font-semibold">{row.metric.availability}</p><p className="mt-100 text-muted-foreground">{row.metric.basis}</p></div>,
            ])} />
            <ImpactTable caption="What is not measured yet" headers={["Outcome", "Additional modelling, mapping or source needed"]} rows={unmeasured} />
        </Details>
    </Section>;
}

function Agents({ readings }: { readings: ImpactReading[] }) {
    return <Section id={stageAnchor("impact-agents")} title="Agents & automation" description="Which agents change which process steps, for which personas, and with what result. Process history is connected; agent mappings are not yet.">
        <Chips items={["Agent impact not measured yet", "No automation rate", "No agent savings claimed"]} />
        <AgentLineage />
        <StatusMatrix
            title="No process has an approved agent mapping yet"
            subtitle="What each process needs before an agent's effect on it can be measured."
            columns={["Process data", "Agent mapping", "Owner & version", "Run-to-case link", "Rollout date", "Comparison"]}
            rows={impactPersonas.map(persona => ({
                label: persona.process, sub: persona.name, cells: [
                    processCell(headlineFor(readings, persona.headline)),
                    notYet("Needs an approved agent-to-process classification"),
                    notYet("Needs a named owner and agent version"),
                    notYet("Needs stable case keys or event evidence"),
                    notYet("Needs an approved go-live date"),
                    notYet("Needs a baseline and a comparison period"),
                ],
            }))}
        />
        <AgentMeasurement />
        <p className={SMALL}>No agent sessions, headcounts or success rates are allocated to these processes. <a className={link} href="#/leaderboards/agents">Inspect the separate DataHub agent registry and usage</a></p>
        <Details title="More detail: candidate workflows and other AI surfaces">
            <ImpactTable caption="Candidate workflows, not observed agent deployments. Each role points to a process outcome, not an agent-attributed effect." headers={["Process / persona", "Work an agent could support", "Outcome to track", "Agent mapping"]} rows={impactPersonas.map(persona => [
                <div key="persona"><p className="font-semibold">{persona.process}</p><p className="mt-100 text-muted-foreground">{persona.name}</p></div>,
                persona.work, impactMetrics.find(metric => metric.id === persona.headline)!.name, "Not configured",
            ])} />
            <h3 className={cn(BODY, "font-semibold text-foreground")}>Beyond agents: Autopilots, Cowork and Copilot</h3>
            <SurfaceMap />
            <EvidenceBoundary />
        </Details>
    </Section>;
}

function MoneyViews() {
    useVisualGuide({
        kind: "Cards",
        title: "Three money views",
        how: "Each card is a separate view of money with its own basis. Never add or divide one by another.",
    });
    const views = [
        { label: "AI spend", value: "Tracked on Consumption", note: "What the AI tools cost.", href: "#/consumption", action: "View Consumption" },
        { label: "Estimated time saved", value: "Estimated on Value", note: "Behaviour-based estimates, not process records.", href: "#/value/estimated-value", action: "View estimated value" },
        { label: "Cost per completed case", value: "Not available", note: "Needs finished-case counts, same-period cost and an allocation rule." },
    ];
    return <div className="grid gap-400 md:grid-cols-3">
        {views.map(view => <div key={view.label} className={cn(panel, "flex flex-col gap-200", !view.href && "border-dashed")}>
            <p className={cn(SMALL, "text-muted-foreground")}>{view.label}</p>
            <p className={cn(BODY, "font-semibold", !view.href && "text-muted-foreground")}>{view.value}</p>
            <p className={cn(SMALL, "text-muted-foreground")}>{view.note}</p>
            {view.href && <a className={cn(SMALL, link, "mt-auto")} href={view.href}>{view.action}</a>}
        </div>)}
    </div>;
}

function Cost({ readings }: { readings: ImpactReading[] }) {
    return <Section id={stageAnchor("impact-cost")} title="Cost per transaction: define the denominator first" description="Business activity is available; allocated AI cost and finished-case counts are not. Spend is never divided by raw line items.">
        <Chips items={["Line items are not cases", "No AI cost allocated yet", "Three money views kept apart"]} />
        <LiveVolume rows={impactPersonas.map(persona => ({ Process: persona.process, Items: headlineFor(readings, persona.headline).population }))} />
        <MoneyViews />
        <Details title="More detail: candidate denominators">
            <ImpactTable caption="Candidate activity denominators, not completed transactions. Accounting and ledger populations overlap." headers={["Process", "Source line items", "AI cost allocation", "Cost per completed case"]} rows={impactPersonas.map(persona => [
                persona.process, whole(headlineFor(readings, persona.headline).population), "Not mapped", "Not available",
            ])} />
            <p className="text-muted-foreground">AI spend belongs to Consumption. Behaviour-based effort estimates belong to Value. Business impact needs an agreed case grain, the same time window, a documented allocation and outcome evidence before either becomes a cost-per-case or ROI figure.</p>
        </Details>
    </Section>;
}

interface Signal { persona: (typeof impactPersonas)[number]; row: ImpactReading }

function ReviewList({ ranked }: { ranked: readonly Signal[] }) {
    useVisualGuide(ranked.length === 0 ? null : {
        kind: "Ranked list",
        title: "Items to review, largest first",
        how: "Rows run from the most flagged items to the fewest. The bar shows the flagged share of that measure's measurable items. A count is a reason to look, not a saving.",
    });
    if (ranked.length === 0) return null;
    return <div className={cn(panel, "flex flex-col gap-300")}>
        <h3 className={cn(BODY, "font-semibold")}>Items to review, largest first</h3>
        <ol className="flex flex-col">
            {ranked.map(({ persona, row }) => {
                const share = row.exceptions! / row.eligible;
                return <li key={persona.name} className="grid gap-200 border-t border-border py-300 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center">
                    <div><p className={cn(SMALL, "font-semibold")}>{persona.process}</p><p className={cn(SMALL, "text-muted-foreground")}>{persona.signalLabel}</p></div>
                    <div className="flex flex-col gap-100">
                        <p className={SMALL}><strong className="font-numeric tabular-nums">{whole(row.exceptions!)}</strong> <span className="text-muted-foreground">items · {percent(share)} of {whole(row.eligible)} measurable</span></p>
                        <Meter share={share} />
                    </div>
                </li>;
            })}
        </ol>
    </div>;
}

function Opportunities({ readings }: { readings: ImpactReading[] }) {
    const { theme } = useThemeContext();
    const data = impactOpportunities(readings);
    const ranked = impactPersonas.flatMap(persona => {
        const row = readings.find(item => item.metric.id === persona.signal);
        return row && row.exceptions !== null && row.eligible > 0 ? [{ persona, row }] : [];
    }).sort((a, b) => b.row.exceptions! - a.row.exceptions!);
    return <Section id={stageAnchor("impact-opportunities")} title="Where to investigate next" description="Real exception counts from the source. High volume can justify a look; it is not a savings forecast.">
        <Chips items={["Exception counts, not savings", "Each signal means something different", "Check with the process owner"]} />
        {data.rows.length > 0 ? <div style={{ height: rowChartHeight(data.rows.length) }}>
            <VegaVisual label="Review signals by process" spec={processScorecard().vegaLiteSpec as VisualizationSpec} data={data} theme={theme} containerClassName={panel} header={{ title: "Review signals by process", subtitle: "Share of each measure's measurable items flagged for review. Each signal means something different, so don't rank them as one score." }} />
        </div> : <p className={SMALL}>No review signals with measurable items in the selected source year.</p>}
        <ReviewList ranked={ranked} />
        <Details title="More detail: ranked table and caveats">
            <ImpactTable caption="Ordered by observed line-item volume, not expected ROI. Review reasons and data coverage before choosing a pilot." headers={["Process / signal", "Items to review", "Share of measurable", "First action"]} rows={ranked.map(({ persona, row }) => [
                <div key="signal"><p className="font-semibold">{persona.process}</p><p className="mt-100 text-muted-foreground">{persona.signalLabel}</p></div>,
                whole(row.exceptions!), `${percent(row.exceptions! / row.eligible)} of ${whole(row.eligible)}`, persona.bridge,
            ])} />
            <p className="text-muted-foreground">A missing contract reference is not automatically noncompliance. A reversal is not automatically an error. Historical payment blocks may reflect the source snapshot or business rules. Confirm the interpretation with the process owner before recommending automation.</p>
        </Details>
    </Section>;
}

const joins: readonly [string, string, string][] = [
    ["Process source dates to calendar", "Connected", "Each fact follows its posting, creation or order date. Status flags remain snapshot observations, not historic as-of balances."],
    ["SAP teams to DataHub organisations", "Not configured", "Approved company / purchasing / sales-group to organisation bridge, with effective dates."],
    ["Functional persona to people", "Template only", "Role membership and privacy-approved identity mapping; no inference from supplier or customer IDs."],
    ["Agent to process or case", "Not configured", "Approved process classification and, for direct attribution, stable case keys or event evidence."],
    ["AI cost to process", "Not configured", "Same-period cost basis, currency, allocation rule and a verified completed-case denominator."],
    ["Business outcome to AI impact", "Not established", "Comparable populations, rollout dates, baseline and comparison periods, and uncertainty analysis."],
    ["D365 / Dataverse", "Later optional adapter", "A separately authorised source and its own entity, event and organisation mappings."],
];
const joinTone = (state: string): Tone => state === "Connected" ? "ready" : state === "Template only" ? "partial" : "missing";

function JoinTiles() {
    useVisualGuide({
        kind: "Status tiles",
        title: "How the optional sources connect",
        how: "One tile per join. Filled is connected, tinted is a template only, dashed is not set up yet. Hover over a tile for what it needs.",
    });
    return <div className={cn(panel, "flex flex-col gap-300")}>
        <div className="flex flex-col gap-100">
            <h3 className={cn(BODY, "font-semibold")}>How the optional sources connect</h3>
            <ToneLegend />
        </div>
        <ul className="grid gap-200 sm:grid-cols-2 xl:grid-cols-4">
            {joins.map(([name, state, need]) => <li key={name} title={need} className={cn(SMALL, "flex flex-col gap-100 rounded-md border p-300", TONE_STYLE[joinTone(state)])}>
                <span className="font-semibold">{name}</span>
                <span>{state}</span>
            </li>)}
        </ul>
    </div>;
}

function Method({ readings, history }: { readings: ImpactReading[]; history: HistoryState }) {
    return <Section id={stageAnchor("impact-method")} title="Data, joins and evidence boundaries" description="The optional model reads copied SAP process history on its own. Nothing in the source systems or existing DataHub models changes.">
        <Chips items={["Read-only queries", "Source systems unchanged", "Existing models unchanged"]} />
        <History state={history} />
        <JoinTiles />
        <LineOfSight detailed current={["process", "impact"]} />
        <Details title="More detail: join requirements, source coverage and limits">
            <ImpactTable caption="How the optional sources connect to DataHub" headers={["Join", "Current state", "Requirement"]} rows={joins.map(row => [...row])} />
            <ImpactTable caption="Source coverage, not ingestion freshness. Date ranges describe the underlying source table; counts describe the selected measure's population." headers={["Process", "Source items", "Measurable for main measure", "Source dates"]} rows={impactPersonas.map(persona => {
                const row = headlineFor(readings, persona.headline);
                return [persona.process, whole(row.population), whole(row.eligible), row.firstDate && row.lastDate ? `${row.firstDate} to ${row.lastDate}` : "No dated source rows"];
            })} />
            <p className="text-muted-foreground">The integrated ingestion installer is not implemented here.</p>
            <EvidenceBoundary />
        </Details>
    </Section>;
}

function ScopedScorecard({ year, history }: { year?: number; history: HistoryState }) {
    const result = useSemanticModelQuery({ ...processScorecard(year), lead: true });
    const failure = result.error?.message ?? (result.data?.status === "error" ? result.data.error.message : undefined);
    if (failure) return <QueryError message={failure} retry={() => void result.refetch()} />;
    if (result.isLoading || !result.data) return <div role="status" className="flex flex-col gap-400">
        <p className={SMALL}>Loading source-backed process measures...</p>
        <div aria-hidden="true" className="grid gap-400 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className={cn(panel, "aspect-square animate-pulse bg-muted")} />)}</div>
    </div>;
    if (result.data.status !== "success") return null;
    const readings = toImpactReadings(toDataTable(result.data.table, result.columnMetadata ?? processScorecard(year).columnMetadata));
    if (readings.length === 0 || readings.every(row => row.population === 0)) {
        return <p className={cn(panel, SMALL)}>No process items are available in this source-year scope. Choose another year or all source history.</p>;
    }
    return <div className="flex flex-col gap-600">
        <div className="flex justify-end"><button type="button" className={cn(button, SMALL)} onClick={() => void result.refetch()}>Refresh process measures</button></div>
        <StageRun hints={IMPACT_HINTS} open={["impact-processes", "impact-cost"]} stages={[
            ["impact-summary", () => <BottomLine readings={readings} history={history} />],
            ["impact-personas", () => <Personas readings={readings} />],
            ["impact-processes", () => <Processes readings={readings} />],
            ["impact-connect", LiveConnectStage],
            ["impact-agents", () => <Agents readings={readings} />],
            ["impact-cost", () => <Cost readings={readings} />],
            ["impact-opportunities", () => <Opportunities readings={readings} />],
            ["impact-method", () => <Method readings={readings} history={history} />],
        ]} />
    </div>;
}

/** One line for each detail row, so the closed row says what it holds. */
export function LiveBusinessImpactScreen() {
    const [year, setYear] = useState<number>();
    const result = useSemanticModelQuery(processHistory());
    const table = result.data?.status === "success" ? toDataTable(result.data.table, result.columnMetadata ?? processHistory().columnMetadata) : undefined;
    const yearIndex = table?.columns.findIndex(column => column.name === "Year") ?? -1;
    if (table && yearIndex < 0) throw new Error("Business impact history is missing the Year column.");
    const years = [...new Set(table?.rows.map(row => row[yearIndex]) ?? [])];
    if (years.some(value => typeof value !== "number" || !Number.isInteger(value))) throw new Error("Business impact history returned an invalid source year.");
    const history: HistoryState = {
        table, loading: result.isLoading,
        error: result.error?.message ?? (result.data?.status === "error" ? result.data.error.message : undefined),
        retry: () => void result.refetch(),
    };
    return <div className="flex flex-col gap-500">
        <div className={cn(panel, "flex flex-wrap items-center justify-between gap-300 border-primary/30 bg-primary/5")}>
            <div className="flex flex-col gap-100"><p className={cn(BODY, "font-semibold")}>Connected business process history</p><p className={cn(SMALL, "text-muted-foreground")}>Queried from the connected source. People/process joins and AI attribution are not established.</p></div>
            <label className={cn(SMALL, "flex items-center gap-200")}>Source year
                <select aria-label="Business impact source year" className={cn(button, "font-normal")} value={year ?? "all"} onChange={event => setYear(event.target.value === "all" ? undefined : Number(event.target.value))}>
                    <option value="all">All source history</option>
                    {years.sort((a, b) => Number(a) - Number(b)).map(value => <option key={String(value)} value={String(value)}>{String(value)}</option>)}
                </select>
            </label>
        </div>
        {history.error && <QueryError message={history.error} retry={history.retry} />}
        <ScopedScorecard key={year ?? "all"} year={year} history={history} />
    </div>;
}
