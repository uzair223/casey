import { describe, it } from "vitest";
import {
  assertConnectedSupabaseEnv,
  invokeAllExportedFunctions,
} from "./live-connected-utils";

import * as statementMutations from "@/lib/supabase/mutations/statement";

describe("statement mutation connected behavior", () => {
  it("executes statement mutation exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions("mutations.statement", statementMutations);
  });
});
