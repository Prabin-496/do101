import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "./Breadcrumbs";
import { ToolCard } from "./ToolCard";
import { AdSlot } from "./AdSlot";
import { Faq } from "./Faq";
import { ButtonLink } from "@/components/ui/Button";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListSchema, breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";
import { toolsByCategory } from "@/lib/tools/tool-registry";
import { CATEGORY_META, type ToolCategory, type ToolFaq } from "@/lib/tools/types";

export interface CategoryPageConfig {
  category: ToolCategory;
  path: string;
  title: string;
  description: string;
  heading: string;
  lead: string;
  /** Two to four paragraphs of genuinely useful, category-specific copy. */
  body: Array<{ heading?: string; text: React.ReactNode }>;
  faqs?: ToolFaq[];
}

export function categoryMetadata(config: CategoryPageConfig): Metadata {
  return buildMetadata({
    title: config.title,
    description: config.description,
    path: config.path,
  });
}

export function CategoryLanding({ config }: { config: CategoryPageConfig }) {
  const meta = CATEGORY_META[config.category];
  const tools = toolsByCategory(config.category);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          itemListSchema(tools, `${meta.label} tools on DO101`),
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "Tools", href: "/tools" },
            { name: meta.label, href: config.path },
          ]),
          ...(config.faqs?.length ? [faqSchema(config.faqs)!] : []),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Tools", href: "/tools" },
          { name: meta.label, href: config.path },
        ]}
      />

      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl sm:text-4xl">
          <span aria-hidden>{meta.icon}</span>
          {config.heading}
        </h1>
        <p className="mt-2 max-w-2xl text-base font-semibold text-[var(--muted)]">{config.lead}</p>
        <p className="mt-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
          {tools.length} free tool{tools.length === 1 ? "" : "s"} · no sign-up · nothing uploaded
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_DIRECTORY} className="mt-10" />

      <section className="mt-14 max-w-3xl space-y-4 text-base font-semibold leading-relaxed text-[var(--muted)]">
        {config.body.map((block, i) => (
          <div key={i} className="space-y-3">
            {block.heading ? (
              <h2 className="pt-2 text-2xl text-[var(--ink)]">{block.heading}</h2>
            ) : null}
            <div className="space-y-3">{block.text}</div>
          </div>
        ))}
      </section>

      {config.faqs?.length ? (
        <div className="mt-14">
          <Faq items={config.faqs} />
        </div>
      ) : null}

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href="/tools" tone="panel">
          All DO101 tools
        </ButtonLink>
        <ButtonLink href="/" tone="panel">
          Back to the homepage
        </ButtonLink>
      </div>

      <nav aria-label="Other categories" className="mt-10">
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-widest text-[var(--muted)]">
          Other categories
        </h2>
        <ul className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_META) as ToolCategory[])
            .filter((c) => c !== config.category)
            .map((c) => {
              const other = CATEGORY_META[c];
              const href =
                c === "calculator"
                  ? "/calculators"
                  : c === "game"
                    ? "/games"
                    : c === "productivity"
                      ? "/tools"
                      : `/tools/${other.slug}`;
              return (
                <li key={c}>
                  <Link
                    href={href}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--border)] px-3 py-2 text-sm font-extrabold transition-colors hover:bg-[var(--panel)]"
                  >
                    <span aria-hidden>{other.icon}</span>
                    {other.label}
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>
    </div>
  );
}
