import { z } from "zod";

import {
  badRequest,
  ok,
  requireTenantAdmin,
  serverError,
} from "@/lib/api-utils";
import {
  getTenantSubscriptionSummary,
  setSubscriptionCancelAtPeriodEnd,
} from "@/lib/billing/subscription";

export async function GET(request: Request) {
  try {
    const auth = await requireTenantAdmin(request);
    return ok(await getTenantSubscriptionSummary(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

const BodySchema = z.object({
  cancelAtPeriodEnd: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireTenantAdmin(request);
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Invalid cancellation request");
    }
    const summary = await setSubscriptionCancelAtPeriodEnd(
      auth.tenantId,
      parsed.data.cancelAtPeriodEnd,
    );
    if (!summary) {
      return badRequest("There is no subscription to cancel");
    }
    return ok(summary);
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
