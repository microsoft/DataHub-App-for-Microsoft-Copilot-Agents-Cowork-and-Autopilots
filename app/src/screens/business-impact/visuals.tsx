//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo } from "react";
import { useVisualGuide } from "@/components/visual-guide";
import { useHueColors, useOutcomeColors } from "@/hooks/use-palette-theme";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { Chart } from "../cross-vendor/insights";
import { delta, EVIDENCE_MEANING, money, num, pct, READ_STYLE, whole } from "./format";
import {
    apTrend, attributableChange, availabilityMeaning, benefitLadder, coverage, costToServe, financialCategories, headlineMeasures, improvement, isConclusive, measureFor,
    measureKinds, personas, processAgents, processScorecard, readMeasure, rolloutDate, type Availability, type Evidence, type MeasureRead, type Measured, type ProcessAgent, type ProcessMeasure,
} from "./scenario";

export const panel = "rounded-xl border border-border bg-card p-500";

const EVIDENCE_STYLE: Record<Evidence, string> = {
    Estimated: "border-border bg-muted text-muted-foreground",
    Observed: "border-primary/40 bg-card text-primary",
    Attributable: "border-primary bg-primary text-primary-foreground",
};

export function EvidenceBadge({ level }: { level: Evidence }) {
    return <span title={EVIDENCE_MEANING[level]} className={cn(SMALL, "inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border px-200 py-100 font-semibold", EVIDENCE_STYLE[level])}>{level}</span>;
}

const AVAILABILITY_STYLE: Record<Availability, string> = {
    Computed: "border-primary/40 text-primary",
    Proxy: "border-border text-foreground",
    "Needs source": "border-border text-muted-foreground",
};

export function AvailabilityBadge({ level, basis }: { level: Availability; basis?: string }) {
    return <span title={basis ?? availabilityMeaning[level]} className={cn(SMALL, "inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border px-200 py-100", AVAILABILITY_STYLE[level])}>{level}</span>;
}

/** Short, always-visible caveats; longer wording lives in tooltips and More detail. */
export function Chips({ items }: { items: readonly string[] }) {
    return (
        <ul className="flex flex-wrap gap-200">
            {items.map(item => <li key={item} className={cn(SMALL, "rounded-full border border-border bg-muted px-300 py-100 text-muted-foreground")}>{item}</li>)}
        </ul>
    );
}

// ---- Colour -------------------------------------------------------------------------------------

const VERDICT_FALLBACK = { positive: "#09b39d", negative: "#f06549", caution: "#f1963a", neutral: "#8793a3" };
const useVerdicts = () => useOutcomeColors() ?? VERDICT_FALLBACK;

const READS: readonly MeasureRead[] = ["Improved", "Held", "Not conclusive", "Worse"];
function useReadScale(present?: readonly string[]) {
    const c = useVerdicts();
    const colours: Record<MeasureRead, string> = { Improved: c.positive, Held: c.neutral, "Not conclusive": c.caution, Worse: c.negative };
    const domain = READS.filter(r => !present || present.includes(r));
    return { domain, range: domain.map(r => colours[r]) };
}

const EVIDENCE_VARS = ["--vl-periwinkle", "--vl-blue", "--vl-navy"] as const;
const EVIDENCE_FALLBACK = ["#95a9ce", "#4f73b8", "#0b2c57"];
const AVAILABILITY_VARS = ["--vl-blue", "--vl-periwinkle", "--vl-slate"] as const;
const AVAILABILITY_FALLBACK = ["#4f73b8", "#95a9ce", "#8793a3"];
const PAIR_VARS = ["--vl-blue", "--vl-slate"] as const;
const PAIR_FALLBACK = ["#4f73b8", "#8793a3"];
const COST_VARS = ["--vl-blue", "--vl-periwinkle"] as const;
const COST_FALLBACK = ["#4f73b8", "#95a9ce"];
const DARK_TEXT = "#1a1a1a";

const AVAILABILITY_LEVELS = Object.keys(availabilityMeaning) as Availability[];
const EVIDENCE_LEVELS: Evidence[] = ["Estimated", "Observed", "Attributable"];

// ---- Helpers --------------------------------------------------------------------------------------

/** Adds Start, End and Mid so stacked bars and their labels are drawn from the same numbers. */
function stacked<T extends Record<string, unknown>>(rows: T[], group: keyof T, value: keyof T) {
    const totals = new Map<unknown, number>();
    return rows.map(r => {
        const start = totals.get(r[group]) ?? 0;
        const end = start + (r[value] as number);
        totals.set(r[group], end);
        return { ...r, Start: start, End: end, Mid: (start + end) / 2 };
    });
}

function stackedBars(group: string, series: string, scale: { domain: readonly string[]; range: readonly string[] }, axis: string) {
    const color = { field: series, type: "nominal", title: null, scale, legend: { orient: "top" } };
    return {
        layer: [
            { mark: { type: "bar", stroke: "white", strokeWidth: 1 }, encoding: { y: { field: group, type: "nominal", title: null, sort: null, axis: { labelLimit: 220 } }, x: { field: "Start", type: "quantitative", title: axis, axis: { tickMinStep: 1, format: "d" } }, x2: { field: "End" }, color, tooltip: [{ field: group }, { field: series }, { field: "Value", title: "Measures" }] } },
            { mark: { type: "text", fontSize: 11, color: DARK_TEXT }, encoding: { y: { field: group, type: "nominal", sort: null }, x: { field: "Mid", type: "quantitative" }, text: { field: "Value", type: "quantitative" } } },
        ],
    };
}

