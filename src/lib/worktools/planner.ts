/**
 * A day plan you could actually follow.
 *
 * Most planners let you schedule nine hours of work into a day with four free
 * hours in it. This one fits tasks around the meetings you already have, keeps
 * a share of the day unplanned for the interruptions that always come, takes
 * breaks, puts long focused work where you have asked for it — and then says
 * plainly what did not fit, instead of pretending it did.
 */

import { daysUntil, findDueDate } from "./dates";
import type { Priority } from "./items";

export interface PlanTask {
  id: string;
  title: string;
  minutes: number;
  /** True when no duration was written and the default was used. */
  assumedDuration: boolean;
  priority: Priority;
  due: string | null;
}

export interface FixedEvent {
  title: string;
  start: string;
  end: string;
}

export interface PlanSettings {
  dayStart: string;
  dayEnd: string;
  lunchStart: string;
  lunchMinutes: number;
  /** Continuous work before a short break. */
  breakEvery: number;
  breakMinutes: number;
  /** Share of free time left unplanned, for the unexpected. */
  bufferPercent: number;
  /** Long tasks go first, into the morning. */
  deepWorkFirst: boolean;
  /** Pieces smaller than this are not worth starting a task in. */
  minChunk: number;
  defaultMinutes: number;
}

export const DEFAULT_SETTINGS: PlanSettings = {
  dayStart: "09:00",
  dayEnd: "17:30",
  lunchStart: "12:30",
  lunchMinutes: 45,
  breakEvery: 90,
  breakMinutes: 10,
  bufferPercent: 20,
  deepWorkFirst: true,
  minChunk: 20,
  defaultMinutes: 30,
};

export type BlockKind = "task" | "event" | "break" | "lunch" | "free";

export interface Block {
  start: string;
  end: string;
  kind: BlockKind;
  title: string;
  taskId?: string;
  /** "Part 1 of 2" when a task is split around a meeting. */
  part?: { index: number; total: number };
  priority?: Priority;
}

export interface Plan {
  blocks: Block[];
  unscheduled: PlanTask[];
  /** Minutes free for tasks after meetings, lunch and the buffer. */
  capacity: number;
  planned: number;
  requested: number;
  overflow: number;
  warnings: string[];
}

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
export const toClock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;

/** "(2h)", "1.5h", "90m", "1h30", "45 min", "1時間", "30分". */
export function parseDuration(text: string): number | null {
  const hm = /(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(\d{1,2})\s*m?/i.exec(text);
  if (hm) return Math.round(Number(hm[1]) * 60 + Number(hm[2]));
  const h = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i.exec(text);
  if (h) return Math.round(Number(h[1]) * 60);
  const m = /(\d+)\s*(?:m|min|mins|minute|minutes)\b/i.exec(text);
  if (m) return Number(m[1]);
  const jaH = /(\d+(?:\.\d+)?)\s*時間(?:\s*(\d+)\s*分)?/.exec(text);
  if (jaH) return Math.round(Number(jaH[1]) * 60 + Number(jaH[2] ?? 0));
  const jaM = /(\d+)\s*分/.exec(text);
  if (jaM) return Number(jaM[1]);
  return null;
}

function parsePriority(text: string): Priority {
  if (/!!|!high\b|\(high\)|\bhigh\b|\burgent\b|\basap\b|\bp[01]\b|至急|急ぎ|重要/i.test(text)) return "high";
  if (/!low\b|\(low\)|\blow\b|\bp3\b|\bsomeday\b|\bif time\b|余裕があれば/i.test(text)) return "low";
  return "medium";
}

/** One task per line; bullets, checkboxes, durations and priorities are read and removed. */
export function parseTaskList(text: string, now: Date = new Date(), defaultMinutes = 30): PlanTask[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\[x\]/i.test(line.replace(/^[-*•]\s*/, "")))
    .map((line, i) => {
      const minutes = parseDuration(line);
      const due = findDueDate(line, now);
      const title = line
        .replace(/^(?:[-*•]|\d+[.)])\s*/, "")
        .replace(/^\[\s?\]\s*/, "")
        .replace(/[(~≈]?\s*\d+(?:\.\d+)?\s*h(?:ours?|rs?)?(?:\s*\d{1,2}\s*m(?:in)?)?\s*\)?/gi, "")
        .replace(/[(~≈]?\s*\d+\s*(?:m|min|mins|minutes?)\b\s*\)?/gi, "")
        .replace(/[(（]?\d+(?:\.\d+)?\s*時間(?:\d+分)?[)）]?|[(（]?\d+\s*分[)）]?/g, "")
        .replace(/!!|!high\b|!low\b|\((?:high|low|medium)\)|\bp[0-3]\b/gi, "")
        .replace(due ? new RegExp(`\\s*(?:by|due|before|until)?\\s*${due.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:までに|まで)?`, "i") : /$^/, "")
        .replace(/\s{2,}/g, " ")
        .replace(/[\s,;:–-]+$/, "")
        .trim();
      return {
        id: `t${i}`,
        title: title || line,
        minutes: minutes ?? defaultMinutes,
        assumedDuration: minutes === null,
        priority: parsePriority(line),
        due: due?.date ?? null,
      };
    });
}

