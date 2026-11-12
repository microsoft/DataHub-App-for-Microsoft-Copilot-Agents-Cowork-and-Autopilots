import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StageFilterContext, pageStages } from "@/hooks/stage-filter.context";
import guideUrl from "@/assets/DataHub-App-Guide.pdf?url";
import { AppendixScreen } from "./index";

vi.mock("./glossary-stage", () => ({ GlossaryStage: () => <h2>Glossary</h2> }));
vi.mock("./signal-impact-stage", () => ({ SignalImpactStage: () => <h2>Signal to Impact</h2> }));
vi.mock("./grading-method-stage", () => ({ GradingMethodStage: () => <h2>How grading works</h2> }));

afterEach(cleanup);

describe("Appendix reading guide", () => {
    it.each(["glossary", "signal-impact", "grading-method"] as const)(
        "keeps the bundled PDF link visible on the %s tab without querying a model",
        (stage) => {
            render(
                <StageFilterContext.Provider value={pageStages(stage)}>
                    <AppendixScreen />
                </StageFilterContext.Provider>,
            );
            const link = screen.getByRole("link", { name: /How to read the DataHub App \(PDF\)/ });
            expect(link).toBeVisible();
            expect(link).toHaveAttribute("href", guideUrl);
            expect(link).toHaveAttribute("target", "_blank");
            expect(link).toHaveAttribute("rel", "noreferrer");
            expect(screen.getAllByRole("heading")).toHaveLength(1);
        },
    );
});
