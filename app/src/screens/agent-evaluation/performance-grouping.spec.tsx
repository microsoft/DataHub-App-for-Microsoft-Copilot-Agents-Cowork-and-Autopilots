import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluationOrgAttributes, type EvaluationOptions } from "@/queries/agent-evaluation";
import { PerformanceStage } from "./performance-stage";

const state = vi.hoisted(() => ({
    inventory: undefined as unknown,
    eligibility: undefined as unknown,
    semantic: vi.fn(),
    table: vi.fn(),
}));

vi.mock("@/hooks/use-semantic-model-query", () => ({
    useSemanticModelQuery: (source: unknown) => {
        state.semantic(source);
        return { data: state.inventory, isLoading: false, error: undefined, refetch: vi.fn() };
    },
}));
vi.mock("@/hooks/use-table-query", () => ({
    useSummaryQuery: () => ({ row: undefined }),
    useTableQuery: (source: { query: string }) => {
        state.table(source);
        return {
            table: source.query.includes('"Kind", "Group by"') ? state.eligibility : undefined,
            isLoading: false, error: undefined, refetch: vi.fn(),
        };
    },
}));
vi.mock("@/hooks/theme.context", () => ({ useThemeContext: () => ({ theme: { colors: ["#000000"] } }) }));
vi.mock("@/hooks/use-palette-theme", () => ({ useOutcomeColors: () => undefined }));
vi.mock("@/lib/color-scale", () => ({
    outcomePalette: () => ({ positive: "#009900", negative: "#990000", neutral: "#999999", caution: "#999900" }),
    withColorScale: (spec: unknown) => spec,
}));
vi.mock("@/components/report-panels", () => ({
    ChartPanel: () => null, KpiRowState: () => null, NoteCard: () => null, Panel: () => null,
}));
vi.mock("@microsoft/fabric-datagrid", () => ({ DataGrid: () => null }));

const OPTIONS: EvaluationOptions = {
    firstDate: "2026-01-01", lastDate: "2026-02-01", departments: [], agents: [],
    groupCounts: { agent: 2, theme: 2, topic: 2 },
};

function openGrouping() {
    const panel = document.querySelector('[role="dialog"][aria-label="Group by"]')!;
    const event = new Event("toggle");
    Object.defineProperty(event, "newState", { value: "open" });
    fireEvent(panel, event);
}

beforeEach(() => {
    state.inventory = undefined;
    state.eligibility = undefined;
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("Evaluator grouping menu", () => {
    it("does not start inventory or per-column conversation scans before the menu opens", () => {
        render(<PerformanceStage options={OPTIONS} extra={[]} />);
        expect(state.semantic).toHaveBeenLastCalledWith({ ...evaluationOrgAttributes(), query: "" });
        expect(state.table.mock.calls.some(([source]) => source.query.includes('"Kind", "Group by"'))).toBe(false);
        openGrouping();
        expect(state.semantic).toHaveBeenLastCalledWith(evaluationOrgAttributes());
    });

    it("offers every discovered column without eligibility scans and uses its actual Evaluator reference", () => {
        const view = render(<PerformanceStage options={OPTIONS} extra={[]} />);
        openGrouping();
        act(() => {
            state.inventory = {
                status: "success",
                table: {
                    columns: [{ name: "[Column]" }],
                    rows: [["CostCenterId"], ["Sparse"], ["PersonId_Normalized"], ["Blank"], ["Constant"]],
                },
            };
        });
        view.rerender(<PerformanceStage options={OPTIONS} extra={[]} />);
        expect(state.table.mock.calls.some(([source]) => source.query.includes('"Kind", "Group by"'))).toBe(false);
        for (const name of ["Sparse", "Blank", "Constant", "User ID"]) {
            expect(screen.getByRole("button", { name, hidden: true })).toBeTruthy();
        }
        fireEvent.click(screen.getByRole("button", { name: "Cost center id", hidden: true }));
        expect(state.table.mock.calls.some(([source]) =>
            source.query.includes('"@Resolution"') &&
            source.query.includes("'Org Attribute Source'[Value],") &&
            source.query.includes('TREATAS({"CostCenterId"}, \'Org Attribute Source\'[Attribute])'),
        )).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "User ID", hidden: true }));
        expect(state.table.mock.calls.some(([source]) =>
            source.query.includes('TREATAS({"PersonId_Normalized"}, \'Org Attribute Source\'[Attribute])'),
        )).toBe(true);
    });

    it("keeps the menu available when every built-in grouping has fewer than two groups", () => {
        render(<PerformanceStage options={{ ...OPTIONS, groupCounts: {} }} extra={[]} />);
        expect(screen.getByRole("button", { name: /Group by.*No groups to compare/ })).toBeTruthy();
        openGrouping();
        expect(state.semantic).toHaveBeenLastCalledWith(evaluationOrgAttributes());
    });
});
