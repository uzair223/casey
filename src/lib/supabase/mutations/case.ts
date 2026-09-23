import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";
import { getSupabaseClient } from "../client";
import {
  freezeStatementConfig,
  statementTemplateIdForRole,
} from "@/lib/leads/snapshot";
import { generateSecureToken } from "@/lib/security";
import { createCaseConfigSnapshot } from "./case-template";
import { deleteStorageFolders } from "../storage-cleanup";

const DEFAULT_CASE_TITLE_TEMPLATE = "Case {caseIndex}";

function normalizeCaseMetadataValue(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function resolveCaseTitleFromTemplate(params: {
  titleTemplate: string;
  caseIndex: number;
  caseMetadata?: Record<string, string | number | null | undefined>;
}): string {
  let sawToken = false;
  let sawValue = false;
  const resolved = params.titleTemplate
    .replace(/\{([^{}]+)\}/g, (_match, token) => {
      const key = String(token).trim();
      if (!key) {
        return "";
      }
      sawToken = true;

      if (key === "caseIndex") {
        sawValue = true;
        return String(params.caseIndex);
      }

      const value = normalizeCaseMetadataValue(params.caseMetadata?.[key]);
      if (value) sawValue = true;
      return value;
    })
    .replace(/\s+/g, " ")
    .trim();

  if (sawToken && !sawValue) return "";
  return resolved;
}

async function resolveCaseTitle(params: {
  supabase: SupabaseClient<Database>;
  tenantId: string;
  caseTemplateId?: string | null;
  caseMetadata?: Record<string, string | number | null | undefined>;
  explicitTitle?: string;
}): Promise<string> {
  const explicit = params.explicitTitle?.trim();

  if (!params.caseTemplateId) {
    return explicit || "Case";
  }

  const { count, error: countError } = await params.supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", params.tenantId)
    .eq("case_template_id", params.caseTemplateId);

  if (countError) {
    throw countError;
  }

  const caseIndex = (count ?? 0) + 1;

  const { data: template, error: templateError } = await params.supabase
    .from("case_templates")
    .select("title_template")
    .eq("id", params.caseTemplateId)
    .maybeSingle();

  if (templateError) {
    throw templateError;
  }

  const titleTemplate =
    (template?.title_template as string | null | undefined)?.trim() ||
    DEFAULT_CASE_TITLE_TEMPLATE;

  // If a custom literal title is provided (no template tokens), keep it.
  if (explicit && !/[{}]/.test(explicit)) {
    return explicit;
  }

  const templateSource = explicit && /[{}]/.test(explicit) ? explicit : titleTemplate;
  const resolved = resolveCaseTitleFromTemplate({
    titleTemplate: templateSource,
    caseIndex,
    caseMetadata: params.caseMetadata,
  });

  if (resolved) return resolved;
  if (explicit && !/[{}]/.test(explicit)) return explicit;
  return `Lead ${caseIndex}`;
}

const deriveCaseStatusFromWitnessStatuses = (
  statuses: Array<
    | "draft"
    | "in_progress"
    | "submitted"
    | "finalized"
    | "completed"
    | "locked"
    | "demo"
    | "demo_published"
  >,
): "draft" | "in_progress" | "submitted" | "locked" => {
  if (!statuses.length) {
    return "draft";
  }

  if (
    statuses.every(
      (status) =>
        status === "submitted" ||
        status === "finalized" ||
        status === "completed" ||
        status === "demo_published",
    )
  ) {
    return "submitted";
  }

  if (statuses.every((status) => status === "locked")) {
    return "locked";
  }

  if (
    statuses.some(
      (status) =>
        status === "demo" ||
        status === "demo_published" ||
        status === "in_progress" ||
        status === "submitted" ||
        status === "finalized" ||
        status === "completed" ||
        status === "locked",
    )
  ) {
    return "in_progress";
  }

  return "draft";
};

const isStatementStatus = (
  status: string,
): status is
  | "draft"
  | "in_progress"
  | "submitted"
  | "finalized"
  | "completed"
  | "locked"
  | "demo"
  | "demo_published" =>
  status === "draft" ||
  status === "demo" ||
  status === "demo_published" ||
  status === "in_progress" ||
  status === "submitted" ||
  status === "finalized" ||
  status === "completed" ||
  status === "locked";

export const syncCaseStatusFromWitnesses = async (
  caseId: string,
  supabase: ReturnType<typeof getSupabaseClient>,
) => {
  const { data: caseWitnesses, error: caseWitnessesError } = await supabase
    .from("statements")
    .select("status")
    .eq("case_id", caseId);

  if (caseWitnessesError) {
    throw caseWitnessesError;
  }

  const nextCaseStatus = deriveCaseStatusFromWitnessStatuses(
    (caseWitnesses ?? [])
      .map((witness) => witness.status)
      .filter(isStatementStatus),
  );

  const { error: caseStatusError } = await supabase
    .from("cases")
    .update({ status: nextCaseStatus })
    .eq("id", caseId);

  if (caseStatusError) {
    throw caseStatusError;
  }
};

export async function createCase(
  payload: {
    tenant_id: string;
    title?: string;
    assigned_to_ids?: string[];
    status?: string;
    case_template_id?: string | null;
    case_metadata?: Record<string, string | number | null | undefined>;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    lead_stage?: string;
    role_key?: string;
    accepted?: boolean;
  },
  supabase: SupabaseClient<Database> = getSupabaseClient(),
) {
  const resolvedTitle = await resolveCaseTitle({
    supabase,
    tenantId: payload.tenant_id,
    caseTemplateId: payload.case_template_id,
    caseMetadata: payload.case_metadata,
    explicitTitle: payload.title,
  });

  const { data: createdCase, error } = await supabase
    .from("cases")
    .insert({
      tenant_id: payload.tenant_id,
      title: resolvedTitle,
      assigned_to: payload.assigned_to_ids?.[0] ?? null,
      assigned_to_ids: payload.assigned_to_ids ?? [],
      status: payload.status ?? "draft",
      case_template_id: payload.case_template_id ?? null,
      case_metadata: payload.case_metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  try {
    const configSnapshotId = await createCaseConfigSnapshot({
      tenantId: payload.tenant_id,
      templateId: payload.case_template_id,
      createdForCaseId: createdCase.id,
      supabase,
    });

    const { error: updateError } = await supabase
      .from("cases")
      .update({ config_snapshot_id: configSnapshotId })
      .eq("id", createdCase.id);

    if (updateError) {
      throw updateError;
    }

    let roleKey = payload.role_key?.trim() || "claimant";
    if (!payload.role_key && payload.case_template_id) {
      const { data: leadType } = await supabase
        .from("case_templates")
        .select("participant_roles")
        .eq("id", payload.case_template_id)
        .maybeSingle();
      const roles = Array.isArray(leadType?.participant_roles)
        ? leadType.participant_roles
        : [];
      const primary = roles.find(
        (role) =>
          role &&
          typeof role === "object" &&
          "kind" in role &&
          (role as { kind?: string }).kind === "primary" &&
          "key" in role &&
          typeof (role as { key?: string }).key === "string",
      ) as { key?: string } | undefined;
      if (primary?.key) roleKey = primary.key;
    }

    const contactName = payload.contact_name?.trim() || resolvedTitle;
    const contactEmail = payload.contact_email?.trim() || "";
    const { data: primary, error: primaryError } = await supabase.from("statements").insert({
      case_id: createdCase.id,
      tenant_id: payload.tenant_id,
      title: resolvedTitle,
      witness_name: contactName,
      witness_email: contactEmail || payload.contact_phone?.trim() || "pending",
      participant_kind: "primary",
      role_key: roleKey,
      lead_stage: payload.lead_stage ?? "intake",
      lead_type_id: payload.case_template_id ?? null,
      contact_name: payload.contact_name?.trim() || contactName,
      contact_email: contactEmail || null,
      contact_phone: payload.contact_phone?.trim() || null,
      qualification_answers: payload.case_metadata ?? {},
      accepted_at:
        payload.accepted === false ? null : new Date().toISOString(),
      assigned_to: payload.assigned_to_ids?.[0] ?? null,
      assigned_to_ids: payload.assigned_to_ids ?? [],
      status: "draft",
    })
      .select("id")
      .single();
    if (primaryError) {
      throw primaryError;
    }

    if (payload.accepted !== false) {
      const templateId = await statementTemplateIdForRole(
        supabase,
        payload.case_template_id,
        roleKey,
      );
      await freezeStatementConfig(supabase, {
        statementId: primary.id,
        tenantId: payload.tenant_id,
        templateId,
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const { error: linkError } = await supabase.from("magic_links").insert({
        token: generateSecureToken(),
        statement_id: primary.id,
        tenant_id: payload.tenant_id,
        expires_at: expiresAt.toISOString(),
      });
      if (linkError) throw linkError;
    }
  } catch (snapshotError) {
    await supabase.from("cases").delete().eq("id", createdCase.id);
    throw snapshotError;
  }

  return { id: createdCase.id };
}

export async function updateCase(
  id: string,
  payload: {
    title?: string;
    assigned_to_ids?: string[];
    status?: string;
    case_template_id?: string | null;
    case_metadata?: Record<string, string | number | null | undefined>;
  },
) {
  const supabase = getSupabaseClient();
  const updatePayload = {
    ...payload,
    ...(payload.assigned_to_ids
      ? { assigned_to: payload.assigned_to_ids[0] ?? null }
      : {}),
  };

  const { error } = await supabase
    .from("cases")
    .update(updatePayload)
    .eq("id", id);
  if (error) {
    throw error;
  }
}

export async function deleteCase(id: string) {
  const supabase = getSupabaseClient();

  const { data: caseRecord, error: caseError } = await supabase
    .from("cases")
    .select("tenant_id")
    .eq("id", id)
    .maybeSingle();

  if (caseError) {
    throw caseError;
  }

  if (caseRecord?.tenant_id) {
    await deleteStorageFolders(supabase, caseRecord.tenant_id, [`cases/${id}`]);
  }

  const { error } = await supabase.from("cases").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
