import Link from "next/link";
import type { Metadata } from "next";
import { HomeSearch } from "@/components/layout/HomeSearch";
import { ButtonLink } from "@/components/ui/Button";
import { ToolCard } from "@/components/tools/ToolCard";
import { AdSlot } from "@/components/tools/AdSlot";
import { RecentTools } from "@/components/tools/RecentTools";
import { JsonLd } from "@/components/seo/JsonLd";
import { itemListSchema } from "@/lib/seo/structured-data";
import { buildMetadata } from "@/lib/seo/metadata";
import { TOOLS, FEATURED_TOOLS, toolsByCategory } from "@/lib/tools/tool-registry";
import { CATEGORY_META } from "@/lib/tools/types";

export const metadata: Metadata = buildMetadata({
  title: "DO101 — Free Online Tools, Calculators & Games",
  description:
    "Free online tools for images, text, developers, calculations and productivity, plus typing and reaction games. Fast, simple and browser-first.",
  path: "/",
});

const CATEGORY_LINKS = [
  { key: "image", href: "/tools?category=image" },
  { key: "text", href: "/tools?category=text" },
  { key: "developer", href: "/tools?category=developer" },
  { key: "calculator", href: "/calculators" },
  { key: "productivity", href: "/tools?category=productivity" },
  { key: "game", href: "/games" },
] as const;

export default function HomePage() {
  const devTools = toolsByCategory("developer").slice(0, 6);
  const imageTools = toolsByCategory("image");
  const games = toolsByCategory("game");

  return (
    <>
      <JsonLd data={itemListSchema(FEATURED_TOOLS, "Popular DO101 tools")} />

      {/* ---------------------------------- HERO ---------------------------------- */}
      <section className="relative overflow-hidden border-b-2 border-[var(--border)] bg-[var(--panel)]">
        <div className="mx-auto w-full max-w-4xl px-4 py-12 text-center sm:py-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
            <span aria-hidden>✨</span>
            {TOOLS.length} free tools · no sign-up
          </p>

          <h1 className="text-4xl leading-[1.05] sm:text-6xl">
            Do more.{" "}
            <span className="text-[var(--grass)]">Simply.</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-lg font-semibold text-[var(--muted)]">
            Free online tools, fast answers, and fun challenges — all in one place. Most of them run
            right inside your browser, so nothing is uploaded.
          </p>

          <div className="mt-8">
            <p className="mb-3 text-sm font-extrabold uppercase tracking-widest text-[var(--muted)]">
              What do you want to do?
            </p>
            <HomeSearch />
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/tools" tone="grass" size="lg">
              Browse tools
            </ButtonLink>
            <ButtonLink href="/games/typing-battle" tone="cherry" size="lg">
              ⚔️ Try Typing Battle
            </ButtonLink>
            <ButtonLink href="/ai" tone="panel" size="lg">
              Ask DO101 AI
            </ButtonLink>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-extrabold text-[var(--muted)]">
            <li className="flex items-center gap-1.5">
              <span aria-hidden>🔒</span> Files never uploaded
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden>⚡</span> Instant results
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden>🆓</span> Free, forever
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
            Six categories, every one of them free.
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

        <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} className="mb-14" />

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
              DO101 is a free collection of everyday online tools: image compressors and resizers,
              text counters and cleaners, developer utilities like a JSON formatter and Base64
              encoder, practical calculators, a QR code generator, and a set of quick browser games.
              There is nothing to install and nothing to sign up for.
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

            <h3 className="pt-2 text-xl text-[var(--ink)]">Popular online tools</h3>
            <p>
              The most-used pages on DO101 are the{" "}
              <Link href="/tools/image-compressor" className="font-extrabold text-[var(--ink)] underline">
                image compressor
              </Link>
              , the{" "}
              <Link href="/tools/json-formatter" className="font-extrabold text-[var(--ink)] underline">
                JSON formatter
              </Link>
              , the{" "}
              <Link href="/tools/word-counter" className="font-extrabold text-[var(--ink)] underline">
                word counter
              </Link>{" "}
              and the{" "}
              <Link href="/games/typing-test" className="font-extrabold text-[var(--ink)] underline">
                typing speed test
              </Link>
              . Each one is a full page with the tool at the top and a proper explanation
              underneath.
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
