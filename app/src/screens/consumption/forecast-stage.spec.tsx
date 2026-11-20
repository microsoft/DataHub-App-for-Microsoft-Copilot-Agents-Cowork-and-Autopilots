//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { CommercialTermsContext, type CommercialTermsContextValue } from "@/hooks/commercial-terms.context";
import { FILTER_KEYS } from "@/lib/filters";
import { coworkWeekly } from "@/queries/consumption/cowork";
import weeklyRows from "@/queries/consumption/__fixtures__/cowork-weekly.rows.json";
import { ForecastStage } from "./forecast-stage";

const mocks = vi.hoisted(() => ({
    useConsumptionTable: vi.fn(),
    download: vi.fn(),
    save: vi.fn(),
    refetch: vi.fn(),
}));
vi.mock("./data", () => ({ useConsumptionTable: mocks.useConsumptionTable }));
vi.mock("@/lib/table-csv", () => ({ downloadTableCsv: mocks.download }));
vi.mock("@/hooks/theme.context", () => ({ useThemeContext: () => ({ theme: {} }) }));
vi.mock("@/components/vega-visual", () => ({
    VegaVisual: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}));
const metadata = coworkWeekly("consumption").columnMetadata;
const fixture: DataTable = {
    columns: Object.values(metadata),
    rows: weeklyRows.map((row) => Object.keys(metadata).map((key) => (row as Record<string, string | number | null>)[key])),
};
const model = { creditRate: 0.01, prepaidCreditRate: 0.005, prepaidCreditBalance: 1_000_000 };
const context: CommercialTermsContextValue = { status: "ready", saved: null, model, save: mocks.save };
const renderStage = (terms: CommercialTermsContextValue = context) =>
    render(<CommercialTermsContext.Provider value={terms}><ForecastStage /></CommercialTermsContext.Provider>);

beforeEach(() => {
    vi.clearAllMocks();
    mocks.useConsumptionTable.mockReturnValue({ table: fixture, isLoading: false, error: undefined, refetch: mocks.refetch });
});

