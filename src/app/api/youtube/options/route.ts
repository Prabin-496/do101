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
 * /api/youtube/options — which renditions can be downloaded for a video.
 *
 * With no provider configured this answers 501 and the interface says so
 * plainly. It never invents a list of formats to make the page look busy.
 */
export async function GET(request: Request) {
  if (rateLimited("yt-options", clientKey(request), { windowMs: 60_000, max: 30 })) {
    return NextResponse.json({ error: "Too many requests. Wait a minute." }, { status: 429 });
  }

  const videoId = new URL(request.url).searchParams.get("id") ?? "";
  if (!isVideoId(videoId)) {
    return NextResponse.json({ error: "Give a valid YouTube video id." }, { status: 400 });
  }

  const provider = getProvider();
  if (!provider) {
    return NextResponse.json(
      { error: NOT_CONFIGURED_MESSAGE, code: "provider_not_configured", options: [] },
      { status: 501 },
    );
  }

  try {
    const options = await provider.listOptions(videoId);
    return NextResponse.json({
      options,
      provider: { id: provider.id, name: provider.name, termsUrl: provider.termsUrl ?? null },
    });
  } catch (error) {
    const status = error instanceof ProviderRequestError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The provider could not be reached.", options: [] },
      { status },
    );
  }
}
