//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { budgetRunway, spreadWeeks } from "./budget-runway";
import { compare, licenceCost, readSourceValues } from "@/queries/value/cost-vs-value";

describe("illustrative examples in the DataHub App reading guide", () => {
    it("reproduces the value, licence cost, return and break-even example with the shipped helpers", () => {
        const values = readSourceValues({
            columns: ["Source", "Licence", "Scenario", "Value"].map((name) => ({ name })),
            rows: [
                ["Copilot", "Licensed", "Conservative", 500],
                ["Copilot", "Licensed", "Typical", 1000],
                ["Copilot", "Licensed", "Optimistic", 1500],
                ["Copilot", "Unlicensed", "Typical", 5000],
            ],
        });
        const licences = licenceCost(10, 30, { from: "2026-04-01", to: "2026-04-30" });
        const result = compare(values, { licences, studio: 100, cowork: undefined }, "Typical", 50);
        expect(licences).toBeCloseTo(295.69, 2);
        expect(result.value).toBe(1000);
        expect(result.cost).toBeCloseTo(395.69, 2);
        expect(result.ratio).toBeCloseTo(2.53, 2);
        expect(result.breakEvenRate).toBeCloseTo(19.78, 2);
        expect(result.low).toBeCloseTo(500 / (licences + 100));
        expect(result.high).toBeCloseTo(1500 / (licences + 100));
    });

    it("reproduces the runway projection and budget crossing example", () => {
        const days = Array.from({ length: 10 }, (_, index) => ({
            date: `2026-04-${String(index + 1).padStart(2, "0")}`,
            cost: 10,
        }));
        expect(budgetRunway(days, 250)).toMatchObject({
            status: "at-risk", daysElapsed: 10, daysInMonth: 30,
            spent: 100, dailyAverage: 10, projected: 300, crossesOn: "2026-04-25",
        });
    });

    it("allocates a weekly cost across a month boundary as illustrated", () => {
        const days = spreadWeeks([{ start: "2026-04-28", cost: 70 }]);
        const april = days.filter((day) => day.date.startsWith("2026-04"));
        const may = days.filter((day) => day.date.startsWith("2026-05"));
        expect(april.reduce((sum, day) => sum + day.cost, 0)).toBe(30);
        expect(may.reduce((sum, day) => sum + day.cost, 0)).toBe(40);
    });
});
