/**
 * Business Japanese, explained — and replied to.
 *
 * Workplace Japanese runs on set phrases whose meaning is not the sum of their
 * words. 「前向きに検討します」 reads as "we will consider it positively" and very
 * often means no; 「お疲れ様です」 has nothing to do with being tired. A
 * dictionary or a machine translation gives you the words. This gives you the
 * meaning, what the sender expects back, and a correctly polite reply built
 * from tested templates.
 *
 * It does not translate arbitrary sentences — that needs a translation model,
 * and this tool runs with no external service at all. It recognises the
 * phrases that carry the meaning in a business message, which is most of what
 * a newcomer needs to understand one.
 */

import { kanaToHepburn } from "@/lib/japanese/kana";
import { findDueDate, type DueDate } from "./dates";

export type PhraseCategory =
  | "greeting" | "request" | "question" | "deadline" | "apology" | "refusal"
  | "acknowledgement" | "thanks" | "closing" | "cushion" | "schedule" | "fyi";

export const CATEGORY_LABELS: Record<PhraseCategory, string> = {
  greeting: "Greeting",
  request: "A request to you",
  question: "A question",
  deadline: "Deadline or urgency",
  apology: "Apology",
  refusal: "A refusal (often indirect)",
  acknowledgement: "Acknowledgement",
  thanks: "Thanks",
  closing: "Closing",
  cushion: "Softener before a request",
  schedule: "Scheduling",
  fyi: "For your information",
};

export interface Phrase {
  /** What to look for; several spellings where they are common. */
  match: RegExp;
  jp: string;
  /** Reading, spaced between words so the romaji is readable. */
  kana: string;
  literal: string;
  /** What it actually means in a workplace. */
  meaning: string;
  /** What the sender expects back. */
  respond: string;
  category: PhraseCategory;
}

const p = (match: RegExp, jp: string, kana: string, literal: string, meaning: string, respond: string, category: PhraseCategory): Phrase =>
  ({ match, jp, kana, literal, meaning, respond, category });

