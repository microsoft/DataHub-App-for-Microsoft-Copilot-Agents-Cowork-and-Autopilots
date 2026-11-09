//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useStageFilter } from "@/hooks/stage-filter.context";
import guideUrl from "@/assets/DataHub-App-Guide.pdf?url";
import { GlossaryStage } from "./glossary-stage";
import { GradingMethodStage } from "./grading-method-stage";
import { SignalImpactStage } from "./signal-impact-stage";

/**
 * Reference pages: the metric glossary, the signal-to-impact assumptions
 * behind the value estimates, and the rules Efficiency grades by. None reads
 * activity, so no filter applies.
 */
export function AppendixScreen() {
    const { show } = useStageFilter();
    return (
        <div className="flex flex-col gap-800">
            <p className="text-[length:var(--text-300)] leading-300 text-muted-foreground">
                <a
                    href={guideUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    How to read the DataHub App (PDF)
                    <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {" "}- a short guide to every page, its metrics and caveats.
            </p>
            {show("glossary") && <GlossaryStage />}
            {show("signal-impact") && <SignalImpactStage />}
            {show("grading-method") && <GradingMethodStage />}
        </div>
    );
}
