import { describe, it } from "vitest";
import {
  assertConnectedSupabaseEnv,
  invokeAllExportedFunctions,
} from "./live-connected-utils";

import * as teamQueries from "@/lib/supabase/queries/team";
import * as teamMutations from "@/lib/supabase/mutations/team";

describe("team queries/mutations connected behavior", () => {
  it("executes team query exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions("queries.team", teamQueries);
  });

  it("executes team mutation exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions("mutations.team", teamMutations);
  });
});
