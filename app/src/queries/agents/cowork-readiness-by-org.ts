//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { connection, FORMAT_PERCENT, FORMAT_RATE, FORMAT_WHOLE } from "../shared";
import query from "./cowork-readiness-by-org.dax?raw";

const columnMetadata: ColumnMetadataMap = {
    "[Organization]": { name: "Organization", displayName: "Organization" },
    "[Eligible Users]": { name: "Eligible Users", displayName: "Eligible users", format: FORMAT_WHOLE },
    "[Readiness Score]": { name: "Readiness Score", displayName: "Readiness score", format: FORMAT_WHOLE },
    "[Surfaces Per Day]": { name: "Surfaces Per Day", displayName: "Apps per active day", format: FORMAT_RATE },
    "[Prompts Per Session]": {
        name: "Prompts Per Session",
        displayName: "Prompts per session",
        format: FORMAT_RATE,
    },
    "[Agent User Share]": {
        name: "Agent User Share",
        displayName: "% already using agents",
        format: FORMAT_PERCENT,
    },
};

/**
 * Cowork readiness per organization, for the expansion map: how many people
 * could be offered Cowork, and their mean readiness score (45% breadth of
 * everyday use, 35% depth, 20% agent use), each person scored against
 * everyone yet to try Cowork in the selection.
 */
export function coworkReadinessByOrg() {
    return { connection, query, columnMetadata };
}
