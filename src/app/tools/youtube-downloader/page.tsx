import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { YoutubeDownloader } from "@/components/tools/youtube/YoutubeDownloader";
import { JsonLd } from "@/components/seo/JsonLd";
import { InfoNote } from "@/components/ui/Feedback";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";
import { toolBreadcrumbs } from "@/lib/tools/links";

const tool = getTool("youtube-downloader")!;
export const metadata: Metadata = toolMetadata(tool);

const ROUTES: [string, string][] = [
  [
    "The video is yours",
    "YouTube Studio → Content → the menu beside the video → Download. You get the file at the resolution you uploaded, with nothing in between.",
  ],
  [
    "You want it offline on a phone",
    "YouTube Premium downloads videos for offline playback inside the app. That is the supported way to watch without a connection.",
  ],
  [
    "You need a clip for a review or a lesson",
    "Ask the channel. Creators often send the original file, and many are glad to be asked. A Creative Commons licence on a video covers reuse, not the means of getting hold of it.",
  ],
  [
    "You are the rights holder of content someone else posted",
    "YouTube's copyright tools let you request removal or claim the upload, which is a stronger position than downloading a copy.",
  ],
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
            <section aria-labelledby="routes-heading">
              <h2 id="routes-heading" className="mb-3 text-xl sm:text-2xl">
                The permitted ways to get a YouTube video
              </h2>
              <ul className="space-y-2">
                {ROUTES.map(([title, what]) => (
                  <li key={title} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                    <p className="text-sm font-extrabold">{title}</p>
                    <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">{what}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="why-heading">
              <h2 id="why-heading" className="mb-3 text-xl sm:text-2xl">
                Why this tool will not rip the video
              </h2>
              <div className="space-y-3 text-base font-semibold leading-relaxed text-[var(--muted)]">
                <p>
                  YouTube does not serve its media as a plain file you can link to. The streams sit
                  behind access controls, and its Terms of Service specifically do not allow getting
                  around them. Sites that do it anyway are breaking those terms, and where the video
                  belongs to someone else, infringing their copyright as well.
                </p>
                <p>
                  DO101 would rather tell you that than show you a download button that quietly does
                  nothing, or bury the page in adverts shaped like one. Every other tool on this site
                  does exactly what it says, and this page is not going to be the exception.
                </p>
                <p>
                  What is here instead: a link checker that reads any YouTube URL and shows you what
                  it points at, the official routes above, and — if you run your own copy of DO101 —
                  a documented provider interface to connect a lawful media source to.
                </p>
              </div>
            </section>

            <section aria-labelledby="privacy-heading">
              <h2 id="privacy-heading" className="mb-3 text-xl sm:text-2xl">
                What reaches a server
              </h2>
              <InfoNote icon="🔒">
                Unlike most DO101 tools, this one is not purely in-browser. The video id is passed to
                YouTube&rsquo;s own public oEmbed endpoint through this site, because that endpoint
                sends no CORS header and cannot be called from your browser directly. That is the
                only request made, nothing is stored, and there is no account.
              </InfoNote>
            </section>
          </>
        }
      >
        <YoutubeDownloader />
      </ToolShell>
    </>
  );
}
