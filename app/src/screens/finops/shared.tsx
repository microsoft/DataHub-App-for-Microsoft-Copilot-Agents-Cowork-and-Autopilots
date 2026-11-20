//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { stageAnchor, type StageId } from "@/components/destinations";
import { QueryEmpty } from "@/components/query-states";
import { Section } from "@/components/section";
import { SegmentedControl } from "@/components/segmented-control";
import { useFilterContext } from "@/hooks/filter.context";
import { useHueColors } from "@/hooks/use-palette-theme";
import { shownDateRange } from "@/lib/filters";
import { SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { shortDay, type View, type Window, type WaterfallStep } from "./analysis";
import {
    BASES,
    BASIS_MEANINGS,
    DATA_FROM,
    DATA_TO,
    PROVIDERS,
    PROVIDER_FALLBACKS,
    PROVIDER_VARS,
    generateFinopsData,
    type Basis,
    type FeedStatus,
    type ProviderChoice,
} from "./data";

export const data = generateFinopsData();

// ── Formatting ──────────────────────────────────────────────────────────

export const usd = (v: number) => `${v < 0 ? "−" : ""}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
export const usdShort = (v: number) => {
    const a = Math.abs(v);
    const sign = v < 0 ? "−" : "";
    if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
    if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}k`;
    if (a >= 1000) return `${sign}$${(a / 1000).toFixed(1)}k`;
    return `${sign}$${Math.round(a)}`;
};
export const usdSmall = (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(Math.abs(v) < 10 ? 2 : 0)}`;
export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
export const signedPct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(0)}%`;
export const whole = (v: number) => Math.round(v).toLocaleString("en-US");
export const day = (iso: string, year = true) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
export const period = (w: Window) => `${day(w.from, false)} – ${day(w.to)}`;
export const link = "font-semibold text-primary underline-offset-4 hover:underline";
export const hue = (name: string, fallback: string) => `var(${name}, ${fallback})`;
export { shortDay };

// ── Palette ─────────────────────────────────────────────────────────────

const ROLE_VARS = ["--vl-navy", "--vl-teal", "--vl-amber", "--vl-plum", "--vl-slate", "--vl-blue"] as const;
const ROLE_FALLBACKS = ["#0b2c57", "#09b39d", "#f1963a", "#7f215d", "#8793a3", "#4f73b8"] as const;
export interface Roles {
    navy: string;
    teal: string;
    amber: string;
    plum: string;
    slate: string;
    blue: string;
}
/** Resolved colours for charts, which need real values rather than a CSS variable. */
export function useRoles(): Roles {
    const colors = useHueColors(ROLE_VARS) ?? ROLE_FALLBACKS;
    return { navy: colors[0], teal: colors[1], amber: colors[2], plum: colors[3], slate: colors[4], blue: colors[5] };
}
export const useProviderColors = (): readonly string[] => useHueColors(PROVIDER_VARS) ?? PROVIDER_FALLBACKS;
export const providerVar = (provider: string) => {
    const index = (PROVIDERS as readonly string[]).indexOf(provider);
    return index < 0 ? "var(--vl-slate, #8793a3)" : hue(PROVIDER_VARS[index], PROVIDER_FALLBACKS[index]);
};

// ── Chart helpers ───────────────────────────────────────────────────────

export const NO_STACK_LABELS = { disableStackedDataLabels: true };
export const BAND_CAPS = { ...NO_STACK_LABELS, disableDynamicAxisLabelOverlap: true };
export const barHeight = (rows: number) => Math.max(220, rows * 30 + 110);

export function colorScale(field: string, domain: readonly string[], range: readonly string[], legend = true) {
    return {
        field,
        type: "nominal",
        title: null,
        scale: { domain: [...domain], range: [...range] },
        legend: legend ? { orient: "top", direction: "horizontal", labelLimit: 320, symbolLimit: 20 } : null,
    };
}
export const monthAxis = (order: readonly string[]) => ({
    field: "Month",
    type: "nominal",
    title: null,
    sort: [...order],
    axis: { labelAngle: 0, labelOverlap: true, labelLimit: 120 },
});
export const money = { format: "$~s" };
/** A column heading short enough for a narrow heat-map cell. */
export const shortProvider = (provider: string) => (provider === "Google Cloud" ? "Google" : provider);