const fromTo = (m: Measured) => {
    const n = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });
    return m.unit === "%" ? `${n(m.baseline)}% → ${n(m.current)}%` : `${n(m.baseline)} → ${n(m.current)} ${m.unit}`;
};
const outcomes = processScorecard.filter(m => m.kind !== "Quality check");
const qualityChecks = processScorecard.filter(m => m.kind === "Quality check");

// ---- Bottom line ----------------------------------------------------------------------------------

export function ApTrend() {
    const pair = useHueColors(PAIR_VARS) ?? PAIR_FALLBACK;
    const ap = personas.find(p => p.id === "ap")!;
    const faster = Math.abs(attributableChange(ap)).toFixed(1);
    const group = { field: "Group", type: "nominal", title: null, scale: { domain: ["Pilot team (rolled out)", "Comparison team (not yet)"], range: pair }, legend: { orient: "top", labelLimit: 260 } };
    return (
        <Chart
            title={`Invoices reach payment ${faster} days faster than in a comparison team`}
            subtitle={`Weekly average days from invoice posting to payment. Copilot and the invoice exception agent reached the pilot team on ${rolloutDate}.`}
            rows={apTrend()}
            height={320}
            spec={{
                layer: [
                    { mark: { type: "line", strokeWidth: 2.5, point: true }, encoding: { x: { field: "Week", type: "temporal", title: null }, y: { field: "Days", type: "quantitative", title: "Days", scale: { zero: false } }, color: group, tooltip: [{ field: "Week", type: "temporal" }, { field: "Group" }, { field: "Days", type: "quantitative", format: ".1f" }] } },
                    { data: { values: [{ Rollout: rolloutDate }] }, mark: { type: "rule", strokeDash: [4, 4] }, encoding: { x: { field: "Rollout", type: "temporal" } } },
                    { data: { values: [{ Rollout: rolloutDate, Label: "Rollout" }] }, mark: { type: "text", align: "left", dx: 4, dy: -6, baseline: "top" }, encoding: { x: { field: "Rollout", type: "temporal" }, y: { value: 0 }, text: { field: "Label" } } },
                ],
            }}
        />
    );
}

export function OutcomeLollipop() {
    const reads = useMemo(() => headlineMeasures.map(m => ({
        Measure: m.measure, Zero: 0, Effect: +(improvement(m, attributableChange(m)) / Math.abs(m.baseline)).toFixed(3), Read: readMeasure(m), Change: fromTo(m),
    })).sort((a, b) => b.Effect - a.Effect), []);
    const scale = useReadScale(reads.map(r => r.Read));
    const top = Math.max(...reads.map(r => r.Effect));
    const domain = [Math.min(0, ...reads.map(r => r.Effect * 1.2)), top * 1.7];
    const x = { field: "Effect", type: "quantitative", title: "Improvement beyond comparison, share of baseline", axis: { format: ".0%" }, scale: { domain } };
    const y = { field: "Measure", type: "nominal", title: null, sort: null, axis: { labelLimit: 230 } };
    const color = { field: "Read", type: "nominal", title: null, scale, legend: { orient: "top" } };
    const improved = reads.filter(r => r.Read === "Improved").length;
    return (
        <Chart
            title={`${improved} of ${reads.length} headline measures beat their comparison`}
            subtitle="Before → after. Improved means clear of the 90% interval."
            rows={reads}
            height={340}
            spec={{
                layer: [
                    { mark: { type: "rule", strokeWidth: 3 }, encoding: { y, x: { field: "Zero", type: "quantitative", scale: { domain }, title: x.title }, x2: { field: "Effect" }, color } },
                    { mark: { type: "circle", size: 170, opacity: 1 }, encoding: { y, x, color, tooltip: [{ field: "Measure" }, { field: "Change", title: "Before → after" }, { field: "Effect", type: "quantitative", format: ".1%", title: "Beyond comparison" }, { field: "Read" }] } },
                    { mark: { type: "text", align: "left", dx: 12, fontSize: 11 }, encoding: { y, x, text: { field: "Change" } } },
                    { data: { values: [{ Zero: 0 }] }, mark: { type: "rule", strokeDash: [3, 3] }, encoding: { x: { field: "Zero", type: "quantitative", scale: { domain } } } },
                ],
            }}
        />
    );
}

