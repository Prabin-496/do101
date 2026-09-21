/**
 * Answering the same customer questions without writing them out every time.
 *
 * You keep your answers in an FAQ — your own words, your own facts, stored in
 * an Excel file you download and load back. When an inquiry comes in, each
 * question in it is matched against that FAQ and a reply is assembled from
 * your answers. Questions with no good match are not guessed at: the reply
 * says you will check and get back to them, and the question is offered as a
 * new FAQ entry so the next one is answered automatically.
 *
 * The starter FAQs contain placeholders in [square brackets], not facts. A
 * reply is never sent with a bracket still in it without a warning.
 */

import { hasJapanese } from "@/lib/japanese/kana";
import type { Cell } from "./export";
import { SearchIndex, tokenize, type Passage } from "./search";

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  /** Extra words people use for this, comma-separated. */
  keywords: string;
}

export type Industry = "tourism" | "clinic" | "restaurant" | "agency" | "shop";

export const INDUSTRIES: { id: Industry; label: string }[] = [
  { id: "tourism", label: "Hotel, tours and travel" },
  { id: "clinic", label: "Clinic and health" },
  { id: "restaurant", label: "Restaurant and café" },
  { id: "agency", label: "Agency and services" },
  { id: "shop", label: "Online shop" },
];

const f = (id: string, question: string, answer: string, keywords: string): FaqEntry => ({ id, question, answer, keywords });

