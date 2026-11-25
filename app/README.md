# DataHub App

The DataHub App is available as a web app in your Fabric workspace. The
[installer](../installer/README.md) deploys it for you. Use this folder only to deploy it by hand
or to change it.

It covers Microsoft 365 Copilot, agents and Cowork, including estimated value, Cowork fit and
readiness. Cowork credits and cost need optional credit consumption data.

The app keeps no copy of your data. Each page queries the semantic model live, as the person
viewing it, so row-level security applies. How each figure is worked out is in the
[methodology](../docs/METHODOLOGY.md).

## Static browser demo

The standalone DataHub App browser demo at `demo.html` uses the real app screens with the published
[synthetic sample CSVs](../samples/README.md). It does not read host configuration, ask you to sign in, or contact a model or app
backend. Ask returns a local example answer; settings changes stay in memory for the current page
session, and admin-only actions are disabled.

The demo data build needs Python 3.10+ and the existing [core](../core/pyproject.toml)
DuckDB dependency (`python -m pip install -e ..\core` from this folder).
From this folder, install the app dependencies with `npm ci` and run:

```powershell
npm run build:demo
```

The build first runs `npm run demo:data`: CSV parsing and the shared core classifier produce
the ignored `src/demo/sample-data.generated.json`. The classifier's ingestion exclusions are
disabled because this is an already-curated published sample set: all 13,337 rows are retained.
Dates are not shifted. Reference task times, behavior mappings and glossary entries come from
the checked-in ValueLens template; default commercial terms are read, without executing it,
from the checked-in consumption sample seeder. Tests regenerate the data first. For a direct
typecheck or watch session, run `npm run demo:data` first.

The original activity dates are **1 June–31 August 2026**, with **170 inventory people,
13,337 tasks and 2,476.65 typical expert-equivalent hours** under the shipped template rules.
The dated consumption exports total **162,222.8531 credits**: 44,750.8531 Cowork and 117,472
Studio. These do **not** reproduce a separately transformed live installation's 2,690 hours
or 153.3k credits. User snapshots (117,475 Studio credits) and agent/feature snapshots retain
their own export grain; they are not rescaled to make dated tenant totals match. The consumption
directory and interaction sample use separate synthetic cohorts, so they are not joined by
invented identities. No live lakehouse data or private configuration is used.
The CSV inputs are unchanged from public sample commit
`b9c543d65ecfd406a8d74b33043fd5ff6162097c`
(sample tree `8280b20447058886574903d87976da40edc809bb`).

The completeness fixes replace query-hash numbers with native-schema adapters for Cowork/model
fit, activity/adoption, leaderboards, readiness, value, consumption, feedback and registry
governance. Percentages, rollup flags, full-list counts and concentration curves derive from
source rows. Unknown queries fail visibly rather than receive plausible invented values.
The public sample pack does not include Microsoft 365 telemetry, evaluation conversations,
Defender findings or Resource Graph configuration; those pages explicitly disclose unavailable
sources. Unset monthly budgets remain unset and can be tried in memory. Registry checks use
only the evidence present in the sample; unavailable authentication checks are not reported clear.

The Appendix uses the app's current source-page glossary presentation and grading explanation.
Signal → Impact displays the packaged model's **Human Baseline** reference minutes, not measured
time saved or the Typical effort scenario. Assumptions overrides affect estimated hours and value,
not this reference. The Appendix guide link bundles the existing app PDF unchanged.

The self-contained static bundle is written to `dist-demo`. Serve that directory from any static
file host; `index.html`, its local assets, the MIT `LICENSE.txt`, and the generated
`THIRD_PARTY_NOTICES.txt`, `SOURCE_PROVENANCE.json` and `SHA256SUMS.txt` travel together.
Provenance records the source revision, sample tree, every input hash and build runtime.
The checksum manifest lists every
bundle file except itself. The build uses Vite's `demo` mode and relative asset paths so the bundle
can live below a site subdirectory. Do not copy deployment settings or real identifiers into the
demo bundle.

