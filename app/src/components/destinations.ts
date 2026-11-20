//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { LucideIcon } from "lucide-react";
import {
    Banknote,
    BookOpen,
    BotMessageSquare,
    Briefcase,
    Cloud,
    CodeXml,
    Coins,
    Factory,
    Gauge,
    Globe,
    KeyRound,
    LayoutDashboard,
    MessageSquareQuote,
    ShieldCheck,
    Sparkles,
    Timer,
    TrendingUp,
    Trophy,
} from "lucide-react";
import { isConnectionConfigured, type ModelReferences } from "@/lib/connections";
import type { FilterKey } from "@/lib/filters";
import { businessImpactLive, crossVendorOn, finopsOn, githubCopilotOn, outcomeSamplesOn, valueLensOn } from "@/lib/optional-modules";
import { isAbsent, type SourceAvailability } from "@/lib/optional-sources";
import { runtimeConfig } from "@/lib/runtime-config";
import { consumptionConnection, evaluatorConnection } from "@/queries/shared";

/**
 * The top-level destinations the report pages were folded into, each
 * holding its pages as stages read top to bottom, plus the app's assumptions
 * and the report's appendix as reference destinations below them. Consumption and Agent Evaluation
 * come from their own reports, Consumption Central and Agent Evaluator, and
 * bring their own slicers, so they take none of the filter bar's. Their
 * `connection` is optional: without it in `fabric.yaml` they are left out.
 * A destination with a `source` reads an optional module of the ValueLens
 * model, and is left out once the app has checked that source has no data.
 * Governance reads the Agent 365 registry, plus the optional Defender source
 * for its Shadow AI stage, and stays listed without either, saying how to
 * connect them. The rest read ValueLens, an optional installer module too:
 * an install without it lists only Consumption and Agent Evaluation, plus
 * the cross-vendor view when that was chosen.
 *
 * A stage that is not built yet stays listed so the shape of the destination
 * is visible; a destination is reachable once any of its stages is built.
 * `filters` are the slicers the destination responds to, taken from the ones
 * the report placed on its pages; the destination id doubles as its palette.
 * A `reference` destination holds definitions rather than activity, so it has
 * no filters and sits apart in the sidebar. Ask takes no filters either: the
 * question says what period and organisations it is about. It is
 * `conversational`, so it can't go in a report pack. A destination on
 * another model lists the filters its queries' profiles can take (see
 * `filter-profiles.ts`); a card that still can't take one says so.
 *
 * The executive summary comes first and is where the app opens: one page
 * drawing on the others, each of its panels linking to the destination
 * that tells that part of the story in full. The rest follow in the order
 * the sidebar lists them and the background loader warms them: who is
 * using it (Adoption), what it costs (Consumption), what the work was worth
 * (Value), whether business processes changed (Business impact, an optional
 * preview), whether the right tool is doing the job (Efficiency), who does the most and how people work, who is next, the
 * agents, then what people say.
 */
