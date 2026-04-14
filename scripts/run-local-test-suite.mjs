import { spawn } from "node:child_process";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} ${args.join(" ")} failed with exit code ${code}`,
          ),
        );
      }
    });
  });
}

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: true,
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `${command} ${args.join(" ")} failed with exit code ${code}\n${stderr}`,
          ),
        );
      }
    });
  });
}

function parseEnvLines(stdout) {
  const env = {};
  const lines = stdout.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes("=")) {
      continue;
    }

    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    // `supabase status -o env` can wrap values in quotes; strip only matching wrappers.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!key) {
      continue;
    }

    env[key] = value;
  }

  return env;
}

async function main() {
  let started = false;

  try {
    console.log("\n[local-test-suite] Starting local Supabase...");
    await run("supabase", ["start"]);
    started = true;

    console.log("\n[local-test-suite] Reading local Supabase environment...");
    const { stdout } = await runCapture("supabase", ["status", "-o", "env"]);
    const parsedEnv = parseEnvLines(stdout);

    const testEnv = {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL:
        parsedEnv.API_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        parsedEnv.ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        parsedEnv.ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SECRET_KEY:
        parsedEnv.SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
      CRON_SECRET: process.env.CRON_SECRET || "test-secret",
    };

    console.log("\n[local-test-suite] Running integration test suite...");
    await run("npm", ["run", "test:integration"], { env: testEnv });

    console.log("\n[local-test-suite] Test suite completed successfully.");
  } finally {
    if (started) {
      console.log("\n[local-test-suite] Stopping local Supabase...");
      try {
        await run("supabase", ["stop"]);
      } catch (stopError) {
        console.error(
          "[local-test-suite] Failed to stop Supabase cleanly:",
          stopError,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error("\n[local-test-suite] Failed:", error);
  process.exit(1);
});
