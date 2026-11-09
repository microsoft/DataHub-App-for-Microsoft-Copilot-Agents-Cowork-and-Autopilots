import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SummaryRow } from "@/lib/summary-row";
import { defaultFilters, type FilterState } from "@/lib/filters";
import { AdoptionStage } from "./adoption-stage";

const state = vi.hoisted(() => ({
    row: undefined as SummaryRow | undefined,
    filters: {} as FilterState,
    loaded: true,
    error: undefined as string | undefined,
}));

vi.mock("@/hooks/filter.context", () => ({
    useFilterContext: () => ({ filters: state.filters, applicable: ["licence", "audience"] }),
}));
vi.mock("@/hooks/theme.context", () => ({ useThemeContext: () => ({ theme: {} }) }));
vi.mock("./use-adoption-summary", () => ({
    useAdoptionSummary: () => ({ row: state.row, loaded: state.loaded, error: state.error }),
}));
vi.mock("@/hooks/use-filtered-query", () => ({
    useFilteredQuery: () => ({ data: { status: "success", table: { columns: [], rows: [] } } }),
}));
vi.mock("@/components/vega-visual", () => ({ VegaVisual: () => null }));
vi.mock("@/components/filter-note", () => ({
    FilterNote: ({ reason }: { reason: string }) => <p>{reason}</p>,
}));

beforeEach(() => {
    state.filters = { ...defaultFilters, audience: "cowork" };
    state.loaded = true;
    state.error = undefined;
    state.row = {
        "[Overall Users]": 30, "[Overall SPUW]": 4,
        "[Licensed Users]": 20, "[Licensed SPUW]": 5,
        "[Unlicensed Users]": 10, "[Unlicensed SPUW]": 2,
        "[Agent Users]": 8, "[Agent SPUW]": 3,
        "[Cowork Users]": 6, "[Cowork SPUW]": 1.25, "[Cowork Hours Wk]": 12,
    };
});
afterEach(cleanup);

function coworkCard() {
    const card = screen.getByText("Cowork").parentElement;
    if (!card) throw new Error("Cowork card missing");
    return card;
}

describe("Cowork adoption card", () => {
    it("renders existing rate, users and hours and highlights Activity = Cowork", () => {
        render(<AdoptionStage />);
        expect(coworkCard()).toHaveClass("border-primary/40");
        expect(within(coworkCard()).getByText("1.25")).toBeInTheDocument();
        expect(within(coworkCard()).getByText("6")).toBeInTheDocument();
        expect(within(coworkCard()).getByText("12")).toBeInTheDocument();
        expect(screen.queryByText(/has no card of its own/)).not.toBeInTheDocument();
    });

    it("keeps the existing card metric when the weekly trend measure changes", () => {
        render(<AdoptionStage />);
        for (const label of ["Sessions", "Hours", "Per user"]) {
            fireEvent.click(screen.getByRole("button", { name: label }));
            expect(within(coworkCard()).getByText("1.25")).toBeInTheDocument();
            expect(coworkCard()).toHaveClass("border-primary/40");
        }
    });

    it("shows a named empty state for absent telemetry without fabricating a zero", () => {
        state.row = { ...state.row, "[Cowork Users]": null, "[Cowork SPUW]": null, "[Cowork Hours Wk]": null };
        render(<AdoptionStage />);
        expect(within(coworkCard()).getByText("No activity")).toBeInTheDocument();
        expect(within(coworkCard()).getByText("No Cowork activity in the selected period.")).toBeInTheDocument();
        expect(within(coworkCard()).queryByText("0")).not.toBeInTheDocument();
    });

    it("does not mistake an active user with no observed sessions for absent telemetry", () => {
        state.row = { ...state.row, "[Cowork SPUW]": null };
        render(<AdoptionStage />);
        expect(within(coworkCard()).queryByText("No activity")).not.toBeInTheDocument();
        expect(within(coworkCard()).getByText("6")).toBeInTheDocument();
    });

    it("preserves other cohort highlighting when Cowork is not selected", () => {
        state.filters = { ...defaultFilters, licence: "licensed" };
        render(<AdoptionStage />);
        expect(coworkCard()).not.toHaveClass("border-primary/40");
        expect(screen.getByText("Licensed chat").parentElement).toHaveClass("border-primary/40");
    });
});
