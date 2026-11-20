import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataTable } from "@microsoft/fabric-visuals-core";

const state = vi.hoisted(() => ({
    table: undefined as DataTable | undefined, error: undefined as string | undefined, isLoading: true, refetch: vi.fn(),
    queries: [] as string[],
}));
vi.mock("@/hooks/use-table-query", () => ({
    useTableQuery: (source: { query: string }) => {
        state.queries.push(source.query);
        return state;
    },
}));
vi.mock("@/hooks/theme.context", () => ({ useThemeContext: () => ({ theme: {} }) }));
vi.mock("@/hooks/stage-filter.context", () => ({ useStageFilter: () => ({ deferDetail: true }) }));
vi.mock("@microsoft/fabric-datagrid", () => ({
    DataGrid: ({ header }: { header: { title: string } }) => <div role="table" aria-label={header.title} />,
}));
import { RightSizingStage } from "./right-sizing-stage";

function loaded(total = 1) {
    state.table = {
        columns: ["Seat Action", "Usage Cohort", "People", "Current Allowance", "Credits Used", "Recommended Allowance", "Allowance Delta", "Total"].map(name => ({ name })),
        rows: [["4. Hold - spiky, not structural", "1. Light (Bottom 50%)", 2, 1000, 400, 750, 250, total]],
    };
    state.isLoading = false;
}
beforeEach(() => {
    state.table = undefined;
    state.error = undefined;
    state.isLoading = true;
    state.queries = [];
});

describe("RightSizingStage", () => {
    it("loads without commercial terms and never infers recommendations on denied access", () => {
        const view = render(<RightSizingStage />);
        expect(screen.getByText("Loading")).toBeTruthy();
        state.error = "403 Forbidden";
        state.isLoading = false;
        view.rerender(<RightSizingStage />);
        expect(screen.getByText("Consumption Central access required")).toBeTruthy();
        expect(screen.queryByRole("table")).toBeNull();
    });

    it("renders a snapshot empty state, not zero allowances", () => {
        state.table = { columns: [], rows: [] };
        state.isLoading = false;
        render(<RightSizingStage />);
        expect(screen.getByText("No Cowork recommendations in this scope")).toBeTruthy();
        expect(screen.queryByText("Current allowances")).toBeNull();
    });

    it("keeps actions intact, warns against savings claims, and loads people only on demand", () => {
        loaded();
        render(<RightSizingStage />);
        expect(screen.getByRole("table", { name: "Recommendation × usage cohort" })).toBeTruthy();
        expect(screen.getByText(/not realized invoice savings/)).toBeTruthy();
        expect(screen.getByText(/Hold and Monitor are not instructions/)).toBeTruthy();
        expect(state.queries.every(query => !query.includes('"Person Key"'))).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "Review people" }));
        expect(state.queries.some(query => query.includes('"Person Key"'))).toBe(true);
    });

    it("does not display full-scope KPIs from a truncated group list", () => {
        loaded(501);
        render(<RightSizingStage />);
        expect(screen.getByText(/Whole-scope cards are withheld/)).toBeTruthy();
        expect(screen.getByText(/Showing the top 1 of 501 action\/cohort groups/)).toBeTruthy();
        expect(screen.queryByText("People reviewed")).toBeNull();
    });
});