interface HeatSpec {
    x: string;
    y: string;
    value: string;
    format: string;
    title: string;
    threshold: number;
    xSort?: readonly string[];
    ySort?: readonly string[];
    labelFormat?: string;
    hideZero?: boolean;
}
/** A heat map with the number in every cell, so nobody has to read a colour. */
export function numberHeatmap({ x, y, value, format, title, threshold, xSort, ySort, labelFormat, hideZero }: HeatSpec) {
    const tooltip = [
        { field: y, type: "nominal", title: y },
        { field: x, type: "nominal", title: x },
        { field: value, type: "quantitative", title, format },
    ];
    return {
        encoding: {
            x: { field: x, type: "nominal", title: null, sort: xSort ? [...xSort] : null, axis: { orient: "top", labelAngle: 0, labelLimit: 110, labelOverlap: true } },
            y: { field: y, type: "nominal", title: null, sort: ySort ? [...ySort] : null, axis: { labelLimit: 170 } },
        },
        layer: [
            { mark: { type: "rect", stroke: "white", strokeWidth: 1 }, encoding: { color: { field: value, type: "quantitative", title, legend: null }, tooltip } },
            {
                mark: { type: "text", fontSize: 11 },
                ...(hideZero ? { transform: [{ filter: `datum['${value}'] > 0` }] } : {}),
                encoding: {
                    text: { field: value, type: "quantitative", format: labelFormat ?? format },
                    color: { condition: { test: `datum['${value}'] > ${threshold}`, value: "white" }, value: "black" },
                },
            },
        ],
    };
}

const signedMoney = (v: number) => `${v >= 0 ? "+" : "−"}${usdShort(Math.abs(v))}`;
/** A rounded axis floor a little below the lowest figure, so small steps are visible; the chart says where it starts. */
export function waterfallFloor(steps: readonly WaterfallStep[]): number {
    const lows = steps.flatMap((s) => (s.kind === "Total" ? [s.end] : [s.start, s.end]));
    const lowest = Math.min(...lows);
    if (!(lowest > 0)) return 0;
    const unit = 10 ** (Math.floor(Math.log10(lowest)) - 1);
    return Math.floor((lowest * 0.85) / unit) * unit;
}
export function waterfallRows(steps: readonly WaterfallStep[], floor: number) {
    return steps.map((s, index) => ({
        Key: `${s.label}|${index}`,
        Step: s.label,
        Start: s.kind === "Total" ? floor : Math.max(s.start, floor),
        End: Math.max(s.end, floor),
        Top: Math.max(s.start, s.end, floor),
        Kind: s.kind,
        Text: s.kind === "Total" ? usdShort(s.end) : signedMoney(s.value),
        Value: s.value,
    }));
}
/** Room above the tallest bar for its label, which would otherwise be clipped at the top of the plot. */
export function waterfallCeiling(rows: readonly { Top: number }[], floor: number): number {
    const highest = Math.max(...rows.map((r) => r.Top), floor);
    return highest + Math.max(highest - floor, 1) * 0.15;
}
export function waterfallSpec(keys: readonly string[], roles: Roles, floor: number, ceiling: number) {
    const y = { type: "quantitative", scale: { domainMin: floor, domainMax: ceiling, zero: false, nice: true, clamp: true } };
    return {
        encoding: {
            x: {
                field: "Key",
                type: "nominal",
                title: null,
                sort: [...keys],
                axis: { labelAngle: -35, labelAlign: "right", labelLimit: 150, labelOverlap: false, labelExpr: "split(datum.value, '|')[0]" },
            },
        },
        layer: [
            {
                mark: { type: "bar", cornerRadiusEnd: 2, clip: true },
                encoding: {
                    y: { field: "Start", ...y, title: null, axis: money },
                    y2: { field: "End" },
                    color: colorScale("Kind", ["Total", "Increase", "Decrease"], [roles.navy, roles.amber, roles.teal], false),
                    tooltip: [
                        { field: "Step", type: "nominal", title: "Step" },
                        { field: "Text", type: "nominal", title: "Amount" },
                    ],
                },
            },
            { mark: { type: "text", dy: -6, baseline: "bottom", fontSize: 11, clip: true }, encoding: { y: { field: "Top", ...y }, text: { field: "Text", type: "nominal" } } },
        ],
    };
}

// ── Controls ────────────────────────────────────────────────────────────

interface Controls {
    basis: Basis;
    setBasis: (basis: Basis) => void;
    provider: ProviderChoice;
    setProvider: (provider: ProviderChoice) => void;
}
const ControlsContext = createContext<Controls | null>(null);

/** One cost basis and provider for the whole screen, so every page reads the same one until it is changed. */
export function ControlsProvider({ children }: { children: ReactNode }) {
    const [basis, setBasis] = useState<Basis>("Effective");
    const [provider, setProvider] = useState<ProviderChoice>("All providers");
    const value = useMemo(() => ({ basis, setBasis, provider, setProvider }), [basis, provider]);
    return <ControlsContext.Provider value={value}>{children}</ControlsContext.Provider>;
}
export function useControls(): Controls {
    const controls = useContext(ControlsContext);
    if (!controls) throw new Error("useControls needs a ControlsProvider");
    return controls;
}

