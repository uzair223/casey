import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const fileEnv = loadEnvFile(resolve(process.cwd(), ".env"));
const accountId =
  fileEnv.CLOUDFLARE_ADMIN_ACCOUNT_ID ||
  process.env.CLOUDFLARE_ADMIN_ACCOUNT_ID;
const adminToken =
  fileEnv.CLOUDFLARE_ADMIN_API_TOKEN || process.env.CLOUDFLARE_ADMIN_API_TOKEN;

if (!accountId || !adminToken) {
  console.error(
    "CLOUDFLARE_ADMIN_ACCOUNT_ID and CLOUDFLARE_ADMIN_API_TOKEN are required for Wrangler. Do not use CLOUDFLARE_AI_API_TOKEN for deploy.",
  );
  process.exit(1);
}

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error("Usage: node scripts/with-cloudflare-admin.mjs <command> [...args]");
  process.exit(1);
}

const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
  env: {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_API_TOKEN: adminToken,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
