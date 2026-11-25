//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo, useState } from "react";
import { KpiCard } from "@/components/kpi-card";
import { SegmentedControl } from "@/components/segmented-control";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { ImpactTable as Table } from "../business-impact/impact-table";
import { Chart, panel } from "../cross-vendor/insights";
import { COVERAGE_COLUMNS, allocation, coverage, reconcile, type CellState } from "./analysis";
import { BASES, BASIS_MEANINGS, FEEDS, MONTHS, PROVIDERS, UNASSIGNED, monthName } from "./data";
import { BAND_CAPS, Stage, StatusChip, ViewControls, colorScale, data, day, gridKpi, gridTwo, hue, link, money, monthAxis, notes, numberHeatmap, pct, shortProvider, usd, usdShort, useFinopsView, useRoles, waterfallCeiling, waterfallFloor, waterfallRows, waterfallSpec } from "./shared";

// ── Governance: who the spend is allocated to ───────────────────────────

export function Allocation() {
    const view = useFinopsView();
    const a = useMemo(() => allocation(data, view), [view]);
    const roles = useRoles();
    const narrow = useMediaQuery("(max-width: 767px)");
    const heatMax = Math.max(...a.heat.map((h) => h.Cost), 1);
    const heatRows = a.heat.map((h) => ({ ...h, Provider: shortProvider(h.Provider) }));
    const centreRows = [...a.centres, UNASSIGNED];
    const centreHeat = numberHeatmap({ x: "Provider", y: "Cost centre", value: "Cost", format: "$,.0f", labelFormat: "$.2~s", title: "Cost", threshold: heatMax * 0.5, xSort: a.heatProviders.map(shortProvider), ySort: centreRows, hideZero: true });
    const tagHeat = numberHeatmap({ x: "Month", y: "Provider", value: "Share", format: ".0%", title: "Allocated", threshold: 0.9, xSort: a.monthOrder, ySort: a.heatProviders });
    const split = {
        mark: { type: "bar", cornerRadiusEnd: 2 },
        encoding: {
            x: monthAxis(a.monthOrder),
            y: { field: "Cost", type: "quantitative", title: null, axis: money },
            color: colorScale("Kind", ["Allocated", UNASSIGNED], [roles.navy, roles.amber]),
            tooltip: [{ field: "Month", type: "nominal" }, { field: "Kind", type: "nominal" }, { field: "Cost", type: "quantitative", format: "$,.0f" }],
        },
    };
    return (
        <Stage id="fin-allocation" title="Who the spend belongs to" description="Cost by cost centre and provider, with what could not be attributed kept in view and the tag coverage behind it." empty={a.empty}>
            <ViewControls basis={false} />
            <div className={gridKpi}>
                <KpiCard label="Cost in view" value={a.total} format="currency" prefix="$" detail="Usage on the Effective basis" />
                <KpiCard label="Allocated to a cost centre" value={a.total - a.unassigned} format="currency" prefix="$" detail={`${pct(1 - a.unassignedShare)} of the cost`} />
                <KpiCard label="Unassigned" value={a.unassigned} format="currency" prefix="$" emphasis detail={`${pct(a.unassignedShare, 1)} of the cost has no owner`} />
                <KpiCard label="Cost centres" value={a.centres.length} detail="With any allocated cost" />
            </div>
            <div className={gridTwo}>
                {narrow ? (
                    <Table
                        caption="Cost centre by provider. Unassigned is the last row; a dash means no cost."
                        headers={["Cost centre", ...a.heatProviders.map(shortProvider)]}
                        rows={centreRows.map((centre) => [
                            <strong>{centre}</strong>,
                            ...a.heatProviders.map((provider) => {
                                const cost = a.heat.find((h) => h["Cost centre"] === centre && h.Provider === provider)?.Cost ?? 0;
                                return cost > 0 ? usdShort(cost) : "–";
                            }),
                        ])}
                    />
                ) : (
                    <Chart title="Cost centre by provider" subtitle="Each cell is its cost. Unassigned is last" spec={centreHeat} rows={heatRows} height={Math.max(260, (a.centres.length + 1) * 32 + 110)} />
                )}
                <Chart title="Allocated and unassigned by month" subtitle="Effective basis" spec={split} rows={a.monthly} height={Math.max(260, (a.centres.length + 1) * 32 + 110)} capabilities={BAND_CAPS} />
            </div>
            <Chart title="Cost with an owner, by provider and month" subtitle="Each cell is a share. A low one is a tagging gap" spec={tagHeat} rows={a.coverage} height={Math.max(240, a.heatProviders.length * 34 + 110)} />
            <ul className={notes}>
                <li>Unassigned stays a row and a bar. It is never spread across the cost centres, so the gap stays visible until the tags are fixed.</li>
                <li>Allocation uses the Effective basis so a shared commitment or credit lands on the teams that used it. This page follows the dates and the provider.</li>
            </ul>
        </Stage>
    );
}