export const PHRASES: Phrase[] = [
  p(/お世話になっております|お世話になります/, "お世話になっております", "おせわ に なって おります", "I am being taken care of by you", "The standard opening line to anyone outside your company. It is a formality — they are not thanking you for anything in particular.", "Open your reply with the same phrase.", "greeting"),
  p(/お疲れ様です|お疲れさまです|おつかれさまです/, "お疲れ様です", "おつかれさまです", "You must be tired", "The standard greeting between colleagues inside a company, used at any time of day. Nothing to do with being tired.", "Use it back to colleagues. Do not use it with clients — use お世話になっております instead.", "greeting"),
  p(/ご確認(?:ください|下さい|をお願い|いただけ|のほど)/, "ご確認ください", "ごかくにん ください", "Please confirm", "Please look at this and check it. They expect you to read it and tell them it is fine or what needs changing.", "Once checked, reply 「確認いたしました」 (I have checked it), plus any comments.", "request"),
  p(/ご検討(?:ください|下さい|いただけ|のほど|をお願い)/, "ご検討ください", "ごけんとう ください", "Please consider", "Please think this over and come back with a decision.", "Give a decision, or say when you will: 「〇日までにお返事いたします」.", "request"),
  p(/前向きに検討/, "前向きに検討します", "まえむき に けんとう します", "We will consider it positively", "Sounds encouraging, but is often a polite way of not committing. Without a date attached it may mean no.", "Ask, politely, when you can expect a decision.", "refusal"),
  p(/検討させていただきます|検討いたします/, "検討させていただきます", "けんとう させて いただきます", "We will consider it", "May be sincere, but frequently a soft no — especially with no follow-up date.", "Follow up with a clear question and a date: 「〇日頃にご回答いただけますでしょうか」.", "refusal"),
  p(/善処(?:します|いたします)/, "善処します", "ぜんしょ します", "I will deal with it appropriately", "A classic non-answer. It usually means nothing will change, or at least that nothing is promised.", "Do not treat it as agreement. If it matters, ask for something specific.", "refusal"),
  p(/難しい(?:です|かと|状況|ところ)/, "難しいです", "むずかしいです", "It is difficult", "In business Japanese this almost always means no, said gently.", "Do not push the same request. Offer an alternative, or thank them and move on.", "refusal"),
  p(/見送らせていただ/, "見送らせていただきます", "みおくらせて いただきます", "We will let it pass", "A clear, polite no — the proposal or request is declined.", "Thank them for considering it: 「ご検討いただき、ありがとうございました」.", "refusal"),
  p(/あいにく|残念ながら/, "あいにく／残念ながら", "あいにく / ざんねん ながら", "Unfortunately / regrettably", "Bad news or a refusal is coming in the rest of the sentence.", "Acknowledge it gracefully; propose another option if you have one.", "refusal"),
  p(/今回は(?:見送|お断り|難し|ご縁)/, "今回は…", "こんかい わ", "This time…", "Very often the start of a polite rejection — \"this time, we will pass\".", "Thank them and keep the door open for the future.", "refusal"),
  p(/恐れ入りますが/, "恐れ入りますが", "おそれいりますが", "I am overwhelmed, but", "A polite cushion before asking something. The request follows it.", "Nothing to reply to — read what comes next.", "cushion"),
  p(/恐縮(?:ですが|ではございますが)/, "恐縮ですが", "きょうしゅく ですが", "I feel very small, but", "A stronger cushion than 恐れ入りますが — they know they are asking a lot.", "Read the request that follows; it may be a big one.", "cushion"),
  p(/お手数(?:ですが|をおかけ)/, "お手数ですが", "おてすう ですが", "Sorry for the trouble, but", "They are asking you to do something that takes effort.", "Do the task; say 「承知いたしました」 to acknowledge.", "cushion"),
  p(/差し支えなければ/, "差し支えなければ", "さしつかえ なければ", "If it does no harm", "\"If you don't mind…\" — polite, but they do want you to do it.", "Answer the request unless there is a real reason not to.", "cushion"),
  p(/ご多忙のところ|お忙しいところ/, "お忙しいところ", "おいそがしい ところ", "While you are busy", "A courtesy before a request or a thank-you.", "No reply needed to the phrase itself.", "cushion"),
  p(/念のため/, "念のため", "ねん の ため", "Just to be sure", "A gentle double-check or reminder. Sometimes means they think something was missed.", "Confirm the point clearly, even if you think it was obvious.", "fyi"),
  p(/取り急ぎ/, "取り急ぎ", "とりいそぎ", "In haste", "\"Just a quick note for now\" — a short message, often with more to follow.", "Reply to what is there; a fuller message may come later.", "fyi"),
  p(/ご教示(?:ください|いただけ|願い)/, "ご教示ください", "ごきょうじ ください", "Please teach me", "A formal way of asking you for information or advice.", "Send the information they asked for.", "request"),
  p(/ご査収(?:ください|のほど)/, "ご査収ください", "ごさしゅう ください", "Please receive and check", "Something is attached or enclosed — please open it and check it.", "Confirm you received it: 「確かに受領いたしました」 or 「拝受いたしました」.", "request"),
  p(/ご一報(?:ください|いただけ)|ご連絡(?:ください|いただけ)/, "ご連絡ください", "ごれんらく ください", "Please contact me", "They are waiting for a reply or an update from you.", "Reply, even if only to say when you will have an answer.", "request"),
  p(/ご返信(?:ください|いただけ|のほど)/, "ご返信ください", "ごへんしん ください", "Please reply", "They need a reply. If there is a date, it is a deadline.", "Reply by the date, or explain the delay.", "request"),
  p(/承知(?:しました|いたしました|致しました)/, "承知いたしました", "しょうち いたしました", "I have understood", "A polite \"understood / will do\". Fine with bosses and clients.", "Nothing needed — this confirms they will do it.", "acknowledgement"),
  p(/かしこまりました/, "かしこまりました", "かしこまりました", "Certainly", "A very polite \"certainly / understood\", common in customer service.", "Nothing needed.", "acknowledgement"),
  p(/了解(?:しました|です)/, "了解しました", "りょうかい しました", "Understood", "\"Got it.\" Fine between colleagues, but can sound too casual to a boss or client.", "When writing to a superior or client, use 承知いたしました instead.", "acknowledgement"),
  p(/確認(?:しました|いたしました|致しました)/, "確認いたしました", "かくにん いたしました", "I have checked", "They have read or checked what you sent.", "Nothing needed, unless they add comments.", "acknowledgement"),
  p(/申し訳(?:ございません|ありません|なく)/, "申し訳ございません", "もうしわけ ございません", "There is no excuse", "\"I am very sorry.\" A formal apology.", "Acknowledge it kindly; 「とんでもないです」 or 「お気になさらないでください」 are common.", "apology"),
  p(/ご迷惑をおかけ/, "ご迷惑をおかけしております", "ごめいわく お おかけ して おります", "I am causing you trouble", "\"Sorry for the inconvenience.\" Often used about a problem that is still ongoing.", "Ask for a timeline if you need one.", "apology"),
  p(/ご容赦(?:ください|いただけ|のほど)/, "ご容赦ください", "ごようしゃ ください", "Please forgive", "\"Please excuse this\" — usually about something they will not or cannot change.", "Accept it or raise your concern clearly.", "apology"),
  p(/ご理解(?:のほど|いただけ|ください)/, "ご理解のほどよろしくお願いいたします", "ごりかい の ほど よろしく おねがい いたします", "Please understand", "Often follows bad news or a no: \"we ask for your understanding\".", "If you disagree, now is the time to say so, politely.", "refusal"),
  p(/至急|大至急|緊急/, "至急", "しきゅう", "Urgent", "Genuinely urgent. Deal with it first or say when you can.", "Reply quickly, even if only to say you are on it.", "deadline"),
  p(/本日中/, "本日中", "ほんじつ ちゅう", "Within today", "The deadline is the end of today.", "Reply today, or explain immediately if you cannot.", "deadline"),
  p(/までに/, "〜までに", "までに", "By (a time)", "A deadline follows or precedes this.", "Confirm you can meet the date, or propose another.", "deadline"),
  p(/お手すきの際に|お時間のある時に|お時間がある時に/, "お手すきの際に", "おてすき の さい に", "When your hands are free", "\"When you have a moment\" — not urgent, but still expected soon.", "Do it within a day or two.", "request"),
  p(/ご都合(?:はいかが|のよい|の良い|いかが)/, "ご都合はいかがでしょうか", "ごつごう わ いかが でしょうか", "How is your convenience?", "They are asking when you are available.", "Offer two or three specific times.", "schedule"),
  p(/日程(?:調整|をご調整|のご相談)/, "日程調整", "にってい ちょうせい", "Schedule adjustment", "They want to find a time to meet.", "Offer specific dates and times.", "schedule"),
  p(/共有(?:いたします|します|させていただ)/, "共有いたします", "きょうゆう いたします", "I will share", "For your information — please read it.", "No reply usually needed; a short 「ありがとうございます」 is polite.", "fyi"),
  p(/ご報告(?:いたします|します|させていただ)/, "ご報告いたします", "ごほうこく いたします", "I will report", "A status update.", "Acknowledge it; ask questions if anything is unclear.", "fyi"),
  p(/ご放念(?:ください|いただけ)/, "ご放念ください", "ごほうねん ください", "Please put it out of your mind", "Please disregard an earlier message.", "Ignore the earlier message; no reply needed.", "fyi"),
  p(/折り返し(?:ご連絡|連絡|お電話)/, "折り返しご連絡いたします", "おりかえし ごれんらく いたします", "I will contact you in return", "\"I will get back to you.\"", "Wait for their reply, or ask when to expect it.", "fyi"),
  p(/対応(?:いたします|します|させていただ)/, "対応いたします", "たいおう いたします", "I will handle it", "They will take care of it.", "Nothing needed; follow up if it has a deadline.", "acknowledgement"),
  p(/ありがとうございます|ありがとうございました/, "ありがとうございます", "ありがとう ございます", "Thank you", "Thanks.", "Nothing needed.", "thanks"),
  p(/ご指摘(?:ありがとう|いただき)/, "ご指摘ありがとうございます", "ごしてき ありがとう ございます", "Thank you for pointing it out", "They accept they made a mistake you noticed.", "Nothing needed; a short 「とんでもございません」 is gracious.", "thanks"),
  p(/何卒(?:よろしく|宜しく)/, "何卒よろしくお願い申し上げます", "なにとぞ よろしく おねがい もうしあげます", "I humbly beg your favour", "A very formal closing, used when asking for something important.", "Close your reply formally too.", "closing"),
  p(/引き続き(?:よろしく|宜しく)/, "引き続きよろしくお願いいたします", "ひきつづき よろしく おねがい いたします", "Please continue to treat me well", "A standard closing for an ongoing relationship or project.", "Use the same closing.", "closing"),
  p(/よろしくお願い(?:いたします|致します|します|申し上げます)/, "よろしくお願いいたします", "よろしく おねがい いたします", "Please treat me favourably", "The universal closing. It also means \"please take care of what I have asked\".", "Close your reply with it too.", "closing"),
];

