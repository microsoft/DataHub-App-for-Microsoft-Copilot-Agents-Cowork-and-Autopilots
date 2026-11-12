# Make existing KPI cards respond to filters manually

These are source-code edits for the Fabric-hosted DataHub App, without GitHub or the
installer. You need a local, editable copy of the app source matching the installed version,
Node.js 24.15+ (or 22.22+), and permission to update the existing Fabric app item.
Use a code editor such as VS Code. There is no DataHub runtime setting or documented
in-app source editor for this change: saving a file does not update the deployed app.
Do not edit the minified files in `dist`.

Back up the source and deployment configuration first. Keep the existing `fabric.yaml`
model bindings, `rayfin\rayfin.yml` deployment state, and any deployed
`fabric.config.json` settings. Run commands below from the `app` folder. This is not a
Power BI report edit.

## 1. Remove the cohort-card filter overrides

Paths in this section are relative to `app`. Find the named functions and replace only the
specified expressions; retain their surrounding rendering code.

In `src\screens\adoption\activation-stage.tsx`, inside `ActivationStage`:

```tsx
const summary = useFilteredQuery(activationSummary());
```

In `src\screens\value\tasks-stage.tsx`, inside `TasksStage`:

```tsx
const summary = useFilteredQuery(workSummary());
```

In Activation also remove the second `{ ignore: IGNORED }` argument from the
`ActivationByOrg` component's `useFilteredQuery` call, so its chart shares the cards' filters.
Remove `COHORT_FILTERS`, `AGENT_FILTERS`, `IGNORED`, both associated `<FilterNote ... />`
elements, and its now-unused `unmatched`/`cohortReason` variables.
In Tasks remove `COHORT_FILTERS`, its `<FilterNote ... />` and the `unshown`/`cohortReason`
variables. Remove unused `FilterNote`,
`unshownActivity` and `FilterKey` imports; keep `selectedCohort` and `PICKABLE` for
card emphasis. Older versions can have different names: remove the override passed as
`{ ignore: ... }`, not the actual filter provider.

In `src\screens\adoption\use-adoption-summary.ts`, remove the optional ignore parameter
and apply the filter hook to both query parts:

```tsx
export function useAdoptionSummary(): SummaryResult {
    const core = useFilteredQuery(adoptionSummary());
    const spuw = useFilteredQuery(adoptionSummarySpuw());
```

Keep the remainder of that function, including its paired loading/error handling, unchanged.
Remove its now-unused `FilterKey` import.

In `src\screens\adoption\adoption-stage.tsx`, inside `AdoptionStage`:

```tsx
const summary = useAdoptionSummary();
const trend = useMemo(() => adoptionTrend({ measure }), [measure]);
const trendResult = useFilteredQuery({
    connection: trend.connection,
    query: trend.query,
    columnMetadata: trend.columnMetadata,
});
```

Remove `SURFACE_FILTERS`, its `<FilterNote ... />`, the associated reason/unshown-selection
variables and now-unused imports. Keep the card-selection logic.

## 2. Keep the other activity summaries and charts consistent

In `src\screens\adoption\habit-stage.tsx`, use:

```tsx
const summary = useFilteredQuery(habitSummary());
const trendResult = useFilteredQuery({
    connection: trend.connection,
    query: trend.query,
    columnMetadata: trend.columnMetadata,
});
```

Keep the existing `trend` definition. Remove `AGENT_FILTERS`, its filter note and unused imports.

In `src\screens\efficiency\cowork-fit-stage.tsx`, remove `COWORK_ONLY` and its filter note.
Inside `CoworkFitStage`, use:

```tsx
const summary = useFilteredQuery(coworkFitSummary());
```

Inside `FitByTaskChart`, remove the second `{ ignore: COWORK_ONLY }` argument from
`useFilteredQuery`. Render the tables without ignore props:

```tsx
<WorkShapeTable />
<PeopleTable />
```

In `src\screens\efficiency\cowork-fit-tables.tsx`, remove `CoworkTableProps`, change the
function signatures to `WorkShapeTable()` and `PeopleTable()`, and remove the second
`{ ignore }` argument from both `useFilteredQuery` calls.

In `src\screens\efficiency\model-fit-stage.tsx`, remove `ACTIVITY_FILTER` and its filter
note. Keep the match query filtered:

```tsx
const matchResult = useFilteredQuery({
    connection: match.connection,
    query: match.query,
    columnMetadata: match.columnMetadata,
});
```

Remove now-unused `FilterKey` / `FilterNote` imports in these files. Do not remove
source-specific profiles or all ignore options globally: some data really is a
current inventory or tenant-wide billing total.

## 3. Let org filters narrow license inventory

