import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import {
  attributionFromAnswers,
  sourceLabel,
} from "@/lib/leads/attribution";
import { pushLeadToClio } from "./clio";
import {
  buildLeadHandoff,
  runLeadPushes,
  webhookUrlError,
  type PushJobResult,
} from "./push-result";
import { listCrmConnections, type CrmConnectionRow } from "./store";

function summaryFromAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as { summary?: unknown; enquiry_transcript?: unknown };
  if (typeof record.summary === "string" && record.summary.trim()) return record.summary.trim();
  if (!Array.isArray(record.enquiry_transcript)) return "";
  return record.enquiry_transcript
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const message = item as { role?: unknown; content?: unknown };
      if (message.role !== "user" || typeof message.content !== "string") return [];
      return [message.content.trim()];
    })
    .filter(Boolean)
    .join("\n");
}

export async function pushAcceptedLead(params: {
  tenantId: string;
  statementId: string;
}): Promise<PushJobResult[]> {
  try {
    const supabase = getServiceClient("crm-push");
    const [{ data: lead, error }, connections] = await Promise.all([
      supabase
        .from("statements")
        .select(
          "id, contact_name, contact_email, contact_phone, witness_name, witness_email, qualification_answers",
        )
        .eq("id", params.statementId)
        .eq("tenant_id", params.tenantId)
        .maybeSingle(),
      listCrmConnections(params.tenantId),
    ]);
    if (error) throw error;
    if (!lead) return [];
    const targets = connections.filter(
      (connection) =>
        (connection.provider === "clio" && connection.access_token) ||
        (connection.provider === "webhook" && connection.webhook_url),
    );
    if (!targets.length) return [];
    const handoff = buildLeadHandoff({
      statementId: lead.id,
      name: lead.contact_name || lead.witness_name || "Lead",
      email: lead.contact_email || lead.witness_email || null,
      phone: lead.contact_phone,
      summary: summaryFromAnswers(lead.qualification_answers),
      source: sourceLabel(attributionFromAnswers(lead.qualification_answers)),
    });
    const results = await runLeadPushes(
      targets.map((connection) => ({
        provider: connection.provider,
        send: () => sendOne(connection, handoff),
      })),
    );
    if (results.length) {
      const { error: insertError } = await supabase.from("crm_pushes").insert(
        results.map((result) => ({
          tenant_id: params.tenantId,
          statement_id: lead.id,
          provider: result.provider,
          status: result.status,
          error_message: result.error,
        })),
      );
      if (insertError) console.error(insertError);
    }
    return results;
  } catch (error) {
    console.error(error);
    return [
      {
        provider: "crm",
        status: "failed",
        error: error instanceof Error ? error.message : "The handoff did not send.",
      },
    ];
  }
}

async function sendOne(
  connection: CrmConnectionRow,
  handoff: ReturnType<typeof buildLeadHandoff>,
) {
  if (connection.provider === "clio") {
    await pushLeadToClio(connection, handoff);
    return;
  }
  const url = connection.webhook_url ?? "";
  const invalid = webhookUrlError(url);
  if (invalid) throw new Error(invalid);
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(handoff),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`The other system replied ${response.status}.`);
  }
}

export function summarisePushes(results: PushJobResult[]) {
  if (!results.length) return { status: "skipped" as const, error: null };
  const failed = results.find((result) => result.status === "failed");
  if (failed) return { status: "failed" as const, error: failed.error };
  return { status: "sent" as const, error: null };
}
