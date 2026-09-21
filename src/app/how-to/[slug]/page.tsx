import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { ToolCard } from "@/components/tools/ToolCard";
import { Faq } from "@/components/tools/Faq";
import { AdSlot } from "@/components/tools/AdSlot";
import { ButtonLink } from "@/components/ui/Button";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema, faqSchema, howToSchema } from "@/lib/seo/structured-data";
import { GUIDES, getGuide, guidePath } from "@/lib/guides/guides";
import { getTool } from "@/lib/tools/tool-registry";

/** Every guide is known at build time; any other slug is a 404, not an empty page. */
export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  return buildMetadata({
    title: guide.seoTitle,
    description: guide.seoDescription,
    path: guidePath(guide),
    image: `/og/${guide.tool}`,
  });
}

export default async function GuidePage({ params }: Props) {
  const guide = getGuide((await params).slug);
  const tool = guide && getTool(guide.tool);
  if (!guide || !tool) notFound();

  const path = guidePath(guide);
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "How-to guides", href: "/how-to" },
    { name: guide.heading, href: path },
  ];
  const related = guide.related.map(getGuide).filter((g) => g !== undefined);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          howToSchema({ name: guide.heading, description: guide.seoDescription, path, steps: guide.steps, tool }),
          faqSchema(guide.faqs)!,
          breadcrumbSchema(crumbs),
        ]}
      />
      <Breadcrumbs items={crumbs} />

      <article className="space-y-10">
        <header>
          <h1 className="text-3xl leading-tight sm:text-4xl">{guide.heading}</h1>
          {/* The answer comes first, whole, so a reader — or a search snippet — has it in one paragraph. */}
          <div className="do-card mt-5 p-5">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
              Quick answer
            </p>
            <p className="text-base font-semibold leading-relaxed">{guide.answer}</p>
            <ButtonLink href={tool.route} size="lg" className="mt-5">
              <span aria-hidden>{tool.icon}</span> Open the {tool.name} — free
            </ButtonLink>
          </div>
        </header>

        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="mb-4 text-xl sm:text-2xl">
            Step by step
          </h2>
          <ol className="space-y-3">
            {guide.steps.map((step, i) => (
              <li key={step} id={`step-${i + 1}`} className="do-card flex items-start gap-3 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--grass)] text-sm font-extrabold text-white">
                  {i + 1}
                </span>
                <span className="pt-1 text-sm font-semibold">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOOL} />

        {guide.sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="text-xl sm:text-2xl">{section.heading}</h2>
            {section.paragraphs.map((text) => (
              <p key={text} className="text-base font-semibold leading-relaxed text-[var(--muted)]">
                {text}
              </p>
            ))}
          </section>
        ))}

        <Faq items={guide.faqs} />

        <section aria-labelledby="tool-heading">
          <h2 id="tool-heading" className="mb-4 text-xl sm:text-2xl">
            The tool for the job
          </h2>
          <ToolCard tool={tool} />
        </section>

        {related.length ? (
          <nav aria-labelledby="related-guides-heading">
            <h2 id="related-guides-heading" className="mb-4 text-xl sm:text-2xl">
              Related guides
            </h2>
            <ul className="space-y-2">
              {related.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={guidePath(g)}
                    className="do-card do-card-hover block px-4 py-3 text-sm font-extrabold"
                  >
                    {g.heading} →
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm font-semibold">
              <Link href="/how-to" className="underline">
                All how-to guides
              </Link>
            </p>
          </nav>
        ) : null}
      </article>
    </div>
  );
}
