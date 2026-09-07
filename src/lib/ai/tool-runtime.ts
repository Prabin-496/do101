/**
 * The AI tool contract.
 *
 * Every entry here calls exactly the same pure function the visible UI uses,
 * so a result shown in the chat is a result the tool genuinely produced.
 * The assistant may only *choose* a tool; it never authors the output.
 */
import { formatJson, parseJson } from "@/lib/dev/json";
import { encodeBase64, decodeBase64, encodeUrl, decodeUrl } from "@/lib/dev/encoding";
import { generateUuids } from "@/lib/dev/uuid";
import { decodeJwt } from "@/lib/dev/jwt";
import { describeTimestamp } from "@/lib/dev/timestamp";
import { runRegex } from "@/lib/dev/regex";
import { analyzeText } from "@/lib/text/stats";
import { cleanText, DEFAULT_CLEAN_OPTIONS } from "@/lib/text/clean";
import { convertCase, type CaseStyle } from "@/lib/text/case";
import { percentOf, isWhatPercent, percentChange } from "@/lib/calculators/percentage";
import { calculateDiscount } from "@/lib/calculators/discount";
import { calculateBmi } from "@/lib/calculators/bmi";
import { calculateAge } from "@/lib/calculators/age";

export type AiArgs = Record<string, string | number | undefined>;

export interface AiToolResult {
  /** The literal output produced by the tool. */
  output: string;
  /** Optional secondary facts, rendered as a small table. */
  facts?: Array<{ label: string; value: string }>;
  /** Set when the tool could not run; the UI shows this instead of a result. */
  error?: string;
  /** Render the output as monospace. */
  mono?: boolean;
}

export interface AiToolDef {
  /** Matches the id in the tool registry so we can link to the full page. */
  toolId: string;
  name: string;
  /** What the model is told this tool does. */
  description: string;
  /** Argument names and what each one holds. */
  args: Record<string, string>;
  /** Tools needing a file or canvas can only hand the visitor over to the page. */
  kind: "run" | "navigate";
  run?: (args: AiArgs) => Promise<AiToolResult> | AiToolResult;
}

const str = (v: unknown): string => (typeof v === "string" ? v : v === undefined ? "" : String(v));
const num = (v: unknown): number => Number(v);