export const destinations = [
    {
        id: "executive",
        label: "Overview",
        blurb: "How is our AI investment performing?",
        icon: LayoutDashboard as LucideIcon,
        filters: ["dateRange", "organizations"] as FilterKey[],
        stages: [
            { id: "the-bottom-line", label: "The bottom line", ready: true },
            { id: "is-it-growing", label: "Is it growing?", ready: true },
            { id: "where-it-is-landing", label: "Where it is landing", ready: true },
            { id: "what-needs-attention", label: "What needs attention", ready: true },
        ],
    },
    {
        id: "cross-vendor",
        label: "Cross-vendor view",
        blurb: "Native usage across Copilot, Claude, ChatGPT / Codex and Cursor",
        icon: Globe as LucideIcon,
        filters: [] as FilterKey[],
        demo: true,
        dataRange: "27 Jul – 25 Oct 2026",
        stages: [
            { id: "vendor-portfolio", label: "Portfolio", ready: true },
            { id: "vendor-adoption", label: "Adoption trends", ready: true },
            { id: "vendor-coding", label: "Coding output", ready: true },
            { id: "vendor-spend", label: "Spend & credits", ready: true },
            { id: "vendor-usage", label: "Native usage", ready: true },
            { id: "vendor-cost", label: "Cost & evidence", ready: true },
            { id: "vendor-coverage", label: "Source coverage", ready: true },
            { id: "vendor-methodology", label: "Methodology", ready: true },
        ],
    },
    {
        id: "adoption",
        label: "Adoption",
        blurb: "Who started, who stayed, who stuck",
        icon: TrendingUp as LucideIcon,
        filters: ["dateRange", "organizations", "licence", "audience", "agentTypes", "agentNames"] as FilterKey[],
        stages: [
            { id: "adoption", label: "Adoption", ready: true },
            { id: "activation", label: "Activation", ready: true },
            { id: "habit-formation", label: "Habit formation", ready: true },
            { id: "trend-heatmap", label: "Trend heatmap", ready: true },
        ],
    },
    {
        id: "consumption",
        label: "Cost & consumption",
        blurb: "What is it costing us?",
        icon: Coins as LucideIcon,
        filters: ["dateRange", "organizations", "agentNames"] as FilterKey[],
        connection: consumptionConnection,
        stages: [
            { id: "consumption-overview", label: "All products", ready: true },
            { id: "budget-runway", label: "Budget runway", ready: true },
            { id: "chargeback", label: "Chargeback", ready: true },
            { id: "forecast", label: "Forecast", ready: true },
            { id: "cowork-credits", label: "Cowork / Work IQ", ready: true },
            { id: "studio-credits", label: "Copilot Studio", ready: true },
            { id: "azure-spend", label: "Azure", ready: true },
        ],
    },
    {
        id: "value",
        label: "Value",
        blurb: "What the work was, and what it was worth",
        icon: Banknote as LucideIcon,
        filters: ["dateRange", "organizations", "licence", "audience", "agentTypes", "agentNames"] as FilterKey[],
        stages: [
            { id: "task-breakdown", label: "Task breakdown", ready: true },
            { id: "estimated-value", label: "Estimated value", ready: true },
            { id: "value-by-habit", label: "Value by habit", ready: true },
            { id: "cost-vs-value", label: "Cost vs value", ready: true },
        ],
    },
    {
        id: "business-impact",
        label: "Business impact",
        blurb: "Connect agents and automation to process steps, functional personas and business outcomes. Impact needs approved mappings and outcome evidence.",
        icon: Factory as LucideIcon,
        filters: [] as FilterKey[],
        demo: true,
        dataRange: "4 May – 26 Oct 2026",
        stages: [
            { id: "impact-summary", label: "The bottom line", ready: true },
            { id: "impact-samples", label: "Outcome explorer", get ready() { return outcomeSamplesOn(); } },
            { id: "impact-personas", label: "Personas & processes", ready: true },
            { id: "impact-processes", label: "Process outcomes", ready: true, within: "impact-personas" },
            { id: "impact-connect", label: "Connect", ready: true, within: "impact-personas" },
            { id: "impact-agents", label: "Agents & automation", ready: true },
            { id: "impact-cost", label: "Cost per transaction", ready: true, within: "impact-agents" },
            { id: "impact-opportunities", label: "Next opportunities", ready: true },
            { id: "impact-method", label: "Data & method", ready: true },
        ],
    },
    {
        id: "github-copilot",
        label: "GitHub Copilot",
        blurb: "Who uses GitHub Copilot, how far they hand work over to it, what it costs and what it returns. Synthetic mock-up.",
        icon: CodeXml as LucideIcon,
        filters: ["dateRange", "organizations"] as FilterKey[],
        demo: true,
        stages: [
            { id: "ghcp-summary", label: "At a glance", ready: true },
            { id: "ghcp-reach", label: "Reach & habit", ready: true },
            { id: "ghcp-depth", label: "Depth", ready: true },
            { id: "ghcp-cost", label: "Seats & premium requests", ready: true },
            { id: "ghcp-value", label: "Capacity & value", ready: true },
            { id: "ghcp-optimise", label: "Seats & model fit", ready: true },
            { id: "ghcp-expand", label: "Where to deepen next", ready: true },
            { id: "ghcp-governance", label: "Models & autonomy", ready: true },
            { id: "ghcp-method", label: "Data & method", ready: true },
        ],
    },
    {
        id: "finops",
        label: "Cloud & AI spend",
        blurb: "What cloud and AI providers cost, what each outcome costs, and how far the numbers can be trusted. Synthetic mock-up.",
        icon: Cloud as LucideIcon,
        filters: ["dateRange"] as FilterKey[],
        demo: true,
        dataRange: "1 Jun – 25 Oct 2026",
        stages: [
            { id: "fin-summary", label: "At a glance", ready: true },
            { id: "fin-portfolio", label: "Where it goes", ready: true },
            { id: "fin-explorer", label: "Movers & services", ready: true, within: "fin-portfolio" },
            { id: "fin-models", label: "Models & tokens", ready: true, within: "fin-portfolio" },
            { id: "fin-unit", label: "Cost per outcome", ready: true },
            { id: "fin-rates", label: "Rates & commitments", ready: true },
            { id: "fin-forecast", label: "Forecast", ready: true },
            { id: "fin-allocation", label: "Ownership & trust", ready: true },
            { id: "fin-trust", label: "Data trust", ready: true, within: "fin-allocation" },
            { id: "fin-method", label: "Method", ready: true, within: "fin-allocation" },
        ],
    },
    {
        id: "efficiency",
        label: "Optimise",
        blurb: "How do we optimise our costs and tool choices?",
        icon: Gauge as LucideIcon,
        filters: ["dateRange", "organizations", "licence", "audience", "agentTypes", "agentNames"] as FilterKey[],
        stages: [
            { id: "idle-licenses", label: "Idle licences", ready: true },
            { id: "cowork-fit", label: "Cowork fit", ready: true },
            { id: "model-fit", label: "Model fit", ready: true },
        ],
    },
    {
        id: "optimization",
        label: "Cowork right-sizing",
        blurb: "Review allowances against observed usage before changing commitments",
        icon: Gauge as LucideIcon,
        filters: ["organizations"] as FilterKey[],
        connection: consumptionConnection,
        stages: [{ id: "cowork-right-sizing", label: "Right-sizing", ready: true }],
    },
    {
        id: "leaderboards",
        label: "Leaderboards",
        blurb: "The people and the agents doing the most",
        icon: Trophy as LucideIcon,
        filters: ["dateRange", "organizations", "licence", "audience", "agentTypes", "agentNames"] as FilterKey[],
        stages: [
            { id: "leaderboard", label: "Leaderboard", ready: true },
            { id: "agents", label: "Agents", ready: true },
        ],
    },
    {
        id: "work-patterns",
        label: "Work patterns",
        blurb: "How people work across Microsoft 365, and where Copilot fits",
        icon: Briefcase as LucideIcon,
        filters: ["dateRange", "organizations"] as FilterKey[],
        source: "m365Activity",
        stages: [
            { id: "m365-activity", label: "Microsoft 365 activity", ready: true },
            { id: "m365-suite", label: "Apps and devices", ready: true },
            { id: "m365-copilot", label: "Copilot in the flow of work", ready: true },
        ],
    },
    {
        id: "readiness",
        label: "Expand",
        blurb: "Where should we expand AI next?",
        icon: KeyRound as LucideIcon,
        filters: ["dateRange", "organizations"] as FilterKey[],
        stages: [
            { id: "license-readiness", label: "License readiness", ready: true },
            { id: "cowork-readiness", label: "Cowork readiness", ready: true },
        ],
    },
    {
        id: "agent-evaluation",
        label: "Agent quality",
        blurb: "How well your agents answer, and where they fall short",
        icon: BotMessageSquare as LucideIcon,
        filters: ["dateRange", "organizations"] as FilterKey[],
        connection: evaluatorConnection,
        stages: [
            { id: "agent-performance", label: "Performance", ready: true },
            { id: "agent-conversations", label: "Conversations & topics", ready: true },
        ],
    },
    {
        id: "governance",
        label: "Governance",
        blurb: "Who owns your agents, who can reach them, and what needs a review",
        icon: ShieldCheck as LucideIcon,
        filters: ["agentTypes", "agentNames"] as FilterKey[],
        stages: [
            { id: "estate-health", label: "Estate health", ready: true },
            { id: "exposure", label: "Exposure", ready: true },
            { id: "accountability", label: "Accountability", ready: true },
            { id: "review-queue", label: "Review queue", ready: true },
            { id: "shadow-ai", label: "Shadow AI", ready: true },
        ],
    },
    {
        id: "feedback",
        label: "Feedback",
        blurb: "What people say about it",
        icon: MessageSquareQuote as LucideIcon,
        filters: ["dateRange", "agentTypes", "agentNames"] as FilterKey[],
        source: "productFeedback",
        stages: [{ id: "feedback", label: "Feedback", ready: true }],
    },
    {
        id: "ask",
        label: "Ask agent",
        blurb: "Questions about the data, in your own words",
        icon: Sparkles as LucideIcon,
        filters: [] as FilterKey[],
        conversational: true,
        stages: [{ id: "ask", label: "Ask", ready: true }],
    },
    {
        id: "assumptions",
        label: "Assumptions",
        blurb: "The task times behind every value figure",
        icon: Timer as LucideIcon,
        filters: [] as FilterKey[],
        reference: true,
        stages: [{ id: "time-per-task", label: "Time per task", ready: true }],
    },
    {
        id: "appendix",
        label: "Appendix",
        blurb: "What each metric means, and the value assumptions",
        icon: BookOpen as LucideIcon,
        filters: [] as FilterKey[],
        reference: true,
        stages: [
            { id: "glossary", label: "Glossary", ready: true },
            { id: "signal-impact", label: "Signal → Impact", ready: true },
            { id: "grading-method", label: "How grading works", ready: true },
        ],
    },
] as const;

