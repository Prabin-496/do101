import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { JsonFormatter } from "@/components/tools/dev/JsonFormatter";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("json-validator")!;
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
            { name: "Developer tools", href: "/tools?category=developer" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell tool={tool}>
        <JsonFormatter mode="validate" />
      </ToolShell>
    </>
  );
}
