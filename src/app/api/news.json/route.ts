import { getNews, REVALIDATE_SECONDS } from "@/lib/news/fetch";
import { SOURCE_COUNT } from "@/lib/news/sources";
import { CATEGORY_ORDER, type NewsCategory } from "@/lib/news/types";
import { absoluteUrl, SITE } from "@/lib/site";

export const revalidate = 1200;

/**
 * Public JSON feed of the merged headlines.
 *
 * Built for assistants and for anyone wanting the aggregated list without
 * scraping the page. Titles, links, timestamps and the feed's own excerpt only
 * — never article bodies, which belong to the publishers.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("category");
  const category: NewsCategory | "all" =
    requested && CATEGORY_ORDER.includes(requested as NewsCategory)
      ? (requested as NewsCategory)
      : "all";

  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));
  const snapshot = await getNews(category, limit);

  return Response.json(
    {
      site: SITE.name,
      page: absoluteUrl(category === "all" ? "/news" : `/news/${category}`),
      category,
      sourceCount: SOURCE_COUNT,
      sourcesAnswered: snapshot.sourcesOk,
      refreshedEvery: `${Math.round(REVALIDATE_SECONDS / 60)} minutes`,
      fetchedAt: new Date(snapshot.fetchedAt).toISOString(),
      note: "Headlines and short excerpts aggregated from public RSS and Atom feeds. Full articles are never reproduced — follow each link to the publisher.",
      items: snapshot.items.map((item) => ({
        title: item.title,
        url: item.link,
        source: item.sourceName,
        category: item.category,
        publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
        excerpt: item.excerpt,
      })),
    },
    {
      headers: {
        "cache-control": `public, max-age=600, s-maxage=${REVALIDATE_SECONDS}`,
        "access-control-allow-origin": "*",
      },
    },
  );
}