The demo includes optional cross-vendor topics (Portfolio, Adoption trends, Coding output,
Spend & credits, Native usage, Cost & evidence, Source coverage and Methodology), plus
comparison panels on Overview, Adoption, Cost & consumption, Optimise and Leaderboards.
These appear when **Vendor scope** is **All connected vendors**; **Microsoft** is the default.
The switch adds source-specific views, not a filter that combines identities, currencies or
usage units. Existing cross-vendor deep links open the all-vendor scope.
Its seeded 91-day comparison keeps a separate four-organization, 278-person scenario, not the
170-person CSV sample or a Fabric export. Monthly active users cover their labelled month,
not the app's all-date totals. Vendor counts can overlap; native units, credits and USD spend
are not added together. The native-source evidence fixture is separately identified and is not
a population total. The Microsoft Copilot snapshot uses the same seeded monthly active people
and credits as the scenario charts, not a live export; GitHub usage remains deferred.
The view's own vendor/product filters work locally; app-wide filters do
not apply. `.env.demo` enables this view only for the static demo build; ordinary builds keep
it disabled unless `VITE_CROSS_VENDOR_DEMO=true` is explicitly set, or the installer records
the optional `crossVendor` module (`"modules": { "crossVendor": true }` in `fabric.config.json`
or `app.config.json`). An installed app labels the view as a preview: it shows the same seeded
scenario until collectors for each vendor's own usage data ship.

ValueLens (and the Purview audit it reads) is an optional installer module too. An install
without it records `"modules": { "core": false }` and leaves the `vl` model out; the app then
lists Cost & consumption, Cowork right-sizing under Optimise and Agent quality under Governance
(plus optional vendor topics when chosen), never
asks the ValueLens model, and offers only the date filter, since the other filters' choices
come from ValueLens. Configs with no `core` value keep ValueLens on.

The static demo also includes **DataHub Business impact**, a separate seeded scenario that previews an
optional module for SAP process data, with a separate D365 Sales preview. It shows functional personas,
process KPIs with a difference-in-differences estimate against a comparison group, a fuller
scorecard of speed, throughput, cash and quality-check measures, agents mapped to SAP processes,
cost per transaction and separate value categories. It sits after Value in the menu and reuses
Value's expert-equivalent-hours approach as its estimated level of evidence, not the Value demo's
cohort or totals. The Bottom line presents eight SAP process outcomes across speed, throughput, cash
and quality, including inconclusive results. Three separate D365 examples show lead qualification,
opportunity win rate and sales cycle as observed changes only. They are excluded from SAP totals.
Each scorecard measure is labelled **Computed** (from process source fields), **Proxy**
(indirect or team-level) or **Needs source** (outside the proposed process data), with a plain-language
description of how it would be computed. The Data and method page adds the source areas the
module would read, the persona join levels (team by default; person-level only through a
customer-supplied SAP-user-to-UPN map and privacy review) and readiness checks to run first:
data window, last load, link coverage, field population and volume.
No SAP or D365 data is connected in the static demo. Source areas are illustrative
and every value is synthetic. App-wide filters do not apply to these fixed scenarios. `.env.demo` enables it; ordinary builds
keep it hidden unless `VITE_BUSINESS_IMPACT_DEMO=true` is set.

The synthetic Business impact pages are chart-first. Each tab opens on a headline and varied
charts (lollipop, dumbbell, heatmap, interval, stacked-bar and scatter views in
`src/screens/business-impact/visuals.tsx`). Tables, definitions and the discovery workflow sit in
collapsed "More detail" blocks. `StageRun` in `src/components/stage-detail.tsx` takes an optional
`open` list of stages that start expanded: Process outcomes and Cost per transaction use it so their
charts show by default. The charts keep the same evidence boundaries as the text they replace:
simulated process-level changes are not an agent's own effect, session resolution is not a
completed case, and value categories are never summed into one ROI. The connected view
(`live.tsx`), the Connect page and the Outcome explorer follow the same pattern: status tiles,
stacked and progress bars, step flows and matrices first, with source tables and rules in
"More detail" blocks. Connected values remain source observations only.

