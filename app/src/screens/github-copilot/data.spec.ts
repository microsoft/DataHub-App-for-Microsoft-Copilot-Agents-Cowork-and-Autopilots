import { describe, expect, it } from "vitest";
import { ASSUMPTIONS, STAGES, analyse, estimateValue, generateGithubData, type RosterPerson } from "./data";

const roster: RosterPerson[] = (
    [["Engineering", 30, "Software Engineer"], ["IT", 25, "Systems Engineer"], ["Finance", 10, "Financial Analyst"]] as const
).flatMap(([org, count, job]) =>
    Array.from({ length: count }, (_, i) => ({ user: `${org}-${i}`, name: `${org} person ${i}`, org, job, country: i % 2 ? "UK" : "US" })),
);
const byOrg = { attribute: "Organization", values: [] as string[] };

describe("GitHub Copilot mock-up data", () => {
    const data = generateGithubData(roster);

    it("is deterministic for a roster and seed, and differs for another seed", () => {
        expect(JSON.stringify(generateGithubData(roster))).toBe(JSON.stringify(data));
        expect(JSON.stringify(generateGithubData(roster, 7).rows.slice(0, 20))).not.toBe(JSON.stringify(data.rows.slice(0, 20)));
    });

    it("narrows from seats to depth, and the last week's stages agree with the funnel", () => {
        const view = analyse(data, byOrg);
        const { licensed, active, habitual, deep } = view.funnel;
        expect(licensed).toBe(33);
        expect(licensed).toBeGreaterThanOrEqual(active);
        expect(active).toBeGreaterThanOrEqual(habitual);
        expect(habitual).toBeGreaterThanOrEqual(deep);
        expect(deep).toBeGreaterThan(0);
        const last = view.weeks.at(-1);
        const stage = (name: string) => view.weeklyStages.find((row) => row.Week === last && row.Stage === name)?.People;
        expect(stage(STAGES[2])).toBe(deep);
        expect(stage(STAGES[1])).toBe(habitual - deep);
        expect(view.idle.seats).toHaveLength(licensed - active);
    });

    it("keeps only the selected group's seats", () => {
        const view = analyse(data, { ...byOrg, values: ["Finance"] });
        expect(view.funnel.licensed).toBe(4);
        expect(view.groups.map((g) => g.Group)).toEqual(["Finance"]);
    });

    it("is empty outside the data window or for a group with no seats", () => {
        expect(analyse(data, { ...byOrg, from: "2027-01-01", to: "2027-03-31" }).empty).toBe(true);
        expect(analyse(data, { ...byOrg, values: ["Legal"] }).empty).toBe(true);
        expect(analyse(data, byOrg).empty).toBe(false);
    });

    it("values only the people above the line, against seats, premium requests and enablement", () => {
        const view = analyse(data, byOrg);
        const estimate = estimateValue(view, 0.2);
        const yearShare = view.months / 12;
        expect(estimate.capacity).toBeCloseTo(view.funnel.deep * 0.2);
        expect(estimate.value).toBeCloseTo(view.funnel.deep * 0.2 * ASSUMPTIONS.loadedCost * yearShare);
        expect(estimate.investment).toBeCloseTo(view.cost.total + view.funnel.licensed * ASSUMPTIONS.enablementPerSeat);
        expect(estimate.net).toBeCloseTo(estimate.value - estimate.investment);
        expect(estimate.stillOnTable).toBeCloseTo((view.funnel.habitual - view.funnel.deep) * 0.2);
    });
});
