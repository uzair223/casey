import { ok, requireAppAdmin, serverError } from "@/lib/api-utils";
import { SERVERONLY_listDemoStudioStatements } from "@/lib/supabase/queries";

export async function GET(request: Request) {
  try {
    await requireAppAdmin(request);
    const origin = new URL(request.url).origin;
    const statements = await SERVERONLY_listDemoStudioStatements();
    return ok({
      statements: statements.map((statement) => ({
        ...statement,
        intake_url: statement.magic_link_token
          ? `${origin}/intake/${statement.magic_link_token}`
          : "",
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
