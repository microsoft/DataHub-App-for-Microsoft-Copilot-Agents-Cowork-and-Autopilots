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
import { ASSUMPTIONS, PACE_SERIES, SCENARIOS, expansion, findings, forecast, pack, rates, unit, waterfall, type ForecastScope } from "./analysis";
import { BAND_CAPS, Stage, StatusChip, ViewControls, barHeight, data, day, gridKpi, gridWide, link, money, monthAxis, notes, pct, period, signedPct, usd, usdShort, usdSmall, useFinopsView, useRoles, waterfallCeiling, waterfallFloor, waterfallRows, waterfallSpec, whole } from "./shared";
import { FindingRow } from "./spend";

// ── Value: unit economics ───────────────────────────────────────────────

const SAVED_OPTIONS = ASSUMPTIONS.saved.map((s) => ({ id: String(s), label: pct(s) }));

export function UnitEconomics() {
    const view = useFinopsView();
    const u = useMemo(() => unit(data, view), [view]);
    const roles = useRoles();
    const [saved, setSaved] = useState(String(ASSUMPTIONS.defaultSaved));
    const share = Number(saved);
    const rows = u.rows.map((r) => ({ ...r, ratio: r.handCost > 0 && r.perOutcome ? (r.handCost * share) / r.perOutcome : null }));
    const drawn = rows.filter((r) => r.ratio !== null);
    const xDomain = { domain: [0, Math.ceil(Math.max(...drawn.map((r) => r.ratio ?? 0), 1) * 1.25)], nice: false };
    const chart = {
        layer: [
            {
                mark: { type: "bar", cornerRadiusEnd: 2 },
                encoding: {
                    y: { field: "Application", type: "nominal", title: null, sort: "-x", axis: { labelLimit: 190 } },
                    x: { field: "Ratio", type: "quantitative", title: "Time value ÷ AI cost", axis: { format: ".0f" }, scale: xDomain },
                    color: { value: roles.teal },
                    tooltip: [{ field: "Application", type: "nominal" }, { field: "Ratio", type: "quantitative", format: ".1f", title: "Times its cost" }],
                },
            },
            { mark: { type: "rule", strokeDash: [4, 3], color: roles.navy }, encoding: { x: { datum: 1, type: "quantitative", scale: xDomain } } },
            { mark: { type: "text", align: "left", dx: 4, fontSize: 11 }, encoding: { y: { field: "Application", type: "nominal", sort: "-x" }, x: { field: "Ratio", type: "quantitative", scale: xDomain }, text: { field: "Label", type: "nominal" } } },
        ],
    };
    return (
        <Stage id="fin-unit" title="What an outcome costs" description="AI cost for each application, per outcome it delivers and per person using it, set against the time the same work takes by hand." empty={u.empty}>
            <div className="flex flex-wrap items-center gap-x-500 gap-y-300">
                <p className={cn(SMALL, "text-muted-foreground")}>Effective basis, all providers, {period(u.window)}</p>
                <div className="flex flex-wrap items-center gap-200">
                    <span className={cn(SMALL, "text-muted-foreground")}>Share of hand time saved</span>
                    <SegmentedControl label="Share of hand time saved" options={SAVED_OPTIONS} value={saved} onChange={setSaved} />
                </div>
            </div>
            <div className={gridKpi}>
                <KpiCard label="Applications with outcomes" value={rows.length} detail={`${drawn.length} have a hand-time reference`} />
                <KpiCard label="Outcomes delivered" value={rows.reduce((t, r) => t + r.outcomes, 0)} detail="Across every application, each in its own unit" />
                <KpiCard label="AI cost with an owner" value={rows.reduce((t, r) => t + r.cost, 0)} format="currency" prefix="$" detail={`${pct(u.untaggedShare)} of AI cost has no application tag`} />
                <KpiCard label="Reference loaded rate" value={ASSUMPTIONS.hourly} format="currency" prefix="$" detail="Per hour: a planning assumption, not a measurement" />
            </div>
            <div className={gridWide}>
                <Table
                    caption="Cost per outcome and per person. An application without a reference has no time value, and none is invented."
                    headers={["Application", "Outcome", "Cost", "Outcomes", "Per outcome", "Per person each month", "Time value ÷ cost"]}
                    rows={rows.map((r) => [
                        <strong>{r.app.id}</strong>,
                        r.app.outcome,
                        usd(r.cost),
                        whole(r.outcomes),
                        r.perOutcome === null ? "—" : usdSmall(r.perOutcome),
                        r.perPersonMonth === null ? "Serves customers or runs as a batch" : usdSmall(r.perPersonMonth),
                        r.ratio === null ? "No reference" : `${r.ratio.toFixed(1)}×`,
                    ])}
                />
                <Chart
                    title="Time value against AI cost"
                    subtitle={`At ${pct(share)} saved. Dashed line is break-even`}
                    spec={chart}
                    rows={drawn.map((r) => ({ Application: r.app.id, Ratio: r.ratio, Label: `${r.ratio!.toFixed(1)}×` }))}
                    height={barHeight(drawn.length)}
                />
            </div>
            <div className={cn(panel, "flex flex-col gap-200")}>
                <h3 className={cn(BODY, "font-semibold")}>Where these applications show up as processes</h3>
                <ul className="flex flex-col gap-100">
                    {rows.filter((r) => r.app.agent).map((r) => (
                        <li key={r.app.id} className={SMALL}>
                            <strong>{r.app.id}</strong> serves the {r.app.agent}.{" "}
                            <a className={link} href="#/business-impact/impact-agents">See it in Business impact</a>
                        </li>
                    ))}
                </ul>
                <p className={cn(SMALL, "max-w-[90ch] text-muted-foreground")}>
                    The link is declared in the tags the application carries, not observed from the traffic. It puts a cost beside the agent; it does not prove which process the cost served.
                </p>
            </div>
            <ul className={notes}>
                <li>Cost is on the Effective basis so a prepaid credit or a commitment is spread over the work it paid for. Days with no token detail are left out of both the cost and the outcomes.</li>
                <li>Time value is the reference minutes for one outcome by hand, at the loaded rate, times the share you choose. It is a planning figure to compare applications, not savings that have been realised.</li>
                <li>This page follows the dates in the filter bar.</li>
            </ul>
        </Stage>
    );
}

