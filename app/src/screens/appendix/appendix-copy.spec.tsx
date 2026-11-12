//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
//-----------------------------------------------------------------------

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VisualTheme } from "@microsoft/fabric-visuals-core";
import { ThemeContext } from "@/hooks/theme.context";
import { GlossaryStage } from "./glossary-stage";
import { GradingMethodStage } from "./grading-method-stage";
import { SignalImpactStage } from "./signal-impact-stage";

vi.mock("@/hooks/use-filtered-query", () => ({
    useFilteredQuery: () => ({
        data: undefined,
        isLoading: true,
        isRefreshing: false,
        refetch: () => undefined,
    }),
}));

afterEach(cleanup);

function renderWithTheme(children: ReactNode) {
    return render(
        <ThemeContext.Provider value={{ isDark: false, toggleTheme: () => undefined, theme: {} as VisualTheme }}>
            {children}
        </ThemeContext.Provider>,
    );
}

describe("Appendix copy", () => {
    it("describes glossary definitions as model-sourced and mapped to the app", () => {
        renderWithTheme(<GlossaryStage />);

        expect(
            screen.getByText(
                "Definitions from the semantic model, grouped by source page, with the corresponding DataHub App destination shown when available.",
            ),
        ).toBeTruthy();
        expect(document.body.textContent).not.toMatch(/ValueLens|Power BI/i);
    });

    it("distinguishes the Signal → Impact baseline from editable assumptions", () => {
        renderWithTheme(<SignalImpactStage />);

        expect(screen.getByText(/Human minutes are the model's Human Baseline estimate, not measured time saved/)).toBeTruthy();
        expect(screen.getByText(/On the Assumptions page, you can override each task's Conservative, Typical, and Optimistic times/)).toBeTruthy();
        expect(document.body.textContent).not.toMatch(/ValueLens|Power BI/i);
    });

    it("explains grading as DataHub App methodology rather than a research result", () => {
        renderWithTheme(<GradingMethodStage />);

        expect(screen.getByText(/How Efficiency grades recorded session activity/)).toBeTruthy();
        expect(screen.getByText(/thresholds are DataHub App rules, not study findings/)).toBeTruthy();
        expect(document.body.textContent).not.toMatch(/ValueLens|Power BI/i);
    });
});
