/**
 * "What did I miss?" — the messages worth reading after time away.
 *
 * Each message is scored on signals that matter when you come back: whether
 * it names you, asks you something, records a decision, sets a deadline or
 * announces a change. The score and the reasons are shown, so you can see why
 * something rose to the top rather than trusting a black box — and anything
 * below the line is one click away, not hidden.
 */

import type { DocBlock } from "./export";
import { extractItems, type WorkItem } from "./items";
import type { Message } from "./messages";

export type Signal = "you" | "question" | "decision" | "deadline" | "change" | "urgent" | "everyone" | "long";

export const SIGNAL_LABELS: Record<Signal, string> = {
  you: "Mentions you",
  question: "Asks you something",
  decision: "A decision",
  deadline: "Has a deadline",
  change: "Something changed",
  urgent: "Marked urgent",
  everyone: "Sent to everyone",
  long: "Long, detailed message",
};

const WEIGHTS: Record<Signal, number> = { you: 5, question: 4, decision: 3, deadline: 3, change: 3, urgent: 2, everyone: 2, long: 1 };

const CHANGE = /\b(cancel(?:led|ed)?|postponed|moved|rescheduled|delayed|pushed back|brought forward|changed|updated|new (?:process|policy|date|deadline|owner|version)|launch(?:ed|ing)?|released|deprecated|outage|incident|down|restored|resolved|hired|leaving|left the|joined|promoted|reorg|budget|price (?:change|increase)|deadline)\b|中止|延期|変更|リリース|障害|復旧|異動|退職|入社/i;
const URGENT = /\b(urgent|asap|immediately|critical|important|action required|p0|p1)\b|至急|緊急|重要|要対応/i;
const EVERYONE = /@(?:channel|here|everyone|all)\b|\b(?:hi|hello|hey)\s+(?:all|everyone|team)\b|\ball[- ]hands\b|皆さん|各位|全員/i;

export interface Highlight {
  message: Message;
  score: number;
  signals: Signal[];
  items: WorkItem[];
}

export interface CatchUp {
  highlights: Highlight[];
  forYou: WorkItem[];
  decisions: WorkItem[];
  deadlines: WorkItem[];
  people: { name: string; count: number }[];
  considered: number;
  /** Messages outside the date range, or with no date when a range was set. */
  skipped: number;
  undated: number;
}

export interface CatchUpOptions {
  me: string;
  /** YYYY-MM-DD; only messages on or after it count. */
  since: string | null;
  now?: Date;
}

export function catchUp(messages: Message[], options: CatchUpOptions): CatchUp {
  const now = options.now ?? new Date();
  const me = options.me.trim();
  const first = me.split(/\s+/)[0];
  const meRe = first ? new RegExp(`@?\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i") : null;

  const undated = messages.filter((m) => !m.time).length;
  const inRange = options.since
    ? messages.filter((m) => m.time && m.time.slice(0, 10) >= options.since!)
    : messages;
  const fromOthers = inRange.filter((m) => !me || !m.speaker || m.speaker.toLowerCase() !== me.toLowerCase());

  const highlights: Highlight[] = fromOthers.map((message) => {
    const items = extractItems([message], { now, me });
    const signals: Signal[] = [];
    const mentioned = meRe?.test(message.text) ?? false;
    if (mentioned || items.some((i) => i.forMe)) signals.push("you");
    if (/[?？]/.test(message.text) && (mentioned || items.some((i) => i.kind === "question" && i.forMe))) signals.push("question");
    if (items.some((i) => i.kind === "decision")) signals.push("decision");
    if (items.some((i) => i.due)) signals.push("deadline");
    if (CHANGE.test(message.text)) signals.push("change");
    if (URGENT.test(message.text)) signals.push("urgent");
    if (EVERYONE.test(message.text)) signals.push("everyone");
    if (message.text.length > 400) signals.push("long");
    return { message, signals, items, score: signals.reduce((a, s) => a + WEIGHTS[s], 0) };
  });

  const all = highlights.flatMap((h) => h.items);
  const people = new Map<string, number>();
  for (const m of fromOthers) if (m.speaker) people.set(m.speaker, (people.get(m.speaker) ?? 0) + 1);

  return {
    highlights: highlights.filter((h) => h.score > 0).sort((a, b) => b.score - a.score || (b.message.time ?? "").localeCompare(a.message.time ?? "")),
    forYou: all.filter((i) => i.forMe && i.kind !== "decision"),
    decisions: all.filter((i) => i.kind === "decision"),
    deadlines: all.filter((i) => i.due && i.kind === "action").sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "")),
    people: [...people.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    considered: fromOthers.length,
    skipped: messages.length - inRange.length,
    undated,
  };
}

export function catchUpDoc(result: CatchUp, options: CatchUpOptions): DocBlock[] {
  const who = (m: Message) => `${m.speaker ?? "Someone"}${m.timeText ? ` (${m.timeText})` : ""}`;
  const blocks: DocBlock[] = [
    { type: "title", text: "What I missed" },
    { type: "subtitle", text: `${options.since ? `Since ${options.since}` : "Everything pasted"} · ${result.considered} messages read` },
  ];
  if (result.forYou.length) {
    blocks.push({ type: "heading", text: "Needs you", level: 2 }, { type: "bullets", items: result.forYou.map((i) => `${i.title}${i.due ? ` — due ${i.due}` : ""} (from ${i.speaker ?? "someone"})`) });
  }
  if (result.decisions.length) {
    blocks.push({ type: "heading", text: "Decisions made", level: 2 }, { type: "bullets", items: result.decisions.map((i) => `${i.title} (${i.speaker ?? "someone"})`) });
  }
  if (result.deadlines.length) {
    blocks.push({ type: "heading", text: "Deadlines", level: 2 }, { type: "table", rows: [["Due", "What", "Owner"], ...result.deadlines.map((i) => [i.due ?? "", i.title, i.owner ?? "—"])] });
  }
  blocks.push({ type: "heading", text: "Most important messages", level: 2 });
  for (const h of result.highlights.slice(0, 15)) {
    blocks.push({ type: "paragraph", text: who(h.message), bold: true });
    blocks.push({ type: "paragraph", text: h.message.text.slice(0, 600) });
    blocks.push({ type: "note", text: h.signals.map((s) => SIGNAL_LABELS[s]).join(" · ") });
  }
  return blocks;
}
