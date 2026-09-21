import { describe, it, expect } from "vitest";
import { failureMessage, parseSource, type Source } from "@/lib/thumbnail/sources";
import {
  fileName,
  oEmbedUrl,
  parseOEmbed,
  vimeoVariants,
  youtubeCandidates,
} from "@/lib/thumbnail/providers";
import { aspectLabel, extensionFor, formatBytes } from "@/lib/thumbnail/image";
import { dedupe, type Cover } from "@/lib/thumbnail/grab";

/** The source a successful parse produced, or a failure for the test to read. */
function source(input: string): Source {
  const result = parseSource(input);
  if (!result.ok) throw new Error(`expected a source, got: ${failureMessage(result.failure)}`);
  return result.source;
}

function failure(input: string) {
  const result = parseSource(input);
  if (result.ok) throw new Error(`expected a failure, got ${result.source.provider}/${result.source.id}`);
  return result.failure;
}

/* --------------------------------- YouTube --------------------------------- */

describe("reading a YouTube link", () => {
  const ID = "dQw4w9WgXcQ";

  it("takes every shape of link the share button produces", () => {
    const links = [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://music.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `https://www.youtube.com/v/${ID}`,
    ];
    for (const link of links) {
      const parsed = source(link);
      expect(parsed.provider, link).toBe("youtube");
      expect(parsed.id, link).toBe(ID);
    }
  });

  it("ignores the tracking and timing junk that comes with a share link", () => {
    expect(source(`https://youtu.be/${ID}?si=aBcDeFgH&t=42`).id).toBe(ID);
    expect(source(`https://www.youtube.com/watch?v=${ID}&t=90s&feature=shared`).id).toBe(ID);
  });

  it("copes with no scheme, stray whitespace and a trailing slash", () => {
    expect(source(`  youtu.be/${ID}  `).id).toBe(ID);
    expect(source(`www.youtube.com/watch?v=${ID}`).id).toBe(ID);
    expect(source(`https://www.youtube.com/shorts/${ID}/`).id).toBe(ID);
  });

  it("pulls the link out of a pasted embed snippet", () => {
    const iframe = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${ID}?si=x" title="YouTube video player" allowfullscreen></iframe>`;
    expect(source(iframe).id).toBe(ID);
  });

  it("pulls the link out of a sentence somebody pasted around it", () => {
    expect(source(`look at this https://youtu.be/${ID} it is good`).id).toBe(ID);
  });

  it("accepts a bare video id typed by hand", () => {
    expect(source(ID).provider).toBe("youtube");
    expect(source(ID).id).toBe(ID);
  });

  it("gives a canonical link back for the credit line", () => {
    expect(source(`https://youtu.be/${ID}`).canonical).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });

  it("says what is wrong with a playlist or a channel link", () => {
    expect(failureMessage(failure("https://www.youtube.com/playlist?list=PL123"))).toContain("playlist");
    expect(failureMessage(failure("https://www.youtube.com/@someone"))).toContain("channel");
    expect(failureMessage(failure("https://www.youtube.com/channel/UC123"))).toContain("channel");
  });

  it("rejects something that is not an eleven-character id", () => {
    expect(failureMessage(failure("https://youtu.be/tooshort"))).toContain("11 characters");
    expect(failureMessage(failure("https://www.youtube.com/shorts/way-too-long-for-an-id"))).toContain(
      "11 characters",
    );
  });
});

/* ---------------------------------- Vimeo ---------------------------------- */

describe("reading a Vimeo link", () => {
  it("takes the plain, player, channel and group shapes", () => {
    const links: [string, string][] = [
      ["https://vimeo.com/259411563", "259411563"],
      ["https://player.vimeo.com/video/259411563", "259411563"],
      ["https://vimeo.com/channels/staffpicks/259411563", "259411563"],
      ["https://vimeo.com/groups/motion/videos/259411563", "259411563"],
      ["https://vimeo.com/ondemand/somefilm/259411563", "259411563"],
    ];
    for (const [link, id] of links) {
      const parsed = source(link);
      expect(parsed.provider, link).toBe("vimeo");
      expect(parsed.id, link).toBe(id);
    }
  });

  it("keeps the hash an unlisted video needs", () => {
    expect(source("https://vimeo.com/259411563/a1b2c3d4e5").hash).toBe("a1b2c3d4e5");
    expect(source("https://player.vimeo.com/video/259411563?h=a1b2c3d4e5").hash).toBe("a1b2c3d4e5");
    expect(source("https://vimeo.com/259411563").hash).toBeUndefined();
  });

  it("puts the hash back into the canonical link", () => {
    expect(source("https://vimeo.com/259411563/a1b2c3d4e5").canonical).toBe(
      "https://vimeo.com/259411563/a1b2c3d4e5",
    );
  });

  it("complains when there is no video number", () => {
    expect(failureMessage(failure("https://vimeo.com/someuser"))).toContain("video number");
  });
});

