//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo, useState } from "react";
import { KpiCard } from "@/components/kpi-card";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { ImpactTable as Table } from "../business-impact/impact-table";
import { Chart, panel } from "../cross-vendor/insights";
import { AI_KIND, BUCKETS, OTHER_KIND, explorer, findings, models, overview, portfolio, type Change, type Finding } from "./analysis";
import { PRICE_NOTE, PROVIDERS } from "./data";
import {
    BAND_CAPS,
    NO_STACK_LABELS,
    Spark,
    Stage,
    StatusChip,
    ViewControls,
    barHeight,
    colorScale,
    data,
    gridKpi,
    gridTwo,
    hue,
    link,
    money,
    monthAxis,
    notes,
    numberHeatmap,
    pct,
    period,
    providerVar,
    signedPct,
    usd,
    usdShort,
    useFinopsView,
    useProviderColors,
    useRoles,
    waterfallCeiling,
    waterfallFloor,
    waterfallRows,
    waterfallSpec,
    whole,
} from "./shared";

/** How a change reads: a zero prior period is new spend, never an infinite percentage. */
export function changeText(change: Change | null): string {
    if (!change) return "No prior period";
    if (change.isNew) return "New spend";
    if (change.pct === null) return "No change";
    return `${signedPct(change.pct)} (${change.delta >= 0 ? "+" : "−"}${usdShort(Math.abs(change.delta))})`;
}

// ── The review queue ────────────────────────────────────────────────────

const TONE_COLOR = { Review: hue("--vl-plum", "#7f215d"), Watch: hue("--vl-amber", "#f1963a") } as const;

export function FindingRow({ finding, full = false }: { finding: Finding; full?: boolean }) {
    return (
        <li className="flex flex-col gap-100 py-300 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-200">
                <span className={cn(SMALL, "inline-flex items-center gap-100 whitespace-nowrap rounded-full border border-border px-200 py-100")}>
                    <span aria-hidden="true" className="size-200 rounded-full" style={{ backgroundColor: TONE_COLOR[finding.tone] }} />
                    {finding.tone}
                </span>
                <strong className={BODY}>{finding.title}</strong>
            </div>
            <p className={cn(SMALL, "max-w-[90ch]")}>{finding.changed}</p>
            <p className={cn(SMALL, "max-w-[90ch] text-muted-foreground")}>
                {finding.scope} · {finding.period} · Owner: {finding.owner}
            </p>
            {full && (
                <>
                    <p className={cn(SMALL, "max-w-[90ch] text-muted-foreground")}>Evidence: {finding.evidence}</p>
                    <p className={cn(SMALL, "max-w-[90ch]")}>Look at next: {finding.next}</p>
                </>
            )}
            <a href={finding.href} className={cn(SMALL, link, "w-fit")}>{finding.link}</a>
        </li>
    );
}

function ReviewQueue({ limit }: { limit: number }) {
    const queue = useMemo(() => findings(data), []);
    const [all, setAll] = useState(false);
    const shown = all ? queue : queue.slice(0, limit);
    return (
        <div className={cn(panel, "flex flex-col gap-300")}>
            <div className="flex flex-wrap items-baseline justify-between gap-300">
                <h3 className={cn(BODY, "font-semibold")}>Worth a look</h3>
                <p className={cn(SMALL, "text-muted-foreground")}>{queue.length} findings from rules over the last 30 days; not filtered by the controls above</p>
            </div>
            <ol className="flex flex-col divide-y divide-border">
                {shown.map((f) => <FindingRow key={f.id} finding={f} />)}
            </ol>
            {queue.length > limit && (
                <button type="button" aria-expanded={all} onClick={() => setAll(!all)} className={cn(SMALL, link, "w-fit")}>
                    {all ? "Show fewer" : `Show all ${queue.length}`}
                </button>
            )}
        </div>
    );
}

// ── Overview ────────────────────────────────────────────────────────────

