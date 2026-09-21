import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { SopBuilder } from "@/components/tools/work/SopBuilder";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";
import { toolBreadcrumbs } from "@/lib/tools/links";

const tool = getTool("sop-generator")!;
export const metadata: Metadata = toolMetadata(tool);

export default function Page() {
  return (
    <>
      <JsonLd data={[toolSchema(tool), faqSchema(tool.faqs)!, breadcrumbSchema(toolBreadcrumbs(tool))]} />
      <ToolShell tool={tool} wide>
        <SopBuilder />
      </ToolShell>
    </>
  );
}
