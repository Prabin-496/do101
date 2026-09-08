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

/** Grouped by what each one actually measures, rather than one long list. */
const GROUPS = [
  {
    title: "Speed and reflexes",
    icon: "⚡",
    blurb: "How fast can you react, click and aim?",
    ids: ["reaction-test", "aim-trainer", "click-speed-test", "typing-test", "typing-battle"],
  },
  {
    title: "Memory",
    icon: "🧠",
    blurb: "How much can you hold in your head at once?",
    ids: ["memory-test", "number-memory", "visual-memory", "chimp-test"],
  },
  {
    title: "Focus and perception",
    icon: "👁️",
    blurb: "Attention, colour discrimination and cognitive control.",
    ids: ["color-match", "color-vision"],
  },
  {
    title: "Puzzles and words",
    icon: "🧩",
    blurb: "Slower games for when you want to think rather than twitch.",
    ids: ["2048", "math-sprint", "word-scramble"],
  },
];

export const metadata: Metadata = buildMetadata({
  title: "14 Free Browser Games — Typing, Memory & Reflex | DO101",
  description:
    "14 free browser games: typing speed test, 1v1 typing battle, reaction time, aim trainer, click speed, memory tests, Stroop test, maths sprint and 2048. No sign-up.",
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
          Fourteen quick browser games that measure something real: how fast you type, how quickly
          you react, how sharp your eyes are and how much you can hold in your head. Every best
          score is saved on your own device — no account, no leaderboard full of strangers.
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

      {GROUPS.map((group) => {
        const inGroup = games.filter((game) => group.ids.includes(game.id));
        if (!inGroup.length) return null;
        return (
          <section key={group.title} aria-labelledby={`group-${group.title}`} className="mb-10">
            <h2 id={`group-${group.title}`} className="mb-1 text-2xl">
              {group.icon} {group.title}
            </h2>
            <p className="mb-4 text-sm font-semibold text-[var(--muted)]">{group.blurb}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inGroup.map((game) => (
                <ToolCard key={game.id} tool={game} />
              ))}
            </div>
          </section>
        );
      })}

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
