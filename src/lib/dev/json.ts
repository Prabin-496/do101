export interface JsonError {
  message: string;
  line?: number;
  column?: number;
  snippet?: string;
}

export type JsonResult =
  | { ok: true; value: unknown }
  | { ok: false; error: JsonError };

function positionFromError(text: string, message: string) {
  // V8/JSC report "at position N" (and newer V8 adds "line X column Y").
  const lineCol = message.match(/line (\d+) column (\d+)/i);
  if (lineCol) return { line: Number(lineCol[1]), column: Number(lineCol[2]) };
  const pos = message.match(/at position (\d+)/i);
  if (!pos) return {};
  const index = Math.min(Number(pos[1]), text.length);
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const column = index - before.lastIndexOf("\n");
  return { line, column };
}

export function parseJson(text: string): JsonResult {
  if (!text.trim()) {
    return { ok: false, error: { message: "Nothing to parse yet — paste some JSON." } };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    const { line, column } = positionFromError(text, message);
    const snippet =
      line !== undefined ? text.split("\n")[line - 1]?.slice(0, 160) : undefined;
    return {
      ok: false,
      error: {
        message: message.replace(/^JSON\.parse: /, "").replace(/ in JSON at position \d+.*/, ""),
        line,
        column,
        snippet,
      },
    };
  }
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortDeep(v)]),
    );
  }
  return value;
}

export function formatJson(
  text: string,
  { indent = 2, sortKeys = false }: { indent?: number | "tab"; sortKeys?: boolean } = {},
): JsonResult & { output?: string } {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const value = sortKeys ? sortDeep(parsed.value) : parsed.value;
  const space = indent === "tab" ? "\t" : indent;
  return { ok: true, value, output: JSON.stringify(value, null, space) };
}

export function minifyJson(text: string): JsonResult & { output?: string } {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value, output: JSON.stringify(parsed.value) };
}

export interface JsonStats {
  type: string;
  keys: number;
  arrayItems: number;
  depth: number;
  size: number;
  duplicateKeys: string[];
}

export function jsonStats(text: string, value: unknown): JsonStats {
  let keys = 0;
  let arrayItems = 0;
  let depth = 0;

  const walk = (node: unknown, level: number) => {
    depth = Math.max(depth, level);
    if (Array.isArray(node)) {
      arrayItems += node.length;
      node.forEach((n) => walk(n, level + 1));
    } else if (node && typeof node === "object") {
      const entries = Object.entries(node as Record<string, unknown>);
      keys += entries.length;
      entries.forEach(([, v]) => walk(v, level + 1));
    }
  };
  walk(value, 1);

  return {
    type: Array.isArray(value) ? "array" : value === null ? "null" : typeof value,
    keys,
    arrayItems,
    depth,
    size: new TextEncoder().encode(text).length,
    duplicateKeys: findDuplicateKeys(text),
  };
}

/** Scans the raw source for sibling keys repeated inside one object literal. */
export function findDuplicateKeys(text: string): string[] {
  const duplicates = new Set<string>();
  const stack: Array<Set<string>> = [];
  let inString = false;
  let escaped = false;
  let current = "";
  let lastString = "";
  let expectingKey = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') {
        inString = false;
        lastString = current;
        current = "";
      } else current += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      stack.push(new Set());
      expectingKey = true;
    } else if (ch === "}") {
      stack.pop();
      expectingKey = false;
    } else if (ch === ",") {
      expectingKey = stack.length > 0;
    } else if (ch === ":") {
      const scope = stack[stack.length - 1];
      if (scope && expectingKey) {
        if (scope.has(lastString)) duplicates.add(lastString);
        scope.add(lastString);
      }
      expectingKey = false;
    }
  }
  return [...duplicates];
}
