import Link from "next/link";
import type { Metadata } from "next";
import { HomeSearch } from "@/components/layout/HomeSearch";
import { T } from "@/components/layout/HeroCopy";
import { ButtonLink } from "@/components/ui/Button";
import { ToolCard } from "@/components/tools/ToolCard";
import { AdSlot } from "@/components/tools/AdSlot";
import { RecentTools } from "@/components/tools/RecentTools";
import { JsonLd } from "@/components/seo/JsonLd";
import { itemListSchema } from "@/lib/seo/structured-data";
import { buildMetadata } from "@/lib/seo/metadata";
import { TOOLS, FEATURED_TOOLS, toolsByCategory } from "@/lib/tools/tool-registry";
import { CATEGORY_META } from "@/lib/tools/types";
import { SOURCE_COUNT } from "@/lib/news/sources";
import { CATEGORY_LABELS, CATEGORY_ORDER as NEWS_CATEGORIES } from "@/lib/news/types";

export const metadata: Metadata = buildMetadata({
  title: "DO101 — Free Online Tools, Calculators & Games",
  description:
    "Free online tools for images, text, developers, calculations and productivity, plus typing and reaction games. Fast, simple and browser-first.",
  path: "/",
});

const CATEGORY_LINKS = [
  { key: "pdf", href: "/tools/pdf" },
  { key: "image", href: "/tools/image" },
  { key: "converter", href: "/tools/converters" },
  { key: "text", href: "/tools/text" },
  { key: "developer", href: "/tools/developer" },
  { key: "seo", href: "/tools/seo" },
  { key: "calculator", href: "/calculators" },
  { key: "datetime", href: "/tools/datetime" },
  { key: "learn", href: "/tools/earth-globe" },
  { key: "travel", href: "/tools/station-alarm" },
  { key: "game", href: "/games" },
] as const;

