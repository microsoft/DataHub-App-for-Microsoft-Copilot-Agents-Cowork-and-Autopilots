import { destinations, hasOwnTab, type Destination, type DestinationId, type StageId } from "@/components/destinations";

export type VendorScope = "microsoft" | "all";

export interface ChapterSection {
    destination: DestinationId;
    label: string;
    stages?: readonly StageId[];
}

interface ChapterDefinition {
    id: DestinationId;
    label: string;
    question: string;
    sections: readonly ChapterSection[];
}

// Keep source-specific routes, filters and permissions intact behind the question-led navigation.
export const chapters: readonly ChapterDefinition[] = [
    { id: "executive", label: "Overview", question: "How is our AI investment performing?", sections: [
        { destination: "executive", label: "Microsoft overview" },
        { destination: "github-copilot", label: "GitHub Copilot", stages: ["ghcp-summary"] },
        { destination: "cross-vendor", label: "Vendor portfolio", stages: ["vendor-portfolio"] },
        { destination: "finops", label: "Cloud & AI spend", stages: ["fin-summary"] },
    ] },
    { id: "adoption", label: "Adoption", question: "Are people adopting and engaging?", sections: [
        { destination: "adoption", label: "Engagement" },
        { destination: "leaderboards", label: "Leaderboards" },
        { destination: "work-patterns", label: "Work patterns" },
        { destination: "feedback", label: "Feedback" },
        { destination: "github-copilot", label: "GitHub Copilot", stages: ["ghcp-reach", "ghcp-depth"] },
        { destination: "cross-vendor", label: "Vendor usage", stages: ["vendor-adoption", "vendor-coding", "vendor-usage"] },
    ] },
    { id: "consumption", label: "Cost & consumption", question: "What is it costing us?", sections: [
        { destination: "consumption", label: "Microsoft services" },
        { destination: "github-copilot", label: "GitHub Copilot", stages: ["ghcp-cost"] },
        { destination: "cross-vendor", label: "Vendor costs", stages: ["vendor-spend", "vendor-cost"] },
        { destination: "finops", label: "Cloud & AI spend", stages: ["fin-portfolio", "fin-explorer", "fin-models"] },
    ] },
    { id: "value", label: "Value", question: "What value are we getting?", sections: [
        { destination: "value", label: "Estimated value" },
        { destination: "github-copilot", label: "GitHub Copilot", stages: ["ghcp-value"] },
        { destination: "finops", label: "Cost per outcome", stages: ["fin-unit"] },
    ] },
    { id: "business-impact", label: "Business impact", question: "How are agents and AI changing business processes?", sections: [
        { destination: "business-impact", label: "Process evidence", stages: ["impact-summary", "impact-samples", "impact-personas", "impact-processes", "impact-connect", "impact-agents", "impact-cost", "impact-method"] },
    ] },
    { id: "efficiency", label: "Optimise", question: "How do we optimise our costs and tool choices?", sections: [
        { destination: "efficiency", label: "Licences & tool fit" },
        { destination: "optimization", label: "Cowork right-sizing" },
        { destination: "github-copilot", label: "GitHub Copilot", stages: ["ghcp-optimise"] },
        { destination: "finops", label: "Rates & commitments", stages: ["fin-rates"] },
    ] },
    { id: "readiness", label: "Expand", question: "Where should we expand AI next?", sections: [
        { destination: "readiness", label: "Rollout readiness" },
        { destination: "business-impact", label: "Process opportunities", stages: ["impact-opportunities"] },
        { destination: "github-copilot", label: "GitHub Copilot", stages: ["ghcp-expand"] },
        { destination: "finops", label: "Spend forecast", stages: ["fin-forecast"] },
    ] },
    { id: "governance", label: "Governance", question: "What needs review as we expand?", sections: [
        { destination: "governance", label: "Agent governance" },
        { destination: "agent-evaluation", label: "Agent quality" },
        { destination: "github-copilot", label: "GitHub Copilot", stages: ["ghcp-governance", "ghcp-method"] },
        { destination: "cross-vendor", label: "Vendor evidence", stages: ["vendor-coverage", "vendor-methodology"] },
        { destination: "finops", label: "Cloud & AI cost evidence", stages: ["fin-allocation", "fin-trust", "fin-method"] },
    ] },
];

export function sectionStages(section: ChapterSection) {
    return destinations.find(({ id }) => id === section.destination)!.stages.filter(
        (stage) => stage.ready && hasOwnTab(stage) && (!section.stages || section.stages.includes(stage.id)),
    );
}

export function chapterFor(destination: DestinationId, stage?: StageId) {
    return chapters.find((chapter) => chapter.sections.some(
        (section) => section.destination === destination && (!section.stages || section.stages.includes(stage ?? sectionStages(section)[0]?.id)),
    ));
}

/** Destinations about vendors other than Microsoft, shown only when the view covers every vendor. */
const ALL_VENDOR_ONLY: ReadonlySet<DestinationId> = new Set<DestinationId>(["cross-vendor", "finops"]);

export function availableChapters(available: readonly Destination[], scope: VendorScope) {
    const ids = new Set(available.map(({ id }) => id));
    return chapters.map((chapter) => ({
        ...chapter,
        sections: chapter.sections.filter((section) => ids.has(section.destination) && (scope === "all" || !ALL_VENDOR_ONLY.has(section.destination))),
    })).filter((chapter) => chapter.sections.length > 0);
}
