# DO101 — 30-day launch plan

The goal for the first month is not revenue. It is **indexed pages that
deserve to rank** and **a reason for people to come back**. Everything else
follows from those two.

Priority order, never reversed:

> useful tools → excellent UX → technical SEO → indexing →
> game virality → social distribution → returning users → AdSense → later monetisation

---

## Week 1 — Ship the foundation

**Status: complete in this repository.**

- [x] 28 tools across image, text, developer, calculator, productivity and games
- [x] Homepage with command search and category paths
- [x] `/tools` directory with search and category filters
- [x] Four games including real peer-to-peer Typing Battle
- [x] SEO infrastructure: per-page metadata, canonicals, Open Graph, sitemap, robots, structured data
- [x] Analytics abstraction (no provider wired, nothing sent)
- [x] Privacy, Terms, About, Contact
- [x] 116 unit tests over the calculation and parsing logic

**What to do in week 1 after deploying:**

1. Deploy to Vercel and connect `do101.online` (see `DEPLOYMENT.md`).
2. Set `NEXT_PUBLIC_CONTACT_EMAIL` to a real address you monitor.
3. Verify `sitemap.xml`, `robots.txt` and canonical URLs on the live domain.
4. Add the property in Google Search Console and submit the sitemap.
5. Use each tool yourself on a real phone. Fix whatever annoys you.

---

## Week 2 — Polish and get indexed

**Search Console**

- Request indexing for the ten highest-intent pages first: image compressor,
  image resizer, JPG→PNG, PNG→JPG, JSON formatter, word counter, QR generator,
  age calculator, percentage calculator, typing test.
- Watch the Pages report for anything excluded and fix the cause, not the symptom.

**Quality pass**

- Run Lighthouse on the homepage, one tool page and one game page. Target
  90+ on Performance, Accessibility, Best Practices and SEO.
- Test every tool on a real phone: iOS Safari and Android Chrome behave
  differently for file pickers and canvas memory limits.
- Keyboard-only pass: tab through the homepage, the command palette (⌘K),
  a tool page and a game.
- Check dark mode on every page, especially code blocks and result cards.

**Content**

- Improve the tool pages that get impressions but no clicks — the title and
  meta description are what people are rejecting, not the tool.
- Add a genuinely useful section to any page that reads thin.

---

## Week 3 — Distribution

**The typing loop is the growth engine.** Search brings people who need one
thing and leave. Typing Battle brings people who invite someone else.

- Record short vertical videos of a real typing race (see `MARKETING.md`).
- Post the typing test where speed-typing communities already exist, as a
  participant, not an advertiser.
- Submit to legitimate directories where a free tools site is on topic.
  Never buy links.
- Write one honest post about how DO101 compresses images without uploading
  them — the technique is genuinely interesting and earns links on merit.

**Add sharing friction removal**

- Confirm the share flow works on iOS, Android and desktop.
- Check that the room invite link in Typing Battle carries the right domain.

---

## Week 4 — Measure and double down

Open Search Console → Performance and answer these questions:

| Question | What to do about it |
| --- | --- |
| Which queries produce impressions? | Those are the pages Google thinks you are about. Improve them first. |
| Which pages get impressions but a low CTR? | Rewrite the title and meta description. Nothing else moves CTR as fast. |
| Which pages rank on page 2? | These are the cheapest wins. Add the depth the page is missing. |
| Which pages are not indexed at all? | Check the Pages report for the exclusion reason. |
| Which tools do people actually finish? | The `tool_complete` event tells you. Invest there. |

Then pick **the three highest-potential pages** and make them clearly the
best result for their query. Three excellent pages beat thirty thin ones.

### What not to do in month one

- Do not mass-generate "compress image under 137 KB" variants. Google calls
  these doorway pages and it will cost you the whole domain.
- Do not apply for AdSense on day one. Apply when there is real content, real
  traffic and clean navigation — see `LAUNCH-CHECKLIST.md`.
- Do not buy traffic or links.
- Do not add tools faster than you can make them good.

---

## Google Search Console setup

1. Go to <https://search.google.com/search-console> and add a property.
2. Choose **Domain** (needs a DNS TXT record — this covers every subdomain and
   both protocols) or **URL prefix** with `https://do101.online`.
3. Verify. For a Domain property, add the TXT record at your registrar; for a
   URL-prefix property, the HTML tag method is easiest — put the tag content in
   a `verification` meta tag in `src/app/layout.tsx`.
4. **Sitemaps → Add a new sitemap →** `sitemap.xml` → Submit.
5. Use **URL Inspection** to request indexing for the priority pages.
6. Check back weekly: Performance for queries and CTR, Pages for coverage,
   Core Web Vitals for field data once you have enough traffic.
