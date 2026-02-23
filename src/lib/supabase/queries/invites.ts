import { getServiceClient } from "../server";
import { getSupabaseClient } from "../client";
import { assertServerOnly } from "@/lib/utils";
import { generateAlphanumericCode } from "@/lib/security";
import { Invite } from "@/lib/types";

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
 * @param tenant_id - Tenant ID (null means create new tenant for tenant_admin role)
 * @param createdBy - User creating the invite
 */
export const createInvite = async (
  email: string | null,
  role: string,
  tenant_id: string | null,
  createdBy: string,
): Promise<{ token: string; inviteUrl: string; emailSent: boolean }> => {
  assertServerOnly("createInvite");
  const supabase = getServiceClient();

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

    if (tenant_id) {
      query.eq("tenant_id", tenant_id);
    } else {
      query.is("tenant_id", null);
    }

    const { data: existingInvite } = await query.maybeSingle();

    if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
      // Resend email for existing invite
      const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth?invite=${existingInvite.token}`;

      const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: redirectUrl,
        },
      );

      if (emailError) {
        console.error("Failed to resend invite email:", emailError);
      }

      return {
        token: existingInvite.token,
        inviteUrl: `/auth?invite=${existingInvite.token}`,
        emailSent: !emailError,
      };
    }
  }

  // Create new invite
  const token = generateAlphanumericCode(8);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error: insertError } = await supabase.from("invites").insert({
    tenant_id,
    email,
    role,
    token,
    created_by: createdBy,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    throw insertError;
  }

  // Send invitation email (if email provided)
  let emailSent = false;
  if (email) {
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth?invite=${token}`;

    const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: redirectUrl,
      },
    );

    if (emailError) {
      console.error("Failed to send invite email:", emailError);
    } else {
      emailSent = true;
    }
  }

  return {
    token,
    inviteUrl: `/auth?invite=${token}`,
    emailSent,
  };
};

/**
 * Create a user invite for a tenant (convenience wrapper)
 * Sends invitation email via Supabase Auth
 * SERVER ONLY - Requires service role for auth.admin operations
 */
export const createUserInvite = async (
  email: string,
  role: string,
  tenant_id: string,
  createdBy: string,
): Promise<{ token: string; inviteUrl: string; emailSent: boolean }> => {
  return createInvite(email, role, tenant_id, createdBy);
};

/**
 * Get all invites for a tenant
 * Client-callable: only accesses tenant's own data via RLS
 */
export const getUserInvites = async (tenant_id: string): Promise<Invite[]> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase client not available");
  }

  const { data: invites, error } = await supabase
    .from("invites")
    .select("*")
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return invites || [];
};

/**
 * Revoke (delete) a user invite
 * Client-callable: RLS ensures only tenant admins can delete for their tenant
 */
export const revokeUserInvite = async (
  inviteId: string,
  tenant_id: string,
): Promise<void> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase client not available");
  }

  // Check if invite exists, belongs to tenant, and is not accepted
  const { data: invite } = await supabase
    .from("invites")
    .select("tenant_id, accepted_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) {
    throw new Error("Invite not found");
  }

  if (invite.tenant_id !== tenant_id) {
    throw new Error("Unauthorized");
  }

  if (invite.accepted_at) {
    throw new Error("Cannot revoke an accepted invite");
  }

  // Delete the invite
  const { error: deleteError } = await supabase
    .from("invites")
    .delete()
    .eq("id", inviteId);

  if (deleteError) {
    throw deleteError;
  }
};

/**
 * Resend a user invite (extend expiry by 7 days)
 */
export const resendUserInvite = async (
  inviteId: string,
  tenant_id: string,
): Promise<{ emailSent: boolean }> => {
  assertServerOnly("resendUserInvite");
  const supabase = getServiceClient();

  // Verify invite belongs to user's tenant
  const { data: invite } = await supabase
    .from("invites")
    .select("tenant_id, email, token")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) {
    throw new Error("Invite not found");
  }

  if (invite.tenant_id !== tenant_id) {
    throw new Error("Unauthorized");
  }

  // Extend expiry by 7 days from now
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + 7);

  const { error: updateError } = await supabase
    .from("invites")
    .update({ expires_at: newExpiresAt.toISOString() })
    .eq("id", inviteId);

  if (updateError) {
    throw updateError;
  }

  // Resend email (if email is set)
  let emailSent = false;
  if (invite.email) {
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth?invite=${invite.token}`;

    const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(
      invite.email,
      {
        redirectTo: redirectUrl,
      },
    );

    if (emailError) {
      console.error("Failed to resend invite email:", emailError);
    } else {
      emailSent = true;
    }
  }

  return {
    emailSent,
  };
};

/**
 * Resend any invite by id (extend expiry by 7 days)
 * SERVER ONLY - Requires service role for auth.admin operations
 */
export const resendInvite = async (
  inviteId: string,
): Promise<{ emailSent: boolean }> => {
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

  let emailSent = false;
  if (invite.email) {
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth?invite=${invite.token}`;

    const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(
      invite.email,
      {
        redirectTo: redirectUrl,
      },
    );

    if (emailError) {
      console.error("Failed to resend invite email:", emailError);
    } else {
      emailSent = true;
    }
  }

  return { emailSent };
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

/**
 * Get and validate an invite by token
 */
export const getInviteByToken = async (
  token: string,
): Promise<Invite | null> => {
  const supabase = getSupabaseClient();

  const { data: invite, error } = await supabase
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return null;
  }

  // Check if expired or already accepted
  if (invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return null;
  }

  return invite;
};

export const getInviteByTokenServer = async (
  token: string,
): Promise<Invite | null> => {
  assertServerOnly("getInviteByTokenServer");
  const supabase = getServiceClient();

  const { data: invite, error } = await supabase
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return null;
  }

  // Check if expired or already accepted
  if (invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return null;
  }

  return invite;
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

  const invite = await getInviteByTokenServer(token);
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

  // Mark invite as accepted
  const { error: updateError } = await supabase
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("token", token);

  if (updateError) {
    throw updateError;
  }

  return {
    tenant_id,
    role: invite.role,
  };
};