/** "10:00-10:30 Standup", "14:00 – 15:00 Client call". */
export function parseEvents(text: string): FixedEvent[] {
  const out: FixedEvent[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = /(\d{1,2})[:.](\d{2})\s*[-–—~〜to]+\s*(\d{1,2})[:.](\d{2})\s*(.*)$/i.exec(raw.trim());
    if (!m) continue;
    const start = `${m[1].padStart(2, "0")}:${m[2]}`;
    const end = `${m[3].padStart(2, "0")}:${m[4]}`;
    if (toMinutes(end) <= toMinutes(start)) continue;
    out.push({ start, end, title: m[5].replace(/^[-:\s]+/, "").trim() || "Busy" });
  }
  return out.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

function rank(p: Priority): number {
  return p === "high" ? 0 : p === "medium" ? 1 : 2;
}

/** The order work is placed in: due today, then priority, then long work first if asked. */
export function orderTasks(tasks: PlanTask[], settings: PlanSettings, now: Date): PlanTask[] {
  return [...tasks].sort((a, b) => {
    const da = a.due ? Math.max(0, daysUntil(a.due, now)) : 99;
    const db = b.due ? Math.max(0, daysUntil(b.due, now)) : 99;
    if ((da === 0) !== (db === 0)) return da === 0 ? -1 : 1;
    if (rank(a.priority) !== rank(b.priority)) return rank(a.priority) - rank(b.priority);
    if (da !== db) return da - db;
    if (settings.deepWorkFirst && (a.minutes >= 60) !== (b.minutes >= 60)) return a.minutes >= 60 ? -1 : 1;
    return 0;
  });
}

export function buildPlan(tasks: PlanTask[], events: FixedEvent[], settings: PlanSettings = DEFAULT_SETTINGS, now: Date = new Date()): Plan {
  const dayStart = toMinutes(settings.dayStart);
  const dayEnd = toMinutes(settings.dayEnd);
  const warnings: string[] = [];

  // Everything that is not free time, merged and clipped to the working day.
  const busy: { start: number; end: number; block: Block }[] = events
    .map((e) => ({ start: Math.max(dayStart, toMinutes(e.start)), end: Math.min(dayEnd, toMinutes(e.end)), block: { start: e.start, end: e.end, kind: "event" as const, title: e.title } }))
    .filter((b) => b.end > b.start);
  if (settings.lunchMinutes > 0) {
    let lunch = toMinutes(settings.lunchStart);
    // Lunch slides past a meeting that overlaps it rather than being lost.
    for (const b of busy.sort((x, y) => x.start - y.start)) {
      if (lunch < b.end && lunch + settings.lunchMinutes > b.start) lunch = b.end;
    }
    if (lunch + settings.lunchMinutes <= dayEnd) {
      busy.push({ start: lunch, end: lunch + settings.lunchMinutes, block: { start: toClock(lunch), end: toClock(lunch + settings.lunchMinutes), kind: "lunch", title: "Lunch" } });
    }
  }
  busy.sort((a, b) => a.start - b.start);

  const free: { start: number; end: number }[] = [];
  let cursor = dayStart;
  for (const b of busy) {
    if (b.start > cursor) free.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd });

  const freeTotal = free.reduce((a, f) => a + (f.end - f.start), 0);
  const capacity = Math.floor(freeTotal * (1 - settings.bufferPercent / 100));
  const ordered = orderTasks(tasks, settings, now);
  const requested = tasks.reduce((a, t) => a + t.minutes, 0);

  const blocks: Block[] = busy.map((b) => b.block);
  const remaining = new Map(ordered.map((t) => [t.id, t.minutes]));
  const parts = new Map<string, Block[]>();
  let planned = 0;
  let sinceBreak = 0;

  for (const slot of free) {
    let at = slot.start;
    for (const task of ordered) {
      let left = remaining.get(task.id) ?? 0;
      while (left > 0 && at < slot.end && planned < capacity) {
        // A break once enough focused time has built up.
        if (sinceBreak >= settings.breakEvery && slot.end - at > settings.breakMinutes + settings.minChunk) {
          blocks.push({ start: toClock(at), end: toClock(at + settings.breakMinutes), kind: "break", title: "Break" });
          at += settings.breakMinutes;
          sinceBreak = 0;
        }
        // Work until the next break is due — but finish the task instead of
        // leaving a sliver of it stranded on the far side of the break.
        let untilBreak = settings.breakEvery - sinceBreak;
        if (untilBreak <= 0 || (left > untilBreak && left - untilBreak < settings.minChunk)) untilBreak = left;
        const room = Math.min(slot.end - at, capacity - planned, untilBreak);
        const chunk = Math.min(left, room);
        // Not worth starting a piece this small unless it finishes the task.
        if (chunk < Math.min(settings.minChunk, left)) break;
        const block: Block = { start: toClock(at), end: toClock(at + chunk), kind: "task", title: task.title, taskId: task.id, priority: task.priority };
        blocks.push(block);
        parts.set(task.id, [...(parts.get(task.id) ?? []), block]);
        at += chunk;
        left -= chunk;
        planned += chunk;
        sinceBreak += chunk;
        remaining.set(task.id, left);
      }
      if (at >= slot.end || planned >= capacity) break;
    }
    // A meeting or lunch is a pause from focused work.
    sinceBreak = 0;
    if (at < slot.end) blocks.push({ start: toClock(at), end: toClock(slot.end), kind: "free", title: "Unplanned — room for the unexpected" });
  }

  for (const list of parts.values()) {
    if (list.length > 1) list.forEach((b, i) => (b.part = { index: i + 1, total: list.length }));
  }

  const unscheduled = ordered.filter((t) => (remaining.get(t.id) ?? 0) > 0).map((t) => ({ ...t, minutes: remaining.get(t.id) ?? t.minutes }));
  const overflow = unscheduled.reduce((a, t) => a + t.minutes, 0);

  if (overflow > 0) {
    warnings.push(`${Math.floor(overflow / 60)}h ${overflow % 60}m of work does not fit today. That is not a failure of planning — it is information: move it, hand it on, or drop it deliberately.`);
  }
  const urgentLeft = unscheduled.filter((t) => t.priority === "high" || (t.due && daysUntil(t.due, now) <= 0));
  if (urgentLeft.length > 0) {
    warnings.push(`Still urgent and not scheduled: ${urgentLeft.map((t) => t.title).join(", ")}. Consider moving a meeting.`);
  }
  const assumed = tasks.filter((t) => t.assumedDuration).length;
  if (assumed > 0) {
    warnings.push(`${assumed} task${assumed === 1 ? " has" : "s have"} no time estimate, so ${settings.defaultMinutes} minutes was assumed. Add one like "(1h)" for a truer plan.`);
  }
  if (busy.filter((b) => b.block.kind === "event").reduce((a, b) => a + (b.end - b.start), 0) > (dayEnd - dayStart) / 2) {
    warnings.push("More than half the day is meetings. Expect little else to get done.");
  }

  blocks.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  return { blocks, unscheduled, capacity, planned, requested, overflow, warnings };
}
