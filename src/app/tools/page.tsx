import { Suspense } from "react";
import type { Metadata } from "next";
import { ToolDirectory } from "@/components/tools/ToolDirectory";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { AdSlot } from "@/components/tools/AdSlot";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import Link from "next/link";
import { TOOLS, toolsByCategory } from "@/lib/tools/tool-registry";
import { CATEGORY_META, type ToolCategory } from "@/lib/tools/types";

export const metadata: Metadata = buildMetadata({
  title: `All ${TOOLS.length} Free Online Tools — PDF, Image & Developer | DO101`,
  description:
    "Browse every free DO101 tool: merge and compress PDFs, convert PDF to Word, compress images, format JSON, count words, generate QR codes and more. No sign-up.",
  path: "/tools",
});

const HUBS: Array<{ category: ToolCategory; href: string }> = [
  { category: "pdf", href: "/tools/pdf" },
  { category: "image", href: "/tools/image" },
  { category: "converter", href: "/tools/converters" },
  { category: "text", href: "/tools/text" },
  { category: "developer", href: "/tools/developer" },
  { category: "seo", href: "/tools/seo" },
  { category: "qr", href: "/tools/qr-generator" },
  { category: "datetime", href: "/tools/datetime" },
  { category: "learn", href: "/tools/earth-globe" },
  { category: "travel", href: "/tools/station-alarm" },
  { category: "calculator", href: "/calculators" },
  { category: "game", href: "/games" },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          itemListSchema(TOOLS, "All DO101 tools"),
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "Tools", href: "/tools" },
          ]),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Tools", href: "/tools" },
        ]}
      />

      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl">Every DO101 tool</h1>
        <p className="mt-2 max-w-2xl text-base font-semibold text-[var(--muted)]">
          {TOOLS.length} free tools for PDFs, images, documents, text, code, maths and play.
          Almost every one runs entirely in your browser, so your files never leave your device —
          and none of them need an account.
        </p>
      </header>

      {/* Real anchor links to every hub, so crawlers reach each category
          without executing the client-side filter. */}
      <nav aria-label="Tool categories" className="mb-10">
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-widest text-[var(--muted)]">
          Browse by category
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {HUBS.map(({ category, href }) => {
            const meta = CATEGORY_META[category];
            const count = toolsByCategory(category).length;
            return (
              <li key={category}>
                <Link
                  href={href}
                  className="do-card do-card-hover flex h-full flex-col gap-1 p-4"
                >
                  <span aria-hidden className="text-2xl">
                    {meta.icon}
                  </span>
                  <span className="text-base font-extrabold">{meta.label}</span>
                  <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">
                    {count} tool{count === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Suspense
        fallback={
          <div className="do-card grid h-64 place-items-center text-sm font-extrabold text-[var(--muted)]">
            Loading tools…
          </div>
        }
      >
        <ToolDirectory />
      </Suspense>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_DIRECTORY} className="mt-10" />

      <section className="mt-14 max-w-3xl space-y-4 text-base font-semibold leading-relaxed text-[var(--muted)]">
        <h2 className="text-2xl text-[var(--ink)]">How the DO101 toolbox is organised</h2>
        <p>
          Every tool has its own page with the working tool at the top and a plain-language
          explanation underneath — what it does, how it works, whether your data leaves the browser,
          and which tool you probably want next.
        </p>
        <p>
          <strong className="text-[var(--ink)]">Image tools</strong> compress, resize and convert
          pictures using your browser&rsquo;s own encoder.{" "}
          <strong className="text-[var(--ink)]">Text tools</strong> count, clean, compare and
          reformat writing. <strong className="text-[var(--ink)]">Developer tools</strong> cover the
          daily basics: JSON, Base64, URLs, UUIDs, JWTs, timestamps, regex and hashes.{" "}
          <strong className="text-[var(--ink)]">Calculators</strong> show their formula so you can
          check the working, and <strong className="text-[var(--ink)]">games</strong> give you
          somewhere to put the five minutes you just saved.
        </p>
      </section>
    </div>
  );
}
