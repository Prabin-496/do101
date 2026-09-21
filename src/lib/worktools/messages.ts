/**
 * Pasted conversations, split into who said what and when.
 *
 * Nobody pastes a clean format. Meeting transcripts come out of Zoom, Teams
 * and Meet in their own shapes, Slack copies speaker and time onto a line of
 * their own, emails arrive with headers and quoted replies, and minutes are
 * often just "Sarah: I'll send the deck". This recognises the common shapes
 * and falls back to plain lines, so something sensible always comes out.
 */

export interface Message {
  speaker: string | null;
  /** ISO date-time when the source carried one, otherwise null. */
  time: string | null;
  /** The raw timestamp text as it appeared, for display. */
  timeText: string | null;
  text: string;
  /** 1-based line the message starts on, so results can point back to it. */
  line: number;
  subject?: string | null;
}

/** Words that look like "Name:" but are labels, not people. */
const NOT_NAMES = new Set([
  "note", "notes", "todo", "to do", "action", "actions", "action item", "action items", "ai",
  "decision", "decisions", "agenda", "subject", "re", "fw", "fwd", "summary", "attendees",
  "date", "time", "from", "to", "cc", "bcc", "sent", "location", "update", "question",
  "questions", "q", "a", "answer", "next steps", "next step", "owner", "due", "deadline",
  "status", "blocker", "blockers", "risk", "risks", "http", "https", "tip", "ps", "p.s",
  "important", "warning", "reminder", "fyi", "done", "wip", "project", "task", "tasks",
]);

const NAME = "([A-Z\\u00C0-\\u024F\\u3040-\\u30FF\\u4E00-\\u9FFF][\\w\\u00C0-\\u024F\\u3040-\\u30FF\\u4E00-\\u9FFF.'’-]*(?:\\s+[A-Z\\u00C0-\\u024F\\u3040-\\u30FF\\u4E00-\\u9FFF][\\w\\u00C0-\\u024F\\u3040-\\u30FF\\u4E00-\\u9FFF.'’-]*){0,3})";

// [2026-09-15 10:02] Name: text   /   2026-09-15 10:02 - Name: text
const STAMPED = new RegExp(
  `^\\[?(\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}(?:[ T,]+\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:[AaPp][Mm])?)?)\\]?\\s*[-–—]?\\s*${NAME}\\s*[:：]\\s*(.+)$`,
);
// [10:02] Name: text   /   10:02 Name: text
const CLOCKED = new RegExp(`^\\[?(\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:[AaPp][Mm])?)\\]?\\s*[-–—]?\\s*${NAME}\\s*[:：]\\s*(.+)$`);
// Name: text   /   Name (10:02): text
const SPOKEN = new RegExp(`^${NAME}\\s*(?:\\((\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:[AaPp][Mm])?)\\))?\\s*[:：]\\s*(.+)$`);
// Slack / Zoom: a line with only a name and a time, the message on the lines after.
const HEADER_LINE = new RegExp(`^${NAME}\\s{1,}\\[?(\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:[AaPp][Mm])?)\\]?\\s*$`);
// WebVTT voice tags: <v Name>text
const VTT_VOICE = /^<v\s+([^>]+)>(.*?)(?:<\/v>)?$/;
const VTT_CUE = /^\d{2}:\d{2}(?::\d{2})?[.,]\d{3}\s*-->/;

function looksLikeName(candidate: string): boolean {
  const cleaned = candidate.trim().toLowerCase().replace(/[.:]+$/, "");
  if (NOT_NAMES.has(cleaned)) return false;
  if (candidate.length > 40) return false;
  if (/^\d/.test(candidate)) return false;
  return true;
}

function toIso(stamp: string): string | null {
  const m = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/.exec(stamp);
  if (!m) return null;
  let hour = m[4] ? Number(m[4]) : 0;
  if (m[7]) hour = (hour % 12) + (m[7].toLowerCase() === "pm" ? 12 : 0);
  const pad = (n: number | string) => String(n).padStart(2, "0");
  return `${m[1]}-${pad(m[2])}-${pad(m[3])}T${pad(hour)}:${pad(m[5] ?? 0)}:${pad(m[6] ?? 0)}`;
}

