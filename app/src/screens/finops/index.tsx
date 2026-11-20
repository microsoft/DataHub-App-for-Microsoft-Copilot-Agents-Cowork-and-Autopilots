//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { StageId } from "@/components/destinations";
import { StageRun } from "@/components/stage-detail";
import { Allocation, Method, Trust } from "./govern";
import { Forecast, Rates, UnitEconomics } from "./plan";
import { ControlsProvider } from "./shared";
import { Explorer, Models, Portfolio, Summary } from "./spend";

/** One line for each detail row, so the closed row says what it holds. */
const FINOPS_HINTS: Partial<Record<StageId, string>> = {
    "fin-explorer": "What moved most in the latest 30 days, and which services make up the bill",
    "fin-models": "Cost per model, the token mix and the price of a million tokens",
    "fin-trust": "Feed freshness, what each provider's data supports, and invoice reconciliation",
    "fin-method": "Cost bases, source columns and the rules behind the figures",
};

/**
 * Cloud and AI spend across providers: a mock-up on invented data, shaped like a FOCUS cost
 * dashboard, so the chapters of the story can show what a cross-vendor spend layer would add.
 */
export function FinopsScreen() {
    const stages: [StageId, () => React.JSX.Element][] = [
        ["fin-summary", Summary], ["fin-portfolio", Portfolio], ["fin-explorer", Explorer], ["fin-models", Models], ["fin-unit", UnitEconomics],
        ["fin-rates", Rates], ["fin-forecast", Forecast], ["fin-allocation", Allocation], ["fin-trust", Trust], ["fin-method", Method],
    ];
    return (
        <ControlsProvider>
            <div className="flex flex-col gap-600">
                <StageRun stages={stages} hints={FINOPS_HINTS} />
            </div>
        </ControlsProvider>
    );
}