export const STARTER_FAQS: Record<Industry, FaqEntry[]> = {
  tourism: [
    f("t1", "What are your check-in and check-out times?", "Check-in is from [15:00] and check-out is by [11:00]. [Early check-in and late check-out are available on request, subject to availability.]", "check in, check out, arrival, departure, time, チェックイン, チェックアウト"),
    f("t2", "How do I make or change a booking?", "You can book [on our website] or by replying to this email with your dates and number of guests. [To change a booking, send us your booking number and the new dates.]", "book, booking, reserve, reservation, change, modify, 予約, 変更"),
    f("t3", "What is your cancellation policy?", "[Free cancellation up to 3 days before arrival. After that, the first night is charged.]", "cancel, cancellation, refund, キャンセル, 返金"),
    f("t4", "Is breakfast included?", "[Breakfast is included / available for ¥X per person], served [7:00–10:00].", "breakfast, food, meal, 朝食, 食事"),
    f("t5", "How do I get there from the airport or station?", "[From X station, it is a 5-minute walk. From the airport, take …]", "directions, access, airport, station, how to get, location, address, アクセス, 行き方, 駅, 空港"),
    f("t6", "Is there parking?", "[Parking is available for ¥X per night / There is no on-site parking; the nearest car park is …]", "parking, car, park, 駐車場, 車"),
    f("t7", "Do you have Wi-Fi?", "[Free Wi-Fi is available throughout the building.]", "wifi, wi-fi, internet, wireless, ワイファイ, インターネット"),
    f("t8", "What payment methods do you accept?", "[We accept cash, major credit cards and …]", "payment, pay, card, credit card, cash, 支払い, 決済, カード, 現金"),
  ],
  clinic: [
    f("c1", "What are your opening hours?", "We are open [Monday–Friday 9:00–18:00 and Saturday 9:00–13:00]. [We are closed on Sundays and public holidays.]", "hours, opening, open, close, time, 診療時間, 営業時間"),
    f("c2", "How do I book an appointment?", "You can book [online at …, by phone on …, or by replying to this message] with your preferred date and time.", "book, appointment, reserve, reservation, 予約"),
    f("c3", "Do I need an appointment, or can I walk in?", "[Appointments are recommended. Walk-in patients are seen when a slot is free.]", "walk in, walk-in, without appointment, 予約なし"),
    f("c4", "What should I bring to my first visit?", "Please bring [your insurance card, any medication you are taking, and …].", "bring, first visit, insurance, documents, 持ち物, 保険証, 初診"),
    f("c5", "Do you accept insurance?", "[We accept national health insurance and …]", "insurance, cover, 保険"),
    f("c6", "How do I cancel or change my appointment?", "Please let us know [at least 24 hours] before your appointment [by phone or by replying to this message].", "cancel, change, reschedule, キャンセル, 変更"),
    f("c7", "Do you have staff who speak English?", "[Yes, English-speaking staff are available on … / We can arrange an interpreter.]", "english, language, interpreter, 英語, 通訳"),
  ],
  restaurant: [
    f("r1", "What are your opening hours?", "We are open [11:30–14:30 for lunch and 17:30–22:00 for dinner], [closed on Mondays].", "hours, opening, open, close, time, 営業時間"),
    f("r2", "Can I make a reservation?", "Yes — please tell us the date, time and number of people, and we will confirm by reply. [Reservations are recommended at weekends.]", "reservation, reserve, book, table, 予約"),
    f("r3", "Do you have vegetarian, vegan or allergy-friendly options?", "[We have vegetarian dishes marked on the menu. Please tell us about any allergies when booking and we will do our best to accommodate them.]", "vegetarian, vegan, allergy, allergies, gluten, halal, ベジタリアン, アレルギー"),
    f("r4", "Can you host a private party or group?", "[We can host groups of up to X people. For private hire, please contact us with your date and group size.]", "party, group, private, event, 貸切, 宴会, 団体"),
    f("r5", "Do you offer takeaway or delivery?", "[Takeaway is available. Delivery is available through …]", "takeaway, take out, delivery, テイクアウト, 配達"),
    f("r6", "What payment methods do you accept?", "[We accept cash, cards and …]", "payment, pay, card, cash, 支払い, カード, 現金"),
  ],
  agency: [
    f("a1", "How much do your services cost?", "Our pricing depends on [the scope of the project]. [Typical projects start from …] If you share a little more about what you need, we will send a quote.", "price, pricing, cost, fee, rate, quote, budget, how much, 料金, 費用, 見積"),
    f("a2", "How long does a project take?", "[A typical project takes X–Y weeks from kickoff], depending on scope and feedback rounds.", "timeline, how long, duration, turnaround, deadline, 期間, 納期"),
    f("a3", "What is included in your service?", "[Our standard package includes …]", "included, include, package, scope, deliverables, 内容, 範囲"),
    f("a4", "Can we schedule a call?", "Of course — [please choose a time here: … / reply with a few times that suit you] and we will send an invite.", "call, meeting, schedule, chat, talk, 打ち合わせ, 面談, 相談"),
    f("a5", "What are your payment terms?", "[We invoice 50% upfront and 50% on completion, payable within 30 days.]", "payment, invoice, terms, deposit, 支払い, 請求"),
  ],
  shop: [
    f("s1", "How long does shipping take?", "[Orders ship within 1–2 business days and usually arrive in 3–5 days.]", "shipping, delivery, arrive, how long, 配送, 発送, 届く"),
    f("s2", "How much is shipping?", "[Shipping is ¥X, free on orders over ¥Y.]", "shipping cost, delivery fee, postage, 送料"),
    f("s3", "Can I return or exchange an item?", "[Unused items can be returned within 14 days. Please reply with your order number to start a return.]", "return, exchange, refund, 返品, 交換, 返金"),
    f("s4", "Where is my order?", "Please reply with your order number and we will check its status for you. [You can also track it at …]", "order, tracking, where is, status, 注文, 追跡"),
    f("s5", "Do you ship internationally?", "[We ship to … / We currently ship within … only.]", "international, overseas, abroad, country, 海外, 国際"),
  ],
};

