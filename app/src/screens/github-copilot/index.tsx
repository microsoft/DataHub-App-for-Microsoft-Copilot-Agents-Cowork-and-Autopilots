//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo, useState, type ReactNode } from "react";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { stageAnchor, type StageId } from "@/components/destinations";
import { KpiCard } from "@/components/kpi-card";
import { QueryEmpty } from "@/components/query-states";
import { Section } from "@/components/section";
import { SegmentedControl } from "@/components/segmented-control";
import { samples } from "@/demo/sample-data";
import { useFilterContext, useOrgAttribute } from "@/hooks/filter.context";
import { useStageFilter } from "@/hooks/stage-filter.context";
import { useHueColors } from "@/hooks/use-palette-theme";
import { shownDateRange } from "@/lib/filters";
import { formatKpi } from "@/lib/format-kpi";
import type { OrgAttribute } from "@/lib/org-attribute";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { ImpactTable as Table } from "../business-impact/impact-table";
import { Chart, panel } from "../cross-vendor/insights";
import { ExpansionMapView } from "../readiness/expansion-map";
import {
    ASSUMPTIONS,
    FEATURES,
    MODEL_CLASSES,
    RUNG_FALLBACKS,
    RUNG_MEANINGS,
    RUNG_VARS,
    RUNGS,
    STAGES,
    UPLIFT_CHOICES,
    analyse,
    estimateValue,
    generateGithubData,
    type GithubView,
    type GroupRow,
    type Rung,
} from "./data";

const data = generateGithubData(samples.people);

const pct = (v: number) => `${Math.round(v * 100)}%`;
const whole = (v: number) => formatKpi(v, "whole");
const usd = (v: number) => formatKpi(v, "currency", { prefix: "$" });
const day = (iso: string, year = true) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
const share = (part: number, total: number) => (total > 0 ? part / total : 0);
const link = "font-semibold text-primary underline-offset-4 hover:underline";
const LINE = ASSUMPTIONS.deepThreshold;

const STAGE_VARS = ["--vl-slate", "--vl-periwinkle-data", "--vl-teal"] as const;
const STAGE_FALLBACKS = ["#8793a3", "#7088b8", "#09b39d"] as const;
const CLASS_VARS = ["--vl-plum", "--vl-blue", "--vl-teal", "--vl-slate"] as const;
const CLASS_FALLBACKS = ["#7f215d", "#4f73b8", "#09b39d", "#8793a3"] as const;
const COST_VARS = ["--vl-navy", "--vl-amber"] as const;
const COST_FALLBACKS = ["#0b2c57", "#f1963a"] as const;
const COST_KINDS = ["Seats", "Premium requests over allowance"] as const;
const hue = (name: string, fallback: string) => `var(${name}, ${fallback})`;

/** The filtered view every stage reads: the app's date range and Group By selection. */
function useGithubView(): { view: GithubView; org: OrgAttribute } {
    const { filters, options } = useFilterContext();
    const org = useOrgAttribute();
    const range = shownDateRange(filters.dateRange, options);
    const from = range?.from;
    const to = range?.to;
    const view = useMemo(
        () => analyse(data, { from, to, attribute: org.column, values: filters.organizations }),
        [from, to, org.column, filters.organizations],
    );
    return { view, org };
}

const mockBadge = (
    <span className={cn(SMALL, "whitespace-nowrap rounded-full border border-border px-200 py-100 text-muted-foreground")}>
        Mock-up · synthetic data
    </span>
);

function Stage({ id, title, description, view, children }: { id: StageId; title: string; description: string; view: GithubView; children: ReactNode }) {
    return (
        <Section id={stageAnchor(id)} title={title} description={description} actions={mockBadge}>
            {view.empty ? (
                <QueryEmpty
                    className="h-[320px]"
                    title="No GitHub Copilot seats or activity in this selection"
                    description={`The mock-up covers ${day("2026-06-01")} to ${day("2026-08-30")}. Widen the dates or clear the Group By selection.`}
                />
            ) : (
                children
            )}
        </Section>
    );
}

const period = (view: GithubView) => `${day(view.from, false)} – ${day(view.to)}`;

