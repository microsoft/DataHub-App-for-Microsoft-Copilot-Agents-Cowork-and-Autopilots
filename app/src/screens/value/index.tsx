//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useStageFilter } from "@/hooks/stage-filter.context";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { CommercialTermsProvider } from "@/components/commercial-terms-provider";
import { ValueAssumptionsProvider } from "@/components/value-assumptions-provider";
import { CONSUMPTION_CONFIGURED } from "./cost-vs-value-data";
import { CostVsValueStage } from "./cost-vs-value-stage";
import { SurfacesStage } from "./surfaces-stage";
import { TasksStage } from "./tasks-stage";
import { EstimatedValueStage } from "./estimated-value-stage";
import { ValueByHabitStage } from "./value-by-habit-stage";

/**
 * What the work was, read top to bottom: how much got done and what kind,
 * where it happened, what that recorded work would have cost under an
 * explicit rate and effort scenario, and how that sets against what Copilot
 * cost. The last two stages share one rate and scenario.
 */
/** Points from the estimate to the optional BPS module that tests it. Shown only in the preview build. */
function BusinessImpactNext() {
    return (
        <aside className="flex flex-col gap-200 rounded-xl border border-border bg-card p-500">
            <p className={cn(BODY, "font-semibold")}>Next: check the estimate against business outcomes</p>
            <p className={cn(SMALL, "text-muted-foreground")}>
                These figures are estimates from recorded AI work. The optional Business impact concept would compare this estimation approach with outcomes from BPS or D365, such as invoice posting-to-payment time, days sales outstanding and opportunity win rate, by functional persona. The preview uses separate synthetic cohorts: its figures are not measured results and do not reconcile to this page.
            </p>
            <a href="#/business-impact/impact-summary" className={cn(SMALL, "w-fit font-semibold text-primary underline-offset-4 hover:underline")}>Open Business impact (preview)</a>
        </aside>
    );
}

export function ValueScreen() {
    const { show } = useStageFilter();
    return (
        <CommercialTermsProvider readModel={CONSUMPTION_CONFIGURED}>
            <ValueAssumptionsProvider>
                <div className="flex flex-col gap-800">
                    {show("task-breakdown") && <TasksStage />}
                    {show("task-breakdown") && <SurfacesStage />}
                    {show("estimated-value") && <EstimatedValueStage />}
                    {show("value-by-habit") && <ValueByHabitStage />}
                    {show("cost-vs-value") && <CostVsValueStage />}
                    {import.meta.env.VITE_BUSINESS_IMPACT_DEMO === "true" && <BusinessImpactNext />}
                </div>
            </ValueAssumptionsProvider>
        </CommercialTermsProvider>
    );
}
