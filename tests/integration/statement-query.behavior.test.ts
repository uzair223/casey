import { describe, it } from "vitest";
import {
  assertConnectedSupabaseEnv,
  invokeAllExportedFunctions,
} from "./live-connected-utils";

import * as statementQueries from "@/lib/supabase/queries/statement";

describe("statement query connected behavior", () => {
  it("executes statement query exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions("queries.statement", statementQueries);
  });
});