Every page section has a **How to read** ⓘ button beside its heading
(`src/components/visual-guide.tsx`). It lists each visual in the section with what it shows and how
to read it. `Section` provides the registry. `VegaVisual` (with an optional `about` prop) and
`KpiCard` register automatically, Vega-Lite descriptions come from the spec's marks and encodings,
and custom DOM visuals call `useVisualGuide`. A visual rendered outside a `Section` is not listed.

### Optional connected Business impact

The demo also has an **Outcome explorer** tab (`#/business-impact/impact-samples`).
Set `VITE_BUSINESS_OUTCOME_SAMPLES=true` in a build that already enables Business impact
to show it. It can sit alongside a configured `bi` connection, but selecting this tab
reads only bundled public aggregates. It never substitutes samples for a failed model query.

The explorer uses historical ServiceNow, purchase-to-pay and marketing records and a
Salesforce CRM test dataset. It preserves their separate periods and populations.
Use **Business systems** to inspect source requirements, **Persona scorecard** for process
measures and coverage, **Agents & automation** for proposed process-step/agent mappings,
and **AI cost scenario** to divide an illustrative allocation by
the sample's stated volume. Role templates are not employee mappings. No native Dynamics 365
or HR records, measured AI costs, or rollout comparisons are included.
See the [sample pack](../samples/business-outcomes/) for sources, licences, rebuild and
optional Lakehouse import. Source files are not included in the app.

An ordinary, authenticated install can instead bind a separately published Business impact
semantic model under the **`bi`** alias in `fabric.yaml` or the ignored runtime
`public/fabric.config.json`. A valid binding enables the eight Business impact stages without
the synthetic-demo flag. The connected view takes precedence over that flag, never substitutes
synthetic values after a query failure, and is never selected by a static `demo` build.

The model contract is in [`src/queries/business-impact`](src/queries/business-impact):
business-friendly fact tables, a shared `Date` calendar, and explicit measures for clearing
intervals, payment blocks, invoice variance flags, requisition release and reference coverage,
contract-reference item coverage, sales blocking reasons and journal reversal flags. This is
an optional model connection, **not an automatic SAP or D365 ingestion installer**. The
source-specific bindings and ingestion remain separately managed. The intended product is an
optional DataHub Business impact module with source-specific adapters; describing that direction
does not mean its extraction, transformation or mapping setup has been implemented.

The connected Bottom line shows eight source-backed measures; the full scorecard shows eleven.
Each includes its eligible population and definition. The source-year selector filters the
process model only, not the other DataHub models. The coverage chart always shows all source
years. Snapshot status flags are not reconstructed historical balances. Line-item populations
overlap and must not be added together or treated as completed cases.

The persona cards remain role templates until an approved organisation/identity bridge exists.
The Personas stage traces each template to its SAP source view, rows, fields and measures; the
Agents stage shows that the agent-to-process link is still missing and the ways to add one.
Agent attribution, cost allocation, baseline/comparison studies and D365 are explicitly
unconfigured; the app does not infer them from names or divide current AI spend by old process
history. Keep all private source definitions, identifiers and query captures out of the public
repository and public feedback demo.

### Agents and automation impact

**Agents & automation** is a first-class Business impact tab, linked from the Bottom line.
The static scenario lets the reader select an agent and follow its explicit persona/process
assignment to a process step, intended mode, accountable owner, outcome and quality measures.
The outcome comparison remains a **simulated process-level rollout result**, not an isolated
agent effect. Its 12-week comparison is separate from the last-30-days agent activity window.
Session resolution is not business completion; scenario cost per linked case uses linked cases
directly and does not apply the session-resolution rate.

The public Outcome explorer offers a candidate workflow for each role, including roles without
source records. These are authored concepts, not installed agents, discovered mappings or
observed automation. It reports no automation rate, agent cost or attributable change from the
public samples. The connected view likewise keeps the missing mapping and execution evidence visible.

