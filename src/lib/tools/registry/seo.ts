import type { Tool } from "../types";

/**
 * SEO tools. Metadata, structured data and snippet previews — everything
 * generated locally from what you type.
 */
export const SEO_TOOLS: Tool[] = [
  {
    id: "slug-generator",
    name: "URL Slug Generator",
    short: "Turn a title into a clean, safe URL slug.",
    long: "Converts a headline into a lowercase, hyphenated slug — stripping accents, punctuation and emoji, collapsing separators and optionally trimming to a maximum length. Paste several lines to convert a whole list at once.",
    category: "seo",
    route: "/tools/slug-generator",
    keywords: ["slug generator", "url slug", "permalink generator", "seo slug", "url friendly text"],
    aliases: ["permalink generator", "make url slug", "seo friendly url"],
    icon: "🔗",
    accent: "grass",
    browserOnly: true,
    aiInvocable: true,
    input: "text",
    output: "text",
    related: ["meta-tag-generator", "serp-preview", "url-encoder", "case-converter"],
    seoTitle: "URL Slug Generator — SEO-Friendly Permalinks Free | DO101",
    seoDescription: "Turn titles into clean, lowercase, hyphenated URL slugs. Strips accents and punctuation, supports bulk conversion. Free and browser-based.",
    steps: [
      "Paste one title per line.",
      "Choose the separator and any length limit.",
      "Copy the slugs.",
    ],
    features: [
      "Accents transliterated: café becomes cafe",
      "Punctuation and emoji removed",
      "Hyphen or underscore separator",
      "Optional maximum length",
      "Bulk conversion, one slug per line",
    ],
    faqs: [
      {
        q: "Hyphens or underscores?",
        a: "Hyphens. Google has said for years that it treats hyphens as word separators and underscores as joiners, so word-separated slugs are read as separate words.",
      },
      {
        q: "How long should a slug be?",
        a: "Short enough to read at a glance — three to six meaningful words is a good target. Length itself is not a ranking factor, but a readable URL earns more clicks.",
      },
      {
        q: "Should I include stop words?",
        a: "Drop them when they add nothing. \"how-to-compress-images\" reads better than \"how-to-compress-your-images-for-the-web\".",
      },
    ],
  },
  {
    id: "meta-tag-generator",
    name: "Meta Tag Generator",
    short: "Build a complete, correctly-escaped metadata block.",
    long: "Fill in a title, description, canonical URL and share image, and get back the full head block: meta description, canonical link, robots directive, Open Graph and Twitter card tags — all properly escaped, with live length warnings.",
    category: "seo",
    route: "/tools/meta-tag-generator",
    keywords: ["meta tag generator", "open graph generator", "og tags", "twitter card generator", "seo meta tags", "html head tags"],
    aliases: ["og tag generator", "social meta tags", "seo tag generator"],
    icon: "🏷️",
    accent: "grass",
    browserOnly: true,
    aiInvocable: false,
    input: "text",
    output: "text",
    related: ["serp-preview", "slug-generator", "html-encoder", "json-formatter"],
    seoTitle: "Meta Tag Generator — Open Graph & Twitter Cards Free | DO101",
    seoDescription: "Generate a complete HTML head block: meta description, canonical, robots, Open Graph and Twitter card tags, correctly escaped with length warnings.",
    steps: [
      "Fill in the title, description and URL.",
      "Add a share image if you have one.",
      "Copy the generated block into your page's <head>.",
    ],
    features: [
      "Title, description, canonical and robots tags",
      "Full Open Graph and Twitter card sets",
      "Correct HTML escaping of quotes and ampersands",
      "Live length warnings for title and description",
      "Generated in your browser",
    ],
    faqs: [
      {
        q: "Do meta descriptions affect rankings?",
        a: "Not directly — Google has said so repeatedly. They affect click-through rate, which is why they still matter a great deal.",
      },
      {
        q: "Why does Google show a different title from mine?",
        a: "Google rewrites titles when it judges another version fits the query better. A clear, accurate title that matches the page content is rewritten less often.",
      },
      {
        q: "Do I need both Open Graph and Twitter tags?",
        a: "X falls back to Open Graph when Twitter tags are missing, so strictly no. Including both gives you precise control on each platform, which is why this tool emits both.",
      },
      {
        q: "What image size should I use?",
        a: "1200 × 630 pixels is the safe standard for both Open Graph and large Twitter cards.",
      },
    ],
  },
  {
    id: "serp-preview",
    name: "SERP Snippet Preview",
    short: "See how your page will look in Google results.",
    long: "Type a title, URL and meta description and see them rendered as a Google search result, with the same truncation you would get in the wild and a live character count for each field.",
    category: "seo",
    route: "/tools/serp-preview",
    keywords: ["serp preview", "google snippet preview", "meta description length checker", "title tag preview", "search result preview"],
    aliases: ["google preview tool", "snippet preview", "title length checker"],
    icon: "🔎",
    accent: "grass",
    browserOnly: true,
    aiInvocable: false,
    input: "text",
    output: "text",
    related: ["meta-tag-generator", "slug-generator", "character-counter", "word-counter"],
    seoTitle: "SERP Snippet Preview — Google Result Preview Free | DO101",
    seoDescription: "Preview how your title, URL and meta description will appear in Google search results, with live truncation and character counts. Free tool.",
    steps: [
      "Type your title tag, URL and meta description.",
      "Watch the preview and character counts update.",
      "Trim anything the preview cuts short.",
    ],
    features: [
      "Live Google-style snippet preview",
      "Truncation at real-world lengths",
      "Character counts against recommended limits",
      "Breadcrumb-style URL rendering",
      "Runs in your browser",
    ],
    faqs: [
      {
        q: "How accurate is the preview?",
        a: "It is a close guide, not a guarantee. Google measures pixel width rather than characters, varies by device, and frequently rewrites both titles and descriptions.",
      },
      {
        q: "What length should I aim for?",
        a: "Roughly 60 characters for a title and 155 for a description on desktop. Put the important words first, because that is what survives truncation.",
      },
      {
        q: "Why is Google ignoring my description?",
        a: "It generates its own snippet when it thinks a passage from the page answers the query better. That is normal and not a problem to fix.",
      },
    ],
  },
];
