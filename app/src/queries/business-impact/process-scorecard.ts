//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { DataTable } from "@microsoft/fabric-visuals-core";
import { unfiltered } from "@/lib/filter-profiles";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import baseQuery from "./process-scorecard.dax?raw";
import opportunitySpec from "./process-opportunities.json";

export const impactConnection = "bi";
export const impactFilters = unfiltered("Business impact uses its own year selector and has no approved user or agent mapping.");

const columnMetadata: ColumnMetadataMap = {
    "[Id]": { name: "Id" },
    "[Value]": { name: "Value" },
    "[Eligible]": { name: "Eligible", format: "#,##0" },
    "[Population]": { name: "Population", format: "#,##0" },
    "[Exceptions]": { name: "Exceptions", format: "#,##0" },
    "[FirstDate]": { name: "FirstDate" },
    "[LastDate]": { name: "LastDate" },
};

export function processScorecard(year?: number) {
    if (year !== undefined && (!Number.isInteger(year) || year < 1 || year > 9999)) {
        throw new Error("Business impact year must be a whole calendar year.");
    }
    return {
        connection: impactConnection,
        filters: impactFilters,
        query: year === undefined ? baseQuery : baseQuery.replace(
            "REMOVEFILTERS('Date') /* IMPACT_YEAR_FILTER */",
            `TREATAS({${year}}, 'Date'[Year])`,
        ),
        columnMetadata,
        vegaLiteSpec: opportunitySpec,
    };
}

export interface ImpactMetric {
    id: string;
    process: string;
    name: string;
    unit: "days" | "percent";
    availability: "Computed" | "Proxy";
    basis: string;
    headline?: boolean;
}

export const impactMetrics: readonly ImpactMetric[] = [
    { id: "payable-clearing-days", process: "Invoice to pay", name: "Supplier posting to clearing", unit: "days", availability: "Computed", headline: true, basis: "Average elapsed days for cleared supplier-account items with valid dates. Not receipt-to-payment time; uncleared and negative intervals are excluded." },
    { id: "payable-block-rate", process: "Invoice to pay", name: "Payment-blocked open items", unit: "percent", availability: "Computed", headline: true, basis: "Uncleared supplier-account items with a payment-block reason, divided by all uncleared supplier items in the snapshot." },
    { id: "invoice-variance-free", process: "Invoice to pay", name: "Invoice items without variance flags", unit: "percent", availability: "Proxy", headline: true, basis: "No recorded quality, quantity, price, date or other tolerance variance. Missing flags are not proof of a first-time match." },
    { id: "receivable-clearing-days", process: "Order to cash", name: "Customer posting to clearing", unit: "days", availability: "Computed", headline: true, basis: "Average elapsed days for cleared customer-account items with valid dates. This is not days sales outstanding (DSO)." },
    { id: "late-collection-rate", process: "Order to cash", name: "Customer items cleared late", unit: "percent", availability: "Computed", headline: true, basis: "Customer items cleared after their net due date, among valid clearings with a due date." },
    { id: "dunning-rate", process: "Order to cash", name: "Customer items with dunning", unit: "percent", availability: "Computed", basis: "Customer-account items with a positive dunning level, as a share of customer items in the snapshot." },
    { id: "requisition-release-days", process: "Requisition to order", name: "Requisition creation to release", unit: "days", availability: "Computed", headline: true, basis: "Average nonnegative creation-to-release interval for non-deleted requisition items. Not requisition-to-PO time." },
    { id: "requisition-reference-coverage", process: "Requisition to order", name: "Requisitions with document references", unit: "percent", availability: "Computed", basis: "Non-deleted requisitions with a purchasing-document reference. A populated reference is not a validated join to a PO." },
    { id: "contract-reference-rate", process: "Source to contract", name: "PO items with contract references", unit: "percent", availability: "Computed", headline: true, basis: "Non-deleted purchase order items with a contract reference, by item count. Not spend under contract or a compliance verdict." },
    { id: "sales-block-rate", process: "Order fulfilment", name: "Sales items with blocking reasons", unit: "percent", availability: "Computed", headline: true, basis: "Sales document items with a delivery or billing block reason. Each item counted once; not a delivery-time measure." },
    { id: "journal-reversal-rate", process: "Record to report", name: "Journal lines with reversal flags", unit: "percent", availability: "Computed", basis: "Ledger lines flagged as reversal or reversed. Each line counted once; reversals are not automatically errors." },
];

export interface ImpactReading {
    metric: ImpactMetric;
    value: number | null;
    eligible: number;
    population: number;
    exceptions: number | null;
    firstDate: string | null;
    lastDate: string | null;
}

function numeric(value: unknown, name: string, nullable = false): number | null {
    if (nullable && value === null) return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new Error(`Business impact returned an invalid ${name}. Check the connected model contract.`);
    }
    return value;
}

function date(value: unknown): string | null {
    if (value === null || value === "") return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error("Business impact returned an invalid source date.");
    }
    return value;
}

