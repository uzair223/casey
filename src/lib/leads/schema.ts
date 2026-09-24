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
    logoUrl: z
      .string()
      .trim()
      .refine((value) => {
        if (!value) return true;
        if (value.startsWith("/api/public/firm-logo/") && !value.includes("..")) {
          return true;
        }
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      }, "Upload a logo image")
      .optional(),
    displayName: z.string().trim().optional(),
    welcome: z.string().trim().optional(),
    hideCaseyMark: z.boolean().optional(),
    hideAvatars: z.boolean().optional(),
    selectorTitle: z.string().trim().optional(),
    selectorCaption: z.string().trim().optional(),
    textColor: z.string().trim().optional(),
    backgroundColor: z.string().trim().optional(),
    // Older saves stored a separate Casey bubble colour. Kept so those records still parse.
    bubbleColor: z.string().trim().optional(),
    userBubbleColor: z.string().trim().optional(),
  })
  .strict();

export const DEFAULT_LEAD_HEADER_COLOR = "#1f3a2e";
export const DEFAULT_LEAD_TEXT_COLOR = "#f3efe6";
export const DEFAULT_LEAD_BACKGROUND_COLOR = "#12110f";
export const DEFAULT_LEAD_USER_BUBBLE_COLOR = "#211e1b";
export const DEFAULT_SELECTOR_CAPTION =
  "Choose the kind of enquiry, then Casey will ask for the details the firm needs.";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function defaultSelectorTitle(firmName: string) {
  return `Tell ${firmName} what happened`;
}

export function leadHexColor(value: string | undefined, fallback: string) {
  return value && HEX_COLOR.test(value) ? value : fallback;
}

export function leadColorWithAlpha(hex: string, alpha: number) {
  const value = leadHexColor(hex, DEFAULT_LEAD_HEADER_COLOR).slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function selectorCopy(
  value: string | undefined,
  fallback: string,
) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

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
