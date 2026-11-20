import { useMemo, useState } from "react";
import { DataGrid, type GridColumnDef } from "@microsoft/fabric-datagrid";
import { ChoiceMenu } from "@/components/choice-menu";
import { stageAnchor } from "@/components/destinations";
import { KpiCard } from "@/components/kpi-card";
import { NotFilteredHint } from "@/components/not-filtered-hint";
import { OnDemand } from "@/components/on-demand";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/query-states";
import { Panel } from "@/components/report-panels";
import { Section } from "@/components/section";
import { TruncationNote } from "@/components/truncation-note";
import { useThemeContext } from "@/hooks/theme.context";
import { useTableQuery } from "@/hooks/use-table-query";
import { gridHeight } from "@/lib/chart-height";
import { listTotal } from "@/lib/list-total";
import { runtimeConfig } from "@/lib/runtime-config";
import { formatCell } from "@/lib/tree-grid";
import { SMALL } from "@/lib/type-scale";
import { rightSizing, rightSizingPeople, summarizeRightSizing } from "@/queries/efficiency/right-sizing";

const amount = (id: string, header: string): GridColumnDef => ({
    id, header, width: 152, numericStyling: true, cellRenderer: formatCell("whole"),
});
const AMOUNTS = [
    amount("Current Allowance", "Current allowance"),
    amount("Credits Used", "Billing-period credits"),
    amount("Recommended Allowance", "Recommended allowance"),
    amount("Allowance Delta", "Allowance difference"),
];
const GROUP_COLUMNS: GridColumnDef[] = [
    { id: "Seat Action", header: "Model recommendation", width: 280 },
    { id: "Usage Cohort", header: "Model usage cohort", width: 224 },
    amount("People", "People"),
    ...AMOUNTS,
];
const PEOPLE_COLUMNS: GridColumnDef[] = [
    { id: "Person", header: "Person", width: 200 },
    { id: "Sign-in", header: "Sign-in", width: 240 },
    { id: "Seat Action", header: "Model recommendation", width: 280 },
    { id: "Usage Cohort", header: "Model usage cohort", width: 224 },
    ...AMOUNTS,
    { id: "Utilization", header: "Allowance used", width: 140, numericStyling: true, cellRenderer: formatCell("percent") },
    amount("Weeks Active", "Weeks active"),
    amount("Weeks Over Limit", "Weeks over limit"),
    { id: "Breach Persistence", header: "Breach persistence", width: 152, numericStyling: true, cellRenderer: formatCell("percent") },
    { id: "Last Activity", header: "Last activity", width: 136 },
    { id: "Policy", header: "Current policy ID", width: 260 },
];

function People({ action }: { action: string | undefined }) {
    const { theme } = useThemeContext();
    const result = useTableQuery(rightSizingPeople(action));
    const accessDenied = result.error && /forbidden|unauthorized|access denied|permission|\b40[13]\b/i.test(result.error);
    return (
        <div className="flex flex-col gap-300">
            <NotFilteredHint from={[result.notFilteredBy]} />
            {accessDenied && <QueryEmpty title="Person-level access required" description="The model denied this detail query. No substitute people or recommendations are shown." />}
            <Panel result={result} height={gridHeight(result.table?.rows.length ?? 6)}
                emptyTitle="No people in this recommendation" emptyDescription="There are no visible billing records for this action and organization selection.">
                {table => <DataGrid data={table} columns={PEOPLE_COLUMNS} theme={theme} header={{
                    title: "Review people before changing an allowance",
                    subtitle: "Latest billing snapshot · highest current-minus-recommended allowance first. A Hold recommendation remains a hold, even when its numeric allowance difference is positive.",
                }} />}
            </Panel>
            {result.table && !result.error && <TruncationNote shown={result.table.rows.length} total={listTotal(result.table)} noun="people" by="by allowance difference" />}
        </div>
    );
}

