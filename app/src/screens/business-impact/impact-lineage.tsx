//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { impactMetrics, impactPersonas } from "@/queries/business-impact";
import { ImpactTable } from "./impact-table";

type Status = "Connected" | "Template" | "Not mapped" | "Not configured";

interface Step {
    title: string;
    status: Status;
    detail: string;
}

const tone: Record<Status, string> = {
    "Connected": "border-primary/40 bg-primary/5 text-primary",
    "Template": "border-border text-foreground",
    "Not mapped": "border-dashed border-border text-muted-foreground",
    "Not configured": "border-dashed border-border text-muted-foreground",
};

function Chain({ label, steps }: { label: string; steps: Step[] }) {
    return <ol aria-label={label} className="grid gap-400 rounded-xl border border-border bg-card p-500 md:grid-cols-4 md:gap-0">
        {steps.map((step, index) => <li key={step.title} className={cn("relative flex flex-col gap-200",
            index > 0 && "border-t border-border pt-400 md:border-t-0 md:border-l md:pt-0 md:pl-500",
            index < steps.length - 1 && "md:pr-500")}>
            {index > 0 && <span aria-hidden="true" className="absolute top-300 -left-300 hidden size-[calc(var(--spacing-300)*2)] place-items-center rounded-full border border-border bg-card text-muted-foreground md:grid">&rarr;</span>}
            <span className={cn(SMALL, "w-fit rounded-full border px-200 py-100 font-semibold", tone[step.status])}>{step.status}</span>
            <h3 className={cn(BODY, "font-semibold text-balance")}>{step.title}</h3>
            <p className={cn(SMALL, "text-muted-foreground")}>{step.detail}</p>
        </li>)}
    </ol>;
}

const personaSteps: Step[] = [
    { title: "Role template", status: "Template", detail: "Written by DataHub, with an explicit process and headline measure. Not discovered from Entra, HR or SAP user records." },
    { title: "SAP source views", status: "Connected", detail: "Existing SAP CDS-view extracts copied to a Fabric Lakehouse. The app reads the process model; it does not extract SAP data." },
    { title: "Business impact model", status: "Connected", detail: "A Direct Lake model. Each line is dated by its posting, creation or order date." },
    { title: "People, agents and cost", status: "Not mapped", detail: "No join to employees, Copilot users, agents or AI spend until an approved bridge exists." },
];

const agentSteps: Step[] = [
    { title: "DataHub agent usage", status: "Connected", detail: "Agents, active users and organisations from the Copilot audit log." },
    { title: "Process step and persona", status: "Not configured", detail: "An owner-approved mapping from a stable agent ID and version to a process step, role, team and rollout date." },
    { title: "Business case evidence", status: "Not mapped", detail: "Run-to-case links, completed actions and human handoffs. An agent session is not a completed business case." },
    { title: "Business outcome change", status: "Not configured", detail: "Process observations exist. A baseline, comparison group and quality checks are still needed to estimate the rollout's effect." },
];

const links = [
    ["Approved agent mapping", "Show the agent, process step, functional persona and intended automation mode.", "Source/environment-scoped agent ID and version, process/step ID, role/team, owner, rollout and validity dates. A name match is not approval."],
    ["Run-to-case evidence", "Distinguish assisted cases, human-approved actions and verified straight-through completion.", "Source-scoped case keys, run/action IDs, timestamps, outcomes, human interventions and failures. Deduplicate cases touched by multiple agents; keep unmapped activity visible."],
    ["Impact comparison", "Estimate the change associated with an agent rollout, not just whether it ran.", "Aligned baseline and rollout cohorts, comparison group, case mix, quality checks and uncertainty. Joint rollouts are assessed together unless separate effects can be identified."],
];