export function toImpactReadings(table: DataTable): ImpactReading[] {
    const position = (name: string) => {
        const index = table.columns.findIndex(column => column.name === name);
        if (index < 0) throw new Error(`Business impact is missing the ${name} column. Check the connected model contract.`);
        return index;
    };
    const at = {
        id: position("Id"), value: position("Value"), eligible: position("Eligible"),
        population: position("Population"), exceptions: position("Exceptions"),
        first: position("FirstDate"), last: position("LastDate"),
    };
    const seen = new Set<string>();
    const rows = table.rows.map(row => {
        const metric = impactMetrics.find(item => item.id === row[at.id]);
        if (!metric || seen.has(metric.id)) throw new Error("Business impact returned an unknown or duplicate metric.");
        seen.add(metric.id);
        const value = numeric(row[at.value], "metric value", true);
        const eligible = numeric(row[at.eligible], "eligible count")!;
        const population = numeric(row[at.population], "population")!;
        const exceptions = numeric(row[at.exceptions], "exception count", true);
        if (eligible > population || (exceptions !== null && exceptions > eligible) ||
            (metric.unit === "percent" && value !== null && value > 1) ||
            (eligible === 0 && value !== null)) {
            throw new Error("Business impact returned inconsistent values or denominators.");
        }
        return {
            metric, value, eligible, population, exceptions,
            firstDate: date(row[at.first]), lastDate: date(row[at.last]),
        };
    });
    if (rows.length > 0 && seen.size !== impactMetrics.length) {
        throw new Error("Business impact returned an incomplete scorecard.");
    }
    return rows;
}

export const impactPersonas = [
    { name: "Accounts payable", process: "Invoice to pay", headline: "payable-clearing-days", signal: "payable-block-rate", signalLabel: "Payment-blocked open items", work: "Invoice exceptions, supplier queries and payment preparation", bridge: "Map AP teams and responsible company codes to approved organisation keys.", sources: [
        { view: "I_OperationalAcctgDocItem", rows: "Supplier lines (account type K)", fields: "Posting and clearing dates; clearing document; payment block reason" },
        { view: "C_SupplierInvoiceItemDEX", rows: "Supplier invoice items", fields: "Posting date; quality, quantity, price, date and other variance flags" },
    ] },
    { name: "Accounts receivable", process: "Order to cash", headline: "receivable-clearing-days", signal: "late-collection-rate", signalLabel: "Late customer clearings", work: "Collections, dispute resolution and customer follow-up", bridge: "Map collections teams and company scope; do not identify people from customer accounts.", sources: [
        { view: "I_OperationalAcctgDocItem", rows: "Customer lines (account type D)", fields: "Posting, clearing and net due dates; dunning level" },
    ] },
    { name: "Procurement operations", process: "Requisition to order", headline: "requisition-release-days", signal: "requisition-reference-coverage", signalLabel: "Missing purchasing-document references", work: "Requisition review, approvals and order preparation", bridge: "Validate requisition-to-order keys and map purchasing groups to teams.", sources: [
        { view: "C_PurchaseRequisitionItemDEX", rows: "Requisition items not marked deleted", fields: "Creation and release dates; purchasing-document reference" },
    ] },
    { name: "Strategic sourcing", process: "Source to contract", headline: "contract-reference-rate", signal: "contract-reference-rate", signalLabel: "PO items without contract references", work: "Contract discovery, sourcing analysis and supplier reviews", bridge: "Agree which categories require contracts before calling missing references noncompliant.", sources: [
        { view: "C_PurchaseOrderItemDEX", rows: "Purchase order items without a deletion code", fields: "Order date; purchase contract" },
    ] },
    { name: "Sales operations", process: "Order fulfilment", headline: "sales-block-rate", signal: "sales-block-rate", signalLabel: "Sales items with blocking reasons", work: "Order exception triage and delivery or billing coordination", bridge: "Map sales operations teams to the relevant organisational scope and case keys.", sources: [
        { view: "C_SalesDocumentItemDEX", rows: "Sales document items", fields: "Creation date; delivery, header billing and item billing block reasons" },
    ] },
    { name: "Finance and close", process: "Record to report", headline: "journal-reversal-rate", signal: "journal-reversal-rate", signalLabel: "Reversal-flagged journal lines", work: "Journal review, reconciliations and close preparation", bridge: "Add the close calendar and approved finance-team mapping; review reversal reasons.", sources: [
        { view: "I_GLAccountLineItemRawData", rows: "General ledger lines", fields: "Posting date; reversal and reversed flags" },
    ] },
] as const;

export function impactOpportunities(readings: readonly ImpactReading[]): DataTable {
    const rows = impactPersonas.flatMap(persona => {
        const reading = readings.find(item => item.metric.id === persona.signal);
        if (!reading || reading.exceptions === null || reading.eligible === 0) return [];
        return [[persona.process, persona.signalLabel, reading.exceptions / reading.eligible, reading.exceptions, reading.eligible]];
    });
    return {
        columns: [
            { name: "Process" }, { name: "Signal" }, { name: "Rate", format: "0.0%" },
            { name: "Items", format: "#,##0" }, { name: "Eligible", format: "#,##0" },
        ],
        rows,
    };
}
