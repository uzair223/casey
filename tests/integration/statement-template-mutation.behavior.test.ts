import { describe, it } from "vitest";
import {
  assertConnectedSupabaseEnv,
  invokeAllExportedFunctions,
} from "./live-connected-utils";

import * as statementTemplateQueries from "@/lib/supabase/queries/statement-template";
import * as statementTemplateMutations from "@/lib/supabase/mutations/statement-template";

describe("statement-template queries/mutations connected behavior", () => {
  it("executes statement-template query exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions(
      "queries.statement-template",
      statementTemplateQueries,
    );
  });

  it("executes statement-template mutation exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions(
      "mutations.statement-template",
      statementTemplateMutations,
    );
  });
});