export function Summary() {
    const view = useFinopsView();
    const o = useMemo(() => overview(data, view), [view]);
    const { change } = o;
    const changeDetail = !change
        ? "The range is too short to compare"
        : `${change.isNew ? "New spend" : change.pct === null ? "No change" : `${signedPct(change.pct)} on the prior ${change.label.match(/\d+/)?.[0] ?? 30} days`} · ${change.label}`;
    return (
        <Stage id="fin-summary" title="Cloud and AI spend at a glance" description="What the organisation spends across cloud and AI providers, and the few things most worth looking at." empty={o.empty}>
            <ViewControls />
            <div className={gridKpi}>
                <KpiCard label="Total cost" value={o.total} format="currency" prefix="$" emphasis detail={`${view.basis} basis, ${period(o.window)}`} />
                <KpiCard label="AI and ML cost" value={o.ai} format="currency" prefix="$" detail={`${pct(o.aiShare)} of the total`} />
                <KpiCard label="Latest 30 days" value={change?.current} format="currency" prefix="$" emptyValue="—" detail={changeDetail} />
                <KpiCard label="Feeds needing attention" value={o.feeds.needAttention} detail={`Of ${o.feeds.total} connected: late, failed or estimated. ${o.feeds.empty} connected with no charges`} />
            </div>
            <div className={cn(panel, "flex flex-col gap-400")}>
                <div className="flex flex-wrap items-baseline justify-between gap-300">
                    <h3 className={cn(BODY, "font-semibold")}>Where the spend sits, by provider</h3>
                    <a href="#/finops/fin-portfolio" className={cn(SMALL, link)}>See the portfolio</a>
                </div>
                <div
                    role="img"
                    aria-label={`Cost by provider: ${o.byProvider.map((p) => `${p.provider}, ${usd(p.value)}, ${pct(p.share)}`).join("; ")}`}
                    className="flex h-500 w-full gap-[2px] overflow-hidden rounded-md"
                >
                    {o.byProvider.map((p) => (
                        <span key={p.provider} className="h-full" style={{ flexGrow: p.value, flexBasis: 0, backgroundColor: providerVar(p.provider) }} />
                    ))}
                </div>
                <ul className="grid grid-cols-2 gap-400 sm:grid-cols-3 xl:grid-cols-5">
                    {o.byProvider.map((p) => (
                        <li key={p.provider} className="flex flex-col gap-100">
                            <span className="flex items-center gap-200">
                                <span aria-hidden="true" className="size-300 shrink-0 rounded-sm" style={{ backgroundColor: providerVar(p.provider) }} />
                                <span className={cn(SMALL, "text-muted-foreground")}>{p.provider}</span>
                            </span>
                            <span className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">{usdShort(p.value)}</span>
                            <span className={cn(SMALL, "text-muted-foreground")}>{pct(p.share)} of the total</span>
                        </li>
                    ))}
                </ul>
            </div>
            <ReviewQueue limit={4} />
            <p className={cn(SMALL, "max-w-[90ch] text-muted-foreground")}>
                Each provider keeps its own unit. Dollars are summed across providers only on the basis shown; credits, tokens, seats and requests are never added into one total.
            </p>
        </Stage>
    );
}

// ── Portfolio ───────────────────────────────────────────────────────────

