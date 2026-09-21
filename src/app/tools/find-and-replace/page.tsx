import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { FindAndReplaceTool } from "@/components/tools/configured/FindAndReplaceTool";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";
import { toolBreadcrumbs } from "@/lib/tools/links";

const tool = getTool("find-and-replace")!;
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
      <ToolShell tool={tool}>
        <FindAndReplaceTool />
      </ToolShell>
    </>
  );
}
