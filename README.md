# DO101 — Do more. Simply.

Free online tools, fast answers, and fun challenges — 28 tools, four games and
an optional AI router, almost all of them running entirely in the visitor's
browser.

**Production:** https://do101.online

---

## What this is

A browser-first toolbox. PDFs are merged, split and rebuilt with pdf-lib and
rendered with pdf.js. Image compression uses the canvas encoder your browser
already ships. HEIC is decoded by a WebAssembly build of libheif. OCR runs
Tesseract as WebAssembly. JSON parsing uses the built-in JSON engine, hashing
uses Web Crypto, and typing games measure your own keystrokes locally.

Nothing is uploaded, which makes the tools private, instant and almost free to
host. The one exception is the optional AI router, and every page that touches
it says so plainly.

### Categories

| Category | Tools | Hub |
| --- | --- | --- |
| PDF | 29 | `/tools/pdf` |
| Developer | 23 | `/tools/developer` |
| Text | 14 | `/tools/text` |
| Image | 12 | `/tools/image` |
| Converters | 4 | `/tools/converters` |
| Calculators | 4 | `/calculators` |
| Games | 4 | `/games` |
| SEO | 3 | `/tools/seo` |
| QR & Date/time | 2 | `/tools/datetime` |
| News | 74 feeds | `/news` |

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, server components by default) |
| Language | TypeScript, strict |
| Styling | Tailwind CSS v4 with CSS custom properties for theming |
| Fonts | Nunito + JetBrains Mono, self-hosted via `next/font` |
| Testing | Vitest (116 unit tests) |
| Hosting | Vercel free tier |

**Runtime dependencies:** `pdf-lib` (PDF writing), `pdfjs-dist` (PDF rendering
and text extraction), `tesseract.js` (OCR), `heic-to` (HEIC decoding),
`mammoth` (.docx reading), `docx` (.docx writing), `xlsx` (spreadsheets),
`marked` + `turndown` (Markdown), `js-yaml`, `qrcode`, `jsqr`, `fflate` (zip),
`peerjs` (WebRTC for Typing Battle), `canvas-confetti`, `next-themes` and
`server-only`. Every one of them is lazily imported, so a tool's library only
downloads on the page that needs it.

> **Note on `xlsx`:** installed from SheetJS's own CDN
> (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) rather than npm. The
> npm copy is abandoned at 0.18.5 and carries unfixed prototype-pollution and
> ReDoS advisories; SheetJS publishes patched releases only from their site.

## Getting started

```bash
npm install
cp .env.example .env.local     # then set NEXT_PUBLIC_SITE_URL=http://localhost:3000
npm run dev                    # http://localhost:3000
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest, once |
| `npm run verify` | lint + typecheck + test + build |

## Environment variables

Everything except `NEXT_PUBLIC_SITE_URL` is optional. The whole site works
with an empty `.env.local`. See `.env.example` for the annotated list.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin. Drives canonicals, OG tags, sitemap, invite links. No trailing slash. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Shown on `/contact`. Blank means the page says it is unconfigured rather than inventing an address. |
| `NEXT_PUBLIC_TWITTER_HANDLE` | Twitter card attribution. |
| `ANTHROPIC_API_KEY` | **Secret, server only.** Enables the AI fallback router. |
| `ANTHROPIC_MODEL` | Defaults to `claude-haiku-4-5-20251001`. |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | AdSense publisher id. Without it, no ad code loads at all. |
| `NEXT_PUBLIC_ADSENSE_SLOT_*` | Individual slot ids for home, tool, directory and games placements. |

Never prefix a secret with `NEXT_PUBLIC_` — that compiles it into the client bundle.

## Project structure

```
src/
  app/                    routes (each tool is its own indexable page)
    api/ai/route.ts       the only dynamic route
    sitemap.ts robots.ts manifest.ts opengraph-image.tsx
  components/
    ui/                   design system: Button, Card, Field, Feedback, Tabs…
    layout/               Navbar, Footer, CommandPalette, ThemeProvider
    tools/                ToolShell, ToolCard, RelatedTools, AdSlot, per-tool UIs
    games/                TypingTest, TypingBattle, ReactionTest, MemoryTest
    ai/                   AiConsole
    seo/                  JsonLd
  lib/
    tools/tool-registry.ts   single source of truth for all 28 tools
    text/ dev/ calculators/ games/ image/   pure logic, unit tested
    ai/                      tool contract, rule router, provider abstraction
    seo/                     metadata builders and structured data
    utils/                   storage, formatting, class names
