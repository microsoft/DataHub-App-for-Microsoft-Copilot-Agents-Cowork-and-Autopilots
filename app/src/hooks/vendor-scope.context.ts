import { createContext, useContext } from "react";
import type { VendorScope } from "@/lib/narrative";

export const VendorScopeContext = createContext<{
    scope: VendorScope;
    setScope: (scope: VendorScope) => void;
}>({ scope: "microsoft", setScope: () => undefined });

export const useVendorScope = () => useContext(VendorScopeContext);
