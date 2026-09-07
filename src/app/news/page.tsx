import type { Metadata } from "next";
import Link from "next/link";
import { NewsShell } from "@/components/news/NewsShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema } from "@/lib/seo/structured-data";
import { getNews, REVALIDATE_SECONDS } from "@/lib/news/fetch";
import { SOURCE_COUNT } from "@/lib/news/sources";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/news/types";
import { absoluteUrl } from "@/lib/site";

/** Rebuilt on demand, at most once every 20 minutes, then served from cache. */
export const revalidate = 1200;

export const metadata: Metadata = buildMetadata({
  title: "Tech & AI News — 74 Sources, One Page | DO101",
  description:
    "The latest AI, technology, developer, crypto, finance, startup, security and science headlines from 74 sources, merged and de-duplicated. Free, no account.",
  path: "/news",
});

export default async function NewsPage() {
  const snapshot = await getNews("all", 240);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "News", href: "/news" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Tech and AI news on DO101",
            url: absoluteUrl("/news"),
            description: `Headlines aggregated from ${SOURCE_COUNT} public RSS and Atom feeds.`,
            isAccessibleForFree: true,
          },
        ]}
      />
      <NewsShell
        active="all"
        snapshot={snapshot}
        heading="Tech &amp; AI news"
        lead={`Everything worth knowing from ${SOURCE_COUNT} sources, merged into one page and refreshed every ${Math.round(REVALIDATE_SECONDS / 60)} minutes. No account, no newsletter, no tracking.`}
      >
        <section aria-labelledby="topics-heading" className="mt-12">
          <h2 id="topics-heading" className="mb-4 text-2xl">
            Browse by topic
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORY_ORDER.map((category) => {
              const meta = CATEGORY_LABELS[category];
              return (
                <li key={category}>
                  <Link
                    href={`/news/${category}`}
                    className="do-card do-card-hover flex h-full flex-col gap-1 p-4"
                  >
                    <span aria-hidden className="text-2xl">
                      {meta.icon}
                    </span>
                    <span className="text-base font-extrabold">{meta.label}</span>
                    <span className="text-xs font-semibold leading-snug text-[var(--muted)]">
                      {meta.blurb}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </NewsShell>
    </>
  );
}
