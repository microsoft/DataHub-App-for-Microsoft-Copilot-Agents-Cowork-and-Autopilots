/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployment-specific name; defaults to the standard DataHub branding. */
  readonly VITE_APP_NAME?: string;
  readonly VITE_CROSS_VENDOR_DEMO?: string;
  /** Shows the synthetic Business impact (SAP process data) preview. */
  readonly VITE_BUSINESS_IMPACT_DEMO?: string;
  /** Enables the optional public-reference explorer in the demo; does not configure any connectors. */
  readonly VITE_BUSINESS_OUTCOME_SAMPLES?: string;
  readonly VITE_GITHUB_COPILOT_DEMO?: string;
  /** Shows the synthetic Cloud and AI spend mock-up (FOCUS-style cost reporting). */
  readonly VITE_FINOPS_DEMO?: string;
  readonly VITE_DATAHUB_PREVIEW?: string;
  /** Rayfin API base URL (e.g. http://localhost:5168). */
  readonly VITE_RAYFIN_API_URL?: string;
  /** Rayfin publishable key (pk-...). */
  readonly VITE_RAYFIN_PUBLISHABLE_KEY?: string;
  /** Fabric workspace ID — maps to FabricAuthOptions.workspaceId. */
  readonly VITE_FABRIC_WORKSPACE_ID?: string;
  /** Fabric/Rayfin item ID — maps to FabricAuthOptions.projectId. */
  readonly VITE_FABRIC_ITEM_ID?: string;
  /** Fabric portal base URL (e.g. https://app.fabric.microsoft.com/). */
  readonly VITE_FABRIC_PORTAL_URL?: string;
  /** Tenant the app is deployed to; opens the Fabric item link in that tenant. */
  readonly VITE_FABRIC_TENANT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}