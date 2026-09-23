/**
 * After the production reset migration, attach starter DOCX files and create
 * the app admin.
 *
 *   APP_ADMIN_PASSWORD='...' npx tsx scripts/seed-production.ts
 *
 * The password is read from the environment and is not written to the repo.
 * Omit APP_ADMIN_PASSWORD to refresh templates and documents only.
 *
 *   npx tsx scripts/seed-production.ts --print-sql
 * prints the template INSERT statements used by the reset migration.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { generateStarterDoc } from "../src/lib/doc-gen";
import {
  APP_ADMIN_EMAIL,
  SEEDED_CASE_TEMPLATES,
  SEEDED_STATEMENT_TEMPLATES,
} from "../src/lib/templates/claimant-firm-seeds";
import type { Database, Json } from "../src/types";

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const GLOBAL_BUCKET = "global-templates";

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) {
      continue;
    }
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function sqlLiteral(value: unknown) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

function printSeedSql() {
  const statements = SEEDED_STATEMENT_TEMPLATES.map((template) => {
    const config = sqlLiteral(template.config);
    return `INSERT INTO public.statement_config_templates (
  id, tenant_id, name, status, template_scope, draft_config, published_config, published_at, created_by
) VALUES (
  '${template.id}', NULL, '${template.name.replaceAll("'", "''")}', 'published', 'global',
  ${config}, ${config}, NOW(), NULL
);`;
  });

  const cases = SEEDED_CASE_TEMPLATES.map((template) => {
    const config = sqlLiteral(template.config);
    return `INSERT INTO public.case_templates (
  id, tenant_id, name, status, template_scope, draft_config, published_config, published_at, created_by, title_template
) VALUES (
  '${template.id}', NULL, '${template.name.replaceAll("'", "''")}', 'published', 'global',
  ${config}, ${config}, NOW(), NULL, '${template.titleTemplate.replaceAll("'", "''")}'
);`;
  });

  const links = SEEDED_CASE_TEMPLATES.flatMap((template) =>
    template.statements.map(
      (link) => `INSERT INTO public.case_template_statement_templates (
  case_template_id, statement_template_id, is_default
) VALUES (
  '${template.id}', '${link.template.id}', ${link.isDefault ? "true" : "false"}
);`,
    ),
  );

  process.stdout.write(
    [...statements, ...cases, ...links].join("\n\n") + "\n",
  );
}

async function main() {
  if (process.argv.includes("--print-sql")) {
    printSeedSql();
    return;
  }

  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = (
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.",
    );
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await emptyStorage(supabase);

  for (const template of SEEDED_STATEMENT_TEMPLATES) {
    const blob = await generateStarterDoc({
      templateName: template.name,
      config: template.config,
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const path = `statement-templates/global/${template.id}.docx`;
    const { error: uploadError } = await supabase.storage
      .from(GLOBAL_BUCKET)
      .upload(path, bytes, {
        contentType: DOCX_TYPE,
        upsert: true,
      });
    if (uploadError) {
      throw uploadError;
    }

    const document = {
      bucketId: GLOBAL_BUCKET,
      name: `${template.name}.docx`,
      path,
      type: DOCX_TYPE,
      uploadedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("statement_config_templates").upsert(
      {
        id: template.id,
        tenant_id: null,
        name: template.name,
        status: "published",
        template_scope: "global",
        draft_config: template.config as unknown as Json,
        published_config: template.config as unknown as Json,
        published_at: new Date().toISOString(),
        created_by: null,
        draft_docx_template_document: document as unknown as Json,
        published_docx_template_document: document as unknown as Json,
      },
      { onConflict: "id" },
    );
    if (error) {
      throw error;
    }
  }

  for (const template of SEEDED_CASE_TEMPLATES) {
    const { error } = await supabase.from("case_templates").upsert(
      {
        id: template.id,
        tenant_id: null,
        name: template.name,
        status: "published",
        template_scope: "global",
        draft_config: template.config as unknown as Json,
        published_config: template.config as unknown as Json,
        published_at: new Date().toISOString(),
        created_by: null,
        title_template: template.titleTemplate,
      },
      { onConflict: "id" },
    );
    if (error) {
      throw error;
    }

    for (const link of template.statements) {
      const { error: linkError } = await supabase
        .from("case_template_statement_templates")
        .upsert(
          {
            case_template_id: template.id,
            statement_template_id: link.template.id,
            is_default: link.isDefault,
          },
          { onConflict: "case_template_id,statement_template_id" },
        );
      if (linkError) {
        throw linkError;
      }
    }
  }

  const password = process.env.APP_ADMIN_PASSWORD?.trim();
  if (!password) {
    console.log(
      "Templates seeded. APP_ADMIN_PASSWORD was not set, so no admin user was created.",
    );
    return;
  }

  await ensureAppAdmin(supabase, password);
  console.log(`Templates seeded. App admin ready for ${APP_ADMIN_EMAIL}.`);
}

async function emptyStorage(supabase: ReturnType<typeof createClient<Database>>) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    throw error;
  }

  for (const bucket of buckets ?? []) {
    const { error: emptyError } = await supabase.storage.emptyBucket(bucket.id);
    if (emptyError) {
      throw emptyError;
    }
  }
}

async function ensureAppAdmin(
  supabase: ReturnType<typeof createClient<Database>>,
  password: string,
) {
  let userId: string | null = null;
  let page = 1;

  while (!userId && page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw error;
    }
    userId =
      data.users.find(
        (user) => user.email?.toLowerCase() === APP_ADMIN_EMAIL,
      )?.id ?? null;
    if (data.users.length < 200) {
      break;
    }
    page += 1;
  }

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: APP_ADMIN_EMAIL,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error(`Failed to create ${APP_ADMIN_EMAIL}`);
    }
    userId = data.user.id;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) {
      throw error;
    }
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      tenant_id: null,
      role: "app_admin",
      display_name: null,
    },
    { onConflict: "user_id" },
  );
  if (profileError) {
    throw profileError;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Seed failed.";
  console.error(message);
  process.exit(1);
});
