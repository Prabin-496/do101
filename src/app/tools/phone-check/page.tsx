import type { Metadata } from "next";
import Link from "next/link";
import { ToolShell } from "@/components/tools/ToolShell";
import { PhoneCheck } from "@/components/tools/phone/PhoneCheck";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("phone-check")!;
export const metadata: Metadata = toolMetadata(tool);

const HOW_TO_CHECK: Array<{ step: string; detail: string }> = [
  {
    step: "Start with the + and the country code",
    detail:
      "A number without one is ambiguous: 0312345678 is a Tokyo landline in Japan and nothing at all in most other countries. With +81 in front there is no guesswork left, which is why the checker detects the country from the prefix before anything else.",
  },
  {
    step: "Check the range, not the number",
    detail:
      "The numbering plan can tell you the range exists and what it is for. It cannot tell you the line is connected, and no public data can. Treat “valid” as “this could be a real number”, never as “this is a real caller”.",
  },
  {
    step: "Look at what the call costs you",
    detail:
      "Premium rate and satellite ranges are the ones where the number itself is the scam, because ringing back is what makes the money. Those are visible in the numbering plan, so the checker flags them outright.",
  },
  {
    step: "Assume the caller ID may be someone else's",
    detail:
      "Spoofing a number takes minutes and no special access. If a call claims to be your bank, the displayed number matching the bank's real line tells you nothing — the scam depends on exactly that.",
  },
  {
    step: "Verify by calling back on a number you sourced yourself",
    detail:
      "The back of your card, the official website, your last statement. Not the number that called, not one in the message. This single habit defeats nearly every impersonation call, whatever the lookup said.",
  },
  {
    step: "Report it through your phone, not a website",
    detail:
      "Blocking and reporting in the call log feeds your network's own filtering, which is what actually stops the next call. Then tell the organisation being impersonated and your national fraud line.",
  },
];

const CANNOT: Array<[string, string]> = [
  ["Who owns the number", "Subscriber records are not public. Anywhere that claims otherwise is recycling scraped personal data or inventing it."],
  ["Where the phone is", "The numbering region is where the prefix is issued. The handset can be anywhere on earth, and nothing here asks for or estimates a position."],
  ["Whether the line is connected", "The plan says a range is allocated, not that a particular number is in service. Only ringing it tells you that."],
  ["Whether a call was really from it", "Caller ID is supplied by the caller's system and is not verified end to end. A displayed number is a claim, not evidence."],
  ["How many people reported it", "There is no spam database here. A free browser tool cannot host one honestly, and the sites that claim to are mostly guessing."],
  ["The current network", "The carrier table names who the range was originally allocated to. Number portability moves numbers between networks and no public dataset follows them."],
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
          <>
            <section aria-labelledby="how-to-check-heading">
              <h2 id="how-to-check-heading" className="mb-3 text-xl sm:text-2xl">
                How to check a phone number
              </h2>
              <p className="mb-3 text-sm font-semibold text-[var(--muted)]">
                Six steps, in the order that actually protects you. The lookup is the first one,
                and the least important.
              </p>
              <ol className="space-y-2">
                {HOW_TO_CHECK.map((item, i) => (
                  <li key={item.step} className="do-card flex items-start gap-3 p-4">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--sky)] text-sm font-extrabold text-white">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-extrabold">{item.step}</span>
                      <span className="mt-0.5 block text-sm font-semibold leading-relaxed text-[var(--muted)]">
                        {item.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="cannot-heading">
              <h2 id="cannot-heading" className="mb-3 text-xl sm:text-2xl">
                What a phone number cannot tell you
              </h2>
              <p className="mb-3 text-sm font-semibold text-[var(--muted)]">
                Most phone-lookup sites answer these anyway. This one lists them so you know what
                the silence means.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {CANNOT.map(([title, why]) => (
                  <li key={title} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                    <p className="text-sm font-extrabold">
                      <span aria-hidden className="mr-1.5">
                        🚫
                      </span>
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[var(--muted)]">
                      {why}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="data-heading">
              <h2 id="data-heading" className="mb-3 text-xl sm:text-2xl">
                The data behind the answers
              </h2>
              <div className="space-y-2 rounded-2xl bg-[var(--panel)] px-4 py-3">
                <p className="text-sm font-semibold">
                  Every fact on this page comes from{" "}
                  <a
                    href="https://github.com/google/libphonenumber"
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="underline decoration-2 underline-offset-2"
                  >
                    Google&rsquo;s libphonenumber
                  </a>
                  , the open numbering-plan library that phones, CRMs and telecoms software use. It
                  is the same data your handset uses to decide a number is dialable.
                </p>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  The numbering plans reach the page through{" "}
                  <a
                    href="https://gitlab.com/catamphetamine/libphonenumber-js"
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="underline decoration-2 underline-offset-2"
                  >
                    libphonenumber-js
                  </a>{" "}
                  (MIT). The numbering-region and carrier prefix tables are libphonenumber&rsquo;s
                  own geocoding and carrier resources (Apache&nbsp;2.0), repackaged by{" "}
                  <a
                    href="https://github.com/mmende/libphonenumber-geo-carrier"
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="underline decoration-2 underline-offset-2"
                  >
                    libphonenumber-geo-carrier
                  </a>{" "}
                  (MIT) and converted to JSON at build time, split by calling code so a lookup
                  fetches one small file. No value is added, removed or edited on the way. Both
                  licences travel with the data at{" "}
                  <a href="/phone-data/NOTICE.txt" className="underline decoration-2 underline-offset-2">
                    /phone-data/NOTICE.txt
                  </a>
                  .
                </p>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  Nothing else is consulted. There is no spam database, no reverse-lookup service
                  and no paid API — which is why the tool is free, and why it says &ldquo;Unknown /
                  not available&rdquo; instead of filling a gap with something plausible.
                </p>
              </div>
            </section>

            <section aria-labelledby="privacy-heading">
              <h2 id="privacy-heading" className="mb-3 text-xl sm:text-2xl">
                Where the number goes
              </h2>
              <div className="space-y-2 rounded-2xl bg-[var(--panel)] px-4 py-3">
                <p className="text-sm font-semibold">
                  Nowhere. The numbering plans are bundled into the page, so parsing, validation,
                  type detection and every risk rule run on your own device.
                </p>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  The one thing fetched is a prefix table for the country calling code — a static
                  file like <code className="font-mono text-xs">/phone-data/geocodes/81.json</code>
                  , identical for everyone checking a Japanese number, so the request says nothing
                  about which number you typed. Nothing is logged, nothing is stored, nothing is
                  sent to a third party, and there is no account to make. A phone number is
                  personal data; treating it as something to keep would be the wrong design, so
                  there is nowhere for it to be kept.
                </p>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  Reporting a nuisance call?{" "}
                  <Link href="/privacy" className="underline decoration-2 underline-offset-2">
                    Our privacy policy
                  </Link>{" "}
                  covers the rest of the site.
                </p>
              </div>
            </section>
          </>
        }
      >
        <PhoneCheck />
      </ToolShell>
    </>
  );
}
