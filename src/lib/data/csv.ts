/**
 * RFC 4180-style CSV parsing and serialisation.
 * Hand-written so it stays dependency-free, testable and predictable about
 * quotes, embedded newlines and empty trailing fields.
 */

export interface CsvParseResult {
  rows: string[][];
  error?: string;
}

export function detectDelimiter(text: string): string {
  const sample = text.split("\n").slice(0, 5).join("\n");
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;

  for (const delimiter of candidates) {
    // Count only delimiters outside quotes.
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < sample.length; i++) {
      const char = sample[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (!inQuotes && char === delimiter) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }
  return best;
}

export function parseCsv(text: string, delimiter = ","): CsvParseResult {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === delimiter) {
      endField();
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      endRow();
      i++;
      continue;
    }
    field += char;
    i++;
  }

  if (inQuotes) {
    return { rows, error: "A quoted field was never closed — check for an unmatched \" character." };
  }
  if (field !== "" || row.length) endRow();

  // Drop a single trailing blank row produced by a final newline.
  if (rows.length && rows[rows.length - 1].every((c) => c === "")) rows.pop();

  return { rows };
}

export function serializeCsv(rows: Array<Array<string | number | boolean | null>>, delimiter = ","): string {
  const escape = (value: string | number | boolean | null): string => {
    const text = value === null || value === undefined ? "" : String(value);
    return /["\n\r]|^\s|\s$/.test(text) || text.includes(delimiter)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  };
  return rows.map((row) => row.map(escape).join(delimiter)).join("\n");
}

/** Best-effort typing so JSON output has numbers and booleans, not strings. */
export function coerce(value: string): string | number | boolean | null {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    // Very long digit strings are ids, not numbers — keep them exact.
    if (Number.isSafeInteger(n) || !Number.isInteger(n)) return n;
  }
  return value;
}

export interface CsvToJsonOptions {
  header?: boolean;
  delimiter?: string;
  typed?: boolean;
}

export function csvToJson(
  text: string,
  { header = true, delimiter, typed = true }: CsvToJsonOptions = {},
): { json: unknown; rows: number; columns: number; error?: string } {
  const sep = delimiter ?? detectDelimiter(text);
  const parsed = parseCsv(text, sep);
  if (parsed.error) return { json: null, rows: 0, columns: 0, error: parsed.error };
  if (!parsed.rows.length) return { json: [], rows: 0, columns: 0 };

  const convert = (v: string) => (typed ? coerce(v) : v);

  if (!header) {
    return {
      json: parsed.rows.map((row) => row.map(convert)),
      rows: parsed.rows.length,
      columns: parsed.rows[0]?.length ?? 0,
    };
  }

  const [headings, ...body] = parsed.rows;
  const keys = headings.map((h, i) => h.trim() || `column_${i + 1}`);
  return {
    json: body.map((row) =>
      Object.fromEntries(keys.map((key, i) => [key, convert(row[i] ?? "")])),
    ),
    rows: body.length,
    columns: keys.length,
  };
}

export function jsonToCsv(
  value: unknown,
  { delimiter = ",", header = true }: { delimiter?: string; header?: boolean } = {},
): { csv: string; error?: string } {
  if (!Array.isArray(value)) {
    return { csv: "", error: "CSV needs an array at the top level — a list of rows or objects." };
  }
  if (!value.length) return { csv: "" };

  // Array of arrays passes straight through.
  if (Array.isArray(value[0])) {
    return { csv: serializeCsv(value as Array<Array<string | number | boolean | null>>, delimiter) };
  }

  if (typeof value[0] !== "object" || value[0] === null) {
    return { csv: serializeCsv(value.map((v) => [v as string]), delimiter) };
  }

  // Union of every object's keys, so sparse records still line up.
  const keys: string[] = [];
  for (const item of value) {
    if (item && typeof item === "object") {
      for (const key of Object.keys(item as Record<string, unknown>)) {
        if (!keys.includes(key)) keys.push(key);
      }
    }
  }

  const rows: Array<Array<string | number | boolean | null>> = [];
  if (header) rows.push(keys);

  for (const item of value) {
    const record = (item ?? {}) as Record<string, unknown>;
    rows.push(
      keys.map((key) => {
        const cell = record[key];
        if (cell === null || cell === undefined) return "";
        if (typeof cell === "object") return JSON.stringify(cell);
        return cell as string | number | boolean;
      }),
    );
  }

  return { csv: serializeCsv(rows, delimiter) };
}