export const AI_TOOLS: AiToolDef[] = [
  {
    toolId: "json-formatter",
    name: "format_json",
    description: "Format, indent and validate a JSON document.",
    args: { json: "The raw JSON text to format." },
    kind: "run",
    run: ({ json }) => {
      const result = formatJson(str(json), { indent: 2 });
      if (!result.ok) return { output: "", error: `Invalid JSON: ${result.error.message}` };
      return { output: result.output ?? "", mono: true };
    },
  },
  {
    toolId: "json-validator",
    name: "validate_json",
    description: "Check whether a string is valid JSON.",
    args: { json: "The JSON text to check." },
    kind: "run",
    run: ({ json }) => {
      const result = parseJson(str(json));
      return result.ok
        ? { output: "Valid JSON." }
        : { output: "", error: `Invalid JSON: ${result.error.message}` };
    },
  },
  {
    toolId: "base64",
    name: "base64_encode",
    description: "Encode text into Base64.",
    args: { text: "The plain text to encode." },
    kind: "run",
    run: ({ text }) => ({ output: encodeBase64(str(text)), mono: true }),
  },
  {
    toolId: "base64",
    name: "base64_decode",
    description: "Decode a Base64 string back into text.",
    args: { text: "The Base64 string to decode." },
    kind: "run",
    run: ({ text }) => {
      try {
        return { output: decodeBase64(str(text)) };
      } catch {
        return { output: "", error: "That is not valid Base64." };
      }
    },
  },
  {
    toolId: "url-encoder",
    name: "url_encode",
    description: "Percent-encode text for safe use in a URL.",
    args: { text: "The text to encode." },
    kind: "run",
    run: ({ text }) => ({ output: encodeUrl(str(text), "component"), mono: true }),
  },
  {
    toolId: "url-decoder",
    name: "url_decode",
    description: "Decode a percent-encoded URL.",
    args: { text: "The encoded URL." },
    kind: "run",
    run: ({ text }) => {
      try {
        return { output: decodeUrl(str(text)) };
      } catch {
        return { output: "", error: "That URL could not be decoded — check for a stray % sign." };
      }
    },
  },
  {
    toolId: "word-counter",
    name: "count_words",
    description: "Count words, characters, sentences and reading time in a piece of text.",
    args: { text: "The text to analyse." },
    kind: "run",
    run: ({ text }) => {
      const stats = analyzeText(str(text));
      return {
        output: `${stats.words} words`,
        facts: [
          { label: "Words", value: String(stats.words) },
          { label: "Characters", value: String(stats.characters) },
          { label: "Characters (no spaces)", value: String(stats.charactersNoSpaces) },
          { label: "Sentences", value: String(stats.sentences) },
          { label: "Reading time", value: `${Math.max(1, Math.round(stats.readingTimeMinutes))} min` },
        ],
      };
    },
  },
  {
    toolId: "character-counter",
    name: "count_characters",
    description: "Count the characters in a piece of text.",
    args: { text: "The text to measure." },
    kind: "run",
    run: ({ text }) => {
      const stats = analyzeText(str(text));
      return {
        output: `${stats.characters} characters`,
        facts: [
          { label: "With spaces", value: String(stats.characters) },
          { label: "Without spaces", value: String(stats.charactersNoSpaces) },
          { label: "Visible (emoji-safe)", value: String(stats.graphemes) },
        ],
      };
    },
  },
  {
    toolId: "text-cleaner",
    name: "clean_text",
    description: "Tidy messy text: collapse repeated spaces, trim lines and strip invisible characters.",
    args: { text: "The text to clean." },
    kind: "run",
    run: ({ text }) => ({ output: cleanText(str(text), DEFAULT_CLEAN_OPTIONS) }),
  },
  {
    toolId: "case-converter",
    name: "convert_case",
    description: "Convert text between cases.",
    args: {
      text: "The text to convert.",
      style: "One of: sentence, lower, upper, title, camel, pascal, snake, kebab, constant.",
    },
    kind: "run",
    run: ({ text, style }) => ({
      output: convertCase(str(text), (str(style) || "title") as CaseStyle),
    }),
  },
  {
    toolId: "uuid-generator",
    name: "generate_uuid",
    description: "Generate random version-4 UUIDs.",
    args: { count: "How many UUIDs to generate (1–1000)." },
    kind: "run",
    run: ({ count }) => ({
      output: generateUuids(Number.isFinite(num(count)) ? num(count) : 1).join("\n"),
      mono: true,
    }),
  },
  {
    toolId: "jwt-decoder",
    name: "decode_jwt",
    description: "Decode the header and payload of a JSON Web Token. Does NOT verify the signature.",
    args: { token: "The JWT string." },
    kind: "run",
    run: ({ token }) => {
      const result = decodeJwt(str(token));
      if (!result.ok) return { output: "", error: result.error };
      return {
        output: `Header:\n${result.jwt.header.json}\n\nPayload:\n${result.jwt.payload.json}`,
        mono: true,
        facts: [
          {
            label: "Signature verified",
            value: "No — decoding never verifies a signature.",
          },
          ...(result.jwt.expiresAt
            ? [
                {
                  label: "Expires",
                  value: `${new Date(result.jwt.expiresAt).toLocaleString()}${result.jwt.isExpired ? " (expired)" : ""}`,
                },
              ]
            : []),
        ],
      };
    },
  },
  {
    toolId: "timestamp-converter",
    name: "convert_timestamp",
    description: "Convert a Unix timestamp into a readable date.",
    args: { value: "The Unix timestamp, in seconds or milliseconds." },
    kind: "run",
    run: ({ value }) => {
      const info = describeTimestamp(num(value));
      if (!info) return { output: "", error: "That is not a timestamp this converter can read." };
      return {
        output: info.local,
        facts: [
          { label: "UTC", value: info.utc },
          { label: "ISO 8601", value: info.iso },
          { label: "Relative", value: info.relative },
          { label: "Read as", value: info.unit },
        ],
      };
    },
  },
  {
    toolId: "regex-tester",
    name: "test_regex",
    description: "Run a regular expression against a test string and list the matches.",
    args: { pattern: "The regex pattern.", flags: "Regex flags such as gi.", text: "The text to search." },
    kind: "run",
    run: ({ pattern, flags, text }) => {
      const result = runRegex(str(pattern), str(flags) || "g", str(text));
      if (!result.ok) return { output: "", error: result.error };
      if (!result.matches.length) return { output: "No matches." };
      return {
        output: result.matches.map((m, i) => `${i + 1}. "${m.match}" at index ${m.index}`).join("\n"),
        mono: true,
      };
    },
  },
  {
    toolId: "hash-generator",
    name: "hash_text",
    description: "Hash text with SHA-256 (or another SHA algorithm).",
    args: { text: "The text to hash.", algorithm: "SHA-1, SHA-256, SHA-384 or SHA-512." },
    kind: "run",
    run: async ({ text, algorithm }) => {
      const algo = (str(algorithm) || "SHA-256").toUpperCase();
      if (!["SHA-1", "SHA-256", "SHA-384", "SHA-512"].includes(algo)) {
        return { output: "", error: `${algo} is not available in the browser's Web Crypto API.` };
      }
      const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(str(text)));
      return {
        output: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""),
        mono: true,
        facts: [{ label: "Algorithm", value: algo }],
      };
    },
  },
  {
    toolId: "percentage",
    name: "calculate_percentage",
    description:
      "Percentage maths. mode 'of' = what is A% of B; 'isWhatPercent' = A is what percent of B; 'change' = percentage change from A to B.",
    args: { mode: "of | isWhatPercent | change", a: "First number.", b: "Second number." },
    kind: "run",
    run: ({ mode, a, b }) => {
      const A = num(a);
      const B = num(b);
      if (!Number.isFinite(A) || !Number.isFinite(B)) {
        return { output: "", error: "Both values need to be numbers." };
      }
      const result =
        mode === "isWhatPercent"
          ? isWhatPercent(A, B)
          : mode === "change"
            ? percentChange(A, B)
            : percentOf(A, B);
      if (!result) return { output: "", error: "That calculation needs a non-zero second number." };
      return {
        output: result.explanation,
        facts: [{ label: "Formula", value: result.formula }],
      };
    },
  },
  {
    toolId: "discount",
    name: "calculate_discount",
    description: "Work out a sale price and the amount saved.",
    args: { price: "Original price.", percent: "Discount percentage." },
    kind: "run",
    run: ({ price, percent }) => {
      const result = calculateDiscount({ price: num(price), percent: num(percent) });
      if (!result) return { output: "", error: "Enter a price and a discount percentage." };
      return {
        output: `Final price ${result.finalPrice.toFixed(2)} — you save ${result.saved.toFixed(2)}.`,
        facts: [{ label: "Discount applied", value: `${result.effectivePercent.toFixed(1)}%` }],
      };
    },
  },
  {
    toolId: "bmi",
    name: "calculate_bmi",
    description: "Calculate Body Mass Index from metric height and weight.",
    args: { weightKg: "Weight in kilograms.", heightCm: "Height in centimetres." },
    kind: "run",
    run: ({ weightKg, heightCm }) => {
      const result = calculateBmi(num(weightKg), num(heightCm));
      if (!result) return { output: "", error: "Enter a height and weight above zero." };
      return {
        output: `BMI ${result.bmi.toFixed(1)} — ${result.category}.`,
        facts: [
          {
            label: "Note",
            value: "BMI is a rough adult screening number, not medical advice.",
          },
        ],
      };
    },
  },
  {
    toolId: "age",
    name: "calculate_age",
    description: "Calculate an exact age from a date of birth.",
    args: { birthDate: "Date of birth in YYYY-MM-DD format." },
    kind: "run",
    run: ({ birthDate }) => {
      const result = calculateAge(new Date(`${str(birthDate)}T00:00:00`));
      if (!result) return { output: "", error: "Give a date of birth in the past, as YYYY-MM-DD." };
      return {
        output: `${result.years} years, ${result.months} months and ${result.days} days old.`,
        facts: [
          { label: "Total days", value: result.totalDays.toLocaleString() },
          { label: "Next birthday", value: `in ${result.nextBirthdayInDays} days` },
        ],
      };
    },
  },
  {
    toolId: "qr-generator",
    name: "open_qr_generator",
    description: "Open the QR code generator, which draws the code in the page.",
    args: { text: "What the QR code should contain." },
    kind: "navigate",
  },
  {
    toolId: "image-compressor",
    name: "open_image_compressor",
    description: "Open the image compressor. Images are chosen and processed on the visitor's device.",
    args: {},
    kind: "navigate",
  },
  {
    toolId: "image-resizer",
    name: "open_image_resizer",
    description: "Open the image resizer.",
    args: {},
    kind: "navigate",
  },
  {
    toolId: "typing-test",
    name: "open_typing_test",
    description: "Open the typing speed test.",
    args: {},
    kind: "navigate",
  },
];

export const AI_TOOL_MAP: Record<string, AiToolDef> = Object.fromEntries(
  AI_TOOLS.map((t) => [t.name, t]),
);

export async function executeAiTool(name: string, args: AiArgs): Promise<AiToolResult> {
  const tool = AI_TOOL_MAP[name];
  if (!tool) return { output: "", error: `There is no DO101 tool called "${name}".` };
  if (tool.kind === "navigate" || !tool.run) {
    return { output: "", error: "This tool needs the full page — open it to continue." };
  }
  try {
    return await tool.run(args);
  } catch (err) {
    return {
      output: "",
      error: err instanceof Error ? err.message : "The tool failed to run.",
    };
  }
}