// ── Governance: can the numbers be trusted ──────────────────────────────

const STATE_COLOR: Record<CellState, string> = {
    Good: hue("--vl-teal", "#09b39d"),
    Watch: hue("--vl-amber", "#f1963a"),
    Gap: hue("--vl-plum", "#7f215d"),
    None: hue("--vl-slate", "#8793a3"),
};
const STATE_WORD: Record<CellState, string> = { Good: "Good", Watch: "Watch", Gap: "Gap", None: "Not applicable" };

function StateText({ state, text }: { state: CellState; text: string }) {
    return (
        <span className="inline-flex items-center gap-200">
            <span aria-hidden="true" className="size-200 shrink-0 rounded-full" style={{ backgroundColor: STATE_COLOR[state] }} />
            <span className="sr-only">{STATE_WORD[state]}: </span>
            {text}
        </span>
    );
}

const CLOSED = MONTHS.slice(0, -1);
const MONTH_OPTIONS = MONTHS.map((id) => ({ id, label: monthName(id) }));

export function Trust() {
    const matrix = useMemo(() => coverage(data), []);
    const [month, setMonth] = useState<(typeof MONTHS)[number]>(CLOSED.at(-1)!);
    const rec = useMemo(() => reconcile(data, month), [month]);
    const roles = useRoles();
    const floor = waterfallFloor(rec.steps);
    const bars = waterfallRows(rec.steps, floor);
    const attention = FEEDS.filter((f) => f.status === "Late" || f.status === "Failed" || f.status === "Estimated").length;
    return (
        <Stage id="fin-trust" title="How far the numbers can be trusted" description="Which data feeds are current, what each provider's data can and cannot support, and whether the bill reconciles to the invoice.">
            <p className={cn(SMALL, "text-muted-foreground")}>
                {attention} of {FEEDS.length} feeds need attention. As of {day("2026-10-25")}. Nothing on this page is filtered by the dates above.
            </p>
            <Table
                caption="Data feeds. A failed feed, an estimate and a source with no charges are different, and each says what it does to the views."
                headers={["Provider", "Feed", "Status", "Latest data", "What it means for the figures"]}
                rows={FEEDS.map((f) => [<strong>{f.provider}</strong>, f.feed, <StatusChip status={f.status} />, f.latest ? day(f.latest) : "—", `${f.note}. ${f.effect}`])}
            />
            <Table
                caption="What each provider's data can support."
                headers={["Provider", ...COVERAGE_COLUMNS]}
                rows={matrix.map((row) => [<strong>{row.provider}</strong>, ...row.cells.map((c) => <StateText key={c.label} state={c.state} text={c.text} />)])}
            />
            <div className={cn(panel, "flex flex-col gap-400")}>
                <div className="flex flex-wrap items-center justify-between gap-300">
                    <h3 className={cn(BODY, "font-semibold")}>From the data to the invoice</h3>
                    <SegmentedControl label="Invoice month" options={MONTH_OPTIONS} value={month} onChange={setMonth} />
                </div>
                {rec.open && <p className={cn(SMALL, "text-muted-foreground")}>The {monthName(month)} invoices have not been issued, so there is nothing to reconcile yet. The steps show how usage becomes what will be billed.</p>}
                <Chart
                    title={`${monthName(month)}: usage at contracted rates to ${rec.open ? "billed" : "invoiced"}`}
                    subtitle={`The axis starts at ${usdShort(floor)}`}
                    spec={waterfallSpec(bars.map((b) => b.Key), roles, floor, waterfallCeiling(bars, floor))}
                    rows={bars}
                    height={340}
                    capabilities={BAND_CAPS}
                />
                <Table
                    caption={rec.open ? "Billed in the data, by provider. No invoice yet." : "Billed in the data against the invoice, by provider."}
                    headers={["Provider", "Billed in the data", "Invoiced", "Difference", "Share", "Reason"]}
                    rows={rec.rows.map((r) => [
                        <strong>{r.provider}</strong>,
                        usd(r.billed),
                        r.invoiced === null ? "Not issued" : usd(r.invoiced),
                        r.difference === null ? "—" : `${r.difference >= 0 ? "+" : "−"}${usd(Math.abs(r.difference))}`,
                        r.variance === null ? "—" : `${r.variance >= 0 ? "+" : "−"}${Math.abs(r.variance * 100).toFixed(2)}%`,
                        r.reason,
                    ])}
                />
            </div>
            <ul className={notes}>
                <li>Every difference to an invoice is named. One with no reason yet is marked as not explained, and it is left on the page until someone explains it.</li>
                <li>Prepaid credits bought are a purchase on the Billed basis and are spread over their usage on the Effective basis; the steps above show both.</li>
            </ul>
        </Stage>
    );
}

