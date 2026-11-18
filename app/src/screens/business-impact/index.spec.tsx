import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BusinessImpactScreen } from "./index";
import { StageFilterContext, pageStages } from "@/hooks/stage-filter.context";
import { availableDestinations, destinations, isPackable } from "@/components/destinations";
import { attributableChange, isConclusive, personas, readMeasure, type ProcessMeasure } from "./scenario";

vi.mock("@/components/vega-visual", () => ({ VegaVisual: ({ header }: { header?: { title?: string } }) => <figure aria-label={header?.title} /> }));
vi.mock("@/hooks/theme.context", () => ({ useThemeContext: () => ({ theme: {}, isDark: false, toggleTheme() {} }) }));

afterEach(() => vi.unstubAllEnvs());

describe("business impact preview", () => {
    it("is opt-in on its own flag and stays out of packs", () => {
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "");
        vi.stubEnv("VITE_CROSS_VENDOR_DEMO", "true");
        expect(availableDestinations({}).some(d => d.id === "business-impact")).toBe(false);
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "true");
        vi.stubEnv("VITE_CROSS_VENDOR_DEMO", "");
        const ids = availableDestinations({}).map(d => d.id);
        expect(ids).toContain("business-impact");
        expect(ids).not.toContain("cross-vendor");
        expect(isPackable(destinations.find(d => d.id === "business-impact")!)).toBe(false);
    });

    it("nets the comparison group's change out of the attributable effect", () => {
        const ap = personas.find(p => p.id === "ap")!;
        expect(attributableChange(ap)).toBeCloseTo(-1.9);
        expect(isConclusive(ap)).toBe(true);
        expect(isConclusive(personas.find(p => p.id === "salesops")!)).toBe(false);
    });

    it("counts a quality check as held unless it is conclusively worse", () => {
        const check: ProcessMeasure = { process: "Invoice to pay", kind: "Quality check", measure: "Blocked invoices", unit: "%", lowerIsBetter: true, baseline: 6, current: 6.2, comparisonChange: 0, interval: 0.5 };
        expect(readMeasure(check)).toBe("Held");
        expect(readMeasure({ ...check, current: 7 })).toBe("Worse");
        expect(readMeasure({ ...check, kind: "Speed" })).toBe("Not conclusive");
        expect(readMeasure({ ...check, kind: "Speed", current: 5 })).toBe("Improved");
    });

    it("renders each persona and says when the build has it off", () => {
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "true");
        const { unmount } = render(<StageFilterContext.Provider value={pageStages("impact-personas")}><BusinessImpactScreen /></StageFilterContext.Provider>);
        for (const p of personas) expect(screen.getByRole("heading", { name: p.name })).toBeInTheDocument();
        unmount();
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "");
        render(<StageFilterContext.Provider value={pageStages("impact-personas")}><BusinessImpactScreen /></StageFilterContext.Provider>);
        expect(screen.getByText("The Business impact preview is not enabled for this build.")).toBeInTheDocument();
    });
});
