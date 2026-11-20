import type { DataTable } from "@microsoft/fabric-visuals-core";
import { applyDaxFilters, treatAs } from "@/lib/dax-filters";
import { CONSUMPTION_COWORK, notApplied, withRules } from "@/lib/filter-profiles";
import { listTotal } from "@/lib/list-total";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { consumptionConnection as connection, FORMAT_CREDITS, FORMAT_PERCENT, FORMAT_WHOLE } from "../shared";
import summaryQuery from "./right-sizing.dax?raw";
import peopleQuery from "./right-sizing-people.dax?raw";

const filters = withRules(CONSUMPTION_COWORK, {
    dateRange: notApplied("Cowork right-sizing is the latest billing snapshot; recommendations are not recalculated for a date selection."),
});

const commonColumns: ColumnMetadataMap = {
    "[Seat Action]": { name: "Seat Action", displayName: "Model recommendation" },
    "[Usage Cohort]": { name: "Usage Cohort", displayName: "Model usage cohort" },
    "[Current Allowance]": { name: "Current Allowance", displayName: "Current allowance", format: FORMAT_CREDITS },
    "[Credits Used]": { name: "Credits Used", displayName: "Billing-period credits", format: FORMAT_CREDITS },
    "[Recommended Allowance]": { name: "Recommended Allowance", displayName: "Recommended allowance", format: FORMAT_CREDITS },
    "[Allowance Delta]": { name: "Allowance Delta", displayName: "Allowance difference", format: FORMAT_CREDITS },
    "[Total]": { name: "Total", format: FORMAT_WHOLE },
};
const summaryColumns: ColumnMetadataMap = {
    ...commonColumns,
    "[Cohort Rank]": { name: "Cohort Rank", format: FORMAT_WHOLE },
    "[People]": { name: "People", displayName: "People", format: FORMAT_WHOLE },
};
const peopleColumns: ColumnMetadataMap = {
    ...commonColumns,
    "[Person]": { name: "Person", displayName: "Person" },
    "[Sign-in]": { name: "Sign-in", displayName: "Sign-in" },
    "[Person Key]": { name: "Person Key" },
    "[Policy]": { name: "Policy", displayName: "Current policy ID" },
    "[Utilization]": { name: "Utilization", displayName: "Allowance used", format: FORMAT_PERCENT },
    "[Weeks Active]": { name: "Weeks Active", displayName: "Weeks active", format: FORMAT_WHOLE },
    "[Weeks Over Limit]": { name: "Weeks Over Limit", displayName: "Weeks over limit", format: FORMAT_WHOLE },
    "[Breach Persistence]": { name: "Breach Persistence", displayName: "Breach persistence", format: FORMAT_PERCENT },
    "[Last Activity]": { name: "Last Activity", displayName: "Last activity", format: "yyyy-mm-dd" },
};

export function rightSizing() {
    return { connection, filters, query: summaryQuery, columnMetadata: summaryColumns };
}

export function rightSizingPeople(action?: string) {
    const extra = action === "(No recommendation)"
        ? ["ISBLANK('CoworkBilling'[Seat Action])"]
        : action ? [treatAs("'CoworkBilling'[Seat Action]", [action])] : [];
    return { connection, filters, query: applyDaxFilters(peopleQuery, extra), columnMetadata: peopleColumns };
}

/** Never sum a capped or malformed action/cohort table into whole-population KPIs. */
export function summarizeRightSizing(table: DataTable | undefined) {
    if (!table?.rows.length) return undefined;
    const index = (name: string) => table.columns.findIndex(column => column.name === name);
    const total = listTotal(table);
    if (total !== table.rows.length) return undefined;
    const sum = (name: string) => {
        const values = table.rows.map(row => row[index(name)]);
        return values.every(value => typeof value === "number" && Number.isFinite(value))
            ? (values as number[]).reduce((a, b) => a + b, 0) : undefined;
    };
    return {
        people: sum("People"),
        current: sum("Current Allowance"),
        used: sum("Credits Used"),
        recommended: sum("Recommended Allowance"),
        delta: sum("Allowance Delta"),
    };
}
