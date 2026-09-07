import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { ImageWorkbench } from "@/components/tools/image/ImageWorkbench";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("image-compressor")!;
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
          <section aria-labelledby="sizes-heading">
            <h2 id="sizes-heading" className="mb-3 text-xl sm:text-2xl">
              Common size targets
            </h2>
            <p className="mb-4 text-sm font-semibold text-[var(--muted)]">
              Upload forms usually cap files at one of these limits. Switch the tool to{" "}
              <strong>Target size</strong> and type the number.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                ["Under 100 KB", "Government and exam portals often use this limit for photos."],
                ["Under 200 KB", "The most common cap for job applications and web forms."],
                ["Under 500 KB", "Typical for blog images and email attachments."],
                ["Under 1 MB", "Comfortable for high-quality web photography."],
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
        <ImageWorkbench mode="compress" toolId={tool.id} dropTitle="Drop an image to compress" />
      </ToolShell>
    </>
  );
}
