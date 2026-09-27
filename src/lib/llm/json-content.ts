function findFieldKey(raw: string, field: string) {
  const needle = `"${field}"`;
  let from = 0;
  while (from < raw.length) {
    const at = raw.indexOf(needle, from);
    if (at < 0) return -1;
    const before = raw.slice(0, at).trimEnd();
    const previous = before.at(-1);
    if (previous === "{" || previous === ",") return at;
    from = at + needle.length;
  }
  return -1;
}

export function extractJsonStringField(raw: string, field: string) {
  const keyAt = findFieldKey(raw, field);
  if (keyAt < 0) return null;

  let index = keyAt + field.length + 2;
  while (index < raw.length && /\s/.test(raw[index] ?? "")) index += 1;
  if (raw[index] !== ":") return null;
  index += 1;
  while (index < raw.length && /\s/.test(raw[index] ?? "")) index += 1;
  if (raw[index] !== '"') return null;
  index += 1;

  let value = "";
  while (index < raw.length) {
    const character = raw[index] ?? "";
    if (character === "\\") {
      if (index + 1 >= raw.length) return value;
      const next = raw[index + 1] ?? "";
      if (next === "u") {
        if (index + 6 > raw.length) return value;
        const hex = raw.slice(index + 2, index + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return value;
        value += String.fromCharCode(Number.parseInt(hex, 16));
        index += 6;
        continue;
      }
      const escaped: Record<string, string> = {
        n: "\n",
        r: "\r",
        t: "\t",
        '"': '"',
        "\\": "\\",
        "/": "/",
      };
      value += escaped[next] ?? next;
      index += 2;
      continue;
    }
    if (character === '"') return value;
    value += character;
    index += 1;
  }

  return value;
}
