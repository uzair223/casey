import { badRequest, ok, requireAppAdmin, serverError } from "@/lib/api-utils";
import { SERVERONLY_getDemoStudioBootstrapOptions } from "@/lib/supabase/queries";
import { SERVERONLY_createDemoStudioStatement } from "@/lib/supabase/mutations";

type BootstrapRequest = {
  tenantId?: string;
  tenantName?: string;
  caseTemplateId?: string | null;
  statementTemplateId?: string | null;
  caseTitle?: string;
  witnessName?: string;
  witnessEmail?: string;
  caseMetadata?: Record<string, string>;
  witnessMetadata?: Record<string, string>;
};

export async function GET(request: Request) {
  try {
    await requireAppAdmin(request);
    const options = await SERVERONLY_getDemoStudioBootstrapOptions();
    return ok(options);
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppAdmin(request);
    const payload = (await request.json()) as BootstrapRequest;
    if (!payload.tenantId && !payload.tenantName?.trim()) {
      return badRequest("tenantName is required when tenantId is not provided");
    }
    const result = await SERVERONLY_createDemoStudioStatement({
      actorUserId: auth.userId,
      tenantId: payload.tenantId,
      tenantName: payload.tenantName,
      caseTemplateId: payload.caseTemplateId,
      statementTemplateId: payload.statementTemplateId,
      caseTitle: payload.caseTitle,
      witnessName: payload.witnessName,
      witnessEmail: payload.witnessEmail,
      caseMetadata: payload.caseMetadata,
      witnessMetadata: payload.witnessMetadata,
    });

    const intakeUrl = `${new URL(request.url).origin}/intake/${result.magicLink.token}`;

    return ok({
      tenant: result.tenant,
      case: result.case,
      statement: result.statement,
      magicLink: {
        token: result.magicLink.token,
        expiresAt: result.magicLink.expiresAt,
        intakeUrl,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
