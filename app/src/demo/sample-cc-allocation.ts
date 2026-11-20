import { dateRange, groups, literals, orgAttribute, project, samples, sum, type RecordRow } from "./sample-data";

/** Only source-backed allocations; the sample pack contains no recommendation snapshot. */
export function sampleCcAllocationRows(query: string, columns: readonly string[]): unknown[][] | undefined {
    if (query.includes("'CoworkBilling'[Seat Action]")) return [];
    if (!query.includes('VAR _Basis = "') || !columns.includes("[Reconciled Credits]")) return undefined;
    const source = samples.consumption;
    const range = dateRange(query, "'Reporting Date'[Date]");
    const policy = /VAR _Basis = "policy"/.test(query);
    const people = new Map(source.PersonPolicyMap.map(row => [row.PersonId, row]));
    const policyNames = new Map(source.SpendingPolicyMetadata.map(row => [row.SpendingPolicyId, row.Name]));
    const directory = new Map(source.entra_org.map(row => [row.userPrincipalName.toLowerCase(), row]));
    const selectedOrgs = literals(query, "Org Attribute Source", "Value");
    const attribute = orgAttribute(query);
    const key = attribute === "country" ? "country" : attribute === "job" ? "jobTitle" : "department";
    const pool = source.PersonServiceCreditsMetrics.filter(row => !range || row.MetricDate >= range.from && row.MetricDate <= range.to);
    const scoped = pool.filter(row => {
        const upn = people.get(row.PersonId)?.userPrincipalName.toLowerCase();
        return !selectedOrgs || selectedOrgs.includes(directory.get(upn ?? "")?.[key] ?? "(Not set)");
    });
    const credit = (row: Record<string, string>) => Number(row["Total Copilot Credits used"]);
    const poolCredits = sum(pool, credit);
    const override = (name: string, fallback: number) =>
        Number(new RegExp(`MEASURE\\s+'[^']+'\\[${name}\\]\\s*=\\s*(\\d+(?:\\.\\d+)?)`, "i").exec(query)?.[1] ?? fallback);
    const prepaid = Math.min(poolCredits, override("Cowork Capacity Pack Balance Value", samples.terms.prepaid_credit_balance));
    const poolCost = prepaid * override("Cowork Prepaid Rate Value", samples.terms.prepaid_credit_rate)
        + (poolCredits - prepaid) * override("Cowork PAYG Rate Value", samples.terms.credit_rate);
    const mapping = (row: Record<string, string>) => {
        if (policy) return {
            allocation: policyNames.get(row.SpendingPolicyId) || row.SpendingPolicyId || "(Unallocated)",
            policyId: row.SpendingPolicyId,
            status: row.SpendingPolicyId ? "Assigned" : "Missing policy",
        };
        const upn = people.get(row.PersonId)?.userPrincipalName.toLowerCase();
        // Native costCenter is not the custom "Cost Centre Label" EAV attribute.
        return { allocation: "(Unallocated)", policyId: "", status: upn && directory.has(upn) ? "Missing cost centre" : "Unmatched person" };
    };
    const records = groups(scoped, row => {
        const mapped = mapping(row);
        return `${mapped.status}\u0000${mapped.allocation}\u0000${mapped.policyId}`;
    }).map(([, rows]) => {
        const mapped = mapping(rows[0]);
        return { allocation: mapped.allocation, policyId: mapped.policyId, status: mapped.status, credits: sum(rows, credit) };
    }).sort((a, b) => b.credits - a.credits || a.allocation.localeCompare(b.allocation)
        || a.policyId.localeCompare(b.policyId) || a.status.localeCompare(b.status));
    const allocationAmounts = (credits: number) => {
        const share = poolCredits > 0 ? credits / poolCredits : null;
        return {
            Credits: credits, "Pool Share": share,
            "Prepaid Credits": share === null ? null : share * prepaid,
            "PAYG Credits": share === null ? null : share * (poolCredits - prepaid),
            "Estimated Cost": share === null ? null : share * poolCost,
        };
    };
    const dates = source.PersonServiceCreditsMetrics.map(row => row.MetricDate).sort();
    const summary: RecordRow = {
        Part: "Summary", ...allocationAmounts(sum(scoped, credit)),
        "Pool Credits": poolCredits, "Pool Cost": poolCost,
        "Assigned Credits": sum(records.filter(row => row.status === "Assigned"), row => row.credits),
        "Reconciled Credits": sum(records, row => row.credits),
        "Window Start": range?.from ?? dates[0], "Window End": range?.to ?? dates.at(-1), Total: records.length,
    };
    return project(columns, [summary, ...records.slice(0, 500).map(row => ({
        Part: "Allocation", Allocation: row.allocation, "Policy ID": row.policyId || null, "Allocation Status": row.status,
        ...allocationAmounts(row.credits), Total: records.length,
    }))]);
}
