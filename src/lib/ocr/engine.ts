"use client";

/**
 * Optical character recognition, entirely in the browser.
 *
 * Tesseract's WebAssembly build and its language model are fetched from a
 * public CDN the first time you run it (roughly 12–15 MB for English) and are
 * then cached by the browser. Recognition itself happens on your device — the
 * image is never uploaded, and DO101 runs no OCR server.
 */

export interface OcrLanguage {
  code: string;
  label: string;
}

/** Kept to scripts Tesseract handles well, so the tool never over-promises. */
export const OCR_LANGUAGES: OcrLanguage[] = [
  { code: "eng", label: "English" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "ita", label: "Italian" },
  { code: "por", label: "Portuguese" },
  { code: "nld", label: "Dutch" },
  { code: "pol", label: "Polish" },
  { code: "tur", label: "Turkish" },
  { code: "rus", label: "Russian" },
  { code: "ukr", label: "Ukrainian" },
  { code: "hin", label: "Hindi" },
  { code: "ara", label: "Arabic" },
  { code: "jpn", label: "Japanese" },
  { code: "kor", label: "Korean" },
  { code: "chi_sim", label: "Chinese (Simplified)" },
  { code: "chi_tra", label: "Chinese (Traditional)" },
];

export interface OcrProgress {
  stage: string;
  progress: number;
}

export interface OcrPageResult {
  label: string;
  text: string;
  /** Tesseract's own 0–100 confidence. Below ~70 usually means a poor scan. */
  confidence: number;
}

export class OcrError extends Error {}

/**
 * Recognises text in one or more images.
 * `sources` may be Blobs, canvases or image URLs — whatever Tesseract accepts.
 */
export async function recognizeImages(
  sources: Array<{ label: string; image: Blob | string }>,
  {
    language = "eng",
    onProgress,
  }: {
    language?: string;
    onProgress?: (info: OcrProgress & { page: number; total: number }) => void;
  } = {},
): Promise<OcrPageResult[]> {
  const { createWorker } = await import("tesseract.js");

  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker(language, 1, {
      logger: (message: { status: string; progress: number }) => {
        onProgress?.({
          stage: message.status,
          progress: message.progress,
          page: 0,
          total: sources.length,
        });
      },
    });
  } catch {
    throw new OcrError(
      "The OCR engine could not be downloaded. It needs a working connection the first time you use it — after that it is cached by your browser.",
    );
  }

  const results: OcrPageResult[] = [];
  try {
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      onProgress?.({ stage: "recognizing", progress: 0, page: i + 1, total: sources.length });
      const { data } = await worker.recognize(source.image);
      results.push({
        label: source.label,
        text: data.text.trim(),
        confidence: Math.round(data.confidence ?? 0),
      });
    }
  } catch {
    throw new OcrError("Recognition failed. Very large images can exhaust the browser's memory.");
  } finally {
    await worker.terminate();
  }

  return results;
}

/** Human label for Tesseract's terse status strings. */
export function describeStage(stage: string): string {
  const map: Record<string, string> = {
    "loading tesseract core": "Downloading the OCR engine…",
    "initializing tesseract": "Starting the OCR engine…",
    "loading language traineddata": "Downloading the language model…",
    "initializing api": "Preparing…",
    "recognizing text": "Reading the text…",
    recognizing: "Reading the text…",
  };
  return map[stage] ?? "Working…";
}