export interface FoundPhrase {
  phrase: Phrase;
  index: number;
}

export interface MessageAnalysis {
  found: FoundPhrase[];
  categories: PhraseCategory[];
  deadline: DueDate | null;
  /** What the message seems to want, in plain words. */
  summary: string[];
  /** Replies that fit, most likely first. */
  suggested: Situation[];
  formality: "external" | "internal" | "unknown";
}

export function analyseMessage(text: string, now: Date = new Date()): MessageAnalysis {
  const found: FoundPhrase[] = [];
  for (const phrase of PHRASES) {
    const m = phrase.match.exec(text);
    if (m) found.push({ phrase, index: m.index });
  }
  found.sort((a, b) => a.index - b.index);

  const categories = [...new Set(found.map((f) => f.phrase.category))];
  const has = (c: PhraseCategory) => categories.includes(c);
  const deadline = findDueDate(text, now);
  const question = /(?:でしょうか|ですか|ますか|ませんか)[。？?]?|[？?]/.test(text);

  const summary: string[] = [];
  if (has("refusal")) summary.push("They are declining or not committing — read it as a polite no unless a date is attached.");
  if (has("request")) summary.push("They are asking you to do something.");
  if (question) summary.push("There is a question that needs an answer.");
  if (deadline) summary.push(`There is a deadline: ${deadline.text} (${deadline.date}).`);
  if (has("deadline") && !deadline) summary.push("It is marked urgent.");
  if (has("schedule")) summary.push("They want to arrange a time.");
  if (has("apology")) summary.push("They are apologising for something.");
  if (has("fyi") && !has("request")) summary.push("Mostly for your information.");
  if (summary.length === 0) summary.push("No request or deadline recognised — probably informational.");

  // What they asked for comes first: a direct question or request needs a
  // reply before any softer signal elsewhere in the message does.
  const suggested: Situation[] = [];
  if (question) suggested.push("answer");
  if (has("request") || deadline) suggested.push("accept");
  if (has("schedule")) suggested.push("meeting");
  if (question) suggested.push("clarify");
  if (deadline) suggested.push("extension");
  if (has("refusal") && !has("request") && !question) suggested.push("thank");
  suggested.push("acknowledge");

  // お疲れ様 contains 様, so it is taken out before looking for a client's 〇〇様.
  const withoutOtsukare = text.replace(/お疲れ様|お疲れさま/g, "");
  const formality = /お世話になって/.test(text)
    ? "external"
    : /お疲れ様|お疲れさま|おつかれさま/.test(text)
      ? "internal"
      : /様/.test(withoutOtsukare)
        ? "external"
        : "unknown";
  return { found, categories, deadline, summary, suggested: [...new Set(suggested)], formality };
}

