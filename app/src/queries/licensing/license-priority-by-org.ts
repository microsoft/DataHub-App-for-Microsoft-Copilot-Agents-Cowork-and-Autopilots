//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { connection, FORMAT_RATE, FORMAT_WHOLE } from "../shared";
import query from "./license-priority-by-org.dax?raw";

const columnMetadata: ColumnMetadataMap = {
    "[Organization]": { name: "Organization", displayName: "Organization" },
    "[Active Unlicensed Users]": {
        name: "Active Unlicensed Users",
        displayName: "Active unlicensed users",
        format: FORMAT_WHOLE,
    },
    "[Priority Score]": { name: "Priority Score", displayName: "Priority score", format: FORMAT_WHOLE },
    "[Active Days Per Week]": {
        name: "Active Days Per Week",
        displayName: "Active days per week",
        format: FORMAT_RATE,
    },
    "[Sessions Per User Per Week]": {
        name: "Sessions Per User Per Week",
        displayName: "Sessions per user per week",
        format: FORMAT_RATE,
    },
};

/**
 * Unlicensed demand per organization, for the expansion map: how many active
 * unlicensed people each has, and the model's priority score for its median
 * unlicensed user (60% how much they use Copilot, 40% how often).
 */
export function licensePriorityByOrg() {
    return { connection, query, columnMetadata };
}
