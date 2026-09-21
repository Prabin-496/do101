/**
 * Sales follow-ups, kept in a spreadsheet you own.
 *
 * There is no CRM here and no database: your leads live in an Excel file. Load
 * it, and each lead's last-contact date and stage decide when the next
 * follow-up is due; overdue ones rise to the top with a message drafted for
 * them. Save the file again and it carries everything forward — the next time
 * you open it here, you continue where you stopped.
 */

import { daysUntil, isoDate } from "./dates";
import type { Cell } from "./export";
import type { Message } from "./messages";

export type Stage = "new" | "contacted" | "meeting" | "proposal" | "negotiation" | "nurture" | "won" | "lost";

export const STAGES: { id: Stage; label: string; days: number | null; meaning: string }[] = [
  { id: "new", label: "New lead", days: 1, meaning: "Came in, not yet contacted. Speed matters most here." },
  { id: "contacted", label: "Contacted", days: 3, meaning: "First message sent, no reply yet." },
  { id: "meeting", label: "Meeting held", days: 2, meaning: "You have spoken; follow up while it is fresh." },
  { id: "proposal", label: "Proposal sent", days: 4, meaning: "They have a price or proposal in hand." },
  { id: "negotiation", label: "Negotiating", days: 3, meaning: "Terms are being discussed." },
  { id: "nurture", label: "Nurture", days: 30, meaning: "Not now, but maybe later. Stay in touch lightly." },
  { id: "won", label: "Won", days: null, meaning: "Closed. No sales follow-up." },
  { id: "lost", label: "Lost", days: null, meaning: "Closed. No sales follow-up." },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<Stage, (typeof STAGES)[number]>;

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  stage: Stage;
  /** YYYY-MM-DD. */
  lastContact: string | null;
  attempts: number;
  nextStep: string;
  notes: string;
  owner: string;
}

export type FollowUpState = "overdue" | "today" | "upcoming" | "closed" | "no-date";

export interface FollowUp {
  due: string | null;
  days: number | null;
  state: FollowUpState;
  /** After this many unanswered attempts, a break-up message is kinder than another nudge. */
  lastAttempt: boolean;
}

/** Follow-ups get further apart with each unanswered attempt. */
export function followUpFor(lead: Lead, now: Date = new Date()): FollowUp {
  const stage = STAGE_MAP[lead.stage];
  if (stage.days === null) return { due: null, days: null, state: "closed", lastAttempt: false };
  if (!lead.lastContact) {
    return lead.stage === "new"
      ? { due: isoDate(now), days: 0, state: "today", lastAttempt: false }
      : { due: null, days: null, state: "no-date", lastAttempt: false };
  }
  const spacing = stage.days * (lead.stage === "nurture" ? 1 : Math.min(3, 1 + Math.floor(lead.attempts / 2)));
  const [y, m, d] = lead.lastContact.split("-").map(Number);
  const due = isoDate(new Date(y, m - 1, d + spacing, 12));
  const days = daysUntil(due, now);
  return {
    due,
    days,
    state: days < 0 ? "overdue" : days === 0 ? "today" : "upcoming",
    lastAttempt: lead.attempts >= 5 && lead.stage !== "nurture",
  };
}

export interface Draft {
  subject: string;
  body: string;
}

export function followUpMessage(lead: Lead, sender: string, now: Date = new Date()): Draft {
  const first = lead.name.split(/\s+/)[0] || "there";
  const company = lead.company ? ` at ${lead.company}` : "";
  const next = lead.nextStep ? lead.nextStep.replace(/[.]$/, "") : "";
  const sign = `\n\nBest regards,\n${sender || "[Your name]"}`;
  const f = followUpFor(lead, now);

  if (f.lastAttempt) {
    return {
      subject: `Should I close your file?`,
      body: `Hi ${first},\n\nI've reached out a few times and haven't heard back, so I'll assume the timing isn't right and stop following up for now.\n\nIf things change${company ? ` for the team${company}` : ""}, just reply to this email and I'll pick it up straight away.${sign}`,
    };
  }

  switch (lead.stage) {
    case "new":
      return {
        subject: `Thanks for getting in touch${lead.company ? `, ${lead.company}` : ""}`,
        body: `Hi ${first},\n\nThanks for your interest. I'd love to understand what you're looking for${company ? `${company}` : ""} and whether we're a good fit.\n\nWould a 15-minute call this week work? Happy to fit around your schedule.${sign}`,
      };
    case "contacted":
      return {
        subject: lead.attempts > 1 ? `Quick follow-up` : `Following up`,
        body: `Hi ${first},\n\nJust following up on my ${lead.attempts > 1 ? "earlier messages" : "last message"}${next ? ` about ${next}` : ""}. I know inboxes get busy.\n\nIs this still something you're exploring? A one-line reply either way is really helpful.${sign}`,
      };
    case "meeting":
      return {
        subject: `Great speaking with you`,
        body: `Hi ${first},\n\nThanks again for your time. As discussed, ${next ? `the next step is ${next}` : "I'll put together what we talked about"}.\n\nLet me know if anything from our conversation needs clarifying in the meantime.${sign}`,
      };
    case "proposal":
      return {
        subject: `Any questions on the proposal?`,
        body: `Hi ${first},\n\nI wanted to check whether you've had a chance to look at the proposal, and whether any questions have come up.\n\n${next ? `If it helps, the next step would be ${next}. ` : ""}Happy to walk through it on a short call if that's easier.${sign}`,
      };
    case "negotiation":
      return {
        subject: `Next steps`,
        body: `Hi ${first},\n\nFollowing up on where we left things${next ? ` — ${next}` : ""}. Is there anything outstanding I can help resolve on our side?\n\nIf we're aligned, I can send over the final paperwork today.${sign}`,
      };
    case "nurture":
      return {
        subject: `Checking in`,
        body: `Hi ${first},\n\nIt's been a little while, so I wanted to check in and see how things are going${company}.\n\nNo agenda — if anything has changed and it would be useful to talk, I'm around.${sign}`,
      };
    default:
      return { subject: "", body: "" };
  }
}

