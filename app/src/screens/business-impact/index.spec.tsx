import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { BusinessImpactScreen } from "./index";
import { StageFilterContext, onlyStages, pageStages } from "@/hooks/stage-filter.context";
import { availableDestinations, destinations, isPackable, openStage } from "@/components/destinations";
import { attributableChange, costToServe, headlineMeasures, isConclusive, measureFor, personas, processAgents, processScorecard, readMeasure, type ProcessMeasure } from "./scenario";
import { bridgeSummary, groups } from "./discovery";
import { LiveConnectStage, LiveDiscoveredPersonas } from "./discovery-view";

vi.mock("@/components/vega-visual", () => ({ VegaVisual: ({ header }: { header?: { title?: string } }) => <figure aria-label={header?.title} /> }));
vi.mock("@/hooks/theme.context", () => ({ useThemeContext: () => ({ theme: {}, isDark: false, toggleTheme() {} }) }));
const modelQuery = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-semantic-model-query", () => ({ useSemanticModelQuery: modelQuery }));

afterEach(() => vi.unstubAllEnvs());

describe("business impact preview", () => {
    it("only exposes the historical explorer in a build that opts into samples", () => {
        const page = destinations.find(d => d.id === "business-impact")!;
        vi.stubEnv("VITE_BUSINESS_OUTCOME_SAMPLES", "");
        expect(openStage(page, "impact-samples")).toBe("impact-summary");
        vi.stubEnv("VITE_BUSINESS_OUTCOME_SAMPLES", "true");
        expect(openStage(page, "impact-samples")).toBe("impact-samples");
    });

    it("opens a public scorecard without querying a connected process model", async () => {
        vi.stubEnv("VITE_BUSINESS_OUTCOME_SAMPLES", "true");
        const optional = await import("@/lib/optional-modules");
        const live = vi.spyOn(optional, "businessImpactLive").mockReturnValue(true);
        try {
            render(<StageFilterContext.Provider value={pageStages("impact-samples")}><BusinessImpactScreen /></StageFilterContext.Provider>);
            expect(await screen.findByRole("heading", { name: "Resolve incidents" })).toBeVisible();
            expect(modelQuery).not.toHaveBeenCalled();
            expect(screen.queryByText("Connected business process history")).not.toBeInTheDocument();
        } finally { live.mockRestore(); }
    });

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
        const check: ProcessMeasure = { process: "Invoice to pay", kind: "Quality check", measure: "Payment-blocked items", unit: "%", lowerIsBetter: true, baseline: 6, current: 6.2, comparisonChange: 0, interval: 0.5, availability: "Computed", basis: "Test fixture." };
        expect(readMeasure(check)).toBe("Held");
        expect(readMeasure({ ...check, current: 7 })).toBe("Worse");
        expect(readMeasure({ ...check, kind: "Speed" })).toBe("Not conclusive");
        expect(readMeasure({ ...check, kind: "Speed", current: 5 })).toBe("Improved");
    });

    it("leads the Bottom line with charts and keeps observed and adjusted changes in the table behind them", () => {
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "true");
        render(<StageFilterContext.Provider value={pageStages("impact-summary")}><BusinessImpactScreen /></StageFilterContext.Provider>);
        expect(screen.getByRole("figure", { name: /headline measures beat their comparison/ })).toBeInTheDocument();
        expect(screen.getByRole("figure", { name: /Invoices reach payment .* days faster/ })).toBeInTheDocument();
        expect(screen.getByRole("figure", { name: "One result at three levels of evidence" })).toBeInTheDocument();
        expect(screen.queryByRole("article")).not.toBeInTheDocument();
        const table = within(screen.getByRole("table", { name: /“Beyond comparison” subtracts the change in a team not yet rolled out/ }));
        expect(table.getAllByRole("row")).toHaveLength(headlineMeasures.length + 1);
        const invoice = within(table.getByRole("row", { name: /Invoice posting to payment time/ }));
        expect(invoice.getByText("Computed")).toBeInTheDocument();
        expect(invoice.getByText("6.1 days")).toBeInTheDocument();
        expect(invoice.getByText(/−1.9 days/)).toBeInTheDocument();
        const discounts = within(table.getByRole("row", { name: /Eligible discounts captured/ }));
        expect(discounts.getByText(/\+11 pts/)).toBeInTheDocument();
        const procurement = within(table.getByRole("row", { name: /Requisition to PO time/ }));
        expect(procurement.getByText("Proxy")).toBeInTheDocument();
        expect(procurement.getByText("Not conclusive")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: `Explore all ${processScorecard.length} process measures` })).toHaveAttribute("href", "#/business-impact/impact-processes");
        expect(screen.getByRole("link", { name: "Trace agents to business outcomes" })).toHaveAttribute("href", "#/business-impact/impact-agents");
    });

    it("follows the selected agent to its own role, step and outcome without attributing the process change to it", () => {
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "true");
        render(<StageFilterContext.Provider value={pageStages("impact-agents")}><BusinessImpactScreen /></StageFilterContext.Provider>);
        const lanes = within(screen.getByRole("radiogroup", { name: "Agent" })).getAllByRole("radio");
        expect(lanes).toHaveLength(processAgents.length);
        processAgents.forEach((agent, index) => {
            fireEvent.click(lanes[index]);
            expect(lanes[index]).toBeChecked();
            expect(screen.getByText(agent.step)).toBeVisible();
            expect(screen.getByRole("heading", { name: measureFor(personas.find(p => p.id === agent.persona)!)!.measure })).toBeVisible();
            expect(screen.getByText(/Simulated process-level comparison, not this agent's causal effect/)).toBeVisible();
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });
        expect(screen.getByText("Missing owner - mapping needs review")).toBeVisible();
        expect(screen.getByText(/Not instrumented\./)).toBeVisible();
        expect(screen.getByText(/Unknown intervention history stays unknown/)).toBeVisible();
        expect(screen.queryByText(/5,210 linked cases in/)).not.toBeInTheDocument();
    });

    it("does not turn session resolution into a successful-business-case cost denominator", () => {
        const costs = costToServe();
        const invoice = costs.find(row => row.agent === "Invoice exception agent")!;
        expect(invoice.costPerLinkedCase).toBeCloseTo(invoice.agentCost / 5210);
        expect(costs.find(row => row.agent === "Supplier risk agent")!.costPerLinkedCase).toBeUndefined();
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "true");
        render(<StageFilterContext.Provider value={onlyStages(["impact-cost"])}><BusinessImpactScreen /></StageFilterContext.Provider>);
        expect(screen.getByRole("columnheader", { name: "Agent cost per linked case" })).toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: /resolved case/ })).not.toBeInTheDocument();
    });

    it("labels the D365 cohort separately and does not give it an attribution estimate", () => {
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "true");
        render(<StageFilterContext.Provider value={pageStages("impact-summary")}><BusinessImpactScreen /></StageFilterContext.Provider>);
        const sales = within(screen.getByRole("region", { name: "D365 Sales preview" }));
        expect(sales.getByRole("img", { name: /Opportunity win rate: Before 27%, After 28%/ })).toBeInTheDocument();
        expect(sales.getByText("Separate cohort")).toBeInTheDocument();
        expect(sales.queryByText(/beyond comparison|Attributable/)).not.toBeInTheDocument();
        expect(screen.getByText(/no attribution claim and no D365 connection/)).toBeInTheDocument();
        expect(screen.getByText(/totals do not reconcile to that page/)).toBeInTheDocument();
    });

    it("renders each persona and says when the build has it off", () => {
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "true");
        const { unmount } = render(<StageFilterContext.Provider value={pageStages("impact-personas")}><BusinessImpactScreen /></StageFilterContext.Provider>);
        const table = within(screen.getByRole("table", { name: /business outcome each persona owns/ }));
        for (const p of personas) expect(table.getByText(p.name)).toBeInTheDocument();
        unmount();
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "");
        render(<StageFilterContext.Provider value={pageStages("impact-personas")}><BusinessImpactScreen /></StageFilterContext.Provider>);
        expect(screen.getByText("The Business impact preview is not enabled for this build.")).toBeInTheDocument();
    });

    it("identifies persona discovery as authored examples rather than an org-data scan", () => {
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "true");
        render(<StageFilterContext.Provider value={pageStages("impact-personas")}><BusinessImpactScreen /></StageFilterContext.Provider>);
        expect(screen.getByRole("heading", { name: "Persona discovery preview" })).toBeInTheDocument();
        expect(screen.getByText(/Titles, counts, fit labels and initial approval statuses are fixed examples/)).toBeInTheDocument();
        expect(screen.queryByText("Discovered from your org data")).not.toBeInTheDocument();
        expect(screen.getAllByText("Waiting for source").length).toBeGreaterThan(0);
    });

    it("lets a person confirm a proposed group on Connect, and keeps D365 groups out of the counts", () => {
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "true");
        render(<StageFilterContext.Provider value={onlyStages(["impact-connect"])}><BusinessImpactScreen /></StageFilterContext.Provider>);
        const before = bridgeSummary(groups);
        const proposed = groups.find(g => g.scope === "sap" && g.status === "Proposed" && g.process)!;
        expect(screen.getByRole("status")).toHaveTextContent(`${before.confirmed} of ${before.scope} people are in a confirmed group`);
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${proposed.name}, ${proposed.process}, .*Select to confirm$`) }));
        expect(screen.getByRole("status")).toHaveTextContent(`${before.confirmed + proposed.people} of ${before.scope} people are in a confirmed group`);
        fireEvent.click(screen.getByRole("button", { name: "Reset sample choices" }));
        expect(screen.getByRole("status")).toHaveTextContent(`${before.confirmed} of ${before.scope} people are in a confirmed group`);
        for (const g of groups.filter(group => group.scope === "d365")) expect(screen.queryByRole("button", { name: new RegExp(`^${g.name},`) })).not.toBeInTheDocument();
    });

    it("says plainly that the connected build has no approved mapping", () => {
        render(<><LiveDiscoveredPersonas /><LiveConnectStage /></>);
        expect(screen.getByRole("heading", { name: "Persona mapping is not configured" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Connect personas to processes" })).toBeInTheDocument();
        expect(screen.getAllByText("Not mapped").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Not configured").length).toBeGreaterThan(0);
        expect(screen.getByRole("link", { name: "Connect" }).parentElement).toHaveTextContent("Connect page lists the requirements, not a working setup form");
        expect(screen.getByText(/Automatic discovery, mapping-table ingestion and saved approvals are not implemented/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Confirm/ })).not.toBeInTheDocument();
    });

    it.each([
        "impact-summary", "impact-personas", "impact-processes", "impact-connect",
        "impact-agents", "impact-cost", "impact-opportunities", "impact-method",
    ] as const)("presents %s as DataHub process insights without workload branding", (stage) => {
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "true");
        const { container } = render(<StageFilterContext.Provider value={onlyStages([stage])}><BusinessImpactScreen /></StageFilterContext.Provider>);
        expect(container.textContent).not.toMatch(/\bBPS\b|Business Process Solutions/);
    });
});
