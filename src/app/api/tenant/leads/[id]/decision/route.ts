import { NextResponse } from "next/server";

import { badRequest, ok, requireTenantManager, serverError } from "@/lib/api-utils";
import { reserveAcceptedLeadSlot } from "@/lib/billing/open-case";
import { getServiceClient } from "@/lib/supabase/server";
import { leadListTitle, leadTypeFromTitle } from "@/lib/leads/privacy";
import { GENERIC_DECLINE_REASONS, parseLeadTypeConfig } from "@/lib/leads/schema";
import {
  freezeStatementConfig,
  statementTemplateIdForRole,
} from "@/lib/leads/snapshot";
import { enqueueCaseAnalysis } from "@/lib/leads/analyse";
import { enqueueStatementFormalization } from "@/lib/leads/formalize";
import type { StatementSupportingDocument } from "@/types";
import { generateMissingStatementDocumentDescriptors } from "@/lib/ai-workers/document-descriptors";
import { pushAcceptedLead, summarisePushes } from "@/lib/leads/acquisition/push";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireTenantManager(request);
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      action?: string;
      reason?: string;
    } | null;
    if (body?.action !== "accept" && body?.action !== "decline") {
      return badRequest("Choose accept or decline");
    }

    const supabase = getServiceClient("lead-decision");
    const { data: lead, error } = await supabase
      .from("statements")
      .select(
        "id, tenant_id, case_id, participant_kind, lead_stage, lead_type_id, role_key, witness_name, witness_email, contact_email, title",
      )
      .eq("id", id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!lead || lead.participant_kind !== "primary") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (body.action === "decline") {
      const { data: leadType } = lead.lead_type_id
        ? await supabase
            .from("case_templates")
            .select("decline_reasons")
            .eq("id", lead.lead_type_id)
            .maybeSingle()
        : { data: null };
      const extraReasons = parseLeadTypeConfig({
        decline_reasons: leadType?.decline_reasons,
      }).decline_reasons.map((reason) => reason.key);
      const allowed = new Set([
        ...GENERIC_DECLINE_REASONS.map((reason) => reason.key),
        ...extraReasons,
      ]);
      const reason = body.reason?.trim() || "other";
      if (!allowed.has(reason) && reason.length > 80) {
        return badRequest("Decline reason is too long");
      }
      const { error: updateError } = await supabase
        .from("statements")
        .update({ lead_stage: "declined", decline_reason: reason })
        .eq("id", lead.id);
      if (updateError) throw updateError;
      return ok({ id: lead.id, lead_stage: "declined" });
    }

    if (lead.lead_stage !== "new" && lead.lead_stage !== "declined") {
      return ok({ id: lead.id, lead_stage: lead.lead_stage });
    }

    const reserved = await reserveAcceptedLeadSlot(auth.tenantId);
    if (!reserved.ok) {
      return NextResponse.json(
        { error: reserved.error, code: "conflict", gate: reserved.gate },
        { status: 409 },
      );
    }

    try {
      const { data: caseRow, error: caseError } = await supabase
        .from("cases")
        .select("title")
        .eq("id", lead.case_id)
        .maybeSingle();
      if (caseError) throw caseError;
      const currentTitle = caseRow?.title?.trim() || "Enquiry";
      const person = lead.witness_name?.trim() ?? "";
      const revealedTitle = leadListTitle(
        person,
        leadTypeFromTitle(currentTitle, person),
      );

      const { error: updateError } = await supabase
        .from("statements")
        .update({
          lead_stage: "intake",
          accepted_at: new Date().toISOString(),
          title: revealedTitle,
        })
        .eq("id", lead.id);
      if (updateError) throw updateError;

      const { error: caseUpdateError } = await supabase
        .from("cases")
        .update({ status: "in_progress", title: revealedTitle })
        .eq("id", lead.case_id);
      if (caseUpdateError) throw caseUpdateError;

      const templateId = await statementTemplateIdForRole(
        supabase,
        lead.lead_type_id,
        lead.role_key,
      );
      await freezeStatementConfig(supabase, {
        statementId: lead.id,
        tenantId: auth.tenantId,
        templateId,
      });

      const { data: recent } = await supabase
        .from("conversation_messages")
        .select("meta")
        .eq("statement_id", lead.id)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(8);
      const readyToReview = (recent ?? []).some((message) => {
        const meta = message.meta;
        return (
          !!meta &&
          typeof meta === "object" &&
          !Array.isArray(meta) &&
          "readyToPrepare" in meta &&
          meta.readyToPrepare === true
        );
      });
      if (readyToReview) {
        const { data: documents } = await supabase
          .from("statement_supporting_documents")
          .select("*")
          .eq("statement_id", lead.id);
        if (documents?.length) {
          await generateMissingStatementDocumentDescriptors({
            tenantId: auth.tenantId,
            documents: documents as StatementSupportingDocument[],
            source: "witness",
          });
        }
        await enqueueStatementFormalization({
          statementId: lead.id,
          tenantId: auth.tenantId,
        });
        try {
          await enqueueCaseAnalysis({
            caseId: lead.case_id,
            tenantId: auth.tenantId,
            requestedByUserId: auth.userId,
          });
        } catch (analysisError) {
          console.error(analysisError);
        }
      }

      const crm = summarisePushes(
        await pushAcceptedLead({ tenantId: auth.tenantId, statementId: lead.id }),
      );
      return ok({ id: lead.id, lead_stage: "intake", delivered: false, crm });
    } catch (acceptError) {
      if (reserved.consumedCredits != null) {
        await supabase
          .from("tenants")
          .update({ overage_credits: reserved.consumedCredits })
          .eq("id", auth.tenantId)
          .eq("overage_credits", reserved.consumedCredits - 1);
      }
      throw acceptError;
    }
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
