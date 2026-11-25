import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RuntimeModules } from "@/lib/runtime-config";

const runtime = vi.hoisted(() => ({ modules: undefined as Partial<RuntimeModules> | undefined, demo: false }));
const fabric = vi.hoisted(() => ({ semanticModel: vi.fn() }));

vi.mock("@/lib/runtime-config", async (original) => ({
    ...(await original<typeof import("@/lib/runtime-config")>()),
    runtimeConfig: () => ({ host: "fabric", rayfin: {}, semanticModels: {}, modules: runtime.modules, demo: runtime.demo }),
}));

vi.mock("@/lib/fabric-client", () => ({
    QUERY_CACHE_MAX_AGE_MS: 60 * 60 * 1000,
    getFabricClient: () => ({ semanticModel: fabric.semanticModel }),
}));

import { availableDestinations, readsValueLens } from "@/components/destinations";
import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
import { businessImpactLive } from "./optional-modules";

const GUID = "00000000-0000-0000-0000-000000000001";
const models = { vl: { workspaceId: GUID, itemId: GUID }, cc: { workspaceId: GUID, itemId: GUID }, ae: { workspaceId: GUID, itemId: GUID } };
const ids = () => availableDestinations(models).map((destination) => destination.id);

beforeEach(() => {
    runtime.modules = undefined;
    runtime.demo = false;
    fabric.semanticModel.mockReset();
    fabric.semanticModel.mockReturnValue({ query: () => new Promise(() => {}) });
});

afterEach(() => vi.unstubAllEnvs());

describe("optional ValueLens and cross-vendor modules", () => {
    it("keeps every ValueLens page on installs that don't say", () => {
        expect(ids()).toEqual(expect.arrayContaining(["executive", "adoption", "ask", "appendix", "consumption", "agent-evaluation"]));
        expect(ids()).not.toContain("cross-vendor");
    });

    it("lists only the other models' pages when ValueLens isn't installed", () => {
        runtime.modules = { core: false };
        expect(ids()).toEqual(["consumption", "optimization", "agent-evaluation"]);
        expect(availableDestinations(models).every((destination) => !readsValueLens(destination))).toBe(true);
    });

    it("adds the cross-vendor view when the install chose it, with or without ValueLens", () => {
        runtime.modules = { crossVendor: true };
        expect(ids()).toContain("cross-vendor");
        expect(ids()).toContain("executive");
        runtime.modules = { core: false, crossVendor: true };
        expect(ids()).toEqual(["cross-vendor", "consumption", "optimization", "agent-evaluation"]);
    });

    it("never asks the ValueLens model when it isn't installed, but still asks the others", () => {
        runtime.modules = { core: false };
        const vl = renderHook(() => useSemanticModelQuery({ connection: "vl", query: "EVALUATE {1}" }));
        expect(fabric.semanticModel).not.toHaveBeenCalled();
        expect(vl.result.current.isLoading).toBe(false);
        renderHook(() => useSemanticModelQuery({ connection: "cc", query: "EVALUATE {1}" }));
        expect(fabric.semanticModel).toHaveBeenCalledWith("cc");
    });

    it("opts into Business impact through a model binding independently of ValueLens or demo flags", () => {
        runtime.modules = { core: false };
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "");
        const configured = { ...models, bi: { workspaceId: GUID, itemId: GUID } };
        expect(businessImpactLive(configured)).toBe(true);
        expect(availableDestinations(configured).map(item => item.id)).toContain("business-impact");
        expect(availableDestinations(configured).map(item => item.id)).not.toContain("executive");
        expect(businessImpactLive({ bi: { workspaceId: "<workspace>", itemId: GUID } })).toBe(false);
    });

    it("never selects live Business impact in a static demo, even with a model binding", () => {
        runtime.demo = true;
        vi.stubEnv("VITE_BUSINESS_IMPACT_DEMO", "");
        const configured = { bi: { workspaceId: GUID, itemId: GUID } };
        expect(businessImpactLive(configured)).toBe(false);
        expect(availableDestinations(configured).map(item => item.id)).not.toContain("business-impact");
    });
});
