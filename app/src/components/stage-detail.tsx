//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useStageFilter } from "@/hooks/stage-filter.context";
import { destinations, stageParent, type StageId } from "./destinations";

const SMALL = "text-[length:var(--text-200)] leading-200";

function stageLabel(id: StageId): string {
    for (const destination of destinations)
        for (const stage of destination.stages) if (stage.id === id) return stage.label;
    return id;
}

/**
 * A tab's headline stage, then the stages within it as closed detail rows, so a page
 * answers one question first and keeps its depth a click away. A download or report
 * pack prints every stage open.
 */
export function StageRun({ stages, hints = {}, open = [] }: {
    stages: readonly (readonly [StageId, () => React.JSX.Element])[];
    hints?: Partial<Record<StageId, string>>;
    /** Detail stages that start expanded because their picture is part of the page's story. */
    open?: readonly StageId[];
}) {
    const { show } = useStageFilter();
    return stages.map(([id, Screen]) => {
        if (!show(id)) return null;
        if (stageParent(id) === id) return <Screen key={id} />;
        return <StageDetail key={id} label={stageLabel(id)} hint={hints[id]} startOpen={open.includes(id)}><Screen /></StageDetail>;
    });
}

function StageDetail({ label, hint, startOpen, children }: { label: string; hint?: string; startOpen: boolean; children: ReactNode }) {
    const { deferDetail } = useStageFilter();
    const [open, setOpen] = useState(startOpen);
    if (!deferDetail) return children;
    return (
        <details className="group border-t border-border" open={startOpen} onToggle={(event) => setOpen(event.currentTarget.open)}>
            <summary className="flex cursor-pointer list-none items-center gap-300 rounded-md py-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                <ChevronRight className="icon-size-200 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
                <span className="flex flex-col">
                    <span className="text-[length:var(--text-300)] leading-300 font-semibold text-foreground">More detail: {label}</span>
                    {hint && <span className={`${SMALL} text-muted-foreground`}>{hint}</span>}
                </span>
            </summary>
            {open && <div className="pb-400">{children}</div>}
        </details>
    );
}
