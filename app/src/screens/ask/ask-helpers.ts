//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { askCatalogue } from "@/ask/catalogue";
import type { DestinationId } from "@/components/destinations";
import type { AskRun } from "@/lib/ask-api";

export interface SuggestedPage {
    destination: DestinationId;
    label: string;
    questions: string[];
}

/**
 * Questions for a data agent that has the Business impact process model as a source. The shared
 * catalogue leaves them out because the installer's agent never has that model.
 */
export const BUSINESS_IMPACT_QUESTIONS: readonly string[] = [
    "Which SAP process has the highest exception rate?",
    "How long do payables take to clear, and what share are blocked?",
    "What share of customer items are collected late?",
    "What share of purchase order items reference a contract?",
];

/**
 * The catalogue's suggested questions for the pages this install shows, in sidebar order, plus
 * any `extra` questions a page's own source adds.
 */
export function suggestedPages(
    available: readonly { id: DestinationId; label: string }[],
    extra: Partial<Record<DestinationId, readonly string[]>> = {},
): SuggestedPage[] {
    const byId = new Map(askCatalogue.pages.map((page) => [page.destination, page.questions]));
    return available.flatMap(({ id, label }) => {
        const questions = [...(byId.get(id) ?? []), ...(extra[id] ?? [])];
        return questions.length ? [{ destination: id, label, questions }] : [];
    });
}

/** "12 rows · 3 left out for fewer than 5 people · 2025-07-01 to 2025-09-30 · Finance, Sales". */
export function runSummary(run: AskRun): string {
    if (run.error) return `Failed: ${run.error}`;
    const parts: string[] = [];
    if (typeof run.rowCount === "number") parts.push(`${run.rowCount} ${run.rowCount === 1 ? "row" : "rows"}`);
    if (run.suppressed) parts.push(`${run.suppressed} left out for fewer than ${askCatalogue.minPeople} people`);
    if (run.truncated) parts.push("only the first rows were read");
    const { from, to, organizations } = run.filters ?? {};
    if (from || to) parts.push(`${from && from !== "1900-01-01" ? from : "the start"} to ${to && to !== "9999-12-31" ? to : "the latest"}`);
    if (organizations?.length) parts.push(organizations.join(", "));
    return parts.join(" · ");
}
