import type { FormToolConfig } from "../form-tool-config";

const escapeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const metaTagGeneratorConfig: FormToolConfig = {
  id: "meta-tag-generator",
  outputLabel: "Paste this into your <head>",
  note: "Fill in the fields and DO101 builds a complete, correctly-escaped metadata block — title, description, canonical, Open Graph and Twitter card.",
  fields: [
    {
      id: "title",
      label: "Page title",
      type: "text",
      default: "Free Image Compressor — Compress JPG & PNG Online",
      limit: 60,
      description: "Google usually shows about 60 characters on desktop.",
      wide: true,
    },
    {
      id: "description",
      label: "Meta description",
      type: "textarea",
      default:
        "Compress JPG, PNG and WebP images in your browser. Choose a quality level or a target size in KB. No upload and no sign-up.",
      limit: 155,
      description: "Not a ranking factor, but it is what people decide to click on.",
    },
    { id: "url", label: "Canonical URL", type: "text", default: "https://example.com/page", wide: true },
    { id: "siteName", label: "Site name", type: "text", default: "DO101" },
    { id: "image", label: "Social share image URL", type: "text", default: "https://example.com/og.png" },
    {
      id: "type",
      label: "Open Graph type",
      type: "select",
      default: "website",
      choices: [
        { value: "website", label: "website" },
        { value: "article", label: "article" },
        { value: "product", label: "product" },
      ],
    },
    { id: "twitter", label: "Twitter/X handle", type: "text", default: "", placeholder: "@yourhandle" },
    { id: "locale", label: "Locale", type: "text", default: "en_US" },
    { id: "noindex", label: "Ask search engines not to index this page", type: "toggle", default: false, wide: true },
  ],
  generate: (values) => {
    const title = String(values.title || "").trim();
    const description = String(values.description || "").trim();
    const url = String(values.url || "").trim();
    const image = String(values.image || "").trim();
    const twitter = String(values.twitter || "").trim();

    if (!title) return { output: "", error: "A page title is the one field you cannot skip." };

    const lines = [
      `<title>${escapeAttr(title)}</title>`,
      description ? `<meta name="description" content="${escapeAttr(description)}" />` : "",
      url ? `<link rel="canonical" href="${escapeAttr(url)}" />` : "",
      values.noindex
        ? `<meta name="robots" content="noindex, nofollow" />`
        : `<meta name="robots" content="index, follow, max-image-preview:large" />`,
      "",
      "<!-- Open Graph -->",
      `<meta property="og:type" content="${escapeAttr(String(values.type))}" />`,
      `<meta property="og:title" content="${escapeAttr(title)}" />`,
      description ? `<meta property="og:description" content="${escapeAttr(description)}" />` : "",
      url ? `<meta property="og:url" content="${escapeAttr(url)}" />` : "",
      values.siteName ? `<meta property="og:site_name" content="${escapeAttr(String(values.siteName))}" />` : "",
      image ? `<meta property="og:image" content="${escapeAttr(image)}" />` : "",
      image ? `<meta property="og:image:width" content="1200" />` : "",
      image ? `<meta property="og:image:height" content="630" />` : "",
      values.locale ? `<meta property="og:locale" content="${escapeAttr(String(values.locale))}" />` : "",
      "",
      "<!-- Twitter / X -->",
      `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
      `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
      description ? `<meta name="twitter:description" content="${escapeAttr(description)}" />` : "",
      image ? `<meta name="twitter:image" content="${escapeAttr(image)}" />` : "",
      twitter ? `<meta name="twitter:site" content="${escapeAttr(twitter)}" />` : "",
    ];

    const facts: Array<{ label: string; value: string }> = [
      { label: "Title length", value: `${title.length} characters${title.length > 60 ? " — likely truncated" : ""}` },
      {
        label: "Description length",
        value: `${description.length} characters${description.length > 155 ? " — likely truncated" : ""}`,
      },
    ];
    if (!image) facts.push({ label: "Note", value: "No image, so a small summary card is used." });

    return { output: lines.filter((l) => l !== "").join("\n"), extension: "html", facts };
  },
};

export const serpPreviewConfig: FormToolConfig = {
  id: "serp-preview",
  outputLabel: "Metadata for your page",
  note: "See roughly how your page will look in Google results. Google rewrites titles and descriptions when it thinks it can do better, so treat this as a guide, not a guarantee.",
  fields: [
    {
      id: "title",
      label: "Title tag",
      type: "text",
      default: "Free PDF Merge — Combine PDF Files Online | DO101",
      limit: 60,
      wide: true,
    },
    { id: "url", label: "URL", type: "text", default: "https://do101.online/tools/pdf-merge", wide: true },
    {
      id: "description",
      label: "Meta description",
      type: "textarea",
      default:
        "Merge multiple PDF files into one document in your browser. Reorder before merging, no watermark, no sign-up, and your files are never uploaded.",
      limit: 155,
    },
  ],
  generate: (values) => {
    const title = String(values.title || "");
    const url = String(values.url || "");
    const description = String(values.description || "");

    const truncate = (text: string, limit: number) =>
      text.length > limit ? `${text.slice(0, limit).replace(/\s+\S*$/, "")}…` : text;

    const shownTitle = truncate(title, 60);
    const shownDescription = truncate(description, 155);
    const breadcrumb = url.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/").join(" › ");

    return {
      output: [
        `Title:       ${title}`,
        `URL:         ${url}`,
        `Description: ${description}`,
        "",
        `Title length:       ${title.length} / 60`,
        `Description length: ${description.length} / 155`,
      ].join("\n"),
      preview: (
        <div className="do-card p-5">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
            Desktop preview
          </p>
          <div className="max-w-xl">
            <p className="truncate text-xs font-semibold text-[var(--muted)]">{breadcrumb}</p>
            <p className="mt-0.5 text-xl font-semibold leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
              {shownTitle || "Your title appears here"}
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--muted)]">
              {shownDescription || "Your meta description appears here."}
            </p>
          </div>
        </div>
      ),
      facts: [
        {
          label: "Title",
          value:
            title.length === 0
              ? "empty"
              : title.length > 60
                ? `${title.length} characters — will be cut short`
                : `${title.length} characters — fits`,
        },
        {
          label: "Description",
          value:
            description.length === 0
              ? "empty"
              : description.length > 155
                ? `${description.length} characters — will be cut short`
                : `${description.length} characters — fits`,
        },
      ],
    };
  },
};
