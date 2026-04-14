import type { UserRole } from "@/types";

export type ParsedInviteRow = {
  email: string;
  role: UserRole;
  lineNumber: number;
};

export type InviteCsvParseResult = {
  rows: ParsedInviteRow[];
  errors: string[];
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
};

const normalizeRole = (rawRole: string): UserRole | null => {
  const role = rawRole
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    role === "app_admin" ||
    role === "tenant_admin" ||
    role === "solicitor" ||
    role === "paralegal"
  ) {
    return role;
  }

  return null;
};

export const parseInviteCsv = (rawText: string): InviteCsvParseResult => {
  const errors: string[] = [];
  const rows: ParsedInviteRow[] = [];

  const nonEmptyLines = rawText
    .split(/\r?\n/)
    .map((line, index) => ({
      lineNumber: index + 1,
      text: line.trim(),
    }))
    .filter((line) => line.text.length > 0);

  if (nonEmptyLines.length === 0) {
    return { rows, errors: ["CSV is empty"] };
  }

  const first = parseCsvLine(nonEmptyLines[0].text).map((value) =>
    value.trim().toLowerCase(),
  );
  const hasHeader = first[0] === "email" && first[1] === "role";

  const dataLines = hasHeader ? nonEmptyLines.slice(1) : nonEmptyLines;

  if (dataLines.length === 0) {
    return { rows, errors: ["CSV has no invite rows"] };
  }

  for (const line of dataLines) {
    const [emailRaw = "", roleRaw = ""] = parseCsvLine(line.text);
    const email = emailRaw.trim().toLowerCase();
    const role = normalizeRole(roleRaw);

    if (!email || !roleRaw) {
      errors.push(`Line ${line.lineNumber}: expected email,role`);
      continue;
    }

    if (!EMAIL_REGEX.test(email)) {
      errors.push(`Line ${line.lineNumber}: invalid email \"${email}\"`);
      continue;
    }

    if (!role) {
      errors.push(`Line ${line.lineNumber}: invalid role \"${roleRaw}\"`);
      continue;
    }

    rows.push({ email, role, lineNumber: line.lineNumber });
  }

  return {
    rows,
    errors,
  };
};
