import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrossVendorPanel } from "./page-panel-gate";
import { StageFilterContext, onlyStages, pageStages } from "@/hooks/stage-filter.context";
import { VendorScopeContext } from "@/hooks/vendor-scope.context";
import type { CrossVendorPage } from "./page-panels";

vi.mock("@/components/vega-visual", () => ({ VegaVisual: ({ header }: { header?: { title?: string } }) => <figure aria-label={header?.title} /> }));
vi.mock("@/hooks/theme.context", () => ({ useThemeContext: () => ({ theme: {}, isDark: false, toggleTheme() {} }) }));

afterEach(() => vi.unstubAllEnvs());
beforeAll(async () => { await import("./page-panels"); });

const titles: Record<CrossVendorPage, string> = {
    executive: "All AI tools",
    adoption: "People using more than one AI tool",
    consumption: "Copilot credits beside other AI tools' spend",
    efficiency: "Which tool people use for which task",
    leaderboards: "Most active people across AI tools",
};
const allVendors = { scope: "all" as const, setScope: () => undefined };

describe("cross-vendor page panels", () => {
    it.each(Object.entries(titles))("adds the %s panel in all-vendor scope with explicit synthetic provenance", async (page, title) => {
        vi.stubEnv("VITE_CROSS_VENDOR_DEMO", "true");
        const { container } = render(<VendorScopeContext.Provider value={allVendors}><StageFilterContext.Provider value={pageStages("all")}><CrossVendorPanel page={page as CrossVendorPage} /></StageFilterContext.Provider></VendorScopeContext.Provider>);
        expect(await screen.findByRole("heading", { level: 2, name: title })).toBeInTheDocument();
        const root = container.querySelector(`[data-cross-vendor-panel="${page}"]`)!;
        expect(root).toHaveAttribute("data-provenance", "synthetic");
        expect(root).toHaveAttribute("data-print", "hide");
        expect(root.textContent).toMatch(/synthetic/i);
        expect(root.querySelector("[id^='stage-']")).toBeNull();
    });

    it("renders nothing with the flag off or inside a report pack", () => {
        vi.stubEnv("VITE_CROSS_VENDOR_DEMO", "");
        const off = render(<VendorScopeContext.Provider value={allVendors}><CrossVendorPanel page="executive" /></VendorScopeContext.Provider>);
        expect(off.container).toBeEmptyDOMElement();
        off.unmount();
        vi.stubEnv("VITE_CROSS_VENDOR_DEMO", "true");
        const pack = render(<VendorScopeContext.Provider value={allVendors}><StageFilterContext.Provider value={onlyStages(["the-bottom-line"])}><CrossVendorPanel page="executive" /></StageFilterContext.Provider></VendorScopeContext.Provider>);
        expect(pack.container).toBeEmptyDOMElement();
    });

    it("hides vendor previews in the default Microsoft scope even when enabled", () => {
        vi.stubEnv("VITE_CROSS_VENDOR_DEMO", "true");
        expect(render(<CrossVendorPanel page="executive" />).container).toBeEmptyDOMElement();
    });

    it("keeps credits and USD apart on the consumption panel", async () => {
        vi.stubEnv("VITE_CROSS_VENDOR_DEMO", "true");
        render(<VendorScopeContext.Provider value={allVendors}><CrossVendorPanel page="consumption" /></VendorScopeContext.Provider>);
        expect(await screen.findByRole("figure", { name: "Microsoft 365 Copilot credits" })).toBeInTheDocument();
        expect(screen.getByRole("figure", { name: "Spend on other AI tools" })).toBeInTheDocument();
        expect(screen.getByText(/never added/)).toBeInTheDocument();
    });
});
