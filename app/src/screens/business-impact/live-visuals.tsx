//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

// Charts for the connected view. Every value comes from the source readings;
// nothing here is synthetic, and days and rates never share an axis.

import type { ReactNode } from "react";
import { useHueColors, useOutcomeColors } from "@/hooks/use-palette-theme";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import type { ImpactReading } from "@/queries/business-impact";
import { useVisualGuide } from "@/components/visual-guide";
import { Chart } from "../cross-vendor/insights";

export const panel = "rounded-xl border border-border bg-card p-500";

const VERDICT_FALLBACK = { positive: "#09b39d", negative: "#f06549", caution: "#f1963a", neutral: "#8793a3" };
const AVAILABILITY_VARS = ["--vl-blue", "--vl-periwinkle"] as const;
const AVAILABILITY_FALLBACK = ["#4f73b8", "#95a9ce"];
const AVAILABILITY = ["Computed", "Proxy"];
/** Below this share of its population, a measure speaks for few of the items. */
export const LOW_COVERAGE = 0.25;

export const whole = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });
export const percent = (value: number) => `${(value * 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const share1 = (value: number) => `${(value * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
export const days = (value: number) => `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} days`;
export const amount = (reading: ImpactReading) => reading.value === null ? "Not available" :
    reading.metric.unit === "percent" ? percent(reading.value) : days(reading.value);
export const coverage = (reading: ImpactReading) => reading.population === 0 ? 0 : reading.eligible / reading.population;

/** Prose and tables stay one click away, so each stage leads with a picture. */
export function Details({ title, children }: { title: string; children: ReactNode }) {
    return (
        <details className={SMALL}>
            <summary className="w-fit cursor-pointer font-semibold">{title}</summary>
            <div className="mt-300 flex flex-col gap-400">{children}</div>
        </details>
    );
}

/** A thin share bar; the figure beside it carries the readable value. */
export function Meter({ share, low = false }: { share: number; low?: boolean }) {
    const c = useOutcomeColors() ?? VERDICT_FALLBACK;
    const width = `${Math.min(1, Math.max(0, share)) * 100}%`;
    return (
        <div aria-hidden="true" className="h-200 rounded-sm bg-muted">
            <div className={cn("h-full rounded-sm", !low && "bg-primary")} style={{ width, backgroundColor: low ? c.caution : undefined }} />
        </div>
    );
}

const percentRows = (readings: readonly ImpactReading[]) => readings.filter(r => r.metric.unit === "percent" && r.value !== null);
const dayRows = (readings: readonly ImpactReading[]) => readings.filter(r => r.metric.unit === "days" && r.value !== null);
const tip = [
    { field: "Measure" }, { field: "Process" }, { field: "Label", title: "Value" },
    { field: "Availability" }, { field: "Eligible", title: "Measurable items" },
];
const measureAxis = { field: "Measure", type: "nominal", title: null, sort: null, axis: { labelLimit: 240 } };
const plotHeight = (rows: number) => rows * 34 + 40;

/** Rate measures, each a share of its own eligible items. */
export function LiveRates({ readings }: { readings: readonly ImpactReading[] }) {
    const colours = useHueColors(AVAILABILITY_VARS) ?? AVAILABILITY_FALLBACK;
    const rows = percentRows(readings).map(r => ({
        Measure: r.metric.name, Process: r.metric.process, Value: r.value!, Label: percent(r.value!),
        Availability: r.metric.availability, Eligible: whole(r.eligible),
    }));
    if (rows.length === 0) return <p className={cn(panel, SMALL)}>No rate measure has measurable items in this scope.</p>;
    const x = { field: "Value", type: "quantitative", title: null, scale: { domain: [0, 1.2] }, axis: { format: ".0%", values: [0, 0.25, 0.5, 0.75, 1] } };
    return (
        <Chart
            title="Share of items with each condition"
            subtitle="Each bar uses its own measurable items. Higher is not always better."
            rows={rows}
            height={plotHeight(rows.length)}
            spec={{
                encoding: { y: measureAxis },
                layer: [
                    { mark: { type: "bar", cornerRadiusEnd: 2 }, encoding: { x, color: { field: "Availability", type: "nominal", title: null, scale: { domain: AVAILABILITY, range: colours }, legend: { orient: "top" } }, tooltip: tip } },
                    { mark: { type: "text", align: "left", dx: 6, fontSize: 11 }, encoding: { x, text: { field: "Label" } } },
                ],
            }}
        />
    );
}

/** Elapsed-day measures, on their own axis. */
export function LiveDays({ readings }: { readings: readonly ImpactReading[] }) {
    const colours = useHueColors(AVAILABILITY_VARS) ?? AVAILABILITY_FALLBACK;
    const rows = dayRows(readings).map(r => ({
        Measure: r.metric.name, Process: r.metric.process, Value: r.value!, Label: days(r.value!),
        Availability: r.metric.availability, Eligible: whole(r.eligible),
    }));
    if (rows.length === 0) return <p className={cn(panel, SMALL)}>No day measure has measurable items in this scope.</p>;
    const x = { field: "Value", type: "quantitative", title: null, scale: { domain: [0, Math.max(...rows.map(r => r.Value)) * 1.35] }, axis: { format: ",.0f" } };
    return (
        <Chart
            title="Average days between two steps"
            subtitle="Only items with both dates. Not full end-to-end time."
            rows={rows}
            height={plotHeight(rows.length)}
            spec={{
                encoding: { y: { ...measureAxis, axis: { labelLimit: 200 } } },
                layer: [
                    { mark: { type: "bar", cornerRadiusEnd: 2 }, encoding: { x, color: { field: "Availability", type: "nominal", title: null, scale: { domain: AVAILABILITY, range: colours }, legend: null }, tooltip: tip } },
                    { mark: { type: "text", align: "left", dx: 6, fontSize: 11 }, encoding: { x, text: { field: "Label" } } },
                ],
            }}
        />
    );
}

/** How much of each population a measure can speak for. */
export function LiveCoverage({ readings }: { readings: readonly ImpactReading[] }) {
    const c = useOutcomeColors() ?? VERDICT_FALLBACK;
    const [blue] = useHueColors(AVAILABILITY_VARS) ?? AVAILABILITY_FALLBACK;
    const rows = readings.filter(r => r.population > 0).map(r => {
        const share = coverage(r);
        return {
            Measure: r.metric.name, Process: r.metric.process, Share: share, Label: share1(share),
            Coverage: share < LOW_COVERAGE ? "Under a quarter measurable" : "A quarter or more measurable",
            Counts: `${whole(r.eligible)} of ${whole(r.population)}`,
        };
    });
    if (rows.length === 0) return null;
    const low = rows.filter(r => r.Share < LOW_COVERAGE).length;
    const x = { field: "Share", type: "quantitative", title: null, scale: { domain: [0, 1.15] }, axis: { format: ".0%", values: [0, 0.25, 0.5, 0.75, 1] } };
    return (
        <Chart
            title={low === 0 ? "Every measure covers at least a quarter of its items" : `${low} of ${rows.length} ${rows.length === 1 ? "measure covers" : "measures cover"} under a quarter of their items`}
            subtitle="Items with the data a measure needs, out of all its items. Short bars: read with care."
            rows={rows}
            height={plotHeight(rows.length)}
            spec={{
                encoding: { y: measureAxis },
                layer: [
                    { mark: { type: "bar", cornerRadiusEnd: 2 }, encoding: { x, color: { field: "Coverage", type: "nominal", title: null, scale: { domain: ["A quarter or more measurable", "Under a quarter measurable"], range: [blue, c.caution] }, legend: { orient: "top", symbolLimit: 20, labelLimit: 220 } }, tooltip: [{ field: "Measure" }, { field: "Process" }, { field: "Counts", title: "Measurable of all items" }, { field: "Label", title: "Measurable" }] } },
                    { mark: { type: "text", align: "left", dx: 6, fontSize: 11 }, encoding: { x, text: { field: "Label" } } },
                ],
            }}
        />
    );
}

/** Source line items per process: candidate denominators only. */
export function LiveVolume({ rows }: { rows: readonly { Process: string; Items: number }[] }) {
    const [blue] = useHueColors(AVAILABILITY_VARS) ?? AVAILABILITY_FALLBACK;
    const data = rows.filter(r => r.Items > 0).map(r => ({ ...r, Label: whole(r.Items) }));
    if (data.length === 0) return <p className={cn(panel, SMALL)}>No source line items in this scope.</p>;
    const x = { field: "Items", type: "quantitative", title: null, scale: { type: "log", domain: [Math.min(...data.map(r => r.Items)) / 2, Math.max(...data.map(r => r.Items)) * 12] }, axis: { format: "~s", tickCount: 6 } };
    return (
        <Chart
            title="Source line items by process"
            subtitle="Line items, not finished cases. They overlap, so don't add them. Log scale."
            rows={data}
            height={plotHeight(data.length)}
            spec={{
                encoding: { y: { field: "Process", type: "nominal", title: null, sort: null, axis: { labelLimit: 200 } } },
                layer: [
                    { mark: { type: "bar", cornerRadiusEnd: 2, color: blue }, encoding: { x, tooltip: [{ field: "Process" }, { field: "Label", title: "Source line items" }] } },
                    { mark: { type: "text", align: "left", dx: 6, fontSize: 11 }, encoding: { x, text: { field: "Label" } } },
                ],
            }}
        />
    );
}

export type Tone = "ready" | "partial" | "missing";
export interface MatrixCell { state: string; tone: Tone; detail?: string }
export interface MatrixRow { label: string; sub?: string; cells: readonly MatrixCell[] }

export const TONE_STYLE: Record<Tone, string> = {
    ready: "border-primary bg-primary text-primary-foreground",
    partial: "border-primary/50 bg-primary/10 text-primary",
    missing: "border-dashed border-border text-muted-foreground",
};

const LEGEND: readonly { tone: Tone; label: string }[] = [
    { tone: "ready", label: "Connected" },
    { tone: "partial", label: "Template only" },
    { tone: "missing", label: "Not yet configured" },
];

/** Says once what the filled, tinted and dashed cells mean. */
export function ToneLegend() {
    return (
        <ul aria-label="Key" className={cn(SMALL, "flex flex-wrap gap-x-400 gap-y-100 text-muted-foreground")}>
            {LEGEND.map(item => (
                <li key={item.tone} className="flex items-center gap-100">
                    <span aria-hidden="true" className={cn("inline-block size-[12px] rounded-sm border", TONE_STYLE[item.tone])} />
                    {item.label}
                </li>
            ))}
        </ul>
    );
}

/** A readable status grid: what is connected, templated or still missing, row by row. */
export function StatusMatrix({ title, subtitle, columns, rows }: { title: string; subtitle: string; columns: readonly string[]; rows: readonly MatrixRow[] }) {
    useVisualGuide({
        kind: "Status grid",
        title,
        what: subtitle,
        how: "One row per process, one column per data link. A filled cell is connected, a tinted cell is a template only, a dashed cell is not configured yet. Hover over a cell for what it still needs.",
    });
    return (
        <div className={cn(panel, "flex flex-col gap-300")}>
            <div className="flex flex-col gap-100">
                <h3 className={cn(BODY, "font-semibold")}>{title}</h3>
                <p className={cn(SMALL, "text-muted-foreground")}>{subtitle}</p>
            </div>
            <ToneLegend />
            <div role="region" aria-label={`${title}, scrolls sideways on a narrow screen`} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <table className={cn(SMALL, "w-full min-w-[44rem] border-collapse text-left")}>
                    <caption className="sr-only">{title}</caption>
                    <thead className="text-muted-foreground">
                        <tr>
                            <th scope="col" className="w-48 py-200 pr-300 font-semibold"><span className="sr-only">Row</span></th>
                            {columns.map(column => <th key={column} scope="col" className="px-100 py-200 text-center align-bottom font-semibold">{column}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.label} className="border-t border-border">
                                <th scope="row" className="py-200 pr-300 text-left font-normal">
                                    <strong>{row.label}</strong>
                                    {row.sub && <span className="block text-muted-foreground">{row.sub}</span>}
                                </th>
                                {row.cells.map((cell, index) => (
                                    <td key={columns[index]} className="p-100">
                                        <span title={cell.detail} className={cn("flex min-h-10 items-center justify-center rounded-md border px-200 py-100 text-center font-semibold", TONE_STYLE[cell.tone])}>{cell.state}</span>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const TERMS = [
    { term: "Measurable items", meaning: "items that have the data a measure needs" },
    { term: "Computed", meaning: "worked out directly from the source fields" },
    { term: "Proxy", meaning: "a close stand-in where no direct field exists" },
] as const;

/** Defines the three words the connected charts rely on, once, in a line. */
export function ReadingKey() {
    return (
        <dl aria-label="Reading key" className={cn(SMALL, "flex flex-wrap gap-x-500 gap-y-100 text-muted-foreground")}>
            {TERMS.map(item => (
                <div key={item.term} className="flex gap-100">
                    <dt className="font-semibold text-foreground">{item.term}:</dt>
                    <dd>{item.meaning}</dd>
                </div>
            ))}
        </dl>
    );
}
