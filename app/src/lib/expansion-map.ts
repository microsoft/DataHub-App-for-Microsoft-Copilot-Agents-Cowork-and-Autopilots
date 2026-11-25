//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { formatKpi } from "@/lib/format-kpi";

/** Where a team sits on the expansion map, readiest and largest first. */
export const EXPANSION_TIERS = ["Expand next", "Quick wins", "Build habits first", "Later"] as const;
export type ExpansionTier = (typeof EXPANSION_TIERS)[number];

/** What each tier means, in the order of {@link EXPANSION_TIERS}. */
export const EXPANSION_TIER_MEANINGS: Readonly<Record<ExpansionTier, string>> = {
    "Expand next": "Ready, with the most people to reach",
    "Quick wins": "Ready, in smaller teams",
    "Build habits first": "Many people, still building the habit",
    Later: "Fewer people, less ready",
};

/** Each tier's `--vl-*` hue, in the order of {@link EXPANSION_TIERS}. */
export const EXPANSION_TIER_VARS = ["--vl-plum", "--vl-teal", "--vl-amber", "--vl-slate"] as const;

/** The light theme's tier hues, for when the palette can't be read. */
export const EXPANSION_TIER_FALLBACKS = ["#7f215d", "#09b39d", "#f1963a", "#8793a3"] as const;

/** The columns the plan adds to each kept row, for the chart to read. */
export const TIER_COLUMN = "Tier";
const LABEL_DX = "Label Dx";
const LABEL_ALIGN = "Label Align";
const LABELLED = "Labelled";

/** At most this many bubbles carry a name; the rest have a tooltip. */
const MAX_LABELS = 8;
/** Bubble areas, in square pixels, for no people and the largest team. */
const SIZE_RANGE = [80, 900] as const;
/** A score axis narrower than this reads small differences as big ones. */
const MIN_SCORE_SPAN = 10;
/** Past this share of the score axis, a bubble's name goes on its left so it stays in the plot. */
const LABEL_FLIP_AT = 0.6;
/** A typical plot, in pixels, for judging whether names would collide before the chart is sized. */
const NOMINAL_PLOT = { width: 640, height: 320 } as const;
/** The name's font: rough width per character, and line height, in pixels. */
const LABEL_CHAR_WIDTH = 6.2;
const LABEL_HEIGHT = 14;

export interface ExpansionFields {
    /** The column that names each team. */
    label: string;
    /** The 0–100 readiness or priority score. */
    score: string;
    /** How many people the team could reach. */
    people: string;
}

export interface ExpansionTeam {
    label: string;
    score: number;
    people: number;
    tier: ExpansionTier;
}

export interface ExpansionPlan {
    /** Kept teams, by tier, then most people first, then name. */
    teams: ExpansionTeam[];
    /** The middle team's score: at or above it is ready. */
    scoreMid: number;
    /** The middle team's people: at or above it is large. */
    peopleMid: number;
    /** Highest score less lowest. */
    spread: number;
    /** The score axis: padded, at least {@link MIN_SCORE_SPAN} points, inside 0–100. */
    scoreDomain: [number, number];
    /** The most people in any team. */
    peopleMax: number;
    /** The kept rows, with the tier and label placement the chart reads. */
    table: DataTable;
}

