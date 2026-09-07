import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { ToolCard } from "@/components/tools/ToolCard";
import { AdSlot } from "@/components/tools/AdSlot";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { toolsByCategory } from "@/lib/tools/tool-registry";

const calculators = toolsByCategory("calculator");

export const metadata: Metadata = buildMetadata({
  title: "Free Online Calculators — Age, Percentage & BMI | DO101",
  description:
    "Free calculators that show their working: exact age, percentages, discounts and sale prices, and BMI in metric or imperial. Instant, private and browser-based.",
  path: "/calculators",
});

export default function CalculatorsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          itemListSchema(calculators, "DO101 calculators"),
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "Calculators", href: "/calculators" },
          ]),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Calculators", href: "/calculators" },
        ]}
      />

      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl">
          Calculators <span aria-hidden>🧮</span>
        </h1>
        <p className="mt-2 max-w-2xl text-base font-semibold text-[var(--muted)]">
          Everyday maths, done properly. Every DO101 calculator shows the formula next to the
          answer, so you can check the working instead of trusting a black box.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {calculators.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_DIRECTORY} className="mt-10" />

      <section className="mt-14 max-w-3xl space-y-4 text-base font-semibold leading-relaxed text-[var(--muted)]">
        <h2 className="text-2xl text-[var(--ink)]">Why show the formula?</h2>
        <p>
          Most online calculators give you a number and nothing else. That is fine until the number
          looks wrong — and then you have no way to tell whether you typed something incorrectly or
          the tool made an assumption you did not expect. DO101 prints the exact expression it
          evaluated underneath every answer.
        </p>
        <p>
          It matters more often than you would think. Stacked discounts multiply rather than add, so
          20% off followed by 10% off is 28% off, not 30%. Age calculations that approximate a month
          as 30 days drift by days over a lifetime. Seeing the working makes those differences
          visible.
        </p>
      </section>
    </div>
  );
}
