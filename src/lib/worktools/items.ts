/**
 * Finding the work inside a conversation.
 *
 * Rules, not a language model — so they are fast, private, free to run and
 * completely predictable, and every item carries the rule that picked it out.
 * The trade is that phrasing a rule does not know is missed, which is why the
 * tools built on this show every result in an editable table before anything
 * is exported. Getting 80% found and 100% checkable beats a confident guess.
 *
 * An item is picked out when a sentence:
 *  - is marked as one ("Action:", "TODO", "- [ ]", "Decision:", "決定：")
 *  - commits someone to something ("I'll send…", "we need to update…", "〜します")
 *  - asks someone to do something ("can you check…", "please book…", "〜お願いします")
 *  - is written as an instruction ("Send the deck to Priya by Friday")
 *  - records a decision ("we agreed to…", "let's go with…", "〜に決まりました")
 *  - asks a question of someone in particular.
 */

import { daysUntil, findDueDate } from "./dates";
import { knownPeople, splitSentences, type Message } from "./messages";

export type ItemKind = "action" | "decision" | "question";
export type Priority = "high" | "medium" | "low";

export interface WorkItem {
  id: string;
  kind: ItemKind;
  title: string;
  owner: string | null;
  due: string | null;
  dueTime: string | null;
  dueText: string | null;
  priority: Priority;
  /** The rule that picked this out, in words. */
  reason: string;
  /** The sentence it came from, untouched. */
  source: string;
  speaker: string | null;
  line: number;
  time: string | null;
  /** True when it is addressed to, or owned by, the person using the tool. */
  forMe: boolean;
  done: boolean;
}

export interface ExtractOptions {
  now?: Date;
  /** The reader's own name, so "can you…" aimed at them is flagged. */
  me?: string | null;
  /**
   * Record every question, not only ones put to someone. Right for meeting
   * minutes, where "do we still need the translation?" is an open item; wrong
   * for a chat channel, where it would sweep in every "how was your weekend?".
   */
  allQuestions?: boolean;
}

/** Verbs that describe a piece of work. The list is the rules' vocabulary. */
const VERBS = [
  "add", "analyse", "analyze", "approve", "arrange", "ask", "assign", "attach", "audit", "book",
  "brief", "build", "calculate", "call", "cancel", "change", "chase", "check", "circulate", "clarify",
  "clean", "close", "collect", "compile", "complete", "confirm", "connect", "contact", "coordinate",
  "correct", "cover", "create", "debug", "decide", "define", "delete", "deliver", "deploy", "design",
  "discuss", "distribute", "document", "double-check", "download", "draft", "edit", "email", "escalate",
  "estimate", "evaluate", "export", "file", "finalise", "finalize", "find", "finish", "fix", "follow",
  "forward", "gather", "get", "give", "handle", "help", "hire", "implement", "import", "include",
  "inform", "install", "interview", "introduce", "investigate", "invite", "issue", "launch", "lead",
  "look", "loop", "make", "manage", "measure", "meet", "merge", "message", "migrate", "monitor", "move",
  "negotiate", "notify", "onboard", "order", "organise", "organize", "own", "pay", "ping", "plan",
  "post", "prepare", "present", "print", "prioritise", "prioritize", "process", "provide", "publish",
  "push", "put", "quote", "reach", "read", "rebook", "reconcile", "record", "refactor", "register",
  "release", "remind", "remove", "renew", "reply", "report", "request", "research", "reschedule",
  "resolve", "respond", "restart", "return", "review", "revise", "rewrite", "run", "schedule",
  "send", "set", "settle", "share", "ship", "sign", "sort", "start", "submit", "summarise",
  "summarize", "sync", "take", "talk", "tell", "test", "track", "train", "transfer", "translate",
  "update", "upload", "validate", "verify", "visit", "write",
];
const VERB = `(?:${VERBS.join("|")})`;
const ADVERB = "(?:(?:also|just|quickly|then|probably|definitely|try to|go ahead and|still|first|now)\\s+)?";

