/**
 * Getting results out as files.
 *
 * None of these tools keeps your data: there is no account and no database, so
 * the file you download *is* the record. Excel for anything tabular (and it can
 * be loaded back in to carry on where you left off), Word for anything meant
 * to be read or sent, and .ics for anything that belongs in a calendar — which
 * Google Calendar, Outlook and Apple Calendar all import.
 *
 * The Excel and Word libraries are loaded only when a download is asked for,
 * so they cost nothing on a page view.
 */

export type Cell = string | number | boolean | null;

export interface Sheet {
  name: string;
  rows: Cell[][];
  /** Column widths in characters. */
  widths?: number[];
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A filesystem-safe name with today's date, e.g. "meeting-actions-2026-09-21.xlsx". */
export function fileName(stem: string, extension: string, now: Date = new Date()): string {
  const safe = stem.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "export";
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${safe}-${date}.${extension}`;
}

export async function toXlsx(sheets: Sheet[]): Promise<Blob> {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const used = new Set<string>();
  sheets.forEach((sheet, i) => {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    const widths = sheet.widths ?? guessWidths(sheet.rows);
    ws["!cols"] = widths.map((wch) => ({ wch }));
    if (sheet.rows.length > 1 && sheet.rows[0]?.length) {
      ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sheet.rows.length - 1, c: sheet.rows[0].length - 1 } }) };
    }
    // Sheet names are capped at 31 characters and must be unique.
    let name = (sheet.name || `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
    while (used.has(name)) name = `${name.slice(0, 28)} ${i + 1}`;
    used.add(name);
    XLSX.utils.book_append_sheet(book, ws, name);
  });
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function guessWidths(rows: Cell[][]): number[] {
  const widths: number[] = [];
  for (const row of rows.slice(0, 200)) {
    row.forEach((cell, c) => {
      const length = String(cell ?? "").length;
      widths[c] = Math.min(60, Math.max(widths[c] ?? 8, length + 2));
    });
  }
  return widths;
}

/** Reads the first sheet of a workbook back as rows, for tools that round-trip. */
export async function readSheetRows(file: File): Promise<Cell[][]> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const first = book.Sheets[book.SheetNames[0]];
  if (!first) return [];
  return XLSX.utils.sheet_to_json(first, { header: 1, raw: false, defval: "", blankrows: false }) as Cell[][];
}

export function toCsv(rows: Cell[][]): Blob {
  const escape = (cell: Cell) => {
    const text = String(cell ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // The byte-order mark makes Excel open UTF-8 (Japanese, accents) correctly.
  return new Blob(["\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
}

/* ---------------------------------- Word ---------------------------------- */

export type DocBlock =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "paragraph"; text: string; bold?: boolean; italic?: boolean }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "table"; rows: string[][]; widths?: number[] }
  | { type: "note"; text: string };

export async function toDocx(blocks: DocBlock[], meta: { title: string; creator?: string }): Promise<Blob> {
  const d = await import("docx");
  const children: Array<InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>> = [];
  let numbered = 0;

  for (const block of blocks) {
    switch (block.type) {
      case "title":
        children.push(new d.Paragraph({ heading: d.HeadingLevel.TITLE, spacing: { after: 120 }, children: [new d.TextRun(block.text)] }));
        break;
      case "subtitle":
        children.push(new d.Paragraph({ spacing: { after: 240 }, children: [new d.TextRun({ text: block.text, color: "64757F" })] }));
        break;
      case "heading": {
        const level = block.level === 3 ? d.HeadingLevel.HEADING_3 : block.level === 2 ? d.HeadingLevel.HEADING_2 : d.HeadingLevel.HEADING_1;
        children.push(new d.Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new d.TextRun(block.text)] }));
        break;
      }
      case "paragraph":
        children.push(new d.Paragraph({ spacing: { after: 120 }, children: [new d.TextRun({ text: block.text, bold: block.bold, italics: block.italic })] }));
        break;
      case "note":
        children.push(new d.Paragraph({ spacing: { after: 120 }, children: [new d.TextRun({ text: block.text, italics: true, color: "64757F", size: 18 })] }));
        break;
      case "bullets":
        for (const item of block.items) {
          children.push(new d.Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new d.TextRun(item)] }));
        }
        break;
      case "numbered":
        numbered += 1;
        for (const item of block.items) {
          children.push(new d.Paragraph({ numbering: { reference: "steps", level: 0, instance: numbered }, spacing: { after: 80 }, children: [new d.TextRun(item)] }));
        }
        break;
      case "table": {
        if (block.rows.length === 0) break;
        const columns = block.rows[0].length;
        const widths = block.widths ?? new Array(columns).fill(Math.floor(9000 / columns));
        children.push(
          new d.Table({
            width: { size: 100, type: d.WidthType.PERCENTAGE },
            rows: block.rows.map((row, r) =>
              new d.TableRow({
                tableHeader: r === 0,
                children: row.map((cell, c) =>
                  new d.TableCell({
                    width: { size: widths[c] ?? 1000, type: d.WidthType.DXA },
                    shading: r === 0 ? { fill: "EEF2F4", type: d.ShadingType.CLEAR, color: "auto" } : undefined,
                    children: String(cell ?? "").split("\n").map((line) => new d.Paragraph({ children: [new d.TextRun({ text: line, bold: r === 0, size: 20 })] })),
                  }),
                ),
              }),
            ),
          }),
        );
        children.push(new d.Paragraph({ children: [] }));
        break;
      }
    }
  }

  const doc = new d.Document({
    creator: meta.creator ?? "DO101",
    title: meta.title,
    numbering: {
      config: [{
        reference: "steps",
        levels: [{ level: 0, format: d.LevelFormat.DECIMAL, text: "%1.", alignment: d.AlignmentType.START, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }],
      }],
    },
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children }],
  });
  return d.Packer.toBlob(doc);
}