// ── Optimise: rates, commitments and credits ────────────────────────────

export function Rates() {
    const view = useFinopsView();
    const r = useMemo(() => rates(data, view), [view]);
    const p = useMemo(() => pack(data), []);
    const queue = useMemo(() => findings(data).filter((f) => f.area === "Rates"), []);
    const roles = useRoles();
    const steps = useMemo(
        () => waterfall({ label: "List price", value: r.total.list }, [{ label: "Negotiated discount", delta: -r.total.negotiated }, { label: "Contracted", total: true }, { label: "Commitments and credits", delta: -r.total.commitmentEffect }, { label: "Effective", total: true }]),
        [r.total],
    );
    const floor = waterfallFloor(steps);
    const bars = waterfallRows(steps, floor);
    const packChart = {
        mark: { type: "line", strokeWidth: 2 },
        encoding: {
            x: { field: "Date", type: "temporal", title: null, axis: { format: "%d %b", labelOverlap: true } },
            y: { field: "Balance", type: "quantitative", title: null, axis: money },
            color: { value: roles.navy },
            strokeDash: { field: "Kind", type: "nominal", title: null, scale: { domain: ["Actual", "Projected"], range: [[1, 0], [5, 4]] },             legend: { orient: "top", direction: "horizontal", symbolLimit: 20 } },
            tooltip: [{ field: "Date", type: "temporal", format: "%d %b" }, { field: "Balance", type: "quantitative", format: "$,.0f" }, { field: "Kind", type: "nominal" }],
        },
    };
    return (
        <Stage id="fin-rates" title="Rates, commitments and credits" description="What the discounts, commitments and prepaid credits are doing to the price, what is going unused, and what is about to run out." empty={r.empty}>
            <ViewControls basis={false} provider={false} />
            {queue.length > 0 && (
                <div className={cn(panel, "flex flex-col gap-300")}>
                    <h3 className={cn(BODY, "font-semibold")}>Worth a look here</h3>
                    <ol className="flex flex-col divide-y divide-border">{queue.map((f) => <FindingRow key={f.id} finding={f} full />)}</ol>
                </div>
            )}
            <div className={gridWide}>
                <Chart
                    title="From list price to what was paid for the usage"
                    subtitle={`${period(r.window)}. The axis starts at ${usdShort(floor)}`}
                    spec={waterfallSpec(bars.map((b) => b.Key), roles, floor, waterfallCeiling(bars, floor))}
                    rows={bars}
                    height={320}
                    capabilities={BAND_CAPS}
                />
                <Table
                    caption="By provider. A gap to list price is the discount you negotiated, not proven savings."
                    headers={["Provider", "List", "Contracted", "Effective", "Discount to list"]}
                    rows={[...r.rows, r.total].map((row) => [<strong>{row.provider === "All" ? "All providers" : row.provider}</strong>, usd(row.list), usd(row.contracted), usd(row.effective), row.list > 0 ? pct(row.negotiated / row.list, 1) : "—"])}
                />
            </div>
            <Table
                caption="Commitments, as of the latest utilisation the provider reported."
                headers={["Commitment", "Provider", "Term", "Monthly commit", "Coverage", "Utilisation", "Unused each month", "Data as of"]}
                rows={r.commitments.map((c) => [
                    <strong>{c.record.name}</strong>,
                    c.record.provider,
                    c.record.term,
                    usd(c.record.monthlyCommit),
                    `${pct(c.coverageStart)} → ${pct(c.coverage)}`,
                    `${pct(c.utilisationStart)} → ${pct(c.utilisation)}`,
                    usd(c.unused),
                    <span className="inline-flex items-center gap-200">{day(c.record.asOf, false)}{c.late && <StatusChip status="Late" />}</span>,
                ])}
            />
            {r.ptu && (
                <dl className={cn(panel, "grid gap-x-600 gap-y-300 sm:grid-cols-3")}>
                    <div>
                        <dt className={cn(SMALL, "text-muted-foreground")}>Provisioned throughput, fixed fee</dt>
                        <dd className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">{usdShort(r.ptu.fee)}</dd>
                    </div>
                    <div>
                        <dt className={cn(SMALL, "text-muted-foreground")}>Same usage at pay-as-you-go</dt>
                        <dd className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">{usdShort(r.ptu.payg)}</dd>
                    </div>
                    <div>
                        <dt className={cn(SMALL, "text-muted-foreground")}>Share of the fee that was used</dt>
                        <dd className="font-numeric text-[length:var(--text-600)] font-semibold tabular-nums">{pct(r.ptu.utilisation)}</dd>
                    </div>
                    <p className={cn(SMALL, "text-muted-foreground sm:col-span-3")}>Over {r.ptu.days} days. Below half used, pay-as-you-go would have cost less; a throughput commitment is for steady, predictable load.</p>
                </dl>
            )}
            <div className={gridKpi}>
                <KpiCard label="Prepaid credits bought" value={p.purchased} format="currency" prefix="$" detail={`OpenAI, ${day("2026-08-17", false)}`} />
                <KpiCard label="Credits used" value={p.drawn} format="currency" prefix="$" detail={`${pct(p.drawn / p.purchased)} of the pack`} />
                <KpiCard label="Balance" value={p.balance} format="currency" prefix="$" emphasis detail={p.daysLeft === null ? "No draw in the last week" : `About ${Math.round(p.daysLeft)} days at the last week's pace`} />
                <KpiCard label="Cost once credits run out" value={p.monthlyAfter} format="currency" prefix="$" detail={p.exhausts ? `A month, from about ${day(p.exhausts, false)}` : "No end date at this pace"} />
            </div>
            <Chart title="Prepaid credit balance" subtitle="Actual to the last day, then the last week's pace to zero" spec={packChart} rows={p.series} height={260} />
            <ul className={notes}>
                <li>Credits and commitments move cost between months, so the Effective basis spreads them over the usage they cover. Billed shows when the money left.</li>
                <li>Commitment utilisation can be a few days behind cost; the Late chip says so. The date range moves the waterfall and the rate table; the commitments, throughput and credits are shown as at the end of the data.</li>
            </ul>
        </Stage>
    );
}

