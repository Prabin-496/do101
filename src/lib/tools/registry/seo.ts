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
    related: ["serp-preview", "youtube-shorts-seo", "slug-generator", "html-encoder", "json-formatter"],
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
  {
    id: "youtube-shorts-seo",
    name: "YouTube Shorts SEO Generator",
    short: "Hinglish title, description, tags, hook and pinned comment for a Short.",
    long:
      "Paste your Short's topic, title or keywords and get a complete upload pack for an Indian audience: a Hinglish title fitted to 45–65 characters with two hashtags, an 80–150 word description that carries your keyword three or four times and ends in a call to action with five hashtags, 300–500 characters of comma-separated tags, a pinned comment, a first-three-seconds hook and a checklist measured against what was generated. Every section has its own Copy button, there is a Copy all, and \"New variation\" rewrites the lot from the same keyword. No AI model is involved: the output comes from Hinglish pattern banks, keyword parsing and length rules running in your browser, which is why the same topic always gives the same result.",
    category: "seo",
    route: "/tools/youtube-shorts-seo",
    keywords: [
      "youtube shorts seo", "shorts title generator", "youtube shorts description generator",
      "youtube tags generator", "hinglish title generator", "shorts hashtag generator",
      "youtube shorts seo hindi", "viral shorts title", "youtube seo tool india",
      "shorts hook generator", "pinned comment generator", "youtube shorts keywords",
    ],
    aliases: [
      "shorts seo generator", "youtube shorts title", "shorts description generator",
      "yt shorts seo", "hinglish youtube seo", "shorts tags generator",
    ],
    icon: "🎬",
    accent: "grass",
    browserOnly: true,
    aiInvocable: false,
    input: "text",
    output: "text",
    related: ["thumbnail-grabber", "meta-tag-generator", "serp-preview", "character-counter"],
    seoTitle: "YouTube Shorts SEO Generator — Hinglish Title, Tags & Hook | DO101",
    seoDescription:
      "Paste your Shorts topic for a Hinglish title, 80–150 word description, 300–500 characters of tags, a pinned comment and a 3-second hook. Free, browser-only, no login.",
    steps: [
      "Paste your video topic, working title or keywords — one line is enough.",
      "Leave the niche on auto-detect, or pick one if the topic is broad.",
      "Press Generate SEO.",
      "Copy each section straight into YouTube Studio, or use Copy all.",
      "Want a different angle? Press New variation for a fresh set from the same keyword.",
    ],
    features: [
      "Hinglish title fitted to 45–65 characters, with 1–2 emoji and exactly 2 hashtags",
      "80–150 word description with your keyword 3–4 times, a CTA and exactly 5 hashtags",
      "300–500 characters of comma-separated tags, built from your keyword and its niche",
      "A pinned comment written to start the comment thread, not just fill it",
      "A first-three-seconds hook: what to say, what to put on screen, what the first frame shows",
      "A checklist whose first rows are measured from your actual output, not generic advice",
      "Copy buttons on every section plus Copy all, and a New variation button",
      "Thirteen niches detected from your topic: tech, money, study, fitness, food, travel and more",
      "No account, no API key and no AI model — your text never leaves the page",
    ],
    faqs: [
      {
        q: "Does this use AI?",
        a: "No, and it does not pretend to. Your topic is parsed into a main keyword and a niche, and the sections are built from Hinglish pattern banks and then fitted to YouTube's length rules by ordinary JavaScript. That is why the same topic gives the same output every time, and why it works with no API key, no account and no cost.",
      },
      {
        q: "Is my topic sent anywhere?",
        a: "No. The generator is a pure function running in your own tab. There is no upload endpoint, nothing is stored and nothing is logged — close the tab and it is gone.",
      },
      {
        q: "Why Hinglish rather than pure Hindi or English?",
        a: "Because that is how most Indian Shorts viewers search and speak. A Devanagari-only title cuts out people typing in Roman script, and a purely English one reads like a translation. Hinglish covers both, and you can always edit the output before pasting it.",
      },
      {
        q: "Why does the title have to be 45–65 characters?",
        a: "Shorts titles are shown in a narrow column, and past roughly 65 characters the tail gets cut on a phone. Under about 45 you are leaving searchable words on the table. The tool fits the title to that window and tells you the exact count.",
      },
      {
        q: "Are three or four keyword mentions safe?",
        a: "Yes. That is natural density for an 80–150 word description — the keyword appears in the opening line, in the body and once more around the CTA. Repeating it ten times is keyword stuffing, which YouTube's spam policy covers, so the tool caps it.",
      },
      {
        q: "Do tags still matter on YouTube?",
        a: "Less than titles and descriptions, and YouTube says so itself: they mainly help when your topic is commonly misspelled or has several names. They are cheap to fill in, so the tool gives you a properly sized list rather than pretending they are decisive.",
      },
      {
        q: "Will this make my Short go viral?",
        a: "No tool can promise that, and one that does is lying. Retention in the first three seconds is what drives the Shorts feed. Good metadata gets you found in search and suggested, and the hook section is there because the video itself has to earn the watch time.",
      },
      {
        q: "Can I use the output as it is?",
        a: "Yes, but read it first. It is built from templates, so check that the claims match what your video actually shows — say the exact numbers you quote, and drop any bullet that your Short does not deliver. Metadata that oversells the video hurts retention, which hurts reach.",
      },
    ],
  },
];