export function ReadScoreboard() {
    const scale = useReadScale();
    const rows = useMemo(() => stacked(
        measureKinds.flatMap(kind => READS.map(read => ({ Kind: kind, Read: read, Value: processScorecard.filter(m => m.kind === kind && readMeasure(m) === read).length }))).filter(r => r.Value > 0),
        "Kind", "Value"), []);
    const improved = outcomes.filter(m => readMeasure(m) === "Improved").length;
    const held = qualityChecks.filter(m => readMeasure(m) !== "Worse").length;
    return (
        <Chart
            title={`${improved} of ${outcomes.length} outcomes improved, ${held} of ${qualityChecks.length} quality checks held`}
            subtitle={`All ${processScorecard.length} measures, by type. Quality checks only need to hold.`}
            rows={rows}
            height={340}
            spec={stackedBars("Kind", "Read", scale, "Measures")}
        />
    );
}

/** The same AP result at three levels of evidence, climbing from planning figure to comparison-adjusted estimate. */
export function EvidenceLadder() {
    useVisualGuide({
        kind: "Evidence ladder",
        title: "One AP result, three levels of evidence",
        what: "The same accounts-payable result, worked out three ways.",
        how: "Taller boxes to the right mean stronger evidence. Read each box on its own; they are never added together.",
    });
    const tone = ["border-border bg-muted", "border-primary/40 bg-card", "border-primary bg-primary/10"];
    return (
        <figure aria-label="One result at three levels of evidence" className={cn(panel, "flex flex-col gap-300")}>
            <figcaption className={cn(BODY, "font-semibold")}>One AP result, three levels of evidence</figcaption>
            <ol className="grid grid-cols-1 items-end gap-300 sm:grid-cols-3">
                {benefitLadder.map((rung, i) => (
                    <li key={rung.level} title={rung.basis} className={cn("flex flex-col justify-between gap-200 rounded-lg border p-400", tone[i])} style={{ minHeight: 104 + i * 52 }}>
                        <EvidenceBadge level={rung.level} />
                        <span className={cn(SMALL, "text-muted-foreground")}>{rung.label}</span>
                        <span className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">{rung.value}</span>
                    </li>
                ))}
            </ol>
            <p className={cn(SMALL, "text-muted-foreground")}>Stronger evidence, left to right. Each level stands alone and is never added to another. Separate from the Value page's cohort; its totals do not reconcile to that page.</p>
            <details className={SMALL}>
                <summary className="w-fit cursor-pointer font-semibold">How each level is calculated</summary>
                <dl className="mt-200 flex flex-col gap-200">
                    {benefitLadder.map(rung => <div key={rung.level}><dt className="font-semibold">{rung.level}: {rung.label}</dt><dd className="text-muted-foreground">{rung.basis}</dd></div>)}
                </dl>
            </details>
        </figure>
    );
}

export interface DumbbellPoint { name: string; value: number; tone: "start" | "expected" | "end" }
export interface DumbbellRow { label: string; sub?: string; unit: string; points: readonly DumbbellPoint[] }

const DOT: Record<DumbbellPoint["tone"], string> = {
    start: "border-primary bg-card",
    expected: "border-dashed border-muted-foreground bg-card",
    end: "border-primary bg-primary",
};

/** Before and after for measures in different units, each on its own scale. */
export function Dumbbells({ rows, legend }: { rows: readonly DumbbellRow[]; legend: readonly DumbbellPoint["tone"][] }) {
    const names: Record<DumbbellPoint["tone"], string> = { start: "Before", expected: "Expected without rollout", end: "After" };
    useVisualGuide({
        kind: "Dumbbell chart",
        title: rows.length === 1 ? rows[0].label : "Before and after, by measure",
        what: "Where each measure started and where it ended.",
        how: legend.includes("expected")
            ? "Hollow dot: before. Filled dot: after. Dashed dot: what the comparison group suggests would have happened anyway. Each row has its own scale, so compare within a row, not across rows."
            : "Hollow dot: before. Filled dot: after. Each row has its own scale, so compare within a row, not across rows.",
    });
    return (
        <div className="flex flex-col gap-300">
            <ul className="flex flex-col gap-300">
                {rows.map(row => {
                    const values = row.points.map(p => p.value);
                    const lo = Math.min(...values), hi = Math.max(...values), pad = (hi - lo) * 0.35 || hi * 0.1 || 1;
                    const at = (v: number) => ((v - lo + pad) / (hi - lo + pad * 2)) * 100;
                    const first = row.points.find(p => p.tone === "start")!, last = row.points.find(p => p.tone === "end")!;
                    return (
                        <li key={row.label} className="grid items-center gap-200 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,8rem)] sm:gap-400">
                            <div className="flex flex-col"><span className={cn(SMALL, "font-semibold")}>{row.label}</span>{row.sub && <span className={cn(SMALL, "text-muted-foreground")}>{row.sub}</span>}</div>
                            <div role="img" aria-label={`${row.label}: ${row.points.map(p => `${names[p.tone]} ${num(p.value, row.unit)}`).join(", ")}`} className="relative h-[28px]">
                                <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-border" />
                                <span aria-hidden="true" className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-primary/30" style={{ left: `${at(lo)}%`, width: `${at(hi) - at(lo)}%` }} />
                                {row.points.map(p => <span key={p.tone} aria-hidden="true" title={`${names[p.tone]}: ${num(p.value, row.unit)}`} className={cn("absolute top-1/2 size-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2", DOT[p.tone])} style={{ left: `${at(p.value)}%` }} />)}
                            </div>
                            <span className={cn(SMALL, "font-numeric font-semibold tabular-nums sm:text-right")}>{num(first.value, row.unit)} → {num(last.value, row.unit)}</span>
                        </li>
                    );
                })}
            </ul>
            <ul className={cn(SMALL, "flex flex-wrap gap-x-400 gap-y-100 text-muted-foreground")} aria-label="Marker key">
                {legend.map(tone => <li key={tone} className="flex items-center gap-200"><span aria-hidden="true" className={cn("size-[10px] rounded-full border-2", DOT[tone])} />{names[tone]}</li>)}
            </ul>
        </div>
    );
}

