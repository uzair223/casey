import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_DB_REGION = "eu-west-1";
const FIRST_UNVERIFIED_VERSION = "20260917120000";
const POOLER_CLUSTER_INDEXES = [0, 1, 2];
const FALLBACK_POOLER_REGIONS = [
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-central-1",
];

function loadEnvFile(path) {
  const values = {};
  if (!existsSync(path)) {
    return values;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) {
      continue;
    }
    const index = line.indexOf("=");
    values[line.slice(0, index)] = line.slice(index + 1);
  }

  return values;
}

function envValue(fileEnv, name) {
  return (process.env[name] || fileEnv[name] || "").trim();
}

function redact(text, secrets) {
  let next = text;
  for (const secret of secrets) {
    if (secret) {
      next = next.split(secret).join("[secret]");
    }
  }
  return next;
}

function run(command, args, { secrets = [] } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(redact(text, secrets));
    });
    child.stderr?.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(redact(text, secrets));
    });

    child.on("error", reject);
    child.on("close", (code) => {
      const result = { code: code ?? 1, stdout, stderr };
      if (code === 0) {
        resolvePromise(result);
        return;
      }
      reject(
        Object.assign(
          new Error(
            redact(
              `${command} ${args.join(" ")} failed with exit code ${code}`,
              secrets,
            ),
          ),
          result,
        ),
      );
    });
  });
}

function projectRefFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    const [ref] = hostname.split(".");
    return ref || "";
  } catch {
    return "";
  }
}

function localMigrationVersions() {
  const directory = resolve(process.cwd(), "supabase/migrations");
  return readdirSync(directory)
    .map((name) => name.match(/^(\d+)_/)?.[1])
    .filter(Boolean)
    .sort();
}

function parseRemoteVersions(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((row) => {
          if (typeof row === "string") {
            return row;
          }
          if (row && typeof row === "object") {
            if (row.remote === false || row.remote === null || row.remote === "") {
              return "";
            }
            return String(row.version || row.remote || "");
          }
          return "";
        })
        .filter(Boolean);
    }
  } catch {
    // Fall through to the table parser.
  }

  const versions = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const cols = line.split("|").map((col) => col.trim());
    if (cols.length < 2) {
      continue;
    }
    const remote = cols[1].match(/^(\d{14})$/);
    if (remote) {
      versions.push(remote[1]);
    }
  }
  return [...new Set(versions)];
}

function sessionPoolerUrl(projectRef, encodedPassword, host) {
  return `postgresql://postgres.${projectRef}:${encodedPassword}@${host}:5432/postgres?sslmode=require`;
}

function buildDbUrls({ password, projectRef, region, poolerHost }) {
  const encoded = encodeURIComponent(password);
  const urls = {};

  if (poolerHost) {
    urls.pooler = sessionPoolerUrl(projectRef, encoded, poolerHost);
  } else {
    const regions = [
      region,
      ...FALLBACK_POOLER_REGIONS.filter((item) => item !== region),
    ];
    for (const currentRegion of regions) {
      for (const index of POOLER_CLUSTER_INDEXES) {
        const host = `aws-${index}-${currentRegion}.pooler.supabase.com`;
        urls[`pooler-aws-${index}-${currentRegion}`] = sessionPoolerUrl(
          projectRef,
          encoded,
          host,
        );
      }
    }
  }

  urls.direct = `postgresql://postgres:${encoded}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;
  return urls;
}

function isRetryableDbHostError(error) {
  const combined = `${error.stderr || ""}\n${error.stdout || ""}\n${error.message || ""}`;
  return /tenant\/user .* not found|Tenant or user not found|ECONNREFUSED|ENETUNREACH|ETIMEDOUT|could not (translate|connect)|connection refused|timeout expired|failed to connect to `host=/i.test(
    combined,
  );
}

function isAlreadyApplied(version, probe) {
  if (!probe?.hasTenants) {
    return false;
  }
  if (version < FIRST_UNVERIFIED_VERSION) {
    return true;
  }
  if (version === "20260917120000") {
    return probe.hasAttemptCount;
  }
  if (version === "20260917130000") {
    return probe.hasBillingStatus && probe.hasSignatureEvents;
  }
  if (version === "20260917140000") {
    return probe.hasDocusealColumn;
  }
  return false;
}

