import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { Prose, PageHeader } from "@/components/layout/Prose";
import { ButtonLink } from "@/components/ui/Button";
import { buildMetadata } from "@/lib/seo/metadata";
import { TOOLS } from "@/lib/tools/tool-registry";

export const metadata: Metadata = buildMetadata({
  title: "About DO101 — Free, Browser-First Online Tools",
  description:
    "DO101 is a free collection of browser-first online tools, calculators and games. Learn what it is, why it exists and how it stays free and private.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "About", href: "/about" }]} />
      <PageHeader
        title="About DO101"
        lead="Do more. Simply. — free tools, fast answers, and fun challenges."
      />

      <Prose>
        <p>
          DO101 is a free collection of {TOOLS.length} everyday online tools: image compressors and
          resizers, text counters and cleaners, developer utilities, practical calculators, a QR
          generator, and a handful of quick browser games. There is nothing to install, nothing to
          sign up for, and no free trial that expires.
        </p>

        <h2>Why it exists</h2>
        <p>
          Search for something as ordinary as &ldquo;compress an image under 200 KB&rdquo; and you
          will land on a page covered in ad blocks, gated behind an upload, or asking you to create
          an account before it will hand back your own file. The job takes ten seconds. The website
          takes two minutes.
        </p>
        <p>
          DO101 is built the other way round: the tool sits at the top of the page, it works
          immediately, and the explanation lives underneath for anyone who wants it.
        </p>

        <h2>Browser-first by default</h2>
        <p>
          Almost every DO101 tool runs entirely inside your browser. Image compression and resizing
          use the canvas encoder your browser already ships. JSON parsing uses the built-in JSON
          engine. Hashing uses the Web Crypto API. Typing games measure your keystrokes locally.
        </p>
        <p>That has four consequences we like:</p>
        <ul>
          <li>
            <strong>Privacy.</strong> Your file cannot leak from a server that never received it.
          </li>
          <li>
            <strong>Speed.</strong> No upload, no queue, no download — the result appears instantly.
          </li>
          <li>
            <strong>Cost.</strong> Running almost no server work is what lets DO101 stay free.
          </li>
          <li>
            <strong>Resilience.</strong> Once a tool page has loaded, most of them keep working even
            if your connection drops.
          </li>
        </ul>
        <p>
          Where something genuinely cannot run locally — the optional{" "}
          <Link href="/ai">AI router</Link> is the only example today — the page says so plainly.
          The <Link href="/privacy">privacy page</Link> spells out exactly what happens where.
        </p>

        <h2>The games</h2>
        <p>
          The <Link href="/games/typing-test">typing test</Link>,{" "}
          <Link href="/games/typing-battle">Typing Battle</Link>,{" "}
          <Link href="/games/reaction-test">reaction test</Link> and{" "}
          <Link href="/games/memory-test">memory game</Link> exist because a tools site should be
          somewhere you enjoy landing. Typing Battle is a real peer-to-peer race between two
          browsers — if nobody joins your room, the screen tells you nobody joined. There are no
          simulated opponents and no invented high scores anywhere on DO101.
        </p>

        <h2>How DO101 is paid for</h2>
        <p>
          DO101 is free to use and always will be for the current tools. The plan is to cover
          hosting with modest, clearly-labelled advertising placed between content sections — never
          disguised as a button, never wedged next to a download link, and never on a page that
          exists only to carry an ad. If advertising were switched off tomorrow, every tool would
          work exactly the same.
        </p>

        <h2>What is next</h2>
        <p>
          More tools, chosen because people actually need them rather than to inflate a page count:
          PDF utilities, colour tools, more converters, and deeper options in the tools that already
          exist. If something you need is missing, tell us on the{" "}
          <Link href="/contact">contact page</Link>.
        </p>

        <h2>Honesty policy</h2>
        <p>
          DO101 publishes no fake statistics, no invented testimonials, no fabricated user counts and
          no star ratings it did not receive. Where a limitation exists — a file size cap, a
          connection that can fail, a calculation that is only a rough guide — the page says so.
        </p>
      </Prose>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/tools" tone="grass">
          Browse the tools
        </ButtonLink>
        <ButtonLink href="/contact" tone="panel">
          Get in touch
        </ButtonLink>
      </div>
    </div>
  );
}
