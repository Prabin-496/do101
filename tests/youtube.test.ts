import { describe, it, expect } from "vitest";
import { isVideoId, parseStart, parseYouTubeUrl, watchUrl } from "@/lib/youtube/url";
import {
  availableContainers,
  defaultOption,
  heightLabel,
  isSilent,
  optionLabel,
  optionsFor,
  suggestedFilename,
  type MediaOption,
} from "@/lib/youtube/formats";
import { parseOEmbed } from "@/lib/youtube/oembed";

const ID = "dQw4w9WgXcQ";

describe("reading a YouTube link", () => {
  it("accepts the standard watch link", () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}`)).toMatchObject({
      videoId: ID,
      kind: "video",
    });
  });

  it("accepts every host people paste from", () => {
    for (const url of [
      `https://youtu.be/${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://music.youtube.com/watch?v=${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
      `http://youtube.com/watch?v=${ID}`,
    ]) {
      expect(parseYouTubeUrl(url)?.videoId, url).toBe(ID);
    }
  });

  it("accepts shorts, live and embed links and says which is which", () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/shorts/${ID}`)?.kind).toBe("short");
    expect(parseYouTubeUrl(`https://www.youtube.com/live/${ID}`)?.kind).toBe("live");
    expect(parseYouTubeUrl(`https://www.youtube.com/embed/${ID}`)?.kind).toBe("embed");
  });

  it("accepts a link with no scheme, and a bare id", () => {
    expect(parseYouTubeUrl(`youtu.be/${ID}`)?.videoId).toBe(ID);
    expect(parseYouTubeUrl(ID)?.videoId).toBe(ID);
  });

  it("keeps the timestamp and the playlist when they are there", () => {
    const link = parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s&list=PLabcdefghijkl`);
    expect(link?.startSeconds).toBe(3723);
    expect(link?.playlistId).toBe("PLabcdefghijkl");
  });

  it("reads every timestamp shape", () => {
    expect(parseStart("90")).toBe(90);
    expect(parseStart("90s")).toBe(90);
    expect(parseStart("2m30s")).toBe(150);
    expect(parseStart("1h")).toBe(3600);
    expect(parseStart(null)).toBeUndefined();
    expect(parseStart("banana")).toBeUndefined();
  });

  it("rejects anything that is not a YouTube link", () => {
    for (const url of [
      "https://vimeo.com/123456",
      "https://example.com/watch?v=" + ID,
      "https://notyoutube.com/watch?v=" + ID,
      "not a url",
      "",
      "   ",
    ]) {
      expect(parseYouTubeUrl(url), url).toBeNull();
    }
  });

  it("rejects a YouTube link with no usable video id", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/")).toBeNull();
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=tooshort")).toBeNull();
    expect(parseYouTubeUrl("https://www.youtube.com/@somechannel")).toBeNull();
  });

  it("will not be fooled by a host that merely ends in youtube.com", () => {
    expect(parseYouTubeUrl(`https://evil-youtube.com/watch?v=${ID}`)).toBeNull();
    expect(parseYouTubeUrl(`https://youtube.com.evil.test/watch?v=${ID}`)).toBeNull();
  });

  it("validates ids", () => {
    expect(isVideoId(ID)).toBe(true);
    expect(isVideoId("short")).toBe(false);
    expect(isVideoId("../../etc/passwd")).toBe(false);
  });

  it("builds the canonical watch URL", () => {
    expect(watchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });
});

describe("format and quality choices", () => {
  const options: MediaOption[] = [
    { id: "v1080", container: "mp4", kind: "video", height: 1080, hasAudio: true, approxBytes: 50_000_000 },
    { id: "v2160", container: "mp4", kind: "video", height: 2160, hasAudio: false },
    { id: "v360", container: "mp4", kind: "video", height: 360, hasAudio: true },
    { id: "a128", container: "mp3", kind: "audio", bitrateKbps: 128 },
  ];

  it("offers only the containers a provider actually reported", () => {
    expect(availableContainers(options)).toEqual(["mp4", "mp3"]);
    // No WAV was reported, so no WAV is offered.
    expect(availableContainers(options)).not.toContain("wav");
  });

  it("offers nothing at all when nothing was reported", () => {
    expect(availableContainers([])).toEqual([]);
    expect(optionsFor([], "mp4")).toEqual([]);
    expect(defaultOption([], "mp4")).toBeNull();
  });

  it("sorts renditions best first", () => {
    expect(optionsFor(options, "mp4").map((o) => o.height)).toEqual([2160, 1080, 360]);
  });

  it("pre-selects the best rendition that still has sound", () => {
    expect(defaultOption(options, "mp4")?.id).toBe("v1080");
  });

  it("falls back to the best rendition when none has sound", () => {
    const silent = options.filter((o) => o.hasAudio === false);
    expect(defaultOption(silent, "mp4")?.id).toBe("v2160");
  });

  it("flags a rendition that would download without audio", () => {
    expect(isSilent(options[1])).toBe(true);
    expect(isSilent(options[0])).toBe(false);
    expect(isSilent(options[3])).toBe(false);
  });

  it("names heights it knows, and passes through ones it does not", () => {
    expect(heightLabel(2160)).toContain("4K");
    expect(heightLabel(1080)).toBe("1080p");
    expect(heightLabel(999)).toBe("999p");
  });

  it("labels each option by what it is", () => {
    expect(optionLabel(options[0])).toBe("1080p");
    expect(optionLabel(options[3])).toBe("128 kbps");
    expect(optionLabel({ id: "x", container: "wav", kind: "audio" })).toBe("WAV audio");
  });

  it("builds a safe file name from the video title", () => {
    expect(suggestedFilename("Hello, World! (Official)", options[0])).toBe("hello-world-official-1080p.mp4");
    expect(suggestedFilename("   ", options[3])).toBe("video.mp3");
    expect(suggestedFilename("../../etc/passwd", options[3])).toBe("etc-passwd.mp3");
  });

  it("keeps non-latin titles rather than emptying them", () => {
    expect(suggestedFilename("日本語のタイトル", options[3])).toBe("日本語のタイトル.mp3");
  });
});

describe("official metadata", () => {
  it("reads the fields it needs", () => {
    const info = parseOEmbed({
      title: "A video",
      author_name: "A channel",
      author_url: "https://www.youtube.com/@channel",
      thumbnail_url: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
      thumbnail_width: 480,
      thumbnail_height: 360,
    });
    expect(info.title).toBe("A video");
    expect(info.author).toBe("A channel");
    expect(info.thumbnail).toContain("ytimg.com");
    expect(info.width).toBe(480);
  });

  it("drops a thumbnail or channel URL that is not on a Google host", () => {
    const info = parseOEmbed({
      thumbnail_url: "https://evil.test/pixel.jpg",
      author_url: "https://evil.test/channel",
    });
    expect(info.thumbnail).toBe("");
    expect(info.authorUrl).toBe("");
  });

  it("refuses a non-https thumbnail", () => {
    expect(parseOEmbed({ thumbnail_url: `http://i.ytimg.com/vi/${ID}/hq.jpg` }).thumbnail).toBe("");
  });

  it("survives a response that is not what was expected", () => {
    expect(parseOEmbed(null).title).toBe("");
    expect(parseOEmbed("nope").title).toBe("");
    expect(parseOEmbed({ title: 42 }).title).toBe("");
  });
});
