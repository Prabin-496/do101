import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { ImageWorkbench } from "@/components/tools/image/ImageWorkbench";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("heic-to-jpg")!;
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
            { name: "Image tools", href: "/tools/image" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell tool={tool}>
        <ImageWorkbench mode="convert" toolId="heic-to-jpg" fixedFormat="image/jpeg" accept=".heic,.heif,image/heic,image/heif" dropTitle="Drop your HEIC photos" />
      </ToolShell>
    </>
  );
}