// ---- Personas -------------------------------------------------------------------------------------

export function PersonaAdoption() {
    const measures = ["Copilot active", "Using agents", "Habit (weekly 3+ days)"];
    const rows = personas.flatMap(p => [["Copilot active", p.copilotActive], ["Using agents", p.agentUsers], ["Habit (weekly 3+ days)", p.habit]].map(([Measure, Share]) => ({ Persona: p.name, Measure, Share })));
    const lead = [...personas].sort((a, b) => b.agentUsers - a.agentUsers)[0];
    return (
        <Chart
            title={`${lead.name}s lead on agents (${pct(lead.agentUsers)})`}
            subtitle="Share of people: Copilot-active, using agents, weekly habit"
            rows={rows}
            height={400}
            spec={{
                mark: { type: "bar", cornerRadiusEnd: 2 },
                encoding: {
                    y: { field: "Persona", type: "nominal", title: null, sort: null, axis: { labelLimit: 200 } }, yOffset: { field: "Measure", sort: measures },
                    x: { field: "Share", type: "quantitative", title: null, axis: { format: ".0%" }, scale: { domain: [0, 1] } },
                    color: { field: "Measure", type: "nominal", title: null, sort: measures, legend: { orient: "top", labelLimit: 200 } },
                    tooltip: [{ field: "Persona" }, { field: "Measure" }, { field: "Share", type: "quantitative", format: ".0%" }],
                },
            }}
        />
    );
}

export function PersonaHours() {
    const colours = useHueColors(EVIDENCE_VARS) ?? EVIDENCE_FALLBACK;
    const rows = useMemo(() => personas.map(p => ({
        Persona: p.name, Hours: Math.round(p.people * p.estHoursPerPerson), Evidence: p.evidence,
        Outcome: delta(attributableChange(p), p.unit) + (isConclusive(p) ? "" : " · not conclusive"),
    })).sort((a, b) => b.Hours - a.Hours), []);
    const total = rows.reduce((sum, r) => sum + r.Hours, 0);
    const top = Math.max(...rows.map(r => r.Hours));
    const y = { field: "Persona", type: "nominal", title: null, sort: null, axis: { labelLimit: 200 } };
    const x = { field: "Hours", type: "quantitative", title: "Expert-equivalent hours a month", axis: { format: "," }, scale: { domain: [0, top * 1.55] } };
    return (
        <Chart
            title={`${whole(total)} expert-equivalent hours a month`}
            subtitle="An estimate, not a saving. Colour is evidence strength."
            rows={rows}
            height={400}
            spec={{
                layer: [
                    { mark: { type: "bar", cornerRadiusEnd: 2 }, encoding: { y, x, color: { field: "Evidence", type: "nominal", title: null, sort: EVIDENCE_LEVELS, scale: { domain: EVIDENCE_LEVELS, range: colours }, legend: { orient: "top" } }, tooltip: [{ field: "Persona" }, { field: "Hours", type: "quantitative", format: "," }, { field: "Evidence" }, { field: "Outcome" }] } },
                    { mark: { type: "text", align: "left", dx: 6, fontSize: 11 }, encoding: { y, x: { field: "Hours", type: "quantitative", scale: { domain: [0, top * 1.55] } }, text: { field: "Outcome" } } },
                ],
            }}
        />
    );
}

// ---- Processes ------------------------------------------------------------------------------------

const processNames = [...new Set(processScorecard.map(m => m.process))];

