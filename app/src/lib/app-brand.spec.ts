//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { afterEach, describe, expect, it, vi } from "vitest";
import { appDisplayName, appDisplayNameWithArticle } from "./app-brand";

afterEach(() => vi.unstubAllEnvs());

describe("app branding", () => {
    it("keeps the current product name without the preview flag", () => {
        vi.stubEnv("VITE_DATAHUB_PREVIEW", "");
        expect(appDisplayName()).toBe("DataHub App");
        expect(appDisplayNameWithArticle()).toBe("a DataHub App");
    });

    it("uses DataHub App for an explicitly enabled preview", () => {
        vi.stubEnv("VITE_DATAHUB_PREVIEW", "true");
        expect(appDisplayName()).toBe("DataHub App");
        expect(appDisplayNameWithArticle()).toBe("a DataHub App");
    });

    it("uses a deployment-specific name without changing the product default", () => {
        vi.stubEnv("VITE_APP_NAME", " DataHub - Demo ");
        expect(appDisplayName()).toBe("DataHub - Demo");
        expect(appDisplayNameWithArticle()).toBe("a DataHub - Demo");
        vi.stubEnv("VITE_APP_NAME", " ");
        expect(appDisplayName()).toBe("DataHub App");
    });
});
