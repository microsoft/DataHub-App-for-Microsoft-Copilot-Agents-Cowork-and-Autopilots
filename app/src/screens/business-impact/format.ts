//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { Evidence, MeasureRead } from "./scenario";

export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const whole = (v: number) => v.toLocaleString("en-US");
export const num = (v: number, unit: string) => `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}${unit === "%" ? "%" : ` ${unit}`}`;
export const signed = (v: number, unit: string) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v), unit)}`;
/** Changes in a percentage are percentage points. */
export const delta = (v: number, unit: string) => signed(v, unit === "%" ? "pts" : unit);
export const money = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v < 10 ? 2 : 0 });

export const EVIDENCE_MEANING: Record<Evidence, string> = {
    Estimated: "DataHub's behaviour-based estimate. A planning figure.",
    Observed: "A before/after change in a process KPI. Not proof Copilot caused it. All values in this preview are synthetic.",
    Attributable: "A comparison-adjusted estimate with an interval, subject to study assumptions. Simulated here, not causal proof.",
};

export const READ_STYLE: Record<MeasureRead, string> = {
    Improved: "font-semibold text-primary",
    "Not conclusive": "text-muted-foreground",
    Held: "font-semibold",
    Worse: "font-semibold text-destructive",
};
