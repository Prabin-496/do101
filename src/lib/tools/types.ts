export type ToolCategory =
  | "pdf"
  | "image"
  | "converter"
  | "text"
  | "developer"
  | "seo"
  | "qr"
  | "generator"
  | "datetime"
  | "learn"
  | "travel"
  | "calculator"
  | "writing"
  | "productivity"
  | "game";

export type ToolIO = "file" | "text" | "numbers" | "none" | "keyboard";

/**
 * Where the work happens. DO101 only ever claims "browser" when there is
 * genuinely no upload endpoint behind the tool.
 */
export type Processing = "browser" | "server";

export interface ToolFaq {
  q: string;
  a: string;
}

export interface Tool {
  id: string;
  name: string;
  /** One-line description used on cards and search results. */
  short: string;
  /** Two-to-four sentence description used above the tool UI. */
  long: string;
  category: ToolCategory;
  route: string;
  keywords: string[];
  aliases: string[];
  icon: string;
  /** Accent color key used by the design system. */
  accent: "grass" | "sky" | "grape" | "fire" | "sun" | "cherry";
  /** True when every byte stays in the visitor's browser. */
  browserOnly: boolean;
  /** True when DO101 AI is allowed to run this tool directly. */
  aiInvocable: boolean;
  input: ToolIO;
  output: ToolIO;
  related: string[];
  seoTitle: string;
  seoDescription: string;
  /** Ordered "How to use" steps. */
  steps: string[];
  features: string[];
  faqs: ToolFaq[];
  /** Marks tools we surface first on the homepage. Editorial, never a fake usage stat. */
  featured?: boolean;
}

export const CATEGORY_META: Record<
  ToolCategory,
  { label: string; slug: string; icon: string; blurb: string; accent: Tool["accent"] }
> = {
  pdf: {
    label: "PDF",
    slug: "pdf",
    icon: "📄",
    blurb: "Merge, split, rotate, convert and compress PDFs without uploading them.",
    accent: "cherry",
  },
  image: {
    label: "Image",
    slug: "image",
    icon: "🖼️",
    blurb: "Compress, resize and convert pictures without uploading them anywhere.",
    accent: "grape",
  },
  converter: {
    label: "Converters",
    slug: "converters",
    icon: "🔄",
    blurb: "Move between formats: documents, spreadsheets, images and data.",
    accent: "sky",
  },
  writing: {
    label: "Writing",
    slug: "writing",
    icon: "📝",
    blurb: "Proofread, tighten, cite and check your essays — free, and nothing is uploaded.",
    accent: "grape",
  },
  text: {
    label: "Text",
    slug: "text",
    icon: "✍️",
    blurb: "Count, clean, compare and reshape text in a click.",
    accent: "sky",
  },
  developer: {
    label: "Developer",
    slug: "developer",
    icon: "⚡",
    blurb: "JSON, Base64, regex, hashes, tokens — the daily driver toolkit.",
    accent: "grass",
  },
  seo: {
    label: "SEO",
    slug: "seo",
    icon: "📈",
    blurb: "Meta tags, structured data, sitemaps and snippet previews.",
    accent: "grass",
  },
  qr: {
    label: "QR Codes",
    slug: "qr",
    icon: "📱",
    blurb: "Generate and scan QR codes for links, Wi-Fi, contacts and more.",
    accent: "sun",
  },
  generator: {
    label: "Generators",
    slug: "generators",
    icon: "🎲",
    blurb: "Passwords, placeholder text, colours and random data on demand.",
    accent: "grape",
  },
  datetime: {
    label: "Date & Time",
    slug: "datetime",
    icon: "🕒",
    blurb: "Differences, timers, time zones and timestamps.",
    accent: "sky",
  },
  learn: {
    label: "Learn",
    slug: "learn",
    icon: "🌍",
    blurb: "Interactive things worth exploring — starting with the world itself.",
    accent: "sky",
  },
  travel: {
    label: "Travel",
    slug: "travel",
    icon: "🚉",
    blurb: "Getting there, and being woken when you arrive.",
    accent: "fire",
  },
  calculator: {
    label: "Calculators",
    slug: "calculators",
    icon: "🧮",
    blurb: "Everyday maths with the formula shown, not hidden.",
    accent: "fire",
  },
  productivity: {
    label: "Productivity",
    slug: "productivity",
    icon: "🚀",
    blurb: "Small utilities that save a surprising amount of time.",
    accent: "sun",
  },
  game: {
    label: "Games",
    slug: "games",
    icon: "🎮",
    blurb: "Typing, reflexes and memory. Beat your best, then beat a friend.",
    accent: "cherry",
  },
};