tests/                    Vitest suites over the pure logic
docs/                     deployment, launch, marketing, checklist
```

### The tool registry

`src/lib/tools/tool-registry.ts` is the single source of truth. One entry per
tool carries its id, route, description, keywords, aliases, icon, related
tools, SEO title and description, how-to steps, features and FAQs. That one
file powers the homepage, the `/tools` directory, the ⌘K command palette,
related-tool links, AI routing, `sitemap.xml` and every piece of structured
data. Add a tool there and it appears everywhere.

## Architecture decisions worth knowing

**Browser-first processing.** Image compression binary-searches JPEG quality
against a target byte size using `canvas.toBlob`. There is no upload endpoint
for any image tool, so the claim "your file is not uploaded" is structurally
true rather than a promise.

**The AI cannot lie about results.** `POST /api/ai` returns only a *plan*: a
tool name and its arguments. The tool then executes in the browser through the
same functions the visible UI calls, and the real output is rendered. The model
never authors a result, so it cannot describe an operation that did not happen.
Deterministic rules answer the common requests before the model is consulted,
which is why `/ai` still works with no API key.

**Typing Battle is real multiplayer.** Two browsers connect over a WebRTC data
channel, with a free public PeerJS broker used only to exchange addresses.
There is no simulated opponent: if nobody joins, the screen says nobody joined.
Rooms live only while the host's tab is open — closing it ends the room, which
is a documented consequence of having no database.

**Local-only progress.** Recent tools, favourites, personal bests, XP and the
daily streak live in `localStorage` and are read through a
`useSyncExternalStore` hook, so a new best updates the header immediately. None
of it is transmitted, and `/privacy` has a button that erases all of it.

**Ads are off unless configured.** `AdSlot` renders nothing in production
without a publisher id, and the AdSense script is not loaded either. The site
is fully functional with advertising disabled.

## Testing

```bash
npm run test
```

146 tests covering the logic where a bug would silently produce a wrong
answer: exact age arithmetic across leap years and short months, percentage
and stacked-discount maths, BMI band boundaries and unit conversion, word,
character and grapheme counting, text cleaning and diffing, JSON parsing and
duplicate-key detection, Unicode-safe Base64, URL encoding, UUID validity and
uniqueness, JWT decoding, timestamp unit detection, regex execution, WPM and
accuracy formulas, deterministic seeded typing text, registry integrity (unique ids and routes, valid related
links, unique metadata within length limits), RSS and Atom parsing with
malformed input, news de-duplication and source balancing, and a **lockfile
guard** that fails if a platform-specific binding ever becomes a direct
dependency or the optional bindings are pruned — the exact npm bug that broke a
deploy once already.

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for Vercel setup, DNS for
`do101.online`, HTTPS verification and the optional AI and CSP configuration.

## News aggregator

`/news` merges **74 public RSS and Atom feeds** across AI, technology,
developers, crypto, finance, startups, security and science into one page, with
a hub per topic.

**How it stays free.** Feeds are fetched server-side through Next's data cache
with a 20-minute revalidation, so a thousand visitors trigger one fetch per
feed, not a thousand. Each feed has an 8-second timeout and its own try/catch,
so a slow publisher cannot delay or break the page. There is no database, no
cron job and no scheduled worker — pages are statically regenerated on demand.
That fits inside the Vercel Hobby plan with room to spare.

**What it does and does not do.** It shows the headline, the feed's own short
excerpt, the source and the time, then links **straight to the publisher**.
Full articles are never copied. Nothing about your reading is recorded — no
history, no personalisation, no click tracking. Every feed is listed at
`/news/sources`, and any publisher can ask to be removed.

**Quality handling.** The merged stream is de-duplicated by normalised URL and
by normalised title (so the same story from five outlets appears once), capped
at four items per publisher so a high-volume feed cannot fill the page,
interleaved so no two consecutive items share a source, and filtered for
placeholder titles.

Every feed in `src/lib/news/sources.ts` was fetched and parsed successfully
before being added — none is there on the assumption that it works.

## Discovery: search engines and AI assistants

Every tool has its own indexable URL — 111 URLs in the sitemap — and three
machine-readable surfaces make the catalogue easy to consume:

| Endpoint | Purpose |
| --- | --- |
| `/sitemap.xml` | Every page, with hubs prioritised above individual tools. |
| `/llms.txt` | A plain-Markdown summary for language models, generated from the tool registry so it cannot drift. It lists every tool with its URL **and states the site's real limitations**, so an assistant recommending DO101 describes it accurately. |
| `/api/tools.json` | The full catalogue as CORS-enabled JSON: each tool's URL, summary, keywords, features, FAQ and related links. |
| `/api/news.json` | The merged headlines as JSON, filterable by `?category=` and `?limit=`. |

`robots.txt` names the AI and search crawlers explicitly (GPTBot, ClaudeBot,
PerplexityBot, Google-Extended, Applebot and others) and allows all of them.
Only `POST /api/ai` is disallowed, since it returns nothing useful to a crawler.

Structured data covers `WebSite`, `Organization`, `SoftwareApplication` /
`WebApplication`, `BreadcrumbList`, `FAQPage` and `ItemList`. There are no
review or rating schemas anywhere, because DO101 has no genuine ratings to
report.

## Google Search Console

1. Add a property at <https://search.google.com/search-console> — **Domain**
   (DNS TXT record) or **URL prefix** with `https://do101.online`.
