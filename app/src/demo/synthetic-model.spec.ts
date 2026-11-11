import { describe, expect, it } from "vitest";
import { applyDaxFilters, dateBetween, treatAs } from "@/lib/dax-filters";
import { executiveSummary } from "@/queries/executive/executive-summary";
import { valueByTask, toValueTaskTree } from "@/queries/value/value-by-task";
import { coworkCreditsSummary } from "@/queries/consumption/cowork";
import { studioCreditsSummary, studioAgents, studioUsers } from "@/queries/consumption/studio";
import { filterOptions, toFilterOptions } from "@/queries/filters/filter-options";
import { coworkByGroup } from "@/queries/consumption/cowork";
import { taskBreakdown } from "@/queries/work/task-breakdown";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { toDataTable } from "@/lib/to-data-table";
import { syntheticQueryResult } from "./synthetic-model";
import { samples, selectedActivity, hours, sum, sessions, firstDate, lastDate } from "./sample-data";
import { sampleConsumptionRows } from "./sample-consumption";
import { withTaskTimes } from "@/queries/assumptions/task-times";
import { describeOrgAttribute, orgValueFilter, withOrgAttribute } from "@/lib/org-attribute";
import { glossary, signalImpact } from "@/queries/appendix";
import { coworkCandidates, coworkReadinessSummary, coworkReadinessByOrg } from "@/queries/agents";
import { activationSummary, activationByOrg } from "@/queries/adoption";
import { workSummary } from "@/queries/work";

type Query = { query: string; columnMetadata?: ColumnMetadataMap };
function answer(source: Query, filters: string[] = []) {
    const result = syntheticQueryResult(applyDaxFilters(source.query, filters), source.columnMetadata);
    expect(result.status, JSON.stringify(result)).toBe("success");
    if (result.status !== "success") throw Error(result.error.message);
    return result.table;
}
const objects = (source: Query, filters: string[] = []) => {
    const table = answer(source, filters);
    return table.rows.map(row => Object.fromEntries(table.columns.map((column, i) => [column.name.replace(/^.*\[/, "").replace(/\]$/, ""), row[i]])));
};

