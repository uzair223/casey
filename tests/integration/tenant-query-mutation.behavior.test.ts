import { describe, it } from "vitest";
import {
  assertConnectedSupabaseEnv,
  invokeAllExportedFunctions,
} from "./live-connected-utils";

import * as tenantQueries from "@/lib/supabase/queries/tenant";
import * as tenantMutations from "@/lib/supabase/mutations/tenant";

describe("tenant queries/mutations connected behavior", () => {
  it("executes tenant query exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions("queries.tenant", tenantQueries);
  });

  it("executes tenant mutation exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions("mutations.tenant", tenantMutations);
  });
});
