//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo } from "react";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { HEADLINE_SPACE, Headlined } from "@/components/headlined";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/query-states";
import { VegaVisual } from "@/components/vega-visual";
import { useOrgAttribute } from "@/hooks/filter.context";
import { useHueColors } from "@/hooks/use-palette-theme";
import { useThemeContext } from "@/hooks/theme.context";
import { useFilteredQuery, type FilteredQueryConfig } from "@/hooks/use-filtered-query";
import {
    EXPANSION_TIER_FALLBACKS,
    EXPANSION_TIER_MEANINGS,
    EXPANSION_TIER_VARS,
    EXPANSION_TIERS,
    expansionHeadline,
    expansionSpec,
    planExpansion,
    type ExpansionPlan,
} from "@/lib/expansion-map";
import { formatKpi } from "@/lib/format-kpi";
import { withOrgAttribute } from "@/lib/org-attribute";
import { toDataTable, type ColumnMetadataMap } from "@/lib/to-data-table";
import { topNote, topRows } from "@/lib/top-n";
import { BODY, SMALL } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 420;
/** Scores this close together barely separate teams, so size does the work. */
const TIGHT_SPREAD = 5;
/** Teams named in a tier before the rest are counted. */
const NAMED_PER_TIER = 4;
/** The tint behind each tier's row; slate has none, so Later stays plain. */
const TIER_TINTS = ["var(--vl-plum-tint)", "var(--vl-teal-tint)", "var(--vl-amber-tint)", undefined] as const;

export interface ExpansionMapViewProps {
    /** One row per team, named in an `Organization` column, already grouped by the chosen Group By. */
    table: DataTable;
    /** The score column and the people column. */
    fields: { score: string; people: string };
    titles: { score: string; people: string };
    /** What the people are, in the headline: "active unlicensed users". */
    unit: string;
    /** Extra tooltip rows, in d3 formats. */
    details: readonly { field: string; title: string; format: string }[];
    /** How the score is made, given the team noun: "organization". */
    method: (noun: string) => string;
    empty: { title: (team: { noun: string; plural: string }) => string; description: string };
    /** The chart's title, given the team noun. */
    title?: (noun: string) => string;
}

export interface ExpansionMapProps extends Omit<ExpansionMapViewProps, "table"> {
    /** The by-team query, grouped by Organization; the map regroups it by the chosen Group By. */
    query: () => FilteredQueryConfig & { columnMetadata: ColumnMetadataMap };
}

/**
 * Where to expand next: each team placed by how ready its people are and how
 * many there are, divided at the middle team on each axis into four tiers,
 * with the tiers listed beside the chart. Follows the Group By slicer.
 */
export function ExpansionMap({ query, ...view }: ExpansionMapProps) {
    const org = useOrgAttribute();
    const config = useMemo(() => withOrgAttribute(query(), org), [query, org]);
    const result = useFilteredQuery({
        connection: config.connection,
        query: config.query,
        columnMetadata: config.columnMetadata,
    });
    const table = useMemo(
        () => (result.data?.status === "success" ? toDataTable(result.data.table, config.columnMetadata) : undefined),
        [result.data, config.columnMetadata],
    );

    if (result.data?.status === "error") {
        return <QueryError className="h-[420px]" message={result.data.error.message} onRetry={result.refetch} />;
    }
    if (result.isLoading || !table) return <QueryLoading className="h-[420px]" />;
    return <ExpansionMapView table={table} {...view} />;
}

const expandTitle = (noun: string) => `Where to expand next, by ${noun}`;

