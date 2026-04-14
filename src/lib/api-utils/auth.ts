import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_getUserProfile } from "@/lib/supabase/queries";
import { forbidden, notFound, unauthorized } from "./response";

export const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

type AuthenticatedUserResult = {
  supabase: ReturnType<typeof getServiceClient>;
  userId: string;
  email: string | null;
};

const getAuthenticatedUser = async (
  request: Request,
  clientName: string,
): Promise<AuthenticatedUserResult> => {
  const token = getBearerToken(request);
  if (!token) {
    throw unauthorized();
  }

  const supabase = getServiceClient(clientName);
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    throw unauthorized();
  }

  return {
    supabase,
    userId: userData.user.id,
    email: userData.user.email ?? null,
  };
};

export const requireUser = async (request: Request) => {
  const auth = await getAuthenticatedUser(request, "requireUser");

  const profile = await SERVERONLY_getUserProfile(auth.userId);
  if (!profile) {
    throw notFound("Profile not found");
  }

  return {
    ...auth,
    profile,
  };
};

export const requireAppAdmin = async (request: Request) => {
  const auth = await getAuthenticatedUser(request, "requireAppAdmin");

  const profile = await SERVERONLY_getUserProfile(auth.userId);
  if (!profile || profile.role !== "app_admin") {
    throw forbidden();
  }

  return {
    ...auth,
    profile,
  };
};

export const isAppAdminRequest = async (request: Request) => {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return false;
    }

    const supabase = getServiceClient("isAppAdminRequest");
    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return false;
    }

    const profile = await SERVERONLY_getUserProfile(userData.user.id);
    return profile?.role === "app_admin";
  } catch {
    return false;
  }
};

export const requireTenantAdmin = async (request: Request) => {
  const auth = await getAuthenticatedUser(request, "requireTenantAdmin");

  const profile = await SERVERONLY_getUserProfile(auth.userId);
  if (!profile || !profile.tenant_id || profile.role !== "tenant_admin") {
    throw forbidden();
  }

  return {
    ...auth,
    tenantId: profile.tenant_id,
    profile,
  };
};

export const requireTenantUser = async (request: Request) => {
  const auth = await getAuthenticatedUser(request, "requireTenantUser");

  const profile = await SERVERONLY_getUserProfile(auth.userId);
  if (!profile || !profile.tenant_id) {
    throw forbidden("No tenant associated");
  }

  return {
    ...auth,
    role: profile.role,
    tenantId: profile.tenant_id,
    profile,
  };
};

export const getAuthenticatedUserProfile = async (request: Request) => {
  const auth = await getAuthenticatedUser(
    request,
    "getAuthenticatedUserProfile",
  );

  const profile = await SERVERONLY_getUserProfile(auth.userId);
  if (!profile) {
    throw notFound("Profile not found");
  }

  return {
    ...auth,
    profile,
  };
};
