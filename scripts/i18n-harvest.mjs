/**
 * Collects every English string the site actually renders.
 *
 * The interface dictionary in src/lib/i18n/messages.ts only ever covered the
 * chrome — the navbar, the hero, a handful of buttons. Everything else on a
 * tool page (the description, the "How to use it" steps, the feature list, the
 * FAQ, the labels inside the tool itself) stayed in English whatever language
 * was chosen. Rather than hand-thread a translation key through a hundred
 * components, this walks the rendered HTML of every route and writes down the
 * text it finds, keyed by the English itself.
 *
 * Two sources are used together:
 *   1. The running dev server, crawled route by route. This catches everything
 *      server-rendered, including all the registry copy.
 *   2. The tool registry, read directly. Belt and braces for strings that only
 *      appear on a page this crawl does not reach.
 *
 * Output: scripts/i18n/source-strings.json — a sorted list of unique strings.
 * Nothing here talks to a translation model; that is i18n-translate.mjs.
 *
 * Usage: node scripts/i18n-harvest.mjs [--origin http://localhost:3000]
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "scripts", "i18n");
const outFile = join(outDir, "source-strings.json");

const originArg = process.argv.indexOf("--origin");
const ORIGIN = originArg > -1 ? process.argv[originArg + 1] : "http://localhost:3000";

/* ------------------------------- routes ------------------------------- */

/** Every static route in src/app, skipping dynamic segments and route groups. */
function discoverRoutes() {
  const appDir = join(root, "src", "app");
  const routes = [];

  const walk = (dir, segments) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (entry === "page.tsx") {
        routes.push("/" + segments.join("/"));
        continue;
      }
      if (!statSync(full).isDirectory()) continue;
      // Dynamic segments have no single URL to crawl; API routes render no text.
      if (entry.startsWith("[") || entry === "api") continue;
      // Route groups such as (marketing) do not appear in the URL.
      walk(full, entry.startsWith("(") ? segments : [...segments, entry]);
    }
  };

  walk(appDir, []);
  return [...new Set(routes.map((r) => (r === "/" ? "/" : r.replace(/\/$/, ""))))].sort();
}

/* ------------------------------ extraction ----------------------------- */

const SKIP_TAGS = new Set(["script", "style", "noscript", "template", "code", "pre", "svg"]);

/** Attributes whose value is read out or shown to someone. */
const TEXT_ATTRS = ["placeholder", "title", "aria-label", "alt"];

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  times: "×",
  middot: "·",
  check: "✓",
};

function decode(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? m);
}

/**
 * Pulls visible text and human-readable attributes out of an HTML document.
 *
 * A regex is enough here because the input is Next's own well-formed output
 * and the result only has to be good enough to hand to a translator — a stray
 * fragment costs one wasted string, not a broken page.
 */
function extractStrings(html) {
  const found = [];

  // Drop the contents of tags whose text is code or markup, not prose.
  let cleaned = html;
  for (const tag of SKIP_TAGS) {
    cleaned = cleaned.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi"), " ");
  }
  // Attribute values, taken from the tags before they are stripped.
  for (const attr of TEXT_ATTRS) {
    const re = new RegExp(`\\s${attr}="([^"]*)"`, "gi");
    let m;
    while ((m = re.exec(cleaned))) found.push(decode(m[1]));
  }

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title) found.push(decode(title[1]));

  // Text between tags. React marks the boundary between two adjacent text
  // children with an empty comment, and those boundaries survive into the live
  // DOM as separate text nodes — so `<h2>About the <!-- -->Merge PDF</h2>` is
  // two nodes, not one. Both granularities are collected: the joined sentence,
  // which reads far better once translated, and each fragment on its own, for
  // when the runtime has to fall back to node-by-node.
  const BOUNDARY = "\u0000";
  // Stand the comments aside first: they match the tag pattern below, so the
  // split would otherwise swallow the very boundary being looked for.
  const marked = cleaned.replace(/<!--[\s\S]*?-->/g, BOUNDARY);
  for (const piece of marked.split(/<[^>]*>/)) {
    if (!piece.includes(BOUNDARY)) {
      found.push(decode(piece));
      continue;
    }
    const fragments = piece.split(BOUNDARY);
    found.push(decode(fragments.join("")));
    for (const fragment of fragments) found.push(decode(fragment));
  }

  return found;
}

/* ------------------------------ filtering ------------------------------ */

/** Collapses the whitespace a JSX-formatted string arrives with. */
export function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Decides whether a harvested fragment is worth translating.
 *
 * The crawl picks up plenty that is not prose — class name soup, JSON from the
 * Next payload, bare numbers, single symbols. Translating those wastes money
 * and, worse, risks the runtime swapping a value it should have left alone.
 */