/* ------------------------------ Reply builder ----------------------------- */

export type Situation =
  | "acknowledge" | "accept" | "answer" | "clarify" | "extension" | "decline"
  | "complete" | "late" | "thank" | "meeting" | "attachment";

export type Audience = "client" | "boss" | "colleague";

export const SITUATIONS: { id: Situation; label: string }[] = [
  { id: "acknowledge", label: "Say you received it" },
  { id: "accept", label: "Accept the task, with a deadline" },
  { id: "answer", label: "Answer their question" },
  { id: "clarify", label: "Ask for more detail" },
  { id: "extension", label: "Ask for more time" },
  { id: "decline", label: "Decline politely" },
  { id: "complete", label: "Report that it is done" },
  { id: "late", label: "Apologise for replying late" },
  { id: "thank", label: "Thank them" },
  { id: "meeting", label: "Propose a meeting time" },
  { id: "attachment", label: "Send a file" },
];

export const AUDIENCES: { id: Audience; label: string; note: string }[] = [
  { id: "client", label: "Client / other company", note: "Humble and honorific forms (謙譲語 and 尊敬語), お世話になっております." },
  { id: "boss", label: "Boss / senior colleague", note: "Polite in-house register, お疲れ様です, 承知いたしました." },
  { id: "colleague", label: "Colleague", note: "Polite but plainer (です／ます), お疲れ様です." },
];

