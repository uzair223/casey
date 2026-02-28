import { getServiceClient } from "../server";

import { assertServerOnly } from "@/lib/utils";
import { generateAlphanumericCode } from "@/lib/security";

import { Invite } from "@/lib/types";
import { getSupabaseClient } from "../client";

/**
 * Invite type
 * Logic:
 *   - email = NULL: Anyone with token can accept (anonymous invite link)
 *   - email = set: Only that email can accept
 *   - tenant_id = NULL + role = tenant_admin: Creates new tenant on acceptance
 *   - tenant_id = set: Joins existing tenant with specified role
 */

/**
 * Create an invite
 * SERVER ONLY - Requires service role for auth.admin operations
 * @param email - Email address (or null for anonymous invite)
 * @param role - Role to assign
 * @param tenantId - Tenant ID (null means create new tenant for tenant_admin role)
 * @param createdBy - User creating the invite
 * @param daysTillExpiry - Time till expiry
 */
export const createInvite = async (
  email: string | null,
  role: string,
  tenantId: string | null,
  createdBy: string,
  daysTillExpiry: number = 7,
): Promise<{ email: string | null; token: string }> => {
  const supabase = getSupabaseClient();

  if (email) {
    email = email.trim().toLowerCase();
  }

  const allowedRoles = ["tenant_admin", "solicitor", "paralegal", "app_admin"];
  if (!allowedRoles.includes(role)) {
    throw new Error("Invalid role");
  }

  // Check for existing valid invite (if email provided)
  if (email) {
    const query = supabase
      .from("invites")
      .select("token, expires_at, accepted_at")
      .eq("email", email)
      .is("accepted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (tenantId) {
      query.eq("tenant_id", tenantId);
    } else {
      query.is("tenant_id", null);
    }

    const { data: existingInvite } = await query.maybeSingle();

    if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
      return { email, token: existingInvite?.token };
    }
  }

  // Create new invite
  const token = generateAlphanumericCode(8);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysTillExpiry);

  const { error: insertError } = await supabase.from("invites").insert({
    tenant_id: tenantId,
    email,
    role,
    token,
    created_by: createdBy,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    throw insertError;
  }
  return { email, token };
};

/**
 * Resend any invite by id (extend expiry by 7 days)
 * SERVER ONLY - Requires service role for auth.admin operations
 */
export const resendInvite = async (
  inviteId: string,
): Promise<{ email: string | null; token: string }> => {
  assertServerOnly("resendInvite");
  const supabase = getServiceClient();

  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("email, token, accepted_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (inviteError) {
    throw inviteError;
  }

  if (!invite) {
    throw new Error("Invite not found");
  }

  if (invite.accepted_at) {
    throw new Error("Cannot resend an accepted invite");
  }

  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + 7);

  const { error: updateError } = await supabase
    .from("invites")
    .update({ expires_at: newExpiresAt.toISOString() })
    .eq("id", inviteId);

  if (updateError) {
    throw updateError;
  }

  return { email: invite.email, token: invite.token };
};

/**
 * Revoke (delete) any invite by id
 * SERVER ONLY - Requires service role
 */
export const revokeInvite = async (inviteId: string): Promise<void> => {
  assertServerOnly("revokeInvite");
  const supabase = getServiceClient();

  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("accepted_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (inviteError) {
    throw inviteError;
  }

  if (!invite) {
    throw new Error("Invite not found");
  }

  if (invite.accepted_at) {
    throw new Error("Cannot revoke an accepted invite");
  }

  const { error: deleteError } = await supabase
    .from("invites")
    .delete()
    .eq("id", inviteId);

  if (deleteError) {
    throw deleteError;
  }
};

export type InviteWithTenantName = Invite & { tenant_name: string | null };
/**
 * Get and validate an invite by token
 */
export const getInviteByToken = async (
  token: string,
  unusedOnly: boolean = true,
): Promise<InviteWithTenantName | null> => {
  const supabase = getSupabaseClient();

  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (inviteError || !invite) {
    return null;
  }

  if (
    unusedOnly &&
    (invite.accepted_at || new Date(invite.expires_at) < new Date())
  ) {
    return null;
  }

  let tenant_name = null;
  if (invite.tenant_id) {
    const { data } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", invite.tenant_id)
      .maybeSingle();
    tenant_name = data?.name || null;
  }

  return { ...invite, tenant_name };
};

/**
 * Accept an invite (mark as accepted and create/update profile)
 */
export const acceptInvite = async (
  token: string,
  user_id: string,
  displayName: string,
  firmName?: string,
): Promise<{ tenant_id: string | null; role: string }> => {
  assertServerOnly("acceptInvite");
  const supabase = getServiceClient();

  const invite = await getInviteByToken(token);
  if (!invite) {
    throw new Error("Invalid or expired invite");
  }

  let tenant_id = invite.tenant_id;

  // If user is tenant_admin with no tenant_id, create tenant first
  if (invite.role === "tenant_admin" && !invite.tenant_id) {
    if (!firmName || !firmName.trim()) {
      throw new Error("Firm name is required for tenant admin setup");
    }

    // Create new tenant
    const { data: newTenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: firmName.trim(),
      })
      .select()
      .single();

    if (tenantError || !newTenant) {
      console.error("Failed to create tenant:", tenantError);
      throw new Error("Failed to create organization");
    }

    tenant_id = newTenant.id;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id,
      tenant_id,
      role: invite.role,
      display_name: displayName.trim(),
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    throw profileError;
  }

  // Mark invite as accepted if not open invite
  if (invite.email !== null) {
    const { error: updateError } = await supabase
      .from("invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("token", token);
    if (updateError) {
      throw updateError;
    }
  }

  return {
    tenant_id,
    role: invite.role,
  };
};

export const getInvites = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};
