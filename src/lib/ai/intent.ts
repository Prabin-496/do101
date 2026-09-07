import type { AiArgs } from "./tool-runtime";

export interface Plan {
  tool: string;
  args: AiArgs;
  /** A short, honest sentence describing what is about to run. */
  message: string;
  /** How the plan was produced, so the UI can be transparent about it. */
  source: "rules" | "model";
}

/**
 * Deterministic intent routing.
 *
 * This runs with no API key and no network call, which is why DO101 AI keeps
 * working when the model provider is not configured. The model, when enabled,
 * only handles the requests these rules cannot confidently place.
 */
const RULES: Array<{
  test: RegExp;
  build: (m: RegExpMatchArray, input: string) => Plan | null;
}> = [
  {
    test: /^\s*(?:what(?:'s| is)\s+)?(-?\d+(?:\.\d+)?)\s*%\s*(?:of)\s*(-?\d+(?:\.\d+)?)/i,
    build: (m) => ({
      tool: "calculate_percentage",
      args: { mode: "of", a: m[1], b: m[2] },
      message: `Calculating ${m[1]}% of ${m[2]} with the Percentage Calculator.`,
      source: "rules",
    }),
  },
  {
    test: /(-?\d+(?:\.\d+)?)\s*(?:is\s+what\s*%|is\s+what\s+percent(?:age)?)\s*(?:of)\s*(-?\d+(?:\.\d+)?)/i,
    build: (m) => ({
      tool: "calculate_percentage",
      args: { mode: "isWhatPercent", a: m[1], b: m[2] },
      message: `Working out what percentage ${m[1]} is of ${m[2]}.`,
      source: "rules",
    }),
  },
  {
    test: /(-?\d+(?:\.\d+)?)\s*%\s*off\s*(?:of\s*)?\$?(-?\d+(?:\.\d+)?)/i,
    build: (m) => ({
      tool: "calculate_discount",
      args: { price: m[2], percent: m[1] },
      message: `Taking ${m[1]}% off ${m[2]} with the Discount Calculator.`,
      source: "rules",
    }),
  },
  {
    test: /\b(?:born|birth(?:day|date)?|dob)\b[^0-9]*(\d{4}-\d{2}-\d{2})/i,
    build: (m) => ({
      tool: "calculate_age",
      args: { birthDate: m[1] },
      message: `Working out the exact age for ${m[1]}.`,
      source: "rules",
    }),
  },
  {
    test: /\b(?:format|beautify|prettify|pretty[- ]print|indent|make\s+.*readable)\b.*\bjson\b|\bjson\b.*\b(?:format|beautify|readable|pretty)\b/i,
    build: (_m, input) => {
      const json = extractPayload(input, /[[{][\s\S]*[\]}]/);
      if (!json) return null;
      return {
        tool: "format_json",
        args: { json },
        message: "Formatting it with the JSON Formatter.",
        source: "rules",
      };
    },
  },
  {
    test: /\b(?:validate|check|is\s+this\s+valid)\b.*\bjson\b/i,
    build: (_m, input) => {
      const json = extractPayload(input, /[[{][\s\S]*[\]}]/);
      if (!json) return null;
      return {
        tool: "validate_json",
        args: { json },
        message: "Checking it with the JSON Validator.",
        source: "rules",
      };
    },
  },
  {
    test: /\bdecode\b.*\b(?:jwt|json web token|token)\b|\bjwt\b.*\bdecode\b/i,
    build: (_m, input) => {
      const token = input.match(/[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/)?.[0];
      if (!token) return null;
      return {
        tool: "decode_jwt",
        args: { token },
        message: "Decoding it with the JWT Decoder. This does not verify the signature.",
        source: "rules",
      };
    },
  },
  {
    test: /\bdecode\b.*\bbase\s?64\b|\bbase\s?64\b.*\bdecode\b/i,
    build: (_m, input) => {
      const payload = extractQuoted(input) ?? input.match(/[A-Za-z0-9+/=_-]{8,}={0,2}/)?.[0];
      if (!payload) return null;
      return {
        tool: "base64_decode",
        args: { text: payload },
        message: "Decoding it with the Base64 tool.",
        source: "rules",
      };
    },
  },
  {
    test: /\bencode\b.*\bbase\s?64\b|\bbase\s?64\b.*\bencode\b|\bto base\s?64\b/i,
    build: (_m, input) => {
      const payload = extractQuoted(input) ?? stripCommand(input);
      if (!payload) return null;
      return {
        tool: "base64_encode",
        args: { text: payload },
        message: "Encoding it with the Base64 tool.",
        source: "rules",
      };
    },
  },
  {
    test: /\b(?:url\s*decode|decode\s+(?:this\s+)?url|percent\s*decode)\b/i,
    build: (_m, input) => {
      const payload = extractQuoted(input) ?? input.match(/\S*%[0-9A-Fa-f]{2}\S*/)?.[0];
      if (!payload) return null;
      return {
        tool: "url_decode",
        args: { text: payload },
        message: "Decoding it with the URL Decoder.",
        source: "rules",
      };
    },
  },
  {
    test: /\b(?:url\s*encode|encode\s+(?:this\s+)?(?:for\s+a\s+)?url|percent\s*encode)\b/i,
    build: (_m, input) => {
      const payload = extractQuoted(input) ?? stripCommand(input);
      if (!payload) return null;
      return {
        tool: "url_encode",
        args: { text: payload },
        message: "Encoding it with the URL Encoder.",
        source: "rules",
      };
    },
  },
  {
    test: /\b(?:count|how many)\b.*\bwords?\b/i,
    build: (_m, input) => {
      const payload = extractQuoted(input) ?? stripCommand(input);
      if (!payload) return null;
      return {
        tool: "count_words",
        args: { text: payload },
        message: "Counting it with the Word Counter.",
        source: "rules",
      };
    },
  },
  {
    test: /\b(?:count|how many)\b.*\b(?:characters?|letters?|chars?)\b/i,
    build: (_m, input) => {
      const payload = extractQuoted(input) ?? stripCommand(input);
      if (!payload) return null;
      return {
        tool: "count_characters",
        args: { text: payload },
        message: "Counting it with the Character Counter.",
        source: "rules",
      };
    },
  },
  {
    test: /\b(?:sha-?(1|256|384|512)|hash)\b/i,
    build: (m, input) => {
      const payload = extractQuoted(input) ?? stripCommand(input);
      if (!payload) return null;
      return {
        tool: "hash_text",
        args: { text: payload, algorithm: m[1] ? `SHA-${m[1]}` : "SHA-256" },
        message: `Hashing it with ${m[1] ? `SHA-${m[1]}` : "SHA-256"}.`,
        source: "rules",
      };
    },
  },
  {
    test: /\b(?:uuids?|guids?)\b/i,
    build: (_m, input) => {
      // The count can sit either side of the noun: "5 uuids" or "uuid x5".
      const count = input.match(/(\d{1,4})\s*(?:uuids?|guids?)|(?:uuids?|guids?)\D{0,8}(\d{1,4})/i);
      const n = count?.[1] ?? count?.[2] ?? "1";
      return {
        tool: "generate_uuid",
        args: { count: n },
        message: `Generating ${n === "1" ? "one UUID" : `${n} UUIDs`}.`,
        source: "rules",
      };
    },
  },
  {
    test: /\b(?:timestamp|epoch|unix\s*time)\b[^0-9]*(\d{9,14})|\b(\d{9,14})\b.*\b(?:timestamp|epoch)\b/i,
    build: (m) => ({
      tool: "convert_timestamp",
      args: { value: m[1] ?? m[2] },
      message: "Converting it with the Unix Timestamp Converter.",
      source: "rules",
    }),
  },
  {
    test: /\bbmi\b/i,
    build: (_m, input) => {
      const kg = input.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)/i)?.[1];
      const cm = input.match(/(\d+(?:\.\d+)?)\s*(?:cm|centimet)/i)?.[1];
      if (!kg || !cm) return null;
      return {
        tool: "calculate_bmi",
        args: { weightKg: kg, heightCm: cm },
        message: "Calculating BMI with the BMI Calculator.",
        source: "rules",
      };
    },
  },
  {
    test: /\b(?:uppercase|lowercase|title case|camel\s*case|snake\s*case|kebab\s*case|pascal\s*case|sentence case)\b/i,
    build: (m, input) => {
      const style = m[0]
        .toLowerCase()
        .replace(/\s+case/, "")
        .replace("uppercase", "upper")
        .replace("lowercase", "lower")
        .trim();
      const payload = extractQuoted(input) ?? stripCommand(input);
      if (!payload) return null;
      return {
        tool: "convert_case",
        args: { text: payload, style },
        message: `Converting it to ${m[0]} with the Case Converter.`,
        source: "rules",
      };
    },
  },
  {
    test: /\b(?:qr|qr\s*code)\b/i,
    build: (_m, input) => ({
      tool: "open_qr_generator",
      args: { text: input.match(/https?:\/\/\S+/)?.[0] ?? "" },
      message: "The QR Generator draws the code in the page — opening it for you.",
      source: "rules",
    }),
  },
  {
    test: /\b(?:compress|shrink|reduce)\b.*\b(?:image|photo|picture|jpe?g|png)\b/i,
    build: () => ({
      tool: "open_image_compressor",
      args: {},
      message:
        "Image compression happens on your own device, so I cannot do it here — opening the Image Compressor.",
      source: "rules",
    }),
  },
  {
    test: /\bresize\b.*\b(?:image|photo|picture)\b/i,
    build: () => ({
      tool: "open_image_resizer",
      args: {},
      message: "Opening the Image Resizer — pick your file there and it stays on your device.",
      source: "rules",
    }),
  },
  {
    test: /\btyping\s*(?:speed|test|wpm)\b|\bwpm\b/i,
    build: () => ({
      tool: "open_typing_test",
      args: {},
      message: "Opening the Typing Speed Test.",
      source: "rules",
    }),
  },
];

function extractQuoted(input: string): string | null {
  const quoted = input.match(/["“']([\s\S]{2,})["”']/);
  return quoted ? quoted[1].trim() : null;
}

function extractPayload(input: string, pattern: RegExp): string | null {
  const match = input.match(pattern);
  return match ? match[0] : null;
}

/** Removes the instruction half of a sentence, leaving the payload. */
function stripCommand(input: string): string | null {
  const colon = input.indexOf(":");
  if (colon >= 0 && colon < input.length - 2) return input.slice(colon + 1).trim();
  const newline = input.indexOf("\n");
  if (newline >= 0 && newline < input.length - 2) return input.slice(newline + 1).trim();
  const cleaned = input
    .replace(
      /^\s*(?:please\s+)?(?:can you\s+)?(?:count|encode|decode|hash|convert|make|turn|change)\b[\s\S]{0,40}?\b(?:of|in|for|to|this|the following|following|it)\b\s*/i,
      "",
    )
    .trim();
  return cleaned && cleaned !== input.trim() ? cleaned : null;
}

/** Returns a plan when the request is unambiguous, otherwise null. */
export function planFromRules(input: string): Plan | null {
  for (const rule of RULES) {
    const match = input.match(rule.test);
    if (!match) continue;
    const plan = rule.build(match, input);
    if (plan) return plan;
  }
  return null;
}
