import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createAnonClient,
  createServiceClient,
  createTestUser,
  hasLocalSupabaseEnv,
  signInAs,
} from "./helpers/local-supabase";

type SeedState = {
  runId: string;
  tenantAId: string;
  tenantBId: string;
  caseAId: string;
  caseBId: string;
  statementAId: string;
  statementBId: string;
  templateGlobalCaseId: string;
  templateTenantACaseId: string;
  templateTenantBCaseId: string;
  templateGlobalStatementId: string;
  templateTenantAStatementId: string;
  templateTenantBStatementId: string;
  inviteAId: string;
  inviteAToken: string;
  authUsers: Array<{ id: string; email: string; password: string }>;
  emails: {
    appAdmin: string;
    tenantAdminA: string;
    solicitorA: string;
    paralegalA: string;
    solicitorB: string;
  };
  passwords: {
    appAdmin: string;
    tenantAdminA: string;
    solicitorA: string;
    paralegalA: string;
    solicitorB: string;
  };
};

const suite = describe.skipIf(!hasLocalSupabaseEnv())("local Supabase RLS", () => {
  let service: ReturnType<typeof createServiceClient>;
  let seed: SeedState;

  beforeAll(async () => {
    service = createServiceClient();
    const runId = crypto.randomUUID().slice(0, 8);

    const tenantAId = crypto.randomUUID();
    const tenantBId = crypto.randomUUID();
    const caseAId = crypto.randomUUID();
    const caseBId = crypto.randomUUID();
    const statementAId = crypto.randomUUID();
    const statementBId = crypto.randomUUID();
    const templateGlobalCaseId = crypto.randomUUID();
    const templateTenantACaseId = crypto.randomUUID();
    const templateTenantBCaseId = crypto.randomUUID();
    const templateGlobalStatementId = crypto.randomUUID();
    const templateTenantAStatementId = crypto.randomUUID();
    const templateTenantBStatementId = crypto.randomUUID();
    const inviteAId = crypto.randomUUID();
    const inviteAToken = `invite-${runId}`;

    const passwords = {
      appAdmin: `Pass-${runId}-aa`,
      tenantAdminA: `Pass-${runId}-ta`,
      solicitorA: `Pass-${runId}-sa`,
      paralegalA: `Pass-${runId}-pa`,
      solicitorB: `Pass-${runId}-sb`,
    };

    const emails = {
      appAdmin: `app-admin-${runId}@casey.test`,
      tenantAdminA: `tenant-admin-a-${runId}@casey.test`,
      solicitorA: `solicitor-a-${runId}@casey.test`,
      paralegalA: `paralegal-a-${runId}@casey.test`,
      solicitorB: `solicitor-b-${runId}@casey.test`,
    };

    const { error: tenantError } = await service.from("tenants").insert([
      {
        id: tenantAId,
        name: `Tenant A ${runId}`,
      },
      {
        id: tenantBId,
        name: `Tenant B ${runId}`,
      },
    ]);
    if (tenantError) throw tenantError;

    const appAdmin = await createTestUser(service, {
      email: emails.appAdmin,
      password: passwords.appAdmin,
      role: "app_admin",
      tenantId: null,
      displayName: "App Admin",
    });
    const tenantAdminA = await createTestUser(service, {
      email: emails.tenantAdminA,
      password: passwords.tenantAdminA,
      role: "tenant_admin",
      tenantId: tenantAId,
      displayName: "Tenant Admin A",
    });
    const solicitorA = await createTestUser(service, {
      email: emails.solicitorA,
      password: passwords.solicitorA,
      role: "solicitor",
      tenantId: tenantAId,
      displayName: "Solicitor A",
    });
    const paralegalA = await createTestUser(service, {
      email: emails.paralegalA,
      password: passwords.paralegalA,
      role: "paralegal",
      tenantId: tenantAId,
      displayName: "Paralegal A",
    });
    const solicitorB = await createTestUser(service, {
      email: emails.solicitorB,
      password: passwords.solicitorB,
      role: "solicitor",
      tenantId: tenantBId,
      displayName: "Solicitor B",
    });

    const { error: caseError } = await service.from("cases").insert([
      {
        id: caseAId,
        tenant_id: tenantAId,
        title: `Case A ${runId}`,
        assigned_to: solicitorA.id,
        assigned_to_ids: [solicitorA.id, paralegalA.id],
      },
      {
        id: caseBId,
        tenant_id: tenantBId,
        title: `Case B ${runId}`,
        assigned_to: solicitorB.id,
        assigned_to_ids: [solicitorB.id],
      },
    ]);
    if (caseError) throw caseError;

    const { error: statementError } = await service.from("statements").insert([
      {
        id: statementAId,
        case_id: caseAId,
        tenant_id: tenantAId,
        title: `Statement A ${runId}`,
        witness_name: "Witness A",
        witness_email: `witness-a-${runId}@casey.test`,
      },
      {
        id: statementBId,
        case_id: caseBId,
        tenant_id: tenantBId,
        title: `Statement B ${runId}`,
        witness_name: "Witness B",
        witness_email: `witness-b-${runId}@casey.test`,
      },
    ]);
    if (statementError) throw statementError;

    const { error: messageError } = await service
      .from("conversation_messages")
      .insert([
        {
          statement_id: statementAId,
          role: "assistant",
          content: "Please explain what happened.",
        },
        {
          statement_id: statementBId,
          role: "assistant",
          content: "Please explain what happened in tenant B.",
        },
      ]);
    if (messageError) throw messageError;

    const { error: magicLinkError } = await service.from("magic_links").insert([
      {
        token: `magic-${runId}`,
        statement_id: statementAId,
        tenant_id: tenantAId,
        expires_at: "2099-01-01T00:00:00.000Z",
      },
    ]);
    if (magicLinkError) throw magicLinkError;

    const { error: inviteError } = await service.from("invites").insert([
      {
        id: inviteAId,
        email: `invitee-${runId}@casey.test`,
        token: inviteAToken,
        tenant_id: tenantAId,
        role: "paralegal",
        created_by: tenantAdminA.id,
        expires_at: "2099-01-01T00:00:00.000Z",
      },
    ]);
    if (inviteError) throw inviteError;

    const { error: deletionRequestError } = await service
      .from("account_deletion_requests")
      .insert([
        {
          tenant_id: tenantAId,
          requested_user_id: paralegalA.id,
          requested_by_user_id: paralegalA.id,
          reason: "Test request",
        },
      ]);
    if (deletionRequestError) throw deletionRequestError;

    const { error: noteError } = await service.from("case_notes").insert([
      {
        tenant_id: tenantAId,
        case_id: caseAId,
        author_user_id: solicitorA.id,
        body: "Case note for tenant A",
      },
    ]);
    if (noteError) throw noteError;

    const { error: preferenceError } = await service
      .from("tenant_notification_preferences")
      .insert([
        {
          tenant_id: tenantAId,
          updated_by_user_id: tenantAdminA.id,
        },
      ]);
    if (preferenceError) throw preferenceError;

    const { error: caseTemplateError } = await service
      .from("case_templates")
      .insert([
        {
          id: templateGlobalCaseId,
          tenant_id: null,
          name: `Global Case Template ${runId}`,
          template_scope: "global",
          created_by: appAdmin.id,
        },
        {
          id: templateTenantACaseId,
          tenant_id: tenantAId,
          name: `Tenant A Case Template ${runId}`,
          template_scope: "tenant",
          created_by: tenantAdminA.id,
        },
        {
          id: templateTenantBCaseId,
          tenant_id: tenantBId,
          name: `Tenant B Case Template ${runId}`,
          template_scope: "tenant",
          created_by: solicitorB.id,
        },
      ]);
    if (caseTemplateError) throw caseTemplateError;

    const { error: statementTemplateError } = await service
      .from("statement_config_templates")
      .insert([
        {
          id: templateGlobalStatementId,
          tenant_id: null,
          name: `Global Statement Template ${runId}`,
          template_scope: "global",
          created_by: appAdmin.id,
          draft_config: {},
        },
        {
          id: templateTenantAStatementId,
          tenant_id: tenantAId,
          name: `Tenant A Statement Template ${runId}`,
          template_scope: "tenant",
          created_by: tenantAdminA.id,
          draft_config: {},
        },
        {
          id: templateTenantBStatementId,
          tenant_id: tenantBId,
          name: `Tenant B Statement Template ${runId}`,
          template_scope: "tenant",
          created_by: solicitorB.id,
          draft_config: {},
        },
      ]);
    if (statementTemplateError) throw statementTemplateError;

    const upload = await service.storage
      .from(tenantAId)
      .upload(`rls/${runId}/service.txt`, new Blob(["service file"]), {
        contentType: "text/plain",
        upsert: true,
      });
    if (upload.error) throw upload.error;

    seed = {
      runId,
      tenantAId,
      tenantBId,
      caseAId,
      caseBId,
      statementAId,
      statementBId,
      templateGlobalCaseId,
      templateTenantACaseId,
      templateTenantBCaseId,
      templateGlobalStatementId,
      templateTenantAStatementId,
      templateTenantBStatementId,
      inviteAId,
      inviteAToken,
      authUsers: [
        { id: appAdmin.id, email: emails.appAdmin, password: passwords.appAdmin },
        {
          id: tenantAdminA.id,
          email: emails.tenantAdminA,
          password: passwords.tenantAdminA,
        },
        { id: solicitorA.id, email: emails.solicitorA, password: passwords.solicitorA },
        {
          id: paralegalA.id,
          email: emails.paralegalA,
          password: passwords.paralegalA,
        },
        { id: solicitorB.id, email: emails.solicitorB, password: passwords.solicitorB },
      ],
      emails,
      passwords,
    };
  }, 120000);

  afterAll(async () => {
    if (!seed) {
      return;
    }

    await service.storage.from(seed.tenantAId).remove([`rls/${seed.runId}/service.txt`]);

    await service.from("statement_config_templates").delete().in("id", [
      seed.templateGlobalStatementId,
      seed.templateTenantAStatementId,
      seed.templateTenantBStatementId,
    ]);
    await service.from("case_templates").delete().in("id", [
      seed.templateGlobalCaseId,
      seed.templateTenantACaseId,
      seed.templateTenantBCaseId,
    ]);
    await service
      .from("account_deletion_requests")
      .delete()
      .eq("reason", "Test request");
    await service.from("invites").delete().eq("id", seed.inviteAId);
    await service
      .from("conversation_messages")
      .delete()
      .in("statement_id", [seed.statementAId, seed.statementBId]);
    await service
      .from("statements")
      .delete()
      .in("id", [seed.statementAId, seed.statementBId]);
    await service.from("cases").delete().in("id", [seed.caseAId, seed.caseBId]);
    await service
      .from("tenant_notification_preferences")
      .delete()
      .eq("tenant_id", seed.tenantAId);
    await service.from("tenants").delete().in("id", [seed.tenantAId, seed.tenantBId]);

    for (const user of seed.authUsers) {
      await service.auth.admin.deleteUser(user.id);
    }
  }, 120000);

  it("isolates cases, statements, and conversation messages by tenant", async () => {
    const solicitorA = await signInAs(seed.emails.solicitorA, seed.passwords.solicitorA);
    const solicitorB = await signInAs(seed.emails.solicitorB, seed.passwords.solicitorB);

    const casesA = await solicitorA
      .from("cases")
      .select("id,title")
      .order("title", { ascending: true });
    const statementsA = await solicitorA
      .from("statements")
      .select("id,title")
      .order("title", { ascending: true });
    const messagesA = await solicitorA
      .from("conversation_messages")
      .select("content, statements!inner(tenant_id)")
      .eq("statements.tenant_id", seed.tenantAId);

    expect(casesA.error).toBeNull();
    expect(statementsA.error).toBeNull();
    expect(messagesA.error).toBeNull();
    expect(casesA.data?.map((item) => item.id)).toEqual([seed.caseAId]);
    expect(statementsA.data?.map((item) => item.id)).toEqual([seed.statementAId]);
    expect(messagesA.data).toHaveLength(1);

    const casesB = await solicitorB.from("cases").select("id,title");
    expect(casesB.error).toBeNull();
    expect(casesB.data?.map((item) => item.id)).toEqual([seed.caseBId]);
  });

  it("hides tenant data once the tenant is soft-deleted", async () => {
    const solicitorA = await signInAs(seed.emails.solicitorA, seed.passwords.solicitorA);

    const deactivate = await service
      .from("tenants")
      .update({ soft_deleted_at: new Date().toISOString() })
      .eq("id", seed.tenantAId);
    if (deactivate.error) throw deactivate.error;

    const cases = await solicitorA.from("cases").select("id");
    const statements = await solicitorA.from("statements").select("id");

    expect(cases.error).toBeNull();
    expect(statements.error).toBeNull();
    expect(cases.data).toEqual([]);
    expect(statements.data).toEqual([]);

    const reactivate = await service
      .from("tenants")
      .update({ soft_deleted_at: null, purge_after: null })
      .eq("id", seed.tenantAId);
    if (reactivate.error) throw reactivate.error;
  });

  it("enforces template visibility and role-based template management", async () => {
    const appAdmin = await signInAs(seed.emails.appAdmin, seed.passwords.appAdmin);
    const tenantAdminA = await signInAs(
      seed.emails.tenantAdminA,
      seed.passwords.tenantAdminA,
    );
    const paralegalA = await signInAs(
      seed.emails.paralegalA,
      seed.passwords.paralegalA,
    );

    const appAdminCaseTemplates = await appAdmin
      .from("case_templates")
      .select("id,name")
      .order("name", { ascending: true });
    expect(appAdminCaseTemplates.error).toBeNull();
    expect(appAdminCaseTemplates.data?.map((item) => item.id)).toEqual([
      seed.templateGlobalCaseId,
    ]);

    const tenantAdminStatementTemplates = await tenantAdminA
      .from("statement_config_templates")
      .select("id,name")
      .order("name", { ascending: true });
    expect(tenantAdminStatementTemplates.error).toBeNull();
    expect(tenantAdminStatementTemplates.data?.map((item) => item.id).sort()).toEqual(
      [seed.templateGlobalStatementId, seed.templateTenantAStatementId].sort(),
    );

    const deniedInsert = await paralegalA.from("case_templates").insert({
      tenant_id: seed.tenantAId,
      name: `Paralegal Template ${seed.runId}`,
      template_scope: "tenant",
      created_by: seed.authUsers.find((user) => user.email === seed.emails.paralegalA)
        ?.id,
    });
    expect(deniedInsert.error).not.toBeNull();
    expect(deniedInsert.status).toBe(403);
  });

  it("limits invite and deletion-request visibility to the allowed users", async () => {
    const tenantAdminA = await signInAs(
      seed.emails.tenantAdminA,
      seed.passwords.tenantAdminA,
    );
    const paralegalA = await signInAs(
      seed.emails.paralegalA,
      seed.passwords.paralegalA,
    );
    const solicitorB = await signInAs(seed.emails.solicitorB, seed.passwords.solicitorB);

    const inviteVisibleToTenantAdmin = await tenantAdminA
      .from("invites")
      .select("id,token")
      .eq("id", seed.inviteAId);
    expect(inviteVisibleToTenantAdmin.error).toBeNull();
    expect(inviteVisibleToTenantAdmin.data?.map((item) => item.id)).toEqual([
      seed.inviteAId,
    ]);

    const inviteHiddenFromParalegal = await paralegalA
      .from("invites")
      .select("id,token")
      .eq("id", seed.inviteAId);
    expect(inviteHiddenFromParalegal.error).toBeNull();
    expect(inviteHiddenFromParalegal.data).toEqual([]);

    const ownDeletionRequests = await paralegalA
      .from("account_deletion_requests")
      .select("requested_user_id,status");
    expect(ownDeletionRequests.error).toBeNull();
    expect(ownDeletionRequests.data).toHaveLength(1);

    const tenantDeletionRequests = await tenantAdminA
      .from("account_deletion_requests")
      .select("requested_user_id,status");
    expect(tenantDeletionRequests.error).toBeNull();
    expect(tenantDeletionRequests.data).toHaveLength(1);

    const otherTenantDeletionRequests = await solicitorB
      .from("account_deletion_requests")
      .select("requested_user_id,status");
    expect(otherTenantDeletionRequests.error).toBeNull();
    expect(otherTenantDeletionRequests.data).toEqual([]);
  });

  it("enforces authenticated and anonymous storage policies for tenant buckets", async () => {
    const solicitorA = await signInAs(seed.emails.solicitorA, seed.passwords.solicitorA);
    const solicitorB = await signInAs(seed.emails.solicitorB, seed.passwords.solicitorB);
    const anon = createAnonClient();

    const authenticatedUpload = await solicitorA.storage
      .from(seed.tenantAId)
      .upload(`rls/${seed.runId}/member.txt`, new Blob(["member file"]), {
        contentType: "text/plain",
        upsert: true,
      });
    expect(authenticatedUpload.error).toBeNull();

    const crossTenantRead = await solicitorB.storage
      .from(seed.tenantAId)
      .download(`rls/${seed.runId}/member.txt`);
    expect(crossTenantRead.error).not.toBeNull();

    const anonRead = await anon.storage
      .from(seed.tenantAId)
      .download(`rls/${seed.runId}/service.txt`);
    expect(anonRead.error).toBeNull();

    const anonUpload = await anon.storage
      .from(seed.tenantAId)
      .upload(`rls/${seed.runId}/anon.txt`, new Blob(["anon file"]), {
        contentType: "text/plain",
        upsert: true,
      });
    expect(anonUpload.error).toBeNull();

    await service.from("magic_links").update({
      expires_at: "2000-01-01T00:00:00.000Z",
    }).eq("tenant_id", seed.tenantAId);

    const anonReadAfterExpiry = await anon.storage
      .from(seed.tenantAId)
      .download(`rls/${seed.runId}/service.txt`);
    expect(anonReadAfterExpiry.error).not.toBeNull();

    await service.from("magic_links").update({
      expires_at: "2099-01-01T00:00:00.000Z",
    }).eq("tenant_id", seed.tenantAId);

    await service.storage.from(seed.tenantAId).remove([
      `rls/${seed.runId}/member.txt`,
      `rls/${seed.runId}/anon.txt`,
    ]);
  });
});

export default suite;
