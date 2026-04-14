import { ok, requireAppAdmin, serverError } from "@/lib/api-utils";
import { SERVERONLY_deleteStatement } from "@/lib/supabase/mutations";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ statementId: string }> },
) {
  try {
    await requireAppAdmin(request);
    const { statementId } = await params;
    await SERVERONLY_deleteStatement(statementId);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error, { "Statement not found": 404 });
  }
}