function finite(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** The middle value, averaging the two middle ones when the count is even. */
export function middle(values: readonly number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
}

function tierOf(score: number, people: number, scoreMid: number, peopleMid: number): ExpansionTier {
    const ready = score >= scoreMid;
    const large = people >= peopleMid;
    return ready ? (large ? "Expand next" : "Quick wins") : large ? "Build habits first" : "Later";
}

/** The score axis around the scores shown, never tighter than {@link MIN_SCORE_SPAN} points. */
export function scoreDomain(scores: readonly number[]): [number, number] {
    const low = Math.min(...scores);
    const high = Math.max(...scores);
    const pad = Math.max(1, (high - low) * 0.1);
    let from = low - pad;
    let to = high + pad;
    if (to - from < MIN_SCORE_SPAN) {
        const centre = (low + high) / 2;
        from = centre - MIN_SCORE_SPAN / 2;
        to = centre + MIN_SCORE_SPAN / 2;
    }
    if (from < 0) [from, to] = [0, to - from];
    if (to > 100) [from, to] = [Math.max(0, from - (to - 100)), 100];
    return [from, to];
}

/** A bubble's area for its people, matching the chart's size scale. */
function bubbleArea(people: number, peopleMax: number): number {
    return SIZE_RANGE[0] + ((SIZE_RANGE[1] - SIZE_RANGE[0]) * people) / peopleMax;
}

/**
 * Places each team on the map: ready when its score is at or above the middle
 * team's, large when its people are. Rows without a score, or with nobody to
 * reach, are left out. Returns no teams when the table lacks a column.
 */
export function planExpansion(table: DataTable, fields: ExpansionFields): ExpansionPlan {
    const at = (name: string) => table.columns.findIndex((column) => column.name === name);
    const labelAt = at(fields.label);
    const scoreAt = at(fields.score);
    const peopleAt = at(fields.people);
    const none: ExpansionPlan = {
        teams: [],
        scoreMid: 0,
        peopleMid: 0,
        spread: 0,
        scoreDomain: [0, 100],
        peopleMax: 0,
        table: { ...table, rows: [] },
    };
    if (table.rows.length === 0) return none;
    if (labelAt < 0 || scoreAt < 0 || peopleAt < 0) {
        const missing = [fields.label, fields.score, fields.people].find((name) => at(name) < 0);
        console.warn(`[expansion-map] Column "${missing}" was not found, so no teams are placed.`);
        return none;
    }

    const kept = table.rows.flatMap((row) => {
        const score = finite(row[scoreAt]);
        const people = finite(row[peopleAt]);
        return score === undefined || people === undefined || people <= 0
            ? []
            : [{ row, label: String(row[labelAt] ?? ""), score, people }];
    });
    if (kept.length === 0) return none;

    const scores = kept.map((entry) => entry.score);
    const scoreMid = middle(scores);
    const peopleMid = middle(kept.map((entry) => entry.people));
    const peopleMax = Math.max(...kept.map((entry) => entry.people));
    const domain = scoreDomain(scores);
    const spots = kept.map((entry) => {
        const along = (entry.score - domain[0]) / (domain[1] - domain[0]);
        const radius = Math.sqrt(bubbleArea(entry.people, peopleMax) / Math.PI);
        const flip = along > LABEL_FLIP_AT;
        const x = along * NOMINAL_PLOT.width;
        const y = (1 - entry.people / (peopleMax * 1.15)) * NOMINAL_PLOT.height;
        const width = entry.label.length * LABEL_CHAR_WIDTH;
        const left = flip ? x - radius - 4 - width : x + radius + 4;
        const box = { left, right: left + width, top: y - LABEL_HEIGHT / 2, bottom: y + LABEL_HEIGHT / 2 };
        return { entry, x, y, radius, flip, box };
    });
    const labelled = pickLabels(spots, peopleMid);

    const placed = spots.map(({ entry, radius, flip }) => {
        const tier = tierOf(entry.score, entry.people, scoreMid, peopleMid);
        const row = [...entry.row, tier, flip ? -(radius + 4) : radius + 4, flip ? "right" : "left", labelled.has(entry)];
        return { ...entry, tier, row };
    });
    placed.sort(
        (a, b) =>
            EXPANSION_TIERS.indexOf(a.tier) - EXPANSION_TIERS.indexOf(b.tier) ||
            b.people - a.people ||
            a.label.localeCompare(b.label),
    );

    return {
        teams: placed.map(({ label, score, people, tier }) => ({ label, score, people, tier })),
        scoreMid,
        peopleMid,
        spread: Math.max(...scores) - Math.min(...scores),
        scoreDomain: domain,
        peopleMax,
        table: {
            ...table,
            columns: [
                ...table.columns,
                { name: TIER_COLUMN, displayName: "Where it sits" },
                { name: LABEL_DX },
                { name: LABEL_ALIGN },
                { name: LABELLED },
            ],
            rows: placed.map((entry) => entry.row),
        },
    };
}

interface Box {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

function overlaps(a: Box, b: Box): boolean {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * The larger teams whose names fit: most people first, skipping a name that
 * would land on one already placed or on another team's bubble.
 */
function pickLabels<T extends { people: number; label: string }>(
    spots: readonly { entry: T; x: number; y: number; radius: number; box: Box }[],
    peopleMid: number,
): Set<T> {
    const chosen = new Set<T>();
    const boxes: Box[] = [];
    const candidates = spots
        .filter((spot) => spot.entry.people >= peopleMid)
        .sort((a, b) => b.entry.people - a.entry.people || a.entry.label.localeCompare(b.entry.label));
    for (const spot of candidates) {
        if (chosen.size === MAX_LABELS) break;
        const onBubble = spots.some((other) => {
            if (other === spot) return false;
            // Most of a bubble, not its full square, so a name may graze its edge.
            const reach = other.radius * 0.7;
            return overlaps(spot.box, { left: other.x - reach, right: other.x + reach, top: other.y - reach, bottom: other.y + reach });
        });
        if (onBubble || boxes.some((box) => overlaps(spot.box, box))) continue;
        chosen.add(spot.entry);
        boxes.push(spot.box);
    }
    return chosen;
}

/** "A", "A and B", "A, B and C", or "A, B and 3 more". */
function nameList(names: readonly string[]): string {
    if (names.length <= 1) return names[0] ?? "";
    if (names.length <= 3) return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/**
 * The map's one-sentence headline: the teams to expand to next, or the quick
 * wins when none is both ready and large. Nothing when every team sits in one
 * tier, since then nothing separates them.
 */
export function expansionHeadline(plan: ExpansionPlan, unit: string): string | undefined {
    if (new Set(plan.teams.map((team) => team.tier)).size < 2) return undefined;
    for (const [tier, lead] of [
        ["Expand next", "Expand next"],
        ["Quick wins", "Start with quick wins"],
    ] as const) {
        const teams = plan.teams.filter((team) => team.tier === tier);
        if (teams.length === 0) continue;
        const people = teams.reduce((total, team) => total + team.people, 0);
        return `${lead}: ${nameList(teams.map((team) => team.label))} (${formatKpi(people, "whole")} ${unit})`;
    }
    return undefined;
}

export interface ExpansionSpecOptions {
    fields: ExpansionFields;
    titles: { label: string; score: string; people: string };
    /** Extra tooltip rows, after the score and people. */
    details?: readonly { field: string; title: string; format: string }[];
    /** Tier fills in the order of {@link EXPANSION_TIERS}. */
    colors: readonly string[];
}

/** One mark drawn once, whatever the row count. */
const ONCE = [{ aggregate: [{ op: "count", as: "Teams" }] }];
const RULE_COLOR = "#8a8886";
// Matches the card surface, so a name stays legible where it crosses a middle line.
const HALO_COLOR = "#ffffff";

/**
 * Score across, people up, one bubble per team sized by its people and
 * coloured by its tier, with the middle team's lines dividing the tiers and
 * the expand-next corner tinted.
 */
export function expansionSpec(plan: ExpansionPlan, options: ExpansionSpecOptions): VisualizationSpec {
    const { fields, titles, colors } = options;
    const xAxis = { format: ",.0f", tickMinStep: 1, tickCount: 6 };
    const yAxis = { format: ",.0f", tickMinStep: 1, tickCount: 5 };
    // Every layer shares one scale each way, so none can round the score domain out.
    const x = {
        type: "quantitative",
        title: titles.score,
        axis: xAxis,
        scale: { domain: plan.scoreDomain, nice: false, zero: false },
    };
    const y = {
        type: "quantitative",
        title: titles.people,
        axis: yAxis,
        scale: { domain: [0, plan.peopleMax * 1.15], zero: true },
    };
    const corner = (tier: ExpansionTier, right: boolean, top: boolean) => ({
        transform: ONCE,
        mark: {
            type: "text",
            text: tier,
            align: right ? "right" : "left",
            baseline: top ? "top" : "bottom",
            dx: right ? -6 : 6,
            dy: top ? 6 : -6,
            fontSize: 10,
            fontWeight: 600,
            color: colors[EXPANSION_TIERS.indexOf(tier)],
        },
        encoding: { x: { value: right ? "width" : 0 }, y: { value: top ? 0 : "height" } },
    });

    const label = {
        transform: [{ filter: `datum['${LABELLED}'] === true` }],
        mark: {
            type: "text",
            baseline: "middle",
            fontSize: 11,
            limit: 140,
            align: { expr: `datum['${LABEL_ALIGN}']` },
            dx: { expr: `datum['${LABEL_DX}']` },
        },
        encoding: {
            x: { ...x, field: fields.score },
            y: { ...y, field: fields.people },
            text: { field: fields.label, type: "nominal" },
        },
    };

    return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: "container",
        height: "container",
        layer: [
            {
                transform: ONCE,
                mark: { type: "rect", color: colors[0], opacity: 0.08, strokeWidth: 0 },
                encoding: {
                    x: { ...x, datum: plan.scoreMid },
                    x2: { datum: plan.scoreDomain[1] },
                    y: { ...y, datum: plan.peopleMax * 1.15 },
                    y2: { datum: plan.peopleMid },
                },
            },
            {
                transform: ONCE,
                mark: { type: "rule", strokeDash: [4, 3], color: RULE_COLOR },
                encoding: { x: { ...x, datum: plan.scoreMid } },
            },
            {
                transform: ONCE,
                mark: { type: "rule", strokeDash: [4, 3], color: RULE_COLOR },
                encoding: { y: { ...y, datum: plan.peopleMid } },
            },
            corner("Expand next", true, true),
            corner("Build habits first", false, true),
            corner("Quick wins", true, false),
            corner("Later", false, false),
            {
                mark: { type: "circle", opacity: 0.85 },
                encoding: {
                    x: { ...x, field: fields.score },
                    y: { ...y, field: fields.people },
                    size: {
                        field: fields.people,
                        type: "quantitative",
                        legend: null,
                        scale: { domain: [0, plan.peopleMax], range: [...SIZE_RANGE] },
                    },
                    color: {
                        field: TIER_COLUMN,
                        type: "nominal",
                        legend: null,
                        scale: { domain: [...EXPANSION_TIERS], range: [...colors] },
                    },
                    tooltip: [
                        { field: fields.label, type: "nominal", title: titles.label },
                        { field: TIER_COLUMN, type: "nominal", title: "Where it sits" },
                        { field: fields.score, type: "quantitative", title: titles.score, format: ",.0f" },
                        { field: fields.people, type: "quantitative", title: titles.people, format: ",.0f" },
                        ...(options.details ?? []).map((detail) => ({ ...detail, type: "quantitative" })),
                    ],
                },
            },
            {
                ...label,
                mark: { ...label.mark, fill: HALO_COLOR, stroke: HALO_COLOR, strokeWidth: 3, strokeJoin: "round", aria: false },
            },
            label,
        ],
    } as unknown as VisualizationSpec;
}
