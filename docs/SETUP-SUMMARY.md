# Set-up summary

A one-page plan for setting up the DataHub App: each step, who does it, what's on by default and
where the detail lives. Follow the steps in order. For more detail, see [Prerequisites](PREREQUISITES.md)
and [Install](INSTALL.md).

## Which version this covers

- This guide covers the latest installer release, **0.6.9**, and `main`. The steps are the same in
  both, except for org-scoped access. In 0.6.9, the installer adds the Power BI role members. On
  `main`, an administrator assigns the viewer group to **Scoped viewers** in Power BI Service >
  semantic model > **Security**. See
  [Row-level security](CUSTOMIZATION-AND-SECURITY.md#datahub-app-org-scoped-access).
- Things you install keep their names, such as **Analytics Hub Model**, the **Analytics Hub
  Viewers** group, the `Analytics Hub - …` flows and `ValueLens - Fabric.pbit`. See
  [Names and compatibility](INSTALL.md#names-and-compatibility).
- This guide doesn't cover the optional business-impact and cost views in
  [#255](https://github.com/microsoft/DataHub-App-for-Microsoft-Copilot-Agents-Cowork-and-Autopilots/pull/255),
  which isn't merged yet.

## 1. Choose where it runs

| | Fabric | Azure |
|---|---|---|
| Runs in | A Fabric workspace: Lakehouse, notebooks and a pipeline | Your resource group: Container Apps jobs, storage and a web app, with the models in a Power BI workspace |
| You need | An F2-or-larger capacity or a trial | Owner, or Contributor plus User Access Administrator, on the subscription or resource group ([least privilege](AZURE-LEAST-PRIVILEGE.md)) |
| The app | A Fabric App item | A web app, with an optional Teams app |
| Set up with | The [installer](INSTALL.md) or [by hand](MANUAL-INSTALL.md) | The [installer](INSTALL.md) or [by hand](MANUAL-INSTALL.md#azure) |

Both targets need Power BI Pro or PPU and permission to register an app. For costs, see
[Running costs](ARCHITECTURE.md#running-costs).

## 2. Line up the admins

Ask only the admins you need. For every permission, see [Roles and permissions](PERMISSIONS.md).

| Who | What they do | Needed for |
|---|---|---|
| Fabric admin | Turns on **Service principals can call Fabric public APIs**, **Semantic Model Execute Queries REST API** and **Allow visuals created using the Power BI SDK**. On Fabric, also turns on **Users can create Fabric items** and **Fabric App items**. | Both targets. Azure needs the first one so the models can refresh. |
| Entra admin (Global or Privileged Role Administrator) | Grants admin consent. On Azure, grants it for both the app and its managed identity. | Both targets |
| Compliance admin | Checks that Purview audit is on. New audit records can take 60 minutes to 24 hours to appear. | Both targets |
| Microsoft 365 admin | Turns off **Display concealed user, group, and site names in all reports**, so names show in activity reports. | Optional |
| Teams or Global Administrator | Runs the installer so it can publish the Teams app, or uploads the app by hand. The installer's Teams sign-in needs admin consent for `AppCatalog.ReadWrite.All`. | Azure, if you want the Teams app ([details](PERMISSIONS.md#publishing-the-teams-app)) |
| Power Platform admin | Signs in once to the Copilot Studio credits flow. | Only if you choose that flow ([details](PREREQUISITES.md#optional-extras)) |
| Viva Insights analyst | Creates the Cowork consumption query and sends you its IDs. | Only if you choose Cowork credits ([steps](VIVA-QUERY.md)) |
| Privileged Role Administrator | Gives **Analytics Hub Data Collector** the Global Reader role. | Only if agent configuration comes from Azure Resource Graph |

Viewers need Pro or PPU, unless the workspace is on F64 or larger, and need to be in
**Analytics Hub Viewers**. See [Viewing DataHub App](PERMISSIONS.md#viewing-datahub-app).

## 3. Pick data sources

The installer shows each source as a card with three choices: **Connected (API)**, **Upload CSV**
or **Skip**. See [Data sources and exports](../installer/README.md#data-sources-and-exports).

| Group | Sources |
|---|---|
| Always on | Audit log and licences, and org data |
| On by default | Microsoft 365 activity |
| Off by default | Workday (CSV only), Agent 365, product feedback, Copilot Studio credits, Copilot Cowork credits, Azure AI, Agent Evaluator, Defender, Azure Resource Graph |
| By hand (Fabric) | GitHub Copilot and commercial terms, from the [credit consumption notebooks](../fabric/Add%20Credit%20Consumption/README.md) |

- **Audit source.** On Fabric, audit comes from the Office 365 Management Activity feed by default.
  On Azure, it comes from Microsoft Graph.
- **Uploads.** On Fabric, CSV files go in `Files/analytics_hub_uploads`. On Azure, they go in
  `landing/<kind>/`.
- **Credit consumption** covers Copilot Studio, Cowork and Azure AI. See
  [Credit consumption](../installer/README.md#credit-consumption).

## 4. Run the installer

1. Start it with `irm https://github.com/microsoft/AnalyticsHub-Dashboard/releases/latest/download/install.ps1 | iex`,
   or [another way](INSTALL.md#other-ways-to-start-it).
2. Choose **Set up DataHub App**, choose Fabric or Azure, and answer the questions. This takes
   about 5 minutes.
3. Approve the plan, then wait about 15 minutes.

On Windows, your answers are saved in `Documents\Analytics Hub\valuelens-install.json`. Keep that
folder: the installer uses it to check status, update and repair. For the full walkthrough, see
[Run it](INSTALL.md#run-it).

## 5. Know the schedule

| What | When (UTC) |
|---|---|
| Copilot Studio credits and agent inventory flows | An hour before the main run |
| Main run | Daily at 02:00 by default, or weekly |
| Azure Power BI refresh | An hour after the main run starts, so 03:00 by default |

- **Each run** re-reads the last 7 days of audit records, or 3 days for a large tenant, to pick up
  late records.
- **Incremental refresh.** The audit table refreshes the last 7 days within a rolling 12 months.
  When the installer or the Azure job deploys the model, Microsoft 365 activity refreshes the last
  35 days.
- **The first load.** On Fabric, a new install reads the last 7 days of audit in one run. A new
  feed subscription can take up to 12 hours to show records. On Azure, the first load reads 30 days
  of audit. See [How long the first load takes](../installer/README.md#how-long-the-first-load-takes).
- **Load status.** On Fabric, the pipeline's last step, `Record_Load_Status`, writes each source's
  result to `dbo.load_log`. It runs after the model refresh, so the model shows the previous run's
  status. See [Load status and reruns](../installer/README.md#load-status-and-reruns).

## 6. Check it worked

1. Do the steps on the Done page: share the app with the viewer group, sign in to any flows, and
   send each admin the message the page gives you. See [After it finishes](INSTALL.md#after-it-finishes).
2. Run **Check status** (`status`) and check the card for each source.
3. Open the app. Each page shows the latest date its sources hold.

If a source fails, choose **Rerun failed loads** (`rerun-failed`). See
[Check it worked](INSTALL.md#check-it-worked) and [Troubleshooting](TROUBLESHOOTING.md).

## 7. Keep it running

- **Secrets expire.** **Check status** warns you 30 days before a secret expires. To replace it,
  choose **Create new secrets** (`rotate-secret`). See [Secrets expire](UPDATE.md#secrets-expire).
- **Update or Repair** with the installer. See [Repair or change, or Update](UPDATE.md#repair-or-change-or-update).
  On `main`, a model deploy removes role members, so after an Update or Repair, check
  **Scoped viewers** membership again.
- **Remove it.** See [Uninstall](UPDATE.md#uninstall).

## Reference

- [Architecture and costs](ARCHITECTURE.md): what it collects and how it runs.
- [Data dictionary](DATA-DICTIONARY.md): tables, columns and measures.
- [How the value is calculated](METHODOLOGY.md).
- [Installer reference](../installer/README.md): every setting and source.
