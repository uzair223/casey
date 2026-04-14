import { conflict, notFound } from "./response";
import { isAppAdminRequest } from "./auth";
import type { StatementStatus } from "@/types";

type IntakeAccessMode = "view" | "interact";

export async function getIntakeAccessError(
  request: Request,
  statementStatus: StatementStatus,
  mode: IntakeAccessMode,
) {
  if (statementStatus === "demo") {
    const isAppAdmin = await isAppAdminRequest(request);
    if (!isAppAdmin) {
      return notFound("Link not available");
    }
  }

  if (statementStatus === "demo_published" && mode === "interact") {
    return conflict("This demo intake has already been published.");
  }

  return null;
}
