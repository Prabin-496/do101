import { SITE } from "@/lib/site";

export const dynamic = "force-static";

/**
 * /ads.txt — declares Google as an authorised seller of this site's ad space.
 * Without it AdSense warns that earnings are at risk. f08c47fec0942fa0 is
 * Google's own certification authority ID, the same for every publisher.
 */
export function GET() {
  const publisher = SITE.adsenseClient.replace(/^ca-/, "");
  const body = publisher ? `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n` : "";
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