2. Verify ownership.
3. **Sitemaps → Add a new sitemap →** `sitemap.xml`.
4. Use **URL Inspection → Request indexing** for the highest-intent pages.
5. Watch **Performance** weekly for queries, impressions and CTR, and **Pages**
   for anything excluded from the index.
6. Improve pages with impressions but low CTR — that is a title and description
   problem, and it is the fastest win available.

## AdSense

The integration is prepared but inert. To enable it after approval, set
`NEXT_PUBLIC_ADSENSE_CLIENT` and the slot ids, then redeploy. Placements sit
between content sections, are labelled, and are never positioned where an
accidental click is likely. Do not apply until the site has substantial
content, real traffic and clean navigation — see
[`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md).

## Known limitations

- **AI rate limiting is per-instance.** The in-memory counter is not shared
  across serverless instances. Move it to a shared store before the endpoint
  sees real traffic.
- **Typing Battle depends on a public broker.** `0.peerjs.com` is free and
  best-effort. Strict firewalls and some mobile networks block peer-to-peer
  traffic; the UI reports this honestly instead of hiding it.
- **Rooms are ephemeral.** No database means a room dies with the host's tab.
- **MD5 is not offered** in the hash generator. Browsers do not ship it in Web
  Crypto and it is cryptographically broken.
- **JSON Schema validation** is not implemented; the validator checks syntax.
- **News depends on third-party feeds.** A publisher can change or withdraw a
  feed at any time. Failures are counted and shown on the page ("N of 74 feeds
  answered") rather than hidden, but a dead feed stays dead until it is replaced.
- **No visual regression testing** yet.

## Documentation

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Vercel, DNS, HTTPS, env vars
- [`docs/LAUNCH.md`](docs/LAUNCH.md) — the 30-day plan
- [`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md) — pre-launch checks
- [`docs/GROWTH.md`](docs/GROWTH.md) — how people find the site: search, AI assistants, earned links
- [`docs/MARKETING.md`](docs/MARKETING.md) — content and distribution playbook

## Principles

No fake statistics, testimonials, user counts, reviews or opponents. No
misleading ad placements. No pages that exist only to carry advertising. Where
a limitation exists, the page says so.
