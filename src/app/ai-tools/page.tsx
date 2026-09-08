import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { AiDirectory } from "@/components/tools/AiDirectory";
import { AdSlot } from "@/components/tools/AdSlot";
import { Faq } from "@/components/tools/Faq";
import { ButtonLink } from "@/components/ui/Button";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";
import { AI_TOOL_COUNT, DIRECTORY_REVIEWED } from "@/lib/ai-directory/tools";
import { AI_CATEGORIES } from "@/lib/ai-directory/types";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "AI Tools Directory — What to Use for What | DO101",
  description:
    "A curated directory of AI tools by category: image, video, music, voice, coding, writing, research and 3D. What each is genuinely best at, with links to the official sites.",
  path: "/ai-tools",
});

const FAQS = [
  {
    q: "Why are there no prices?",
    a: "AI pricing changes every few weeks, and a stale figure is worse than none — you would plan around a number that is no longer true. Every card links to the tool's own site, where the current pricing is authoritative. The free-tier label reflects what a tool has publicly offered for a long time, and is still worth verifying before you commit.",
  },
  {
    q: "Why are there no ratings or a 'best AI tool' ranking?",
    a: "Because DO101 has not run a comparative evaluation of these tools, and publishing scores it did not measure would be inventing data. Instead each entry says what that tool is genuinely better suited to than its peers, which is the useful part of a ranking without the fabricated part.",
  },
  {
    q: "How is this different from the big AI directories?",
    a: "Most list thousands of tools, which mostly means thousands of landing pages. This is a short, hand-checked list of tools that are well established and still around, organised by the job you are trying to do. For genuinely new launches, the startups news page reads Product Hunt live — a feed will always be more current than any directory.",
  },
  {
    q: "Is DO101 paid to list these?",
    a: "No. There are no affiliate links, sponsored placements or paid inclusions anywhere in this directory. Links go directly to each tool's own site.",
  },
  {
    q: "How do I get a tool added or corrected?",
    a: "Get in touch through the contact page. Corrections are especially welcome — if something here is out of date, it should be fixed.",
  },
];

export default function AiToolsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          faqSchema(FAQS)!,
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "AI tools", href: "/ai-tools" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "AI tools directory",
            url: absoluteUrl("/ai-tools"),
            description: `A curated directory of ${AI_TOOL_COUNT} AI tools organised by what they are for.`,
            isAccessibleForFree: true,
          },
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "AI tools", href: "/ai-tools" },
        ]}
      />

      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl sm:text-4xl">
          <span aria-hidden>🧠</span>
          AI tools, sorted by what they are for
        </h1>
        <p className="mt-2 max-w-2xl text-base font-semibold text-[var(--muted)]">
          {AI_TOOL_COUNT} established AI tools across {AI_CATEGORIES.length} categories — image,
          video, music, voice, coding, writing, research, design and 3D. Each entry says what that
          tool is genuinely better at than its neighbours, and links straight to the official site.
        </p>
        <p className="mt-3 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Hand-curated · no affiliate links · last reviewed {DIRECTORY_REVIEWED}
        </p>
      </header>

      <AiDirectory />

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_DIRECTORY} className="mt-10" />

      <section className="mt-14 max-w-3xl space-y-4 text-base font-semibold leading-relaxed text-[var(--muted)]">
        <h2 className="text-2xl text-[var(--ink)]">How to actually choose one</h2>
        <p>
          Almost every AI category now has four or five credible options, and the honest answer to
          &ldquo;which is best&rdquo; is usually &ldquo;whichever fits the specific thing you are
          doing&rdquo;. A model that writes beautiful marketing copy may be mediocre at refactoring
          code; a video generator with stunning demo reels may be poor at the ordinary shot you
          actually need.
        </p>
        <p>
          So the practical method is boring and works: take one real task you have right now, run it
          through two of the tools listed here, and keep the one that did it better. That takes
          twenty minutes and beats any comparison table, including this one.
        </p>

        <h2 className="pt-2 text-2xl text-[var(--ink)]">Three things worth checking before you commit</h2>
        <p>
          <strong className="text-[var(--ink)]">Who owns the output.</strong> Terms differ sharply on
          commercial use, particularly for music and images. Read that clause before you publish
          anything, not after.
        </p>
        <p>
          <strong className="text-[var(--ink)]">What happens to your input.</strong> Some services
          train on what you send them by default. If you are pasting client work or anything
          confidential, find that setting first.
        </p>
        <p>
          <strong className="text-[var(--ink)]">Consent, for anything involving a person.</strong>{" "}
          Voice cloning needs the speaker&rsquo;s explicit permission, and recording a meeting needs
          everyone&rsquo;s. In many places these are legal requirements rather than courtesies.
        </p>

        <h2 className="pt-2 text-2xl text-[var(--ink)]">Where DO101 fits</h2>
        <p>
          Everything on this page is somebody else&rsquo;s tool. DO101&rsquo;s own{" "}
          <Link href="/tools" className="font-extrabold text-[var(--ink)] underline">
            free browser tools
          </Link>{" "}
          sit alongside them and mostly do the unglamorous jobs AI is bad at — merging a PDF,
          compressing a photo, formatting JSON — running entirely on your device with nothing
          uploaded. For AI tools launching right now rather than the established set, the{" "}
          <Link href="/news/startups" className="font-extrabold text-[var(--ink)] underline">
            startups news feed
          </Link>{" "}
          reads Product Hunt live.
        </p>
      </section>

      <div className="mt-14">
        <Faq items={FAQS} />
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href="/tools" tone="grass">
          DO101&rsquo;s own free tools
        </ButtonLink>
        <ButtonLink href="/news/ai" tone="panel">
          Latest AI news
        </ButtonLink>
        <ButtonLink href="/contact" tone="panel">
          Suggest a correction
        </ButtonLink>
      </div>
    </div>
  );
}
