/**
 * Video to MP3: the parts that do not need a browser.
 *
 * Decoding happens in the page with the browser's own decoders (see
 * `decodeAudioFile`); everything after that — trimming, down-mixing and MP3
 * encoding with lamejs — is plain arithmetic on sample arrays, kept here so it
 * can be tested without a DOM.
 */

export const BITRATES = [128, 192, 256, 320] as const;
export type Bitrate = (typeof BITRATES)[number];
export const DEFAULT_BITRATE: Bitrate = 192;

/** MP3 frames hold 1152 samples; encoding in multiples of that avoids padding. */
const FRAME = 1152;
/** Samples handed to the encoder between pauses that let the page repaint. */
const CHUNK = FRAME * 200;

/** The sample rate audio is decoded to. 44.1 kHz is what every MP3 player expects. */
export const TARGET_SAMPLE_RATE = 44100;

/** Past this, a browser tab is likely to run out of memory holding the audio. */
export const WARN_BYTES = 1024 * 1024 * 1024;
/** Larger than an ArrayBuffer can reliably be in current browsers. */
export const MAX_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Reads "83", "1:23", "01:02:03" or "1:23.5" as seconds.
 * Blank means "not set" and returns null; anything unreadable returns NaN.
 */
export function parseTime(input: string): number | null {
  const text = input.trim();
  if (!text) return null;
  if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(text)) return NaN;
  const parts = text.split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return NaN;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** 83.4 → "1:23", 3723 → "1:02:03". */
export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export type TrimResult =
  | { ok: true; start: number; end: number }
  | { ok: false; error: string };

/** Checks a trim against the real duration and fills in the blanks. */
export function resolveTrim(start: string, end: string, duration: number): TrimResult {
  const from = parseTime(start);
  const to = parseTime(end);
  if (Number.isNaN(from)) return { ok: false, error: "The start time should look like 1:23." };
  if (Number.isNaN(to)) return { ok: false, error: "The end time should look like 4:56." };
  const s = from ?? 0;
  const e = to === null ? duration : Math.min(to, duration);
  if (s >= duration) {
    return { ok: false, error: `The start is past the end of the audio, which is ${formatTime(duration)} long.` };
  }
  if (e <= s) return { ok: false, error: "The end time has to come after the start time." };
  return { ok: true, start: s, end: e };
}

/** Roughly how big the MP3 will be. Constant bitrate makes this close to exact. */
export function estimateBytes(seconds: number, kbps: number): number {
  return Math.round((seconds * kbps * 1000) / 8);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** "Holiday clip.final.MOV" → "Holiday clip.final.mp3". */
export function mp3Name(fileName: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, "").trim() || "audio";
  return `${base}.mp3`;
}

/** Web Audio's -1…1 floats to the 16-bit integers the encoder takes. */
export function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Averages every channel into one. Mono halves the file for speech. */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const length = channels[0].length;
  const out = new Float32Array(length);
  for (const channel of channels) {
    for (let i = 0; i < length; i++) out[i] += channel[i];
  }
  const n = channels.length;
  for (let i = 0; i < length; i++) out[i] /= n;
  return out;
}

export interface EncodeOptions {
  /** One or two channels of samples at `sampleRate`. More are mixed down. */
  channels: Float32Array[];
  sampleRate: number;
  kbps: number;
  mono: boolean;
  /** Seconds. Defaults to the whole thing. */
  start?: number;
  end?: number;
  /** 0…1, called between chunks. */
  onProgress?: (fraction: number) => void;
  /** Checked between chunks; return true to stop. */
  cancelled?: () => boolean;
  /** Lets the page breathe between chunks. Tests pass a no-op. */
  pause?: () => Promise<void>;
}

export class EncodeCancelled extends Error {
  constructor() {
    super("Cancelled");
    this.name = "EncodeCancelled";
  }
}

const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Encodes samples to MP3 in chunks, pausing between them so a long file does
 * not freeze the page. Returns the MP3 as a list of byte arrays for a Blob.
 */
export async function encodeMp3({
  channels,
  sampleRate,
  kbps,
  mono,
  start = 0,
  end,
  onProgress,
  cancelled,
  pause = breathe,
}: EncodeOptions): Promise<Uint8Array[]> {
  if (!channels.length || !channels[0].length) throw new Error("There is no audio to encode.");
  const { Mp3Encoder } = await import("@breezystack/lamejs");

  const total = channels[0].length;
  const from = Math.max(0, Math.min(total, Math.floor(start * sampleRate)));
  const to = Math.max(from, Math.min(total, end === undefined ? total : Math.floor(end * sampleRate)));
  const trimmed = channels.map((c) => c.subarray(from, to));

  // Two channels in, two out; anything else is folded into mono or a pair.
  const sources = mono
    ? [mixToMono(trimmed)]
    : trimmed.length === 1
      ? [trimmed[0]]
      : trimmed.length === 2
        ? trimmed
        : [mixToMono(trimmed.filter((_, i) => i % 2 === 0)), mixToMono(trimmed.filter((_, i) => i % 2 === 1))];

  const encoder = new Mp3Encoder(sources.length, sampleRate, kbps);
  const parts: Uint8Array[] = [];
  const length = sources[0].length;

  for (let offset = 0; offset < length; offset += CHUNK) {
    if (cancelled?.()) throw new EncodeCancelled();
    const left = floatToInt16(sources[0].subarray(offset, offset + CHUNK));
    const right = sources[1] ? floatToInt16(sources[1].subarray(offset, offset + CHUNK)) : undefined;
    const bytes = encoder.encodeBuffer(left, right);
    if (bytes.length) parts.push(new Uint8Array(bytes));
    onProgress?.(Math.min(1, (offset + CHUNK) / length));
    await pause();
  }

  const tail = encoder.flush();
  if (tail.length) parts.push(new Uint8Array(tail));
  onProgress?.(1);
  return parts;
}

/** What the browser could make of a file, in words a person can act on. */
export function describeDecodeError(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["avi", "wmv", "flv", "3gp", "mkv"].includes(ext)) {
    return `Your browser cannot read the audio in this .${ext} file. Chrome and Edge handle the most formats — try one of them, or convert the video to MP4 first.`;
  }
  return "This file has no audio track, or its audio uses a codec your browser cannot decode. MP4, MOV, M4A, WebM, MP3, WAV and OGG work in every current browser.";
}
