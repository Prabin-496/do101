export type NewsCategory =
  | "ai"
  | "tech"
  | "dev"
  | "crypto"
  | "finance"
  | "startups"
  | "security"
  | "science";

export interface NewsSource {
  id: string;
  name: string;
  /** The RSS or Atom feed URL. */
  url: string;
  /** The publisher's own site, used for attribution links. */
  site: string;
  category: NewsCategory;
}

export interface NewsItem {
  /** Stable id derived from the link, used for de-duplication and React keys. */
  id: string;
  title: string;
  link: string;
  /** Short excerpt from the feed. Never the full article. */
  excerpt: string;
  /** Milliseconds since epoch, or null when the feed omits a usable date. */
  publishedAt: number | null;
  sourceId: string;
  sourceName: string;
  category: NewsCategory;
}

export interface FeedResult {
  sourceId: string;
  items: NewsItem[];
  ok: boolean;
  /** Present when the fetch or parse failed, so the UI can be honest about gaps. */
  error?: string;
}

export const CATEGORY_LABELS: Record<NewsCategory, { label: string; icon: string; blurb: string }> = {
  ai: {
    label: "AI",
    icon: "🤖",
    blurb: "Models, research, tooling and what the labs are shipping.",
  },
  tech: {
    label: "Technology",
    icon: "💻",
    blurb: "The industry at large — products, platforms and the companies behind them.",
  },
  dev: {
    label: "Developers",
    icon: "⚡",
    blurb: "Engineering, the web platform, languages and infrastructure.",
  },
  crypto: {
    label: "Crypto",
    icon: "₿",
    blurb: "Bitcoin, Ethereum, regulation and the wider digital-asset market.",
  },
  finance: {
    label: "Finance",
    icon: "📈",
    blurb: "Markets, earnings and the money side of technology.",
  },
  startups: {
    label: "Startups",
    icon: "🚀",
    blurb: "Funding, launches and what is being built next.",
  },
  security: {
    label: "Security",
    icon: "🔐",
    blurb: "Breaches, vulnerabilities and defensive practice.",
  },
  science: {
    label: "Science",
    icon: "🔬",
    blurb: "Research, space and the discoveries behind future technology.",
  },
};

export const CATEGORY_ORDER: NewsCategory[] = [
  "ai",
  "tech",
  "dev",
  "crypto",
  "finance",
  "startups",
  "security",
  "science",
];