export function isTranslatable(text) {
  if (!text || text.length < 2 || text.length > 600) return false;
  // Needs at least one run of letters; "12", "→", "1 / 3" are left alone.
  if (!/[A-Za-z]{2}/.test(text)) return false;
  // Anything non-Latin is already localised content (a tool's own sample text).
  if (/[　-鿿Ѐ-ӿ؀-ۿऀ-ॿ가-힯]/.test(text)) {
    return false;
  }
  // Markup, code and serialised data that leaked through.
  if (/[{}<>]|\$\{|\|\||=>|\)\s*;|::/.test(text)) return false;
  if (/^[\w-]+\.(?:tsx?|jsx?|css|json|mjs|png|svg|webp)$/i.test(text)) return false;
  if (/^(?:https?:\/\/|\/|#|data:|\.\/)/.test(text)) return false;
  // Tailwind-ish class strings: many tokens, none of them words with spaces.
  if (/^[a-z0-9:_\-[\]().,%/ ]+$/.test(text) && /(?:^|\s)(?:flex|grid|text|bg|rounded|px|py|mt|mb|w-|h-)/.test(text)) {
    return false;
  }
  // A lone word that is plainly an identifier rather than a label.
  if (/^[a-z][a-zA-Z0-9]*$/.test(text) && text.length < 4) return false;
  // Codes that mean the same thing in every language, and would be corrupted
  // by translating them: IANA time zones, ISO country codes, measurements.
  if (/^[A-Za-z]+\/[A-Za-z_+-]+$/.test(text)) return false;
  if (/^[A-Z]{2,5}$/.test(text)) return false;
  if (/^[\d,.\s]+(?:km²|mi²|km|kg|lb|MB|KB|GB)$/i.test(text)) return false;
  return true;
}

/* ------------------------------- registry ------------------------------ */

/**
 * Reads the prose out of the tool registry by pattern rather than by importing
 * it — the registry is TypeScript with path aliases, and a regex over the
 * source avoids needing a compiler step in a build script.
 */
function harvestRegistry() {
  const dir = join(root, "src", "lib", "tools", "registry");
  const strings = [];
  const fields = ["name", "short", "long", "seoTitle", "seoDescription", "q", "a", "label", "blurb"];

  const files = [
    ...readdirSync(dir).map((f) => join(dir, f)),
    join(root, "src", "lib", "tools", "types.ts"),
  ];

  for (const file of files) {
    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
    const src = readFileSync(file, "utf8");

    // Quoted values of the known prose fields, including multi-line strings.
    for (const field of fields) {
      const re = new RegExp(`\\b${field}:\\s*("(?:[^"\\\\]|\\\\.)*")`, "g");
      let m;
      while ((m = re.exec(src))) strings.push(JSON.parse(m[1]));
    }

    // String arrays: steps, features, keywords. Keywords are filtered out later
    // by isTranslatable only if they look like identifiers, so take the prose
    // arrays by name instead.
    for (const field of ["steps", "features"]) {
      const re = new RegExp(`\\b${field}:\\s*\\[([\\s\\S]*?)\\]`, "g");
      let m;
      while ((m = re.exec(src))) {
        const items = m[1].match(/"(?:[^"\\]|\\.)*"/g) ?? [];
        for (const item of items) strings.push(JSON.parse(item));
      }
    }
  }

  return strings;
}

/* -------------------------------- crawl -------------------------------- */

async function crawl(routes) {
  const strings = [];
  let ok = 0;
  let failed = 0;

  for (const route of routes) {
    try {
      const res = await fetch(new URL(route, ORIGIN), {
        headers: { "accept-language": "en" },
      });
      if (!res.ok) {
        failed += 1;
        process.stdout.write(`  ${res.status} ${route}\n`);
        continue;
      }
      strings.push(...extractStrings(await res.text()));
      ok += 1;
      process.stdout.write(`\r  crawled ${ok}/${routes.length}`);
    } catch (err) {
      failed += 1;
      process.stdout.write(`\n  failed ${route}: ${err.message}\n`);
    }
  }

  process.stdout.write(`\n  ${ok} pages read, ${failed} skipped\n`);
  return strings;
}

/* --------------------------------- main -------------------------------- */

async function main() {
  const routes = discoverRoutes();
  console.log(`Harvesting ${routes.length} routes from ${ORIGIN}`);

  const raw = [...(await crawl(routes)), ...harvestRegistry()];

  const unique = new Set();
  for (const item of raw) {
    const text = normalize(item);
    if (isTranslatable(text)) unique.add(text);
  }

  const sorted = [...unique].sort((a, b) => a.localeCompare(b));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(sorted, null, 2) + "\n");

  const chars = sorted.reduce((sum, s) => sum + s.length, 0);
  console.log(`\n${sorted.length} unique strings (${chars.toLocaleString()} characters)`);
  console.log(`Written to ${outFile.replace(root + "/", "")}`);
}

// pathToFileURL, not a template string: this project lives under a path with a
// space in it, which arrives percent-encoded in import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