export function ProcessIntervals() {
    const rows = useMemo(() => personas.map(p => {
        const effect = improvement(p, attributableChange(p)) / Math.abs(p.baseline);
        const half = p.interval / Math.abs(p.baseline);
        const read: MeasureRead = !isConclusive(p) ? "Not conclusive" : effect > 0 ? "Improved" : "Worse";
        return { Process: `${p.process} · ${p.kpi}`, Effect: +effect.toFixed(3), Low: +(effect - half).toFixed(3), High: +(effect + half).toFixed(3), Read: read, Change: delta(attributableChange(p), p.unit) };
    }).sort((a, b) => b.Effect - a.Effect), []);
    const scale = useReadScale(rows.map(r => r.Read));
    const improved = rows.filter(r => r.Read === "Improved").length;
    const domain = [Math.min(0, ...rows.map(r => r.Low)) * 1.15, Math.max(...rows.map(r => r.High)) * 1.45];
    const y = { field: "Process", type: "nominal", title: null, sort: null, axis: { labelLimit: 280 } };
    const x = { type: "quantitative", title: "Improvement beyond the comparison group, share of baseline", axis: { format: ".0%" }, scale: { domain } };
    const color = { field: "Read", type: "nominal", title: null, scale, legend: { orient: "top" } };
    return (
        <Chart
            title={`${improved} of ${rows.length} process KPIs improved beyond the comparison group`}
            subtitle="Dot is the estimate, bar the 90% interval. Clear of zero and to the right is conclusive."
            rows={rows}
            height={300}
            spec={{
                layer: [
                    { mark: { type: "rule", strokeWidth: 3 }, encoding: { y, x: { ...x, field: "Low" }, x2: { field: "High" }, color } },
                    { mark: { type: "circle", size: 150, opacity: 1 }, encoding: { y, x: { ...x, field: "Effect" }, color, tooltip: [{ field: "Process" }, { field: "Change", title: "Beyond comparison" }, { field: "Effect", type: "quantitative", format: ".1%" }, { field: "Low", type: "quantitative", format: ".1%" }, { field: "High", type: "quantitative", format: ".1%" }] } },
                    { mark: { type: "text", align: "left", dx: 8, fontSize: 11 }, encoding: { y, x: { ...x, field: "High" }, text: { field: "Change" } } },
                    { data: { values: [{ Zero: 0 }] }, mark: { type: "rule", strokeDash: [3, 3] }, encoding: { x: { field: "Zero", type: "quantitative", scale: { domain } } } },
                ],
            }}
        />
    );
}

export function ProcessKindHeatmap() {
    const rows = processNames.flatMap(process => measureKinds.flatMap(kind => {
        const ms = processScorecard.filter(m => m.process === process && m.kind === kind);
        if (!ms.length) return [];
        const good = ms.filter(m => kind === "Quality check" ? readMeasure(m) !== "Worse" : readMeasure(m) === "Improved").length;
        return [{ Process: process, Kind: kind, Good: good, Total: ms.length, Share: good / ms.length, Label: `${good}/${ms.length}` }];
    }));
    return (
        <Chart
            title="Where the evidence is conclusive"
            subtitle="Improved out of tracked, by process and type"
            rows={rows}
            height={340}
            spec={{
                encoding: { x: { field: "Kind", type: "nominal", title: null, sort: measureKinds, axis: { orient: "top", labelAngle: 0 } }, y: { field: "Process", type: "nominal", title: null, sort: null, axis: { labelLimit: 200 } } },
                layer: [
                    { mark: { type: "rect", stroke: "white", strokeWidth: 2 }, encoding: { color: { field: "Share", type: "quantitative", legend: null, scale: { domain: [0, 1], scheme: "blues" } }, tooltip: [{ field: "Process" }, { field: "Kind" }, { field: "Good", title: "Improved or held" }, { field: "Total", title: "Tracked" }] } },
                    { mark: { type: "text", fontSize: 12 }, encoding: { text: { field: "Label" }, color: { condition: { test: "datum['Share'] > 0.55", value: "white" }, value: "black" } } },
                ],
            }}
        />
    );
}

export function AvailabilityByProcess() {
    const colours = useHueColors(AVAILABILITY_VARS) ?? AVAILABILITY_FALLBACK;
    const rows = useMemo(() => stacked(
        processNames.flatMap(process => AVAILABILITY_LEVELS.map(level => ({ Process: process, Availability: level, Value: processScorecard.filter(m => m.process === process && m.availability === level).length }))).filter(r => r.Value > 0),
        "Process", "Value"), []);
    const needs = processScorecard.filter(m => m.availability === "Needs source").length;
    return (
        <Chart
            title={`${needs} of ${processScorecard.length} measures still need a source`}
            subtitle="Computed from source, a proxy, or waiting on a source"
            rows={rows}
            height={340}
            spec={stackedBars("Process", "Availability", { domain: AVAILABILITY_LEVELS, range: colours }, "Measures")}
        />
    );
}

// ---- Agents ---------------------------------------------------------------------------------------

const MODE_BAND: Record<ProcessAgent["mode"], string> = {
    "Human-assisted": "bg-muted-foreground/25",
    "Human-approved": "bg-primary/30",
    "Straight-through": "bg-primary/60",
};
const LANE_COLS = "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]";

