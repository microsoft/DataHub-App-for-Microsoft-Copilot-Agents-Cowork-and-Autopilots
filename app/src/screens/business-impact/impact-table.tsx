//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from "react";
import { SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

export function ImpactTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: ReactNode[][] }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className={cn(SMALL, "w-full text-left")}>
                <caption className="p-400 text-left text-muted-foreground">{caption}</caption>
                <thead className="bg-muted text-muted-foreground"><tr>{headers.map(h => <th scope="col" key={h} className="p-400 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{rows.map((cells, i) => <tr key={i} className="border-t border-border">{cells.map((c, j) => <td key={j} className="p-400 align-top">{c}</td>)}</tr>)}</tbody>
            </table>
        </div>
    );
}
