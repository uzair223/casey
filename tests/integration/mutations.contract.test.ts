import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const MUTATIONS_ROOT = path.join(
  process.cwd(),
  "src",
  "lib",
  "supabase",
  "mutations",
);

async function getMutationFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return getMutationFiles(fullPath);
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

describe("Supabase mutation modules", () => {
  it("imports every mutation file and validates exported symbols", async () => {
    const mutationFiles = await getMutationFiles(MUTATIONS_ROOT);
    expect(mutationFiles.length).toBeGreaterThan(0);

    for (const mutationFile of mutationFiles) {
      const moduleUrl = pathToFileURL(mutationFile).href;
      const mod = (await import(moduleUrl)) as Record<string, unknown>;
      const exportKeys = Object.keys(mod);

      expect(
        exportKeys.length,
        `No exports found in ${mutationFile}`,
      ).toBeGreaterThan(0);

      for (const exportKey of exportKeys) {
        const exported = mod[exportKey];

        expect(
          ["function", "object", "string", "number", "boolean"].includes(
            typeof exported,
          ),
          `Unexpected export type for ${mutationFile}#${exportKey}`,
        ).toBe(true);
      }
    }
  });
});