export interface ReplySlots {
  recipient: string;
  recipientCompany: string;
  me: string;
  myCompany: string;
  /** The task or topic, in Japanese if possible. */
  topic: string;
  /** A date, written the way it should appear, e.g. 9月30日. */
  date: string;
  /** Your answer, in Japanese — only used when answering a question. */
  details?: string;
}

export interface ReplyLine {
  jp: string;
  /**
   * How the line is said: kana with words and particles spaced, and the
   * particles は, を and へ written as pronounced (わ, お, え), so the romaji
   * comes out as "kyō wa" and not "kyō ha". Used for romaji, not shown as kana.
   */
  kana: string;
  en: string;
}

type Line = [jp: string, kana: string, en: string];

const BODY: Record<Situation, Record<Audience, Line[]>> = {
  acknowledge: {
    client: [["ご連絡いただき、ありがとうございます。", "ごれんらく いただき、 ありがとう ございます。", "Thank you for getting in touch."], ["内容を確認いたしました。", "ないよう お かくにん いたしました。", "I have read and checked the contents."]],
    boss: [["ご連絡ありがとうございます。", "ごれんらく ありがとう ございます。", "Thank you for the message."], ["内容を確認いたしました。", "ないよう お かくにん いたしました。", "I have checked the contents."]],
    colleague: [["連絡ありがとうございます。", "れんらく ありがとう ございます。", "Thanks for the message."], ["確認しました。", "かくにん しました。", "I've checked it."]],
  },
  accept: {
    client: [["{topic}の件、承知いたしました。", "{topic} の けん、 しょうち いたしました。", "Understood regarding {topic}."], ["{date}までに対応いたします。", "{date} まで に たいおう いたします。", "I will take care of it by {date}."]],
    boss: [["{topic}の件、承知いたしました。", "{topic} の けん、 しょうち いたしました。", "Understood regarding {topic}."], ["{date}までに対応いたします。", "{date} まで に たいおう いたします。", "I will have it done by {date}."]],
    colleague: [["{topic}の件、了解です。", "{topic} の けん、 りょうかい です。", "Got it regarding {topic}."], ["{date}までに対応します。", "{date} まで に たいおう します。", "I'll handle it by {date}."]],
  },
  answer: {
    client: [["お問い合わせいただいた{topic}の件について、ご回答いたします。", "おといあわせ いただいた {topic} の けん に ついて、 ごかいとう いたします。", "Regarding your question about {topic}, here is our answer."], ["{details}", "{details}", "[Your answer]"], ["ご不明な点がございましたら、お気軽にお申し付けください。", "ごふめい な てん が ございましたら、 おきがる に おもうしつけ ください。", "If anything is unclear, please don't hesitate to ask."]],
    boss: [["{topic}の件について、ご回答いたします。", "{topic} の けん に ついて、 ごかいとう いたします。", "Regarding {topic}, here is my answer."], ["{details}", "{details}", "[Your answer]"]],
    colleague: [["{topic}の件ですが、", "{topic} の けん ですが、", "About {topic}:"], ["{details}", "{details}", "[Your answer]"]],
  },
  clarify: {
    client: [["恐れ入りますが、{topic}について、もう少し詳しく教えていただけますでしょうか。", "おそれいりますが、 {topic} に ついて、 もう すこし くわしく おしえて いただけます でしょうか。", "I'm sorry to trouble you, but could you tell me a little more about {topic}?"]],
    boss: [["恐れ入りますが、{topic}について、もう少し詳しく教えていただけますか。", "おそれいりますが、 {topic} に ついて、 もう すこし くわしく おしえて いただけますか。", "Sorry to trouble you, but could you give me more detail on {topic}?"]],
    colleague: [["{topic}について、もう少し詳しく教えてもらえますか。", "{topic} に ついて、 もう すこし くわしく おしえて もらえますか。", "Could you tell me a bit more about {topic}?"]],
  },
  extension: {
    client: [["大変申し訳ございませんが、{topic}の期限を{date}まで延長していただくことは可能でしょうか。", "たいへん もうしわけ ございませんが、 {topic} の きげん お {date} まで えんちょう して いただく こと わ かのう でしょうか。", "I am very sorry, but would it be possible to extend the deadline for {topic} to {date}?"]],
    boss: [["申し訳ございませんが、{topic}の期限を{date}まで延ばしていただくことは可能でしょうか。", "もうしわけ ございませんが、 {topic} の きげん お {date} まで のばして いただく こと わ かのう でしょうか。", "I'm sorry, but would it be possible to push the deadline for {topic} back to {date}?"]],
    colleague: [["申し訳ないのですが、{topic}の期限を{date}まで延ばしてもらえますか。", "もうしわけ ない の ですが、 {topic} の きげん お {date} まで のばして もらえますか。", "Sorry, but could we push the deadline for {topic} to {date}?"]],
  },
  decline: {
    client: [["せっかくご提案いただいたにもかかわらず申し訳ございませんが、今回は見送らせていただきたく存じます。", "せっかく ごていあん いただいた に も かかわらず もうしわけ ございませんが、 こんかい わ みおくらせて いただきたく ぞんじます。", "Thank you for the proposal; I'm sorry, but we will have to pass on it this time."]],
    boss: [["申し訳ございませんが、現在ほかの業務を抱えており、今回はお引き受けすることが難しい状況です。", "もうしわけ ございませんが、 げんざい ほか の ぎょうむ お かかえて おり、 こんかい わ おひきうけ する こと が むずかしい じょうきょう です。", "I'm sorry, but I have other work in hand and would find it difficult to take this on right now."]],
    colleague: [["申し訳ないのですが、今回は難しそうです。", "もうしわけ ない の ですが、 こんかい わ むずかし そう です。", "Sorry, but I don't think I can this time."]],
  },
  complete: {
    client: [["{topic}が完了いたしましたので、ご報告いたします。", "{topic} が かんりょう いたしました ので、 ごほうこく いたします。", "I am writing to let you know that {topic} is complete."]],
    boss: [["{topic}が完了しましたので、ご報告いたします。", "{topic} が かんりょう しました ので、 ごほうこく いたします。", "I'd like to report that {topic} is complete."]],
    colleague: [["{topic}、完了しました。", "{topic}、 かんりょう しました。", "{topic} is done."]],
  },
  late: {
    client: [["ご返信が遅くなり、大変申し訳ございません。", "ごへんしん が おそく なり、 たいへん もうしわけ ございません。", "I sincerely apologise for my late reply."]],
    boss: [["返信が遅くなり、申し訳ございません。", "へんしん が おそく なり、 もうしわけ ございません。", "I'm sorry for the late reply."]],
    colleague: [["返信が遅くなってすみません。", "へんしん が おそく なって すみません。", "Sorry for the slow reply."]],
  },
  thank: {
    client: [["{topic}について、ご対応いただき誠にありがとうございます。", "{topic} に ついて、 ごたいおう いただき まことに ありがとう ございます。", "Thank you very much for your help with {topic}."]],
    boss: [["{topic}の件、ご対応いただきありがとうございます。", "{topic} の けん、 ごたいおう いただき ありがとう ございます。", "Thank you for handling {topic}."]],
    colleague: [["{topic}の件、ありがとうございます。", "{topic} の けん、 ありがとう ございます。", "Thanks for {topic}."]],
  },
  meeting: {
    client: [["打ち合わせの日程について、{date}はいかがでしょうか。", "うちあわせ の にってい に ついて、 {date} わ いかが でしょうか。", "For the meeting, would {date} suit you?"], ["ご都合が合わない場合は、候補日をお知らせいただけますと幸いです。", "ごつごう が あわない ばあい わ、 こうほび お おしらせ いただけますと さいわい です。", "If that doesn't work, I'd be grateful if you could suggest some dates."]],
    boss: [["打ち合わせですが、{date}はご都合いかがでしょうか。", "うちあわせ ですが、 {date} わ ごつごう いかが でしょうか。", "For the meeting, would {date} work for you?"]],
    colleague: [["打ち合わせですが、{date}はどうですか。", "うちあわせ ですが、 {date} わ どう ですか。", "For the meeting, how about {date}?"]],
  },
  attachment: {
    client: [["{topic}をお送りいたします。", "{topic} お おおくり いたします。", "Please find {topic} attached."], ["ご査収のほど、よろしくお願いいたします。", "ごさしゅう の ほど、 よろしく おねがい いたします。", "I would be grateful if you could check it."]],
    boss: [["{topic}をお送りします。", "{topic} お おおくり します。", "I'm sending {topic}."], ["ご確認をお願いいたします。", "ごかくにん お おねがい いたします。", "Please take a look."]],
    colleague: [["{topic}を送ります。", "{topic} お おくります。", "Sending {topic}."], ["確認お願いします。", "かくにん おねがい します。", "Please check it."]],
  },
};