export type Destination = (typeof destinations)[number];
export type DestinationId = Destination["id"];
export type Stage = Destination["stages"][number];
export type StageId = Stage["id"];

/** A destination is reachable once any of its stages is built. */
export function isDestinationReady(destination: Destination): boolean {
    return destination.stages.some((stage) => stage.ready);
}

/** Reference destinations hold definitions rather than activity. */
export function isReference(destination: Destination): boolean {
    return "reference" in destination && destination.reference;
}

/** Whether a destination's stages can go in a report pack: not a conversation like Ask. */
export function isPackable(destination: Destination): boolean {
    return !("demo" in destination && destination.demo) &&
        !("conversational" in destination && destination.conversational);
}

/** Whether a synthetic demo destination is on: a build flag, or the cross-vendor installer module. */
export function isDemoEnabled(id: DestinationId, models?: ModelReferences): boolean {
    if (id === "business-impact") return businessImpactLive(models) || import.meta.env.VITE_BUSINESS_IMPACT_DEMO === "true";
    if (id === "github-copilot") return githubCopilotOn();
    if (id === "finops") return finopsOn();
    return crossVendorOn();
}

/**
 * Whether a destination reads the ValueLens model: every one without its own
 * `connection`, except the cross-vendor view, which reads its own scenario.
 */