/* ------------------------------ what it refuses ----------------------------- */

describe("links it cannot use", () => {
  it("turns away the platforms that block other sites, by name", () => {
    const cases: [string, string][] = [
      ["https://www.instagram.com/p/Cabc123/", "Instagram"],
      ["https://www.instagram.com/reel/Cabc123/", "Instagram"],
      ["https://www.tiktok.com/@user/video/1234567890", "TikTok"],
      ["https://x.com/someone/status/123", "X"],
      ["https://twitter.com/someone/status/123", "X"],
      ["https://www.facebook.com/watch?v=123", "Facebook"],
      ["https://www.threads.net/@user/post/abc", "Threads"],
    ];
    for (const [link, platform] of cases) {
      const f = failure(link);
      expect(f.kind, link).toBe("unreachable");
      if (f.kind !== "unreachable") continue;
      expect(f.platform).toBe(platform);
      // The reason must explain, not just refuse.
      expect(failureMessage(f).length).toBeGreaterThan(40);
    }
  });

  it("tells an Instagram user it is the platform, not their link", () => {
    const message = failureMessage(failure("https://www.instagram.com/p/Cabc123/"));
    expect(message).toContain("Instagram");
    expect(message).toContain("browser");
  });

  it("knows the difference between empty and wrong", () => {
    expect(failure("").kind).toBe("empty");
    expect(failure("   ").kind).toBe("empty");
    expect(failure("https://example.com/video/1").kind).toBe("unrecognised");
  });

  it("names the two that do work when handed something else", () => {
    expect(failureMessage(failure("https://example.com/video/1"))).toContain("Vimeo");
  });

  it("does not mistake a lookalike host for the real one", () => {
    // youtube.com.evil.test must not be read as YouTube.
    expect(failure("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ").kind).toBe("unrecognised");
    expect(failure("https://notyoutube.com/watch?v=dQw4w9WgXcQ").kind).toBe("unrecognised");
    expect(failure("https://vimeo.com.evil.test/259411563").kind).toBe("unrecognised");
  });

  it("does accept a genuine subdomain", () => {
    expect(source("https://m.youtube.com/watch?v=dQw4w9WgXcQ").provider).toBe("youtube");
  });
});

/* -------------------------------- providers -------------------------------- */

