//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { afterEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { useCssTheme } from "@microsoft/fabric-visuals";
import App from "@/App";
import { ThemeContext } from "@/hooks/theme.context";
import { useAppTheme } from "@/hooks/use-theme";
import { RAIL_STORAGE_KEY } from "@/components/app-shell";

/** Mirrors the provider chain `main.tsx` mounts around the app. */
function Harness({ children }: { children: ReactNode }) {
    const { isDark, toggleTheme } = useAppTheme();
    const theme = useCssTheme();
    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>{children}</ThemeContext.Provider>
    );
}

describe("App", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        window.localStorage.removeItem(RAIL_STORAGE_KEY);
    });

    it("renders without throwing", () => {
        expect(() =>
            render(
                <Harness>
                    <App />
                </Harness>,
            ),
        ).not.toThrow();
    });

    it("mounts content into the document", () => {
        render(
            <Harness>
                <App />
            </Harness>,
        );
        expect(document.body).not.toBeEmptyDOMElement();
    });

    it("credits its creator at the foot of the sidebar, linking to his profile in a new tab", () => {
        render(
            <Harness>
                <App />
            </Harness>,
        );
        const sidebar = screen.getByRole("navigation", { name: "Sections" });
        const link = within(sidebar).getByRole("link", { name: "Keith McGrane" });
        const footer = link.closest("footer");

        expect(footer).toHaveTextContent(/^Created by Keith McGrane$/);
        expect(sidebar.lastElementChild).toBe(footer);
        expect(link).toHaveAttribute("href", "https://github.com/Keithland89");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noreferrer");
    });

    it("opens the view a link names, and keeps it in the URL", () => {
        window.history.replaceState(null, "", "/#/value");
        render(
            <Harness>
                <App />
            </Harness>,
        );
        const sidebar = screen.getByRole("navigation", { name: "Sections" });
        expect(within(sidebar).getByRole("link", { name: "Value" })).toHaveAttribute("aria-current", "page");
        expect(window.location.hash).toMatch(/^#\/value/);
    });

    it.each([
        { layout: "expanded sidebar", width: 1280 },
        { layout: "compact rail", width: 900 },
        { layout: "mobile menu", width: 390 },
    ])("links to the shared Explainer from the $layout without changing the app route", async ({ width }) => {
        const matchMedia = window.matchMedia.bind(window);
        vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
            ...matchMedia(query),
            matches: query === "(max-width: 767px)" ? width <= 767
                : query === "(max-width: 1023px)" ? width <= 1023 : false,
        }));
        window.history.replaceState(null, "", "/#/value/task-breakdown");
        await act(async () => {
            render(
                <Harness>
                    <App />
                </Harness>,
            );
        });
        if (width <= 767) fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

        const sidebar = screen.getByRole("navigation", { name: "Sections" });
        const link = within(sidebar).getByRole("link", { name: "Explainer" });
        expect(link).toHaveAttribute("href", "https://ai-datalab.github.io/#/watch/datahub-explainer");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noreferrer");
        expect(sidebar.querySelector("video")).toBeNull();
        if (width === 900) {
            expect(link).toHaveAttribute("title", "Explainer");
            expect(link.querySelector("span")).toHaveClass("sr-only");
        } else {
            expect(link.querySelector("span")).not.toHaveClass("sr-only");
        }
        link.focus();
        expect(link).toHaveFocus();
        fireEvent.click(link);
        expect(window.location.hash).toBe("#/value/task-breakdown");
        expect(within(sidebar).getByRole("link", { name: "Value" })).toHaveAttribute("aria-current", "page");
    });

    it("puts each view in the history, so Back returns to the last one", async () => {
        render(
            <Harness>
                <App />
            </Harness>,
        );
        const sidebar = screen.getByRole("navigation", { name: "Sections" });
        fireEvent.click(within(sidebar).getByRole("link", { name: "Adoption" }));
        expect(window.location.hash).toMatch(/^#\/adoption/);
        fireEvent.click(within(sidebar).getByRole("link", { name: "Value" }));
        expect(window.location.hash).toMatch(/^#\/value/);

        window.history.back();
        await waitFor(() => expect(within(sidebar).getByRole("link", { name: "Adoption" })).toHaveAttribute("aria-current", "page"));
        expect(window.location.hash).toMatch(/^#\/adoption/);
    });
});