const MARKED_ACTION = /^(?:[-*•]\s*)?(?:action(?:\s+items?)?|todo|to[- ]do|ai|next steps?|follow[- ]?up|task|タスク|宿題|対応)\s*[:：\-–]\s*(.+)$/i;
const MARKED_DECISION = /^(?:[-*•]\s*)?(?:decision|decided|agreed|resolution|決定(?:事項)?)\s*[:：\-–]\s*(.+)$/i;
const MARKED_QUESTION = /^(?:[-*•]\s*)?(?:open question|question|q|質問|確認事項)\s*[:：\-–]\s*(.+)$/i;
const CHECKBOX = /^(?:[-*•]\s*)?\[( |x|X)\]\s*(.+)$/;

const DECISION = new RegExp(
  [
    "\\bwe(?:'ve| have)?\\s+(?:decided|agreed|chosen)\\b",
    "\\b(?:it was|it's|it has been)\\s+(?:decided|agreed)\\b",
    "\\bagreed\\s+(?:to|that|on)\\b",
    "\\bdecision\\s+(?:is|was)\\b",
    "\\blet'?s\\s+go\\s+with\\b",
    "\\bwe(?:'ll| will)\\s+go\\s+with\\b",
    "\\b(?:approved|signed off)\\b",
    "決定しました|決まりました|ことになりました|合意しました|承認されました|で進めます",
  ].join("|"),
  "i",
);