const HEADERS: Record<keyof Omit<Lead, "id">, RegExp> = {
  name: /^(name|contact|lead|full name|氏名|名前|担当者名)$/i,
  company: /^(company|organisation|organization|account|business|会社|会社名|企業)$/i,
  email: /^(e-?mail|email address|メール)$/i,
  stage: /^(stage|status|pipeline|ステータス|段階)$/i,
  lastContact: /^(last contact(ed)?|last touch|last activity|contacted on|date|最終連絡日|最終接触)$/i,
  attempts: /^(attempts|follow-?ups|touches|回数)$/i,
  nextStep: /^(next step|next action|next|次のアクション)$/i,
  notes: /^(notes?|comments?|メモ|備考)$/i,
  owner: /^(owner|rep|salesperson|assigned to|担当)$/i,
};

function toStage(value: string): Stage {
  const v = value.toLowerCase();
  const match = STAGES.find((s) => s.id === v || s.label.toLowerCase() === v);
  if (match) return match.id;
  if (/won|closed won|成約/.test(v)) return "won";
  if (/lost|closed lost|失注/.test(v)) return "lost";
  if (/proposal|quote|提案|見積/.test(v)) return "proposal";
  if (/negotiat|交渉/.test(v)) return "negotiation";
  if (/meet|call|demo|面談|打ち合わせ/.test(v)) return "meeting";
  if (/nurture|later|cold/.test(v)) return "nurture";
  if (/contact|emailed|reached|連絡済/.test(v)) return "contacted";
  return "new";
}

function toDate(value: Cell): string | null {
  if (value === null || value === "") return null;
  const text = String(value).trim();
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (iso) return isoDate(new Date(+iso[1], +iso[2] - 1, +iso[3], 12));
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(text);
  if (us) {
    const a = +us[1];
    const b = +us[2];
    const [month, day] = a > 12 ? [b, a] : [a, b];
    const year = +us[3] < 100 ? 2000 + +us[3] : +us[3];
    return isoDate(new Date(year, month - 1, day, 12));
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : isoDate(new Date(parsed));
}

/** Reads a leads sheet, matching columns by their headings in English or Japanese. */
export function leadsFromRows(rows: Cell[][]): Lead[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => String(h ?? "").trim());
  const col = (key: keyof typeof HEADERS) => header.findIndex((h) => HEADERS[key].test(h));
  const idx = Object.fromEntries((Object.keys(HEADERS) as (keyof typeof HEADERS)[]).map((k) => [k, col(k)])) as Record<keyof typeof HEADERS, number>;
  const get = (row: Cell[], key: keyof typeof HEADERS) => (idx[key] >= 0 ? String(row[idx[key]] ?? "").trim() : "");

  return rows.slice(1)
    .filter((row) => row.some((c) => String(c ?? "").trim()))
    .map((row, i) => ({
      id: `l${i}`,
      name: get(row, "name") || get(row, "email") || `Lead ${i + 1}`,
      company: get(row, "company"),
      email: get(row, "email"),
      stage: toStage(get(row, "stage")),
      lastContact: idx.lastContact >= 0 ? toDate(row[idx.lastContact]) : null,
      attempts: Number(get(row, "attempts")) || 0,
      nextStep: get(row, "nextStep"),
      notes: get(row, "notes"),
      owner: get(row, "owner"),
    }));
}

export const LEAD_HEADER = ["Name", "Company", "Email", "Stage", "Last contact", "Attempts", "Next step", "Notes", "Owner", "Follow up by", "Status"];

export function leadsToRows(leads: Lead[], now: Date = new Date()): Cell[][] {
  return [
    LEAD_HEADER,
    ...leads.map((l) => {
      const f = followUpFor(l, now);
      return [
        l.name, l.company, l.email, STAGE_MAP[l.stage].label, l.lastContact ?? "", l.attempts, l.nextStep, l.notes, l.owner,
        f.due ?? "",
        f.state === "overdue" ? `Overdue ${-(f.days ?? 0)}d` : f.state === "today" ? "Due today" : f.state === "upcoming" ? `In ${f.days}d` : f.state === "closed" ? "Closed" : "Add a last-contact date",
      ];
    }),
  ];
}

/**
 * In a pasted email thread, whether the last word was yours and how long ago —
 * the "they never replied" check, without connecting to anyone's inbox.
 */
export function awaitingReply(messages: Message[], me: string, now: Date = new Date()): { waiting: boolean; days: number | null; last: Message | null } {
  const dated = messages.filter((m) => m.speaker);
  const last = dated.at(-1) ?? null;
  if (!last || !me) return { waiting: false, days: null, last };
  const mine = last.speaker!.toLowerCase().includes(me.toLowerCase().split(/\s+/)[0]);
  const days = last.time ? -daysUntil(last.time.slice(0, 10), now) : null;
  return { waiting: mine, days, last };
}
