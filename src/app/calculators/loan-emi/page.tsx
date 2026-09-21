import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { LoanCalculator } from "@/components/tools/finance/LoanCalculator";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";
import { toolBreadcrumbs } from "@/lib/tools/links";

const tool = getTool("loan-emi")!;
export const metadata: Metadata = toolMetadata(tool);

export default function Page() {
  return (
    <>
      <JsonLd data={[toolSchema(tool), faqSchema(tool.faqs)!, breadcrumbSchema(toolBreadcrumbs(tool))]} />
      <ToolShell tool={tool} wide>
        <LoanCalculator />
      </ToolShell>
    </>
  );
}
