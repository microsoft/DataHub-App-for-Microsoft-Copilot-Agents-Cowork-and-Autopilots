# Customise DataHub

For common changes to the DataHub App for Microsoft Copilot, Agents, Cowork and Autopilots and the
planned single Power BI report. App settings apply to everyone who can open that app; they do not
change the Power BI report or semantic model.

## App settings

### Prices

1. Open **Value** and choose **Prices**.
2. Set the Copilot licence price and reporting currency; if it is not US dollars, enter the exchange
   rate.
3. Check that the Value page updates in the selected currency. **Use defaults** restores the shipped
   values.

### Time per task

1. Open **Assumptions** and find **Time per task**.
2. Edit the minutes for the tasks you want to change, then save.
3. Check the Value page; its estimates use the saved times. **Use research** restores the defaults.

### Consumption rates and budgets

1. Open **Consumption** and choose **Rates & packs** to set rates and pack balance.
2. Choose **Monthly budgets** to set optional budgets for Cowork / Work IQ, Copilot Studio and
   Azure.
3. Check the Consumption page's cost and budget runway. **Use model values** and **Clear budgets**
   remove app-specific overrides.

### Reports and filtered views

1. Open **Reports** and choose **New pack**.
2. Name the pack, select sections and arrange their order, then save.
3. To share a filtered view instead, set the page filters and choose **Share** > **Copy link to this
   view**. Filters change what is displayed; they do not restrict access.

## Change the app or report

### DataHub App source

1. Make code changes in `app`; use `app/src/global.css` for theme tokens, `app/src/screens/` for
   pages and `app/src/queries/` for visual queries.
2. Follow the [app README](../app/README.md#change-the-app) to preview and validate.
3. Redeploy installer-managed installations through the installer so configuration and model
   bindings stay in sync.

### Planned Power BI report

1. When available, start from the report's local PBIP project and its README.
2. Edit pages, visuals, labels or theme while preserving its lean model and established identity
   contract; do not add raw user identifiers or unmatched person-level joins.
3. Validate and publish using that project's documented workflow. Keep the report's approved person
   and organization joins intact; do not expose identity fields in visuals or treat filters as
   access controls.

## Security and privacy

- [Set up row-level security](CUSTOMIZATION-AND-SECURITY.md#set-up-row-level-security)
- [User-ID hashing and pseudonymization](CUSTOMIZATION-AND-SECURITY.md#user-id-hashing-and-pseudonymization)
