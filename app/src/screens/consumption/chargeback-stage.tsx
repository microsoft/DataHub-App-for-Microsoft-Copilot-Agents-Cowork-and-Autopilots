import { useMemo, useState } from "react";
import { DataGrid, type GridColumnDef } from "@microsoft/fabric-datagrid";
import { stageAnchor } from "@/components/destinations";
import { KpiCard } from "@/components/kpi-card";
import { NotFilteredHint } from "@/components/not-filtered-hint";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/query-states";
import { NoteCard } from "@/components/report-panels";
import { Section } from "@/components/section";
import { SegmentedControl } from "@/components/segmented-control";
import { TruncationNote } from "@/components/truncation-note";
import { useCommercialTerms } from "@/hooks/commercial-terms.context";
import { useThemeContext } from "@/hooks/theme.context";
import { useConsumptionTable } from "@/hooks/use-consumption-query";
import { gridHeight } from "@/lib/chart-height";
import { formatKpi } from "@/lib/format-kpi";
import { formatCell } from "@/lib/tree-grid";
import { SMALL } from "@/lib/type-scale";
import { chargeback, readChargeback, type AllocationBasis } from "@/queries/consumption/chargeback";
import { moneyCell } from "./data";

const BASES: readonly { id: AllocationBasis; label: string }[] = [
    { id: "policy", label: "Spending policy" },
    { id: "cost-centre", label: "Cost centre" },
];
const COLUMNS: GridColumnDef[] = [
    { id: "Allocation", header: "Allocation", width: 240 },
    { id: "Allocation Status", header: "Mapping status", width: 176 },
    { id: "Credits", header: "Credits used", width: 132, numericStyling: true, cellRenderer: formatCell("whole") },
    { id: "Pool Share", header: "Share of viewer pool", width: 152, numericStyling: true, cellRenderer: formatCell("percent") },
    { id: "Prepaid Credits", header: "Prepaid credits", width: 144, numericStyling: true, cellRenderer: formatCell("whole") },
    { id: "PAYG Credits", header: "PAYG credits", width: 136, numericStyling: true, cellRenderer: formatCell("whole") },
    { id: "Estimated Cost", header: "Usage cost (USD)", width: 152, numericStyling: true, cellRenderer: moneyCell("$") },
];
const POLICY_COLUMNS: GridColumnDef[] = [
    COLUMNS[0],
    { id: "Policy ID", header: "Weekly policy ID", width: 260 },
    ...COLUMNS.slice(1),
];