export function readsValueLens(destination: Destination): boolean {
    return !("connection" in destination) && !("demo" in destination);
}

/**
 * Every destination except those reading a model `fabric.yaml` doesn't set
 * up, those reading ValueLens when the install left it out, the cross-vendor
 * view unless it was chosen, and, once `sources` has been checked, those
 * whose source has no data.
 */
export function availableDestinations(models: ModelReferences, sources?: SourceAvailability): Destination[] {
    const valueLens = valueLensOn();
    return destinations.filter(
        (destination) =>
            (!("demo" in destination) || isDemoEnabled(destination.id, models)) &&
            (valueLens || !readsValueLens(destination)) &&
            (!("connection" in destination) || isConnectionConfigured(models, destination.connection)) &&
            (runtimeConfig().demo || !sources || !("source" in destination) || !isAbsent(sources, destination.source)),
    );
}

/** The DOM id a stage's section carries, so a link can bring it into view. */
export function stageAnchor(id: StageId): string {
    return `stage-${id}`;
}

/**
 * The stage a destination shows: `wanted` when it is one of its built
 * stages, otherwise its first. A destination shows one stage at a time, so
 * opening a page only queries what is on screen.
 */
export function openStage(
    destination: { readonly stages: readonly { readonly id: StageId; readonly ready: boolean }[] },
    wanted?: StageId,
): StageId | undefined {
    const built = destination.stages.filter((stage) => stage.ready);
    const target = wanted && stageParent(wanted);
    return (built.find((stage) => stage.id === target) ?? built[0])?.id;
}

const stageList: readonly Stage[] = destinations.flatMap((destination): readonly Stage[] => destination.stages);

/**
 * The tab a stage sits on. A `within` stage has no tab of its own: it opens
 * as detail below the stage it names, so a page keeps one headline story.
 */
export function stageParent(id: StageId): StageId {
    const stage = stageList.find((candidate) => candidate.id === id);
    return stage && "within" in stage ? stage.within : id;
}

/** Whether a stage has its own tab rather than sitting within another. */
export function hasOwnTab(stage: Stage): boolean {
    return !("within" in stage);
}

/** The tab panel that holds the open stage. */
export const STAGE_PANEL_ID = "stage-panel";

/** The id of a stage's tab, which names its panel. */
export const stageTabId = (stage: StageId) => `stage-tab-${stage}`;
