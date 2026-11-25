//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * The line of sight from how people work to what a business process
 * delivers. It is a reading guide, not a model: each step says what it
 * answers, where it comes from, how it joins to the step before and how
 * strong that join is. Nothing here is computed from data.
 */

export type LinkEvidence = "Observed" | "Declared" | "Not mapped";

export type StepId = "work" | "usage" | "use-case" | "process" | "impact";

export interface ChainStep {
    id: StepId;
    name: string;
    question: string;
    source: string;
    /** How this step joins to the one before it. */
    join: string;
    evidence: LinkEvidence | "Start";
    href: string;
}

export interface CostUnderlay {
    text: string;
    /** `optional` links point at a module that is off by default. */
    links: { label: string; href: string; optional?: boolean }[];
}

export const costUnderlay: CostUnderlay = {
    text: "Cost runs under every step. It joins by application tag and cost centre, so spend can sit beside the usage, the process and the outcome it paid for.",
    links: [
        { label: "Cost and consumption", href: "#/consumption/consumption-overview" },
        { label: "Cloud and AI spend", href: "#/finops/fin-unit", optional: true },
    ],
};

/**
 * `scenario` is the synthetic demo, where an agent-to-process list is
 * shown as if an owner had approved it. A connected install starts without
 * one, so that join reads "Not mapped".
 */
export function chain(scenario: boolean): ChainStep[] {
    return [
        {
            id: "work",
            name: "Work patterns",
            question: "How does work happen?",
            source: "Microsoft 365 activity: meetings, email, chat and documents, by person and organisation.",
            join: "Where the chain starts.",
            evidence: "Start",
            href: "#/work-patterns/m365-copilot",
        },
        {
            id: "usage",
            name: "AI usage",
            question: "What are people doing with AI?",
            source: "Copilot and agent audit log: active people, habit, agents.",
            join: "Same person and organisation keys, same time windows.",
            evidence: "Observed",
            href: "#/adoption/adoption",
        },
        {
            id: "use-case",
            name: "Use cases",
            question: "What kind of work is it?",
            source: "Signal to task to use case to value outcome, with minutes per task.",
            join: "Counts are observed. The labels and minutes are an editable, research-sourced table.",
            evidence: "Declared",
            href: "#/assumptions/signal-impact",
        },
        {
            id: "process",
            name: "Business process",
            question: "Which process does that work sit in?",
            source: "SAP process and a functional persona, one template per process.",
            join: scenario
                ? "An agent-to-process list, as the demo scenario illustrates it. It needs an owner to approve it."
                : "Needs an owner-approved list of which agent or use case serves which process.",
            evidence: scenario ? "Declared" : "Not mapped",
            href: "#/business-impact/impact-connect",
        },
        {
            id: "impact",
            name: "Business impact",
            question: "Did the process change?",
            source: "Business process data: speed, throughput, cash and quality measures.",
            join: "Dated by posting date. Joined to teams, not to people.",
            evidence: "Observed",
            href: "#/business-impact/impact-processes",
        },
    ];
}

export type SurfaceId = "agents" | "autopilots" | "cowork" | "copilot";

export interface Surface {
    id: SurfaceId;
    name: string;
    unit: string;
    join: string;
    ceiling: string;
    needs: string;
    automation: string;
}

/**
 * Link each surface at the grain where it has an identity. An agent or an
 * autopilot has a name, an owner and a run record, so it can be mapped to
 * a process directly. Cowork and Copilot work for a person, so they map
 * through that person's team.
 */
export const surfaces: Surface[] = [
    {
        id: "agents",
        name: "Agents",
        unit: "An agent and its runs.",
        join: "An owner-approved agent/version-to-process-step list, then run/action events carrying source-scoped business case keys.",
        ceiling: "Process level; case level if runs carry the key.",
        needs: "An agent registry with an owner, case keys, business completion and human-intervention events.",
        automation: "Share of distinct eligible cases with verified completion and no human intervention. Unknown history is not automation.",
    },
    {
        id: "autopilots",
        name: "Autopilots",
        unit: "A scheduled or triggered autonomous run.",
        join: "The same mapping as agents, including the trigger and process step. A run can touch several cases; a case can span several runs.",
        ceiling: "Process level; case level if runs carry the key.",
        needs: "A run log, a named owner, source-scoped case keys and verified completion/intervention events.",
        automation: "Share of distinct eligible cases completed end to end with no human handoff. Deduplicate across retries and agents.",
    },
    {
        id: "cowork",
        name: "Cowork",
        unit: "A task a person delegates.",
        join: "The person's functional persona and team, plus the skill or connector the task used to reach the process.",
        ceiling: "Team level; task level only if the connector call records the key.",
        needs: "The organisation bridge, and connector activity in the audit log.",
        automation: "Assisted, not automated: a person still owns and reviews the result.",
    },
    {
        id: "copilot",
        name: "Copilot",
        unit: "A person's prompts across Microsoft 365 apps.",
        join: "The person's functional persona and team. The use-case table says what kind of work it was.",
        ceiling: "Team level only. A contribution to the process, not an attribution.",
        needs: "The organisation bridge, with effective dates.",
        automation: "Assisted, not automated: it shortens a step, it does not own one.",
    },
];

export const surfaceNote =
    "What each surface records varies by licence and by tenant. Check your audit log before relying on a case-level join.";
