//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { StageId } from "@/components/destinations";

export const IMPACT_HINTS: Partial<Record<StageId, string>> = {
    "impact-processes": "Each process measure before and after rollout, against a comparison group",
    "impact-connect": "Which role owns which process, and how that mapping is confirmed",
    "impact-cost": "AI cost per business transaction, process by process",
};
