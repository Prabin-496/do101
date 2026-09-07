import { Suspense } from "react";
import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { TypingBattle } from "@/components/games/TypingBattle";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("typing-battle")!;
export const metadata: Metadata = toolMetadata(tool);

export default function Page() {
  return (
    <>
      <JsonLd
        data={[
          toolSchema(tool),
          faqSchema(tool.faqs)!,
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "Games", href: "/games" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell tool={tool}>
        <Suspense
          fallback={
            <div className="do-card grid h-64 place-items-center text-sm font-extrabold text-[var(--muted)]">
              Loading the arena…
            </div>
          }
        >
          <TypingBattle />
        </Suspense>
      </ToolShell>
    </>
  );
}