/** Email header blocks: From / Date / Subject, then a blank line, then the body. */
function parseEmails(lines: string[]): Message[] | null {
  const starts = lines
    .map((line, i) => (/^from\s*:/i.test(line.trim()) ? i : -1))
    .filter((i) => i >= 0);
  if (starts.length === 0) return null;

  const messages: Message[] = [];
  starts.forEach((start, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    let speaker: string | null = null;
    let timeText: string | null = null;
    let subject: string | null = null;
    let i = start;
    for (; i < end; i++) {
      const line = lines[i].trim();
      if (!line) break;
      const header = /^(from|date|sent|subject|to|cc)\s*:\s*(.*)$/i.exec(line);
      if (!header) break;
      const key = header[1].toLowerCase();
      if (key === "from") speaker = header[2].replace(/<[^>]*>/g, "").replace(/["']/g, "").trim() || null;
      if (key === "date" || key === "sent") timeText = header[2].trim();
      if (key === "subject") subject = header[2].trim();
    }
    // Quoted history ("On … wrote:", "> …") belongs to earlier messages.
    const body: string[] = [];
    for (let j = i; j < end; j++) {
      const line = lines[j];
      if (/^on .+wrote:\s*$/i.test(line.trim()) || /^-{2,}\s*original message/i.test(line.trim())) break;
      if (line.trim().startsWith(">")) continue;
      body.push(line);
    }
    const parsed = timeText ? Date.parse(timeText) : NaN;
    messages.push({
      speaker,
      timeText,
      time: Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 19),
      text: body.join("\n").trim(),
      line: start + 1,
      subject,
    });
  });
  return messages.filter((m) => m.text);
}

export function parseMessages(input: string): Message[] {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const emails = parseEmails(lines);
  if (emails && emails.length > 0) return emails;

  const messages: Message[] = [];
  let pending: { speaker: string; timeText: string | null; line: number } | null = null;
  let vttSpeakerless = false;

  const push = (message: Message) => {
    const last = messages.at(-1);
    // Consecutive lines from one speaker with no new timestamp are one message.
    if (last && message.speaker && last.speaker === message.speaker && !message.timeText && last.line === message.line - 1) {
      last.text += `\n${message.text}`;
      return;
    }
    messages.push(message);
  };

  lines.forEach((raw, index) => {
    const line = raw.trim();
    const lineNo = index + 1;
    if (!line || line === "WEBVTT" || /^\d+$/.test(line) || VTT_CUE.test(line)) {
      if (!line) pending = null;
      vttSpeakerless = VTT_CUE.test(line) || vttSpeakerless;
      return;
    }

    let m = VTT_VOICE.exec(line);
    if (m) {
      push({ speaker: m[1].trim(), time: null, timeText: null, text: m[2].trim(), line: lineNo });
      return;
    }
    m = STAMPED.exec(line);
    if (m && looksLikeName(m[2])) {
      pending = null;
      push({ speaker: m[2].trim(), time: toIso(m[1]), timeText: m[1], text: m[3].trim(), line: lineNo });
      return;
    }
    m = CLOCKED.exec(line);
    if (m && looksLikeName(m[2])) {
      pending = null;
      push({ speaker: m[2].trim(), time: null, timeText: m[1], text: m[3].trim(), line: lineNo });
      return;
    }
    m = HEADER_LINE.exec(line);
    if (m && looksLikeName(m[1])) {
      pending = { speaker: m[1].trim(), timeText: m[2], line: lineNo };
      return;
    }
    m = SPOKEN.exec(line);
    if (m && looksLikeName(m[1]) && !/https?$/i.test(m[1])) {
      pending = null;
      push({ speaker: m[1].trim(), time: null, timeText: m[2] ?? null, text: m[3].trim(), line: lineNo });
      return;
    }
    if (pending) {
      const last = messages.at(-1);
      if (last && last.speaker === pending.speaker && last.line >= pending.line) {
        last.text += `\n${line}`;
      } else {
        messages.push({ speaker: pending.speaker, time: null, timeText: pending.timeText, text: line, line: lineNo });
      }
      return;
    }
    messages.push({ speaker: null, time: null, timeText: null, text: line, line: lineNo });
  });

  void vttSpeakerless;
  return messages.filter((m) => m.text.trim());
}

/**
 * Sentences, in either language. Abbreviations and version numbers are kept
 * whole, and a bulleted line is always its own sentence.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const protectedLine = line.replace(/\b(e\.g|i\.e|etc|vs|mr|mrs|ms|dr|approx|no)\./gi, (s) => s.replace(".", "∯"));
    const parts = protectedLine
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\[@#\-*•]|[^\x00-\x7F])|(?<=[。！？!?])/)
      .map((s) => s.replace(/∯/g, ".").trim())
      .filter(Boolean);
    out.push(...parts);
  }
  return out;
}

/** People named in a conversation: speakers and @mentions. */
export function knownPeople(messages: Message[]): string[] {
  const names = new Set<string>();
  for (const m of messages) {
    if (m.speaker) names.add(m.speaker);
    for (const mention of m.text.matchAll(/@([A-Za-zÀ-ɏ][\w.\-]*)/g)) names.add(mention[1]);
  }
  return [...names];
}