const COMMITMENT = new RegExp(
  `\\b(i|we)(?:'ll|'m going to|'re going to| will| shall| am going to| are going to| can| need to| have to| must| plan to| should| am| are)\\s+${ADVERB}(${VERB})\\b|\\blet me\\s+${ADVERB}(${VERB})\\b|\\b(?:i'm on it|leave it with me|will do|i'll take (?:it|that|care of it))\\b`,
  "i",
);
const REQUEST = new RegExp(
  `\\b(?:can|could|would|will)\\s+you\\s+(?:please\\s+|kindly\\s+)?${ADVERB}(${VERB})\\b|\\bplease\\s+${ADVERB}(${VERB})\\b|\\b(?:need|want|would like|'d like)\\s+(?:you|someone|somebody|[A-Z][a-z]+)\\s+to\\s+${ADVERB}(${VERB})\\b|\\bmake sure\\s+(?:to|that|you)\\b|\\bdon't forget to\\s+(${VERB})\\b`,
  "i",
);
const IMPERATIVE = new RegExp(`^(?:(?:also|and|then|pls|plz|kindly|ok|okay|so)[,]?\\s+)?(${VERB})\\b\\s+\\S`, "i");
const NAME_TO = /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(?:to|will|'ll|should|needs to|is going to)\s+(\w+)/;
const JA_COMMIT = /(いたします|致します|します|しておきます|させていただきます|させて頂きます|やります|対応します|送ります|確認します|準備します)[。.!！]?$/;
const JA_REQUEST = /(ください|下さい|お願いします|お願いいたします|お願い致します|いただけますか|いただけませんか|いただけますでしょうか|もらえますか|もらえませんか|しておいて|おいてください)[。.!！?？]?$/;
const JA_QUESTION = /(ですか|ますか|でしょうか|ませんか|か)[。.]?[?？]?$|？$/;
const HAS_JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;

const NOT_OWNERS = new Set([
  "we", "i", "it", "this", "that", "they", "someone", "somebody", "everyone", "anyone", "team",
  "next", "then", "also", "please", "the", "let's", "lets", "who", "what", "when", "why", "how",
  "can", "could", "would", "will", "should", "and", "but", "so", "ok", "okay", "yes", "no",
]);

const URGENT = /\b(urgent(?:ly)?|asap|as soon as possible|immediately|critical|blocker|blocking|top priority|high priority|p0|p1|right away|straight away)\b|至急|急ぎ|緊急|大至急|本日中|今すぐ/i;
const IMPORTANT = /\b(important|priority|soon|key|must)\b|重要|優先/i;

function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function stripDue(text: string, dueText: string | null): string {
  if (!dueText) return text;
  const escaped = dueText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`\\s*(?:by|on|before|until|till|due|no later than|for)?\\s*${escaped}\\s*(?:までに|まで|中に)?`, "i"), " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Turns "Sarah, can you please send the deck by Friday?" into "Send the deck". */
export function cleanTitle(sentence: string, dueText: string | null): string {
  let t = sentence.trim();
  t = t.replace(CHECKBOX, "$2").replace(MARKED_ACTION, "$1").replace(MARKED_DECISION, "$1").replace(MARKED_QUESTION, "$1");
  t = t.replace(/^[-*•]\s*/, "");
  t = t.replace(/^@[\w.\-]+[,:]?\s*/, "");
  t = t.replace(/^[A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s+/, "");
  t = t.replace(/^(?:so|ok|okay|also|and|then|um|uh|right|great|cool|sure|pls|plz)[,.]?\s+/i, "");
  t = t.replace(/^(?:i think|i guess|maybe|perhaps)\s+/i, "");
  t = t.replace(/^(?:i|we)(?:'ll|'m going to|'re going to| will| shall| am going to| are going to| can| need to| have to| must| plan to| should)\s+(?:also\s+|just\s+|then\s+|probably\s+|definitely\s+|try to\s+|go ahead and\s+)?/i, "");
  t = t.replace(/^let me\s+/i, "");
  t = t.replace(/^(?:can|could|would|will)\s+you\s+(?:please\s+|kindly\s+)?/i, "");
  t = t.replace(/^(?:please|kindly)\s+/i, "");
  t = t.replace(/^(?:i|we)\s+(?:need|want|would like|'d like)\s+(?:you|someone|somebody)\s+to\s+/i, "");
  t = t.replace(/^(?:don't forget to|make sure to|make sure you)\s+/i, "");
  t = t.replace(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(?:to|will|'ll|should|needs to|is going to)\s+/, "");
  t = stripDue(t, dueText);
  t = t.replace(/\s*(?:please|thanks|thank you|pls)[.!]*$/i, "");
  t = t.replace(/\s*[—–,;-]+\s*(?:it'?s|this is|that's|very)?\s*(?:urgent|asap|important|critical|a priority)\s*[.!]*$/i, "");
  t = t.replace(/[?？.!。！,，\s]+$/, "");
  if (t.length > 140) t = `${t.slice(0, 137).trimEnd()}…`;
  return capitalise(t);
}

function findOwner(
  sentence: string,
  message: Message,
  kind: "commit" | "request" | "marked" | "name-to",
  people: string[],
  otherParty: string | null,
): { owner: string | null; how: string } {
  const explicit = /(?:owner|assigned to|assignee|担当)\s*[:：]?\s*@?([A-ZÀ-ɏ぀-ヿ一-鿿][\wÀ-ɏ぀-ヿ一-鿿.\-]*)/i.exec(sentence)
    ?? /[→>]\s*@?([A-Z][\w.\-]*)\s*$/.exec(sentence)
    ?? /\(([A-Z][a-z]+)\)\s*[.!]?$/.exec(sentence);
  if (explicit) return { owner: explicit[1], how: "named as the owner" };

  const mention = /@([A-Za-zÀ-ɏ][\w.\-]*)/.exec(sentence);
  if (mention) return { owner: mention[1], how: `@mentioned` };

  const vocative = /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s+/.exec(sentence);
  if (vocative && !NOT_OWNERS.has(vocative[1].toLowerCase())) return { owner: vocative[1], how: "addressed by name" };

  const ja = /([一-龯ぁ-んァ-ンA-Za-z]{1,10})(?:さん|様|くん|ちゃん)[、,は]/.exec(sentence);
  if (ja) return { owner: `${ja[1]}さん`, how: "addressed by name" };

  const nameTo = NAME_TO.exec(sentence);
  if (nameTo && !NOT_OWNERS.has(nameTo[1].toLowerCase())) return { owner: nameTo[1], how: "named as doing it" };

  if (kind === "commit") {
    if (/^\s*we\b|\bwe(?:'ll| will| need| have| must| should)/i.test(sentence)) {
      return { owner: message.speaker ? `${message.speaker} (for the team)` : "Team", how: `"we" — said by ${message.speaker ?? "the team"}` };
    }
    if (message.speaker) return { owner: message.speaker, how: `${message.speaker} said they would` };
    return { owner: null, how: "the speaker is not named in the text" };
  }
  if (kind === "request" && otherParty) return { owner: otherParty, how: "the other person in a two-person conversation" };

  // A name that appears in the sentence and is one of the people present.
  const present = people.find((p) => p.length > 1 && new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(sentence) && p !== message.speaker);
  if (present) return { owner: present, how: "named in the sentence" };
  return { owner: null, how: "no owner was named" };
}

function priorityOf(sentence: string, due: string | null, now: Date): Priority {
  if (URGENT.test(sentence)) return "high";
  if (due !== null) {
    const days = daysUntil(due, now);
    if (days <= 1) return "high";
    if (days <= 5) return "medium";
  }
  if (IMPORTANT.test(sentence)) return "medium";
  return "low";
}

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t.length > 2));
}

function similar(a: string, b: string): boolean {
  const x = tokens(a);
  const y = tokens(b);
  if (x.size === 0 || y.size === 0) return a.trim().toLowerCase() === b.trim().toLowerCase();
  let shared = 0;
  for (const t of x) if (y.has(t)) shared += 1;
  return shared / (x.size + y.size - shared) >= 0.75;
}

function matchesMe(value: string | null, me: string | null | undefined): boolean {
  if (!value || !me) return false;
  const a = value.toLowerCase().replace(/さん|様|\(.*\)/g, "").trim();
  const b = me.toLowerCase().trim();
  if (!a || !b) return false;
  return a === b || a.split(/\s+/)[0] === b.split(/\s+/)[0];
}

export function extractItems(messages: Message[], options: ExtractOptions = {}): WorkItem[] {
  const now = options.now ?? new Date();
  const people = knownPeople(messages);
  const speakers = [...new Set(messages.map((m) => m.speaker).filter((s): s is string => Boolean(s)))];
  const items: WorkItem[] = [];

  for (const message of messages) {
    const otherParty = speakers.length === 2 && message.speaker ? speakers.find((s) => s !== message.speaker) ?? null : null;

    splitSentences(message.text).forEach((raw, index) => {
      // A checkbox needs its bullet; every other rule reads the sentence
      // without one, since "- Jordan to…" and "Jordan to…" mean the same.
      const sentence = CHECKBOX.test(raw) ? raw : raw.replace(/^(?:[-*•]|\d+[.)])\s+/, "");
      let kind: ItemKind | null = null;
      let reason = "";
      let ownerKind: "commit" | "request" | "marked" | "name-to" = "marked";
      let done = false;

      const checkbox = CHECKBOX.exec(sentence);
      if (checkbox) {
        kind = "action";
        done = checkbox[1].toLowerCase() === "x";
        reason = done ? "a ticked checkbox" : "an unticked checkbox";
      } else if (MARKED_ACTION.test(sentence)) {
        kind = "action";
        reason = "marked as an action";
      } else if (MARKED_DECISION.test(sentence)) {
        kind = "decision";
        reason = "marked as a decision";
      } else if (MARKED_QUESTION.test(sentence)) {
        kind = "question";
        reason = "marked as a question";
      } else if (DECISION.test(sentence)) {
        kind = "decision";
        reason = "records something agreed";
      } else if (REQUEST.test(sentence) || JA_REQUEST.test(sentence)) {
        kind = "action";
        ownerKind = "request";
        reason = "asks someone to do something";
      } else if (COMMITMENT.test(sentence) || (JA_COMMIT.test(sentence) && !(HAS_JAPANESE.test(sentence) && JA_QUESTION.test(sentence)))) {
        kind = "action";
        ownerKind = "commit";
        reason = "someone committed to it";
      } else if (NAME_TO.test(sentence) && new RegExp(`\\b(?:to|will|'ll|should|needs to|is going to)\\s+${VERB}\\b`, "i").test(sentence)) {
        kind = "action";
        ownerKind = "name-to";
        reason = "names a person and a task";
      } else if (IMPERATIVE.test(sentence) && !/[?？]\s*$/.test(sentence)) {
        kind = "action";
        ownerKind = "request";
        reason = "written as an instruction";
      } else if (
        /[?？]\s*$/.test(sentence) &&
        (options.allQuestions || /@\w|\byou\b|^[A-Z][a-z]+,\s/.test(sentence) || (HAS_JAPANESE.test(sentence) && JA_QUESTION.test(sentence)))
      ) {
        kind = "question";
        ownerKind = "request";
        reason = "a question put to someone";
      }

      if (!kind) return;
      // Negations and past tense are reports, not work to be done.
      if (kind === "action" && !checkbox && /\b(?:won't|will not|can't|cannot|didn't|did not|already (?:sent|done|did|finished|fixed))\b/i.test(sentence)) return;

      const due = findDueDate(sentence, now);
      const { owner, how } = findOwner(sentence, message, ownerKind, people, otherParty);
      // A task's date moves to the Due column; a decision's date is the decision.
      const title = cleanTitle(sentence, kind === "action" ? due?.text ?? null : null);
      if (title.length < 3) return;

      const item: WorkItem = {
        id: `${message.line}-${index}`,
        kind,
        title,
        owner,
        due: due?.date ?? null,
        dueTime: due?.time ?? null,
        dueText: due?.text ?? null,
        priority: kind === "action" ? priorityOf(sentence, due?.date ?? null, now) : "low",
        reason: `${capitalise(reason)}${kind === "action" ? `; owner: ${how}` : ""}${due ? `; date read from "${due.text}"` : ""}.`,
        source: sentence,
        speaker: message.speaker,
        line: message.line,
        time: message.time,
        forMe: matchesMe(owner, options.me) || (options.me ? new RegExp(`@?\\b${options.me.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sentence) && message.speaker?.toLowerCase() !== options.me.toLowerCase() : false),
        done,
      };

      // The same task is often said twice in one meeting; keep the fuller one.
      const duplicate = items.find((existing) => existing.kind === item.kind && similar(existing.title, item.title));
      if (duplicate) {
        duplicate.owner ??= item.owner;
        duplicate.due ??= item.due;
        duplicate.dueText ??= item.dueText;
        duplicate.dueTime ??= item.dueTime;
        if (rank(item.priority) > rank(duplicate.priority)) duplicate.priority = item.priority;
        duplicate.forMe ||= item.forMe;
        return;
      }
      items.push(item);
    });
  }
  return items;
}

function rank(priority: Priority): number {
  return priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

/** Most pressing first: overdue and high priority, then by date, then priority. */
export function sortByUrgency(items: WorkItem[], now: Date = new Date()): WorkItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pa = rank(a.priority);
    const pb = rank(b.priority);
    if (pa !== pb) return pb - pa;
    const da = a.due ? daysUntil(a.due, now) : 9999;
    const db = b.due ? daysUntil(b.due, now) : 9999;
    return da - db;
  });
}

export function groupByOwner(items: WorkItem[]): Map<string, WorkItem[]> {
  const out = new Map<string, WorkItem[]>();
  for (const item of items) {
    const key = item.owner ?? "Unassigned";
    out.set(key, [...(out.get(key) ?? []), item]);
  }
  return out;
}
