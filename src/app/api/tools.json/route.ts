import { TOOLS } from "@/lib/tools/tool-registry";
import { CATEGORY_META } from "@/lib/tools/types";
import { SITE, absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * /api/tools.json — a public, machine-readable index of every DO101 tool.
 *
 * Built for assistants, directories and anyone integrating with the site.
 * It carries each tool's canonical URL, what it does, whether it runs in the
 * browser, and what it deliberately does not do. CORS is open because the data
 * is entirely public and contains nothing about any visitor.
 */
export function GET() {
  const payload = {
    name: SITE.name,
    tagline: SITE.tagline,
    description: SITE.description,
    url: SITE.url,
    license: "Free to use. Tool pages may be linked and cited freely.",
    generated: new Date().toISOString(),
    toolCount: TOOLS.length,
    principles: [
      "Almost every tool runs entirely in the visitor's browser; there is no upload endpoint behind them.",
      "No account, watermark, paywall or usage limit.",
      "Tools that cannot work reliably in a browser are not offered rather than faked.",
      "No fabricated statistics, testimonials or review scores anywhere on the site.",
    ],
    categories: Object.entries(CATEGORY_META)
      .map(([id, meta]) => ({
        id,
        label: meta.label,
        description: meta.blurb,
        toolCount: TOOLS.filter((t) => t.category === id).length,
      }))
      .filter((c) => c.toolCount > 0),
    tools: TOOLS.map((tool) => ({
      id: tool.id,
      name: tool.name,
      url: absoluteUrl(tool.route),
      category: tool.category,
      summary: tool.short,
      description: tool.long,
      keywords: tool.keywords,
      alsoKnownAs: tool.aliases,
      runsInBrowser: tool.browserOnly,
      inputType: tool.input,
      outputType: tool.output,
      features: tool.features,
      faq: tool.faqs.map((f) => ({ question: f.q, answer: f.a })),
      related: tool.related
        .filter((id) => TOOLS.some((t) => t.id === id))
        .map((id) => absoluteUrl(TOOLS.find((t) => t.id === id)!.route)),
    })),
  };

  return Response.json(payload, {
    headers: {
      "cache-control": "public, max-age=3600, s-maxage=86400",
      // Public catalogue data — safe to read from anywhere.
      "access-control-allow-origin": "*",
    },
  });
}
