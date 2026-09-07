import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { buildMetadata } from "@/lib/seo/metadata";
import { NEWS_SOURCES, SOURCE_COUNT } from "@/lib/news/sources";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/news/types";

export const metadata: Metadata = buildMetadata({
  title: "News Sources — Every Feed DO101 Reads | DO101",
  description:
    "The complete list of the 74 public RSS and Atom feeds DO101 reads, grouped by topic, with a link to each publisher and to its feed.",
  path: "/news/sources",
});

export default function SourcesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "News", href: "/news" },
          { name: "Sources", href: "/news/sources" },
        ]}
      />

      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl">Where the news comes from</h1>
        <p className="mt-2 max-w-2xl text-base font-semibold text-[var(--muted)]">
          Every one of the {SOURCE_COUNT} feeds DO101 reads, listed in full. Each is a public RSS or
          Atom feed the publisher provides for exactly this purpose, and each was fetched and parsed
          successfully before being added.
        </p>
      </header>

      <Card className="mb-8 p-5">
        <h2 className="text-lg">What DO101 does with them</h2>
        <ul className="mt-3 space-y-2 text-sm font-semibold text-[var(--muted)]">
          <li>
            ✅ Shows the <strong className="text-[var(--ink)]">headline</strong>, a short excerpt the
            feed itself publishes, the source name and the time.
          </li>
          <li>
            ✅ Links every item <strong className="text-[var(--ink)]">straight to the publisher</strong>,
            so the people who did the reporting get the visit.
          </li>
          <li>
            ❌ Never copies or republishes a full article, and never puts a DO101 wrapper around
            someone else&rsquo;s page.
          </li>
          <li>
            ❌ Stores nothing. There is no database — pages are rebuilt from the feeds at most once
            every 20 minutes and cached.
          </li>
        </ul>
        <p className="mt-4 text-sm font-semibold text-[var(--muted)]">
          If you publish one of these feeds and would rather not be included, get in touch through
          the <Link href="/contact" className="font-extrabold text-[var(--ink)] underline">contact page</Link>{" "}
          and it will be removed.
        </p>
      </Card>

      <div className="space-y-8">
        {CATEGORY_ORDER.map((category) => {
          const meta = CATEGORY_LABELS[category];
          const sources = NEWS_SOURCES.filter((s) => s.category === category);
          return (
            <section key={category} aria-labelledby={`sources-${category}`}>
              <h2 id={`sources-${category}`} className="mb-1 flex items-center gap-2 text-2xl">
                <span aria-hidden>{meta.icon}</span>
                {meta.label}
                <span className="text-sm font-extrabold text-[var(--muted)]">
                  ({sources.length})
                </span>
              </h2>
              <p className="mb-3 text-sm font-semibold text-[var(--muted)]">{meta.blurb}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {sources.map((source) => (
                  <li key={source.id}>
                    <Card className="flex items-center justify-between gap-3 p-3">
                      <a
                        href={source.site}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="min-w-0 flex-1 truncate text-sm font-extrabold hover:underline"
                      >
                        {source.name}
                      </a>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="shrink-0 rounded-lg bg-[var(--panel)] px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        Feed
                      </a>
                    </Card>
                  </li>
                ))}
              </ul>
              <p className="mt-3">
                <Link
                  href={`/news/${category}`}
                  className="text-sm font-extrabold text-[var(--grass)] hover:underline"
                >
                  Read {meta.label.toLowerCase()} news →
                </Link>
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
