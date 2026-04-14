import { getServiceClient } from "../server";
import { getSupabaseClient } from "../client";
import { generateAlphanumericCode } from "@/lib/security";

const ALLOWED_INVITE_ROLES = [
  "tenant_admin",
  "solicitor",
  "paralegal",
  "app_admin",
];

async function getInviteByIdOrThrow(inviteId: string) {
  const supabase = getSupabaseClient();
  const { data: invite, error } = await supabase
    .from("invites")
    .select("email, token, accepted_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!invite) {
    throw new Error("Invite not found");
  }

  return invite;
}

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

  if (!ALLOWED_INVITE_ROLES.includes(role)) {
    throw new Error("Invalid role");
  }

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

export const resendInvite = async (
  inviteId: string,
): Promise<{ email: string | null; token: string }> => {
  const supabase = getSupabaseClient();
  const invite = await getInviteByIdOrThrow(inviteId);

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

export const revokeInvite = async (inviteId: string): Promise<void> => {
  const supabase = getSupabaseClient();
  const invite = await getInviteByIdOrThrow(inviteId);

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

export const SERVERONLY_acceptInvite = async (
  token: string,
  user_id: string,
  displayName: string,
  firmName?: string,
): Promise<{ tenant_id: string | null; role: string }> => {
  const supabase = getServiceClient("SERVERONLY_acceptInvite");

  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (inviteError || !invite) {
    throw new Error("Invalid or expired invite");
  }

  if (invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    throw new Error("Invalid or expired invite");
  }

  let tenant_id = invite.tenant_id;

  if (invite.role === "tenant_admin" && !invite.tenant_id) {
    if (!firmName || !firmName.trim()) {
      throw new Error("Firm name is required for tenant admin setup");
    }

    const { data: newTenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: firmName.trim(),
      })
      .select()
      .single();

    if (tenantError || !newTenant) {
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