function fill(template: string, slots: ReplySlots): string {
  return template
    .replace(/\{topic\}/g, slots.topic.trim() || "〇〇")
    .replace(/\{date\}/g, slots.date.trim() || "〇月〇日")
    .replace(/\{details\}/g, slots.details?.trim() || "（ここに回答を書いてください）");
}

/** Romaji, with Japanese punctuation turned into English so it reads naturally. */
export function toRomaji(kana: string): string {
  return kanaToHepburn(kana)
    .replace(/、/g, ",")
    .replace(/。/g, ".")
    .replace(/？/g, "?")
    .replace(/[「」]/g, '"')
    .replace(/\s+([,.?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildReply(situation: Situation, audience: Audience, slots: ReplySlots): ReplyLine[] {
  const lines: ReplyLine[] = [];
  const add = (jp: string, kana: string, en: string) =>
    lines.push({ jp: fill(jp, slots), kana: fill(kana, slots), en: fill(en, slots) });

  const name = slots.recipient.trim() || "〇〇";
  if (audience === "client") {
    if (slots.recipientCompany.trim()) add(slots.recipientCompany.trim(), slots.recipientCompany.trim(), slots.recipientCompany.trim());
    add(`${name}様`, `${name} さま`, `Dear ${name}`);
    add("いつもお世話になっております。", "いつも おせわ に なって おります。", "Thank you, as always, for your support.");
    const company = slots.myCompany.trim();
    const me = slots.me.trim() || "〇〇";
    add(`${company ? `${company}の` : ""}${me}です。`, `${company ? `${company} の ` : ""}${me} です。`, `This is ${me}${company ? ` from ${company}` : ""}.`);
  } else {
    add(`${name}さん`, `${name} さん`, name);
    add("お疲れ様です。", "おつかれさまです。", "Hello (the standard greeting between colleagues).");
    add(`${slots.me.trim() || "〇〇"}です。`, `${slots.me.trim() || "〇〇"} です。`, `It's ${slots.me.trim() || "〇〇"}.`);
  }

  for (const [jp, kana, en] of BODY[situation][audience]) add(jp, kana, en);

  if (audience === "client") add("引き続きよろしくお願いいたします。", "ひきつづき よろしく おねがい いたします。", "I look forward to continuing to work with you.");
  else if (audience === "boss") add("よろしくお願いいたします。", "よろしく おねがい いたします。", "Thank you.");
  else add("よろしくお願いします。", "よろしく おねがい します。", "Thanks.");

  return lines;
}

/** The finished email, ready to paste. */
export function replyText(lines: ReplyLine[], audience: Audience): string {
  // Address lines, then a blank line, then the body, then the closing — the
  // conventional layout of a Japanese business email.
  const headCount = audience === "client" ? lines.findIndex((l) => l.jp.startsWith("いつも")) : 1;
  const head = lines.slice(0, headCount).map((l) => l.jp);
  const body = lines.slice(headCount, -1).map((l) => l.jp);
  const closing = lines.at(-1)?.jp ?? "";
  return [...head, "", ...body, "", closing].join("\n");
}
