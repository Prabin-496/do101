import { Suspense } from "react";
import type { Metadata } from "next";
import { ToolDirectory } from "@/components/tools/ToolDirectory";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { AdSlot } from "@/components/tools/AdSlot";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { TOOLS } from "@/lib/tools/tool-registry";

export const metadata: Metadata = buildMetadata({
  title: `All ${TOOLS.length} Free Online Tools — Image, Text & Developer | DO101`,
  description:
    "Browse every free DO101 tool: image compressor and resizer, JSON formatter, word counter, QR generator, calculators, typing games and more. No sign-up.",
  path: "/tools",
});

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
          {TOOLS.length} free tools for images, text, code, maths and play. Most of them run
          entirely in your browser, so your files never leave your device — and none of them need an
          account.
        </p>
      </header>

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
