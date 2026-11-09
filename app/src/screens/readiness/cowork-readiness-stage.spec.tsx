import { cleanup, render, screen } from "@testing-library/react";
import type { CachedQueryResult } from "@microsoft/fabric-app-data";
import { afterEach, describe, expect, it, vi } from "vitest";
import candidateRows from "@/queries/agents/__fixtures__/cowork-candidates.rows.json";
import { coworkCandidates } from "@/queries/agents";
import { CoworkReadinessStage } from "./cowork-readiness-stage";

const state = vi.hoisted(() => ({ candidates: undefined as CachedQueryResult | undefined }));
vi.mock("@/hooks/theme.context", () => ({ useThemeContext: () => ({ theme: {} }) }));
vi.mock("@/hooks/use-filtered-query", () => ({
    useFilteredQuery: ({ query }: { query: string }) => ({
        data: query.includes("VAR __LicensedUsers") ? state.candidates : undefined,
        isLoading: false,
    }),
}));
vi.mock("@/components/vega-visual", () => ({ VegaVisual: () => null }));
vi.mock("@microsoft/fabric-datagrid", () => ({
    DataGrid: ({ header }: { header: { title: string; subtitle: string } }) => (
        <div><h3>{header.title}</h3><p>{header.subtitle}</p></div>
    ),
}));

afterEach(cleanup);

function answer(empty = false): CachedQueryResult {
    const names = Object.keys(coworkCandidates().columnMetadata);
    return {
        status: "success",
        table: {
            columns: names.map(name => ({ name, dataType: "String" })),
            rows: empty ? [] : candidateRows.map(row => names.map(name => row[name as keyof typeof row])),
        },
        requestId: "offline-candidates",
        fromCache: false,
    };
}

describe("Cowork prioritisation copy", () => {
    it("labels the whole candidate count as licensed users", () => {
        state.candidates = answer();
        render(<CoworkReadinessStage />);
        expect(screen.getByText("Who to offer Cowork next")).toBeInTheDocument();
        expect(screen.getByText("30 licensed users, readiest first")).toBeInTheDocument();
    });

    it("explains an empty licensed population without claiming all users have tried Cowork", () => {
        state.candidates = answer(true);
        render(<CoworkReadinessStage />);
        expect(screen.getByText("Nobody to rank")).toBeInTheDocument();
        expect(screen.getByText("No licensed Microsoft 365 Copilot users with recorded use are yet to try Cowork in this selection.")).toBeInTheDocument();
    });
});