export function ChargebackStage() {
    const [basis, setBasis] = useState<AllocationBasis>("policy");
    const { theme } = useThemeContext();
    const terms = useCommercialTerms();
    const result = useConsumptionTable(chargeback(basis));
    const allocation = useMemo(() => readChargeback(result.table), [result.table]);
    const accessDenied = result.error && /forbidden|unauthorized|access denied|permission|\b40[13]\b/i.test(result.error);

    return (
        <Section
            id={stageAnchor("chargeback")}
            title="Chargeback / showback"
            description="Allocate Cowork and Work IQ usage cost from one shared credit pool. This is a showback estimate, not an invoice or a finance posting."
            actions={<SegmentedControl label="Allocation basis" options={BASES} value={basis} onChange={setBasis} />}
        >
            <NotFilteredHint from={[result.notFilteredBy]} />
            <p className={`${SMALL} text-muted-foreground`}>
                {basis === "cost-centre"
                    ? "Basis: current “Cost Centre Label” organization attribute, not historical membership. Missing, unmatched and ambiguous mappings stay unallocated."
                    : "Basis: SpendingPolicyId on each weekly credit record, not the person's latest policy. Policy limits are allowances, not finance budgets."}
                {" "}Studio, Azure and GitHub are excluded.
            </p>
            {result.error !== undefined ? (
                <>
                    {accessDenied && <QueryEmpty title="Consumption Central access required" description="Ask the model owner for permission to read this data. No allocation estimate is substituted for denied access." />}
                    <QueryError message={result.error} onRetry={result.refetch} />
                </>
            ) : result.isLoading || !result.table ? (
                <QueryLoading />
            ) : !allocation ? (
                <QueryError message="The allocation response is incomplete. No chargeback totals can be verified." onRetry={result.refetch} />
            ) : allocation.total === 0 ? (
                <QueryEmpty title="No credits to allocate" description="No Cowork or Work IQ weekly credits are visible in this date range and organization selection. Check the selection and source refresh." />
            ) : !allocation.reconciles ? (
                <QueryError message="Allocation credits do not reconcile to selected usage. Cost estimates are withheld; retry or ask the model owner to check the source." onRetry={result.refetch} />
            ) : (
                <>
                    <div className="grid gap-300 md:grid-cols-2 xl:grid-cols-4">
                        <KpiCard label="Selected credits" value={allocation.credits} emphasis detail={`${allocation.from ?? "Unknown start"} to ${allocation.to ?? "unknown end"}`} />
                        <KpiCard label="Allocation coverage" value={allocation.coverage} format="percent" detail="Share of selected credits with one valid allocation" />
                        <KpiCard label="Unallocated credits" value={allocation.unallocated} detail="Retained in the reconciliation, not discarded" />
                        <KpiCard label="Selected usage cost" value={allocation.cost} format="money" prefix="$" detail="USD · pro-rata showback, not billed savings" />
                    </div>
                    <div className={`flex flex-col gap-200 rounded-xl border border-border bg-card p-400 ${SMALL} text-muted-foreground`}>
                        <p>
                            Viewer-visible pool: {formatKpi(allocation.poolCredits, "whole")} credits ·{" "}
                            {formatKpi(allocation.poolCost, "money", { prefix: "$" })} USD modelled usage cost.
                            The app's organization filter narrows the allocation, not this pool. Model permissions still apply; this is not a guaranteed whole-tenant invoice total.
                        </p>
                        <p>
                            Reconciled: assigned plus unallocated credits equals selected usage.
                            {allocation.complete ? " All allocation groups are shown." : " This reconciliation includes groups omitted from the capped table below."}
                            {" "}Each group receives its usage share of the pool's prepaid and PAYG credits; the capacity balance is applied once, not once per group. Rounded display values may differ slightly.
                        </p>
                        {terms.status === "unavailable" && <p>Saved commercial terms could not be read. These estimates use the model's terms.</p>}
                    </div>
                    {basis === "cost-centre" && allocation.assigned === 0 && (
                        <QueryEmpty
                            title="No usable cost-centre mappings"
                            description="Credits are preserved in unallocated buckets. “(Not set)” is not an allocation. Switch to Spending policy for source-native showback; do not infer a finance mapping."
                        />
                    )}
                    <div style={{ height: gridHeight(allocation.allocations.rows.length) }}>
                        <DataGrid
                            data={allocation.allocations}
                            columns={basis === "policy" ? POLICY_COLUMNS : COLUMNS}
                            theme={theme}
                            header={{
                                title: basis === "cost-centre" ? "Allocation by cost centre" : "Allocation by weekly spending policy",
                                subtitle: "All credits retained, including unallocated buckets. Policy names are current metadata; policy IDs come from each usage week. Cost uses saved terms or model defaults.",
                            }}
                        />
                    </div>
                    <TruncationNote shown={allocation.allocations.rows.length} total={allocation.total} noun="allocation groups" by="by credits" />
                </>
            )}
            <NoteCard title="Scope and allocation rules" notes={[
                { term: "Included", text: "Cowork and Work IQ person × service × policy × week credits. Group usage and pool cost use the same inclusive Reporting Start / Reporting End window and weekly MetricDate; weeks are not prorated into days." },
                { term: "Prepaid capacity", text: "The configured Capacity Pack balance is an assumption, not a reconciled invoice balance. It is consumed once across viewer-visible credits in the selected window, then PAYG applies. Costs represent used credits only, not the purchase price of unused capacity. Group share = group credits ÷ viewer-pool credits." },
                { term: "Current membership", text: "Organization filters and Cost Centre Label use the directory's current snapshot, not membership as of the usage week. Duplicate identical EAV values count once; multiple distinct values are ambiguous and remain unallocated." },
                { term: "Not ingested", text: "Finance CostCentre, BillingOwner and ChargeCode fields from spending-policy metadata are not loaded. This view does not fabricate those mappings or treat policy limits as budgets." },
                { term: "Excluded", text: "Copilot Studio requires an environment-to-cost-centre mapping. Azure and GitHub have separate currency and allocation semantics. None is added to this credit pool." },
            ]} />
        </Section>
    );
}
