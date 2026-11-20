import { useMemo } from "react";
import { stageAnchor } from "@/components/destinations";
import { KpiCard } from "@/components/kpi-card";
import { NotFilteredHint } from "@/components/not-filtered-hint";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/query-states";
import { Section } from "@/components/section";
import { VegaVisual } from "@/components/vega-visual";
import { useFilteredQuery } from "@/hooks/use-filtered-query";
import { useThemeContext } from "@/hooks/theme.context";
import { rowChartHeight } from "@/lib/chart-height";
import { readNumber, readText, toSummaryRow } from "@/lib/summary-row";
import { toDataTable } from "@/lib/to-data-table";
import { SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { licenseDormancy, licenseEstateSummary } from "@/queries/licensing";

export function IdleLicensesStage() {
    const { theme } = useThemeContext();
    const estate = useFilteredQuery(licenseEstateSummary());
    const dormancy = licenseDormancy();
    const result = useFilteredQuery(dormancy);
    const row = useMemo(() => estate.data?.status === "success" ? toSummaryRow(estate.data.table) : undefined, [estate.data]);
    const table = useMemo(() => result.data?.status === "success" ? toDataTable(result.data.table, dormancy.columnMetadata) : undefined,
        [result.data, dormancy.columnMetadata]);
    const unreconciled = readNumber(row, "[License Inventory Usable]") === 0;
    const notices = [readText(row, "[License Evidence Notice]"), readText(row, "[Reclaim Cost Notice]")].filter(Boolean);
    return (
        <Section id={stageAnchor("idle-licenses")} title="Idle licences"
            description="Review unused seats before buying more. Inactivity is a review signal, not a recommendation to remove a licence automatically.">
            <NotFilteredHint from={[estate.notFilteredBy, result.notFilteredBy]} />
            {estate.data?.status === "error" ? <QueryError message={estate.data.error.message} onRetry={estate.refetch} />
                : estate.isLoading || !estate.data ? <QueryLoading />
                : !row ? <QueryEmpty title="No licence estate data" description="The model returned no licence inventory for this selection." />
                : <div className="grid gap-300 md:grid-cols-2">
                    <KpiCard label="Licensed users" value={readNumber(row, "[Total Licensed Users]")} />
                    <KpiCard label="Average days since last activity" value={readNumber(row, "[Avg Days Since Last Active]")} format="whole" />
                </div>}
            {unreconciled && <p role="status" className={cn(SMALL, "rounded-md bg-secondary p-300")}>
                The licence roster does not match the activity identities. Idle seats cannot be identified reliably.
                Review concealed identities and reconcile the roster before making licence decisions.
            </p>}
            <div style={{ height: rowChartHeight(table?.rows.length ?? 5, { perRow: 40, chrome: 100 }) }}>
                {result.data?.status === "error" ? <QueryError className="h-full" message={result.data.error.message} onRetry={result.refetch} />
                    : result.isLoading || !table ? <QueryLoading className="h-full" />
                    : table.rows.length === 0 ? <QueryEmpty className="h-full"
                        title={unreconciled ? "Dormancy cannot be measured yet" : "No dormancy buckets"}
                        description={unreconciled ? "Reconcile the licence roster and activity identities first." : "No licence dormancy data is available for this selection."} />
                    : <VegaVisual label="Dormancy of the licence estate" spec={dormancy.vegaLiteSpec} data={table} theme={theme}
                        header={{ title: "Licensed users by last activity", subtitle: "Check role, leave and business requirements before reclaiming a seat" }} />}
            </div>
            {notices.map((notice, index) => <p key={index} className={cn(SMALL, "max-w-[75ch] text-muted-foreground")}>{notice}</p>)}
        </Section>
    );
}