/** Words that mean the same thing to a customer, used to widen a match. */
const SYNONYMS: string[][] = [
  ["price", "cost", "fee", "charge", "rate", "pricing", "quote", "how much", "料金", "値段", "価格", "費用"],
  ["hours", "open", "opening", "close", "closing", "time", "営業時間", "何時"],
  ["book", "booking", "reserve", "reservation", "appointment", "予約"],
  ["cancel", "cancellation", "refund", "キャンセル", "返金"],
  ["parking", "car", "park", "駐車場"],
  ["wifi", "internet", "wireless", "ワイファイ"],
  ["address", "location", "directions", "access", "where", "アクセス", "場所"],
  ["pay", "payment", "card", "cash", "支払い", "決済"],
  ["ship", "shipping", "delivery", "deliver", "配送", "発送"],
];

const SYNONYM_STEMS: string[][] = SYNONYMS.map((group) => [...new Set(group.flatMap((word) => tokenize(word)))]);

/**
 * Whole words only: "somewhere" must not trigger the "where" group. Japanese
 * has no spaces to mark word edges, so it is matched as a substring.
 */
function mentions(text: string, word: string): boolean {
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(word)) return text.includes(word);
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

export function expandQuery(text: string): string {
  const extra: string[] = [];
  for (const group of SYNONYMS) {
    if (group.some((word) => mentions(text, word))) extra.push(...group);
  }
  return `${text} ${extra.join(" ")}`;
}

