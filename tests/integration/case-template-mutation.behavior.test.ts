import { describe, it } from "vitest";
import {
  assertConnectedSupabaseEnv,
  invokeAllExportedFunctions,
} from "./live-connected-utils";

import * as caseTemplateQueries from "@/lib/supabase/queries/case-template";
import * as caseTemplateMutations from "@/lib/supabase/mutations/case-template";

describe("case-template queries/mutations connected behavior", () => {
  it("executes case-template query exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions(
      "queries.case-template",
      caseTemplateQueries,
    );
  });

  it("executes case-template mutation exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions(
      "mutations.case-template",
      caseTemplateMutations,
    );
  });
});
