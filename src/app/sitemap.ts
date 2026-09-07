import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools/tool-registry";
import { CATEGORY_META, type ToolCategory } from "@/lib/tools/types";
import { absoluteUrl } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];

const STATIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: Entry["changeFrequency"];
}> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/tools", priority: 0.9, changeFrequency: "weekly" },
  { path: "/calculators", priority: 0.8, changeFrequency: "weekly" },
  { path: "/games", priority: 0.8, changeFrequency: "weekly" },
  { path: "/ai", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.4, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

/** Category hubs that have their own landing page under /tools. */
const HUB_CATEGORIES: ToolCategory[] = [
  "pdf",
  "image",
  "converter",
  "text",
  "developer",
  "seo",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    ...STATIC_ROUTES.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    // Category hubs rank for the broad queries and pass authority to the tools.
    ...HUB_CATEGORIES.map((category) => ({
      url: absoluteUrl(`/tools/${CATEGORY_META[category].slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    })),
    ...TOOLS.map((tool) => ({
      url: absoluteUrl(tool.route),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: tool.featured ? 0.9 : 0.7,
    })),
  ];
}