describe("published synthetic sample adapter", () => {
    it("uses the existing Cowork tasks and users for the new cohort cards and user-ID grouping", () => {
        const filter = treatAs("'Chat + Agent Interactions (Audit Logs)'[Agent Filter (Normalized)]", ["Cowork"]);
        const cowork = samples.activity.filter(row => row.cowork);
        const users = new Set(cowork.map(row => row.user)).size;
        const work = objects(workSummary(), [filter])[0];
        expect(work["Cowork Tasks"]).toBe(cowork.filter(row => row.prompt).length);
        expect(work["Cowork Users"]).toBe(users);
        expect(work["Cowork Rate"]).toBe(Number(work["Cowork Tasks"]) / users);
        expect(work["All Tasks"]).toBe(work["Cowork Tasks"]);
        expect(work["Agent Tasks"]).toBe(0);
        const activation = objects(activationSummary(), [filter])[0];
        expect(activation["Cowork Active"]).toBe(users);
        expect(activation["Cowork Active Pct"]).toBe(1);
        const source = withOrgAttribute(activationByOrg({ cohort: "cowork" }), describeOrgAttribute("PersonId_Normalized"));
        const grouped = objects(source, [filter]);
        expect(grouped.every(row => samples.people.some(person => person.user === row.Value))).toBe(true);
        expect(sum(grouped, row => Number(row["Cowork Active"]))).toBe(users);
        const person = cowork[0].user;
        const single = objects(workSummary(), [filter, orgValueFilter("PersonId_Normalized", [person])])[0];
        expect(single["Cowork Users"]).toBe(1);
        expect(single["Cowork Tasks"]).toBe(cowork.filter(row => row.user === person && row.prompt).length);
    });

    it("ranks only licensed candidates before normalization and counts without narrowing readiness summaries", () => {
        const original = samples.activity;
        const base = original.find(row => !row.cowork && row.prompt && row.observed)!;
        const [first, second, outlier] = samples.people;
        const row = (user: string, app: string, message: string, licensed: boolean) => ({
            ...base, user, app, message, thread: app, licensed, audience: "Copilot", cowork: false,
        });
        samples.activity = [
            row(first.user, "App A", "first", true),
            row(first.user, "App A", "second", false),
            row(first.user, "App B", "third", false),
            row(second.user, "App A", "fourth", true),
            ...Array.from({ length: 18 }, (_, i) => row(outlier.user, `App ${Math.floor(i / 3)}`, `outlier-${i}`, false)),
        ];
        try {
            const ranked = objects(coworkCandidates());
            expect(ranked.map(entry => entry.User)).toEqual([first.user, second.user]);
            expect(ranked.map(entry => entry.Rank)).toEqual([1, 2]);
            expect(ranked.every(entry => entry.Total === 2 && entry.Depths === 2)).toBe(true);
            expect(ranked[0]["Surfaces Per Day"]).toBe(2);
            expect(ranked[0]["Prompts Per Session"]).toBe(1.5);
            expect(objects(coworkReadinessSummary())[0]["Eligible Users"]).toBe(3);
            expect(sum(objects(coworkReadinessByOrg()), entry => Number(entry["Eligible Users"]))).toBe(3);
            samples.activity = samples.activity.filter(entry => entry.user !== outlier.user);
            expect(objects(coworkCandidates())).toEqual(ranked);
            samples.activity = samples.activity.map(entry => ({ ...entry, licensed: false }));
            expect(objects(coworkCandidates())).toEqual([]);
            expect(objects(coworkReadinessSummary())[0]["Eligible Users"]).toBe(2);
        } finally {
            samples.activity = original;
        }
    });

    it("preserves the published row count, people and unshifted dates", () => {
        expect(samples.activity).toHaveLength(13337);
        expect(samples.people).toHaveLength(170);
        expect(samples.provenance.inputActivityRows).toBe(samples.provenance.outputActivityRows);
        expect([firstDate, lastDate]).toEqual(["2026-06-01", "2026-08-31"]);
        expect(samples.provenance.files["samples/copilot_interactions_sample.csv"]).toMatch(/^[a-f0-9]{64}$/);
        const summary = objects(executiveSummary())[0];
        expect(summary.Tasks).toBe(13337);
        expect(summary.People).toBe(new Set(samples.activity.map(row => row.user)).size);
        expect(summary.Hours).toBeCloseTo(2476.65, 8);
    });

    it("filters actual rows instead of hashing query text", () => {
        const source = executiveSummary();
        const org = samples.people[0].org;
        const filter = treatAs("'Chat + Agent Org Data'[Organization]", [org]);
        const selected = selectedActivity(filter);
        expect(objects(source, [filter])[0].Tasks).toBe(selected.length);
        expect(selected.length).toBeLessThan(samples.activity.length);
        const june = objects(source, [dateBetween("'Calendar'[Date]", "2026-06-01", "2026-06-30")])[0];
        expect(june.Tasks).toBe(3414);
        expect(objects(source, [treatAs("'Chat + Agent Interactions (Audit Logs)'[Environment]", ["Unlicensed"])])[0].Tasks)
            .toBe(samples.activity.filter(row => !row.licensed).length);
        expect(objects({ ...source, query: `${source.query}\n// a comment cannot change the data` })).toEqual(objects(source));
        expect(objects(source, [treatAs("'Chat + Agent Org Data'[Organization]", ["not-a-source-group"])])[0].Tasks).toBe(0);
    });
    it("supplies the filter provider's real date and activity contracts", () => {
        const options = toFilterOptions(answer(filterOptions()));
        expect([options.firstDate, options.lastDate]).toEqual([firstDate, lastDate]);
        expect(options.activities).toEqual(expect.arrayContaining(["Copilot", "Agents", "Cowork"]));
        expect(options.agentNames.length).toBeGreaterThan(10);
        expect(options.largeTenant).toBe(false);
    });
    it("applies the app's bridge-based organization and country filters", () => {
        expect(objects(executiveSummary(), [orgValueFilter("Organization", ["Finance"])])[0].Tasks)
            .toBe(selectedActivity(treatAs("'Chat + Agent Org Data'[Organization]", ["Finance"])).length);
        const country = samples.people[0].country;
        const source = withOrgAttribute(executiveSummary(), describeOrgAttribute("country"));
        expect(objects(source, [orgValueFilter("country", [country])])[0].Tasks)
            .toBe(samples.activity.filter(row => samples.people.some(person => person.user === row.user && person.country === country)).length);
    });
    it("supplies all task-breakdown tabs from source classifications", () => {
        const rows = objects(taskBreakdown());
        expect(new Set(rows.map(row => row.Dimension))).toEqual(new Set(["Behaviour", "Workflow action", "Value outcome"]));
        for (const dimension of ["Behaviour", "Workflow action", "Value outcome"]) {
            const values = rows.filter(row => row.Dimension === dimension);
            expect(sum(values, row => Number(row.Tasks))).toBe(13337);
            expect(sum(values, row => Number(row.Share))).toBeCloseTo(1);
        }
    });
    it("keeps Cowork cards, table totals and allowance denominators coherent", () => {
        const summary = objects(coworkCreditsSummary())[0];
        const table = objects(coworkByGroup());
        const grand = table.find(row => row["Is Grand Total"]);
        expect(grand?.["Credits Used"]).toBeCloseTo(Number(summary["Credits Used"]), 8);
        expect(grand?.["Allowance Used"]).toBeCloseTo(Number(summary["Allowance Used"]), 8);
        expect(table.filter(row => !row["Is Group Total"]).length).toBe(summary["Consuming Users"]);
    });

    it("reconciles licensed and unlicensed task filters and distinct sessions", () => {
        const all = samples.activity.length;
        expect(selectedActivity(treatAs("'Chat + Agent Interactions (Audit Logs)'[Environment]", ["Licensed"])).length
            + selectedActivity(treatAs("'Chat + Agent Interactions (Audit Logs)'[Environment]", ["Unlicensed"])).length).toBe(all);
        expect(sessions(samples.activity).length).toBe(new Set(samples.activity.map(row => `${row.user}|${row.app}|${row.thread}`)).size);
        expect(hours(samples.activity, "", "Conservative")).toBeLessThan(hours(samples.activity, "", "Typical"));
        expect(hours(samples.activity, "", "Optimistic")).toBeGreaterThan(hours(samples.activity, "", "Typical"));
    });

    it("returns valid value rollups without counting the grand total as a person", () => {
        const source = valueByTask();
        const table = answer(source);
        const tree = toValueTaskTree(toDataTable(table, source.columnMetadata));
        expect(tree.rows.length).toBeGreaterThan(0);
        const rows = objects(source);
        const grand = rows.find(row => row["Is Grand Total"]);
        expect(grand?.["Is Group Total"]).toBe(true);
        expect(Number(grand?.["Expert Equivalent Hours Per Week"])).toBeGreaterThan(0);
    });

    it("uses the source totals, not the unreconciled live screenshot", () => {
        expect(objects(coworkCreditsSummary(), [treatAs("'Cowork Period'[Period]", ["All history (9 weeks)"])])[0]["Credits Used"]).toBeCloseTo(44750.8531, 4);
        expect(objects(studioCreditsSummary())[0]["Credits Consumed"]).toBe(117472);
        const snapshot = sum(samples.consumption.StudioPerUser, row => Number(row["Credits used"]));
        expect(snapshot).toBe(117475);
        expect(snapshot).not.toBe(objects(studioCreditsSummary())[0]["Credits Consumed"]);
        expect(objects(studioCreditsSummary())[0]["Snapshot Note"]).toMatch(/separate undated snapshots/);
        const tenantCredits = 117472 + 44750.8531;
        expect(tenantCredits).not.toBeCloseTo(153300, 0);
    });

    const modules = import.meta.glob<Record<string, unknown>>([
        "../queries/{adoption,agents,efficiency,value,work,feedback,consumption,executive,appendix,filters}/*.ts",
        "!../queries/**/*.spec.ts", "!../queries/**/*.fixture.ts",
    ], { eager: true });
    const queries: [string, Query][] = [];
    for (const [path, module] of Object.entries(modules)) {
        for (const [name, factory] of Object.entries(module)) {
            if (typeof factory !== "function" || factory.length !== 0) continue;
            const source: unknown = factory();
            if (!source || typeof source !== "object" || !("query" in source) || typeof source.query !== "string") continue;
            const query = source as Query;
            if (!queries.some(([, previous]) => previous.query === query.query)) queries.push([`${path}: ${name}`, query]);
        }
    }

    describe("native query contracts", () => {
        it("covers the real app's source-backed factories", () => expect(queries.length).toBeGreaterThan(60));
        it.each(queries)("handles %s without schema guessing", (_path, source) => {
            const answer = syntheticQueryResult(source.query, source.columnMetadata);
            expect(answer.status, JSON.stringify(answer)).toBe("success");
            if (answer.status !== "success") return;
            expect(answer.table.columns.length).toBeGreaterThan(0);
            expect(answer.table.rows.every(row => row.length === answer.table.columns.length)).toBe(true);
            expect(answer.table.rows.flat().every(value => typeof value !== "number" || Number.isFinite(value))).toBe(true);
        });
    });

    it("reconciles Studio agent totals with the user snapshot and preserves list metadata", () => {
        const agents = objects(studioAgents());
        expect(sum(agents, row => Number(row["Credits Used"]))).toBe(117475);
        expect(sum(agents, row => Number(row["Credit Share"]))).toBeCloseTo(1);
        const users = objects(studioUsers());
        const leaves = users.filter(row => !row["Is Group Total"]);
        expect(leaves.length).toBeGreaterThan(5);
        expect(leaves.every(row => row.Total === leaves.length)).toBe(true);
        expect(users.find(row => row["Is Grand Total"])?.["Credits Used"]).toBe(117475);
    });

    it("applies native consumption period and service selections", () => {
        const source = coworkCreditsSummary();
        const all = Number(objects(source, [treatAs("'Cowork Period'[Period]", ["All history (9 weeks)"])])[0]["Credits Used"]);
        const narrow = Number(objects(source, [treatAs("'Cowork Period'[Period]", ["Current period (4 weeks)"])])[0]["Credits Used"]);
        expect(narrow).toBeGreaterThan(0);
        expect(narrow).toBeLessThan(all);
        const studio = Number(objects(studioCreditsSummary(), [treatAs("'Studio Period'[Period]", ["Last 7 days"])])[0]["Credits Consumed"]);
        expect(studio).toBeGreaterThan(0);
        expect(studio).toBeLessThan(117472);
        expect(sampleConsumptionRows("EVALUATE ROW()", ["[Credit Rate]", "[Prepaid Credit Balance]"])?.[0]).toEqual([0.0092, 250000]);
    });
    it("uses the selected Azure cost basis for every component of its summary", () => {
        const rows = samples.consumption.AzureSolutionSpend;
        const total = sum(rows, row => Number(row.AmortizedCost));
        const model = sum(rows.filter(row => row.ServiceCategory === "Model"), row => Number(row.AmortizedCost));
        const values = sampleConsumptionRows(treatAs("'Azure Cost Basis'[Cost Basis]", ["Amortized"]),
            ["[Selected Cost]", "[Tagged Allocation]", "[Model Share]", "[Supporting Cost]"])![0];
        expect(values[0]).toBe(total);
        expect(values[2]).toBeCloseTo(model / total);
        expect(Number(values[3]) + model).toBeCloseTo(total);
    });

    it("fails explicitly for unknown queries rather than fabricating numbers", () => {
        expect(syntheticQueryResult('EVALUATE ROW("Unrecognized", BLANK())')).toMatchObject({
            status: "error", error: { message: expect.stringContaining("not available in the published synthetic sample pack") },
        });
    });

    it("applies saved task-time overrides without changing source task counts", () => {
        const source = executiveSummary();
        const saved = samples.times.map(row => ({ task: row.Behavior, low: 0, typical: 0, high: 0 }));
        const overridden = objects({ ...source, query: withTaskTimes(source.query, saved) })[0];
        expect(overridden.Tasks).toBe(13337);
        expect(Number(overridden.Hours)).toBeLessThan(Number(objects(source)[0].Hours));
    });

    it("keeps Appendix reference minutes independent of saved effort overrides", () => {
        const source = signalImpact();
        const baseline = objects(source);
        const saved = samples.times.map(row => ({ task: row.Behavior, low: 0, typical: 0, high: 0 }));
        expect(objects({ ...source, query: withTaskTimes(source.query, saved) })).toEqual(baseline);
        expect(baseline.length).toBe(samples.signals.length);
        for (const row of baseline) {
            const reference = samples.times.find(time => time.Behavior === row["AI Tasks"]);
            expect(row["Human Equivalent (Minutes)"]).toBe(reference ? Number(reference["Human Baseline (min)"]) : null);
        }
        const drafting = baseline.find(row => row["AI Tasks"] === "Document Drafting");
        expect(drafting?.["Human Equivalent (Minutes)"]).toBe(60);
        expect(Number(samples.times.find(row => row.Behavior === "Document Drafting")?.["Min Typical"])).toBe(42);
    });

    it("serves glossary definitions from the packaged model reference without rewriting them", () => {
        const rows = objects(glossary());
        expect(rows.length).toBe(samples.glossary.length);
        for (const row of rows) {
            const reference = samples.glossary.find(entry => entry.Page === row.Page && entry.Metric === row.Metric);
            expect(reference).toBeDefined();
            expect(row.Description).toBe(reference?.Description);
        }
    });
});