describe("native forecast stage", () => {
    it("uses the existing weekly ingestion with every page filter explicitly ignored", () => {
        renderStage();
        const [source, extra, ignored] = mocks.useConsumptionTable.mock.calls[0];
        expect(source.query).toBe(coworkWeekly("consumption").query);
        expect(extra).toEqual([]);
        expect(ignored).toEqual(FILTER_KEYS);
        expect(screen.getByText(/52 ÷ 12 weeks per month/)).toBeTruthy();
        expect(screen.getByText(/Scenario sensitivity, not confidence intervals/)).toBeTruthy();
        expect(screen.getByRole("region", { name: "Base monthly forecast" })).toBeTruthy();
        expect(screen.getByRole("columnheader", { name: "Low credits" })).toBeTruthy();
        expect(screen.getByRole("columnheader", { name: "High credits" })).toBeTruthy();
    });

    it("seeds saved rates but never presents configured pack balance as available remaining credits", () => {
        renderStage({ ...context, saved: { creditRate: 0.02, prepaidCreditRate: 0.007, prepaidCreditBalance: 2_000_000 } });
        expect((screen.getByLabelText("PAYG rate (USD / credit)") as HTMLInputElement).value).toBe("0.02");
        expect((screen.getByLabelText("Prepaid rate (USD / credit)") as HTMLInputElement).value).toBe("0.007");
        expect((screen.getByLabelText("Available prepaid credits") as HTMLInputElement).value).toBe("0");
        expect(screen.getByText(/configured pack balance is not verified remaining credit/)).toBeTruthy();
    });

    it("keeps local edits out of shared billing settings and resets them to current baseline terms", () => {
        renderStage();
        fireEvent.change(screen.getByLabelText("Credit intensity (×)"), { target: { value: "2" } });
        fireEvent.change(screen.getByLabelText("Available prepaid credits"), { target: { value: "150000" } });
        fireEvent.change(screen.getByLabelText("PAYG rate (USD / credit)"), { target: { value: "0.03" } });
        fireEvent.click(screen.getByRole("button", { name: "Reset to baseline" }));
        expect((screen.getByLabelText("Credit intensity (×)") as HTMLInputElement).value).toBe("1");
        expect((screen.getByLabelText("PAYG rate (USD / credit)") as HTMLInputElement).value).toBe("0.01");
        expect((screen.getByLabelText("Available prepaid credits") as HTMLInputElement).value).toBe("0");
        expect(mocks.save).not.toHaveBeenCalled();
    });

    it("withholds estimates and CSV when a numeric field is blank or invalid", () => {
        renderStage();
        const horizon = screen.getByLabelText("Horizon (months)");
        fireEvent.change(horizon, { target: { value: "" } });
        expect(horizon.getAttribute("aria-invalid")).toBe("true");
        expect(screen.getByRole("alert").textContent).toMatch(/Complete the planning assumptions/);
        expect(screen.queryByRole("region", { name: "Base monthly forecast" })).toBeNull();
        expect((screen.getByRole("button", { name: "Export forecast CSV" }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.change(horizon, { target: { value: "24" } });
        expect(horizon.getAttribute("aria-invalid")).toBe("false");
        expect((screen.getByRole("button", { name: "Export forecast CSV" }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("does not silently drop waves when the horizon is shortened", () => {
        renderStage();
        fireEvent.click(screen.getByText("Rollout waves (0)"));
        fireEvent.click(screen.getByRole("button", { name: "Add rollout wave" }));
        fireEvent.change(screen.getByLabelText("Additional users 1"), { target: { value: "10" } });
        const select = screen.getByLabelText("Wave 1 month") as HTMLSelectElement;
        fireEvent.change(select, { target: { value: select.options[1].value } });
        fireEvent.change(screen.getByLabelText("Horizon (months)"), { target: { value: "1" } });
        expect(screen.getByLabelText("Wave 1 month").getAttribute("aria-invalid")).toBe("true");
        expect(screen.getByText(/Choose a month inside the forecast horizon/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Remove wave 1" }));
        expect(screen.queryByRole("alert")).toBeNull();
        expect(mocks.save).not.toHaveBeenCalled();
    });

    it("downloads estimates with source dates and assumptions, not a billing-settings write", () => {
        renderStage();
        fireEvent.click(screen.getByRole("button", { name: "Export forecast CSV" }));
        const [table, title, sourceDate] = mocks.download.mock.calls[0] as [DataTable, string, string];
        expect(title).toBe("Cowork forecast estimate");
        expect(sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(table.rows).toHaveLength(36);
        expect(table.columns.some((column) => column.name === "Initial available credits (assumption)")).toBe(true);
        expect(screen.getByRole("status").textContent).toMatch(/CSV downloaded with assumptions/);
        expect(mocks.save).not.toHaveBeenCalled();
    });

    it("uses late-arriving model rates without overwriting local scenario edits", () => {
        const rendered = renderStage({ ...context, model: undefined });
        expect(screen.getByRole("alert")).toBeTruthy();
        fireEvent.change(screen.getByLabelText("Credit intensity (×)"), { target: { value: "1.5" } });
        fireEvent.change(screen.getByLabelText("PAYG rate (USD / credit)"), { target: { value: "0.03" } });
        rendered.rerender(<CommercialTermsContext.Provider value={context}><ForecastStage /></CommercialTermsContext.Provider>);
        expect(screen.queryByRole("alert")).toBeNull();
        expect((screen.getByLabelText("Credit intensity (×)") as HTMLInputElement).value).toBe("1.5");
        expect((screen.getByLabelText("PAYG rate (USD / credit)") as HTMLInputElement).value).toBe("0.03");
        expect((screen.getByLabelText("Prepaid rate (USD / credit)") as HTMLInputElement).value).toBe("0.005");
    });

    it("shows loading, retryable query errors and a useful empty state", () => {
        mocks.useConsumptionTable.mockReturnValue({ table: undefined, isLoading: true, error: undefined, refetch: mocks.refetch });
        const rendered = renderStage();
        expect(screen.getByLabelText("Loading forecast baseline")).toBeTruthy();
        mocks.useConsumptionTable.mockReturnValue({ table: undefined, isLoading: false, error: "Source unavailable", refetch: mocks.refetch });
        rendered.rerender(<ForecastStage />);
        fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }));
        expect(mocks.refetch).toHaveBeenCalledOnce();
        mocks.useConsumptionTable.mockReturnValue({ table: { ...fixture, rows: [] }, isLoading: false, error: undefined, refetch: mocks.refetch });
        rendered.rerender(<ForecastStage />);
        expect(screen.getByText("No recent credit baseline")).toBeTruthy();
        expect(screen.queryByLabelText("Horizon (months)")).toBeNull();
    });
});
