import { describe, expect, it } from "vitest";
import { destinations, hasOwnTab, openStage, type DestinationId } from "@/components/destinations";
import { pageStages } from "@/hooks/stage-filter.context";
import { availableChapters, chapterFor, sectionStages } from "./narrative";
import { cleanStages } from "./report-pack";

const available = (...ids: DestinationId[]) => destinations.filter((destination) => ids.includes(destination.id));

describe("question-led navigation", () => {
    it("places existing deep links under the new chapters without changing their query destination", () => {
        expect(chapterFor("feedback", "feedback")?.id).toBe("adoption");
        expect(chapterFor("work-patterns", "m365-suite")?.id).toBe("adoption");
        expect(chapterFor("agent-evaluation", "agent-performance")?.id).toBe("governance");
        expect(chapterFor("business-impact", "impact-opportunities")?.id).toBe("readiness");
        expect(chapterFor("business-impact", "impact-processes")?.id).toBe("business-impact");
    });

    it("keeps optional-only installations usable without exposing ValueLens stages", () => {
        const result = availableChapters(available("consumption", "optimization", "agent-evaluation"), "microsoft");
        expect(result.map(({ label }) => label)).toEqual(["Cost & consumption", "Optimise", "Governance"]);
        expect(result[2].sections.map(({ destination }) => destination)).toEqual(["agent-evaluation"]);
    });

    it("adds vendor views to relevant chapters only in the all-vendor scope", () => {
        const installed = available("executive", "adoption", "consumption", "cross-vendor");
        expect(availableChapters(installed, "microsoft").flatMap(({ sections }) => sections).some(({ destination }) => destination === "cross-vendor")).toBe(false);
        const sections = availableChapters(installed, "all").flatMap(({ sections }) => sections);
        expect(sections.filter(({ destination }) => destination === "cross-vendor").flatMap(sectionStages).map(({ id }) => id).sort())
            .toEqual(destinations.find(({ id }) => id === "cross-vendor")!.stages.map(({ id }) => id).sort());
    });

    it("shows the Cloud & AI spend mock-up only in the all-vendor scope, with every stage in a chapter", () => {
        const installed = available("executive", "finops");
        expect(availableChapters(installed, "microsoft").flatMap(({ sections }) => sections).some(({ destination }) => destination === "finops")).toBe(false);
        const placed = availableChapters(installed, "all").flatMap(({ sections }) => sections.filter(({ destination }) => destination === "finops").flatMap(sectionStages));
        expect(placed.map(({ id }) => id).sort()).toEqual(destinations.find(({ id }) => id === "finops")!.stages.filter(hasOwnTab).map(({ id }) => id).sort());
        expect(chapterFor("finops", "fin-unit")?.id).toBe("value");
        expect(chapterFor("finops", "fin-forecast")?.id).toBe("readiness");
    });

    it("opens a merged stage on its parent tab, below the headline stage", () => {
        const finops = destinations.find(({ id }) => id === "finops")!;
        expect(openStage(finops, "fin-models")).toBe("fin-portfolio");
        expect(pageStages("fin-portfolio").show("fin-models")).toBe(true);
        expect(pageStages("fin-portfolio").show("fin-unit")).toBe(false);
        const impact = availableChapters(available("business-impact"), "microsoft");
        expect(sectionStages(impact[0].sections[0]).map(({ id }) => id)).not.toContain("impact-connect");
    });

    it("moves opportunities out of impact topics and removes retired heavy-users packs", () => {
        const impact = availableChapters(available("business-impact"), "microsoft");
        expect(impact.map(({ id }) => id)).toEqual(["business-impact", "readiness"]);
        expect(sectionStages(impact[0].sections[0]).map(({ id }) => id)).not.toContain("impact-opportunities");
        expect(cleanStages(["habit-licence", "adoption", "idle-licenses"])).toEqual(["adoption", "idle-licenses"]);
    });
});