function colorScale(field: string, domain: readonly string[], range: readonly string[], legend = true) {
    return {
        field,
        type: "nominal",
        title: null,
        scale: { domain: [...domain], range: [...range] },
        legend: legend ? { orient: "top", direction: "horizontal", labelLimit: 320 } : null,
    };
}
const orderBy = (field: string, domain: readonly string[]) => ({ calculate: `indexof(${JSON.stringify(domain)}, datum['${field}'])`, as: "order" });
const weekX = { field: "Week", type: "temporal", timeUnit: "utcyearmonthdate", title: null, axis: { format: "%d %b", labelAngle: 0 } };
// Bars need a band per week; a temporal axis draws each one a day wide. The visual caps band labels
// at the bar width, so charts using this turn that off (WEEK_BAND_CAPS) and let Vega thin overlaps.
const weekBand = { ...weekX, type: "ordinal", axis: { ...weekX.axis, labelOverlap: true, labelLimit: 80 } };
const NO_STACK_LABELS = { disableStackedDataLabels: true };
const WEEK_BAND_CAPS = { ...NO_STACK_LABELS, disableDynamicAxisLabelOverlap: true };

/** Horizontal bars by group, best first, with the line at 10% when the measure is a delegation share. */
function groupBars(field: string, title: string, label: string, colors: { above: string; below: string } | string, line?: number) {
    const color = typeof colors === "string"
        ? { value: colors }
        : { condition: { test: `datum['${field}'] > ${line ?? 0}`, value: colors.above }, value: colors.below };
    return {
        layer: [
            {
                mark: { type: "bar", cornerRadiusEnd: 2 },
                encoding: {
                    y: { field: label, type: "nominal", title: null, sort: "-x", axis: { labelLimit: 160 } },
                    x: { field, type: "quantitative", title, axis: { format: ".0%" } },
                    color,
                    tooltip: [{ field: label, type: "nominal" }, { field, type: "quantitative", format: ".0%", title }],
                },
            },
            ...(line === undefined
                ? []
                : [
                      { mark: { type: "rule", strokeDash: [4, 3], strokeWidth: 1.5 }, encoding: { x: { datum: line } } },
                      { mark: { type: "text", align: "left", dx: 4, dy: -4, baseline: "bottom", fontWeight: 600 }, encoding: { x: { datum: line }, y: { value: 0 }, text: { value: `The line, ${pct(line)}` } } },
                  ]),
        ],
    };
}
// Axis, legend and padding take about 110px whatever the row count.
const barHeight = (rows: number) => Math.max(220, rows * 30 + 110);

// ── At a glance (Overview) ──────────────────────────────────────────────

