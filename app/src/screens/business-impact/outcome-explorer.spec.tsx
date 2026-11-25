import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import data from "@/demo/outcome-samples.json";
import OutcomeExplorer from "./outcome-explorer";

vi.mock("../cross-vendor/insights", () => ({ Chart: ({ title }: { title: string }) => <figure aria-label={title} /> }));

describe("business outcome explorer", () => {
    it("opens the selected source's persona and uses its own population for cost", () => {
        render(<OutcomeExplorer />);
        fireEvent.click(screen.getByRole("button", { name: "Business systems" }));
        fireEvent.click(screen.getByRole("button", { name: /CRM test records/ }));
        expect(screen.getByRole("heading", { name: "Close opportunities" })).toBeVisible();
        const monthly = screen.getByRole("combobox", { name: "Monthly measure" });
        fireEvent.change(monthly, { target: { value: "volume" } });
        expect(screen.getByRole("figure", { name: "Transaction volume by month" })).toBeVisible();
        fireEvent.click(screen.getByRole("button", { name: "Model AI cost for this process" }));
        const budget = screen.getByRole("spinbutton", { name: "Scenario budget (USD)" });
        const share = screen.getByRole("spinbutton", { name: "Process allocation (%)" });
        fireEvent.change(budget, { target: { value: String(data.sales.completed * 2) } });
        fireEvent.change(share, { target: { value: "50" } });
        expect(screen.getByText("$1.00")).toBeVisible();
        fireEvent.change(share, { target: { value: "101" } });
        expect(screen.queryByText("$1.00")).not.toBeInTheDocument();
        expect(screen.getByText(/Enter a nonnegative budget/)).toBeVisible();
        fireEvent.change(budget, { target: { value: "0" } });
        fireEvent.change(share, { target: { value: "0" } });
        expect(screen.getByText("$0.00")).toBeVisible();
    });

    it("withholds invented dates, HR metrics and costs when the source cannot supply them", () => {
        render(<OutcomeExplorer />);
        const role = screen.getByRole("combobox", { name: "Functional persona" });
        fireEvent.change(role, { target: { value: "5" } });
        expect(screen.getByText("Monthly trend unavailable.")).toBeVisible();
        expect(screen.queryByRole("figure")).not.toBeInTheDocument();
        fireEvent.change(role, { target: { value: "7" } });
        fireEvent.click(screen.getByRole("button", { name: "AI cost scenario" }));
        expect(screen.getByRole("heading", { name: "Source required" })).toBeVisible();
        expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "See source requirements" }));
        fireEvent.click(screen.getByRole("button", { name: "No native sample loaded" }));
        expect(screen.getByRole("heading", { name: "Complete work orders" })).toBeVisible();
        expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    });

    it("maps a candidate agent to the selected process while withholding unobserved automation and impact", () => {
        render(<OutcomeExplorer />);
        fireEvent.click(screen.getByRole("button", { name: "Explore agents for this process" }));
        expect(screen.getByRole("button", { name: "Agents & automation" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("heading", { name: "Incident resolution agent" })).toBeVisible();
        expect(screen.getByText(/Triage an incident, propose remediation/)).toBeVisible();
        expect(screen.getByText(/Automation coverage, human effort, agent costs and attributable change are unavailable, not zero/)).toBeVisible();
        expect(screen.queryByRole("figure")).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole("combobox", { name: "Functional persona" }), { target: { value: "2" } });
        expect(screen.getByRole("heading", { name: "Invoice exception agent" })).toBeVisible();
        expect(screen.getByText(/invoice payment time needs invoice-level dates and keys/)).toBeVisible();
        expect(screen.queryByRole("heading", { name: "Incident resolution agent" })).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole("combobox", { name: "Functional persona" }), { target: { value: "7" } });
        expect(screen.getByRole("heading", { name: "Interview scheduling agent" })).toBeVisible();
        expect(screen.getByText(/No outcome source is loaded for this process/)).toBeVisible();
        expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Persona scorecard" }));
        expect(screen.getByRole("heading", { name: "Source required" })).toBeVisible();
    });
});
