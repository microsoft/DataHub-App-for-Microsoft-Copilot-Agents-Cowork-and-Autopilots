import { describe, expect, it } from "vitest";
import { agentLinks, agentSummary, sapProcesses, bridgeSummary, catalogue, cellFor, decide, groups, NO_PROCESS, peopleInProcess, setupChecks } from "./discovery";
import { coverage, personas } from "./scenario";

describe("discovery of personas and processes", () => {
    const sap = groups.filter(g => g.scope === "sap");

    it("agrees with the scenario's coverage and persona counts", () => {
        const summary = bridgeSummary(groups);
        expect(summary.scope).toBe(274);
        expect(Math.round(summary.share * 100)).toBe(Math.round(coverage.peopleWithPersona * 100));
        const agents = agentSummary(agentLinks);
        expect(agents.mapped).toBe(coverage.agentsMapped);
        expect(agents.total).toBe(coverage.agentsTotal);
        for (const persona of personas) {
            const group = groups.find(g => g.persona === persona.id)!;
            expect([group.people, group.process]).toEqual([persona.people, persona.process]);
        }
    });

    it("splits people into confirmed, proposed and not mapped without losing anyone", () => {
        const s = bridgeSummary(groups);
        expect([s.confirmed, s.proposed, s.unmapped]).toEqual([170, 64, 40]);
        expect(s.confirmed + s.proposed + s.unmapped).toBe(s.scope);
    });

    it("keeps D365-only groups out of the SAP scope and waiting for a source", () => {
        const d365 = groups.filter(g => g.scope === "d365");
        expect(d365.map(g => g.status)).toEqual(["Waiting for source", "Waiting for source"]);
        expect(bridgeSummary(groups).scope).toBe(sap.reduce((n, g) => n + g.people, 0));
    });

    it("gives every group at most one primary column and never counts 'also' cells", () => {
        const columns = [...sapProcesses, "Lead to opportunity", NO_PROCESS];
        for (const group of groups) {
            expect(columns.filter(c => cellFor(group, c) === "primary")).toHaveLength(1);
        }
        const r2r = groups.find(g => g.id === "r2r")!;
        expect(cellFor(r2r, "Invoice to pay")).toBe("also");
        expect(peopleInProcess(groups, "Invoice to pay")).toBe(64);
    });

    it("recomputes when a reviewer confirms a proposal", () => {
        const confirmed = decide(groups, { category: "Confirmed", salesops: "Confirmed", "procurement-coordinator": "Confirmed" });
        expect(bridgeSummary(confirmed)).toMatchObject({ confirmed: 234, proposed: 0, unmapped: 40 });
        expect(bridgeSummary(groups).confirmed).toBe(170);
    });

    it("lists every SAP process with a source, and D365 as not connected", () => {
        expect(catalogue.filter(p => p.source === "SAP")).toHaveLength(6);
        expect(catalogue.find(p => p.source === "D365")).toMatchObject({ readiness: "Not connected", volume: null });
        for (const process of sapProcesses) expect(catalogue.find(p => p.name === process)?.volume).toBeGreaterThan(0);
    });

    it("keeps the setup checks tied to what is still unreviewed", () => {
        const open = setupChecks(bridgeSummary(groups), agentSummary(agentLinks));
        expect(open.filter(c => !c.done).map(c => c.label)).toEqual(["Approve the persona list", "Approve the agent-to-process list"]);
        const settled = setupChecks(
            bridgeSummary(decide(groups, Object.fromEntries(sap.map(g => [g.id, "Confirmed" as const])))),
            agentSummary(decide(agentLinks, Object.fromEntries(agentLinks.map(a => [a.id, "Confirmed" as const])))),
        );
        expect(settled.every(c => c.done)).toBe(true);
    });
});