const QUESTION_SIGNAL = /[?？]|\b(?:do you|does|can i|could i|could you|can you|is there|are there|is it|how|what|when|where|which|would it|i'd like to know|i would like to know|wondering|please let me know)\b|でしょうか|ですか|ますか|教えてください|知りたい|可能ですか|できますか/i;

/** The separate questions in one message. */
export function splitQuestions(inquiry: string): string[] {
  const sentences = inquiry
    .replace(/\r/g, "")
    .split(/(?<=[.!?。！？])\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
  const questions = sentences
    .filter((s) => QUESTION_SIGNAL.test(s) && !/^(?:hi|hello|dear|thanks|thank you|best|regards|よろしく)/i.test(s))
    // "And can we bring the dog?" reads better quoted back without the "And".
    .map((s) => s.replace(/^(?:and|also|oh,? and|plus|lastly|finally|one more thing)[,:]?\s+/i, "").replace(/^./, (c) => c.toUpperCase()));
  return questions.length ? questions : sentences.slice(0, 1);
}

/** "I'm Anna", "My name is…", "〇〇と申します", or a name signed at the end. */
export function detectName(inquiry: string): string | null {
  // The lead-in is matched in any case; the name itself must be capitalised,
  // which is what stops "I'm looking for…" being read as a name.
  const intro = /\b(?:[Mm]y name is|I am|I'm|I’m|[Tt]his is)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/.exec(inquiry);
  if (intro) return intro[1];
  const ja = /([一-龯ぁ-んァ-ン]{1,8})と申します/.exec(inquiry);
  if (ja) return ja[1];
  const lines = inquiry.trim().split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const last = lines.at(-1) ?? "";
  if (lines.length > 1 && /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)?$/.test(last) && /(thanks|thank you|regards|best|cheers)/i.test(lines.at(-2) ?? "")) return last;
  return null;
}

export interface MatchResult {
  question: string;
  entry: FaqEntry | null;
  /** 0–1: how much of the question the matched FAQ covers. */
  confidence: number;
}

export function matchInquiry(inquiry: string, faqs: FaqEntry[], threshold = 0.34): MatchResult[] {
  const passages: Passage[] = faqs.map((entry, i) => ({
    docId: entry.id,
    title: `${entry.question} ${entry.keywords}`,
    text: `${entry.question} ${entry.keywords.replace(/,/g, " ")} ${entry.answer.replace(/\[[^\]]*\]/g, " ")}`,
    index: i,
  }));
  const index = new SearchIndex(passages);
  return splitQuestions(inquiry).map((question) => {
    const [top] = index.search(expandQuery(question), 1);
    const own = [...new Set(tokenize(question))];
    // A word counts as covered if the FAQ matched it, or matched one of its
    // synonyms — "car" is answered by an entry about parking.
    const covered = top
      ? own.filter((t) => top.matched.includes(t) || SYNONYM_STEMS.some((group) => group.includes(t) && group.some((g) => top.matched.includes(g)))).length
      : 0;
    // Words no FAQ contains ("somewhere", "leave") are weak evidence either
    // way, so they count half. That keeps "is there somewhere to leave the
    // car?" matched to parking while "my car broke down, can you recommend a
    // mechanic?" still is not.
    const known = own.filter((t) => index.knows(t)).length;
    const unknown = own.length - known;
    const confidence = own.length ? Math.min(1, covered / (known + unknown * 0.5)) : 0;
    const entry = top && confidence >= threshold ? faqs.find((e) => e.id === top.passage.docId) ?? null : null;
    return { question, entry, confidence };
  });
}

export interface ReplyOptions {
  customerName: string;
  business: string;
  signer: string;
  tone: "formal" | "friendly";
  language: "en" | "ja";
}

export function composeReply(matches: MatchResult[], o: ReplyOptions): string {
  const answered = matches.filter((m) => m.entry);
  const open = matches.filter((m) => !m.entry);
  const unique = [...new Map(answered.map((m) => [m.entry!.id, m.entry!])).values()];

  if (o.language === "ja") {
    const lines = [
      `${o.customerName || "お客"}様`,
      "",
      `お問い合わせいただき、誠にありがとうございます。${o.business ? `${o.business}でございます。` : ""}`,
      "",
      ...unique.flatMap((e) => [e.answer, ""]),
      ...open.map((m) => `「${m.question.replace(/[?？]$/, "")}」につきましては、確認のうえ改めてご連絡いたします。`),
      ...(open.length ? [""] : []),
      "その他ご不明な点がございましたら、お気軽にお問い合わせください。",
      "今後ともよろしくお願いいたします。",
      "",
      o.signer || o.business,
    ];
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  const hello = o.tone === "formal" ? `Dear ${o.customerName || "Customer"},` : `Hi ${o.customerName || "there"},`;
  const thanks = o.tone === "formal"
    ? `Thank you for contacting ${o.business || "us"}.`
    : `Thanks for getting in touch${o.business ? ` with ${o.business}` : ""}!`;
  const followUp = open.length
    ? [open.length === 1
        ? `On your question — "${open[0].question.replace(/[?]$/, "")}" — I'll check and come back to you shortly.`
        : `On your other questions (${open.map((m) => `"${m.question.replace(/[?]$/, "")}"`).join(", ")}), I'll check and come back to you shortly.`]
    : [];
  const close = o.tone === "formal" ? "Please do not hesitate to contact us if you have any further questions.\n\nKind regards," : "Let me know if there's anything else I can help with.\n\nBest,";
  return [hello, "", thanks, "", ...unique.flatMap((e) => [e.answer, ""]), ...followUp, ...(followUp.length ? [""] : []), close, o.signer || o.business || ""]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Placeholders the business has not filled in yet. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\[[^\]]+\]/g)].map((m) => m[0]);
}

export function faqsToRows(faqs: FaqEntry[]): Cell[][] {
  return [["Question", "Answer", "Keywords"], ...faqs.map((e) => [e.question, e.answer, e.keywords])];
}

export function faqsFromRows(rows: Cell[][]): FaqEntry[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => String(h ?? "").toLowerCase());
  const q = header.findIndex((h) => /question|質問/.test(h));
  const a = header.findIndex((h) => /answer|回答/.test(h));
  const k = header.findIndex((h) => /keyword|キーワード/.test(h));
  return rows.slice(1)
    .filter((r) => String(r[q >= 0 ? q : 0] ?? "").trim())
    .map((r, i) => ({
      id: `f${i}`,
      question: String(r[q >= 0 ? q : 0] ?? "").trim(),
      answer: String(r[a >= 0 ? a : 1] ?? "").trim(),
      keywords: k >= 0 ? String(r[k] ?? "").trim() : "",
    }));
}

export function isJapanese(text: string): boolean {
  return hasJapanese(text);
}