function SeatBar({ view }: { view: GithubView }) {
    const { licensed, active, habitual, deep } = view.funnel;
    const segments = [
        { label: "No activity in the range", count: licensed - active, color: hue("--vl-amber", "#f1963a"), href: "#/github-copilot/ghcp-optimise", action: "Review idle seats" },
        { label: STAGES[0], count: active - habitual, color: hue(STAGE_VARS[0], STAGE_FALLBACKS[0]), href: "#/github-copilot/ghcp-reach", action: "See reach and habit" },
        { label: STAGES[1], count: habitual - deep, color: hue(STAGE_VARS[1], STAGE_FALLBACKS[1]), href: "#/github-copilot/ghcp-expand", action: "Where to deepen next" },
        { label: STAGES[2], count: deep, color: hue(STAGE_VARS[2], STAGE_FALLBACKS[2]), href: "#/github-copilot/ghcp-value", action: "See the value" },
    ];
    return (
        <div className="flex flex-col gap-400">
            <div
                role="img"
                aria-label={`${whole(licensed)} seats: ${segments.map((s) => `${s.label}, ${whole(s.count)}`).join("; ")}`}
                className="flex h-500 w-full gap-[2px] overflow-hidden rounded-md"
            >
                {segments.filter((s) => s.count > 0).map((s) => (
                    <span key={s.label} className="h-full" style={{ flexGrow: s.count, flexBasis: 0, backgroundColor: s.color }} />
                ))}
            </div>
            <ul className="grid grid-cols-1 gap-400 sm:grid-cols-2 xl:grid-cols-4">
                {segments.map((s) => (
                    <li key={s.label} className="flex flex-col gap-100">
                        <span className="flex items-center gap-200">
                            <span aria-hidden="true" className="size-300 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                            <span className={cn(SMALL, "text-muted-foreground")}>{s.label}</span>
                        </span>
                        <span className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">
                            {whole(s.count)}
                            <span className={cn(SMALL, "ml-200 font-normal text-muted-foreground")}>{pct(share(s.count, licensed))} of seats</span>
                        </span>
                        <a href={s.href} className={cn(SMALL, link)}>{s.action}</a>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Summary() {
    const { view } = useGithubView();
    const value = estimateValue(view);
    return (
        <Stage id="ghcp-summary" view={view} title="GitHub Copilot at a glance" description="Seats, habit and depth for the people using GitHub Copilot, beside the Microsoft 365 Copilot story.">
            <div className={cn(panel, "flex flex-col gap-500")}>
                <div className="flex flex-wrap items-baseline justify-between gap-300">
                    <p className={cn(BODY, "max-w-[60ch]")}>
                        <span className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">{whole(view.funnel.deep)}</span>{" "}
                        of {whole(view.funnel.licensed)} seats are used above the line: handing GitHub Copilot whole tasks to plan, review or carry out.
                    </p>
                    <p className={cn(SMALL, "text-muted-foreground")}>{period(view)}</p>
                </div>
                <SeatBar view={view} />
            </div>
            <div className="grid grid-cols-1 gap-400 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="People using GitHub Copilot" value={view.funnel.active} detail={`${pct(share(view.funnel.active, view.funnel.licensed))} of ${whole(view.funnel.licensed)} seats`} />
                <KpiCard label="Delegation rate" value={view.delegationRate} format="percent" detail="Share of interactions above the line" />
                <KpiCard label="Cost in the range" value={view.cost.total} format="currency" prefix="$" detail={`Seats plus ${usd(view.cost.overage)} of premium requests over allowance`} />
                <KpiCard label="Estimated net value" value={value.net} format="currency" prefix="$" emphasis detail={`${formatKpi(share(value.value, value.investment), "multiple")} the investment, at a ${pct(ASSUMPTIONS.uplift)} uplift`} />
            </div>
        </Stage>
    );
}

// ── Reach & habit and Depth (Adoption) ──────────────────────────────────

function Funnel({ view }: { view: GithubView }) {
    const { licensed, active, habitual, deep } = view.funnel;
    const steps = [
        { label: "Seats", count: licensed, meaning: "Assigned a GitHub Copilot seat" },
        { label: "Active", count: active, meaning: "Used it at least once in the range" },
        { label: "Habitual", count: habitual, meaning: `Active in ${ASSUMPTIONS.habitWeeks} of the last ${ASSUMPTIONS.habitWindow} weeks` },
        { label: "Deep", count: deep, meaning: `Habitual, with over ${pct(LINE)} of their work above the line` },
    ];
    return (
        <ol aria-label="From seat to depth" className={cn(panel, "flex flex-col gap-400")}>
            {steps.map((step, i) => (
                <li key={step.label} className="flex flex-col gap-100">
                    <div className="flex items-baseline justify-between gap-300">
                        <span className={cn(BODY, "font-semibold")}>{step.label}</span>
                        <span className={cn(BODY, "font-numeric tabular-nums")}>
                            {whole(step.count)}
                            {i > 0 && <span className={cn(SMALL, "ml-200 text-muted-foreground")}>{pct(share(step.count, steps[i - 1].count))} of {steps[i - 1].label.toLowerCase()}</span>}
                        </span>
                    </div>
                    <div className="h-300 rounded-sm bg-muted">
                        <div className="h-full rounded-sm bg-primary" style={{ width: `${share(step.count, licensed) * 100}%` }} />
                    </div>
                    <span className={cn(SMALL, "text-muted-foreground")}>{step.meaning}</span>
                </li>
            ))}
        </ol>
    );
}

function Reach() {
    const { view, org } = useGithubView();
    const colors = useHueColors(STAGE_VARS) ?? STAGE_FALLBACKS;
    const spec = {
        transform: [orderBy("Stage", STAGES)],
        mark: { type: "bar", cornerRadiusEnd: 2 },
        encoding: {
            x: weekBand,
            y: { field: "People", type: "quantitative", stack: "zero", title: "People" },
            color: colorScale("Stage", STAGES, colors),
            order: { field: "order", type: "quantitative" },
            tooltip: [{ field: "Week", type: "temporal", format: "%d %b", title: "Week of" }, { field: "Stage", type: "nominal" }, { field: "People", type: "quantitative" }],
        },
    };
    return (
        <Stage id="ghcp-reach" view={view} title="Reach and habit" description="From seat to habit: who has a seat, who used it in the range, and who made it a weekly habit.">
            <div className="grid grid-cols-1 items-start gap-400 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Funnel view={view} />
                <Chart title="Active people each week, by stage" subtitle="Habit and depth read over the four weeks to each week" spec={spec} rows={view.weeklyStages} height={320} capabilities={WEEK_BAND_CAPS} />
            </div>
            <Table
                caption={`GitHub Copilot reach by ${org.noun}, ${period(view)}. Habit conversion is habitual people as a share of active people.`}
                headers={[org.label, "Seats", "Active", "Habitual", "Deep", "Activation", "Habit conversion", "Idle seats"]}
                rows={view.groups.map((g) => [<strong>{g.Group}</strong>, whole(g.Seats), whole(g.Active), whole(g.Habitual), whole(g.Deep), pct(g.Activation), pct(g["Habit conversion"]), whole(g["Idle seats"])])}
            />
        </Stage>
    );
}

function Ladder({ view }: { view: GithubView }) {
    const totals = new Map<Rung, number>();
    for (const row of view.weeklyRungs) totals.set(row.Rung, (totals.get(row.Rung) ?? 0) + row.Interactions);
    const all = [...totals.values()].reduce((a, b) => a + b, 0);
    const rung = (name: Rung) => {
        const index = RUNGS.indexOf(name);
        return (
            <li key={name} className="flex items-start gap-300 py-200">
                <span aria-hidden="true" className="mt-[3px] size-300 shrink-0 rounded-sm" style={{ backgroundColor: hue(RUNG_VARS[index], RUNG_FALLBACKS[index]) }} />
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn(BODY, "font-semibold")}>{name}</span>
                    <span className={cn(SMALL, "text-muted-foreground")}>{RUNG_MEANINGS[name]}</span>
                </span>
                <span className={cn(BODY, "shrink-0 font-numeric tabular-nums")}>{pct(share(totals.get(name) ?? 0, all))}</span>
            </li>
        );
    };
    return (
        <div className={cn(panel, "flex flex-col gap-100")}>
            <p className={cn(SMALL, "font-semibold text-muted-foreground")}>Above the line: a whole task is handed over</p>
            <ol aria-label="Rungs above the line">{(["Delegate", "Review"] as const).map(rung)}</ol>
            <div aria-hidden="true" className="flex items-center gap-200 py-100">
                <span className="flex-1 border-t-2 border-dashed border-foreground/50" />
                <span className={cn(SMALL, "font-semibold")}>The line</span>
                <span className="flex-1 border-t-2 border-dashed border-foreground/50" />
            </div>
            <ol aria-label="Rungs below the line">{(["Edit", "Suggest"] as const).map(rung)}</ol>
            <p className={cn(SMALL, "font-semibold text-muted-foreground")}>Below the line: Copilot assists, the person drives</p>
        </div>
    );
}

function Depth() {
    const { view, org } = useGithubView();
    const rungColors = useHueColors(RUNG_VARS) ?? RUNG_FALLBACKS;
    const stageColors = useHueColors(STAGE_VARS) ?? STAGE_FALLBACKS;
    const mix = {
        transform: [orderBy("Rung", RUNGS)],
        mark: { type: "area" },
        encoding: {
            x: weekX,
            y: { field: "Interactions", type: "quantitative", stack: "normalize", title: null, axis: { format: ".0%" } },
            color: colorScale("Rung", RUNGS, rungColors),
            order: { field: "order", type: "quantitative" },
            tooltip: [{ field: "Week", type: "temporal", format: "%d %b", title: "Week of" }, { field: "Rung", type: "nominal" }, { field: "Interactions", type: "quantitative", format: "," }],
        },
    };
    const groups = view.groups.filter((g) => g.Active > 0);
    return (
        <Stage id="ghcp-depth" view={view} title="Depth: how much work is handed over" description="Where people sit on the four rungs, and how many have crossed the line from assistance to delegation.">
            <div className="grid grid-cols-1 items-start gap-400 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Ladder view={view} />
                <Chart title="Interactions each week, by rung" subtitle="Share of all GitHub Copilot interactions" spec={mix} rows={view.weeklyRungs} height={320} />
            </div>
            <Chart
                title={`Delegation rate by ${org.noun}`}
                subtitle={`Review and Delegate interactions as a share of all. Above ${pct(LINE)} is above the line.`}
                spec={groupBars("Delegation rate", "Delegation rate", "Group", { above: stageColors[2], below: stageColors[0] }, LINE)}
                rows={groups}
                height={barHeight(groups.length)}
            />
            <div className="grid grid-cols-1 gap-400 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Acceptance, people above the line" value={view.acceptance.deep} format="percent" emphasis detail="Code completion suggestions kept" />
                <KpiCard label="Acceptance, everyone else" value={view.acceptance.rest} format="percent" detail={`${formatKpi((view.acceptance.deep - view.acceptance.rest) * 100, "hours")} points lower`} />
                <KpiCard label="Delegation rate" value={view.delegationRate} format="percent" detail="Everyone with a seat" />
                <KpiCard label="Tried agent mode or the CLI" value={view.agentAdoption} format="percent" detail="Share of active people" />
            </div>
        </Stage>
    );
}

// ── Seats & premium requests (Cost & consumption) ───────────────────────

function Cost() {
    const { view } = useGithubView();
    const costColors = useHueColors(COST_VARS) ?? COST_FALLBACKS;
    const classColors = useHueColors(CLASS_VARS) ?? CLASS_FALLBACKS;
    const monthly = {
        transform: [orderBy("Kind", COST_KINDS)],
        mark: { type: "bar", cornerRadiusEnd: 2 },
        encoding: {
            x: { field: "Month", type: "nominal", title: null, sort: [...new Set(view.cost.monthly.map((m) => m.Month))], axis: { labelAngle: 0 } },
            y: { field: "Cost", type: "quantitative", stack: "zero", title: null, axis: { format: "$,.0f" } },
            color: colorScale("Kind", COST_KINDS, costColors),
            order: { field: "order", type: "quantitative" },
            tooltip: [{ field: "Month", type: "nominal" }, { field: "Kind", type: "nominal", title: "Cost" }, { field: "Cost", type: "quantitative", format: "$,.0f", title: "Amount" }],
        },
    };
    const models = {
        mark: { type: "bar", cornerRadiusEnd: 2 },
        encoding: {
            y: { field: "Model", type: "nominal", title: null, sort: "-x", axis: { labelLimit: 160 } },
            x: { field: "Premium requests", type: "quantitative", title: null, axis: { format: ",.0f" } },
            color: colorScale("Class", MODEL_CLASSES, classColors),
            tooltip: [{ field: "Model", type: "nominal" }, { field: "Family", type: "nominal" }, { field: "Class", type: "nominal" }, { field: "Premium requests", type: "quantitative", format: "," }, { field: "Interactions", type: "quantitative", format: "," }],
        },
    };
    return (
        <Stage id="ghcp-cost" view={view} title="Seats and premium requests" description="What GitHub Copilot costs: seats at list price, plus premium requests beyond each plan's monthly allowance.">
            <div className="grid grid-cols-1 gap-400 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Total cost" value={view.cost.total} format="currency" prefix="$" emphasis detail={period(view)} />
                <KpiCard label="Seats" value={view.cost.seat} format="currency" prefix="$" detail={`${whole(view.funnel.licensed)} seats, Business $${ASSUMPTIONS.seatCost.Business} and Enterprise $${ASSUMPTIONS.seatCost.Enterprise} a month`} />
                <KpiCard label="Premium requests over allowance" value={view.cost.overage} format="currency" prefix="$" detail={`At $${ASSUMPTIONS.premiumPrice} a request`} />
                <KpiCard label="Premium requests" value={view.cost.premiumRequests} detail="After each model's multiplier" />
            </div>
            <div className="grid grid-cols-1 items-start gap-400 lg:grid-cols-2">
                <Chart title="Cost by month" subtitle="Seats and premium requests over allowance, prorated by week" spec={monthly} rows={view.cost.monthly} capabilities={NO_STACK_LABELS} />
                <Chart title="Premium requests by model" subtitle="Coloured by model class; code completion uses none" spec={models} rows={view.cost.byModel} height={Math.max(300, view.cost.byModel.length * 26)} />
            </div>
            <Table
                caption="Cost by cost centre, for chargeback. Seats map to cost centres through the HR data."
                headers={["Cost centre", "Seats", "Seat cost", "Premium requests", "Over allowance", "Total"]}
                rows={view.cost.byCostCentre.map((c) => [<strong>{c["Cost centre"]}</strong>, whole(c.Seats), usd(c["Seat cost"]), whole(c["Premium requests"]), usd(c.Overage), <strong>{usd(c.Total)}</strong>])}
            />
        </Stage>
    );
}

// ── Capacity & value (Value) ────────────────────────────────────────────

function Balance({ value, investment }: { value: number; investment: number }) {
    const most = Math.max(value, investment, 1);
    const rows = [
        { label: "Estimated value", amount: value, color: hue("--vl-teal", "#09b39d") },
        { label: "Investment: seats, premium requests and enablement", amount: investment, color: hue("--vl-navy", "#0b2c57") },
    ];
    return (
        <div className={cn(panel, "flex flex-col gap-400")} role="img" aria-label={rows.map((r) => `${r.label}: ${usd(r.amount)}`).join("; ")}>
            {rows.map((r) => (
                <div key={r.label} className="flex flex-col gap-100">
                    <div className="flex items-baseline justify-between gap-300">
                        <span className={cn(SMALL, "text-muted-foreground")}>{r.label}</span>
                        <span className={cn(BODY, "font-numeric font-semibold tabular-nums")}>{usd(r.amount)}</span>
                    </div>
                    <div className="h-400 rounded-sm bg-muted">
                        <div className="h-full rounded-sm" style={{ width: `${(Math.max(r.amount, 0) / most) * 100}%`, backgroundColor: r.color }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function Value() {
    const { view } = useGithubView();
    const [uplift, setUplift] = useState<string>(String(ASSUMPTIONS.uplift));
    const estimate = estimateValue(view, Number(uplift));
    const below = view.funnel.habitual - view.funnel.deep;
    return (
        <Stage id="ghcp-value" view={view} title="Capacity and value" description="Time handed back by the people working above the line, valued at a loaded salary, against what GitHub Copilot costs.">
            <div className="flex flex-wrap items-center gap-300">
                <span className={cn(SMALL, "text-muted-foreground")}>Time saved by people above the line</span>
                <SegmentedControl
                    label="Time saved by people above the line"
                    options={UPLIFT_CHOICES.map((c) => ({ id: String(c), label: pct(c) }))}
                    value={uplift}
                    onChange={setUplift}
                />
            </div>
            <div className="grid grid-cols-1 gap-400 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Capacity released (FTE)" value={estimate.capacity} format="hours" detail={`${whole(view.funnel.deep)} people above the line × ${pct(Number(uplift))}`} />
                <KpiCard label="Estimated value" value={estimate.value} format="currency" prefix="$" emphasis detail={`Over ${formatKpi(view.months, "hours")} months at $${whole(ASSUMPTIONS.loadedCost)} a year`} />
                <KpiCard label="Net value" value={estimate.net} format="currency" prefix="$" detail={`After ${usd(estimate.investment)} invested`} />
                <KpiCard label="Value for each $1 invested" value={share(estimate.value, estimate.investment)} format="multiple" detail="Value ÷ investment" />
            </div>
            <div className="grid grid-cols-1 items-start gap-400 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <Balance value={estimate.value} investment={estimate.investment} />
                <div className={cn(panel, "flex flex-col gap-200")}>
                    <p className={cn(BODY, "font-semibold")}>Still on the table</p>
                    <p className={BODY}>
                        <span className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">{usd(estimate.stillOnTableValue)}</span>
                    </p>
                    <p className={cn(SMALL, "text-muted-foreground")}>
                        {whole(below)} habitual {below === 1 ? "person is" : "people are"} still below the line. Moving them above it would release another {formatKpi(estimate.stillOnTable, "hours")} FTE at the same uplift.
                    </p>
                    <a href="#/github-copilot/ghcp-expand" className={cn(SMALL, link)}>Where to deepen next</a>
                </div>
            </div>
            <p className={cn(SMALL, "max-w-[90ch] text-muted-foreground")}>
                Only people above the line count towards value; occasional and assisted use is left out, so this is a floor. Investment adds ${ASSUMPTIONS.enablementPerSeat} of enablement per seat to seats and premium requests. The uplift and salary are planning assumptions, not measured savings.
            </p>
        </Stage>
    );
}

// ── Seats & model fit (Optimise) ────────────────────────────────────────

const IDLE_SHOWN = 8;

function Optimise() {
    const { view, org } = useGithubView();
    const classColors = useHueColors(CLASS_VARS) ?? CLASS_FALLBACKS;
    const groups = view.groups.filter((g) => g.Active > 0);
    const idle = view.idle.seats;
    return (
        <Stage id="ghcp-optimise" view={view} title="Seat and model fit" description="Seats nobody used, Enterprise seats that would fit Business, and powerful models spent on quick questions.">
            <div className="grid grid-cols-1 gap-400 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Idle seats" value={idle.length} emphasis detail={`${usd(view.idle.cost)} in the range, with no activity`} />
                <KpiCard label="Enterprise seats that fit Business" value={view.planFit.candidates} detail={`${usd(view.planFit.monthlySaving)} a month if moved`} />
                <KpiCard label="Powerful models on Suggest work" value={view.modelFit.powerfulSuggestShare} format="percent" detail="Share of Suggest chat" />
                <KpiCard label="Avoidable premium requests" value={view.modelFit.avoidableRequests} detail={`${usd(view.modelFit.avoidableRequests * ASSUMPTIONS.premiumPrice)} if a lightweight model answered`} />
            </div>
            <div className="grid grid-cols-1 items-start gap-400 lg:grid-cols-2">
                <Table
                    caption={idle.length > IDLE_SHOWN ? `Idle seats, costliest first. ${idle.length - IDLE_SHOWN} more not shown.` : "Idle seats, costliest first: reclaim or reassign."}
                    headers={["Person", org.label, "Plan", "Last active", "Cost in range"]}
                    rows={idle.slice(0, IDLE_SHOWN).map((s) => [s.name, s.group, s.plan, s.lastActive ? `Week of ${day(s.lastActive, false)}` : "None recorded", usd(s.cost)])}
                />
                <Chart
                    title={`Powerful models on Suggest work, by ${org.noun}`}
                    subtitle="Share of quick questions sent to a Powerful model"
                    spec={groupBars("Powerful share of Suggest work", "Powerful share", "Group", classColors[0])}
                    rows={groups}
                    height={barHeight(groups.length)}
                />
            </div>
            <p className={cn(SMALL, "max-w-[90ch] text-muted-foreground")}>
                Plan fit counts active Enterprise seats using fewer premium requests a month than the Business allowance of {whole(ASSUMPTIONS.allowance.Business)}. Avoidable requests price Powerful-model Suggest work at the lightweight multiplier instead.
            </p>
        </Stage>
    );
}

// ── Where to deepen next (Expand) ───────────────────────────────────────

const EXPAND_FIELDS = { score: "Habit score", people: "Below the line" };
const EXPAND_TITLES = { score: "Habit conversion (%)", people: "People below the line" };
const EXPAND_DETAILS = [
    { field: "Active", title: "Active people", format: "," },
    { field: "Deep share", title: "Above the line", format: ".0%" },
] as const;
const EXPAND_EMPTY = {
    title: (team: { plural: string }) => `No ${team.plural} with GitHub Copilot activity`,
    description: "Widen the dates or clear the Group By selection.",
};
const expandMethod = (noun: string) =>
    `Each ${noun} is placed by habit conversion, the share of its active people using GitHub Copilot in ${ASSUMPTIONS.habitWeeks} of the last ${ASSUMPTIONS.habitWindow} weeks, and sized by its people still below the line.`;
const expandTitle = (noun: string) => `Where to deepen next, by ${noun}`;

function expansionTable(groups: readonly GroupRow[]): DataTable {
    const columns = ["Organization", EXPAND_FIELDS.score, EXPAND_FIELDS.people, "Active", "Deep share"];
    const rows = groups
        .filter((g) => g.Active > 0)
        .map((g) => [g.Group, Math.round(g["Habit conversion"] * 100), g.Active - g.Deep, g.Active, share(g.Deep, g.Active)]);
    return { columns: columns.map((name) => ({ name })), rows } as unknown as DataTable;
}

function Expand() {
    const { view, org } = useGithubView();
    return (
        <Stage id="ghcp-expand" view={view} title="Where to deepen next" description="The teams with the habit and the headroom to move more people above the line, and the jobs that could use a seat.">
            <ExpansionMapView
                table={expansionTable(view.groups)}
                fields={EXPAND_FIELDS}
                titles={EXPAND_TITLES}
                unit="people below the line"
                details={EXPAND_DETAILS}
                method={expandMethod}
                empty={EXPAND_EMPTY}
                title={expandTitle}
            />
            {view.seatCandidates.length > 0 ? (
                <Table
                    caption="People without a seat, in the jobs where seat holders work above the line."
                    headers={[org.label, "People without a seat", "Jobs"]}
                    rows={view.seatCandidates.map((c) => [<strong>{c.Group}</strong>, whole(c.People), c.Jobs])}
                />
            ) : (
                <p className={cn(SMALL, "text-muted-foreground")}>Everyone in the jobs where seat holders work above the line already has a seat in this selection.</p>
            )}
        </Stage>
    );
}

// ── Models & autonomy (Governance) ──────────────────────────────────────

function Governance() {
    const { view, org } = useGithubView();
    const stageColors = useHueColors(STAGE_VARS) ?? STAGE_FALLBACKS;
    const groups = view.groups.filter((g) => g.Active > 0);
    const g = view.governance;
    const families = {
        mark: { type: "bar", cornerRadiusEnd: 2 },
        encoding: {
            y: { field: "Family", type: "nominal", title: null, sort: "-x" },
            x: { field: "Share", type: "quantitative", title: null, axis: { format: ".0%" } },
            tooltip: [{ field: "Family", type: "nominal" }, { field: "Share", type: "quantitative", format: ".0%" }, { field: "Interactions", type: "quantitative", format: "," }],
        },
    };
    return (
        <Stage id="ghcp-governance" view={view} title="Models and autonomy" description="How much code GitHub Copilot writes on its own, and how concentrated the model choices are, to review as use deepens.">
            <div className="grid grid-cols-1 gap-400 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Autonomous share" value={g.autonomousShare} format="percent" emphasis detail="Interactions where Copilot carried out the task" />
                <KpiCard label="Used agent mode or the CLI" value={view.agentAdoption} format="percent" detail="Share of active people" />
                <KpiCard label="Model families in use" value={g.familiesInUse} detail={`${g.topFamily.family} carries ${pct(g.topFamily.share)} of chat`} />
                <KpiCard label="Model not reported" value={g.unreportedShare} format="percent" detail="Chat on Auto, which reports no model" />
            </div>
            <div className="grid grid-cols-1 items-start gap-400 lg:grid-cols-2">
                <Chart
                    title={`Autonomous share by ${org.noun}`}
                    subtitle="Delegate interactions as a share of all"
                    spec={groupBars("Autonomous share", "Autonomous share", "Group", stageColors[2])}
                    rows={groups}
                    height={barHeight(groups.length)}
                />
                <Chart title="Chat by model family" subtitle={`${whole(g.modelsInUse)} models in use`} spec={families} rows={g.byFamily} height={barHeight(g.byFamily.length)} />
            </div>
            <Chart
                title="Delegation rate by language"
                subtitle="Where whole tasks are handed over most, for code review policy"
                spec={groupBars("Delegation rate", "Delegation rate", "Language", { above: stageColors[2], below: stageColors[0] }, LINE)}
                rows={g.byLanguage}
                height={barHeight(g.byLanguage.length)}
            />
        </Stage>
    );
}

// ── Data & method (Governance) ──────────────────────────────────────────

const DEFINITIONS: readonly [string, string][] = [
    ["Active", "At least one GitHub Copilot interaction in the range."],
    ["Habitual", `Active in ${ASSUMPTIONS.habitWeeks} of the ${ASSUMPTIONS.habitWindow} weeks to the range's last week.`],
    ["Deep", `Habitual, with over ${pct(LINE)} of those four weeks' interactions above the line.`],
    ["Delegation rate", "Review and Delegate interactions as a share of all interactions."],
    ["Autonomous share", "Delegate interactions as a share of all interactions."],
    ["Acceptance", "Code completion suggestions kept, as a share of those shown. Chat has no acceptance."],
    ["Premium requests", "Chat and agent requests, times the model's multiplier. Each plan includes a monthly allowance; the rest is billed."],
    ["Idle seat", "A seat with no interactions in the range."],
];

function Method() {
    const { view } = useGithubView();
    return (
        <Stage id="ghcp-method" view={view} title="Data and method" description="Where the GitHub Copilot figures come from and how each is defined.">
            <p className={cn(BODY, "max-w-[80ch]")}>
                Built for the Viva Insights GitHub Copilot export: one row per person, week, feature, model and language, joined to the same HR attributes as the rest of DataHub so the Group By slicer works across both. Every row in this mock-up is synthetic, generated for some of the demo&apos;s people.
            </p>
            <Table
                caption="The four rungs, and the features that fall on each."
                headers={["Rung", "What Copilot does", "Features"]}
                rows={RUNGS.map((r) => [<strong>{r}</strong>, RUNG_MEANINGS[r], FEATURES.filter((f) => f.rung === r).map((f) => f.label).join(", ")])}
            />
            <dl className={cn(panel, "grid gap-x-600 gap-y-300 sm:grid-cols-2")}>
                {DEFINITIONS.map(([term, meaning]) => (
                    <div key={term} className="flex flex-col gap-100">
                        <dt className={cn(BODY, "font-semibold")}>{term}</dt>
                        <dd className={cn(SMALL, "text-muted-foreground")}>{meaning}</dd>
                    </div>
                ))}
            </dl>
            <ul className={cn(SMALL, "flex max-w-[90ch] list-disc flex-col gap-100 pl-500 text-muted-foreground")}>
                <li>Seat prices are GitHub&apos;s list prices. Model multipliers, the uplift, salary and enablement cost are illustrative.</li>
                <li>Code completion reports no model, so model views cover chat and agent work only. Auto reports no model either, so its family is &ldquo;Not reported&rdquo;.</li>
                <li>Costs are prorated by week, so a range that starts or ends mid-month carries part of that month.</li>
                <li>Habit and depth need four weeks of history; the first weeks of a short range read as less habitual.</li>
            </ul>
        </Stage>
    );
}

export function GithubCopilotScreen() {
    const { show } = useStageFilter();
    const stages: [StageId, () => React.JSX.Element][] = [
        ["ghcp-summary", Summary], ["ghcp-reach", Reach], ["ghcp-depth", Depth], ["ghcp-cost", Cost], ["ghcp-value", Value],
        ["ghcp-optimise", Optimise], ["ghcp-expand", Expand], ["ghcp-governance", Governance], ["ghcp-method", Method],
    ];
    return (
        <div className="flex flex-col gap-600">
            {stages.map(([id, Screen]) => show(id) && <Screen key={id} />)}
        </div>
    );
}
