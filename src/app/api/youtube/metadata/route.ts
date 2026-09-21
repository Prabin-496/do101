import { NextResponse } from "next/server";
import { clientKey, rateLimited } from "@/lib/api/rate-limit";
import { parseOEmbed } from "@/lib/youtube/oembed";
import { parseYouTubeUrl, watchUrl } from "@/lib/youtube/url";

export const runtime = "nodejs";

/**
 * /api/youtube/metadata — the title, channel and thumbnail of a public video.
 *
 * This calls YouTube's own published oEmbed endpoint, which is the documented
 * way to read those three things without a key and returns no media URLs.
 * It runs on the server only because oEmbed sends no CORS header, not to hide
 * anything from the visitor.
 */
export async function GET(request: Request) {
  if (rateLimited("yt-metadata", clientKey(request), { windowMs: 60_000, max: 30 })) {
    return NextResponse.json(
      { error: "Too many lookups in a short time. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const input = new URL(request.url).searchParams.get("url") ?? "";
  const link = parseYouTubeUrl(input);
  if (!link) {
    return NextResponse.json(
      { error: "That does not look like a YouTube link. Paste a link from youtube.com or youtu.be." },
      { status: 400 },
    );
  }

  const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(link.videoId))}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
  } catch {
    return NextResponse.json(
      { error: "YouTube did not answer in time. Try again in a moment." },
      { status: 504 },
    );
  }

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return NextResponse.json(
      {
        error:
          "YouTube returned nothing for that link. The video may be private, age-restricted, deleted, or not embeddable.",
      },
      { status: 404 },
    );
  }
  if (!response.ok) {
    return NextResponse.json({ error: "YouTube could not be reached just now." }, { status: 502 });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return NextResponse.json({ error: "YouTube sent a response this tool could not read." }, { status: 502 });
  }

  const info = parseOEmbed(raw);
  return NextResponse.json(
    { videoId: link.videoId, kind: link.kind, ...info },
    { headers: { "cache-control": "public, max-age=600, s-maxage=3600" } },
  );
}
