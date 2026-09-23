import { ApiRequestError, apiFetch } from "@/lib/api-utils";
import { toast } from "@/lib/toast";

export type CheckoutRequest =
  | { kind: "starter" }
  | { kind: "growth" }
  | { kind: "extra_lead" };

async function acceptDataProcessingAddendum() {
  await apiFetch("/api/tenant/dpa", { method: "POST" });
}

async function confirmAddendum(description: string) {
  return toast.confirm("Accept the data processing addendum?", {
    description,
    confirmLabel: "Accept addendum",
  });
}

export async function startPlanCheckout(body: CheckoutRequest) {
  const openCheckout = async () => {
    const result = await apiFetch<{ checkoutUrl: string | null }>(
      "/api/tenant/billing/checkout",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    if (!result.checkoutUrl) {
      throw new Error("Checkout did not start");
    }
    window.location.assign(result.checkoutUrl);
  };

  try {
    await openCheckout();
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.code !== "dpa_required") {
      throw error;
    }
    const accepted = await confirmAddendum(
      "Read it at /legal/dpa. Accepting records the firm's agreement.",
    );
    if (!accepted) return;
    await acceptDataProcessingAddendum();
    await openCheckout();
  }
}

export async function sendWitnessLink(params: {
  statementId: string;
  message?: string;
  canAcceptDpa: boolean;
}) {
  const send = () =>
    apiFetch(`/api/tenant/statement/${params.statementId}/send-link`, {
      method: "POST",
      ...(params.message
        ? { body: JSON.stringify({ message: params.message }) }
        : {}),
    });

  try {
    await send();
  } catch (error) {
    if (
      !(error instanceof ApiRequestError) ||
      error.code !== "dpa_required" ||
      !params.canAcceptDpa
    ) {
      throw error;
    }
    const accepted = await confirmAddendum(
      "Read it at /legal/dpa. The first account link needs this once.",
    );
    if (!accepted) {
      throw error;
    }
    await acceptDataProcessingAddendum();
    await send();
  }
}
