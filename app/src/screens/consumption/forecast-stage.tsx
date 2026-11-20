//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useId, useMemo, useRef, useState } from "react";
import { NotFilteredHint } from "@/components/not-filtered-hint";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/query-states";
import { Section } from "@/components/section";
import { VegaVisual, type VisualizationSpec } from "@/components/vega-visual";
import { useCommercialTerms } from "@/hooks/commercial-terms.context";
import { useThemeContext } from "@/hooks/theme.context";
import {
    calculateForecast,
    forecastChartTable,
    forecastExportTable,
    parseForecastNumber,
    readForecastBaseline,
    shiftForecastMonth,
    type ForecastBaseline,
    type ForecastScenario,
    type ForecastSeries,
} from "@/lib/cowork-forecast";
import { FILTER_KEYS } from "@/lib/filters";
import { INPUT, SECONDARY } from "@/lib/form-controls";
import { downloadTableCsv } from "@/lib/table-csv";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { coworkWeekly } from "@/queries/consumption/cowork";
import forecastSpec from "@/queries/consumption/forecast-credits.json";
import { useConsumptionTable } from "./data";

const DISCLOSURE = "cursor-pointer rounded-sm text-300 leading-300 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const CELL = "px-300 py-200 text-right tabular-nums";
const HEADING = "text-300 leading-300 font-semibold";
const fmt = (value: number, decimals = 0) => value.toLocaleString("en-US", { maximumFractionDigits: decimals });
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const dateLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type FieldKey = "horizonMonths" | "monthlyGrowthPercent" | "intensityFactor" | "sensitivityPercent" | "startingUsers" | "availablePrepaidCredits" | "prepaidRate" | "paygRate";
type DatedDraft = { id: number; month: string; value: string };

function NumberField({ label, hint, value, onChange, error }: {
    label: string;
    hint: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    const id = useId();
    return (
        <div className="flex min-w-0 flex-col gap-100">
            <label htmlFor={id} className={cn(SMALL, "font-semibold")}>{label}</label>
            <input id={id} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
                value={value} onChange={(event) => onChange(event.target.value)} className={INPUT}
                aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} />
            <span id={`${id}-hint`} className={cn(SMALL, "text-muted-foreground")}>{hint}</span>
            {error && <span id={`${id}-error`} className={cn(SMALL, "text-destructive")}>{error}</span>}
        </div>
    );
}

