import { Suspense } from "react";
import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { Darts } from "@/components/games/Darts";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";
import { toolBreadcrumbs } from "@/lib/tools/links";

const tool = getTool("darts")!;
export const metadata: Metadata = toolMetadata(tool);

export default function Page() {
  return (
    <>
      <JsonLd
        data={[
          toolSchema(tool),
          faqSchema(tool.faqs)!,
          breadcrumbSchema(toolBreadcrumbs(tool)),
        ]}
      />
      <ToolShell tool={tool} wide>
        <Suspense
          fallback={
            <div className="do-card grid h-64 place-items-center text-sm font-extrabold text-[var(--muted)]">
              Chalking up…
            </div>
          }
        >
          <Darts />
        </Suspense>
      </ToolShell>
    </>
  );
}
