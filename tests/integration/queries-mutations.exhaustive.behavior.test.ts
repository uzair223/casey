import { describe, it } from "vitest";
import {
  assertConnectedSupabaseEnv,
  invokeAllExportedFunctions,
} from "./live-connected-utils";

import * as allQueries from "@/lib/supabase/queries";
import * as allMutations from "@/lib/supabase/mutations";

describe("queries/mutations exhaustive connected behavior", () => {
  it("executes all query exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions("queries", allQueries);
  });

  it("executes all mutation exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions("mutations", allMutations);
  });
});
