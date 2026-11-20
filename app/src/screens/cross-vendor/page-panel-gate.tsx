import { lazy, Suspense, type ComponentType } from "react";
import { useStageFilter } from "@/hooks/stage-filter.context";
import { crossVendorOn } from "@/lib/optional-modules";
import { useVendorScope } from "@/hooks/vendor-scope.context";
import type { CrossVendorPage } from "./page-panels";

let Panel: ComponentType<{ page: CrossVendorPage }> | undefined;

/** A cross-vendor panel on an existing page; nothing renders (or loads) unless the cross-vendor view is on. */
export function CrossVendorPanel({ page }: { page: CrossVendorPage }) {
    const { inPack } = useStageFilter();
    const { scope } = useVendorScope();
    if (!crossVendorOn() || inPack || scope !== "all") return null;
    Panel ??= lazy(() => import("./page-panels"));
    return <Suspense fallback={null}><Panel page={page} /></Suspense>;
}