export function RightSizingStage() {
    const { theme } = useThemeContext();
    const [action, setAction] = useState<string>();
    const result = useTableQuery(rightSizing());
    const summary = useMemo(() => summarizeRightSizing(result.table), [result.table]);
    const actions = useMemo(() => {
        const index = result.table?.columns.findIndex(column => column.name === "Seat Action") ?? -1;
        const values = result.table?.rows.map(row => row[index]).filter((value): value is string => typeof value === "string") ?? [];
        return [...new Set(values)].sort().map(value => ({ value, label: value }));
    }, [result.table]);
    const selectedAction = actions.some(choice => choice.value === action) ? action : undefined;
    const accessDenied = result.error && /forbidden|unauthorized|access denied|permission|\b40[13]\b/i.test(result.error);

    return (
        <Section
            id={stageAnchor("cowork-right-sizing")}
            title="Cowork right-sizing"
            description="Consumption Central's seat actions and usage cohorts, brought together for an allowance review. Recommendations come from the model, not new thresholds in the app."
        >
            <p className={`${SMALL} text-muted-foreground`}>
                Latest billing snapshot · not date-filtered. Organization filters use current membership.
                Allowance differences are credits, not realized invoice savings or licence savings. This view does not change a policy.
            </p>
            <NotFilteredHint from={[result.notFilteredBy]} />
            {result.error !== undefined ? (
                <>
                    {accessDenied && <QueryEmpty title="Consumption Central access required" description="Ask the model owner for permission to read Cowork billing recommendations. No recommendations are inferred when access is denied." />}
                    <QueryError message={result.error} onRetry={result.refetch} />
                </>
            ) : result.isLoading || !result.table ? <QueryLoading /> : result.table.rows.length === 0 ? (
                <QueryEmpty title="No Cowork recommendations in this scope" description={runtimeConfig().demo
                    ? "The published synthetic CSV pack does not contain a CoworkBilling recommendation snapshot. No actions or percentile cohorts have been invented. The live view reads those fields from Consumption Central."
                    : "The latest Cowork billing snapshot contains no people visible in this organization selection. Check the selection and source refresh."} />
            ) : (
                <>
                    {summary ? <div className="grid gap-300 md:grid-cols-2 xl:grid-cols-4">
                        <KpiCard label="People reviewed" value={summary.people} emphasis detail="All action and cohort groups in this scope" />
                        <KpiCard label="Current allowances" value={summary.current} detail="Monthly credit limits · not budgets" />
                        <KpiCard label="Billing-period credits" value={summary.used} detail="Snapshot usage, not the selected date range" />
                        <KpiCard label="Model-recommended allowances" value={summary.recommended} detail="Credit limits for review, not automatic changes" />
                    </div> : <p role="status" className={`${SMALL} text-muted-foreground`}>Whole-scope cards are withheld because the grouped result is incomplete.</p>}
                    <div style={{ height: gridHeight(result.table.rows.length) }}>
                        <DataGrid data={result.table} columns={GROUP_COLUMNS} theme={theme} header={{
                            title: "Recommendation × usage cohort",
                            subtitle: "Model cohort percentiles are fixed at refresh; filtering does not re-rank people. Difference = current minus recommended credits: positive means lower proposed capacity, negative means higher.",
                        }} />
                    </div>
                    <TruncationNote shown={result.table.rows.length} total={listTotal(result.table)} noun="action/cohort groups" />
                    <div className={`rounded-xl border border-border bg-card p-400 ${SMALL} text-muted-foreground`}>
                        Review the action before the numeric limit. Hold and Monitor are not instructions to reduce allowances.
                        Use weeks active, weeks over limit, breach persistence and last activity to discuss the model's recommendation with the owner.
                        A lower allowance is not evidence that consumption or the bill will fall.
                    </div>
                    <div className="flex flex-wrap items-center gap-300">
                        <ChoiceMenu label="Review action" allLabel="All recommendations" choices={actions} value={selectedAction} onChange={setAction} />
                    </div>
                    <OnDemand id="cowork-right-sizing-people" label="Review people" note="Open a bounded list of billing records for the selected recommendation.">
                        <People action={selectedAction} />
                    </OnDemand>
                </>
            )}
        </Section>
    );
}
