import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { ToolCard } from "@/components/tools/ToolCard";
import { ButtonLink } from "@/components/ui/Button";
import { AdSlot } from "@/components/tools/AdSlot";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { toolsByCategory } from "@/lib/tools/tool-registry";

const games = toolsByCategory("game");

export const metadata: Metadata = buildMetadata({
  title: "Free Browser Games — Typing, Reaction & Memory | DO101",
  description:
    "Play free browser games at DO101: a typing speed test, live 1v1 Typing Battle, a reaction time test and a sequence memory game. No sign-up, scores saved locally.",
  path: "/games",
});

export default function GamesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          itemListSchema(games, "DO101 games"),
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "Games", href: "/games" },
          ]),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Games", href: "/games" },
        ]}
      />

      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl">
          Games <span aria-hidden>🎮</span>
        </h1>
        <p className="mt-2 max-w-2xl text-base font-semibold text-[var(--muted)]">
          Four quick browser games that measure something real: how fast you type, how quickly you
          react, and how much you can hold in your head. Your best scores are saved on your own
          device — no account, no leaderboard full of strangers.
        </p>
      </header>

      <section className="mb-10">
        <Link
          href="/games/typing-battle"
          className="do-card do-card-hover block overflow-hidden bg-[var(--cherry-soft)]"
        >
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
            <span aria-hidden className="do-bob text-6xl">
              ⚔️
            </span>
            <div className="flex-1">
              <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
                Flagship
              </p>
              <h2 className="text-2xl sm:text-3xl">Typing Battle</h2>
              <p className="mt-2 text-base font-semibold text-[var(--muted)]">
                Share a link, race the same text, watch both progress bars move in real time. A
                genuine peer-to-peer connection — never a simulated opponent.
              </p>
            </div>
            <span className="do-btn [--btn-bg:var(--cherry)] [--btn-shadow:var(--cherry-dark)] [--btn-fg:#fff] shrink-0 px-6 py-3 text-sm">
              Start a race
            </span>
          </div>
        </Link>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {games.map((game) => (
          <ToolCard key={game.id} tool={game} />
        ))}
      </div>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GAMES} className="mt-10" />

      <section className="mt-14 max-w-3xl space-y-4 text-base font-semibold leading-relaxed text-[var(--muted)]">
        <h2 className="text-2xl text-[var(--ink)]">Why these four games?</h2>
        <p>
          Each one measures a real, repeatable thing, finishes in under a minute, and works the same
          on a phone as on a laptop. The typing test gives you a number you can actually train
          against. Typing Battle turns that number into a race. The reaction test uses the
          browser&rsquo;s high-resolution clock rather than a rough timer. And the memory game maps
          neatly onto the classic research on short-term memory span.
        </p>
        <h3 className="text-xl text-[var(--ink)]">Are the scores stored anywhere?</h3>
        <p>
          Only in your own browser. Personal bests live in localStorage on the device you played on,
          and you can wipe them at any time from the{" "}
          <Link href="/privacy#local-data" className="font-extrabold text-[var(--ink)] underline">
            privacy page
          </Link>
          . DO101 does not run a leaderboard, so there are no invented high scores to chase.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/tools" tone="panel">
          Browse the tools
        </ButtonLink>
        <ButtonLink href="/games/typing-test" tone="cherry">
          Take the typing test
        </ButtonLink>
      </div>
    </div>
  );
}