/** Agent → process step → persona → process outcome, one lane per agent. Band thickness is sessions; colour is intended mode. */
export function AgentLanes({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
    const max = Math.max(...processAgents.map(a => a.sessions));
    const modes = Object.keys(MODE_BAND) as ProcessAgent["mode"][];
    useVisualGuide({
        kind: "Lane diagram",
        title: "Which agent changes which process step",
        what: "Each row follows one agent: the process step it changes, the persona who owns that step, and that process's outcome.",
        how: "Band colour is how far the agent is meant to automate; a thicker band means more sessions. The outcome is for the whole process, not credit for the agent. Select a row to see that agent below.",
    });
    return (
        <div className={cn(panel, "flex flex-col gap-300")}>
            <div className="flex flex-wrap items-center justify-between gap-200">
                <h3 className={cn(BODY, "font-semibold")}>Which agent changes which process step</h3>
                <ul className={cn(SMALL, "flex flex-wrap gap-x-400 gap-y-100 text-muted-foreground")} aria-label="Band key: intended mode and sessions">
                    {modes.map(mode => <li key={mode} className="flex items-center gap-200"><span aria-hidden="true" className={cn("h-[8px] w-[24px] rounded-full", MODE_BAND[mode])} />{mode}</li>)}
                    <li>Thicker band, more sessions</li>
                </ul>
            </div>
            <div role="radiogroup" aria-label="Agent" className="flex flex-col gap-200">
                <div aria-hidden="true" className={cn(SMALL, "hidden gap-400 px-300 text-muted-foreground lg:grid", LANE_COLS)}>
                    <span>Agent</span><span>Process step it changes</span><span>Persona</span><span>Process outcome (not agent-specific)</span>
                </div>
                {processAgents.map((a, i) => {
                    const persona = personas.find(p => p.id === a.persona)!;
                    const m = measureFor(persona);
                    const cell = "relative flex min-w-0 flex-col gap-100 rounded-md border border-border bg-card px-300 py-200";
                    return (
                        <label key={a.name} className={cn("relative grid cursor-pointer gap-200 rounded-lg border p-300 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring lg:items-center lg:gap-400", LANE_COLS, selected === i ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}>
                            <input type="radio" name="agent" className="sr-only" checked={selected === i} onChange={() => onSelect(i)} />
                            <span aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 lg:block", MODE_BAND[a.mode])} style={{ height: 4 + (a.sessions / max) * 20 }} />
                            <span className={cell}><span className={cn(BODY, "font-semibold")}>{a.name}</span><span className={cn(SMALL, "text-muted-foreground")}>{a.origin} · {whole(a.sessions)} sessions</span></span>
                            <span className={cell}><span className={SMALL}>{a.step}</span><span className={cn(SMALL, "text-muted-foreground")}>{a.process}</span></span>
                            <span className={cell}><span className={cn(SMALL, "font-semibold")}>{persona.name}</span><span className={cn(SMALL, "text-muted-foreground")}>{persona.people} people</span></span>
                            <span className={cell}>
                                <span className={SMALL}>{m?.measure}</span>
                                {m && <span className={cn(SMALL, "font-semibold tabular-nums")}>{delta(attributableChange(m), m.unit)} <span className={READ_STYLE[readMeasure(m)]}>· {readMeasure(m)}</span></span>}
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

export function AgentOutcomeDumbbell({ measure }: { measure: ProcessMeasure }) {
    return (
        <Dumbbells
            legend={["start", "expected", "end"]}
            rows={[{ label: "Process outcome", sub: "12 weeks before vs after", unit: measure.unit, points: [
                { name: "Before", value: measure.baseline, tone: "start" },
                { name: "Expected without rollout", value: measure.baseline + measure.comparisonChange, tone: "expected" },
                { name: "After", value: measure.current, tone: "end" },
            ] }]}
        />
    );
}

export function AgentReadiness() {
    const state = {
        yes: "Ready", due: "Due", no: "Missing", none: "Not instrumented",
    } as const;
    const checks = ["Mapped", "Owner", "Review", "Case IDs", "Verified"];
    const detail: Record<string, string> = { Mapped: "Mapped to a process", Owner: "Owner named", Review: "Review current", "Case IDs": "Runs linked to case IDs", Verified: "Completion verified" };
    const rows = processAgents.flatMap(a => [
        { Agent: a.name, Check: checks[0], State: state.yes },
        { Agent: a.name, Check: checks[1], State: a.owner ? state.yes : state.no },
        { Agent: a.name, Check: checks[2], State: a.review === "Up to date" ? state.yes : a.review === "Due" ? state.due : state.no },
        { Agent: a.name, Check: checks[3], State: a.linkedCases ? state.yes : state.none },
        { Agent: a.name, Check: checks[4], State: state.none },
    ]).map(r => ({ ...r, Detail: detail[r.Check], Mark: r.State === state.none ? "–" : r.State === state.yes ? "✓" : r.State }));
    const c = useVerdicts();
    return (
        <Chart
            title="No agent can yet show verified completed cases"
            subtitle="What each agent needs before its business impact can be read"
            rows={rows}
            height={300}
            spec={{
                encoding: { x: { field: "Check", type: "nominal", title: null, sort: checks,                 axis: { orient: "top", labelAngle: 0, labelLimit: 120 } }, y: { field: "Agent", type: "nominal", title: null, sort: null, axis: { labelLimit: 200 } } },
                layer: [
                                    { mark: { type: "rect", stroke: "white", strokeWidth: 2 }, encoding: { color: { field: "State", type: "nominal", title: null, scale: { domain: Object.values(state), range: [c.positive, c.caution, c.negative, c.neutral] }, legend: { orient: "bottom", columns: 4, labelLimit: 140 } }, tooltip: [{ field: "Agent" }, { field: "Detail", title: "Check" }, { field: "State" }] } },
                                    { mark: { type: "text", fontSize: 11, color: DARK_TEXT }, encoding: { text: { field: "Mark" } } },
                ],
            }}
        />
    );
}

export function AgentSessionsCases() {
    const rows = processAgents.flatMap(a => [
        { Agent: a.name, Measure: "Sessions", Count: a.sessions, Note: "" },
        { Agent: a.name, Measure: "Linked cases", Count: a.linkedCases ?? null, Note: a.linkedCases ? "" : "Not instrumented" },
    ]);
    const colours = useHueColors(COST_VARS) ?? COST_FALLBACK;
    const y = { field: "Agent", type: "nominal", title: null, sort: null, axis: { labelLimit: 200 } };
    const measures = ["Sessions", "Linked cases"];
    return (
        <Chart
            title="Sessions are not cases"
            subtitle="Agent sessions against runs linked to a case ID, last 30 days"
            rows={rows}
            height={300}
            spec={{
                layer: [
                    { transform: [{ filter: "datum.Count !== null" }], mark: { type: "bar", cornerRadiusEnd: 2 }, encoding: { y, yOffset: { field: "Measure", sort: measures }, x: { field: "Count", type: "quantitative", title: null, axis: { format: "~s" } }, color: { field: "Measure", type: "nominal", title: null, sort: measures, scale: { domain: measures, range: colours }, legend: { orient: "top" } }, tooltip: [{ field: "Agent" }, { field: "Measure" }, { field: "Count", type: "quantitative", format: "," }] } },
                    { transform: [{ filter: "datum.Note !== ''" }], mark: { type: "text", align: "left", dx: 6, fontSize: 11, fontStyle: "italic" }, encoding: { y, yOffset: { field: "Measure", sort: measures }, x: { datum: 0, type: "quantitative" }, text: { field: "Note" } } },
                ],
            }}
        />
    );
}

// ---- Cost -----------------------------------------------------------------------------------------

export function CostStack() {
    const colours = useHueColors(COST_VARS) ?? COST_FALLBACK;
    const rows = useMemo(() => {
        const costs = costToServe();
        const stackedRows = stacked(costs.flatMap(r => [{ Process: r.process, Cost: "Agent", Value: r.agentCost, Total: r.agentCost + r.licenceCost, Per: r.costPerTransaction }, { Process: r.process, Cost: "Copilot licences", Value: r.licenceCost, Total: r.agentCost + r.licenceCost, Per: r.costPerTransaction }]), "Process", "Value");
        return stackedRows.map(r => ({ ...r, Label: r.Cost === "Copilot licences" ? `${money(r.Per)} per transaction` : "" }));
    }, []);
    const top = Math.max(...rows.map(r => r.End));
    const y = { field: "Process", type: "nominal", title: null, sort: null, axis: { labelLimit: 200 } };
    const domain = [0, top * 1.8];
    return (
        <Chart
            title="Monthly AI cost and cost per transaction"
            subtitle="Agent credits plus Copilot licence share, scenario prices"
            rows={rows}
            height={300}
            spec={{
                layer: [
                    { mark: { type: "bar", stroke: "white", strokeWidth: 1 }, encoding: { y, x: { field: "Start", type: "quantitative", title: "USD a month", axis: { format: "$,.0f" }, scale: { domain } }, x2: { field: "End" }, color: { field: "Cost", type: "nominal", title: null, scale: { domain: ["Agent", "Copilot licences"], range: colours }, legend: { orient: "top" } }, tooltip: [{ field: "Process" }, { field: "Cost" }, { field: "Value", type: "quantitative", format: "$,.0f" }] } },
                    { transform: [{ filter: "datum.Label !== ''" }], mark: { type: "text", align: "left", dx: 6, fontSize: 11 }, encoding: { y, x: { field: "End", type: "quantitative", scale: { domain } }, text: { field: "Label" } } },
                ],
            }}
        />
    );
}

export function CostPerCase() {
    const rows = costToServe().map(r => ({ Agent: r.agent, Zero: 0, Cost: r.costPerLinkedCase ?? null, Label: r.costPerLinkedCase === undefined ? "Needs case IDs" : money(r.costPerLinkedCase) }));
    const top = Math.max(...rows.map(r => r.Cost ?? 0));
    const domain = [0, top * 1.45];
    const y = { field: "Agent", type: "nominal", title: null, sort: null, axis: { labelLimit: 200 } };
    const has = { filter: "datum.Cost !== null" };
    const x = { field: "Cost", type: "quantitative", title: "USD per linked case", axis: { format: "$,.2f" }, scale: { domain } };
    return (
        <Chart
            title="Agent cost per linked case"
            subtitle="Credits ÷ runs linked to a case ID. Not a verified success."
            rows={rows}
            height={300}
            spec={{
                layer: [
                    { transform: [has], mark: { type: "rule", strokeWidth: 3 }, encoding: { y, x: { field: "Zero", type: "quantitative", scale: { domain }, title: x.title }, x2: { field: "Cost" } } },
                    { transform: [has], mark: { type: "circle", size: 170, opacity: 1 }, encoding: { y, x, tooltip: [{ field: "Agent" }, { field: "Label", title: "Cost per linked case" }] } },
                    { transform: [has], mark: { type: "text", align: "left", dx: 12, fontSize: 11 }, encoding: { y, x, text: { field: "Label" } } },
                    { transform: [{ filter: "datum.Cost === null" }], mark: { type: "text", align: "left", dx: 6, fontSize: 11, fontStyle: "italic" }, encoding: { y, x: { field: "Zero", type: "quantitative", scale: { domain } }, text: { field: "Label" } } },
                ],
            }}
        />
    );
}

const VALUE_KIND: Record<string, string> = {
    "Released capacity": "Hours",
    "Working capital": "One-off cash timing",
    "Cash savings": "Recurring cash",
    "Avoided cost": "Recurring cost avoided",
};

/** Four kinds of value side by side; deliberately no total. */
export function ValueStrip() {
    useVisualGuide({
        kind: "Value tiles",
        title: "Value, kept in four units",
        what: "Four kinds of value the scenario could show.",
        how: "Each tile is a different kind of money, so they are never added up into one total or ROI. The tag under each figure says what kind it is.",
    });
    return (
        <section aria-label="Value, kept in four units" className={cn(panel, "flex flex-col gap-300")}>
            <ul className="grid divide-border sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
                {financialCategories.map(c => (
                    <li key={c.category} title={c.note} className="flex flex-col gap-100 py-200 sm:px-400 sm:first:pl-0 sm:last:pr-0">
                        <span className={cn(SMALL, "text-muted-foreground")}>{c.category}</span>
                        <span className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">{c.value}</span>
                        <span className={cn(SMALL, "w-fit rounded-full border border-border px-200 py-100 text-muted-foreground")}>{VALUE_KIND[c.category]}</span>
                    </li>
                ))}
            </ul>
            <p className={cn(SMALL, "text-muted-foreground")}>Different kinds of money, so no total and no single ROI.</p>
            <details className={SMALL}>
                <summary className="w-fit cursor-pointer font-semibold">What each one means</summary>
                <dl className="mt-200 flex flex-col gap-200">{financialCategories.map(c => <div key={c.category}><dt className="font-semibold">{c.category}</dt><dd className="text-muted-foreground">{c.note}</dd></div>)}</dl>
            </details>
        </section>
    );
}

// ---- Method ---------------------------------------------------------------------------------------

export function CoverageBars() {
    const rows = [
        { Coverage: "Cost centres mapped", Share: coverage.costCentresMapped, Detail: "Sample SAP cost centres with a DataHub org group" },
        { Coverage: "People with a persona", Share: coverage.peopleWithPersona, Detail: "Finance, procurement and sales staff" },
        { Coverage: "Agents mapped to a process", Share: coverage.agentsMapped / coverage.agentsTotal, Detail: `${coverage.agentsMapped} of ${coverage.agentsTotal} agents` },
    ].map(r => ({ ...r, Zero: 0, Label: pct(r.Share) }));
    const y = { field: "Coverage", type: "nominal", title: null, sort: null, axis: { labelLimit: 200 } };
    const domain = [0, 1.12];
    return (
        <Chart
            title="How much of the scenario is mapped"
            subtitle="Cost centres, people and agents joined to an org group, persona or process"
            rows={rows}
            height={220}
            spec={{
                layer: [
                    { mark: { type: "bar", cornerRadiusEnd: 2 }, encoding: { y, x: { field: "Share", type: "quantitative", title: null, axis: { format: ".0%", values: [0, 0.25, 0.5, 0.75, 1] }, scale: { domain } }, tooltip: [{ field: "Coverage" }, { field: "Detail" }, { field: "Label", title: "Mapped" }] } },
                    { mark: { type: "text", align: "left", dx: 6, fontSize: 11 }, encoding: { y, x: { field: "Share", type: "quantitative", scale: { domain } }, text: { field: "Label" } } },
                ],
            }}
        />
    );
}

export function StepFlow() {
    useVisualGuide({
        kind: "Step flow",
        title: "How the module would be set up",
        what: "The four setup steps, in order.",
        how: "Read left to right. These are planned steps, not a working setup form.",
    });
    const steps = [
        ["Choose a source", "SAP process tables in Fabric, or D365 through a separate adapter. Planned, not implemented here."],
        ["Approve three mappings", "Teams to org groups, job titles to personas, agent IDs to processes."],
        ["Load weekly KPIs", "An adapter would write impact_kpi_weekly. This preview reads local fixtures."],
        ["Pick a comparison group", "Before each rollout, so the estimate is fair."],
    ];
    return (
        <ol aria-label="How the module would be set up" className="grid gap-300 sm:grid-cols-2 xl:grid-cols-4">
            {steps.map(([title, detail], i) => (
                <li key={title} className="flex gap-300 rounded-lg border border-border bg-card p-400">
                    <span aria-hidden="true" className={cn(SMALL, "grid size-[28px] shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground")}>{i + 1}</span>
                    <div className="flex min-w-0 flex-col gap-100"><span className={cn(BODY, "font-semibold")}>{title}</span><span className={cn(SMALL, "text-muted-foreground")}>{detail}</span></div>
                </li>
            ))}
        </ol>
    );
}
