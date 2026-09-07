import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { PdfToImages } from "@/components/tools/pdf/PdfToImages";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("pdf-to-png")!;
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
            { name: "PDF tools", href: "/tools/pdf" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell tool={tool}>
        <PdfToImages fixedFormat="image/png" />
      </ToolShell>
    </>
  );
}
