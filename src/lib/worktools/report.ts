/**
 * A work log into a report someone else can read.
 *
 * The raw material is whatever notes you keep — "fixed login bug #web (2h)",
 * "waiting on legal for contract", "tomorrow: finish the deck". Each line is
 * sorted into done, in progress, blocked or next, grouped by project, and the
 * hours you wrote down are added up. Nothing is invented: a line the rules
 * cannot classify is kept as a plain note rather than guessed at.
 */

import { isoDate } from "./dates";
import { parseDuration } from "./planner";
import type { DocBlock, Sheet } from "./export";

export type EntryStatus = "done" | "progress" | "blocked" | "next" | "note";

export const STATUS_LABELS: Record<EntryStatus, string> = {
  done: "Done",
  progress: "In progress",
  blocked: "Blocked",
  next: "Next",
  note: "Note",
};

export interface LogEntry {
  id: string;
  date: string | null;
  project: string | null;
  text: string;
  status: EntryStatus;
  minutes: number | null;
  line: number;
}

const DONE = /^\s*(?:\[x\]|✅|✔|☑|done[:\s-]|completed?[:\s-]|finished[:\s-])|\b(?:done|completed|finished|shipped|released|launched|deployed|merged|fixed|resolved|sent|delivered|submitted|closed|published|approved|signed|wrapped up|handed over)\b|完了|済み|対応済|終了|提出しました|送付しました/i;
const BLOCKED = /\b(?:blocked|blocker|waiting (?:on|for)|stuck|on hold|pending (?:approval|review|from)|can't proceed|cannot proceed|depends on|issue with)\b|待ち|保留|ブロック|進められない/i;
const NEXT = /^\s*(?:\[\s?\]|next[:\s]|todo[:\s]|to do[:\s]|tomorrow[:\s]|plan(?:ned)?[:\s])|\b(?:will|going to|plan to|next week|tomorrow|to do|upcoming)\b|予定|明日|来週/i;
const PROGRESS = /\b(?:working on|in progress|wip|started|starting|continuing|ongoing|drafting|reviewing|investigating|halfway|partly|partially)\b|対応中|作業中|進行中|着手/i;

const DAY_HEADER = /^(?:#+\s*)?(?:(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s*)?(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?|\d{1,2}\s+[a-z]{3,9}|[a-z]{3,9}\s+\d{1,2})?\s*:?\s*$/i;
const WEEKDAY_HEADER = /^(?:#+\s*)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|月曜日?|火曜日?|水曜日?|木曜日?|金曜日?|土曜日?|日曜日?)\s*[:：]?\s*$/i;
const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
};
const MONTH_INDEX: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function headerDate(line: string, now: Date): string | null {
  const weekday = WEEKDAY_HEADER.exec(line.trim());
  if (weekday) {
    const key = weekday[1].toLowerCase();
    const target = WEEKDAY_INDEX[key] ?? WEEKDAY_INDEX[key[0]];
    // The most recent such day, this week or last — logs describe the past.
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    date.setDate(date.getDate() - ((date.getDay() - target + 7) % 7));
    return isoDate(date);
  }
  const m = DAY_HEADER.exec(line.trim());
  if (!m || !m[2]) return null;
  const token = m[2];
  let parts = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(token);
  if (parts) return isoDate(new Date(+parts[1], +parts[2] - 1, +parts[3], 12));
  parts = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/.exec(token);
  if (parts) {
    const a = +parts[1];
    const b = +parts[2];
    const [month, day] = a > 12 ? [b, a] : [a, b];
    const year = parts[3] ? (+parts[3] < 100 ? 2000 + +parts[3] : +parts[3]) : now.getFullYear();
    return isoDate(new Date(year, month - 1, day, 12));
  }
  parts = /^(\d{1,2})\s+([a-z]{3})[a-z]*$/i.exec(token) ?? null;
  if (parts && MONTH_INDEX[parts[2].toLowerCase()]) return isoDate(new Date(now.getFullYear(), MONTH_INDEX[parts[2].toLowerCase()] - 1, +parts[1], 12));
  parts = /^([a-z]{3})[a-z]*\s+(\d{1,2})$/i.exec(token);
  if (parts && MONTH_INDEX[parts[1].toLowerCase()]) return isoDate(new Date(now.getFullYear(), MONTH_INDEX[parts[1].toLowerCase()] - 1, +parts[2], 12));
  return null;
}

function classify(text: string): EntryStatus {
  if (/^\s*\[\s?\]/.test(text)) return "next";
  if (BLOCKED.test(text)) return "blocked";
  if (DONE.test(text)) return "done";
  if (PROGRESS.test(text)) return "progress";
  if (NEXT.test(text)) return "next";
  return "note";
}

function projectOf(text: string): { project: string | null; rest: string } {
  const tag = /(?:^|\s)#([\p{L}\p{N}_-]+)/u.exec(text);
  if (tag) return { project: tag[1], rest: text.replace(tag[0], " ").trim() };
  const bracket = /^\s*\[([^\]x ][^\]]{0,30})\]\s*/i.exec(text);
  if (bracket) return { project: bracket[1].trim(), rest: text.slice(bracket[0].length) };
  const prefix = /^\s*([\p{L}\p{N}][\p{L}\p{N} &._-]{1,28}?)\s*(?:[—–:]|\s-\s)\s+(.+)$/u.exec(text);
  if (prefix && !/^(done|todo|next|note|blocked|wip|tomorrow|plan)$/i.test(prefix[1])) return { project: prefix[1].trim(), rest: prefix[2] };
  return { project: null, rest: text };
}

