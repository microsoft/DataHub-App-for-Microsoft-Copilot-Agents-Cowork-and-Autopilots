import type { DataTable } from "@microsoft/fabric-visuals-core";
import { CONSUMPTION_COWORK_REPORTING } from "@/lib/filter-profiles";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { consumptionConnection as connection, FORMAT_CREDITS, FORMAT_MONEY, FORMAT_PERCENT, FORMAT_WHOLE } from "../shared";
import query from "./chargeback.dax?raw";

export type AllocationBasis = "cost-centre" | "policy";

const columnMetadata: ColumnMetadataMap = {
    "[Part]": { name: "Part" },
    "[Allocation]": { name: "Allocation", displayName: "Allocation" },
    "[Policy ID]": { name: "Policy ID", displayName: "Weekly policy ID" },
    "[Allocation Status]": { name: "Allocation Status", displayName: "Mapping status" },
    "[Credits]": { name: "Credits", displayName: "Credits used", format: FORMAT_CREDITS },
    "[Pool Share]": { name: "Pool Share", displayName: "Share of viewer pool", format: FORMAT_PERCENT },
    "[Prepaid Credits]": { name: "Prepaid Credits", displayName: "Allocated prepaid credits", format: FORMAT_CREDITS },
    "[PAYG Credits]": { name: "PAYG Credits", displayName: "Allocated PAYG credits", format: FORMAT_CREDITS },
    "[Estimated Cost]": { name: "Estimated Cost", displayName: "Usage cost (USD)", format: FORMAT_MONEY },
    "[Pool Credits]": { name: "Pool Credits", format: FORMAT_CREDITS },
    "[Pool Cost]": { name: "Pool Cost", format: FORMAT_MONEY },
    "[Assigned Credits]": { name: "Assigned Credits", format: FORMAT_CREDITS },
    "[Reconciled Credits]": { name: "Reconciled Credits", format: FORMAT_CREDITS },
    "[Window Start]": { name: "Window Start" },
    "[Window End]": { name: "Window End" },
    "[Total]": { name: "Total", format: FORMAT_WHOLE },
};

/** Weekly usage's own policy, or a single unambiguous current EAV cost centre. */
export function chargeback(basis: AllocationBasis = "policy") {
    return {
        connection,
        filters: CONSUMPTION_COWORK_REPORTING,
        query: query.replace("__ALLOCATION_BASIS__", basis),
        columnMetadata,
    };
}

/** Read the one-query reconciliation without interpreting missing amounts as zero. */
export function readChargeback(table: DataTable | undefined) {
    if (!table) return undefined;
    const index = (name: string) => table.columns.findIndex(column => column.name === name);
    const summaries = table.rows.filter(row => row[index("Part")] === "Summary");
    if (summaries.length !== 1) return undefined;
    const summary = summaries[0];
    const number = (name: string) => {
        const value = summary[index(name)];
        return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    };
    const text = (name: string) => {
        const value = summary[index(name)];
        return typeof value === "string" ? value : undefined;
    };
    const allocations = { ...table, rows: table.rows.filter(row => row[index("Part")] === "Allocation") };
    const credits = number("Credits");
    const assigned = number("Assigned Credits");
    const reconciled = number("Reconciled Credits");
    const total = number("Total");
    const complete = total === allocations.rows.length;
    const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.000001, Math.abs(b) * 1e-10);
    const shown = allocations.rows.reduce((sum, row) => {
        const value = row[index("Credits")];
        return sum + (typeof value === "number" && Number.isFinite(value) ? value : Number.NaN);
    }, 0);
    return {
        allocations, credits, assigned, total, complete,
        coverage: credits !== undefined && credits > 0 && assigned !== undefined
            ? close(assigned, credits) ? 1 : assigned / credits : undefined,
        unallocated: credits !== undefined && assigned !== undefined
            ? close(assigned, credits) ? 0 : credits - assigned : undefined,
        cost: number("Estimated Cost"),
        poolCredits: number("Pool Credits"),
        poolCost: number("Pool Cost"),
        from: text("Window Start"),
        to: text("Window End"),
        reconciles: credits !== undefined && reconciled !== undefined
            && close(reconciled, credits) && (!complete || close(shown, credits)),
    };
}