This preserves current-seat definitions: dates do not turn an inventory into dated usage.
The model must already contain the normalized user keys and org-attribute membership bridge
referenced below. If it does not, update the semantic model first rather than creating
replacement measures or bypassing access restrictions.

In `src\lib\filter-profiles.ts`, after `VALUE_LENS`, add:

```ts
export const LICENSE_ROSTER: FilterProfile = {
    ...VALUE_LENS,
    dateRange: notApplied("the license roster is a current snapshot, not dated activity."),
    organizations: (state) =>
        `TREATAS(CALCULATETABLE(VALUES('Chat + Agent Org Data'[PersonId_Normalized]), ${orgValueFilter(state.orgAttribute, state.organizations)}), 'Copilot Licensed'[UPN_Normalized])`,
};
```

`orgValueFilter` is already imported by this version of `filter-profiles.ts`.
In each of `src\queries\licensing\license-estate-summary.ts` and
`src\queries\licensing\license-dormancy.ts`, add:

```ts
import { LICENSE_ROSTER } from "@/lib/filter-profiles";
```

Their factory return expressions become, respectively:

```ts
return { connection, query, columnMetadata, filters: LICENSE_ROSTER };
```

```ts
return { connection, query, columnMetadata, filters: LICENSE_ROSTER, vegaLiteSpec: spec as VisualizationSpec };
```

In `src\screens\readiness\license-readiness-stage.tsx`, remove
`LICENSE_ESTATE_IGNORES` and use:

```tsx
const estate = useFilteredQuery(licenseEstateSummary());
const dormancy = licenseDormancy();
const dormancyResult = useFilteredQuery(dormancy);
```

Pass the complete `dormancy` definition: extracting only `connection` and `query`
would lose its new filter profile. Replace the old inventory `<FilterNote ... />` with:

```tsx
<NotFilteredHint from={[estate.notFilteredBy]} />
```

Import `NotFilteredHint` from `@/components/not-filtered-hint`; remove the old
`FilterNote` and unused `FilterKey` imports.

In `src\screens\executive\attention-stage.tsx`, remove `ESTATE_IGNORES` and use:

```tsx
const dormancy = useTableQuery(dormancySource);
const estate = useSummaryQuery(licenseEstateSummary());
```

Remove its old idle-seats `<FilterNote ... />`, its unused imports, and add
`estate.notFilteredBy` to the existing `NotFilteredHint` `from` array. The Executive
summary and Readiness page will then use the same org-scoped inventory.

## 4. Save, rebuild and publish to the existing app

Save all edited files. With dependencies already restored, run:

```powershell
npm.cmd test
npm.cmd run lint
npx.cmd --no-install tsc -b
npm.cmd run build:fabric
```

For a fresh source copy, restore its locked dependencies first with `npm.cmd ci`.
Do not publish if the checks fail.

From that same `app` folder and using the existing deployment configuration:

```powershell
npx.cmd rayfin up --workspace-uri "https://app.fabric.microsoft.com/groups/<workspace-id>"
```

Sign in as the account allowed to update the app; add `--tenant <tenant-id>` if required.
Use the existing workspace/item deployment state, not a fresh unbound configuration.
Open the **Fabric portal** link printed by Rayfin and reload the app. This command
builds/deploys the source change; a browser refresh alone cannot publish it. If you have
only the installed app and no matching editable source/deployment state, obtain those
from your app administrator first. Do not guess item IDs or create a replacement app.

For live development, the supported preview is `npm.cmd run dev`, then the Fabric app
URL with `&devUri=http://localhost:5173`; a standalone localhost page is not the live
Fabric app. These commands do not cover the separately hosted Azure web app.

## 5. Quick filter check and limits

On Adoption and Value, record the default Everyone/Overall and Licensed card values.
Select **Activity = Cowork**: applicable activity-based card values must narrow along
with their charts, not merely change card emphasis. Combine an organisation, a licence
selection and a date range; then clear the filters and confirm the default values return.
Use a cohort known to contain both Cowork and other activity so the check can show a difference.
On Readiness and Executive summary, select a smaller org and check the seat inventory
and idle-seat figures narrow together. Changing only dates should leave current-seat
inventory unchanged and show its explanation.

The edits above fix filtering of existing cards. They do **not** add the new Cowork
cards or expose previously unloaded org attributes: those need the additional card/query
changes and updated semantic-model definitions in the complete update. Cowork Activation
uses the existing Cowork users as a share of active users, not licensed Cowork seats.
Existing measure denominators and row-level access restrictions remain in force; an
inventory denominator need not shrink when an activity-only filter changes.
Blank/non-overlapping cohort combinations can legitimately show zero or no data.

Expanded Group by requires the updated model templates and a successful data/model
refresh before redeploying the app. User-ID grouping uses the existing normalized identity,
does not grant new access, and can be slower or produce many rows in a large tenant.
