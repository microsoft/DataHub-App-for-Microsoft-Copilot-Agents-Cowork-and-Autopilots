import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LineOfSight, SurfaceMap } from "./line-of-sight";

describe("Line of sight", () => {
    it("walks from work patterns to business impact and marks the current steps", () => {
        render(<LineOfSight current={["process", "impact"]} />);
        const steps = within(screen.getByRole("list", { name: "From work patterns to business impact" })).getAllByRole("listitem");
        expect(steps.map(step => within(step).getAllByRole("link")[0].textContent)).toEqual(["Work patterns", "AI usage", "Use cases", "Business process", "Business impact"]);
        expect(steps.filter(step => step.getAttribute("aria-current") === "step")).toHaveLength(2);
    });

    it("keeps the process join unmapped until an owner approves a list, and shows it as declared in the scenario", () => {
        const { unmount } = render(<LineOfSight />);
        const process = () => screen.getAllByRole("listitem")[3];
        expect(process()).toHaveTextContent("Not mapped");
        unmount();
        render(<LineOfSight scenario />);
        expect(process()).toHaveTextContent("Declared");
        expect(process()).not.toHaveTextContent("Not mapped");
    });

    it("links to cloud and AI spend only when that module is on", () => {
        render(<LineOfSight />);
        expect(screen.getByRole("link", { name: "Cost and consumption" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Cloud and AI spend" })).not.toBeInTheDocument();
    });

    it("maps agents and autopilots directly and Cowork and Copilot through the team", () => {
        render(<SurfaceMap />);
        const rows = screen.getAllByRole("row").slice(1);
        expect(rows.map(row => within(row).getAllByRole("cell")[0].textContent)).toEqual(["Agents", "Autopilots", "Cowork", "Copilot"]);
        expect(rows[0]).toHaveTextContent("case level");
        expect(rows[3]).toHaveTextContent("Team level only");
    });
});
