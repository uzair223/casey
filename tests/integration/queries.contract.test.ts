import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const QUERIES_ROOT = path.join(
  process.cwd(),
  "src",
  "lib",
  "supabase",
  "queries",
);

async function getQueryFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return getQueryFiles(fullPath);
      }

      if (!entry.isFile()) {
        return [];
      }

      return entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")
        ? [fullPath]
        : [];
    }),
  );

  return files.flat();
}

describe("Supabase query modules", () => {
  it("imports every query file and validates exported symbols", async () => {
    const queryFiles = await getQueryFiles(QUERIES_ROOT);
    expect(queryFiles.length).toBeGreaterThan(0);

    for (const queryFile of queryFiles) {
      const moduleUrl = pathToFileURL(queryFile).href;
      const mod = (await import(moduleUrl)) as Record<string, unknown>;
      const exportKeys = Object.keys(mod);

      expect(
        exportKeys.length,
        `No exports found in ${queryFile}`,
      ).toBeGreaterThan(0);

      for (const exportKey of exportKeys) {
        const exported = mod[exportKey];

        // Query modules should primarily export functions and constants.
        expect(
          ["function", "object", "string", "number", "boolean"].includes(
            typeof exported,
          ),
          `Unexpected export type for ${queryFile}#${exportKey}`,
        ).toBe(true);
      }
    }
  });
});