function MonthField({ label, value, months, onChange, error }: {
    label: string;
    value: string;
    months: readonly string[];
    onChange: (value: string) => void;
    error?: string;
}) {
    const id = useId();
    return (
        <div className="flex min-w-0 flex-col gap-100">
            <label htmlFor={id} className={cn(SMALL, "font-semibold")}>{label}</label>
            <select id={id} className={INPUT} value={value} onChange={(event) => onChange(event.target.value)}
                aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
                {!months.includes(value) && <option value={value}>{monthLabel(value)} — outside horizon</option>}
                {months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
            </select>
            {error && <span id={`${id}-error`} className={cn(SMALL, "text-destructive")}>{error}</span>}
        </div>
    );
}

function ScenarioTotals({ series }: { series: ForecastSeries[] }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Sensitivity estimates">
            <table className={cn(SMALL, "w-full whitespace-nowrap bg-card")}>
                <caption className="px-300 py-200 text-left text-muted-foreground">Scenario sensitivity, not confidence intervals. Same purchases in all three cases.</caption>
                <thead className="border-y border-border bg-muted text-muted-foreground">
                    <tr>
                        <th scope="col" className="px-300 py-200 text-left font-semibold">Scenario</th>
                        <th scope="col" className={CELL}>Credits</th>
                        <th scope="col" className={CELL}>Consumed cost</th>
                        <th scope="col" className={CELL}>First PAYG month</th>
                    </tr>
                </thead>
                <tbody>
                    {series.map((band) => (
                        <tr key={band.sensitivity} className={cn("border-b border-border last:border-0", band.sensitivity === "Base" && "bg-accent")}>
                            <th scope="row" className="px-300 py-200 text-left font-semibold">{band.sensitivity} · {fmt(band.factor, 2)}×</th>
                            <td className={CELL}>{fmt(band.totalCredits)}</td>
                            <td className={CELL}>{money(band.consumedCost)}</td>
                            <td className={CELL}>{band.firstPaygMonth ? monthLabel(band.firstPaygMonth) : "Not in horizon"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function MonthlyTable({ series }: { series: ForecastSeries[] }) {
    const base = series.find((band) => band.sensitivity === "Base")!;
    const low = series.find((band) => band.sensitivity === "Low")!;
    const high = series.find((band) => band.sensitivity === "High")!;
    return (
        <div className="overflow-x-auto rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Base monthly forecast">
            <table className={cn(SMALL, "w-full whitespace-nowrap bg-card")}>
                <caption className="px-300 py-200 text-left text-muted-foreground">
                    Monthly estimate: low / base / high credit sensitivity; prepaid and costs use base. Costs are USD; users are weekly-active equivalents, not distinct monthly users.
                </caption>
                <thead className="border-y border-border bg-muted text-muted-foreground">
                    <tr>
                        <th scope="col" className="px-300 py-200 text-left">Month</th>
                        {["Users", "Low credits", "Base credits", "High credits", "Prepaid used", "PAYG credits", "Prepaid remaining", "Consumed cost", "Top-up purchases"].map((label) => <th key={label} scope="col" className={CELL}>{label}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {base.months.map((month, i) => (
                        <tr key={month.month} className="border-b border-border last:border-0 hover:bg-muted">
                            <th scope="row" className="px-300 py-200 text-left font-medium">{monthLabel(month.month)}</th>
                            <td className={CELL}>{month.activeUsers === undefined ? "Not available" : fmt(month.activeUsers, 1)}</td>
                            <td className={CELL}>{fmt(low.months[i].credits)}</td>
                            <td className={CELL}>{fmt(month.credits)}</td>
                            <td className={CELL}>{fmt(high.months[i].credits)}</td>
                            <td className={CELL}>{fmt(month.prepaidCredits)}</td>
                            <td className={CELL}>{fmt(month.paygCredits)}</td>
                            <td className={CELL}>{fmt(month.closingPrepaidCredits)}</td>
                            <td className={CELL}>{money(month.consumedCost)}</td>
                            <td className={CELL}>{money(month.committedPurchases)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ForecastPlan({ baseline, today }: { baseline: ForecastBaseline; today: string }) {
    const { saved, model, status } = useCommercialTerms();
    const { theme } = useThemeContext();
    const [startMonth] = useState(() => shiftForecastMonth(today.slice(0, 7), 1));
    const [draft, setDraft] = useState<Partial<Record<FieldKey, string>>>({});
    const [waves, setWaves] = useState<DatedDraft[]>([]);
    const [topUps, setTopUps] = useState<DatedDraft[]>([]);
    const [exportStatus, setExportStatus] = useState("");
    const nextId = useRef(0);
    const payg = saved?.creditRate ?? model?.creditRate;
    const prepaid = saved?.prepaidCreditRate ?? model?.prepaidCreditRate;
    const seed: Record<FieldKey, string> = {
        horizonMonths: "12", monthlyGrowthPercent: "0", intensityFactor: "1", sensitivityPercent: "20",
        startingUsers: baseline.weeklyActiveUsers === undefined ? "" : String(baseline.weeklyActiveUsers),
        availablePrepaidCredits: "0", prepaidRate: prepaid === undefined ? "" : String(prepaid), paygRate: payg === undefined ? "" : String(payg),
    };
    const text = (key: FieldKey) => draft[key] ?? seed[key];
    const number = (key: FieldKey) => parseForecastNumber(text(key));
    const scenario: ForecastScenario = {
        startMonth,
        horizonMonths: number("horizonMonths"),
        monthlyGrowthPercent: number("monthlyGrowthPercent"),
        intensityFactor: number("intensityFactor"),
        sensitivityPercent: number("sensitivityPercent"),
        startingUsers: text("startingUsers").trim() === "" ? undefined : number("startingUsers"),
        availablePrepaidCredits: number("availablePrepaidCredits"),
        prepaidRate: number("prepaidRate"),
        paygRate: number("paygRate"),
        waves: waves.map((wave) => ({ month: wave.month, additionalUsers: parseForecastNumber(wave.value) })),
        topUps: topUps.map((topUp) => ({ month: topUp.month, credits: parseForecastNumber(topUp.value) })),
    };
    const result = calculateForecast(baseline, scenario);
    const errors = result.ok ? {} : result.errors;
    const months = Number.isInteger(scenario.horizonMonths) && scenario.horizonMonths >= 1 && scenario.horizonMonths <= 24
        ? Array.from({ length: scenario.horizonMonths }, (_, i) => shiftForecastMonth(startMonth, i))
        : [];
    const base = result.ok ? result.series.find((band) => band.sensitivity === "Base")! : undefined;
    const rateSource = (key: "prepaidRate" | "paygRate", savedRate: number | undefined, modelRate: number | undefined) =>
        draft[key] !== undefined ? "Local scenario override."
            : savedRate !== undefined ? "Seeded from saved app terms."
                : modelRate !== undefined ? "Seeded from model terms." : "Not available yet; enter a planning rate.";
    const fields: { key: FieldKey; label: string; hint: string }[] = [
        { key: "horizonMonths", label: "Horizon (months)", hint: `1–24 full months, starting ${monthLabel(startMonth)}.` },
        { key: "monthlyGrowthPercent", label: "Monthly adoption growth (%)", hint: "−100 to 100. Compounds from month two." },
        { key: "intensityFactor", label: "Credit intensity (×)", hint: "1 = baseline credits per user. Range 0–10." },
        { key: "sensitivityPercent", label: "Low / high sensitivity (±%)", hint: "0–100. Varies credit intensity, not users." },
        { key: "startingUsers", label: "Starting active users", hint: baseline.weeklyActiveUsers === undefined ? "Optional assumption; required for rollout waves." : `Baseline: ${fmt(baseline.weeklyActiveUsers, 2)} mean weekly active users. Blank keeps baseline.` },
        { key: "availablePrepaidCredits", label: "Available prepaid credits", hint: "Planning assumption. Starts at 0; configured pack balance is not verified remaining credit." },
        { key: "prepaidRate", label: "Prepaid rate (USD / credit)", hint: `${rateSource("prepaidRate", saved?.prepaidCreditRate, model?.prepaidCreditRate)} Range $0–$1.` },
        { key: "paygRate", label: "PAYG rate (USD / credit)", hint: `${rateSource("paygRate", saved?.creditRate, model?.creditRate)} Range $0–$1.` },
    ];
    const reset = () => {
        setDraft({});
        setWaves([]);
        setTopUps([]);
        setExportStatus("");
    };

    return (
        <>
            <div className="flex flex-wrap items-start justify-between gap-300">
                <p className={cn(BODY, "max-w-prose text-muted-foreground")}>
                    Baseline: <strong className="font-semibold text-foreground">{fmt(baseline.weeklyCredits, 1)} credits / week</strong>
                    {baseline.weeklyActiveUsers !== undefined && <> · {fmt(baseline.weeklyActiveUsers, 1)} mean weekly active users</>}.
                    {" "}{baseline.weeks} reported complete {baseline.weeks === 1 ? "week" : "weeks"}, {dateLabel(baseline.periodStart)}–{dateLabel(baseline.periodEnd)}.
                    {" "}At 52 ÷ 12 weeks per month, that is {fmt(baseline.monthlyCredits)} credits / month before scenario changes.
                </p>
                <div className="flex flex-wrap items-center gap-200">
                    <button type="button" className={SECONDARY} onClick={reset}>Reset to baseline</button>
                    <button type="button" className={SECONDARY} disabled={!result.ok} onClick={() => {
                        if (!result.ok) return;
                        try {
                            downloadTableCsv(forecastExportTable(baseline, scenario, result.series), "Cowork forecast estimate", baseline.periodEnd);
                            setExportStatus("Forecast CSV downloaded with assumptions.");
                        } catch {
                            setExportStatus("CSV download failed. Try exporting again.");
                        }
                    }}>Export forecast CSV</button>
                </div>
            </div>
            <p className="sr-only" role="status">{exportStatus}</p>
            {baseline.weeks < 4 && <p className={cn(SMALL, "text-caution")}>Limited history: fewer than four reported weeks. Treat the baseline with extra caution.</p>}
            {(Date.parse(`${today}T00:00:00Z`) - Date.parse(`${baseline.periodEnd}T00:00:00Z`)) / 86_400_000 > 14 && (
                <p className={cn(SMALL, "text-caution")}>The latest complete source week ended more than two weeks ago. Refresh ingestion before relying on this estimate.</p>
            )}
            {status === "unavailable" && <p className={cn(SMALL, "text-caution")}>Saved terms are unavailable. Model rates apply where available; edits here remain local.</p>}

            <div className="grid items-start gap-500 xl:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-400">
                    <fieldset className="min-w-0">
                        <legend className={cn(HEADING, "mb-200")}>Planning assumptions</legend>
                        <p className={cn(SMALL, "mb-300 text-muted-foreground")}>Local to this view. Nothing is saved as billing settings or ordered.</p>
                        <div className="grid gap-300 sm:grid-cols-2">
                            {fields.map((field) => <NumberField key={field.key} label={field.label} hint={field.hint}
                                value={text(field.key)} error={errors[field.key]}
                                onChange={(value) => { setDraft((current) => ({ ...current, [field.key]: value })); setExportStatus(""); }} />)}
                        </div>
                    </fieldset>
                    {([
                        { key: "waves", label: "Rollout waves", entries: waves, set: setWaves, add: "Add rollout wave", quantity: "Additional users", quantityKey: "additionalUsers", hint: "Added at the start of this month; grows with adoption thereafter." },
                        { key: "topUps", label: "Pack top-ups", entries: topUps, set: setTopUps, add: "Add pack top-up", quantity: "Top-up credits", quantityKey: "credits", hint: "One-off purchase at the prepaid rate, available at the start of this month." },
                    ] as const).map((group) => (
                        <details key={group.key} className="border-t border-border pt-300">
                            <summary className={DISCLOSURE}>{group.label} ({group.entries.length})</summary>
                            <div className="mt-300 flex flex-col gap-300">
                                <p className={cn(SMALL, "text-muted-foreground")}>{group.hint}</p>
                                {group.entries.map((entry, i) => (
                                    <fieldset key={entry.id} className="min-w-0 border-b border-border pb-300">
                                        <legend className={cn(SMALL, "mb-200 font-semibold")}>{group.key === "waves" ? "Wave" : "Top-up"} {i + 1}</legend>
                                        <div className="grid gap-200 sm:grid-cols-2">
                                            <MonthField label={`${group.key === "waves" ? "Wave" : "Top-up"} ${i + 1} month`} value={entry.month} months={months}
                                                error={errors[`${group.key}.${i}.month`]}
                                                onChange={(month) => group.set((current) => current.map((item) => item.id === entry.id ? { ...item, month } : item))} />
                                            <NumberField label={`${group.quantity} ${i + 1}`} hint="Whole number above zero." value={entry.value}
                                                error={errors[`${group.key}.${i}.${group.quantityKey}`]}
                                                onChange={(value) => group.set((current) => current.map((item) => item.id === entry.id ? { ...item, value } : item))} />
                                        </div>
                                        <button type="button" className={cn(SECONDARY, "mt-200")} onClick={() => group.set((current) => current.filter((item) => item.id !== entry.id))}
                                            aria-label={`Remove ${group.key === "waves" ? "wave" : "top-up"} ${i + 1}`}>Remove</button>
                                    </fieldset>
                                ))}
                                <button type="button" className={cn(SECONDARY, "self-start")} disabled={months.length === 0 || group.entries.length >= 24}
                                    onClick={() => group.set((current) => [...current, { id: nextId.current++, month: startMonth, value: "" }])}>{group.add}</button>
                            </div>
                        </details>
                    ))}
                </div>

                <div className="flex min-w-0 flex-col gap-400 xl:col-span-2">
                    {result.ok && base ? (
                        <>
                            <div className="rounded-xl border border-border bg-card p-500">
                                <h3 className={cn(HEADING, "mb-300")}>Base estimate · {monthLabel(startMonth)}–{monthLabel(base.months[base.months.length - 1].month)}</h3>
                                <dl className="grid gap-400 sm:grid-cols-3">
                                    <div><dt className={cn(SMALL, "text-muted-foreground")}>Consumed cost</dt><dd className="text-500 leading-500 font-semibold tabular-nums">{money(base.consumedCost)}</dd></div>
                                    <div><dt className={cn(SMALL, "text-muted-foreground")}>Top-up purchases</dt><dd className="text-500 leading-500 font-semibold tabular-nums">{money(base.committedPurchases)}</dd></div>
                                    <div><dt className={cn(SMALL, "text-muted-foreground")}>First PAYG month</dt><dd className="text-500 leading-500 font-semibold">{base.firstPaygMonth ? monthLabel(base.firstPaygMonth) : "Not in horizon"}</dd></div>
                                </dl>
                                <p className={cn(SMALL, "mt-300 text-muted-foreground")}>
                                    {fmt(base.closingPrepaidCredits)} prepaid credits remain at the end.
                                    {" "}Estimated new spend: {money(base.committedPurchases + base.paygCost)} (top-up purchases + PAYG; not added to consumed cost).
                                </p>
                            </div>
                            <div className="h-[calc(var(--spacing-800)*11)] min-w-0">
                                <VegaVisual label="Estimated monthly credits: base line and low-to-high sensitivity band; exact figures in the forecast CSV and tables"
                                    spec={forecastSpec as VisualizationSpec} data={forecastChartTable(result.series)} theme={theme}
                                    header={{ title: "Credit demand estimate", subtitle: "Line: base. Shading: low–high scenario sensitivity, not a confidence interval." }} />
                            </div>
                            <ScenarioTotals series={result.series} />
                        </>
                    ) : (
                        <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-500">
                            <h3 className={cn(HEADING, "text-destructive")}>Complete the planning assumptions</h3>
                            <p className={cn(BODY, "mt-200 text-muted-foreground")}>{errors.scenario ?? errors.baseline ?? "Correct the marked fields to calculate an estimate. Blank or invalid numbers are not treated as zero."}</p>
                        </div>
                    )}
                </div>
            </div>

            {result.ok && <MonthlyTable series={result.series} />}
            <div className={cn(SMALL, "flex max-w-prose flex-col gap-200 border-t border-border pt-300 text-muted-foreground")}>
                <h3 className={cn(HEADING, "text-foreground")}>How to read this estimate</h3>
                <p>The baseline uses up to four reported complete weeks in the latest four-week window. Missing weeks are not zero-filled; incomplete weeks are excluded. Mean weekly credits × 52 ÷ 12 gives an average month, not an invoice period.</p>
                <p>{baseline.weeklyActiveUsers === undefined
                    ? "Active users are unavailable for the full source period. Growth applies to total credits; an assumed starting user count is needed to price rollout waves."
                    : "Baseline credits per user use the same weeks as active users. Starting-user changes scale that baseline; monthly growth applies from month two."}
                    {" "}Rollout users and top-ups arrive at the start of their selected month. Low and high vary intensity around base, not adoption.</p>
                <p>Prepaid credits deplete cumulatively and carry forward, never reset each month. Later top-ups can restore coverage after PAYG has started. Consumed cost values prepaid use at the prepaid rate plus PAYG use; purchases count only new top-ups. Opening credits are assumed already purchased. Do not add consumed cost to purchases.</p>
                <p>Estimate only, not a billing forecast or commitment. Excludes credit expiry, tax, invoice reconciliation, licence charges, other products and changes to rates or policies. No capacity cap or seasonality is inferred. This scenario is discarded when you leave the stage.</p>
            </div>
        </>
    );
}

/** Latest visible data: page filters do not narrow the baseline; model access controls still apply. */
export function ForecastStage() {
    const weekly = useConsumptionTable(coworkWeekly("consumption"), [], FILTER_KEYS);
    const { status } = useCommercialTerms();
    const today = new Date().toISOString().slice(0, 10);
    const baseline = useMemo(() => readForecastBaseline(weekly.table, today), [weekly.table, today]);
    return (
        <Section id="stage-forecast" title="Forecast" description="Estimate Cowork / Work IQ credit demand, prepaid runway and PAYG from recent ingestion.">
            <NotFilteredHint ignored={FILTER_KEYS} reason="forecasting uses the latest complete weeks available to you, not a filtered billing period. Model access controls still apply." />
            {weekly.error !== undefined ? <QueryError message={weekly.error} onRetry={weekly.refetch} />
                : weekly.isLoading || status === "loading" ? (
                    <div aria-label="Loading forecast baseline" className="grid gap-400 md:grid-cols-3"><QueryLoading /><QueryLoading className="md:col-span-2" /></div>
                ) : !baseline || baseline.monthlyCredits === 0 ? (
                    <QueryEmpty title="No recent credit baseline" description="Forecast needs a completed week with positive Cowork / Work IQ credits in the existing weekly ingestion. Check the export has loaded, or wait for the current week to finish." />
                ) : <ForecastPlan baseline={baseline} today={today} />}
        </Section>
    );
}