// ── Governance: method ──────────────────────────────────────────────────

const FOCUS_COLUMNS: readonly (readonly [string, string])[] = [
    ["BilledCost", "Billed basis: what the invoice asks for"],
    ["EffectiveCost", "Effective basis: billed cost with commitments and credits amortised over their usage"],
    ["ListCost", "List basis: usage at public list prices"],
    ["ContractedCost", "Contracted basis: usage at the negotiated unit price"],
    ["ChargeCategory", "Usage or Purchase; a purchase is never added to the usage it pays for"],
    ["ServiceName and ServiceCategory", "The service, and whether it counts as AI and ML"],
    ["Tags", "Where application, cost centre and environment come from"],
    ["CommitmentDiscountId", "Which reservation, savings plan or credit pack a charge drew on"],
];

export function Method() {
    return (
        <Stage id="fin-method" title="How this page is built" description="The cost bases, the columns they come from and the rules that keep the figures honest.">
            <div className={gridTwo}>
                <dl className={cn(panel, "flex flex-col gap-300")}>
                    <h3 className={cn(BODY, "font-semibold")}>Cost bases</h3>
                    {BASES.map((b) => (
                        <div key={b}>
                            <dt className={cn(BODY, "font-semibold")}>{b}</dt>
                            <dd className={cn(SMALL, "max-w-[70ch] text-muted-foreground")}>{BASIS_MEANINGS[b]}</dd>
                        </div>
                    ))}
                </dl>
                <dl className={cn(panel, "flex flex-col gap-300")}>
                    <h3 className={cn(BODY, "font-semibold")}>Where each figure comes from</h3>
                    {FOCUS_COLUMNS.map(([column, meaning]) => (
                        <div key={column}>
                            <dt className={cn(SMALL, "font-numeric font-semibold")}>{column}</dt>
                            <dd className={cn(SMALL, "max-w-[70ch] text-muted-foreground")}>{meaning}</dd>
                        </div>
                    ))}
                </dl>
            </div>
            <ul className={notes}>
                <li>No total ever mixes cost bases. The basis is stated beside every figure, and the forecast, allocation and unit pages each say which one they use.</li>
                <li>Credits, tokens, seats and requests are measured in their own units. Only dollars are added across providers, and only on one basis.</li>
                <li>A zero prior period is shown as new spend, not as an infinite percentage. A feed that failed, an estimate and a source with no charges are three different states.</li>
                <li>Forecast bands are scenarios, not confidence intervals. A gap between list and contracted price is the discount you negotiated, not proven savings.</li>
                <li>The worth-a-look list comes from fixed rules over the data; the Ask page explains it but is not a source of numbers.</li>
                <li>Providers covered: {PROVIDERS.join(", ")}. All of it is synthetic. The columns follow the FinOps Open Cost and Usage Specification, but this is a mock-up and not a validator of it.</li>
                <li>Illustrative token prices are not any vendor&apos;s price list. The <a className={link} href="#/finops/fin-unit">hand-time reference</a> is a planning assumption.</li>
            </ul>
        </Stage>
    );
}
