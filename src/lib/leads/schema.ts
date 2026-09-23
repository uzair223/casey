import { z } from "zod";

export const QualificationSlotSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    type: z.enum(["text", "long_text", "date", "number", "boolean", "select"]),
    required: z.boolean().optional(),
    reserved: z.enum(["name", "email", "phone"]).nullable().optional(),
    include_in_outreach: z.boolean().optional(),
    options: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

export const ParticipantRoleSchema = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    kind: z.enum(["primary", "supporting"]),
    statement_template_id: z.string().uuid().nullable().optional(),
  })
  .strict();

export const DeclineReasonSchema = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
  })
  .strict();

export const LeadBrandingSchema = z
  .object({
    primaryColor: z.string().trim().optional(),
    logoUrl: z.string().trim().optional(),
    displayName: z.string().trim().optional(),
    welcome: z.string().trim().optional(),
    hideCaseyMark: z.boolean().optional(),
  })
  .strict();

export const LeadTypeConfigSchema = z.object({
  qualification_slots: z.array(QualificationSlotSchema).default([]),
  participant_roles: z.array(ParticipantRoleSchema).default([]),
  outreach_template: z.string().nullable().optional(),
  decline_reasons: z.array(DeclineReasonSchema).default([]),
  branding: LeadBrandingSchema.default({}),
});

export type QualificationSlot = z.infer<typeof QualificationSlotSchema>;
export type ParticipantRole = z.infer<typeof ParticipantRoleSchema>;
export type DeclineReason = z.infer<typeof DeclineReasonSchema>;
export type LeadBranding = z.infer<typeof LeadBrandingSchema>;
export type LeadTypeConfig = z.infer<typeof LeadTypeConfigSchema>;

export const GENERIC_DECLINE_REASONS: DeclineReason[] = [
  { key: "wrong_type", label: "Wrong work type" },
  { key: "duplicate", label: "Duplicate" },
  { key: "out_of_scope", label: "Out of scope" },
  { key: "other", label: "Other" },
];

export const DEFAULT_OUTREACH_TEMPLATE =
  "Hi, you were named as a {role} for {firm} regarding {summary}. We are kindly requesting your account.";

export function parseLeadTypeConfig(value: {
  qualification_slots?: unknown;
  participant_roles?: unknown;
  outreach_template?: string | null;
  decline_reasons?: unknown;
  branding?: unknown;
}) {
  const parsed = LeadTypeConfigSchema.safeParse({
    qualification_slots: value.qualification_slots ?? [],
    participant_roles: value.participant_roles ?? [],
    outreach_template: value.outreach_template ?? null,
    decline_reasons: value.decline_reasons ?? [],
    branding: value.branding ?? {},
  });
  if (!parsed.success) {
    return LeadTypeConfigSchema.parse({});
  }
  return parsed.data;
}

export function primaryRole(roles: ParticipantRole[]) {
  return roles.find((role) => role.kind === "primary") ?? null;
}

export function supportingRoles(roles: ParticipantRole[]) {
  return roles.filter((role) => role.kind === "supporting");
}
