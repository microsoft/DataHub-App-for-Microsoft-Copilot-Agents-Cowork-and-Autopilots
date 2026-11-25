//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { runtimeConfig } from "@/lib/runtime-config";
import { isConnectionConfigured, type ModelReferences } from "@/lib/connections";

/** The ValueLens connection alias, as `queries/shared.ts` names it. */
export const VALUE_LENS = "vl";

/**
 * Whether this install has ValueLens and the Purview audit it reads. It is
 * an optional installer module: an install without it records
 * `modules.core: false` and leaves the `vl` model out, and the app then
 * hides every page that reads it. Installs from before it was optional, and
 * by-hand deploys with no `modules`, say nothing and keep it.
 */
export function valueLensOn(): boolean {
    const config = runtimeConfig();
    return Boolean(config.demo) || config.modules?.core !== false;
}

/**
 * Whether the cross-vendor view shows: chosen as an installer module, or
 * turned on for a build with `VITE_CROSS_VENDOR_DEMO=true`.
 */
export function crossVendorOn(): boolean {
    return import.meta.env.VITE_CROSS_VENDOR_DEMO === "true" || runtimeConfig().modules?.crossVendor === true;
}

/** A configured optional process model opts into live Business impact; the public demo never connects. */
export function businessImpactLive(models: ModelReferences = runtimeConfig().semanticModels): boolean {
    return !runtimeConfig().demo && isConnectionConfigured(models, "bi");
}

/** Separate, offline reference data for demo builds; never a fallback for a live model. */
export function outcomeSamplesOn(): boolean {
    return import.meta.env.VITE_BUSINESS_OUTCOME_SAMPLES === "true";
}

/**
 * Whether the GitHub Copilot mock-up shows: only in the synthetic browser
 * demo, built with `VITE_GITHUB_COPILOT_DEMO=true`, since it is generated from
 * the demo's people. No live GitHub source is connected yet.
 */
export function githubCopilotOn(): boolean {
    return import.meta.env.VITE_GITHUB_COPILOT_DEMO === "true" && Boolean(runtimeConfig().demo);
}

/**
 * Whether the Cloud and AI spend mock-up shows: only in a build made with
 * `VITE_FINOPS_DEMO=true`, the browser demo or a private demo app, where a
 * banner labels it invented. No cloud or AI provider is connected.
 */
export function finopsOn(): boolean {
    return import.meta.env.VITE_FINOPS_DEMO === "true";
}
