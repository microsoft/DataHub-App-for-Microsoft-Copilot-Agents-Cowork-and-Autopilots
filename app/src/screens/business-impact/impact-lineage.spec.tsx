import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { impactMetrics, impactPersonas } from "@/queries/business-impact";
import { AgentLineage, PersonaLineage } from "./impact-lineage";

describe("Business impact lineage", () => {
    it("traces each authored persona to its SAP source rows and every measure of its process", () => {
        render(<PersonaLineage />);
        const chain = within(screen.getByRole("list", { name: "Where the personas come from" }));
        expect(chain.getByText("People, agents and cost").parentElement).toHaveTextContent("Not mapped");
        expect(chain.getByText("Role template").parentElement).toHaveTextContent("Not discovered from Entra, HR or SAP user records");
        const rows = screen.getAllByRole("row").slice(1);
        expect(rows).toHaveLength(impactPersonas.length);
        impactPersonas.forEach((persona, index) => {
            const row = within(rows[index]);
            expect(row.getByText(persona.name)).toBeInTheDocument();
            persona.sources.forEach(source => expect(row.getByText(source.rows)).toBeInTheDocument());
            impactMetrics.filter(metric => metric.process === persona.process).forEach(metric => expect(row.getByText(metric.name)).toBeInTheDocument());
        });
        expect(impactMetrics.every(metric => impactPersonas.some(persona => persona.process === metric.process))).toBe(true);
    });

    it("keeps the agent-to-process link visibly unconfigured", () => {
        render(<AgentLineage />);
        const chain = within(screen.getByRole("list", { name: "How agents would connect to the process measures" }));
        expect(chain.getByText("Process step and persona").parentElement).toHaveTextContent("Not configured");
        expect(chain.getByText("Business case evidence").parentElement).toHaveTextContent("Not mapped");
        expect(chain.getByText("Business outcome change").parentElement).toHaveTextContent("Not configured");
        expect(screen.getByText(/Three separate requirements, not interchangeable evidence levels/)).toBeInTheDocument();
    });
});
