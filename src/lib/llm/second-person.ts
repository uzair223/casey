function matchCase(source: string, replacement: string) {
  const first = source[0];
  if (first && first !== first.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const LEAD_PHRASES: Array<[string, string]> = [
  ["\\bthe lead was\\b", "you were"],
  ["\\bthe lead is\\b", "you are"],
  ["\\bthe lead has\\b", "you have"],
  ["\\bthe lead had\\b", "you had"],
  ["\\bthe lead['’]s\\b", "your"],
  ["\\bthe lead\\b", "you"],
];

export function secondPersonSpeech(text: string) {
  return LEAD_PHRASES.reduce(
    (spoken, [source, replacement]) =>
      spoken.replace(new RegExp(source, "gi"), (match) =>
        matchCase(match, replacement),
      ),
    text,
  );
}

const INCOMPLETE_LEAD =
  /(?:^|\s)(t|th|the|the\s+|the\s+l|the\s+le|the\s+lea)$/i;

export function spokenSoFar(text: string) {
  const match = INCOMPLETE_LEAD.exec(text);
  const held = match?.[1].length ?? 0;
  return secondPersonSpeech(text.slice(0, text.length - held));
}

export function overviewAsSpoken(summary: string | null | undefined) {
  return secondPersonSpeech(summary ?? "")
    .replace(/\btheir\b/gi, (match) => matchCase(match, "your"))
    .replace(/\bthey\b/gi, (match) => matchCase(match, "you"))
    .replace(/\s+/g, " ")
    .trim();
}
