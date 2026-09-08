import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { Workspace } from "@/components/tools/workspace/Workspace";
import { Faq } from "@/components/tools/Faq";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("workspace")!;
export const metadata: Metadata = toolMetadata(tool);

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:py-8">
      <JsonLd
        data={[
          toolSchema(tool),
          faqSchema(tool.faqs)!,
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "Workspace", href: "/workspace" },
          ]),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Workspace", href: "/workspace" },
        ]}
      />

      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl">
          Split-screen workspace <span aria-hidden>🧩</span>
        </h1>
        <p className="mt-2 max-w-2xl text-base font-semibold text-[var(--muted)]">
          Put the tools you use together on one screen — translate on the left and take
          notes on the right, or keep a calendar beside your writing. Drag the bars to
          resize; your arrangement is remembered on this device.
        </p>
      </header>

      <Workspace />

      <section className="mt-14 max-w-3xl space-y-4 text-base font-semibold leading-relaxed text-[var(--muted)]">
        <h2 className="text-2xl text-[var(--ink)]">Why a workspace rather than more tabs</h2>
        <p>
          Most of the work these tools do is comparative. You are reading something in
          one language and writing in another, or checking a reference while you
          proofread a paragraph, or looking at a date while you write it into a plan.
          Two browser tabs make that awkward: you lose your place every time you switch,
          and neither tab can see the other.
        </p>
        <p>
          Panes here load only when you choose them, so opening the workspace does not
          download every tool on the site. Each one is the same component as its own
          page — the{" "}
          <Link href="/tools/japanese-translator">Japanese translator</Link>,{" "}
          <Link href="/tools/notes">notes</Link>,{" "}
          <Link href="/tools/calendar">calendar</Link> and the{" "}
          <Link href="/writing">writing tools</Link> all behave identically here — and
          the arrow in each pane header opens the full-size version if you want more
          room.
        </p>
        <p>
          Everything still runs in your browser. Notes written in a pane are the same
          notes you see on the notes page, because they share the same local storage.
        </p>
      </section>

      <Faq items={tool.faqs} />
    </div>
  );
}
