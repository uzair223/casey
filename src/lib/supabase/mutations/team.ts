import { apiFetch } from "@/lib/api-utils/fetch";

const TEAM_EDITABLE_ROLES = ["tenant_admin", "solicitor", "paralegal"];

async function getTenantMemberProfile(
  userId: string,
  tenantId: string,
): Promise<{ role: string; tenant_id: string }> {
  const { members } = await apiFetch<{
    members: Array<{ user_id: string; tenant_id: string; role: string }>;
  }>("/api/tenant/members");

  const data = members.find(
    (member) => member.user_id === userId && member.tenant_id === tenantId,
  );

  if (!data) {
    throw new Error("User not found");
  }

  return {
    tenant_id: data.tenant_id,
    role: data.role,
  };
}

export const updateUserRole = async (
  user_id: string,
  newRole: string,
  tenant_id: string,
  requestinguser_id: string,
): Promise<void> => {
  if (!TEAM_EDITABLE_ROLES.includes(newRole)) {
    throw new Error("Invalid role");
  }

  const targetProfile = await getTenantMemberProfile(user_id, tenant_id);

  if (targetProfile.role === "tenant_admin" && user_id !== requestinguser_id) {
    throw new Error("Cannot modify other tenant admins");
  }

  await apiFetch("/api/tenant/members", {
    method: "PUT",
    body: JSON.stringify({ userId: user_id, role: newRole }),
  });
};

export const removeTeamMember = async (
  user_id: string,
  tenant_id: string,
  requestinguser_id: string,
): Promise<void> => {
  if (user_id === requestinguser_id) {
    throw new Error("Cannot remove yourself");
  }

  const targetProfile = await getTenantMemberProfile(user_id, tenant_id);

  if (targetProfile.role === "tenant_admin") {
    throw new Error("Cannot remove other tenant admins");
  }

  await apiFetch("/api/tenant/members", {
    method: "DELETE",
    body: JSON.stringify({ userId: user_id }),
  });
};

export const restoreTeamMember = async (
  user_id: string,
  tenant_id: string,
  requestinguser_id: string,
): Promise<void> => {
  if (user_id === requestinguser_id) {
    throw new Error("Cannot restore yourself");
  }

  const targetProfile = await getTenantMemberProfile(user_id, tenant_id);

  if (targetProfile.role === "tenant_admin") {
    throw new Error("Cannot restore other tenant admins");
  }

  await apiFetch("/api/tenant/members", {
    method: "PATCH",
    body: JSON.stringify({ userId: user_id }),
  });
};
