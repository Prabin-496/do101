import { WORDS, WORD_MAP } from "./dictionary";

/**
 * Politeness register.
 *
 * Machine translation returns whatever register happens to sit in its
 * translation memory, which for English input is often the plain form — 行く
 * rather than 行きます. That is fine between friends and wrong in almost every
 * situation a learner is actually writing for: an email, a form, a shop, a
 * first meeting.
 *
 * This detects which register came back and, where it can do so confidently,
 * offers the polite (ですます) form. It converts non-past endings and the
 * copula, and says so plainly when a sentence is past-tense or otherwise
 * beyond what it can rewrite, rather than producing something wrong.
 */

export type Register = "polite" | "plain" | "unknown";

export interface Sentence {
  text: string;
  register: Register;
  /** The polite rewrite, or null when none could be made confidently. */
  polite: string | null;
}

export interface PolitenessReport {
  /** The register of the text as a whole. */
  register: Register;
  sentences: Sentence[];
  /** The whole text in polite form, or null when nothing could be changed. */
  polite: string | null;
  /** True when at least one sentence is plain but could not be rewritten. */
  partial: boolean;
}

/** Endings that make a sentence unambiguously polite. */
const POLITE_MARKERS = [
  "です", "ます", "ました", "ません", "でした", "ましょう", "ませんでした",
  "ください", "ございます", "でしょう",
];

/**
 * Ichidan verbs, which drop る rather than shifting it.
 *
 * 見る is ichidan (見ます) but 帰る is godan (帰ります), and both end in いる or
 * える — the ending alone cannot tell them apart, so the ichidan ones are
 * listed.
 */
const ICHIDAN = new Set([
  "見る", "食べる", "起きる", "寝る", "教える", "覚える", "考える", "答える",
  "決める", "集める", "変える", "増える", "借りる", "開ける", "閉める",
  "建てる", "生きる", "落ちる", "疲れる", "忘れる", "出る", "続ける",
  "見つける", "始める", "与える", "受ける", "認める", "求める", "越える",
  "超える", "過ぎる", "比べる", "調べる", "確かめる", "伝える", "負ける",
  "慣れる", "捕まえる", "下りる", "着る", "いる", "できる", "上げる",
  "浴びる", "降りる",
]);

/** Godan stem shift: the final kana moves from the う row to the い row. */
const GODAN_STEM: Record<string, string> = {
  う: "い", く: "き", ぐ: "ぎ", す: "し", つ: "ち",
  ぬ: "に", ぶ: "び", む: "み", る: "り",
};

/** Verbs in the bundled vocabulary, longest first. */
const VERBS: string[] = WORDS.filter((entry) => /[うくぐすつぬぶむる]$/.test(entry.word))
  .map((entry) => entry.word)
  .sort((a, b) => b.length - a.length);

/** i-adjectives, which take です directly. */
const I_ADJECTIVES: string[] = WORDS.filter(
  (entry) => entry.word.endsWith("い") && entry.reading.endsWith("い") && entry.word.length > 1,
)
  .map((entry) => entry.word)
  .sort((a, b) => b.length - a.length);

/** The polite form of a verb given in dictionary form. */
export function toMasuForm(verb: string): string | null {
  if (verb === "する") return "します";
  if (verb === "来る") return "来ます";
  if (verb === "くる") return "きます";
  if (ICHIDAN.has(verb)) return `${verb.slice(0, -1)}ます`;
  const last = verb[verb.length - 1];
  const stem = GODAN_STEM[last];
  if (!stem) return null;
  return `${verb.slice(0, -1)}${stem}ます`;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?\n])/)
    .map((part) => part)
    .filter((part) => part.trim() !== "");
}

function classify(sentence: string): Register {
  const body = sentence.replace(/[。！？!?\s]+$/u, "");
  if (!body) return "unknown";
  if (POLITE_MARKERS.some((marker) => body.endsWith(marker))) return "polite";

  // Plain copula, plain negative, or a bare dictionary-form verb at the end.
  if (/(?:だ|である|じゃない|ではない|じゃなかった|ではなかった)$/.test(body)) return "plain";
  if (/(?:ない|なかった)$/.test(body)) return "plain";
  if (VERBS.some((verb) => body.endsWith(verb))) return "plain";
  if (/[うくぐすつぬぶむる]$/.test(body) && body.length > 1) return "plain";
  if (I_ADJECTIVES.some((adjective) => body.endsWith(adjective))) return "plain";
  return "unknown";
}

/** Rewrites one sentence into polite form, or returns null if it cannot. */
function politeSentence(sentence: string): string | null {
  const trailing = /[。！？!?\s]*$/u.exec(sentence)?.[0] ?? "";
  const body = sentence.slice(0, sentence.length - trailing.length);
  if (!body) return null;

  // Copula and negatives first, since they are unambiguous.
  const copula: Array<[RegExp, string]> = [
    [/である$/, "です"],
    [/ではなかった$/, "ではありませんでした"],
    [/じゃなかった$/, "ではありませんでした"],
    [/ではない$/, "ではありません"],
    [/じゃない$/, "ではありません"],
    [/だった$/, "でした"],
    [/だ$/, "です"],
  ];
  for (const [pattern, replacement] of copula) {
    if (pattern.test(body)) return body.replace(pattern, replacement) + trailing;
  }

  // A verb in dictionary form at the end of the sentence.
  for (const verb of VERBS) {
    if (!body.endsWith(verb)) continue;
    const masu = toMasuForm(verb);
    if (!masu) continue;
    return body.slice(0, body.length - verb.length) + masu + trailing;
  }

  // An i-adjective simply takes です.
  for (const adjective of I_ADJECTIVES) {
    if (body.endsWith(adjective)) return `${body}です${trailing}`;
  }

  // A noun on its own also takes です.
  if (WORD_MAP.has(body)) return `${body}です${trailing}`;

  return null;
}

export function checkPoliteness(text: string): PolitenessReport {
  const parts = splitSentences(text);
  if (parts.length === 0) {
    return { register: "unknown", sentences: [], polite: null, partial: false };
  }

  const sentences: Sentence[] = parts.map((part) => {
    const register = classify(part);
    return {
      text: part,
      register,
      polite: register === "plain" ? politeSentence(part) : null,
    };
  });

  const anyPlain = sentences.some((s) => s.register === "plain");
  const anyPolite = sentences.some((s) => s.register === "polite");
  const register: Register = anyPlain ? "plain" : anyPolite ? "polite" : "unknown";

  const rewrote = sentences.some((s) => s.polite);
  const polite = rewrote
    ? sentences.map((s) => s.polite ?? s.text).join("")
    : null;

  return {
    register,
    sentences,
    polite,
    partial: anyPlain && sentences.some((s) => s.register === "plain" && !s.polite),
  };
}