// ── Expand: forecast ────────────────────────────────────────────────────

const SCOPES: readonly { id: ForecastScope; label: string }[] = [{ id: "All spend", label: "All spend" }, { id: "AI spend", label: "AI spend" }];
const ADDS = ASSUMPTIONS.expand.map((n) => ({ id: String(n), label: `${n.toLocaleString("en-US")} people` }));

export function Forecast() {
    const [scope, setScope] = useState<ForecastScope>("All spend");
    const [adds, setAdds] = useState(String(ASSUMPTIONS.expand[1]));
    const f = useMemo(() => forecast(data, scope), [scope]);
    const e = useMemo(() => expansion(data, Number(adds)), [adds]);
    const roles = useRoles();
    const narrow = useMediaQuery("(max-width: 767px)");
    const domain = ["Actual", PACE_SERIES, ...SCENARIOS, "Budget"];
    const chart = {
        mark: { type: "line", point: { size: 40 }, strokeWidth: 2 },
        encoding: {
            x: monthAxis(f.monthOrder),
            y: { field: "Value", type: "quantitative", title: null, axis: money },
            color: { field: "Series", type: "nominal", title: null, scale: { domain, range: [roles.navy, roles.slate, roles.teal, roles.amber, roles.plum, roles.blue] },
                legend: narrow ? { orient: "bottom", columns: 1, labelLimit: 220, symbolLimit: 20 } : { orient: "top", direction: "horizontal", labelLimit: 220, symbolLimit: 20 } },
            strokeDash: { field: "Series", type: "nominal", title: null, scale: { domain, range: [[1, 0], [4, 3], [1, 0], [1, 0], [1, 0], [6, 4]] }, legend: null },
            tooltip: [{ field: "Series", type: "nominal" }, { field: "Month", type: "nominal" }, { field: "Value", type: "quantitative", format: "$,.0f" }],
        },
    };
    const current = f.months[0];
    const budget = f.crossing?.budget ?? null;
    return (
        <Stage id="fin-forecast" title="Where spend is heading" description="Three ways the next three months could go from what has already been spent, against the budget, and what expanding AI to more people would add.">
            <div className="flex flex-wrap items-center gap-x-500 gap-y-300">
                <div className="flex flex-wrap items-center gap-200">
                    <span className={cn(SMALL, "text-muted-foreground")}>Spend</span>
                    <SegmentedControl label="Forecast scope" options={SCOPES} value={scope} onChange={setScope} />
                </div>
                <p className={cn(SMALL, "text-muted-foreground")}>Effective basis. Not changed by the date range or the provider.</p>
            </div>
            <div className={gridKpi}>
                <KpiCard label="Spent so far this month" value={f.toDate} format="currency" prefix="$" detail={budget === null ? "No budget set" : `${pct(f.toDate / budget)} of the ${usdShort(budget)} budget`} />
                <KpiCard label="This month at the last week's pace" value={f.pace} format="currency" prefix="$" emphasis detail={budget === null ? undefined : f.pace > budget ? `${usdShort(f.pace - budget)} over budget` : `${usdShort(budget - f.pace)} under budget`} />
                <KpiCard label="Recent monthly growth" value={f.growth ?? undefined} format="percent" emptyValue="—" detail={f.growth === null ? "Needs three complete months" : "A month's daily spend against the one two months before, per month"} />
                <KpiCard label={`${current?.label ?? "Next month"}, recent trend`} value={current?.values["Recent trend"] ?? undefined} format="currency" prefix="$" emptyValue="—" detail={current?.budget != null ? `Budget ${usdShort(current.budget)}` : "No budget set"} />
            </div>
            {f.crossing && (
                <p className={cn(panel, BODY)}>
                    {f.crossing.crossed
                        ? `Spend has already passed the ${usdShort(f.crossing.budget)} budget for ${f.crossing.label}${f.crossing.date ? `, on ${day(f.crossing.date, false)}` : ""}.`
                        : f.crossing.date
                            ? `At the last week's pace, ${f.crossing.label} passes its ${usdShort(f.crossing.budget)} budget on ${day(f.crossing.date, false)}.`
                            : `At the last week's pace, ${f.crossing.label} stays within its ${usdShort(f.crossing.budget)} budget.`}
                </p>
            )}
            <div className={gridWide}>
                <Chart title="Three scenarios against the budget" subtitle="Months to date, then three scenarios. Not confidence intervals" spec={chart} rows={f.chart} height={narrow ? 480 : 340} capabilities={BAND_CAPS} />
                <Table
                    caption="The next three months, by scenario."
                    headers={["Month", ...SCENARIOS, "Budget"]}
                    rows={f.months.map((m) => [<strong>{m.label}</strong>, ...SCENARIOS.map((s) => (m.values[s] === null ? (f.reasons[s] ?? "—") : usd(m.values[s]!))), m.budget === null ? "—" : usd(m.budget)])}
                />
            </div>
            <div className={cn(panel, "flex flex-col gap-300")}>
                <h3 className={cn(BODY, "font-semibold")}>Each provider, on its own</h3>
                <ul className="grid grid-cols-1 gap-300 sm:grid-cols-2 xl:grid-cols-5">
                    {f.outlook.map(({ provider, projection }) => {
                        const next = projection.months[0];
                        const reason = Object.values(projection.reasons)[0];
                        return (
                            <li key={provider} className="flex flex-col gap-100">
                                <strong className={BODY}>{provider}</strong>
                                <span className={cn(SMALL, "font-numeric tabular-nums")}>{next?.values["Recent trend"] != null ? `${next.label}: ${usdShort(next.values["Recent trend"])} on the recent trend` : (reason ?? "No projection")}</span>
                                <span className={cn(SMALL, "text-muted-foreground")}>{projection.growth === null ? "Growth not measurable" : `${signedPct(projection.growth)} a month`}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <div className={cn(panel, "flex flex-col gap-300")}>
                <div className="flex flex-wrap items-center justify-between gap-300">
                    <h3 className={cn(BODY, "font-semibold")}>What expanding to more people would cost</h3>
                    <SegmentedControl label="People added" options={ADDS} value={adds} onChange={setAdds} />
                </div>
                <p className={BODY}>
                    {e.perPerson > 0
                        ? `At today's blended AI cost of ${usdSmall(e.perPerson)} per person a month, ${Number(adds).toLocaleString("en-US")} more people would add about ${usdShort(e.extra)} a month.`
                        : "There is not enough per-person data to estimate this."}
                    {e.headroom !== null && e.supports !== null && ` ${e.nextLabel} has ${usdShort(Math.max(0, e.headroom))} of AI budget headroom on a flat pace, enough for about ${e.supports.toLocaleString("en-US")} more people.`}
                </p>
                <p className={cn(SMALL, "text-muted-foreground")}>
                    Which teams to expand to first, and how ready they are, is on the <a className={link} href="#/readiness">Expand</a> pages.
                </p>
            </div>
            <ul className={notes}>
                <li>Flat holds the last week&apos;s daily pace. Recent trend continues the growth of the last complete months. Faster adoption grows {ASSUMPTIONS.fasterAdoption} times as fast; it is shown only while spend is rising.</li>
                <li>A scenario with too little history says so instead of showing a number. The range around the scenarios is wide on purpose and is not a statistical interval.</li>
            </ul>
        </Stage>
    );
}
