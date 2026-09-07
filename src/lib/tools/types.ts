export type ToolCategory =
  | "image"
  | "text"
  | "developer"
  | "calculator"
  | "productivity"
  | "game";

export type ToolIO = "file" | "text" | "numbers" | "none" | "keyboard";

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
  image: {
    label: "Image",
    slug: "image",
    icon: "🖼️",
    blurb: "Compress, resize and convert pictures without uploading them anywhere.",
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