The proposed integration needs three distinct layers: owner-approved mappings keyed by source,
environment and stable agent ID/version to process/step, persona/team and rollout/validity dates;
run/action events linked to source-scoped business cases with completion and intervention evidence;
and an outcome comparison with aligned cohorts, baseline, quality checks and uncertainty.
Intended autonomy is not observed straight-through completion. Unknown intervention history
remains unknown, and cases touched by multiple agents or personas are deduplicated.
Mapping persistence, execution ingestion and causal estimation are **not implemented** by this preview.

### Where personas and mappings come from

There are two deliberately separate implementations:

- **Connected view:** `impactPersonas` in
  `src/queries/business-impact/process-scorecard.ts` is an authored list of six role templates.
  Each entry explicitly selects a process, headline metric ID, review signal and source lineage.
  `live.tsx` finds the reading by that metric ID; `impact-lineage.tsx` lists metrics with the
  same process. This attaches **process measures to a role template**, not documents to a
  verified employee cohort. No title classifier, employee-membership query or AI inference runs.
- **Static preview:** `personas` and `processAgents` in `scenario.ts` are authored fixtures.
  `discovery.ts` adds title aliases, fit labels, initial statuses and suggested processes by hand.
  `fromPersona()` copies the scenario's assigned process and counts; it does not match titles.
  Agent assignments are explicit fixture fields. A non-empty owner seeds the sample
  `Confirmed` status; that is not proof of approval. Connect changes React state on that page
  only, does not persist, and does not change the Personas page or join live data.

The connected role-to-process assignments are:

| Authored role | Assigned process | Source population |
|---|---|---|
| Accounts payable | Invoice to pay | Supplier accounting lines (account type `K`) and invoice items |
| Accounts receivable | Order to cash | Customer accounting lines (account type `D`) |
| Procurement operations | Requisition to order | Non-deleted requisition items |
| Strategic sourcing | Source to contract | Non-deleted purchase order items |
| Sales operations | Order fulfilment | Sales document items |
| Finance and close | Record to report | General ledger lines |

Real persona membership needs three distinct, owner-approved mappings. These names describe
the **proposed contract**; this app does not yet provision, import or query these tables:

| Proposed table | Mapping |
|---|---|
| `impact_persona_map` | Job title or role, scoped by department/organisation, to persona |
| `impact_org_map` | Source system + company + cost centre/purchasing/sales group to DataHub org key, with effective dates |
| `impact_agent_process_map` | Stable agent ID to process, with owner and explicit approval |

An optional `impact_user_map` would map source-system user/personnel IDs to DataHub identities
only after validation and privacy review. A supplier, customer or creator ID is not a safe
employee join. Agent-case links additionally need run/action events carrying stable business
document keys; an agent's title, declared purpose or process assignment does not establish them.
AI attribution still needs aligned periods, rollout dates and a defensible comparison design.

For example, approved AP-title rules would identify an AP cohort; a separate team bridge would
select the corresponding supplier items; and an owner-approved agent mapping would identify an
invoice-support agent. Only then could DataHub place that cohort's AI use beside the team's
process outcomes. Actual agent intervention on an invoice would require case-level event evidence.
Unmatched or ambiguous records must remain visible rather than being silently assigned.

For private-data regression checks, set `DATAHUB_IMPACT_FIXTURES` to an external directory with
SDK JSON captures named `scorecard.json`, `history.json`, `scorecard-year.json` and
`scorecard-empty.json`. The scoped captures also record their `selectionYear`. Then run
`npx vitest run src/queries/business-impact src/screens/business-impact` from this folder.
Without that directory, private-data and chart-geometry cases are skipped; error-handling,
configuration and query-filter tests still run.

For a team-feedback build, run `npm run build:demo:impact`. It produces the same
static bundle, opening Business impact by default while preserving explicit hash links to
other pages. Both HTML entry points request `noindex, nofollow, noarchive`; this is **not access
control**. Host the whole `dist-demo` directory at a new site path and keep existing demos
unchanged. If the preview should be unlisted, do not add navigation links to it. Anyone who
discovers the URL or public repository can access it. Use only
synthetic data, and verify in a signed-out browser before sharing. No download or sign-in is
needed for viewers of the hosted version.