describe("where the covers live", () => {
  it("offers every YouTube size, biggest first", () => {
    const candidates = youtubeCandidates("dQw4w9WgXcQ");
    expect(candidates.map((c) => c.key)).toEqual([
      "maxresdefault",
      "sddefault",
      "hqdefault",
      "mqdefault",
      "default",
    ]);
    expect(candidates[0].url).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
    expect(candidates[0].expected).toEqual({ w: 1280, h: 720 });
  });

  it("flags the sizes that are still 4:3", () => {
    const candidates = youtubeCandidates("dQw4w9WgXcQ");
    const noted = candidates.filter((c) => c.note);
    expect(noted.map((c) => c.key)).toEqual(["sddefault", "hqdefault", "default"]);
    expect(noted[0].note).toContain("black bars");
  });

  it("derives Vimeo's sizes by swapping the size in the path", () => {
    const base = "https://i.vimeocdn.com/video/687867313-abc-d_295x166?region=us";
    const variants = vimeoVariants(base);
    expect(variants).toHaveLength(4);
    expect(variants[0].url).toBe("https://i.vimeocdn.com/video/687867313-abc-d_1920?region=us");
    expect(variants[3].url).toBe("https://i.vimeocdn.com/video/687867313-abc-d_295?region=us");
    // The query has to survive, or the CDN refuses it.
    expect(variants[0].url).toContain("?region=us");
  });

  it("leaves an unfamiliar Vimeo URL exactly as it was given", () => {
    const odd = "https://i.vimeocdn.com/video/plain.jpg";
    expect(vimeoVariants(odd)).toEqual([{ key: "original", label: "Original", url: odd }]);
  });

  it("builds the documented oEmbed request for each provider", () => {
    const yt = new URL(oEmbedUrl(source("https://youtu.be/dQw4w9WgXcQ")));
    expect(yt.origin + yt.pathname).toBe("https://www.youtube.com/oembed");
    expect(yt.searchParams.get("url")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(yt.searchParams.get("format")).toBe("json");

    const vi = new URL(oEmbedUrl(source("https://vimeo.com/259411563")));
    expect(vi.origin + vi.pathname).toBe("https://vimeo.com/api/oembed.json");
    // Asking for a wide one is how the largest cover is obtained.
    expect(vi.searchParams.get("width")).toBe("1920");
  });

  it("reads the fields it needs out of an oEmbed reply, and tolerates a bare one", () => {
    const meta = parseOEmbed({
      title: "A Love Letter to Winter",
      author_name: "The North Face",
      author_url: "https://vimeo.com/thenorthface",
      thumbnail_url: "https://i.vimeocdn.com/video/1-d_295x166",
      duration: 158,
    });
    expect(meta.title).toBe("A Love Letter to Winter");
    expect(meta.author).toBe("The North Face");
    expect(meta.thumbnailUrl).toContain("vimeocdn");

    const empty = parseOEmbed(null);
    expect(empty.title).toBe("");
    expect(empty.thumbnailUrl).toBeUndefined();
  });
});

describe("naming the saved file", () => {
  const yt = () => source("https://youtu.be/dQw4w9WgXcQ");

  it("uses the video title, made safe", () => {
    const meta = { title: "Look! A “Great” Video: Part 2", author: "", authorUrl: "" };
    expect(fileName(yt(), meta, "maxresdefault", "jpg")).toBe("look-a-great-video-part-2-maxresdefault.jpg");
  });

  it("falls back to the id when there is no title", () => {
    expect(fileName(yt(), null, "hqdefault", "png")).toBe("youtube-dqw4w9wgxcq-hqdefault.png");
  });

  it("does not produce an endless name from an endless title", () => {
    const meta = { title: "word ".repeat(80), author: "", authorUrl: "" };
    expect(fileName(yt(), meta, "default", "jpg").length).toBeLessThan(80);
  });

  it("survives a title with nothing usable in it", () => {
    const meta = { title: "。。。", author: "", authorUrl: "" };
    expect(fileName(yt(), meta, "default", "jpg")).toBe("dQw4w9WgXcQ-default.jpg");
  });
});

/* ------------------------------ image helpers ------------------------------ */

describe("image helpers", () => {
  it("names the extension for each format", () => {
    expect(extensionFor("original", new Blob([], { type: "image/jpeg" }))).toBe("jpg");
    expect(extensionFor("original", new Blob([], { type: "image/webp" }))).toBe("webp");
    expect(extensionFor("jpeg", new Blob([]))).toBe("jpg");
    expect(extensionFor("png", new Blob([]))).toBe("png");
    expect(extensionFor("webp", new Blob([]))).toBe("webp");
  });

  it("sizes files readably", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(21011)).toBe("21 KB");
    expect(formatBytes(2_500_000)).toBe("2.4 MB");
  });

  it("recognises the common aspect ratios", () => {
    expect(aspectLabel(1280, 720)).toBe("16:9");
    expect(aspectLabel(480, 360)).toBe("4:3");
    expect(aspectLabel(600, 600)).toBe("square");
    expect(aspectLabel(1080, 1920)).toBe("9:16");
    expect(aspectLabel(1000, 337)).toBe("");
    expect(aspectLabel(0, 0)).toBe("");
  });

  it("drops a cover that is the same picture at the same size", () => {
    const cover = (key: string, w: number, h: number, bytes: number): Cover => ({
      candidate: { key, label: key, url: `https://example.test/${key}` },
      blob: new Blob([]),
      width: w,
      height: h,
      bytes,
    });
    // YouTube serves hq720 and maxresdefault as the same bytes.
    const kept = dedupe([
      cover("maxresdefault", 1280, 720, 65324),
      cover("hq720", 1280, 720, 65324),
      cover("hqdefault", 480, 360, 21011),
    ]);
    expect(kept.map((c) => c.candidate.key)).toEqual(["maxresdefault", "hqdefault"]);
  });
});
