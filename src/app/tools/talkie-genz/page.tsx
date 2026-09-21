import { Suspense } from "react";
import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { TalkieGenZ } from "@/components/tools/talkie/TalkieGenZ";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";
import { MAX_MEMBERS } from "@/lib/talkie/protocol";

const tool = getTool("talkie-genz")!;
export const metadata: Metadata = toolMetadata(tool);

/** What the page can honestly claim, and what it cannot. */
const HONESTY: [string, string][] = [
  [
    "Your voice never reaches DO101",
    "Audio goes straight from your browser to each other browser in the room. There is no DO101 voice server to route it through, so there is nothing here that could record or overhear you.",
  ],
  [
    "Nothing is stored, anywhere",
    "No account, no database, no recordings, no message history. The room is a handful of peer ids held in memory by whoever started it, and it disappears when their tab closes.",
  ],
  [
    "Two free services make the introduction",
    "Browsers cannot find each other unaided. A free public PeerJS broker swaps connection details, and Google's public STUN server works out your address from behind your router. Neither sees or carries your audio, neither needs an account, and DO101 pays for neither.",
  ],
  [
    "Sometimes a direct connection is impossible",
    "Strict firewalls and some mobile networks block peer-to-peer traffic. WebRTC can fall back to a relay, and the free public one shipped with the PeerJS library is used — but it belongs to somebody else and carries no guarantee. If it is unavailable the call fails, and TalkieGenZ tells you so instead of faking a connection.",
  ],
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
            { name: "Productivity", href: "/tools?category=productivity" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell
        tool={tool}
        wide
        extraContent={
          <section aria-labelledby="honesty-heading">
            <h2 id="honesty-heading" className="mb-3 text-xl sm:text-2xl">
              What TalkieGenZ does with your voice
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {HONESTY.map(([title, detail]) => (
                <li key={title} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                  <p className="text-sm font-extrabold">{title}</p>
                  <p className="text-xs font-semibold text-[var(--muted)]">{detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-semibold text-[var(--muted)]">
              Rooms hold {MAX_MEMBERS} people, because every extra person is another copy of your
              voice for your phone to send.
            </p>
          </section>
        }
      >
        <Suspense
          fallback={
            <div className="do-card grid h-64 place-items-center text-sm font-extrabold text-[var(--muted)]">
              Warming up the radio…
            </div>
          }
        >
          <TalkieGenZ />
        </Suspense>
      </ToolShell>
    </>
  );
}
