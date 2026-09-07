# DO101 — how people will actually find this

Three channels, in the order they will matter. Everything here is legitimate:
no bought links, no bot traffic, no fake accounts. Those tactics get a domain
penalised, and a penalty on a tools site is fatal because search *is* the
product's front door.

---

## 1. Search — the compounding channel

### Why the architecture already helps

- **111 indexable URLs**, one per tool. Someone searching "merge pdf" lands on
  a page about merging PDFs, not a homepage they have to navigate.
- **Nine category hubs** (`/tools/pdf`, `/tools/image`, …) that rank for the
  broad head terms and pass authority down to the individual tools.
- **Real anchor links everywhere** — the hubs, the footer, the `/tools`
  category cards and the "related tools" block on every page. Nothing important
  is reachable only through a client-side filter.
- **Unique metadata** on every page, enforced by a unit test that fails the
  build if two tools ever share a title or description.
- **Structured data**: `SoftwareApplication`, `FAQPage`, `BreadcrumbList`,
  `ItemList`. No review or rating schema, because there are no genuine ratings.

### What to do, in order

1. **Verify the domain in Search Console and submit `sitemap.xml`.** Nothing
   else on this list matters until Google has the URL list.
2. **Request indexing for the fifteen highest-intent pages first.** These are
   the queries with real volume and clear intent:

   | Page | The query behind it |
   | --- | --- |
   | `/tools/pdf-merge` | merge pdf |
   | `/tools/pdf-to-word` | pdf to word |
   | `/tools/pdf-compress` | compress pdf |
   | `/tools/pdf-split` | split pdf |
   | `/tools/jpg-to-pdf` | jpg to pdf |
   | `/tools/pdf-to-jpg` | pdf to jpg |
   | `/tools/image-compressor` | compress image |
   | `/tools/heic-to-jpg` | heic to jpg |
   | `/tools/word-to-pdf` | word to pdf |
   | `/tools/pdf-ocr` | scanned pdf to text |
   | `/tools/json-formatter` | json formatter |
   | `/tools/word-counter` | word counter |
   | `/tools/qr-generator` | qr code generator |
   | `/calculators/age` | age calculator |
   | `/games/typing-test` | typing test |

3. **Wait.** New domains sit in a sandbox for weeks. Impressions arrive before
   clicks; clicks arrive before rankings settle. Do not judge anything before
   day 30.
4. **Then optimise on evidence.** In Search Console → Performance, sort by
   impressions and find pages with a CTR under 2%. Those pages already rank —
   people are simply not choosing them. Rewrite the title and description; it
   is the fastest win available and needs no new content.
5. **Find the page-two pages.** Anything at position 11–20 is close. Add the
   depth it is missing: a worked example, the specific sub-question people ask,
   a comparison of the two options.

### The differentiator to lean on

Every competitor in this space uploads your file to a server. DO101 does not,
and that is not a marketing claim — there is no upload endpoint behind the PDF
and image tools. That is worth saying on every page, because it is the one
thing a visitor cannot verify about anyone else and can verify here by opening
the network tab.

### What not to do

- **No doorway pages.** "compress-pdf-under-137kb" and forty variants will get
  the whole domain demoted. Only build a variant when it has genuinely
  different functionality or content.
- **No keyword stuffing.** The pages read like a person wrote them because a
  person should be able to read them.
- **No fake FAQ schema.** Only mark up questions that are genuinely answered on
  the page, which is why `FAQPage` is generated from the same FAQs the visitor
  sees.

---

## 2. AI assistants — the channel most sites have not noticed

A growing share of "which tool should I use for X" questions never reach a
search box. Three surfaces make DO101 answerable:

| Surface | What it does |
| --- | --- |
| `/llms.txt` | A Markdown summary generated from the tool registry: what the site is, every tool with its URL, and — critically — **its real limitations**. An assistant that reads this describes DO101 accurately instead of guessing. |
| `/api/tools.json` | The full catalogue as CORS-enabled JSON. Anyone building an integration or a directory can consume it directly. |
| `robots.txt` | Names GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot and the rest explicitly as allowed. |

**Why the limitations section matters.** An assistant that recommends DO101 for
PDF-to-Excel and then hears "it mangled my merged cells" stops recommending it.
Stating that table detection is position-based, reports a confidence score, and
struggles with merged cells means the recommendation lands with the right
expectation — and the tool keeps its reputation.

Keep `llms.txt` honest as tools change. It is generated from the registry, so
tool listings cannot drift; the limitations paragraph is hand-written and must
be updated whenever a limit changes.

---

## 3. Links and distribution — earned, never bought

### Links worth pursuing

- **Free-tool directories** that accept genuine submissions. One-off, low
  effort, mildly useful.
- **Developer communities** where a specific tool is the direct answer to a
  specific question. Answer the question properly; mention the tool once.
- **A technical write-up.** The most linkable thing DO101 has is not a tool, it
  is a technique: compressing an image to a target byte size by binary-searching
  JPEG quality against `canvas.toBlob`, and redacting a PDF by flattening pages
  so the text is genuinely gone. Both are real engineering that other developers
  will link to on merit.
- **"How I built it" posts** about running pdf-lib, pdf.js and Tesseract
  entirely client-side to keep hosting free.

### Links to refuse

Paid links, link exchanges, private blog networks, comment spam and directory
farms. Every one is a documented penalty risk, and the recovery from a manual
action costs more than the links ever earned.

### Distribution that is not links

- **The share loop.** Typing Battle invites are a URL. Every game result has a
  share card. That is the cheapest acquisition DO101 has.
- **Short video.** The visual tools demo themselves in ten seconds: a 5 MB
  photo dropping to 190 KB, a scanned page becoming selectable text, two
  progress bars racing in a live typing battle. See `MARKETING.md`.
- **The full-screen clock.** People leave it running on a second monitor all
  day, which is a category of return visit almost nothing else earns.

---

## Measuring whether any of it worked

From Search Console: impressions, clicks, CTR, average position, indexed pages.

From the analytics abstraction once a provider is connected: `tool_open`,
`tool_complete`, `share_result`.

The two ratios that actually matter:

- **`tool_complete` ÷ `tool_open`** — did the tool do the job? A low number is a
  product problem, and no amount of traffic fixes it.
- **returning visitors** — did anyone come back? A tools site lives on being
  remembered, not on winning a single click.

If completion is low, stop doing SEO and fix the tool.
