//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { chain, costUnderlay, surfaceNote, surfaces, type LinkEvidence, type StepId } from "@/lib/line-of-sight";
import { finopsOn } from "@/lib/optional-modules";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { ImpactTable } from "@/screens/business-impact/impact-table";

const link = "font-semibold text-primary underline-offset-4 hover:underline";

const tone: Record<LinkEvidence | "Start", string> = {
    Observed: "border-primary/40 bg-primary/5 text-primary",
    Declared: "border-border text-foreground",
    "Not mapped": "border-dashed border-border text-muted-foreground",
    Start: "border-transparent px-0 text-muted-foreground",
};

const meaning: Record<LinkEvidence, string> = {
    Observed: "Both sides are measured and share a key.",
    Declared: "Someone writes the mapping down, and can edit it.",
    "Not mapped": "No join exists until it is approved.",
};

/**
 * The five-step chain from work patterns to business impact. `current`
 * marks the steps the page sits on. `detailed` adds each step's source.
 */
export function LineOfSight({ current = [], scenario = false, detailed = false }: { current?: StepId[]; scenario?: boolean; detailed?: boolean }) {
    const steps = chain(scenario);
    return (
        <div className="flex flex-col gap-400 rounded-xl border border-border bg-card p-500">
            <div className="flex flex-col gap-100">
                <h3 className={cn(BODY, "font-semibold")}>From how people work to what the process delivers</h3>
                <p className={cn(SMALL, "text-muted-foreground")}>
                    Five steps, each joined to the one before. The tag under each step shows how strong that join is. <strong>Observed:</strong> {meaning.Observed.toLowerCase()} <strong>Declared:</strong> {meaning.Declared.toLowerCase()} <strong>Not mapped:</strong> {meaning["Not mapped"].toLowerCase()}
                </p>
            </div>
            <ol aria-label="From work patterns to business impact" className="grid grid-cols-1 gap-400 lg:grid-cols-5 lg:gap-0">
                {steps.map((step, index) => {
                    const here = current.includes(step.id);
                    return (
                        <li
                            key={step.id}
                            aria-current={here ? "step" : undefined}
                            className={cn(
                                "relative flex flex-col gap-100",
                                index > 0 && "border-t border-border pt-400 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-400",
                                index < steps.length - 1 && "lg:pr-400",
                            )}
                        >
                            <a href={step.href} className={cn(BODY, link, "w-fit", here && "text-foreground underline")}>{step.name}</a>
                            <p className={cn(SMALL, "font-semibold")}>{step.question}</p>
                            {detailed && <p className={cn(SMALL, "text-muted-foreground")}>{step.source}</p>}
                            <span className={cn(SMALL, "mt-100 w-fit rounded-full border px-200 py-100 font-semibold", tone[step.evidence])}>
                                {step.evidence === "Start" ? "Start" : step.evidence}
                            </span>
                            <p className={cn(SMALL, "text-muted-foreground")}>{step.join}</p>
                        </li>
                    );
                })}
            </ol>
            <p className={cn(SMALL, "flex flex-wrap items-baseline gap-x-400 gap-y-100 border-t border-border pt-400 text-muted-foreground")}>
                <span className="max-w-[80ch]">{costUnderlay.text}</span>
                {costUnderlay.links.filter(l => !l.optional || finopsOn()).map(l => <a key={l.href} href={l.href} className={link}>{l.label}</a>)}
            </p>
        </div>
    );
}

/** How each AI surface joins to a process, and how far the evidence can go. */
export function SurfaceMap() {
    return (
        <ImpactTable
            caption={`Link each surface at the grain where it has an identity. Agents and autopilots have a name, an owner and a run record, so they map to a process directly. Cowork and Copilot work for a person, so they map through that person's team. ${surfaceNote}`}
            headers={["Surface", "Unit of work", "How it joins to a process", "How far the evidence goes", "What it needs", "What automation means here"]}
            rows={surfaces.map(s => [<strong key="n">{s.name}</strong>, s.unit, s.join, s.ceiling, s.needs, s.automation])}
        />
    );
}
