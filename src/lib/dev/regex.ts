export interface RegexMatch {
  index: number;
  match: string;
  groups: Array<{ name: string; value: string | undefined }>;
}

export type RegexResult =
  | { ok: true; matches: RegexMatch[]; truncated: boolean }
  | { ok: false; error: string };

export const MAX_MATCHES = 500;

/** Turns terse engine errors into something a human can act on. */
export function explainRegexError(message: string): string {
  const map: Array<[RegExp, string]> = [
    [/Unterminated group/i, "A group was opened with ( but never closed with )."],
    [/Unmatched '\)'/i, "There is a closing ) with no matching opening (."],
    [/Unterminated character class/i, "A character class was opened with [ but never closed with ]."],
    [/Nothing to repeat/i, "A quantifier such as *, + or ? has nothing before it to repeat."],
    [/Invalid escape/i, "A backslash escape is not recognised. Escape a literal backslash as \\\\."],
    [/Invalid group/i, "A group modifier such as (?…) is malformed."],
    [/Invalid flags/i, "Those flags are not valid. Use any of g, i, m, s, u, y."],
    [/Invalid regular expression/i, "The pattern is not valid."],
  ];
  for (const [pattern, friendly] of map) {
    if (pattern.test(message)) return friendly;
  }
  return message;
}

export function runRegex(pattern: string, flags: string, input: string): RegexResult {
  if (!pattern) return { ok: true, matches: [], truncated: false };

  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
  } catch (err) {
    return {
      ok: false,
      error: explainRegexError(err instanceof Error ? err.message : "Invalid pattern"),
    };
  }

  const matches: RegexMatch[] = [];
  const started = Date.now();
  let lastIndex = -1;
  let m: RegExpExecArray | null;

  while ((m = re.exec(input)) !== null) {
    // Guard against pathological patterns freezing the tab.
    if (Date.now() - started > 1000) {
      return {
        ok: false,
        error:
          "This pattern took too long to run — it may be backtracking catastrophically. Try making the quantifiers less greedy.",
      };
    }
    const groups: RegexMatch["groups"] = [];
    for (let i = 1; i < m.length; i++) groups.push({ name: String(i), value: m[i] });
    if (m.groups) {
      for (const [name, value] of Object.entries(m.groups)) groups.push({ name, value });
    }
    matches.push({ index: m.index, match: m[0], groups });

    if (m.index === lastIndex && m[0] === "") re.lastIndex++;
    lastIndex = m.index;
    if (m[0] === "") re.lastIndex++;
    if (matches.length >= MAX_MATCHES) return { ok: true, matches, truncated: true };
    if (!flags.includes("g") && matches.length >= 1) break;
  }

  return { ok: true, matches, truncated: false };
}

export const REGEX_CHEATSHEET: Array<{ token: string; meaning: string }> = [
  { token: ".", meaning: "Any character except a newline" },
  { token: "\\d", meaning: "A digit (0–9)" },
  { token: "\\w", meaning: "A word character (letter, digit or underscore)" },
  { token: "\\s", meaning: "Any whitespace" },
  { token: "^ $", meaning: "Start and end of the string (or line with the m flag)" },
  { token: "*", meaning: "Zero or more" },
  { token: "+", meaning: "One or more" },
  { token: "?", meaning: "Optional, or make a quantifier lazy" },
  { token: "{2,5}", meaning: "Between two and five times" },
  { token: "[abc]", meaning: "Any one of a, b or c" },
  { token: "[^abc]", meaning: "Any character except a, b or c" },
  { token: "(…)", meaning: "Capture group" },
  { token: "(?:…)", meaning: "Group without capturing" },
  { token: "(?<name>…)", meaning: "Named capture group" },
  { token: "a|b", meaning: "a or b" },
  { token: "\\b", meaning: "Word boundary" },
];
