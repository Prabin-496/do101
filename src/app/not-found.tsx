import Link from "next/link";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { ToolCard } from "@/components/tools/ToolCard";
import { FEATURED_TOOLS } from "@/lib/tools/tool-registry";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:py-24">
      <span aria-hidden className="do-bob block text-7xl">
        🧭
      </span>
      <h1 className="mt-6 text-4xl sm:text-5xl">Looks like this page doesn&rsquo;t exist.</h1>
      <p className="mx-auto mt-3 max-w-md text-base font-semibold text-[var(--muted)]">
        The link may be old, or there may be a typo in the address. Everything DO101 has is one click
        away.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/" tone="grass" size="lg">
          Go home
        </ButtonLink>
        <ButtonLink href="/tools" tone="sky" size="lg">
          Browse tools
        </ButtonLink>
        <ButtonLink href="/games/typing-test" tone="cherry" size="lg">
          Try the typing test
        </ButtonLink>
      </div>

      <p className="mt-6 text-sm font-extrabold text-[var(--muted)]">
        Tip: press <kbd className="rounded-md bg-[var(--panel)] px-1.5 py-0.5">⌘K</kbd> anywhere on
        DO101 to search every tool.
      </p>

      <section className="mt-14 text-left">
        <h2 className="mb-4 text-2xl">Popular tools</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURED_TOOLS.slice(0, 6).map((tool) => (
            <ToolCard key={tool.id} tool={tool} compact />
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm font-semibold text-[var(--muted)]">
        Still stuck? <Link href="/contact" className="font-extrabold underline">Tell us what you were looking for.</Link>
      </p>
    </div>
  );
}
