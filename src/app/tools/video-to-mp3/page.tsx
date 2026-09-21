import type { Metadata } from "next";
import Link from "next/link";
import { ToolShell } from "@/components/tools/ToolShell";
import { VideoToMp3 } from "@/components/tools/audio/VideoToMp3";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";
import { toolBreadcrumbs } from "@/lib/tools/links";

const tool = getTool("video-to-mp3")!;
export const metadata: Metadata = toolMetadata(tool);

/** What people actually convert, and the setting that suits each. */
const USES: [string, string][] = [
  ["Lectures and lessons", "Listen again on the bus. 128 kbps with Mono keeps an hour-long lecture around 55 MB."],
  ["Zoom, Teams and Meet recordings", "Keep the conversation, drop the video. Meeting recordings are usually MP4 and convert directly."],
  ["Phone videos", "A concert clip, a voice memo filmed by accident, a child's first song — straight from your camera roll."],
  ["Your own YouTube uploads", "Download the original from YouTube Studio, then convert it here to publish as a podcast."],
  ["Screen recordings and tutorials", "Pull the narration out to edit it, transcribe it or reuse it."],
  ["Music you made", "Export your video edit, then share the soundtrack as an MP3 anything can play."],
];

/** Which formats a browser can read, stated plainly rather than promised. */
const FORMATS: [string, string][] = [
  ["MP4, MOV, M4V", "Every current browser"],
  ["WebM", "Chrome, Edge, Firefox, and Safari 15 or later"],
  ["M4A, AAC, MP3, WAV", "Every current browser"],
  ["OGG, Opus, FLAC", "Chrome, Edge and Firefox; recent Safari"],
  ["MKV, AVI, WMV, 3GP", "Depends on the browser and the codec inside — Chrome and Edge read the most"],
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={[
          toolSchema(tool),
          faqSchema(tool.faqs)!,
          breadcrumbSchema(toolBreadcrumbs(tool)),
        ]}
      />
      <ToolShell
        tool={tool}
        extraContent={
          <>
            <section aria-labelledby="uses-heading">
              <h2 id="uses-heading" className="mb-3 text-xl sm:text-2xl">
                What people convert to MP3
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {USES.map(([title, detail]) => (
                  <li key={title} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                    <p className="text-sm font-extrabold">{title}</p>
                    <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">{detail}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="formats-heading">
              <h2 id="formats-heading" className="mb-3 text-xl sm:text-2xl">
                Which files can be converted
              </h2>
              <p className="mb-3 text-base font-semibold leading-relaxed text-[var(--muted)]">
                The audio is decoded by your browser&rsquo;s own media engine, so what it can read
                depends on the browser rather than on DO101.
              </p>
              <div className="overflow-hidden rounded-2xl border-2 border-[var(--border)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--panel)]">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-extrabold">Format</th>
                      <th scope="col" className="px-4 py-2 font-extrabold">Converts in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FORMATS.map(([format, where]) => (
                      <tr key={format} className="border-t-2 border-[var(--border)]">
                        <td className="px-4 py-2 font-extrabold">{format}</td>
                        <td className="px-4 py-2 font-semibold text-[var(--muted)]">{where}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="how-heading">
              <h2 id="how-heading" className="mb-3 text-xl sm:text-2xl">
                How it converts without uploading
              </h2>
              <div className="space-y-3 text-base font-semibold leading-relaxed text-[var(--muted)]">
                <p>
                  Most online converters send your video to a server, convert it there and send the
                  MP3 back — which means a size limit, a queue, and a copy of your file on somebody
                  else&rsquo;s computer. This one does the whole job on your device.
                </p>
                <p>
                  Your browser reads the video&rsquo;s sound track with the Web Audio API, the same
                  decoder it uses to play video. The samples are then encoded to MP3 by lamejs, a
                  JavaScript build of the LAME encoder, running on this page. Nothing is sent
                  anywhere, so it works just as well on a train with no signal once the page has
                  loaded.
                </p>
                <p>
                  Converting a YouTube video? DO101 does not download from YouTube — see the{" "}
                  <Link href="/tools/youtube-downloader" className="font-extrabold text-[var(--sky)] underline">
                    YouTube page
                  </Link>{" "}
                  for the permitted ways to get a video you own, then bring the file back here.
                </p>
              </div>
            </section>
          </>
        }
      >
        <VideoToMp3 />
      </ToolShell>
    </>
  );
}