/** The expansion map for a table already in hand. */
export function ExpansionMapView({ table, fields, titles, unit, details, method, empty, title = expandTitle }: ExpansionMapViewProps) {
    const { theme } = useThemeContext();
    const org = useOrgAttribute();
    const hues = useHueColors(EXPANSION_TIER_VARS);
    const colors = hues ?? EXPANSION_TIER_FALLBACKS;
    // The map shows the fifteen teams with the most people, so a large tenant stays readable.
    const top = useMemo(() => topRows(table, { label: "Organization", by: fields.people }), [table, fields.people]);
    const plan = useMemo(() => planExpansion(top.table, { label: "Organization", ...fields }), [top, fields]);
    const headline = expansionHeadline(plan, unit);
    const spec = useMemo(
        () =>
            expansionSpec(plan, {
                fields: { label: "Organization", ...fields },
                titles: { label: org.label, ...titles },
                details,
                colors,
            }),
        [plan, fields, titles, org.label, details, colors],
    );

    if (plan.teams.length === 0) {
        return <QueryEmpty className="h-[420px]" title={empty.title(org)} description={empty.description} />;
    }

    const note = topNote(top, org.plural, unit);
    const tight = plan.teams.length > 1 && plan.spread <= TIGHT_SPREAD;
    return (
        <div className="flex flex-col gap-300">
            <div className="grid items-start gap-400 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
                <div style={{ height: CHART_HEIGHT + (headline ? HEADLINE_SPACE : 0) }}>
                    <Headlined text={headline}>
                        <VegaVisual
                            label={title(org.noun)}
                            spec={spec}
                            data={plan.table}
                            theme={theme}
                            header={{
                                title: title(org.noun),
                                subtitle: note ?? `One bubble per ${org.noun}, sized by ${unit}`,
                            }}
                        />
                    </Headlined>
                </div>
                <TierBoard plan={plan} noun={org.noun} />
            </div>
            <p className={cn(SMALL, "max-w-[90ch] text-muted-foreground")}>
                {method(org.noun)} Dashed lines mark the middle {org.noun} on each axis.
                {tight &&
                    ` Scores sit within ${formatKpi(plan.spread, "whole")} points of each other, so team size does most of the separating.`}
            </p>
        </div>
    );
}

/** The four tiers in order, each with its teams and the people they hold. */
function TierBoard({ plan, noun }: { plan: ExpansionPlan; noun: string }) {
    return (
        <ol aria-label={`${noun} by expansion tier`} className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {EXPANSION_TIERS.map((tier, index) => {
                const teams = plan.teams.filter((team) => team.tier === tier);
                const people = teams.reduce((total, team) => total + team.people, 0);
                const lead = index === 0 && teams.length > 0;
                return (
                    <li
                        key={tier}
                        className="flex flex-col gap-200 px-400 py-300"
                        style={lead ? { backgroundColor: TIER_TINTS[index] } : undefined}
                    >
                        <div className="flex items-start gap-300">
                            <span
                                aria-hidden="true"
                                className="mt-[3px] size-300 shrink-0 rounded-sm"
                                style={{ backgroundColor: `var(${EXPANSION_TIER_VARS[index]}, ${EXPANSION_TIER_FALLBACKS[index]})` }}
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className={cn(BODY, "font-semibold text-card-foreground")}>{tier}</span>
                                <span className={cn(SMALL, "text-muted-foreground")}>{EXPANSION_TIER_MEANINGS[tier]}</span>
                            </span>
                            <span className={cn(BODY, "shrink-0 font-numeric tabular-nums text-card-foreground", lead && "font-semibold")}>
                                {formatKpi(people, "whole")}
                                <span className="sr-only"> people</span>
                            </span>
                        </div>
                        {teams.length === 0 ? (
                            <span className={cn(SMALL, "pl-[calc(var(--spacing-300)+var(--spacing-300))] text-muted-foreground")}>None</span>
                        ) : (
                            <ul className="flex flex-wrap gap-100 pl-[calc(var(--spacing-300)+var(--spacing-300))]">
                                {teams.slice(0, NAMED_PER_TIER).map((team) => (
                                    <li
                                        key={team.label}
                                        title={`${formatKpi(team.people, "whole")} people, score ${formatKpi(team.score, "whole")}`}
                                        className={cn(SMALL, "rounded-full bg-secondary px-200 py-[2px] text-secondary-foreground")}
                                    >
                                        {team.label}
                                    </li>
                                ))}
                                {teams.length > NAMED_PER_TIER && (
                                    <li className={cn(SMALL, "px-100 py-[2px] text-muted-foreground")}>
                                        +{teams.length - NAMED_PER_TIER} more
                                    </li>
                                )}
                            </ul>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