/** The app's date range, with the screen's basis and provider. */
export function useFinopsView(): View {
    const { filters, options } = useFilterContext();
    const { basis, provider } = useControls();
    const range = shownDateRange(filters.dateRange, options);
    const from = range?.from;
    const to = range?.to;
    return useMemo(() => ({ basis, provider, from, to }), [basis, provider, from, to]);
}

const PROVIDER_CHOICES: readonly ProviderChoice[] = ["All providers", ...PROVIDERS];

export function ViewControls({ basis = true, provider = true }: { basis?: boolean; provider?: boolean }) {
    const controls = useControls();
    return (
        <div className="flex flex-wrap items-center gap-x-500 gap-y-300">
            {basis && (
                <div className="flex flex-wrap items-center gap-200">
                    <span className={cn(SMALL, "text-muted-foreground")}>Cost basis</span>
                    <SegmentedControl
                        label="Cost basis"
                        options={BASES.map((id) => ({ id, label: id, hint: BASIS_MEANINGS[id] }))}
                        value={controls.basis}
                        onChange={controls.setBasis}
                    />
                </div>
            )}
            {provider && (
                <div className="flex flex-wrap items-center gap-200">
                    <span className={cn(SMALL, "text-muted-foreground")}>Provider</span>
                    <SegmentedControl
                        label="Provider"
                        options={PROVIDER_CHOICES.map((id) => ({ id, label: id === "All providers" ? "All" : id }))}
                        value={controls.provider}
                        onChange={controls.setProvider}
                    />
                </div>
            )}
        </div>
    );
}

// ── Stage frame ─────────────────────────────────────────────────────────

const mockBadge = (
    <span className={cn(SMALL, "whitespace-nowrap rounded-full border border-border px-200 py-100 text-muted-foreground")}>
        Mock-up · synthetic data
    </span>
);

export function Stage({ id, title, description, empty = false, children }: { id: StageId; title: string; description: string; empty?: boolean; children: ReactNode }) {
    return (
        <Section id={stageAnchor(id)} title={title} description={description} actions={mockBadge}>
            {empty ? (
                <QueryEmpty
                    className="h-[320px]"
                    title="No cloud or AI charges in this selection"
                    description={`The mock-up covers ${day(DATA_FROM)} to ${day(DATA_TO)}. Widen the dates or choose another provider.`}
                />
            ) : (
                children
            )}
        </Section>
    );
}

export const gridTwo = "grid grid-cols-1 items-start gap-400 lg:grid-cols-2";
export const gridWide = "grid grid-cols-1 items-start gap-400 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]";
export const gridKpi = "grid grid-cols-1 gap-400 sm:grid-cols-2 xl:grid-cols-4";
export const notes = cn(SMALL, "flex max-w-[90ch] list-disc flex-col gap-100 pl-500 text-muted-foreground");

// ── Small parts ─────────────────────────────────────────────────────────

const STATUS_COLOR: Record<FeedStatus, string> = {
    Current: hue("--vl-teal", "#09b39d"),
    Late: hue("--vl-amber", "#f1963a"),
    Estimated: hue("--vl-amber", "#f1963a"),
    Failed: hue("--vl-plum", "#7f215d"),
    Empty: hue("--vl-slate", "#8793a3"),
};
/** A status with its word beside the dot, so colour never carries it alone. */
export function StatusChip({ status }: { status: FeedStatus }) {
    return (
        <span className={cn(SMALL, "inline-flex items-center gap-100 whitespace-nowrap rounded-full border border-border px-200 py-100")}>
            <span aria-hidden="true" className="size-200 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
            {status}
        </span>
    );
}

/** A small weekly line for a provider's row. */
export function Spark({ values, color, label }: { values: readonly number[]; color: string; label: string }) {
    if (values.length < 2) return <span className={cn(SMALL, "text-muted-foreground")}>Too short to draw</span>;
    const width = 120;
    const height = 32;
    const low = Math.min(...values);
    const high = Math.max(...values);
    const span = high - low || 1;
    const points = values.map((v, i) => `${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 4 - ((v - low) / span) * (height - 8)).toFixed(1)}`);
    const end = points.at(-1)!.split(",");
    return (
        <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="shrink-0 overflow-visible">
            <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={end[0]} cy={end[1]} r={2.5} fill={color} />
        </svg>
    );
}
