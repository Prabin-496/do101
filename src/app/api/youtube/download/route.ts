import { NextResponse } from "next/server";
import { clientKey, rateLimited } from "@/lib/api/rate-limit";
import { isVideoId } from "@/lib/youtube/url";
import {
  NOT_CONFIGURED_MESSAGE,
  ProviderRequestError,
  getProvider,
} from "@/lib/youtube/provider";

export const runtime = "nodejs";

/**
 * /api/youtube/download — asks the configured provider where the file is.
 *
 * It answers with a URL for the browser to fetch rather than streaming the
 * media through this site, so the operator's bandwidth is not in the middle
 * of every download. With no provider configured it answers 501.
 */
export async function POST(request: Request) {
  if (rateLimited("yt-download", clientKey(request), { windowMs: 60_000, max: 12 })) {
    return NextResponse.json({ error: "Too many downloads in a short time. Wait a minute." }, { status: 429 });
  }

  let videoId = "";
  let optionId = "";
  try {
    const body = (await request.json()) as { videoId?: unknown; optionId?: unknown };
    videoId = typeof body.videoId === "string" ? body.videoId : "";
    optionId = typeof body.optionId === "string" ? body.optionId.slice(0, 200) : "";
  } catch {
    return NextResponse.json({ error: "Send a JSON body with videoId and optionId." }, { status: 400 });
  }

  if (!isVideoId(videoId) || !optionId) {
    return NextResponse.json({ error: "Give a valid video id and a format to download." }, { status: 400 });
  }

  const provider = getProvider();
  if (!provider) {
    return NextResponse.json(
      { error: NOT_CONFIGURED_MESSAGE, code: "provider_not_configured" },
      { status: 501 },
    );
  }

  try {
    const result = await provider.resolveDownload(videoId, optionId);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof ProviderRequestError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The provider could not supply that file." },
      { status },
    );
  }
}
