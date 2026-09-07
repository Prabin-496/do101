import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { ImageWorkbench } from "@/components/tools/image/ImageWorkbench";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("image-resizer")!;
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
            { name: "Image tools", href: "/tools?category=image" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell
        tool={tool}
        extraContent={
          <section aria-labelledby="presets-heading">
            <h2 id="presets-heading" className="mb-3 text-xl sm:text-2xl">
              Sizes people ask for most
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                ["1920 × 1080", "Full HD desktop wallpaper and hero images"],
                ["1080 × 1080", "Square social post"],
                ["1200 × 630", "Open Graph / link preview image"],
                ["800 × 800", "Product photo on most storefronts"],
              ].map(([label, note]) => (
                <li key={label} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                  <p className="text-sm font-extrabold">{label}</p>
                  <p className="text-xs font-semibold text-[var(--muted)]">{note}</p>
                </li>
              ))}
            </ul>
          </section>
        }
      >
        <ImageWorkbench mode="resize" toolId={tool.id} dropTitle="Drop an image to resize" />
      </ToolShell>
    </>
  );
}
