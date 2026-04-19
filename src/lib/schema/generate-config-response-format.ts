import { z } from "zod";

export function buildGenerateConfigResponseSchema<T extends z.ZodObject>(
  objectSchema: T,
) {
  return z
    .object({
      kind: z.enum(["message", "patch"]),
      message: z.string().trim().min(1),
      data: objectSchema.strict().nullable(),
    })
    .strict();
}