The demo build retains the compatibility flag `VITE_DATAHUB_PREVIEW=true` to use DataHub App in desktop and mobile
navigation, cross-vendor copy and report exports. Its HTML title, description and bundled
README use DataHub App too. Existing demo links remain unchanged. Ordinary builds also retain
main's DataHub App branding; deployment identifiers and access-group names are unchanged.
Set the build-time `VITE_APP_NAME` only when a deployment needs its own display name, such as
`DataHub - Demo`; this does not rename its Fabric item or change other deployments.

## Deploy it by hand

You need:

- A published ValueLens semantic model, from the [Fabric](../1-fabric/README.md) or [Azure](../2-azure/README.md) path.
- A workspace on Fabric capacity (F2 or larger, or a trial). *My workspace* won't work.
- The tenant settings **Fabric Apps (preview)** and **Semantic Model Execute Queries REST API** turned on.
- [Node.js](https://nodejs.org/) 24.15 or later, or 22.22 or later.

From this folder (`app`):

1. Run `npm install`.
2. In [`fabric.yaml`](fabric.yaml), replace `workspaceId` and `itemId` under `vl` with your
   ValueLens model's IDs. They're in the model's URL:
   `app.powerbi.com/groups/<workspaceId>/datasets/<itemId>`. Do the same under `cc` for
   Consumption Central and `ae` for Agent Evaluator, or delete those blocks to hide their pages.
   Optionally configure `bi` for the connected Business impact model described above.
3. Deploy, and sign in when asked:
   ```powershell
   npx rayfin up --workspace-uri "https://app.fabric.microsoft.com/groups/<workspace-id>"
   ```
   Add `--tenant <tenant-id>` if your account spans tenants.
4. Open the **Fabric portal** link it prints. The app shows **DataHub App**, while its deployment item
   retains **Analytics Hub** for compatibility. See
   [Names and compatibility](../docs/INSTALL.md#names-and-compatibility).
5. Share it. Each person needs:
   - the app: *Run and interact* on the item (share it with a group once), not a workspace role
   - the data: **Build** on each model the app reads

   The installer does this with one group, **Analytics Hub Viewers**. By hand, add an `access`
   object to `fabric.config.json` so the app shows who to ask and links to the group:
   `{ "groupId": "<object id>", "groupName": "...", "contact": "you@example.com", "requestUrl": "https://..." }`
   (`requestUrl` is optional and must be https).
6. Optional: to link the **Ask** page to a Fabric data agent, add
   `"ask": { "workspaceId": "<workspace id>", "itemId": "<data agent id>" }` to `fabric.config.json`.
   The installer creates the agent and adds this for you; see [Ask](../installer/README.md#ask).
   Without it the page lists suggested questions and how to turn Ask on. When the connected
   Business impact model is also bound, the page suggests Business impact questions too; the
   agent needs that model as a source to answer them (the installer's agent does not add it).

To update it, get the released app source and dependencies, keep the existing deployment and
model bindings, then run `npx rayfin up` again. Changes that require new model definitions,
including the expanded **Group by**, need the model update and successful refresh first; an
app-only redeploy is not enough. For installer-managed deployments, use
[Update](../docs/UPDATE.md#update-an-existing-installation-for-the-expanded-group-by) instead.

## Settings in the app

### Question-led navigation

The sidebar follows Overview, Adoption, Cost & consumption, Value, Business impact, Optimise,
Expand and Governance. Chapters only appear when their underlying models are available.
Adoption includes Engagement, Leaderboards, Work patterns and Feedback. Governance includes
Agent quality. Expand includes rollout readiness and optional Business impact opportunities.
Licence and Cowork readiness each open with a map of where to expand next: the current Group by
(Organization by default) placed in tiers relative to the median group. Tiers rank groups for
review; they are not a forecast. The Adoption heatmap shows every cell's value; long ranges open
at the earliest weeks so the group labels stay in view.
Idle licences sit in Optimise; the separate heavy-users-without-a-licence stage is retired.
Ask agent opens alongside the report (full-screen on smaller displays); its Fabric mode still
opens the configured data agent in Fabric rather than claiming an embedded chat backend.
Adding a source to the app does not automatically connect it to that agent.
Reference and report packs remain separate.

Existing destination URLs continue to work under the new chapter labels. Source-specific filters,
permissions and freshness remain attached to the underlying view rather than applying a
chapter-wide filter to unrelated models. Vendor scope is preserved in shared URLs.
Microsoft is the default; All connected vendors reveals contextual vendor topics and panels.
The current vendor integration preview remains explicitly synthetic, not live tenant data.

Chargeback / showback allocates Cowork and Work IQ weekly usage by its recorded spending policy
or the current `Cost Centre Label` organization attribute. Missing, placeholder and ambiguous
values remain unallocated. The viewer-visible credit pool applies configured prepaid capacity
once before distributing prepaid/PAYG usage cost pro rata. It reconciles allocations to selected
usage, respects model access, and does not present allowances as finance budgets or estimates as
invoice postings. Current organization membership is not historical funding responsibility.
Studio, Azure and GitHub are excluded; their allocation mappings and native units are separate.

Cowork right-sizing under Optimise reads the model's existing seat actions, recommended limits,
usage cohorts and breach signals from the latest billing snapshot. It does not recompute
thresholds, mutate policies or equate lower allowances with realised savings. The public CSV
demo has no recommendation snapshot and shows that limitation rather than inventing actions.

Forecast is a local what-if planner under Cost & consumption. It uses up to four reported complete
weeks available to the viewer, with explicit adoption, intensity, rollout-wave and prepaid-credit
assumptions. Credits deplete cumulatively; purchases and consumed cost are separate.
Low/base/high are sensitivity scenarios, not confidence intervals. The planner excludes expiry,
tax and invoice reconciliation, never orders packs, and does not change saved commercial terms.

### Shared commercial settings

Anyone who can open the app can change these, and the change applies for everyone. Share the item
only with people who should.

- **Rates & packs** (Consumption page): your pay-as-you-go rate, prepaid rate and Capacity Pack
  balance. Leave a box empty to keep the model's value.
- **Monthly budgets** (Consumption page): an optional monthly budget for Cowork / Work IQ, Copilot
  Studio and Azure, for the Budget runway section. Leave a box empty for no budget.
- **Prices** (Value page, Cost vs value): the Copilot licence price ($30 if empty), the reporting
  currency for the Value page (US dollars unless the installer set another) and, for any other
  currency, the exchange rate per $1.
- **Time per task** (Assumptions page): the minutes each task would take without Copilot.
  **Use research** puts them back.

The app saves these in a small SQL database under its item. The Power BI report doesn't see them.
See the [customisation guide](../docs/CUSTOMISE.md) for common changes and the
[security and privacy guide](../docs/CUSTOMIZATION-AND-SECURITY.md) for access boundaries, RLS and
identity-privacy limitations.

## Reports

A report pack is a named, ordered list of sections taken from any page. Packs are listed under
**Reports** in the sidebar.

- **Built-in packs.** *Exec pre-read*, *Finance weekly* and *Adoption review* come with the app.
  You can't edit or delete them, but **Save a copy** starts a new pack from one.
- **Your packs.** **New pack** opens an editor where you name the pack, tick sections from each
  page, and put them in order. On Fabric anyone who can open the app can save, edit or delete a
  pack, and it changes for everyone. On Azure that needs the `AnalyticsHub.Admin` role. Packs are
  stored with the other settings: in the app's SQL database on Fabric, and in Table Storage on
  Azure.
- **Missing sections.** A pack skips a section whose page is hidden because its optional data
  hasn't arrived, and says which ones it left out.
- **Download PDF** and **Download PowerPoint** are on every page and every pack. Both show the
  filters in use and the date the data runs to, and the file is named after it, such as
  `exec-pre-read-data-to-2026-10-11.pdf`. The PDF uses the browser's print dialog: choose
  **Save as PDF**. Where the browser can't open a print dialog, the report downloads as an HTML
  file you can print later. The PowerPoint deck opens with a cover listing the filters, the data dates and any
  sections left out, then has one slide per chart or table.
- **Download CSV** on each chart and table also adds the data date to the file name.

## Change the app

| Task | How |
|---|---|
| Preview live | `npm run dev`, then open the app in Fabric with `&devUri=http://localhost:5173` on the URL |
| Test | `npm test` and `npm run lint` |
| Edit a query | `src/queries/<page>/`: a `.dax` query and a `.ts` definition per visual |
| Edit a page | `src/screens/<page>/` |

Don't commit your IDs in `fabric.yaml` or the redirect URI that `rayfin up` adds to
`rayfin/rayfin.yml`. Its local state files are gitignored.

The installer ships one build for every tenant, so it reads the model IDs from a
`fabric.config.json` deployed next to the app. Newer files also include a `modules` block for the
optional module choices. A deploy from this folder uses `fabric.yaml` instead. See
[`src/lib/runtime-config.ts`](src/lib/runtime-config.ts).
[`AGENTS.md`](AGENTS.md) has the conventions for coding agents.

## How it works

### Group by

**Group by** offers the supplied attributes in your org data, including custom columns,
business codes, hierarchy levels, numbers, booleans and dates, even constant or entirely blank
columns. **User ID** groups by the existing normalized person key. Supplied identity fields
and names are eligible; generated hierarchy paths and internal processing fields stay out.
There is no maximum number of distinct groups, and existing viewer access restrictions still apply.

The main app and Agent Evaluator discover their own model's attributes rather than sharing a
fixed field list. The Evaluator keeps its eligible Agent and Topic choices and loads its org
attribute inventory when you open **Group by**, not with the landing page. Cowork and Studio
read their model's org attributes, including individual-user and sparsely populated groupings,
while retaining their product-specific usage intensity choices.

Attribute discovery does not fetch every attribute's value list. The main app reads the
model's `Org Attribute Source` membership table for its attribute inventory in one query;
only the selected attribute's values load when a filter
menu opens. Numbers, booleans and dates are serialized by the model into invariant text for
grouping and filtering, without changing source column types.

The updated model templates build that membership table from all source org columns on
each refresh. New columns therefore become available after the data loads and the model
refreshes, without manually adding a model column for each attribute. An existing installation
needs the updated model definition as well as the app; an app-only update cannot expose
attributes an older model has not loaded.

<details>
<summary><strong>Pages that need optional data</strong></summary>

The app leaves out pages and sections whose optional data hasn't arrived. When it opens, it
counts the rows in the ValueLens model's optional sources (unfiltered), in one query. **Feedback**
needs `ProductFeedback` and **Work patterns** needs `M365 Activity`. Without registry data, **Governance**
reads the Copilot Studio agents Azure Resource Graph loads, says above each tab what that leaves out,
and only asks for a source when neither has data. The **Agents** leaderboard
drops its registry columns. Governance's **Shadow AI** section needs `Defender Status`, and says how to
turn Defender on without it; it doesn't depend on the registry. Newer installer builds also write which optional modules were switched
off into `fabric.config.json` (on Azure, the web app serves them in `/app.config.json`); those
pages stay hidden without probing until the admin turns the module on. Everything shows while the
check runs, or if it fails, and a page comes back on the next open once its data loads.

</details>

<details>
<summary><strong>How pages load</strong> (built for about 20,000 people)</summary>

<a id="how-pages-load"></a>

The app is built to stay quick for a large tenant (about 20,000 people):

- **The last 12 weeks by default on a large tenant.** When more than 10,000 people have Copilot
  activity, the date filter starts at **Last 12 weeks**: the 84 days to the last day with activity.
  The filter bar shows the dates and says it's the default for large organizations; **Show all
  dates** widens it in one click. Each query works out the tenant's size and the 12 weeks itself,
  so the first page doesn't wait for the filter options. A smaller tenant starts on **All dates**.
  **Reset filters** goes back to the tenant's default. Consumption Central and the Agent Evaluator
  keep every date until you choose a range, and say so on a large tenant. `LARGE_TENANT_PEOPLE` in
  `src/lib/filters.ts` sets the threshold.
- **One tab at a time.** Each page shows one section at a time, as tabs, and opening a tab runs
  only that tab's queries. Downloads and report packs still include every section.
- **The first page asks only what it shows.** The Executive summary opens with eight queries, or
  nine with org-scoped access. Load status and org attribute discovery, including its bounded
  eligibility check, load in the background. When a
  filter menu other than the dates first opens, the menus' choices load, so that first open can
  take about a second, or a few if the org columns haven't loaded yet. The org columns then move on
  screen, as they do when a breakdown by org shows. See [How the app opens](../docs/ARCHITECTURE.md#how-the-app-opens).
- **Long lists wait for a click.** The leaderboard ranking and the by-organization and by-person
  lists load when you choose **Show …**. The cards above them still count everyone, and downloads
  and report packs still print the lists in full.
- **The next pages load in the background.** Once the page on screen has loaded, the app fetches
  the first tab of the next two pages in the menu, one query at a time, and waits whenever the page
  on screen is loading. Opening another page fetches the two after that one. If you open a page
  while its query is waiting, the query starts at once. `PREFETCH` in
  `src/components/prefetcher.tsx` turns this off, and `PREFETCH_AHEAD` in
  `src/components/prefetch-targets.ts` sets how many tabs are fetched.
- **A busy model slows down on its own.** If Power BI throttles a model, even inside a normal
  reply, only that model's queries wait: 1, 2, 4, 8, then 15 seconds, one query at a time, for
  up to a minute. A `Retry-After` is kept in full: if it's longer than the wait left, the card
  gives up at once rather than ask the model early. Then the card shows **Power BI is busy**, and
  **Try again** asks the model, not the cache. Once the model answers any query again, every card
  that showed busy, and the filter choices, ask again by themselves, with no click, however many
  cards share the query; a page you open after a throttle sends its queries rather than giving up
  at once. Background loading from that model stops for at least a minute, and until a query to
  it on screen succeeds. Other query errors aren't retried or shown as busy, even one about a
  table called `Rate Limit` or `Power BI is busy`. A card you leave stops waiting; a query already
  sent still finishes. A card that switches query or model shows only its current query's result
  and busy state, never its old one's. The browser console logs each step (`DataHub App: …`).
- **Results last for the visit.** The app holds up to 1,000 results in memory, each for up to an
  hour, so a page you've seen opens again without asking the model. Nothing is kept between opens.
  A preview build stored results in IndexedDB (`analytics-hub-results`); the app deletes that
  database as it starts.
- **Cowork and Copilot Studio credits by group** don't offer per-person groupings (User, User Key,
  id, employee Id, Hierarchy Path, Level5_User Key), which took one to two and a half minutes each
  at 20,000 people. A saved grouping that is no longer offered shows **All users**.

</details>

<details>
<summary><strong>Bounded detail lists</strong> (top 1,000 rows)</summary>

<a id="bounded-detail-lists"></a>

Person and registry detail lists return the top 1,000 rows, with deterministic
tie-breakers. Consumption's Studio agent list follows the same limit. Sorting
or filtering inside a grid acts on those returned rows; use the page filters
to query another selection. Truncation notices identify omitted rows and flag
unavailable full counts rather than substituting the displayed row count.

Group and grand totals still cover the full filtered population, including
groups whose people are outside the cap. Person-row counts can include the
same person under multiple groups. Leaderboard and Studio concentration are
computed separately across all person rows, combining repeat person keys
before selecting positive values; Leaderboard returns only the top 1%, 5%
and 25% cuts, without a curve. Value by habit returns whole-population
habit totals and concentration cuts, not a truncated person list. Agent
spotlights return full-population maxima and tie counts with two named
winners; separate agents with the same display name still count separately.

These payload limits are not proof of lower model latency. Query-shape and
synthetic tests do not establish live DAX equivalence. Validate against the
same model, data, filters and assumptions before deployment; the request
scheduler's concurrency, pacing and retry protections must stay unchanged.

</details>