export function Portfolio() {
    const view = useFinopsView();
    const p = useMemo(() => portfolio(data, view), [view]);
    const roles = useRoles();
    const providerColors = useProviderColors();
    const monthly = {
        mark: { type: "bar", cornerRadiusEnd: 2 },
        encoding: {
            x: monthAxis(p.monthOrder),
            y: { field: "Cost", type: "quantitative", title: null, axis: money },
            color: colorScale("Provider", PROVIDERS, providerColors),
            tooltip: [{ field: "Month", type: "nominal" }, { field: "Provider", type: "nominal" }, { field: "Cost", type: "quantitative", format: "$,.0f" }],
        },
    };
    const kinds = {
        mark: { type: "bar", cornerRadiusEnd: 2 },
        encoding: {
            x: monthAxis(p.monthOrder),
            y: { field: "Cost", type: "quantitative", title: null, axis: money },
            color: colorScale("Kind", [AI_KIND, OTHER_KIND], [roles.teal, roles.slate]),
            tooltip: [{ field: "Month", type: "nominal" }, { field: "Kind", type: "nominal" }, { field: "Cost", type: "quantitative", format: "$,.0f" }],
        },
    };
    return (
        <Stage id="fin-portfolio" title="Spend by provider and kind" description="Month by month, across clouds and AI providers, with AI broken out from the rest and each provider's data feeds beside its cost." empty={p.empty}>
            <ViewControls />
            <div className={gridTwo}>
                <Chart title="Cost by month and provider" subtitle={`${view.basis} basis. Part-covered months say so`} spec={monthly} rows={p.monthly} height={320} capabilities={BAND_CAPS} />
                <Chart title="AI and ML against other cloud" subtitle={`${view.basis} basis, by service category`} spec={kinds} rows={p.kinds} height={320} capabilities={BAND_CAPS} />
            </div>
            <div className={cn(panel, "flex flex-col gap-300")}>
                <div className="flex flex-wrap items-baseline justify-between gap-300">
                    <h3 className={cn(BODY, "font-semibold")}>Each provider, with its data feeds</h3>
                    <p className={cn(SMALL, "text-muted-foreground")}>{p.compare ? `Change: ${p.compare.label}` : "The range is too short to compare"}</p>
                </div>
                <ul className="flex flex-col divide-y divide-border">
                    {p.providers.map((s) => {
                        const weekly = s.series.length >= 2 ? `Weekly cost from ${usdShort(s.series[0])} to ${usdShort(s.series.at(-1)!)}` : "Weekly cost too short to draw";
                        return (
                            <li key={s.provider} className="grid grid-cols-1 items-center gap-200 py-300 first:pt-0 last:pb-0 lg:grid-cols-[9rem_9rem_10rem_8rem_minmax(0,1fr)] lg:gap-400">
                                <span className="flex items-center gap-200">
                                    <span aria-hidden="true" className="size-300 shrink-0 rounded-sm" style={{ backgroundColor: providerVar(s.provider) }} />
                                    <strong className={BODY}>{s.provider}</strong>
                                </span>
                                <span className={cn(BODY, "font-numeric tabular-nums")}>
                                    {usdShort(s.value)}
                                    <span className={cn(SMALL, "ml-200 text-muted-foreground")}>{pct(s.share)}</span>
                                </span>
                                <span className={cn(SMALL, "font-numeric tabular-nums")}>{changeText(s.change)}</span>
                                <Spark values={s.series} color={providerVar(s.provider)} label={weekly} />
                                <ul className="flex flex-wrap items-center gap-200">
                                    {s.feeds.map((f) => (
                                        <li key={f.feed} className="flex items-center gap-100">
                                            <span className={cn(SMALL, "text-muted-foreground")}>{f.feed}</span>
                                            <StatusChip status={f.status} />
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <p className={cn(SMALL, "max-w-[90ch] text-muted-foreground")}>
                A feed that failed, an estimate and a source with no charges are different things: the chip beside each provider says which, and what it does to the figures is on the Data trust page.
            </p>
        </Stage>
    );
}

// ── Explorer ────────────────────────────────────────────────────────────

const SERVICES_SHOWN = 10;

export function Explorer() {
    const view = useFinopsView();
    const x = useMemo(() => explorer(data, view), [view]);
    const roles = useRoles();
    const [all, setAll] = useState(false);
    const floor = useMemo(() => waterfallFloor(x.waterfall), [x.waterfall]);
    const steps = useMemo(() => waterfallRows(x.waterfall, floor), [x.waterfall, floor]);
    const heatMax = Math.max(...x.heat.map((h) => h.Cost), 1);
    const heat = numberHeatmap({ x: "Month", y: "Category", value: "Cost", format: "$,.0f", labelFormat: "$.2s", title: "Cost", threshold: heatMax * 0.5, xSort: x.monthOrder });
    const services = all ? x.services : x.services.slice(0, SERVICES_SHOWN);
    return (
        <Stage id="fin-explorer" title="Movers and services" description="What moved most in the latest 30 days, which services make up the bill, and where each category sits month by month." empty={x.empty}>
            <ViewControls />
            {x.compare ? (
                <Chart
                    title={`What moved: ${x.compare.label}`}
                    subtitle={`${view.basis} basis. The axis starts at ${usdShort(floor)}`}
                    spec={waterfallSpec(steps.map((s) => s.Key), roles, floor, waterfallCeiling(steps, floor))}
                    rows={steps}
                    height={340}
                    capabilities={BAND_CAPS}
                />
            ) : (
                <p className={cn(panel, BODY)}>The range is shorter than a week, so there is no prior period to compare it with.</p>
            )}
            <div className={gridTwo}>
                <Table
                    caption="Biggest movers. A service with no spend in the prior period is new spend, so it has no percentage."
                    headers={["Service", "Provider", "Latest", "Prior", "Change"]}
                    rows={x.movers.slice(0, 8).map((m) => [<strong>{m.service}</strong>, m.provider, usd(m.current), usd(m.prior), m.isNew ? "New spend" : m.pct === null ? "No change" : `${signedPct(m.pct)} (${m.delta >= 0 ? "+" : "−"}${usdShort(Math.abs(m.delta))})`])}
                />
                <Chart title="Category by month" subtitle={`${view.basis} basis. Every cell shows its cost`} spec={heat} rows={x.heat} height={300} />
            </div>
            <div className="flex flex-col gap-200">
                <Table
                    caption={`Services in the range, largest first (${view.basis} basis).`}
                    headers={["Service", "Provider", "Category", "Cost", "Share", "Change"]}
                    rows={services.map((s) => [<strong>{s.Service}</strong>, s.Provider, s.Category, usd(s.Cost), pct(s.Share, 1), changeText(s.change)])}
                />
                {x.services.length > SERVICES_SHOWN && (
                    <button type="button" aria-expanded={all} onClick={() => setAll(!all)} className={cn(SMALL, link, "w-fit")}>
                        {all ? "Show fewer services" : `Show all ${x.services.length} services`}
                    </button>
                )}
            </div>
        </Stage>
    );
}

// ── Models ──────────────────────────────────────────────────────────────

export function Models() {
    const view = useFinopsView();
    const m = useMemo(() => models(data, view), [view]);
    const roles = useRoles();
    const providerColors = useProviderColors();
    const order = m.rows.map((r) => r.Model);
    const cost = {
        mark: { type: "bar", cornerRadiusEnd: 2 },
        encoding: {
            y: { field: "Model", type: "nominal", title: null, sort: order, axis: { labelLimit: 190 } },
            x: { field: "Cost", type: "quantitative", title: null, axis: money },
            color: colorScale("Provider", PROVIDERS, providerColors, false),
            tooltip: [{ field: "Model", type: "nominal" }, { field: "Cost", type: "quantitative", format: "$,.0f" }],
        },
    };
    const mix = {
        mark: { type: "bar" },
        encoding: {
            y: { field: "Model", type: "nominal", title: null, sort: order, axis: { labelLimit: 190 } },
            x: { field: "Share", type: "quantitative", title: null, axis: { format: ".0%" }, scale: { domain: [0, 1] } },
            color: colorScale("Bucket", BUCKETS, [roles.navy, roles.blue, roles.teal, roles.amber]),
            order: { field: "Order", type: "quantitative" },
            tooltip: [{ field: "Model", type: "nominal" }, { field: "Bucket", type: "nominal" }, { field: "Share", type: "quantitative", format: ".0%" }],
        },
    };
    const trend = {
        mark: { type: "line", point: true, strokeWidth: 2 },
        encoding: {
            x: monthAxis(m.monthOrder),
            y: { field: "Per million tokens", type: "quantitative", title: null, axis: { format: "$,.2f" } },
            color: { field: "Model", type: "nominal", title: null, scale: { range: [roles.navy, roles.teal, roles.amber, roles.plum, roles.blue, roles.slate] }, legend: { orient: "bottom", direction: "vertical", columns: 1, labelLimit: 220, symbolLimit: 20 } },
            tooltip: [{ field: "Month", type: "nominal" }, { field: "Model", type: "nominal" }, { field: "Per million tokens", type: "quantitative", format: "$,.2f" }],
        },
    };
    const cache = {
        mark: { type: "bar", cornerRadiusEnd: 2 },
        encoding: {
            y: { field: "Model", type: "nominal", title: null, sort: order, axis: { labelLimit: 190 } },
            x: { field: "Cache-read share", type: "quantitative", title: null, axis: { format: ".0%" } },
            tooltip: [{ field: "Model", type: "nominal" }, { field: "Cache-read share", type: "quantitative", format: ".0%" }],
            color: { value: roles.teal },
        },
    };
    const withTokens = m.rows.filter((r) => r.Tokens > 0);
    const mixRows = m.mix.map((r) => ({ ...r, Order: BUCKETS.indexOf(r.Bucket as (typeof BUCKETS)[number]) }));
    const height = barHeight(m.rows.length);
    const trendSeries = new Set(m.trend.map((r) => r.Model)).size;
    return (
        <Stage id="fin-models" title="Models and tokens" description="What each model costs, how its tokens split between input, output and cache, and what a million tokens cost over time." empty={m.empty}>
            <ViewControls />
            <div className={gridTwo}>
                <Chart title="Cost by model" subtitle={`${view.basis} basis, coloured by provider`} spec={cost} rows={m.rows.map((r) => ({ Model: r.Model, Provider: r.provider, Cost: r.Cost }))} height={height} />
                <Chart title="Where the tokens go" subtitle="Share of tokens, on days with detail" spec={mix} rows={mixRows} height={height} capabilities={NO_STACK_LABELS} />
                {m.trend.length > 0 ? (
                    <Chart title="Cost per million tokens" subtitle="Blended price; a rise may be a changed mix" spec={trend} rows={m.trend} height={Math.max(300, trendSeries * 22 + 260)} capabilities={BAND_CAPS} />
                ) : (
                    <p className={cn(panel, BODY)}>No model has token detail in two or more months of this range, so there is no trend to draw.</p>
                )}
                <Chart title="Cache-read share" subtitle="Tokens served from cache; higher is cheaper" spec={cache} rows={withTokens.map((r) => ({ Model: r.Model, "Cache-read share": r.cacheShare }))} height={Math.max(300, barHeight(withTokens.length))} />
            </div>
            <Table
                caption="Models, costliest first. Per-token figures use only days with token detail."
                headers={["Model", "Cost", "Tokens (millions)", "Cost per million tokens", "Cache-read share", "Token detail covers"]}
                rows={m.rows.map((r) => [<strong>{r.Model}</strong>, usd(r.Cost), r.Tokens > 0 ? whole(r.Tokens) : "No detail", r.perMillion === null ? "—" : `$${r.perMillion.toFixed(2)}`, r.Tokens > 0 ? pct(r.cacheShare) : "—", `${pct(r.detail)} of cost`])}
            />
            <ul className={notes}>
                <li>{PRICE_NOTE}.</li>
                {m.missingDays && <li>Some days have cost but no token detail, because a provider&apos;s usage feed failed. Those days count in cost and are left out of every per-token figure.</li>}
                <li>Tokens are measured in their own unit and are never added to dollars or to another provider&apos;s credits.</li>
            </ul>
        </Stage>
    );
}
