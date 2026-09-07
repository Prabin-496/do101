import Link from "next/link";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { AdSlot } from "@/components/tools/AdSlot";
import { NewsList } from "./NewsList";
import { Card } from "@/components/ui/Card";
import { CATEGORY_LABELS, CATEGORY_ORDER, type NewsCategory } from "@/lib/news/types";
import type { NewsFeedSnapshot } from "@/lib/news/fetch";
import { cn } from "@/lib/utils/cn";

/** Shared chrome for the news hub and every category page. */
export function NewsShell({
  active,
  snapshot,
  heading,
  lead,
  children,
}: {
  active: NewsCategory | "all";
  snapshot: NewsFeedSnapshot;
  heading: string;
  lead: string;
  children?: React.ReactNode;
}) {
  const updated = new Date(snapshot.fetchedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "News", href: "/news" },
          ...(active === "all"
            ? []
            : [{ name: CATEGORY_LABELS[active].label, href: `/news/${active}` }]),
        ]}
      />

      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl">{heading}</h1>
        <p className="mt-2 max-w-2xl text-base font-semibold text-[var(--muted)]">{lead}</p>
        <p className="mt-3 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          {snapshot.items.length} headlines · {snapshot.sourcesOk} of {snapshot.sourcesTotal} feeds
          answered · updated {updated}
        </p>
      </header>

      <nav aria-label="News categories" className="do-scroll -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link
          href="/news"
          className={cn(
            "shrink-0 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-colors",
            active === "all"
              ? "border-[var(--grass)] bg-[var(--grass-soft)] text-[var(--grass-dark)] dark:text-[var(--grass)]"
              : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--panel)]",
          )}
        >
          ✨ Everything
        </Link>
        {CATEGORY_ORDER.map((category) => {
          const meta = CATEGORY_LABELS[category];
          return (
            <Link
              key={category}
              href={`/news/${category}`}
              className={cn(
                "shrink-0 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-colors",
                active === category
                  ? "border-[var(--grass)] bg-[var(--grass-soft)] text-[var(--grass-dark)] dark:text-[var(--grass)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--panel)]",
              )}
            >
              {meta.icon} {meta.label}
            </Link>
          );
        })}
      </nav>

      {snapshot.items.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-lg font-extrabold">No headlines right now</p>
          <p className="mt-2 text-sm font-semibold text-[var(--muted)]">
            Every feed either timed out or returned nothing. This page rebuilds itself
            periodically — try again shortly.
          </p>
        </Card>
      ) : (
        <NewsList items={snapshot.items} showCategory={active === "all"} />
      )}

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_NEWS} className="mt-10" />

      {children}

      <section className="mt-14 max-w-3xl space-y-4 text-base font-semibold leading-relaxed text-[var(--muted)]">
        <h2 className="text-2xl text-[var(--ink)]">How this page works</h2>
        <p>
          DO101 reads {snapshot.sourcesTotal === 74 ? "74" : snapshot.sourcesTotal} public RSS and
          Atom feeds published by the outlets themselves, merges them, removes duplicate stories and
          orders them by time. It shows you the headline, a short excerpt and a link{" "}
          <strong className="text-[var(--ink)]">straight to the publisher</strong>.
        </p>
        <p>
          Full articles are never copied. Every link opens the original story on the original site,
          so the people who did the reporting get the visit. You can see{" "}
          <Link href="/news/sources" className="font-extrabold text-[var(--ink)] underline">
            exactly which feeds are read
          </Link>{" "}
          and which of them answered this time.
        </p>
        <p>
          The page is rebuilt at most once every 20 minutes and cached, which is what keeps it fast
          and keeps it free to run. There is no tracking, no account and no newsletter.
        </p>
      </section>
    </div>
  );
}
