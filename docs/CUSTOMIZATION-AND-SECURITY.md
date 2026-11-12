# Security and privacy setup

For the **DataHub App for Microsoft Copilot, Agents, Cowork and Autopilots**. For common changes,
see the [customisation guide](CUSTOMISE.md).

## Set up row-level security

App access, semantic-model RLS and page filters solve different problems:

- **App/backend access** controls who can open the application and query its models.
- **Power BI RLS** restricts rows returned by the semantic model for the signed-in viewer.
- **App/report filters** change what is displayed; they are not access controls.

Hidden tables and columns are not access controls either. Anyone with model Build or query access
may still read them; grant that access only to people allowed to see the underlying identities.

### DataHub App: org-scoped access

The DataHub installer already provides opt-in org-scoped RLS. Use its existing setup rather than
adding another scope system:

1. Confirm the installer has deployed the semantic model and the viewer group. Keep ordinary
   viewers out of workspace Admin, Member and Contributor roles; those roles bypass RLS.
2. Run the installer command `access`, choose **Turn on org-scoped access**, and follow the prompts.
   If there are no saved scopes, it seeds current viewers with an everyone scope. New viewers
   need an explicit scope or an approved default scope.
3. Choose whether scopes match **department** or **country**. Add a scope for each viewer: everyone,
   an org value, or people below a manager. Manager scopes require sufficiently complete manager
   data. Tenant-wide pages are shown only to viewers with an everyone scope.
4. In Power BI Service, open each semantic model's **Security** page. Remove any existing viewer
   group or other broad assignment from **Everyone** before using scoped access: a person assigned
   to both roles gets their combined access. Assign the viewer group to **Scoped viewers** and
   assign **Everyone** only to individually approved all-data readers. Until members are assigned,
   viewers cannot read the redeployed models, so do this straight after the installer finishes.
5. After a later scope change, choose **Apply now** in the installer's `access` command to reload
   scopes and refresh the models straight away; otherwise the change waits for the next scheduled
   load. On Azure, scoped delegation in **Share** is available only when org-scoped access is
   enabled. On Fabric, use the installer for scope administration.
6. Verify with a least-privileged test viewer in the app and Power BI Service. Confirm the viewer
   sees only assigned orgs; viewers without an applicable scope see no rows. Compare all-data totals
   too: **Scoped viewers** can exclude activity without matching org data even with an everyone
   scope. Workspace Admin/Member/Contributor roles bypass RLS.

The installer loads and refreshes scope data, but does not assign role membership. After every model
redeploy, recheck or restore membership on the semantic model's **Security** page.

To reverse, choose **Turn off org-scoped access** in `access`. The models are redeployed and
refreshed without the roles, so everyone who can read them sees all data again. The saved scopes are
kept in case you turn it back on.

Azure installs with private networking cannot currently use the installer scope-file flow because
the installer machine cannot reach that storage path. See
[Permissions: org-scoped access](PERMISSIONS.md#org-scoped-access-row-level-security) for scope
semantics, upgrades and limitations. Role membership for the planned single Power BI report is also
an explicit Power BI Service administrator step; do not automate it through APIs, MCP or TMDL.

### ValueLens

ValueLens is maintained in a separate repository. Use its
[Permissions guide](https://github.com/microsoft/ValueLens-for-Microsoft-Copilot/blob/main/docs/PERMISSIONS.md#org-scoped-access-row-level-security)
and the setup instructions for the specific deployment path. Confirm that path's current RLS
support before relying on it; a UI filter or an org attribute by itself does not enforce access.
The active Fabric, Azure, SharePoint and Local CSV variants must be documented separately where
their setup differs. The archived Power Automate + Dataverse path is not a supported setup target.

## User-ID hashing and pseudonymization

**There is no supported end-to-end user-ID hashing switch in the current DataHub App or ValueLens
ingestion paths. Do not enable a product toggle or use a tenant-wide masking setting as a substitute.**

In particular, Microsoft 365's **Display concealed user, group, and site names in all reports**
setting can make the returned IDs non-joinable to organization and license data. Viva exports can
also contain hashed IDs when identification is off; those IDs cannot be matched to the user
directory. A transcript field named `user_id_hash` is not proof of hashing: the current transcript
ingestion uses the raw Entra object ID in that field to preserve joins.

The planned pseudonymization capability is opt-in and off by default. When supported end to end,
it must:

- Resolve related sources to one canonical person identity first, preferring a stable Entra object
  ID and using a protected crosswalk for UPN-only sources.
- Derive the same tenant-scoped, keyed `PersonKey` across compatible person-grain facts and
  dimensions. Keep unmatchable sources at org/date grain instead of inventing joins.
- Use HMAC-SHA-256 and include `KeyVersion`; keep the authenticated-principal map in a separately
  protected table with `TenantId`, `PrincipalUPN_Normalized`, `PersonKey`, `KeyVersion` and
  `IsActive`. Filter it to the authenticated caller, deny ordinary visual access to it and fail
  closed when a principal has no active mapping.
- Keep the key in an approved secret store, never in the app, report model, logs or source control.
  Keep the authenticated-principal-to-`PersonKey` map separately protected, filtered to the signed-in
  viewer and unavailable to ordinary report visuals.
- Reprocess all related history and rebuild the map/model as one coordinated cutover. A key
  rotation changes identifiers, so it also requires a full reprocessing and refresh before joins
  work again. Reversal requires the original source identities or a recoverable protected mapping.

Pseudonymization is not anonymity: stable keys still link a person's records, and the protected
identity map can associate a key with a real account. Until the full capability is implemented and
documented for a path, leave its current ingestion settings unchanged and don't delete source data
in anticipation of hashing.
