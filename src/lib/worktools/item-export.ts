/**
 * Action items as files: a tracker spreadsheet, minutes in Word, deadlines in
 * a calendar, and a follow-up email to paste.
 */

import type { CalendarEvent, DocBlock, Sheet } from "./export";
import { groupByOwner, type WorkItem } from "./items";

const PRIORITY: Record<WorkItem["priority"], string> = { high: "High", medium: "Medium", low: "Low" };

export function itemsSheets(items: WorkItem[]): Sheet[] {
  const actions = items.filter((i) => i.kind === "action");
  const decisions = items.filter((i) => i.kind === "decision");
  const questions = items.filter((i) => i.kind === "question");
  const sheets: Sheet[] = [
    {
      name: "Action items",
      rows: [
        ["Task", "Owner", "Due", "Priority", "Status", "Said by", "Source"],
        ...actions.map((i) => [i.title, i.owner ?? "", i.due ?? "", PRIORITY[i.priority], i.done ? "Done" : "Open", i.speaker ?? "", i.source]),
      ],
      widths: [48, 18, 12, 10, 8, 16, 60],
    },
  ];
  if (decisions.length) sheets.push({ name: "Decisions", rows: [["Decision", "By", "Source"], ...decisions.map((i) => [i.title, i.speaker ?? "", i.source])], widths: [60, 18, 60] });
  if (questions.length) sheets.push({ name: "Open questions", rows: [["Question", "For", "Asked by"], ...questions.map((i) => [i.title, i.owner ?? "", i.speaker ?? ""])], widths: [60, 18, 18] });
  return sheets;
}

export function itemsCsvRows(items: WorkItem[]): (string | number)[][] {
  return [["Type", "Task", "Owner", "Due", "Priority", "Status"], ...items.map((i) => [i.kind, i.title, i.owner ?? "", i.due ?? "", PRIORITY[i.priority], i.done ? "Done" : "Open"])];
}

/** One calendar entry per dated, unfinished action — importable into any calendar. */
export function itemsEvents(items: WorkItem[]): CalendarEvent[] {
  return items
    .filter((i) => i.kind === "action" && i.due && !i.done)
    .map((i) => ({
      title: `${i.owner ? `[${i.owner}] ` : ""}${i.title}`,
      date: i.due!,
      start: i.dueTime,
      minutes: 30,
      description: i.source ? `From: "${i.source}"` : undefined,
    }));
}

export interface MinutesMeta {
  title: string;
  date: string;
  attendees: string[];
}

export function minutesDoc(items: WorkItem[], meta: MinutesMeta): DocBlock[] {
  const actions = items.filter((i) => i.kind === "action");
  const decisions = items.filter((i) => i.kind === "decision");
  const questions = items.filter((i) => i.kind === "question");
  const blocks: DocBlock[] = [
    { type: "title", text: meta.title || "Meeting notes" },
    { type: "subtitle", text: `${meta.date}${meta.attendees.length ? ` · ${meta.attendees.join(", ")}` : ""}` },
  ];
  blocks.push({ type: "heading", text: "Decisions", level: 2 });
  blocks.push(decisions.length ? { type: "bullets", items: decisions.map((d) => d.title) } : { type: "paragraph", text: "No decisions were recorded." });
  blocks.push({ type: "heading", text: "Action items", level: 2 });
  blocks.push(
    actions.length
      ? { type: "table", rows: [["Task", "Owner", "Due", "Priority"], ...actions.map((a) => [a.title, a.owner ?? "—", a.due ?? "—", PRIORITY[a.priority]])], widths: [4800, 1800, 1300, 1100] }
      : { type: "paragraph", text: "No action items were recorded." },
  );
  if (questions.length) {
    blocks.push({ type: "heading", text: "Open questions", level: 2 }, { type: "bullets", items: questions.map((q) => `${q.title}${q.owner ? ` (for ${q.owner})` : ""}`) });
  }
  return blocks;
}

/** The email everyone should get after a meeting, grouped by who owns what. */
export function followUpEmail(items: WorkItem[], meta: MinutesMeta): string {
  const actions = items.filter((i) => i.kind === "action" && !i.done);
  const decisions = items.filter((i) => i.kind === "decision");
  const questions = items.filter((i) => i.kind === "question");
  const lines = [`Subject: ${meta.title || "Meeting"} — notes and next steps (${meta.date})`, "", "Hi all,", "", "Thanks for your time today. Here's a summary of what we agreed and who's doing what.", ""];
  if (decisions.length) {
    lines.push("Decisions", ...decisions.map((d) => `• ${d.title}`), "");
  }
  if (actions.length) {
    lines.push("Action items");
    for (const [owner, list] of groupByOwner(actions)) {
      lines.push(`${owner}:`);
      lines.push(...list.map((a) => `  • ${a.title}${a.due ? ` — by ${a.due}` : ""}`));
    }
    lines.push("");
  }
  if (questions.length) {
    lines.push("Still open", ...questions.map((q) => `• ${q.title}${q.owner ? ` (${q.owner})` : ""}`), "");
  }
  lines.push("Let me know if I've missed or misattributed anything.", "", "Thanks,");
  return lines.join("\n");
}