function tidy(text: string): string {
  const t = text
    .replace(/^(?:[-*•]|\d+[.)])\s*/, "")
    .replace(/^\[(?:x| )\]\s*/i, "")
    .replace(/^(?:✅|✔|☑)\s*/, "")
    .replace(/^(?:done|todo|to do|next|tomorrow|plan(?:ned)?|wip|blocked)\s*[:\-–]\s*/i, "")
    .replace(/\s*[(（]?\s*\d+(?:\.\d+)?\s*(?:h|hr|hrs|hours?)(?:\s*\d{1,2}\s*m(?:in)?)?\s*[)）]?/gi, "")
    .replace(/\s*[(（]?\s*\d+\s*(?:m|min|mins|minutes)\s*[)）]?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

export function parseLog(text: string, now: Date = new Date()): LogEntry[] {
  const entries: LogEntry[] = [];
  let currentDate: string | null = null;
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const date = headerDate(line, now);
    if (date) {
      currentDate = date;
      return;
    }
    // "2026-09-21: did X" — a date on the same line as the work.
    let body = line;
    const inline = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*[:\-–]\s*(.+)$/.exec(line);
    let entryDate = currentDate;
    if (inline) {
      entryDate = headerDate(inline[1], now) ?? currentDate;
      body = inline[2];
    }
    const { project, rest } = projectOf(body);
    entries.push({
      id: `e${index}`,
      date: entryDate,
      project,
      text: tidy(rest),
      status: classify(rest),
      minutes: parseDuration(rest),
      line: index + 1,
    });
  });
  return entries.filter((e) => e.text.length > 1);
}

export interface ReportOptions {
  kind: "daily" | "weekly";
  name: string;
  team: string;
  /** YYYY-MM-DD the report is for (or the week containing it). */
  date: string;
}

export interface ReportSummary {
  counts: Record<EntryStatus, number>;
  minutes: number;
  byProject: { project: string; entries: LogEntry[]; minutes: number }[];
}

export function summarise(entries: LogEntry[]): ReportSummary {
  const counts: Record<EntryStatus, number> = { done: 0, progress: 0, blocked: 0, next: 0, note: 0 };
  const projects = new Map<string, LogEntry[]>();
  let minutes = 0;
  for (const e of entries) {
    counts[e.status] += 1;
    minutes += e.minutes ?? 0;
    const key = e.project ?? "General";
    projects.set(key, [...(projects.get(key) ?? []), e]);
  }
  return {
    counts,
    minutes,
    byProject: [...projects.entries()]
      .map(([project, list]) => ({ project, entries: list, minutes: list.reduce((a, e) => a + (e.minutes ?? 0), 0) }))
      .sort((a, b) => b.entries.length - a.entries.length),
  };
}

const hours = (minutes: number) => (minutes ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : "");

function line(e: LogEntry, withProject: boolean): string {
  return `${withProject && e.project ? `[${e.project}] ` : ""}${e.text}${e.minutes ? ` (${hours(e.minutes)})` : ""}`;
}

