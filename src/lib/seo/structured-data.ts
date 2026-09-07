import { SITE, absoluteUrl } from "@/lib/site";
import type { Tool } from "@/lib/tools/types";

type Json = Record<string, unknown>;

export function websiteSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    alternateName: "DO101 Online Tools",
    url: SITE.url,
    description: SITE.description,
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE.url}/tools?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    slogan: SITE.tagline,
    description: SITE.description,
  };
}

export function toolSchema(tool: Tool): Json {
  return {
    "@context": "https://schema.org",
    "@type": tool.category === "game" ? "WebApplication" : "SoftwareApplication",
    name: tool.name,
    url: absoluteUrl(tool.route),
    description: tool.seoDescription,
    applicationCategory:
      tool.category === "game" ? "GameApplication" : "UtilitiesApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript and a modern browser",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: tool.features,
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; href: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  };
}

/** Only emitted where the answers are genuinely on the page. */
export function faqSchema(faqs: Array<{ q: string; a: string }>): Json | null {
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function itemListSchema(tools: Tool[], name: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: tools.length,
    itemListElement: tools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.name,
      url: absoluteUrl(tool.route),
    })),
  };
}