async function probeLiveSchema(url, serviceKey) {
  if (!url || !serviceKey) {
    return null;
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [tenants, billing, attempts, signatures, docuseal] = await Promise.all([
    supabase.from("tenants").select("id").limit(1),
    supabase.from("tenants").select("billing_status").limit(1),
    supabase.from("ai_generation_jobs").select("attempt_count").limit(1),
    supabase.from("statement_signature_events").select("id").limit(1),
    supabase
      .from("statement_signature_events")
      .select("docuseal_submission_id")
      .limit(1),
  ]);

  return {
    hasTenants: !tenants.error,
    hasBillingStatus: !billing.error,
    hasAttemptCount: !attempts.error,
    hasSignatureEvents: !signatures.error,
    hasDocusealColumn: !docuseal.error,
  };
}

async function withDbUrl(dbUrls, secrets, fn) {
  let lastError;
  for (const [name, dbUrl] of Object.entries(dbUrls)) {
    try {
      console.log(`[supabase:push] Connecting via ${name}`);
      return await fn(dbUrl);
    } catch (error) {
      lastError = error;
      if (!isRetryableDbHostError(error)) {
        throw error;
      }
      console.warn(
        `[supabase:push] ${name} connection failed, trying next host`,
      );
    }
  }
  throw lastError;
}

async function main() {
  const fileEnv = loadEnvFile(resolve(process.cwd(), ".env"));
  const supabaseUrl = envValue(fileEnv, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = envValue(fileEnv, "SUPABASE_SECRET_KEY");
  const accessToken = envValue(fileEnv, "SUPABASE_ACCESS_TOKEN");
  const projectRef =
    envValue(fileEnv, "SUPABASE_PROJECT_ID") || projectRefFromUrl(supabaseUrl);
  const region = envValue(fileEnv, "SUPABASE_DB_REGION") || DEFAULT_DB_REGION;
  const password = envValue(fileEnv, "SUPABASE_DB_PASSWORD");
  const explicitDbUrl = envValue(fileEnv, "SUPABASE_DB_URL");
  const poolerHost = envValue(fileEnv, "SUPABASE_DB_POOLER_HOST");

  if (accessToken) {
    process.env.SUPABASE_ACCESS_TOKEN = accessToken;
  }

  if (!projectRef && !explicitDbUrl) {
    throw new Error(
      "Set SUPABASE_PROJECT_ID or NEXT_PUBLIC_SUPABASE_URL so migrations can target production.",
    );
  }

  if (!password && !explicitDbUrl) {
    throw new Error(
      "Set SUPABASE_DB_PASSWORD (or SUPABASE_DB_URL) to apply migrations. This is the database password from the Supabase project settings, not SUPABASE_SECRET_KEY.",
    );
  }

  const dbUrls = explicitDbUrl
    ? { supplied: explicitDbUrl }
    : buildDbUrls({ password, projectRef, region, poolerHost });
  const secrets = [password, explicitDbUrl, ...Object.values(dbUrls)].filter(
    Boolean,
  );
  const supabaseBin = resolve(process.cwd(), "node_modules/.bin/supabase");
  const command = existsSync(supabaseBin) ? supabaseBin : "npx";
  const prefix = command === "npx" ? ["supabase"] : [];

  const probe = await probeLiveSchema(supabaseUrl, serviceKey);
  const localVersions = localMigrationVersions();

  await withDbUrl(dbUrls, secrets, async (dbUrl) => {
    let remoteVersions = [];
    try {
      let listed;
      try {
        listed = await run(
          command,
          [...prefix, "migration", "list", "--db-url", dbUrl, "-o", "json"],
          { secrets },
        );
      } catch {
        listed = await run(
          command,
          [...prefix, "migration", "list", "--db-url", dbUrl],
          { secrets },
        );
      }
      remoteVersions = parseRemoteVersions(listed.stdout);
    } catch (error) {
      const combined = `${error.stderr || ""}\n${error.stdout || ""}`;
      if (
        /schema_migrations|does not exist|relation .* does not exist/i.test(
          combined,
        )
      ) {
        remoteVersions = [];
      } else {
        throw error;
      }
    }

    const pending = localVersions.filter(
      (version) => !remoteVersions.includes(version),
    );
    const toRepair = pending.filter((version) =>
      isAlreadyApplied(version, probe),
    );

    if (toRepair.length > 0) {
      console.log(
        `[supabase:push] Recording ${toRepair.length} already-applied migration(s) in history`,
      );
      await run(
        command,
        [
          ...prefix,
          "migration",
          "repair",
          "--db-url",
          dbUrl,
          "--status",
          "applied",
          "--yes",
          ...toRepair,
        ],
        { secrets },
      );
    }

    console.log(`[supabase:push] Applying pending migrations to ${projectRef}`);
    await run(
      command,
      [...prefix, "db", "push", "--db-url", dbUrl, "--yes"],
      { secrets },
    );
  });

  console.log("[supabase:push] Database is up to date");
}

main().catch((error) => {
  console.error(`[supabase:push] ${error.message}`);
  process.exit(1);
});
