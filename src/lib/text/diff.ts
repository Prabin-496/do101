export type DiffOp = "equal" | "insert" | "delete";

export interface DiffPart {
  op: DiffOp;
  value: string;
}

export interface DiffOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

/** Splits into words while keeping the whitespace as its own token. */
function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

function normalize(token: string, options: DiffOptions): string {
  let t = token;
  if (options.ignoreCase) t = t.toLowerCase();
  if (options.ignoreWhitespace && /^\s+$/.test(t)) t = " ";
  return t;
}

/** Longest-common-subsequence word diff. Capped to stay responsive. */
export const DIFF_TOKEN_LIMIT = 4000;

export function diffWords(a: string, b: string, options: DiffOptions = {}): DiffPart[] {
  const A = tokenize(a).slice(0, DIFF_TOKEN_LIMIT);
  const B = tokenize(b).slice(0, DIFF_TOKEN_LIMIT);
  const na = A.length;
  const nb = B.length;

  // LCS table (Uint32 keeps memory predictable for the capped sizes).
  const width = nb + 1;
  const table = new Uint32Array((na + 1) * width);
  for (let i = na - 1; i >= 0; i--) {
    for (let j = nb - 1; j >= 0; j--) {
      table[i * width + j] =
        normalize(A[i], options) === normalize(B[j], options)
          ? table[(i + 1) * width + (j + 1)] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + (j + 1)]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (op: DiffOp, value: string) => {
    const last = parts[parts.length - 1];
    if (last && last.op === op) last.value += value;
    else parts.push({ op, value });
  };

  let i = 0;
  let j = 0;
  while (i < na && j < nb) {
    if (normalize(A[i], options) === normalize(B[j], options)) {
      push("equal", B[j]);
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + (j + 1)]) {
      push("delete", A[i]);
      i++;
    } else {
      push("insert", B[j]);
      j++;
    }
  }
  while (i < na) push("delete", A[i++]);
  while (j < nb) push("insert", B[j++]);

  return parts;
}

export function diffSummary(parts: DiffPart[]) {
  const count = (op: DiffOp) =>
    parts
      .filter((p) => p.op === op)
      .reduce((n, p) => n + (p.value.trim() ? p.value.trim().split(/\s+/).length : 0), 0);
  return {
    added: count("insert"),
    removed: count("delete"),
    unchanged: count("equal"),
    identical: parts.every((p) => p.op === "equal"),
  };
}
