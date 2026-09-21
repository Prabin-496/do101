import { CATEGORY_META, type ToolCategory, type Tool } from "./types";

/**
 * Where a category lives.
 *
 * One answer for the whole site. Breadcrumbs, the tool shell, the homepage and
 * the structured data all ask here, because when each page worked it out for
 * itself, thirty-odd of them pointed Google at `/tools?category=…` — a query
 * URL that is not a page in its own right — even for categories that already
 * had a proper landing page.
 */
const TOP_LEVEL: Partial<Record<ToolCategory, string>> = {
  game: "/games",
  calculator: "/calculators",
  writing: "/writing",
};

/** Categories with a landing page at /tools/{slug}. Must match the app folders. */
export const HUB_CATEGORIES: ToolCategory[] = [
  "pdf",
  "image",
  "converter",
  "text",
  "developer",
  "seo",
  "datetime",
  "learn",
  "productivity",
  "travel",
];

export function categoryHref(category: ToolCategory): string {
  const top = TOP_LEVEL[category];
  if (top) return top;
  if (HUB_CATEGORIES.includes(category)) return `/tools/${CATEGORY_META[category].slug}`;
  // Too few tools to earn a page of its own yet; the filtered directory will do.
  return `/tools?category=${CATEGORY_META[category].slug}`;
}

/** Home → category → tool, for the visible breadcrumb and for JSON-LD alike. */
export function toolBreadcrumbs(tool: Tool): Array<{ name: string; href: string }> {
  return [
    { name: "Home", href: "/" },
    { name: CATEGORY_META[tool.category].label, href: categoryHref(tool.category) },
    { name: tool.name, href: tool.route },
  ];
}
