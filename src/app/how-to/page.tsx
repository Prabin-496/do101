import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { PageHeader } from "@/components/layout/Prose";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema } from "@/lib/seo/structured-data";
import { GUIDES, guidePath } from "@/lib/guides/guides";
import { getTool } from "@/lib/tools/tool-registry";
import { CATEGORY_META, type ToolCategory } from "@/lib/tools/types";
import { SITE, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "How-To Guides — Free Ways to Get Everyday Jobs Done | DO101",
  description:
    "Short, specific guides: merge PDFs without uploading them, compress a photo under 100 KB, convert iPhone HEIC to JPG, calculate a loan EMI and more — each with a free tool.",
  path: "/how-to",
});

/** Guides grouped under their tool's category, categories in first-appearance order. */
function grouped() {
  const groups = new Map<ToolCategory, typeof GUIDES>();
  for (const guide of GUIDES) {
    const category = getTool(guide.tool)!.category;
    groups.set(category, [...(groups.get(category) ?? []), guide]);
  }
  return [...groups];
}

export default function HowToIndex() {
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "How-to guides", href: "/how-to" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `How-to guides on ${SITE.name}`,
            numberOfItems: GUIDES.length,
            itemListElement: GUIDES.map((guide, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: guide.heading,
              url: absoluteUrl(guidePath(guide)),
            })),
          },
          breadcrumbSchema(crumbs),
        ]}
      />
      <Breadcrumbs items={crumbs} />
      <PageHeader
        title="How-to guides"
        lead="One job per page: the answer first, then the steps, then what to watch out for. Every guide ends at a free tool that does the job in your browser."
      />

      <div className="space-y-10">
        {grouped().map(([category, guides]) => (
          <section key={category} aria-labelledby={`guides-${category}`}>
            <h2 id={`guides-${category}`} className="mb-4 flex items-center gap-2 text-xl sm:text-2xl">
              <span aria-hidden>{CATEGORY_META[category].icon}</span>
              {CATEGORY_META[category].label}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {guides.map((guide) => (
                <li key={guide.slug}>
                  <Link href={guidePath(guide)} className="do-card do-card-hover block h-full p-4">
                    <span className="block text-base font-extrabold">{guide.heading}</span>
                    <span className="mt-1 block text-sm font-semibold text-[var(--muted)]">
                      {guide.seoDescription}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
