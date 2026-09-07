import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { RemoveEmptyLinesTool } from "@/components/tools/configured/RemoveEmptyLinesTool";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("remove-empty-lines")!;
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
            { name: "Text tools", href: "/tools/text" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell tool={tool}>
        <RemoveEmptyLinesTool />
      </ToolShell>
    </>
  );
}
