import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { ThumbnailGrabber } from "@/components/tools/thumbnail/ThumbnailGrabber";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("thumbnail-grabber")!;
export const metadata: Metadata = toolMetadata(tool);

const LINKS: [string, string][] = [
  ["youtube.com/watch?v=…", "The address bar on a desktop"],
  ["youtu.be/…", "What the Share button copies"],
  ["youtube.com/shorts/…", "A Short — same covers as any other video"],
  ["youtube.com/embed/…", "Or the whole <iframe> snippet, pasted in"],
  ["vimeo.com/123456789", "Including /channels/ and /groups/ links"],
  ["vimeo.com/123456789/abc123", "An unlisted video, with its hash"],
];

const SIZES: [string, string][] = [
  ["Max — 1280×720", "16:9, and only exists if the video was uploaded in HD."],
  ["SD — 640×480", "4:3, so a widescreen video gets black bars."],
  ["High — 480×360", "4:3. Always present, whatever the video."],
  ["Medium — 320×180", "16:9, and a good small one."],
  ["Small — 120×90", "4:3. The old list-view size."],
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={[
          toolSchema(tool),
          faqSchema(tool.faqs)!,
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "Image", href: "/tools?category=image" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell
        tool={tool}
        extraContent={
          <>
            <section aria-labelledby="links-heading">
              <h2 id="links-heading" className="mb-3 text-xl sm:text-2xl">
                Links it understands
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {LINKS.map(([shape, what]) => (
                  <li key={shape} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                    <p className="text-sm font-extrabold break-all">{shape}</p>
                    <p className="text-xs font-semibold text-[var(--muted)]">{what}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="sizes-heading">
              <h2 id="sizes-heading" className="mb-3 text-xl sm:text-2xl">
                The sizes YouTube keeps
              </h2>
              <p className="mb-3 text-sm font-semibold text-[var(--muted)]">
                Every video has the smaller ones. Only videos uploaded in HD have the big one, and
                the tool tells you when there isn&rsquo;t one rather than handing you an upscale.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {SIZES.map(([name, what]) => (
                  <li key={name} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                    <p className="text-sm font-extrabold">{name}</p>
                    <p className="text-xs font-semibold text-[var(--muted)]">{what}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="video-heading">
              <h2 id="video-heading" className="mb-3 text-xl sm:text-2xl">
                Why it cannot download the video
              </h2>
              <div className="space-y-2 rounded-2xl bg-[var(--panel)] px-4 py-3">
                <p className="text-sm font-semibold">
                  Cover images are published openly — your browser is allowed to load them from any
                  page, which is exactly what this tool does. Video files are not.
                </p>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  YouTube puts its streams behind a signature that changes constantly and has to be
                  solved by a server; Instagram and TikTok use signed addresses that refuse requests
                  from other websites altogether. A site offering those downloads is running a
                  server that works around those protections, which breaches the platforms&rsquo;
                  terms and has repeatedly been fought over in court. DO101 has no server, so this
                  tool stops where the open, published part stops.
                </p>
              </div>
            </section>
          </>
        }
      >
        <ThumbnailGrabber />
      </ToolShell>
    </>
  );
}