/** Plain text, ready to paste into Slack, Teams or an email. */
export function reportText(entries: LogEntry[], options: ReportOptions): string {
  const s = summarise(entries);
  const by = (status: EntryStatus) => entries.filter((e) => e.status === status);
  const out: string[] = [];
  if (options.kind === "daily") {
    out.push(`Daily update — ${options.name || "me"}${options.team ? `, ${options.team}` : ""} — ${options.date}`, "");
    const section = (title: string, list: LogEntry[], empty: string) => {
      out.push(title);
      out.push(...(list.length ? list.map((e) => `• ${line(e, true)}`) : [`• ${empty}`]), "");
    };
    section("✅ Done", by("done"), "Nothing finished today");
    section("🔄 In progress", by("progress"), "Nothing in progress");
    section("⏭ Next", by("next"), "Nothing planned yet");
    section("🚧 Blockers", by("blocked"), "None");
  } else {
    out.push(`Weekly report — ${options.name || "me"}${options.team ? `, ${options.team}` : ""} — week of ${options.date}`, "");
    out.push(`Summary: ${s.counts.done} done, ${s.counts.progress} in progress, ${s.counts.blocked} blocked${s.minutes ? `, ${hours(s.minutes)} logged` : ""}.`, "");
    out.push("Highlights");
    out.push(...(by("done").slice(0, 5).map((e) => `• ${line(e, true)}`)), "");
    out.push("By project");
    for (const p of s.byProject) {
      out.push(`${p.project}${p.minutes ? ` — ${hours(p.minutes)}` : ""}`);
      out.push(...p.entries.map((e) => `  • ${STATUS_LABELS[e.status]}: ${line(e, false)}`));
    }
    out.push("", "Blockers and risks");
    out.push(...(by("blocked").length ? by("blocked").map((e) => `• ${line(e, true)}`) : ["• None"]), "");
    out.push("Next week");
    out.push(...(by("next").length ? by("next").map((e) => `• ${line(e, true)}`) : ["• To be planned"]));
  }
  return out.join("\n").trim();
}

export function reportDoc(entries: LogEntry[], options: ReportOptions): DocBlock[] {
  const s = summarise(entries);
  const by = (status: EntryStatus) => entries.filter((e) => e.status === status).map((e) => line(e, true));
  const title = options.kind === "daily" ? "Daily update" : "Weekly report";
  const blocks: DocBlock[] = [
    { type: "title", text: title },
    { type: "subtitle", text: `${options.name || ""}${options.team ? ` · ${options.team}` : ""} · ${options.kind === "daily" ? options.date : `Week of ${options.date}`}` },
    {
      type: "table",
      rows: [
        ["Done", "In progress", "Blocked", "Next", "Time logged"],
        [String(s.counts.done), String(s.counts.progress), String(s.counts.blocked), String(s.counts.next), hours(s.minutes) || "—"],
      ],
    },
  ];
  const section = (heading: string, items: string[], empty: string) =>
    blocks.push({ type: "heading", text: heading, level: 2 }, { type: "bullets", items: items.length ? items : [empty] });
  section("Done", by("done"), "Nothing finished in this period.");
  section("In progress", by("progress"), "Nothing in progress.");
  section("Blockers and risks", by("blocked"), "None.");
  section(options.kind === "daily" ? "Next" : "Next week", by("next"), "To be planned.");
  if (options.kind === "weekly") {
    blocks.push({ type: "heading", text: "By project", level: 2 });
    blocks.push({
      type: "table",
      rows: [["Project", "Done", "In progress", "Blocked", "Time"], ...s.byProject.map((p) => [
        p.project,
        String(p.entries.filter((e) => e.status === "done").length),
        String(p.entries.filter((e) => e.status === "progress").length),
        String(p.entries.filter((e) => e.status === "blocked").length),
        hours(p.minutes) || "—",
      ])],
    });
  }
  const notes = by("note");
  if (notes.length) section("Other notes", notes, "");
  return blocks;
}

export function reportSheets(entries: LogEntry[]): Sheet[] {
  const s = summarise(entries);
  return [
    {
      name: "Log",
      rows: [["Date", "Project", "Status", "Entry", "Minutes"], ...entries.map((e) => [e.date ?? "", e.project ?? "", STATUS_LABELS[e.status], e.text, e.minutes ?? ""])],
    },
    {
      name: "By project",
      rows: [["Project", "Entries", "Done", "Blocked", "Minutes"], ...s.byProject.map((p) => [
        p.project, p.entries.length, p.entries.filter((e) => e.status === "done").length, p.entries.filter((e) => e.status === "blocked").length, p.minutes,
      ])],
    },
  ];
}
