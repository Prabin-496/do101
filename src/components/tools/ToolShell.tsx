import * as React from "react";
import type { Tool } from "@/lib/tools/types";
import { CATEGORY_META } from "@/lib/tools/types";
import { Breadcrumbs } from "./Breadcrumbs";
import { Faq } from "./Faq";
import { RelatedTools } from "./RelatedTools";
import { AdSlot } from "./AdSlot";
import { ToolVisitTracker } from "./ToolVisitTracker";
import { InfoNote } from "@/components/ui/Feedback";

const ACCENT_RING: Record<Tool["accent"], string> = {
  grass: "bg-[var(--grass-soft)]",
  sky: "bg-[var(--sky-soft)]",
  grape: "bg-[var(--grape-soft)]",
  fire: "bg-[var(--fire-soft)]",
  sun: "bg-[var(--sun-soft)]",
  cherry: "bg-[var(--cherry-soft)]",
};

/**
 * Standard layout for every tool page: the working tool sits directly under
 * the H1, and the explanatory SEO content follows underneath it.
 */
export function ToolShell({
  tool,
  children,
  extraContent,
}: {
  tool: Tool;
  children: React.ReactNode;
  extraContent?: React.ReactNode;
}) {
  const category = CATEGORY_META[tool.category];
  const categoryHref =
    tool.category === "game"
      ? "/games"
      : tool.category === "calculator"
        ? "/calculators"
        : `/tools?category=${category.slug}`;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <ToolVisitTracker id={tool.id} />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: category.label, href: categoryHref },
          { name: tool.name, href: tool.route },
        ]}
      />

      <header className="mb-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl ${ACCENT_RING[tool.accent]}`}
          >
            {tool.icon}
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl leading-tight sm:text-4xl">{tool.name}</h1>
            <p className="mt-2 text-base font-semibold text-[var(--muted)]">{tool.short}</p>
          </div>
        </div>
      </header>

      {/* The tool itself — always above the fold, never buried under copy. */}
      <div className="mb-8">{children}</div>

      {tool.browserOnly ? (
        <div className="mb-8">
          <InfoNote>
            <strong>Private by design.</strong> This tool runs entirely in your browser. Your{" "}
            {tool.input === "file" ? "file is" : "input is"} processed on your own device and is not
            uploaded by DO101.
          </InfoNote>
        </div>
      ) : null}

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOOL} className="mb-8" />

      <div className="space-y-10">
        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="mb-3 text-xl sm:text-2xl">
            About the {tool.name}
          </h2>
          <p className="text-base font-semibold leading-relaxed text-[var(--muted)]">{tool.long}</p>
        </section>

        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="mb-4 text-xl sm:text-2xl">
            How to use it
          </h2>
          <ol className="space-y-3">
            {tool.steps.map((step, i) => (
              <li key={step} className="do-card flex items-start gap-3 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--grass)] text-sm font-extrabold text-white">
                  {i + 1}
                </span>
                <span className="pt-1 text-sm font-semibold">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features-heading">
          <h2 id="features-heading" className="mb-4 text-xl sm:text-2xl">
            What you get
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {tool.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 rounded-2xl bg-[var(--panel)] px-4 py-3 text-sm font-semibold"
              >
                <span aria-hidden className="text-[var(--grass)]">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </section>

        {extraContent}

        <Faq items={tool.faqs} />

        <RelatedTools id={tool.id} />
      </div>
    </div>
  );
}
