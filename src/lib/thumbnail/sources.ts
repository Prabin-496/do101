/**
 * Working out what a pasted link points at.
 *
 * People paste whatever the share button gave them — a youtu.be link with a
 * tracking parameter, a Shorts URL, an embed iframe they copied out of a
 * page. All of it has to resolve to a provider and an id, or fail with a
 * reason worth reading.
 *
 * Only two providers can work at all from a browser, and that is not a
 * choice made here: YouTube and Vimeo serve their cover images publicly with
 * permissive CORS headers, so the page can fetch them directly. Instagram,
 * TikTok, X and Facebook do not, which is why they are recognised and turned
 * away by name rather than falling through to "that link looks wrong".
 */

export type Provider = "youtube" | "vimeo";

export interface Source {
  provider: Provider;
  id: string;
  /** Vimeo's unlisted-video hash, which oEmbed needs to see the video. */
  hash?: string;
  /** A tidy link back to the original, for the credit line. */
  canonical: string;
}

export type ParseFailure =
  | { kind: "empty" }
  /** A platform we know about, and know we cannot reach from a browser. */
  | { kind: "unreachable"; platform: string; message: string }
  | { kind: "unrecognised"; message: string };

export type ParseResult = { ok: true; source: Source } | { ok: false; failure: ParseFailure };

/** YouTube ids are always eleven of these characters. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Platforms that keep their covers behind signed or same-origin-only URLs.
 *
 * Saying so plainly is more use than a generic error: the visitor learns the
 * link is fine and the platform is the problem, and does not sit there
 * re-copying it.
 */
const UNREACHABLE: { match: RegExp; platform: string; note: string }[] = [
  {
    match: /(^|\.)instagram\.com$/i,
    platform: "Instagram",
    note: "Instagram serves its images from signed URLs that block other websites from reading them.",
  },
  {
    match: /(^|\.)tiktok\.com$/i,
    platform: "TikTok",
    note: "TikTok's cover images are not served in a way another website is allowed to read.",
  },
  {
    match: /(^|\.)(twitter|x)\.com$/i,
    platform: "X",
    note: "X only publishes an embed card, not a cover image another website can fetch.",
  },
  {
    match: /(^|\.)(facebook|fb)\.(com|watch)$/i,
    platform: "Facebook",
    note: "Facebook requires an app token before it will hand over any media.",
  },
  {
    match: /(^|\.)threads\.(net|com)$/i,
    platform: "Threads",
    note: "Threads does not publish cover images to other websites.",
  },
];

function fail(message: string): ParseResult {
  return { ok: false, failure: { kind: "unrecognised", message } };
}

/** Pulls a URL out of whatever was pasted, including a copied embed snippet. */
function extractUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // An <iframe src="..."> pasted straight from a page.
  const iframe = /<iframe[^>]+src=["']([^"']+)["']/i.exec(trimmed);
  if (iframe) return iframe[1];

  const bare = /https?:\/\/[^\s"'<>]+/i.exec(trimmed);
  if (bare) return bare[0];

  return trimmed;
}

function toUrl(raw: string): URL | null {
  try {
    // A pasted "youtu.be/xyz" with no scheme is still a link people expect to work.
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

function youtube(id: string): ParseResult {
  return {
    ok: true,
    source: { provider: "youtube", id, canonical: `https://www.youtube.com/watch?v=${id}` },
  };
}

function vimeo(id: string, hash?: string): ParseResult {
  return {
    ok: true,
    source: {
      provider: "vimeo",
      id,
      hash,
      canonical: `https://vimeo.com/${id}${hash ? `/${hash}` : ""}`,
    },
  };
}

function parseYouTube(url: URL): ParseResult {
  const parts = url.pathname.split("/").filter(Boolean);

  // youtube.com/watch?v=ID
  const v = url.searchParams.get("v");
  if (v && YOUTUBE_ID.test(v)) return youtube(v);

  // /shorts/ID, /embed/ID, /live/ID, /v/ID
  if (parts.length >= 2 && ["shorts", "embed", "live", "v"].includes(parts[0])) {
    const id = parts[1];
    if (YOUTUBE_ID.test(id)) return youtube(id);
    return fail(`“${id}” is not a YouTube video id — they are always 11 characters.`);
  }

  if (url.hostname.toLowerCase().endsWith("youtu.be") && parts.length >= 1) {
    if (YOUTUBE_ID.test(parts[0])) return youtube(parts[0]);
    return fail(`“${parts[0]}” is not a YouTube video id — they are always 11 characters.`);
  }

  if (url.pathname === "/playlist" || url.searchParams.has("list")) {
    return fail("That is a playlist link. Open one video from it and paste that link instead.");
  }
  if (parts[0] === "channel" || parts[0] === "c" || parts[0]?.startsWith("@")) {
    return fail("That is a channel link. Open one of their videos and paste that link instead.");
  }

  return fail("That YouTube link does not have a video id in it.");
}

function parseVimeo(url: URL): ParseResult {
  const parts = url.pathname.split("/").filter(Boolean);
  const digits = /^\d{6,}$/;

  // player.vimeo.com/video/ID
  if (parts[0] === "video" && digits.test(parts[1] ?? "")) {
    return vimeo(parts[1], url.searchParams.get("h") ?? undefined);
  }

  // The id is the first all-digits segment: covers /123, /channels/x/123,
  // /groups/x/videos/123 and /ondemand/x/123 in one rule.
  const index = parts.findIndex((part) => digits.test(part));
  if (index === -1) return fail("That Vimeo link does not have a video number in it.");

  // An unlisted video carries a hash straight after the id, or as ?h=.
  const next = parts[index + 1];
  const hash = url.searchParams.get("h") ?? (next && /^[0-9a-f]{6,}$/i.test(next) ? next : undefined);
  return vimeo(parts[index], hash ?? undefined);
}

export function parseSource(input: string): ParseResult {
  const raw = extractUrl(input);
  if (!raw) return { ok: false, failure: { kind: "empty" } };

  // A bare id, which is what people often copy out of a URL by hand.
  if (YOUTUBE_ID.test(raw) && !/^\d+$/.test(raw)) return youtube(raw);

  const url = toUrl(raw);
  if (!url) return fail("That does not look like a link. Paste the whole thing, starting with https://");

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  const blocked = UNREACHABLE.find((entry) => entry.match.test(host));
  if (blocked) {
    return {
      ok: false,
      failure: {
        kind: "unreachable",
        platform: blocked.platform,
        message: `${blocked.note} Nothing running in your browser can reach it, so this tool cannot either.`,
      },
    };
  }

  if (/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(host)) return parseYouTube(url);
  if (/(^|\.)vimeo\.com$/.test(host)) return parseVimeo(url);

  return fail("That is not a YouTube or Vimeo link. Those are the only two that publish covers a browser is allowed to fetch.");
}

/** The wording shown when a link cannot be used. */
export function failureMessage(failure: ParseFailure): string {
  switch (failure.kind) {
    case "empty":
      return "Paste a link first.";
    case "unreachable":
      return `${failure.platform} covers cannot be fetched. ${failure.message}`;
    default:
      return failure.message;
  }
}
