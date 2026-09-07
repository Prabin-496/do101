import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsShell } from "@/components/news/NewsShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema } from "@/lib/seo/structured-data";
import { getNews } from "@/lib/news/fetch";
import { sourcesFor } from "@/lib/news/sources";
import { CATEGORY_LABELS, CATEGORY_ORDER, type NewsCategory } from "@/lib/news/types";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 1200;

/** Only these eight exist; anything else 404s rather than rendering an empty page. */
export function generateStaticParams() {
  return CATEGORY_ORDER.map((category) => ({ category }));
}

export const dynamicParams = false;

const COPY: Record<NewsCategory, { title: string; description: string; lead: string; body: string[] }> = {
  ai: {
    title: "Latest AI News — Models, Research & Tools | DO101",
    description:
      "The latest artificial intelligence news from OpenAI, DeepMind, Hugging Face, MIT Technology Review and more, merged into one page and refreshed every 20 minutes.",
    lead: "What the labs shipped, what researchers published and what it means — pulled straight from the sources.",
    body: [
      "AI moves faster than any single publication can cover, and the interesting material is split between company blogs, research groups and the trade press. A model release is announced on a lab's own blog; the analysis of why it matters appears somewhere else entirely.",
      "This page reads both kinds of source together: the primary announcements from OpenAI, Google AI, DeepMind, Hugging Face, NVIDIA and AWS, alongside coverage from MIT Technology Review, IEEE Spectrum, AI Business and the newsletters that track the field week by week.",
    ],
  },
  tech: {
    title: "Latest Technology News — One Page, Many Sources | DO101",
    description:
      "Technology headlines from The Verge, Ars Technica, Wired, TechCrunch, Engadget, BBC and more, merged and de-duplicated. Free and updated every 20 minutes.",
    lead: "The industry at large: products, platforms, policy and the companies behind them.",
    body: [
      "The same story often breaks across a dozen outlets within an hour. This page merges them, removes the duplicates and orders what is left by time, so you see the news rather than the same headline eight times.",
      "No single publisher is allowed to dominate: each source contributes a limited number of items, which keeps the mix wide even when one newsroom is having a busy afternoon.",
    ],
  },
  dev: {
    title: "Developer News — Engineering, Web & Infrastructure | DO101",
    description:
      "Developer and engineering news from GitHub, Stack Overflow, Cloudflare, Mozilla, Smashing Magazine, InfoQ and more. Free, no account, updated continuously.",
    lead: "Engineering, the web platform, languages, tooling and the infrastructure underneath.",
    body: [
      "Engineering news lives on company blogs more than in the press: a platform change is announced by the platform, and the discussion happens afterwards. This page reads the sources directly.",
      "Expect release notes, deep technical write-ups, browser and standards news, and the occasional post-mortem worth learning from.",
    ],
  },
  crypto: {
    title: "Crypto News — Bitcoin, Ethereum & Markets | DO101",
    description:
      "Cryptocurrency headlines from CoinDesk, Cointelegraph, Decrypt, The Block and more, merged into one page. Free, updated every 20 minutes, no account.",
    lead: "Bitcoin, Ethereum, regulation and the wider digital-asset market.",
    body: [
      "Crypto coverage is fast, fragmented and often promotional. Reading several outlets side by side makes it much easier to tell a genuine development from a press release with a headline attached.",
      "DO101 does not filter for sentiment and does not rank by how bullish a story is. Everything is ordered by time, from the sources listed on the sources page.",
    ],
  },
  finance: {
    title: "Finance & Markets News — Free Aggregator | DO101",
    description:
      "Market and finance headlines from CNBC, MarketWatch, Yahoo Finance, the Financial Times and more, merged into one free page updated every 20 minutes.",
    lead: "Markets, earnings and the money side of technology.",
    body: [
      "Financial headlines are time-sensitive and heavily duplicated across wires. This page merges them so the same earnings story does not appear five times in a row.",
      "Nothing here is financial advice, and DO101 has no view on any asset. It is a reading list of what the listed publications are reporting, linked back to them.",
    ],
  },
  startups: {
    title: "Startup News — Funding, Launches & Products | DO101",
    description:
      "Startup and funding news from Y Combinator, Crunchbase, TechCrunch, Product Hunt and Sifted, merged into one free page. No account, updated every 20 minutes.",
    lead: "Funding rounds, launches and what is being built next.",
    body: [
      "Startup news splits between funding coverage and product launches. Both are here: Crunchbase and TechCrunch for the money, Product Hunt and Y Combinator for what actually shipped this week.",
      "The Product Hunt feed in particular is a good daily read if you want to see new tools — including AI tools — as they launch, rather than a directory that was accurate six months ago.",
    ],
  },
  security: {
    title: "Cybersecurity News — Breaches & Vulnerabilities | DO101",
    description:
      "Security headlines from Krebs on Security, The Hacker News, BleepingComputer, Schneier and Dark Reading, merged into one free page updated every 20 minutes.",
    lead: "Breaches, vulnerabilities, and the defensive practice worth copying.",
    body: [
      "Security news is worth reading in aggregate, because the same vulnerability is often described very differently by a vendor blog and by an independent researcher.",
      "This page mixes both: independent voices like Krebs and Schneier alongside the industry press that tracks disclosures day to day.",
    ],
  },
  science: {
    title: "Science News — Research, Space & Discovery | DO101",
    description:
      "Science headlines from Nature, Quanta, Scientific American, NASA, Phys.org and IEEE Spectrum, merged into one free page updated every 20 minutes.",
    lead: "Research, space and the discoveries that become tomorrow's technology.",
    body: [
      "Today's research is next decade's product. This page reads journals and research organisations directly — Nature, NASA, Quanta — alongside the publications that translate them for a general audience.",
      "It is a deliberately slower feed than the technology page, and often the more interesting one.",
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const copy = COPY[category as NewsCategory];
  if (!copy) return {};
  return buildMetadata({
    title: copy.title,
    description: copy.description,
    path: `/news/${category}`,
  });
}

export default async function CategoryNewsPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!CATEGORY_ORDER.includes(category as NewsCategory)) notFound();

  const key = category as NewsCategory;
  const meta = CATEGORY_LABELS[key];
  const copy = COPY[key];
  const snapshot = await getNews(key, 160);
  const sources = sourcesFor(key);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "News", href: "/news" },
            { name: meta.label, href: `/news/${key}` },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${meta.label} news on DO101`,
            url: absoluteUrl(`/news/${key}`),
            description: copy.description,
            isAccessibleForFree: true,
          },
        ]}
      />
      <NewsShell
        active={key}
        snapshot={snapshot}
        heading={`${meta.icon} ${meta.label} news`}
        lead={copy.lead}
      >
        <section className="mt-12 max-w-3xl space-y-4 text-base font-semibold leading-relaxed text-[var(--muted)]">
          <h2 className="text-2xl text-[var(--ink)]">About this feed</h2>
          {copy.body.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
          <p>
            <strong className="text-[var(--ink)]">Sources read for this page:</strong>{" "}
            {sources.map((s) => s.name).join(", ")}.
          </p>
        </section>
      </NewsShell>
    </>
  );
}
