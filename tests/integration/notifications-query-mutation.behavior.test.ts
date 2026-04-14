import { describe, it } from "vitest";
import {
  assertConnectedSupabaseEnv,
  invokeAllExportedFunctions,
} from "./live-connected-utils";

import * as notificationQueries from "@/lib/supabase/queries/notifications";
import * as notificationMutations from "@/lib/supabase/mutations/notifications";

describe("notifications queries/mutations connected behavior", () => {
  it("executes notifications query exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions(
      "queries.notifications",
      notificationQueries,
    );
  });

  it("executes notifications mutation exports against local Supabase", async () => {
    assertConnectedSupabaseEnv();
    await invokeAllExportedFunctions(
      "mutations.notifications",
      notificationMutations,
    );
  });
});