export default function HomePage() {
  const devTools = toolsByCategory("developer").slice(0, 6);
  const imageTools = toolsByCategory("image").slice(0, 8);
  const pdfTools = toolsByCategory("pdf").slice(0, 8);
  const games = toolsByCategory("game");

  return (
    <>
      <JsonLd data={itemListSchema(FEATURED_TOOLS, "Popular DO101 tools")} />

      {/* ---------------------------------- HERO ---------------------------------- */}
      <section className="relative overflow-hidden border-b-2 border-[var(--border)] bg-[var(--panel)]">
        <div className="mx-auto w-full max-w-4xl px-4 py-12 text-center sm:py-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
            <span aria-hidden>✨</span>
{TOOLS.length} free tools · no sign-up · no upload
          </p>

          <h1 className="text-4xl leading-[1.05] sm:text-6xl">
            {/* Server-rendered English stays in the markup for search engines;
                the client swaps in the visitor's language after hydration. */}
            <T k="hero.tagline" />
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-lg font-semibold text-[var(--muted)]">
            <T k="hero.subtitle" />
          </p>

          <div className="mt-8">
            <p className="mb-3 text-sm font-extrabold uppercase tracking-widest text-[var(--muted)]">
              <T k="hero.prompt" />
            </p>
            <HomeSearch />
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/tools/pdf" tone="grass" size="lg">
              📄 <T k="hero.browsePdf" />
            </ButtonLink>
            <ButtonLink href="/tools" tone="sky" size="lg">
              <T k="hero.browseAll" /> {TOOLS.length}
            </ButtonLink>
            <ButtonLink href="/ai" tone="panel" size="lg">
              <T k="hero.askAi" />
            </ButtonLink>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-extrabold text-[var(--muted)]">
            <li className="flex items-center gap-1.5">
              <span aria-hidden>🔒</span> <T k="hero.noUpload" />
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden>🙅</span> <T k="hero.noAccount" />
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden>♾️</span> <T k="hero.noLimits" />
            </li>
          </ul>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
        <RecentTools />

        {/* ------------------------------- CATEGORIES ------------------------------- */}
        <section aria-labelledby="paths-heading" className="mb-14">
          <h2 id="paths-heading" className="mb-1 text-2xl sm:text-3xl">
            Pick a path
          </h2>
          <p className="mb-5 text-sm font-semibold text-[var(--muted)]">
            Eleven categories, every one of them free.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CATEGORY_LINKS.map(({ key, href }) => {
              const meta = CATEGORY_META[key];
              return (
                <Link
                  key={key}
                  href={href}
                  className="do-card do-card-hover flex flex-col gap-2 p-4 sm:p-5"
                >
                  <span
                    aria-hidden
                    className="grid h-12 w-12 place-items-center rounded-2xl text-2xl"
                    style={{ background: `var(--${meta.accent}-soft)` }}
                  >
                    {meta.icon}
                  </span>
                  <span className="text-lg font-extrabold">{meta.label}</span>
                  <span className="text-sm font-semibold leading-snug text-[var(--muted)]">
                    {meta.blurb}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* -------------------------------- FEATURED -------------------------------- */}
        <section aria-labelledby="featured-heading" className="mb-14">
          <h2 id="featured-heading" className="mb-1 text-2xl sm:text-3xl">
            Start here
          </h2>
          <p className="mb-5 text-sm font-semibold text-[var(--muted)]">
            The tools we would show a friend first.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_TOOLS.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>

        <section aria-labelledby="pdf-heading" className="mb-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="pdf-heading" className="text-2xl sm:text-3xl">
                Free PDF tools
              </h2>
              <p className="text-sm font-semibold text-[var(--muted)]">
                Merge, split, compress, convert and sign — without uploading your documents.
              </p>
            </div>
            <ButtonLink href="/tools/pdf" tone="panel" size="sm">
              All PDF tools
            </ButtonLink>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pdfTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} compact />
            ))}
          </div>
        </section>

        <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} className="mb-14" />

        {/* ---------------------------------- NEWS ---------------------------------- */}
        <section aria-labelledby="news-heading" className="mb-14">
          <div className="do-card overflow-hidden">
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--sky-soft)] px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-[var(--sky-dark)] dark:text-[var(--sky)]">
                  <span aria-hidden>📰</span> News
                </p>
                <h2 id="news-heading" className="text-2xl sm:text-3xl">
                  Tech and AI news, {SOURCE_COUNT} sources, one page
                </h2>
                <p className="mt-3 text-base font-semibold text-[var(--muted)]">
                  Headlines from OpenAI, DeepMind, The Verge, Ars Technica, CoinDesk, Nature and
                  dozens more — merged, de-duplicated and refreshed continuously. Every link goes
                  straight to the publisher. No account, no newsletter, no tracking.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink href="/news" tone="sky">
                    Read the news
                  </ButtonLink>
                  <ButtonLink href="/news/ai" tone="panel">
                    🤖 AI only
                  </ButtonLink>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {NEWS_CATEGORIES.map((category) => {
                  const meta = CATEGORY_LABELS[category];
                  return (
                    <li key={category}>
                      <Link
                        href={`/news/${category}`}
                        className="flex items-center gap-2 rounded-xl border-2 border-[var(--border)] px-3 py-2.5 text-sm font-extrabold transition-colors hover:bg-[var(--panel)]"
                      >
                        <span aria-hidden>{meta.icon}</span>
                        {meta.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        {/* --------------------------------- GAMES --------------------------------- */}
        <section aria-labelledby="games-heading" className="mb-14">
          <div className="do-card overflow-hidden">
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--cherry-soft)] px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-[var(--cherry-dark)] dark:text-[var(--cherry)]">
                  <span aria-hidden>🎮</span> Games
                </p>
                <h2 id="games-heading" className="text-2xl sm:text-3xl">
                  How fast can you actually type?
                </h2>
                <p className="mt-3 text-base font-semibold text-[var(--muted)]">
                  Take the 60-second typing test, then challenge a friend to a live 1v1 in Typing
                  Battle. Your best scores are saved on your device — no account, no leaderboard
                  full of strangers.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink href="/games/typing-test" tone="cherry">
                    Take the typing test
                  </ButtonLink>
                  <ButtonLink href="/games" tone="panel">
                    All games
                  </ButtonLink>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {games.map((game) => (
                  <Link
                    key={game.id}
                    href={game.route}
                    className="rounded-2xl border-2 border-[var(--border)] p-4 transition-colors hover:bg-[var(--panel)]"
                  >
                    <span aria-hidden className="text-2xl">
                      {game.icon}
                    </span>
                    <span className="mt-2 block text-sm font-extrabold">{game.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------ SEO CONTENT ------------------------------ */}
        <section aria-labelledby="what-heading" className="mb-14 max-w-3xl">
          <h2 id="what-heading" className="mb-4 text-2xl sm:text-3xl">
            What is DO101?
          </h2>
          <div className="space-y-4 text-base font-semibold leading-relaxed text-[var(--muted)]">
            <p>
              DO101 is a free collection of {TOOLS.length} everyday online tools: a full set of PDF
              tools, image compressors and converters, document and data converters, text utilities,
              developer tools like a JSON formatter and Base64 encoder, SEO helpers, practical
              calculators, a QR code generator and a few quick browser games. There is nothing to
              install and nothing to sign up for.
            </p>
            <p>
              The idea is simple. You usually arrive at a tools site with one specific job —
              &ldquo;compress this photo under 200 KB&rdquo;, &ldquo;make this JSON readable&rdquo;,
              &ldquo;how old is someone born in 1997&rdquo;. DO101 gets you to the answer in as few
              clicks as possible, then points you at the tool you are likely to need next.
            </p>

            <h3 className="pt-2 text-xl text-[var(--ink)]">Why browser-based tools?</h3>
            <p>
              Most DO101 tools never send your data anywhere. Image compression, resizing and
              conversion happen with the canvas API built into your browser. JSON, Base64, hashing
              and regex all run locally too. That means three things: your files stay private, the
              result is instant because there is no round trip to a server, and the tools keep
              working even on a slow connection.
            </p>
            <p>
              Where a tool does need a server — the optional AI assistant is the only one — the page
              says so plainly. You can read exactly what happens where on the{" "}
              <Link href="/privacy" className="font-extrabold text-[var(--ink)] underline">
                privacy page
              </Link>
              .
            </p>

            <h3 className="pt-2 text-xl text-[var(--ink)]">What people come here to do</h3>
            <p>
              The jobs that bring most people to DO101 are{" "}
              <Link href="/tools/pdf-merge" className="font-extrabold text-[var(--ink)] underline">
                merging PDFs
              </Link>
              ,{" "}
              <Link href="/tools/pdf-to-word" className="font-extrabold text-[var(--ink)] underline">
                turning a PDF into an editable Word file
              </Link>
              ,{" "}
              <Link href="/tools/image-compressor" className="font-extrabold text-[var(--ink)] underline">
                compressing a photo under a size limit
              </Link>
              ,{" "}
              <Link href="/tools/heic-to-jpg" className="font-extrabold text-[var(--ink)] underline">
                opening an iPhone HEIC photo
              </Link>
              ,{" "}
              <Link href="/tools/json-formatter" className="font-extrabold text-[var(--ink)] underline">
                making JSON readable
              </Link>{" "}
              and{" "}
              <Link href="/tools/word-counter" className="font-extrabold text-[var(--ink)] underline">
                counting words
              </Link>
              . Each one is a full page with the working tool at the top and a proper explanation
              underneath.
            </p>

            <h3 className="pt-2 text-xl text-[var(--ink)]">What DO101 will not do</h3>
            <p>
              Being useful means being honest about the edges. DO101 does not offer PDF password
              removal or encryption, because a browser cannot do either reliably. Its PDF-to-Word
              conversion recovers text and paragraphs but not page layout, and it says so on the
              page rather than handing back a mangled document. There are no invented usage
              statistics, no fake reviews and no simulated opponents anywhere on the site.
            </p>
          </div>
        </section>

        {/* --------------------------- DEV + IMAGE BLOCKS --------------------------- */}
        <section aria-labelledby="dev-heading" className="mb-14">
          <h2 id="dev-heading" className="mb-1 text-2xl sm:text-3xl">
            Free developer tools
          </h2>
          <p className="mb-5 text-sm font-semibold text-[var(--muted)]">
            The utilities you keep in a browser tab all day — without the ad walls.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {devTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} compact />
            ))}
          </div>
          <div className="mt-4">
            <ButtonLink href="/tools?category=developer" tone="panel" size="sm">
              All developer tools
            </ButtonLink>
          </div>
        </section>

        <section aria-labelledby="image-heading">
          <h2 id="image-heading" className="mb-1 text-2xl sm:text-3xl">
            Free image tools
          </h2>
          <p className="mb-5 text-sm font-semibold text-[var(--muted)]">
            Compress, resize and convert — your photos never leave the device.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {imageTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} compact />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
