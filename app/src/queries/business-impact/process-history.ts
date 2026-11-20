//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { impactConnection, impactFilters } from "./process-scorecard";
import query from "./process-history.dax?raw";
import vegaLiteSpec from "./process-history.json";

const columnMetadata: ColumnMetadataMap = {
    "[Year]": { name: "Year", format: "0" },
    "[Process]": { name: "Process" },
    "[Items]": { name: "Items", format: "#,##0" },
};

export function processHistory() {
    return { connection: impactConnection, filters: impactFilters, query, columnMetadata, vegaLiteSpec };
}
