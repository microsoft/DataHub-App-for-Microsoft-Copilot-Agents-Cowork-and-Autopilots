import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { chargeback } from "@/queries/consumption/chargeback";
import { toDataTable } from "@/lib/to-data-table";

const state = vi.hoisted(() => ({
    table: undefined as DataTable | undefined, error: undefined as string | undefined, isLoading: true, refetch: vi.fn(),
}));
vi.mock("@/hooks/use-consumption-query", () => ({ useConsumptionTable: () => state }));
vi.mock("@/hooks/theme.context", () => ({ useThemeContext: () => ({ theme: {} }) }));
vi.mock("@microsoft/fabric-datagrid", () => ({
    DataGrid: ({ header, data }: { header: { title: string }; data: DataTable }) =>
        <div role="table" aria-label={header.title}>{data.rows.length} allocation rows</div>,
}));

import { ChargebackStage } from "./chargeback-stage";

function loaded({ shown = 1, total = shown, assigned = 100, credits = 100 }: {
    shown?: number; total?: number; assigned?: number; credits?: number;
} = {}) {
    const metadata = chargeback().columnMetadata;
    const names = Object.keys(metadata);
    const records: Record<string, unknown>[] = [
        { Part: "Summary", Credits: credits, "Assigned Credits": assigned, "Reconciled Credits": credits, Total: total,
            "Estimated Cost": 2, "Pool Credits": 200, "Pool Cost": 4, "Window Start": "2026-01-01", "Window End": "2026-01-31" },
        ...Array.from({ length: shown }, () => ({ Part: "Allocation", Credits: credits / total, Total: total })),
    ];
    state.table = toDataTable({
        columns: names.map(name => ({ name, dataType: "String" })),
        rows: records.map(record => names.map(name => record[name.slice(1, -1)] ?? null)),
    }, metadata);
    state.isLoading = false;
}

beforeEach(() => {
    state.table = undefined;
    state.error = undefined;
    state.isLoading = true;
    state.refetch.mockClear();
});

describe("ChargebackStage states", () => {
    it("waits without showing cost, and reports denied access without a fallback", () => {
        const view = render(<ChargebackStage />);
        expect(screen.getByText("Loading")).toBeTruthy();
        expect(screen.queryByText("Selected usage cost")).toBeNull();
        state.error = "403 Forbidden";
        state.isLoading = false;
        view.rerender(<ChargebackStage />);
        expect(screen.getByText("Consumption Central access required")).toBeTruthy();
        expect(screen.queryByRole("table")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(state.refetch).toHaveBeenCalledOnce();
    });

    it("shows a real empty window rather than zero-cost cards", () => {
        loaded({ shown: 0, total: 0, credits: 0, assigned: 0 });
        render(<ChargebackStage />);
        expect(screen.getByText("No credits to allocate")).toBeTruthy();
        expect(screen.queryByText("Selected usage cost")).toBeNull();
    });

    it("retains unallocated buckets and explains scope, one pool and current membership", () => {
        loaded({ assigned: 0 });
        render(<ChargebackStage />);
        fireEvent.click(screen.getByRole("button", { name: "Cost centre" }));
        expect(screen.getByText("No usable cost-centre mappings")).toBeTruthy();
        expect(screen.getByText(/capacity balance is applied once, not once per group/)).toBeTruthy();
        expect(screen.getByText(/Model permissions still apply/)).toBeTruthy();
        expect(screen.getByRole("table", { name: "Allocation by cost centre" })).toBeTruthy();
    });

    it("marks capped results while keeping full reconciliation", () => {
        loaded({ total: 501 });
        render(<ChargebackStage />);
        expect(screen.getByText(/Showing the top 1 of 501 allocation groups/)).toBeTruthy();
        expect(screen.getByText(/reconciliation includes groups omitted/)).toBeTruthy();
    });
});
