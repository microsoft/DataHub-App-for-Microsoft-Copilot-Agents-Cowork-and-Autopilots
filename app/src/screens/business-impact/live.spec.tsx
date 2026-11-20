import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CachedQueryResult } from "@microsoft/fabric-app-data";
import { StageFilterContext, onlyStages, pageStages } from "@/hooks/stage-filter.context";
import type { StageId } from "@/components/destinations";
import { LiveBusinessImpactScreen } from "./live";

const query = vi.hoisted(() => ({ run: vi.fn(), retry: vi.fn() }));
vi.mock("@/hooks/use-semantic-model-query", () => ({ useSemanticModelQuery: (...args: unknown[]) => query.run(...args) }));
vi.mock("@/components/vega-visual", () => ({ VegaVisual: ({ header }: { header?: { title?: string } }) => <figure aria-label={header?.title} /> }));
vi.mock("@/hooks/theme.context", () => ({ useThemeContext: () => ({ theme: {} }) }));

const fixtures = process.env.DATAHUB_IMPACT_FIXTURES;
function capture(name: string): CachedQueryResult & { selectionYear?: number } {
    if (!fixtures) throw new Error("Private SDK captures are required.");
    return JSON.parse(readFileSync(join(fixtures, name), "utf8"));
}

function show(stage: StageId) {
    return render(<StageFilterContext.Provider value={pageStages(stage)}><LiveBusinessImpactScreen /></StageFilterContext.Provider>);
}

beforeEach(() => {
    query.retry.mockReset();
    query.run.mockReset();
    query.run.mockReturnValue({ data: undefined, isLoading: true, error: undefined, refetch: query.retry });
});

describe("connected Business impact", () => {
    it("shows loading instead of the synthetic scorecard", () => {
        show("impact-summary");
        expect(screen.getByText("Loading source-backed process measures...")).toBeInTheDocument();
        expect(screen.queryAllByRole("article", { name: / outcome$/ })).toHaveLength(0);
    });

    it("exposes source failures and never falls back to demonstration values", () => {
        query.run.mockImplementation(({ query: dax }: { query: string }) => ({
            isLoading: false, error: dax.includes("SUMMARIZECOLUMNS") ? undefined : new Error("Source unavailable"),
            refetch: query.retry,
        }));
        show("impact-summary");
        expect(screen.getByRole("alert")).toHaveTextContent("Source unavailable");
        expect(screen.getByRole("alert")).toHaveTextContent("No demonstration values have been substituted");
        expect(screen.queryAllByRole("article", { name: / outcome$/ })).toHaveLength(0);
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(query.retry).toHaveBeenCalledOnce();
    });
});

describe.runIf(Boolean(fixtures))("connected Business impact with private SDK captures", () => {
    beforeEach(() => {
        query.run.mockImplementation(({ query: dax, columnMetadata }: { query: string; columnMetadata: unknown }) => ({
            data: capture(dax.includes("SUMMARIZECOLUMNS") ? "history.json" : "scorecard.json"),
            columnMetadata, isLoading: false, error: undefined, refetch: query.retry,
        }));
    });

    it.each([
        ["impact-summary", "From usage to business outcomes"],
        ["impact-personas", "Functional personas, grounded in the process"],
        ["impact-processes", "Process outcomes with their denominators"],
        ["impact-connect", "Connect personas to processes"],
        ["impact-agents", "Agents & automation"],
        ["impact-cost", "Cost per transaction: define the denominator first"],
        ["impact-opportunities", "Where to investigate next"],
        ["impact-method", "Data, joins and evidence boundaries"],
    ] as const)("renders %s without synthetic attribution", (stage, title) => {
        render(<StageFilterContext.Provider value={onlyStages([stage])}><LiveBusinessImpactScreen /></StageFilterContext.Provider>);
        expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
        expect(screen.getByText("Connected business process history")).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/\bBPS\b|Business Process Solutions/);
        expect(screen.queryByText(/90% interval:|beyond comparison|Opportunity win rate/)).not.toBeInTheDocument();
        if (stage === "impact-summary") expect(screen.getAllByRole("article", { name: / outcome$/ })).toHaveLength(8);
    });

    it("does not show an old answer under a newly selected source year", () => {
        const selected = capture("scorecard-year.json").selectionYear!;
        query.run.mockImplementation(({ query: dax, columnMetadata }: { query: string; columnMetadata: unknown }) => ({
            data: capture(dax.includes("SUMMARIZECOLUMNS") ? "history.json" : "scorecard.json"),
            columnMetadata, isLoading: dax.includes("TREATAS"), error: undefined, refetch: query.retry,
        }));
        show("impact-summary");
        expect(screen.getAllByRole("article", { name: / outcome$/ })).toHaveLength(8);
        fireEvent.change(screen.getByRole("combobox", { name: "Business impact source year" }), { target: { value: String(selected) } });
        expect(screen.getByText("Loading source-backed process measures...")).toBeInTheDocument();
        expect(screen.queryAllByRole("article", { name: / outcome$/ })).toHaveLength(0);
    });
});
