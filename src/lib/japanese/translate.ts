/**
 * Translation through MyMemory's public API.
 *
 * Everything else on DO101 runs in the browser, but machine translation cannot:
 * it needs a trained model far too large to ship to a page. So this one feature
 * calls an external service, and the interface says so plainly rather than
 * letting the site's usual privacy promise imply otherwise.
 *
 * MyMemory was chosen because it is genuinely free with no key, sends
 * permissive CORS headers so the browser can call it directly (no server of
 * ours in the path, and no cost to run), and returns a match score we can pass
 * on so the reader can judge how much to trust a given result.
 */

export type Direction = "en-ja" | "ja-en";

export interface TranslationResult {
  text: string;
  /** 0–1 confidence reported by the service. */
  match: number;
  /** Alternative translations it also holds for this text. */
  alternatives: string[];
  provider: string;
}

export class TranslationError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "TranslationError";
  }
}

/** The service caps a single request, so long text is split on sentences. */
const MAX_CHARS = 480;

export function splitForTranslation(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CHARS) return trimmed ? [trimmed] : [];

  const chunks: string[] = [];
  let current = "";
  // Split after sentence-ending punctuation in either language.
  for (const piece of trimmed.split(/(?<=[.!?。！？\n])/)) {
    if ((current + piece).length > MAX_CHARS && current) {
      chunks.push(current.trim());
      current = piece;
    } else {
      current += piece;
    }
    // A single sentence longer than the cap still has to be broken somewhere.
    while (current.length > MAX_CHARS) {
      const cut = current.lastIndexOf(" ", MAX_CHARS);
      const at = cut > MAX_CHARS / 2 ? cut : MAX_CHARS;
      chunks.push(current.slice(0, at).trim());
      current = current.slice(at);
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

interface MyMemoryResponse {
  responseData?: { translatedText?: string; match?: number | string };
  responseStatus?: number | string;
  quotaFinished?: boolean;
  responseDetails?: string;
  matches?: Array<{ translation?: string; quality?: string; match?: number }>;
}

async function translateChunk(
  chunk: string,
  direction: Direction,
  signal?: AbortSignal,
): Promise<TranslationResult> {
  const pair = direction === "en-ja" ? "en|ja" : "ja|en";
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${pair}`;

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new TranslationError(
      "Could not reach the translation service. Check your connection and try again.",
      true,
    );
  }

  if (response.status === 429) {
    throw new TranslationError(
      "The free translation service is rate-limiting right now. Wait a minute and try again — everything else on this page keeps working.",
      true,
    );
  }
  if (!response.ok) {
    throw new TranslationError(
      `The translation service returned an error (${response.status}). Try again shortly.`,
      true,
    );
  }

  const data = (await response.json()) as MyMemoryResponse;

  if (data.quotaFinished) {
    throw new TranslationError(
      "The free daily translation quota has been used up. It resets each day; the reading, romaji and typing tools below are unaffected.",
      false,
    );
  }

  const translated = data.responseData?.translatedText;
  if (!translated || /^(?:PLEASE SELECT|INVALID|QUERY LENGTH)/i.test(translated)) {
    throw new TranslationError(
      data.responseDetails || "The translation service could not handle that text.",
      false,
    );
  }

  const alternatives = (data.matches ?? [])
    .map((match) => match.translation)
    .filter((t): t is string => typeof t === "string" && t.trim() !== translated.trim())
    .slice(0, 3);

  return {
    text: decodeEntities(translated),
    match: Number(data.responseData?.match ?? 0) || 0,
    alternatives: [...new Set(alternatives.map(decodeEntities))],
    provider: "MyMemory",
  };
}

/** The API returns HTML entities in some results. */
function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function translate(
  text: string,
  direction: Direction,
  signal?: AbortSignal,
): Promise<TranslationResult> {
  const chunks = splitForTranslation(text);
  if (chunks.length === 0) {
    return { text: "", match: 0, alternatives: [], provider: "MyMemory" };
  }
  if (chunks.length === 1) return translateChunk(chunks[0], direction, signal);

  // Sequential rather than parallel: the free tier rate-limits bursts, and a
  // partial failure halfway through a paragraph is worse than being slower.
  const parts: TranslationResult[] = [];
  for (const chunk of chunks) {
    parts.push(await translateChunk(chunk, direction, signal));
  }

  return {
    text: parts.map((part) => part.text).join(direction === "en-ja" ? "" : " "),
    match: parts.reduce((total, part) => total + part.match, 0) / parts.length,
    alternatives: [],
    provider: "MyMemory",
  };
}

/** How much to trust a result, in words rather than a bare number. */
export function describeMatch(match: number): { label: string; tone: "grass" | "sun" | "fire" } {
  if (match >= 0.85) return { label: "Close match in the translation memory", tone: "grass" };
  if (match >= 0.6) return { label: "Partial match — read it critically", tone: "sun" };
  return { label: "Machine translation only — check it before relying on it", tone: "fire" };
}
