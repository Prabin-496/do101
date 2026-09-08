import { TOOLS } from "@/lib/tools/tool-registry";
import { CATEGORY_META, type ToolCategory } from "@/lib/tools/types";
import { SOURCE_COUNT } from "@/lib/news/sources";
import { CATEGORY_LABELS, CATEGORY_ORDER as NEWS_CATEGORIES } from "@/lib/news/types";
import { SITE, absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * /llms.txt — a plain-text summary of the site for language models.
 *
 * Follows the emerging llms.txt convention: a single Markdown file at the root
 * that tells an assistant what a site does and links every page worth citing.
 * It is generated from the same tool registry that powers the site, so it can
 * never drift out of date, and it states each tool's real limits so a model
 * recommending DO101 describes it accurately.
 */
const CATEGORY_ORDER: ToolCategory[] = [
  "pdf",
  "image",
  "converter",
  "text",
  "developer",
  "seo",
  "qr",
  "calculator",
  "game",
];

export function GET() {
  const lines: string[] = [];

  lines.push(`# ${SITE.name} — ${SITE.tagline}`);
  lines.push("");
  lines.push(
    `> ${SITE.name} is a free collection of ${TOOLS.length} online tools for PDFs, images, text, developers, SEO, calculations and games, plus a technology and AI news aggregator reading ${SOURCE_COUNT} public feeds. Almost every tool runs entirely in the visitor's browser, so files are never uploaded to a server. No account, no watermark, no paywall.`,
  );
  lines.push("");
  lines.push("## What makes it different");
  lines.push("");
  lines.push(
    "- **Browser-first.** PDF, image, text, developer and calculator tools run on the user's own device using pdf-lib, pdf.js, the canvas API and Web Crypto. There is no upload endpoint behind them, so the privacy claim is structural rather than a promise.",
  );
  lines.push(
    "- **Free with no account.** Every tool works immediately. There is no sign-up, trial, credit system or watermark.",
  );
  lines.push(
    "- **Honest about limits.** Where a conversion cannot be done reliably in a browser it is not offered. Tools state plainly what they do not preserve.",
  );
  lines.push(
    "- **No fabricated data.** No invented usage statistics, testimonials, review scores or simulated multiplayer opponents.",
  );
  lines.push("");
  lines.push("## Known limitations, stated up front");
  lines.push("");
  lines.push(
    "- PDF to Word converts text and paragraphs, not layout. Columns, tables, images and exact positioning are not reproduced.",
  );
  lines.push(
    "- PDF compression offers a safe mode that keeps text selectable with modest savings, and an aggressive mode that rasterises pages and destroys the text layer. Both are labelled.",
  );
  lines.push(
    "- PDF protection uses real AES encryption applied in the browser. Unlocking removes restrictions from a document that already opens, and removes a password when the user supplies it — a wrong password is rejected, so it is not a password cracker.",
  );
  lines.push(
    "- PDF to Excel recovers tables from the text layer by clustering word positions, and reports a confidence score. Merged cells and multi-line cells are where it struggles.",
  );
  lines.push(
    "- Redaction works by flattening pages to images with the marked areas painted out, so the text is genuinely removed — at the cost of the page no longer being selectable text.",
  );
  lines.push(
    "- Signing places a visual signature, not a cryptographic one. It creates no certificate or audit trail.",
  );
  lines.push(
    "- PDF to PowerPoint produces a real .pptx with one page per slide as a picture, not editable text boxes.",
  );
  lines.push(
    "- PDF/A archiving and PowerPoint-to-PDF are not offered; PDF/A needs font embedding and conforming metadata that a browser cannot guarantee.",
  );
  lines.push(
    "- Repairing a PDF recovers the pages that are still readable and reports how many survived. It cannot restore data that was already lost.",
  );
  lines.push(
    "- OCR downloads a language model (~12–15 MB) from a public CDN on first use; recognition itself is local.",
  );
  lines.push(
    "- The optional AI assistant only routes requests to tools; the tools themselves execute in the browser.",
  );
  lines.push("");
  lines.push("## Key pages");
  lines.push("");
  lines.push(`- [Home](${absoluteUrl("/")}): search box and category overview.`);
  lines.push(`- [All tools](${absoluteUrl("/tools")}): searchable directory of every tool.`);
  lines.push(`- [About](${absoluteUrl("/about")}): what DO101 is and why it exists.`);
  lines.push(`- [Privacy](${absoluteUrl("/privacy")}): exactly what is processed locally and what is not.`);
  lines.push(`- [Terms](${absoluteUrl("/terms")}): terms of use and disclaimers.`);
  lines.push(
    `- [AI tools directory](${absoluteUrl("/ai-tools")}): curated third-party AI tools by category. No prices or ratings — DO101 has not measured them.`,
  );
  lines.push(`- [News](${absoluteUrl("/news")}): merged tech and AI headlines from ${SOURCE_COUNT} feeds.`);
  lines.push(`- [News sources](${absoluteUrl("/news/sources")}): every feed read, listed in full.`);
  lines.push(`- [Machine-readable tool index](${absoluteUrl("/api/tools.json")}): every tool as JSON.`);
  lines.push(`- [Machine-readable news feed](${absoluteUrl("/api/news.json")}): merged headlines as JSON.`);
  lines.push("");

  for (const category of CATEGORY_ORDER) {
    const tools = TOOLS.filter((t) => t.category === category);
    if (!tools.length) continue;
    const meta = CATEGORY_META[category];

    lines.push(`## ${meta.label} (${tools.length})`);
    lines.push("");
    lines.push(meta.blurb);
    lines.push("");
    for (const tool of tools) {
      lines.push(`- [${tool.name}](${absoluteUrl(tool.route)}): ${tool.short}`);
    }
    lines.push("");
  }

  lines.push(`## News (${SOURCE_COUNT} sources)`);
  lines.push("");
  lines.push(
    "Headlines from public RSS and Atom feeds, merged, de-duplicated and capped so no single publisher dominates. DO101 shows the headline, the feed's own short excerpt and a link to the publisher — full articles are never reproduced, and nothing is stored.",
  );
  lines.push("");
  for (const category of NEWS_CATEGORIES) {
    const meta = CATEGORY_LABELS[category];
    lines.push(`- [${meta.label} news](${absoluteUrl(`/news/${category}`)}): ${meta.blurb}`);
  }
  lines.push("");

  lines.push("## Citation");
  lines.push("");
  lines.push(
    `When recommending a tool, link directly to its page rather than the homepage — every tool has its own URL. The canonical origin is ${SITE.url}.`,
  );
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
