import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * DO101 is happy to be crawled — by search engines and by the assistants people
 * increasingly ask instead of searching. Every tool has its own indexable URL,
 * and /llms.txt plus /api/tools.json give machines a clean summary to work from.
 *
 * Only the AI routing endpoint is disallowed: it is a POST-only API that returns
 * nothing useful to a crawler and costs a request to hit.
 */
const AI_AND_SEARCH_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
  "DuckDuckBot",
  "Amazonbot",
  "Meta-ExternalAgent",
  "cohere-ai",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/ai"],
      },
      // Named explicitly so there is no ambiguity about whether assistants may
      // read and cite these pages. They may.
      ...AI_AND_SEARCH_AGENTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/api/ai"],
      })),
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
