import { cleanup, render, screen, within } from "@testing-library/react";
import type { CachedQueryResult } from "@microsoft/fabric-app-data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syntheticQueryResult } from "@/demo/synthetic-model";
import { samples } from "@/demo/sample-data";
import { FilterContext } from "@/hooks/filter.context";
import { defaultFilters, FILTER_KEYS, type FilterState } from "@/lib/filters";
import { describeOrgAttribute } from "@/lib/org-attribute";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { ActivationStage } from "./adoption/activation-stage";
import { AdoptionStage } from "./adoption/adoption-stage";
import { TasksStage } from "./value/tasks-stage";
import { LicenseReadinessStage } from "./readiness/license-readiness-stage";

const transport = vi.hoisted(() => ({
    queries: [] as string[],
    cache: new Map<string, CachedQueryResult>(),
}));

vi.mock("@/hooks/use-semantic-model-query", () => ({
    useSemanticModelQuery: ({ query, columnMetadata }: { query: string; columnMetadata?: ColumnMetadataMap }) => {
        transport.queries.push(query);
        if (!transport.cache.has(query)) transport.cache.set(query, syntheticQueryResult(query, columnMetadata));
        return { data: transport.cache.get(query), isLoading: false, refetch: () => undefined };
    },
    useSpeculativeQuery: () => undefined,
}));
vi.mock("@/hooks/theme.context", () => ({ useThemeContext: () => ({ theme: {} }) }));
vi.mock("@/components/vega-visual", () => ({ VegaVisual: () => null }));

beforeEach(() => {
    transport.queries.length = 0;
    transport.cache.clear();
});

it("applies the same org membership projection to readiness inventory cards and dormancy", () => {
    render(
        <FilterContext.Provider value={{
            filters: { ...defaultFilters, orgAttribute: "country", organizations: ["US"] },
            setFilters: () => undefined, applicable: ["dateRange", "organizations"],
            orgAttribute: describeOrgAttribute("country"),
            orgAttributes: ["country"], orgValues: undefined, options: undefined, optionsError: undefined,
            consumptionOrgAttributes: undefined,
        }}>
            <LicenseReadinessStage />
        </FilterContext.Provider>,
    );
    for (const marker of ['"License Inventory Usable"', '"Dormancy Bucket Order"']) {
        const query = transport.queries.find(query => query.includes(marker));
        expect(query).toBeDefined();
        expect(query).toContain("'Copilot Licensed'[UPN_Normalized]");
        expect(query).toContain('[Attribute] = "country"');
        expect(query).toContain('{"US"}');
    }
});
afterEach(cleanup);

function card(label: string) {
    const element = screen.getByText(label).parentElement;
    if (!element) throw new Error(`Missing ${label} card`);
    return within(element);
}

describe.each([
    ["Activation", ActivationStage, '"Licensed Total"'],
    ["Adoption", AdoptionStage, '"Overall Users"'],
    ["Tasks", TasksStage, '"All Tasks"'],
] as const)("%s cohort KPIs", (_label, Stage, summaryMarker) => {
    it("filters the summary with Cowork, combined filters and cleared filters instead of only highlighting", () => {
        function Page({ filters }: { filters: FilterState }) {
            return (
                <FilterContext.Provider value={{
                    filters, setFilters: () => undefined, applicable: FILTER_KEYS,
                    orgAttribute: describeOrgAttribute(filters.orgAttribute),
                    orgAttributes: ["Organization", "country", "PersonId_Normalized"],
                    orgValues: undefined, options: undefined, optionsError: undefined,
                    consumptionOrgAttributes: undefined,
                }}>
                    <Stage />
                </FilterContext.Provider>
            );
        }
        const { rerender } = render(<Page filters={defaultFilters} />);
        expect(card("Cowork").getByText("Cowork")).toBeInTheDocument();
        const initial = screen.getByText(_label === "Adoption" ? "Overall" : "Everyone").parentElement?.textContent;
        const baseQuery = transport.queries.find(query => query.includes(summaryMarker));
        expect(baseQuery).toBeDefined();

        rerender(<Page filters={{ ...defaultFilters, audience: "cowork" }} />);
        const coworkQuery = transport.queries.filter(query => query.includes(summaryMarker)).at(-1);
        expect(coworkQuery).toContain('TREATAS({"Cowork"},');
        expect(screen.getByText(_label === "Adoption" ? "Overall" : "Everyone").parentElement?.textContent).not.toBe(initial);

        const person = samples.people.find(person => samples.activity.some(row => row.user === person.user && row.cowork))!;
        rerender(<Page filters={{
            ...defaultFilters, audience: "cowork", licence: "licensed", orgAttribute: "country",
            organizations: [person.country], agentTypes: ["Declarative"], agentNames: ["No matching agent"],
            dateRange: { preset: "custom", from: "2026-06-01", to: "2026-06-30" },
        }} />);
        const combined = transport.queries.filter(query => query.includes(summaryMarker)).at(-1);
        expect(combined).toContain('TREATAS({"Cowork"},');
        expect(combined).toContain('TREATAS({"Licensed"},');
        expect(combined).toContain('[Attribute] = "country"');
        expect(combined).toContain('TREATAS({"Declarative"},');
        expect(combined).toContain('TREATAS({"No matching agent"},');
        expect(combined).toContain("DATE(2026, 6, 30)");

        rerender(<Page filters={defaultFilters} />);
        expect(transport.queries.filter(query => query.includes(summaryMarker)).at(-1)).toBe(baseQuery);
        expect(screen.getByText(_label === "Adoption" ? "Overall" : "Everyone").parentElement?.textContent).toBe(initial);
    });
});
