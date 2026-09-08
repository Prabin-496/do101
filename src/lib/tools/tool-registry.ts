import type { Tool } from "./types";
import { PDF_TOOLS } from "./registry/pdf";
import { IMAGE_TOOLS } from "./registry/image";
import { CONVERTERS_TOOLS } from "./registry/converters";
import { TEXT_TOOLS } from "./registry/text";
import { WRITING_TOOLS } from "./registry/writing";
import { DEVELOPER_TOOLS } from "./registry/developer";
import { SEO_TOOLS } from "./registry/seo";
import { QR_TOOLS } from "./registry/qr";
import { GENERATORS_TOOLS } from "./registry/generators";
import { DATETIME_TOOLS } from "./registry/datetime";
import { LEARN_TOOLS } from "./registry/learn";
import { CALCULATORS_TOOLS } from "./registry/calculators";
import { GAMES_TOOLS } from "./registry/games";

/**
 * Single source of truth for every DO101 tool.
 *
 * Powers: the homepage, /tools directory, command palette, related links,
 * AI tool routing, sitemap.xml and structured data. Adding a tool here makes
 * it appear in all of them.
 */
export const TOOLS: Tool[] = [
  ...PDF_TOOLS,
  ...IMAGE_TOOLS,
  ...CONVERTERS_TOOLS,
  ...WRITING_TOOLS,
  ...TEXT_TOOLS,
  ...DEVELOPER_TOOLS,
  ...SEO_TOOLS,
  ...QR_TOOLS,
  ...GENERATORS_TOOLS,
  ...DATETIME_TOOLS,
  ...LEARN_TOOLS,
  ...CALCULATORS_TOOLS,
  ...GAMES_TOOLS,
];

/* ----------------------------- lookups ----------------------------- */

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t]),
);

export function getTool(id: string): Tool | undefined {
  return TOOL_MAP[id];
}

export function getToolByRoute(route: string): Tool | undefined {
  return TOOLS.find((t) => t.route === route);
}

export function toolsByCategory(category: Tool["category"]): Tool[] {
  return TOOLS.filter((t) => t.category === category);
}

export function relatedTools(id: string, limit = 4): Tool[] {
  const tool = getTool(id);
  if (!tool) return [];
  return tool.related
    .map((r) => TOOL_MAP[r])
    .filter((t): t is Tool => Boolean(t))
    .slice(0, limit);
}

export const FEATURED_TOOLS = TOOLS.filter((t) => t.featured);
