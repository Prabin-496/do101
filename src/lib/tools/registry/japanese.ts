import type { Tool } from "../types";

/**
 * Japanese language tools.
 *
 * The reading, romaji, kanji and typing help all run in the browser and are
 * exact where kana is involved. Translation is the one feature on DO101 that
 * calls an external service, because a translation model cannot be shipped to a
 * page — and every description here says so rather than implying otherwise.
 */
export const JAPANESE_TOOLS: Tool[] = [
  {
    id: "japanese-translator",
    name: "Japanese ⇄ English Translator",
    short: "Translate both ways, with furigana, romaji and typing help.",
    long:
      "Translates as you type, in both directions, with the romaji printed directly under the Japanese the way you would expect. Every word is broken out with its reading above it, its pronunciation below, and what it means — so a sentence full of kanji is still readable if you cannot read kanji yet. Tap any word for its on and kun readings and the exact keys to type it on a Japanese IME.",
    category: "learn",
    route: "/tools/japanese-translator",
    keywords: [
      "japanese to english translator", "english to japanese translator",
      "japanese translation with romaji", "furigana generator", "japanese reading help",
      "how to type japanese", "japanese pronunciation", "kanji reading",
      "free japanese translator", "romaji translation",
    ],
    aliases: ["translate japanese", "what does this say in japanese", "japanese to english"],
    icon: "🇯🇵",
    accent: "cherry",
    browserOnly: false,
    aiInvocable: true,
    input: "text",
    output: "text",
    related: ["romaji-converter", "earth-globe", "notes", "workspace"],
    seoTitle: "Japanese ⇄ English Translator with Romaji & Furigana | DO101",
    seoDescription:
      "Translate English and Japanese both ways, with readings above each word, hiragana, katakana, Hepburn romaji, kanji meanings and keyboard typing help. Free.",
    steps: [
      "Start typing — the translation appears on its own, with romaji underneath.",
      "Read the word-by-word strip: reading on top, the word, how to say it, what it means.",
      "Tap any word for its kanji readings and the keys you would press to type it.",
      "Copy the hiragana, katakana or romaji, or press Hear it to listen.",
    ],
    features: [
      "Translates live as you type, both directions, with no button to press",
      "Romaji printed directly beneath the Japanese, where you expect to find it",
      "Word by word: reading above, pronunciation below, meaning underneath",
      "Handles inflected verbs, so 行きました reads ikimashita rather than i kimashita",
      "Reads は, へ and を as wa, e and o when they are particles",
      "Kanji cards with on and kun readings and what to type for each",
      "Keystrokes for the whole sentence on a Japanese IME",
      "Read aloud using your device's own Japanese voice",
      "Marks which readings are certain and which are approximate",
    ],
    faqs: [
      {
        q: "Is my text sent anywhere?",
        a: "The translation is, and only the translation. Machine translation needs a model far too large to run in a web page, so when you pause typing your text is sent to MyMemory, a free public translation service, directly from your browser. Everything else — the readings, romaji, kanji breakdown and typing guide — runs on your device. Do not paste anything confidential, and switch off \"Translate as I type\" if you would rather send text only when you choose.",
      },
      {
        q: "How accurate is the translation?",
        a: "Good for everyday sentences and unreliable for anything subtle, like any free machine translation. The tool shows the service's own match score so you can see whether a result came from a close match in its translation memory or from raw machine translation. Never submit a machine translation as your own work without checking it.",
      },
      {
        q: "Are the readings always right?",
        a: "Kana readings are exact, because kana map to sounds one-to-one. Words in the bundled vocabulary are reliable. A single kanji outside that vocabulary is shown with its most common standalone reading and marked as approximate, because the same kanji is often read differently inside a compound. Anything unknown is left blank rather than guessed.",
      },
      {
        q: "Why is there no furigana for some words?",
        a: "Because the word is not in the bundled vocabulary. Generating readings for arbitrary Japanese needs a morphological analyser and a dictionary of hundreds of thousands of entries — a multi-megabyte download. Rather than ship that or guess, the tool marks what it does not know.",
      },
      {
        q: "Does translating as I type use up a free quota?",
        a: "It could, so the tool is built not to. It waits for a pause in your typing rather than firing on every keystroke, ignores fragments too short to be meaningful, and reuses any phrase it has already translated — so backspacing and retyping costs nothing. You can also turn live translation off and translate on demand.",
      },
      {
        q: "How do I type Japanese on my keyboard?",
        a: "Add Japanese as an input source — System Settings → Keyboard on macOS, or the Language settings on Windows — then switch to it with Control+Space or Windows+Space. Type the reading in romaji and press space to convert to kanji. The typing guide on this page shows the exact letters for whatever you translated.",
      },
    ],
    featured: true,
  },
  {
    id: "romaji-converter",
    name: "Romaji ⇄ Kana Converter",
    short: "Romaji to hiragana and katakana, and back, exactly.",
    long:
      "Type romaji and get hiragana and katakana, or paste kana and get Hepburn romaji. It handles the parts that trip people up: small tsu for doubled consonants, contracted sounds like きゃ, the long-vowel mark, and syllabic ん. Includes a clickable kana chart and the keystrokes for typing each character.",
    category: "learn",
    route: "/tools/romaji-converter",
    keywords: [
      "romaji to hiragana", "hiragana to romaji", "romaji converter",
      "katakana converter", "romaji to katakana", "kana converter",
      "japanese romanization", "hepburn romaji", "learn hiragana",
    ],
    aliases: ["convert romaji", "hiragana converter", "write my name in katakana"],
    icon: "あ",
    accent: "grape",
    browserOnly: true,
    aiInvocable: true,
    input: "text",
    output: "text",
    related: ["japanese-translator", "case-converter", "notes", "workspace"],
    seoTitle: "Romaji to Hiragana & Katakana Converter — Free & Exact | DO101",
    seoDescription:
      "Convert romaji to hiragana and katakana, or kana back to Hepburn romaji. Handles small tsu, contracted sounds and long vowels. Free, offline, no sign-up.",
    steps: [
      "Type romaji, or paste kana — the direction is worked out for you.",
      "Read the hiragana, katakana and romaji side by side.",
      "Check the keystrokes if you want to type it yourself.",
      "Use the kana chart to build text character by character.",
    ],
    features: [
      "Romaji to hiragana and katakana, and kana back to Hepburn romaji",
      "Handles small tsu, contracted sounds, long vowels and syllabic ん",
      "Accepts the alternative spellings a Japanese IME accepts, such as si for し",
      "A clickable hiragana and katakana chart",
      "Keystrokes for each character on a Japanese IME",
      "Read aloud with your device's Japanese voice",
      "Entirely offline — nothing is sent anywhere",
    ],
    faqs: [
      {
        q: "Which romanisation does it use?",
        a: "Modified Hepburn, the system used on Japanese road signs and passports and taught in most courses. So し is shi rather than si, and つ is tsu rather than tu.",
      },
      {
        q: "Is the conversion exact?",
        a: "Yes, for kana. Kana map to sounds one-to-one, so this is a lookup rather than a judgement. Kanji is a different matter and needs the translator tool, which says where its readings are approximate.",
      },
      {
        q: "Why does typing \"konnichiwa\" give こんにちは and not こんいちは?",
        a: "Because the converter follows the same rule a Japanese IME does: \"nn\" followed by a vowel makes ん and then starts a new syllable with the second n. That is why the word you type every day comes out right.",
      },
      {
        q: "Does it work offline?",
        a: "Yes, completely. The conversion tables ship with the page, so once it has loaded there is nothing to fetch.",
      },
    ],
    featured: true,
  },
];