export function PersonaLineage() {
    return <div className="flex flex-col gap-400">
        <Chain label="Where the personas come from" steps={personaSteps} />
        <ImpactTable caption="Each authored role template is assigned to a process and its measures. These are process-level rows, not documents belonging to identified employees." headers={["Persona", "SAP source, rows and fields", "Measures"]} rows={impactPersonas.map(persona => [
            <div key="persona"><p className="font-semibold">{persona.name}</p><p className="mt-100 text-muted-foreground">{persona.process}</p></div>,
            <ul key="source" className="flex flex-col gap-300">{persona.sources.map(source => <li key={source.view + source.rows}>
                <p className="font-mono font-semibold break-all">{source.view}</p>
                <p className="mt-100">{source.rows}</p>
                <p className="mt-100 text-muted-foreground">{source.fields}</p>
            </li>)}</ul>,
            <ul key="measures" className="flex flex-col gap-100">{impactMetrics.filter(metric => metric.process === persona.process).map(metric => <li key={metric.id}>{metric.name}</li>)}</ul>,
        ])} />
    </div>;
}

export function AgentLineage() {
    return <div className="flex flex-col gap-400">
        <Chain label="How agents would connect to the process measures" steps={agentSteps} />
        <details className={SMALL}>
            <summary className="w-fit cursor-pointer font-semibold">Mapping and evidence requirements</summary>
            <ImpactTable caption="Three separate requirements, not interchangeable evidence levels. None is configured in this connection." headers={["Link", "What it enables", "What it needs"]} rows={links} />
        </details>
    </div>;
}

const measurementSteps = [
    { title: "Coverage", ask: "How many eligible cases did agents handle?", needs: "Case IDs", label: "Automation coverage", detail: "Distinct eligible cases assisted, completed with human approval, or completed with no human intervention. Keep manual and unknown cases visible; one case can involve several agents." },
    { title: "Quality", ask: "Were they completed correctly, and with how much human effort?", needs: "Verified completion", label: "Quality and human effort", detail: "Verified business completion, handoffs, reopens, failures and human handling time. A resolved chat is not a resolved invoice or incident." },
    { title: "Outcome", ask: "Did the process get faster, cheaper or better?", needs: "Comparison group", label: "Business outcome", detail: "Cycle time, throughput, service levels, cash or revenue, with the same scope before and after rollout and a suitable comparison. Case linkage alone does not establish causality." },
    { title: "Cost per successful case", ask: "What did each verified success cost?", needs: "Cost allocation", label: "Cost per successful case", detail: "Same-period allocated agent/model/platform cost plus documented human handling cost, divided by verified successful cases. Do not add estimated time savings to measured financial benefits." },
] as const;

export function AgentMeasurement() {
    return <div className="flex flex-col gap-300">
        <h3 className={cn(BODY, "font-semibold")}>Measure automation, not just activity</h3>
        <ol aria-label="Four steps from agent activity to cost per successful case" className="grid gap-300 sm:grid-cols-2 xl:grid-cols-4">
            {measurementSteps.map((step, index) => <li key={step.title} className="flex gap-300 rounded-lg border border-border bg-card p-400">
                <span aria-hidden="true" className={cn(SMALL, "grid size-[28px] shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground")}>{index + 1}</span>
                <div className="flex min-w-0 flex-col gap-200">
                    <span className={cn(BODY, "font-semibold")}>{step.title}</span>
                    <span className={cn(SMALL, "text-muted-foreground")}>{step.ask}</span>
                    <span className={cn(SMALL, "w-fit rounded-full border border-dashed border-border px-200 py-100 text-muted-foreground")}>Needs: {step.needs}</span>
                </div>
            </li>)}
        </ol>
        <p className={cn(SMALL, "text-muted-foreground")}>Unknown intervention history stays unknown; it never counts as autonomous completion.</p>
        <details className={SMALL}>
            <summary className="w-fit cursor-pointer font-semibold">Measurement definitions</summary>
            <p className="mt-200 text-muted-foreground">Definitions, not reported results. Classify observed execution, not the agent's intended capability. Human-assisted, human-approved and straight-through work are different.</p>
            <dl className="mt-300 grid gap-x-600 gap-y-300 md:grid-cols-2">
                {measurementSteps.map(step => <div key={step.label} className="flex flex-col gap-100">
                    <dt className="font-semibold">{step.label}</dt>
                    <dd className="text-muted-foreground">{step.detail}</dd>
                </div>)}
            </dl>
        </details>
    </div>;
}
