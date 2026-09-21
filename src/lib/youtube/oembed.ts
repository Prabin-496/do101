/**
 * The official oEmbed response.
 *
 * YouTube publishes an open oEmbed endpoint for public videos. It is the one
 * documented, permitted way to read a video's title, channel and thumbnail
 * without a key, so it is what this tool uses. It returns no media URLs, and
 * is not an access control being worked around.
 */

export interface VideoInfo {
  title: string;
  author: string;
  authorUrl: string;
  thumbnail: string;
  width?: number;
  height?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback: string, maxLength = 300): string {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

/** Only https URLs on Google's own image and site hosts are kept. */
function safeUrl(value: unknown, hosts: string[]): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    return hosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export function parseOEmbed(raw: unknown): VideoInfo {
  if (!isRecord(raw)) {
    return { title: "", author: "", authorUrl: "", thumbnail: "" };
  }
  const number = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

  return {
    title: str(raw.title, ""),
    author: str(raw.author_name, "", 120),
    authorUrl: safeUrl(raw.author_url, ["youtube.com"]),
    thumbnail: safeUrl(raw.thumbnail_url, ["ytimg.com", "youtube.com"]),
    width: number(raw.thumbnail_width),
    height: number(raw.thumbnail_height),
  };
}
