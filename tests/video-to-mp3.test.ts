import { describe, it, expect } from "vitest";
import {
  encodeMp3,
  EncodeCancelled,
  estimateBytes,
  floatToInt16,
  formatTime,
  mixToMono,
  mp3Name,
  parseTime,
  resolveTrim,
} from "@/lib/audio/mp3";

const noPause = async () => {};

function sine(seconds: number, rate = 44100, hz = 440): Float32Array {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / rate);
  return out;
}

const byteLength = (parts: Uint8Array[]) => parts.reduce((n, p) => n + p.length, 0);

describe("time input", () => {
  it("reads seconds, minutes and hours", () => {
    expect(parseTime("83")).toBe(83);
    expect(parseTime("1:23")).toBe(83);
    expect(parseTime("01:02:03")).toBe(3723);
    expect(parseTime("0:01.5")).toBe(1.5);
  });

  it("treats blank as unset and nonsense as invalid", () => {
    expect(parseTime("  ")).toBeNull();
    expect(Number.isNaN(parseTime("abc"))).toBe(true);
    expect(Number.isNaN(parseTime("1:75"))).toBe(true);
    expect(Number.isNaN(parseTime("-5"))).toBe(true);
  });

  it("formats durations the way a player shows them", () => {
    expect(formatTime(83.9)).toBe("1:23");
    expect(formatTime(3723)).toBe("1:02:03");
    expect(formatTime(5)).toBe("0:05");
  });
});

describe("trimming", () => {
  it("defaults to the whole file", () => {
    expect(resolveTrim("", "", 120)).toEqual({ ok: true, start: 0, end: 120 });
  });

  it("clamps an end past the duration", () => {
    expect(resolveTrim("0:10", "9:00", 120)).toEqual({ ok: true, start: 10, end: 120 });
  });

  it("rejects a start past the end, or an end before the start", () => {
    expect(resolveTrim("3:00", "", 120).ok).toBe(false);
    expect(resolveTrim("1:00", "0:30", 120).ok).toBe(false);
    expect(resolveTrim("x", "", 120).ok).toBe(false);
  });
});

describe("helpers", () => {
  it("names the output after the input", () => {
    expect(mp3Name("Holiday clip.final.MOV")).toBe("Holiday clip.final.mp3");
    expect(mp3Name("lecture")).toBe("lecture.mp3");
    expect(mp3Name(".mp4")).toBe("audio.mp3");
  });

  it("clips and scales samples to 16-bit", () => {
    expect([...floatToInt16(new Float32Array([0, 1, -1, 2, -2]))]).toEqual([0, 32767, -32768, 32767, -32768]);
  });

  it("averages channels into mono", () => {
    const mono = mixToMono([new Float32Array([1, 0]), new Float32Array([0, 0.5])]);
    expect([...mono]).toEqual([0.5, 0.25]);
  });

  it("estimates constant-bitrate size", () => {
    expect(estimateBytes(60, 128)).toBe(960000);
  });
});

describe("MP3 encoding", () => {
  it("produces real MP3 frames of about the expected size", async () => {
    const tone = sine(3);
    const parts = await encodeMp3({ channels: [tone, tone], sampleRate: 44100, kbps: 128, mono: false, pause: noPause });
    const bytes = new Uint8Array(byteLength(parts));
    let at = 0;
    for (const p of parts) {
      bytes.set(p, at);
      at += p.length;
    }
    // Every MP3 frame starts with an 11-bit sync word.
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1] & 0xe0).toBe(0xe0);
    const expected = estimateBytes(3, 128);
    expect(bytes.length).toBeGreaterThan(expected * 0.9);
    expect(bytes.length).toBeLessThan(expected * 1.15);
  });

  it("encodes only the trimmed section", async () => {
    const tone = sine(10);
    const whole = await encodeMp3({ channels: [tone], sampleRate: 44100, kbps: 128, mono: true, pause: noPause });
    const part = await encodeMp3({
      channels: [tone],
      sampleRate: 44100,
      kbps: 128,
      mono: true,
      start: 2,
      end: 4,
      pause: noPause,
    });
    expect(byteLength(part) / byteLength(whole)).toBeGreaterThan(0.15);
    expect(byteLength(part) / byteLength(whole)).toBeLessThan(0.25);
  });

  it("reports progress up to 1 and can be cancelled", async () => {
    const tone = sine(20);
    const seen: number[] = [];
    await encodeMp3({
      channels: [tone],
      sampleRate: 44100,
      kbps: 128,
      mono: true,
      onProgress: (f) => seen.push(f),
      pause: noPause,
    });
    expect(seen.at(-1)).toBe(1);
    expect(seen.every((f, i) => i === 0 || f >= seen[i - 1])).toBe(true);

    await expect(
      encodeMp3({ channels: [tone], sampleRate: 44100, kbps: 128, mono: true, cancelled: () => true, pause: noPause }),
    ).rejects.toBeInstanceOf(EncodeCancelled);
  });
});