/* ------------------------------- Calendar --------------------------------- */

export interface CalendarEvent {
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM; omit for an all-day entry. */
  start?: string | null;
  minutes?: number;
  description?: string;
  uid?: string;
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 lines are folded at 75 octets. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const width = new TextEncoder().encode(char).length;
    if (size + width > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += width;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function stamp(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const when = new Date(y, m - 1, d, hh, mm + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`, time: `${pad(when.getHours())}:${pad(when.getMinutes())}` };
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const when = new Date(y, m - 1, d + 1, 12);
  return `${when.getFullYear()}${String(when.getMonth() + 1).padStart(2, "0")}${String(when.getDate()).padStart(2, "0")}`;
}

/** Times are written as local ("floating") time, so they land where they were planned. */
export function toIcsText(events: CalendarEvent[], now: Date = new Date()): string {
  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DO101//Work tools//EN", "CALSCALE:GREGORIAN"];
  events.forEach((event, i) => {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid ?? `${event.date}-${i}-${Math.abs(hash(event.title))}`}@do101`);
    lines.push(`DTSTAMP:${dtstamp}`);
    if (event.start) {
      const end = addMinutes(event.date, event.start, event.minutes ?? 30);
      lines.push(`DTSTART:${stamp(event.date, event.start)}`);
      lines.push(`DTEND:${stamp(end.date, end.time)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay(event.date)}`);
    }
    lines.push(`SUMMARY:${escapeIcs(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function toIcs(events: CalendarEvent[]): Blob {
  return new Blob([toIcsText(events)], { type: "text/calendar;charset=utf-8" });
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return h;
}

/* ----------------------------- Reading .ics ------------------------------- */

export interface ImportedEvent {
  title: string;
  date: string;
  start: string | null;
  end: string | null;
}

/**
 * Events from an exported calendar file, so a plan can be built around real
 * meetings without connecting to anyone's calendar account.
 */
export function parseIcs(text: string): ImportedEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const events: ImportedEvent[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const field = (name: string) => new RegExp(`^${name}(?:;[^:\\r\\n]*)?:(.*)$`, "m").exec(body)?.[1]?.trim() ?? null;
    const start = field("DTSTART");
    if (!start) continue;
    const end = field("DTEND");
    const parse = (value: string | null) => {
      if (!value) return { date: null as string | null, time: null as string | null };
      const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(value);
      if (!m) return { date: null, time: null };
      if (m[4] && m[7]) {
        // UTC: shown in the visitor's own time zone.
        const when = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
        const pad = (n: number) => String(n).padStart(2, "0");
        return { date: `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`, time: `${pad(when.getHours())}:${pad(when.getMinutes())}` };
      }
      return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : null };
    };
    const s = parse(start);
    const e = parse(end);
    if (!s.date) continue;
    events.push({
      title: (field("SUMMARY") ?? "Busy").replace(/\\,/g, ",").replace(/\;/g, ";").replace(/\\n/g, " "),
      date: s.date,
      start: s.time,
      end: e.time,
    });
  }
  return events;
}
