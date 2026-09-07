# DO101 launch checklist

**Domain:** https://do101.online
**Hosting:** Vercel (free tier)
**Repository:** push to `main`; Vercel deploys automatically.

Work top to bottom. Anything unticked is a reason not to launch yet.

---

## Build and code quality

- [x] `npm install` completes with no vulnerabilities
- [x] `npm run lint` passes with zero errors and zero warnings
- [x] `npm run typecheck` passes
- [x] `npm run test` passes (116 tests)
- [x] `npm run build` produces a successful production build
- [x] All 28 tool pages prerender as static content
- [x] Heavy libraries (PeerJS, canvas-confetti) load only on the routes that need them
- [x] No secret is exposed through a `NEXT_PUBLIC_*` variable

Run everything at once with `npm run verify`.

## Domain and hosting

- [ ] Project imported into Vercel
- [ ] `NEXT_PUBLIC_SITE_URL=https://do101.online` set in Production
- [ ] `do101.online` added in Vercel → Domains
- [ ] DNS `A` record for `@` and `CNAME` for `www` configured at the registrar
- [ ] `www` redirects to the apex domain
- [ ] HTTPS certificate issued and valid
- [ ] `http://` redirects to `https://`

## SEO

- [x] Every page has a unique `<title>` under 65 characters
- [x] Every page has a unique meta description
- [x] Canonical URL on every page, built from `NEXT_PUBLIC_SITE_URL`
- [x] Open Graph and Twitter card metadata on every page
- [x] Generated OG image at `/opengraph-image`
- [x] `sitemap.xml` lists all 37 URLs
- [x] `robots.txt` allows crawling and points at the sitemap
- [x] Structured data: WebSite, Organization, SoftwareApplication / WebApplication, BreadcrumbList, FAQPage, ItemList
- [x] No fake ratings or review markup anywhere
- [x] Breadcrumbs on every tool page
- [x] Every tool links to four related tools
- [x] Every tool is reachable through plain `<a>` links, not just JS navigation
- [ ] Verified on the live domain: `curl https://do101.online/sitemap.xml`
- [ ] Verified on the live domain: canonical tags show `https://do101.online`

## Search Console

- [ ] Property added and verified
- [ ] `sitemap.xml` submitted
- [ ] Indexing requested for the ten priority pages
- [ ] Coverage report checked after 48 hours

## Content and trust

- [x] Privacy page states exactly what is local and what is not
- [x] Terms page with honest disclaimers
- [x] About page explaining what DO101 is and why
- [x] Contact page (shows "not configured" rather than a fake address)
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL` set to a real, monitored address
- [x] No fake statistics, testimonials, user counts or social proof
- [x] BMI calculator carries a clear "not medical advice" note
- [x] JWT decoder states plainly that decoding does not verify a signature

## Functionality

- [x] All 28 tools work
- [x] Empty, invalid, oversized and error states handled on every tool
- [x] File-size limits enforced (25 MB images, 100 MB hashing, 2 MB data URI)
- [x] Typing Battle handles: no opponent, connection failure, opponent
      disconnect, invalid room, room expiry — with honest messaging
- [x] 404 page with routes back into the site
- [x] `⌘K` command palette works with keyboard navigation
- [ ] Every tool tried by hand on a real phone
- [ ] No console errors on the live site

## Design and accessibility

- [x] Light, dark and system themes all designed, not inverted
- [x] Mobile-first layout, no horizontal scrolling
- [x] Focus states visible on every interactive element
- [x] Skip-to-content link
- [x] `prefers-reduced-motion` respected, including confetti
- [x] Semantic headings in order, ARIA only where needed
- [ ] Lighthouse Accessibility ≥ 90 on homepage, a tool page and a game

## Performance

- [x] Server components by default; client components only where needed
- [x] Route-level code splitting; the homepage does not load tool code
- [x] Fonts loaded through `next/font` with `display: swap` (self-hosted)
- [x] No image CDN dependency
- [ ] Lighthouse Performance ≥ 90
- [ ] Core Web Vitals checked in the field after traffic arrives

## AdSense readiness

- [x] `AdSlot` component renders nothing unless a publisher id is configured
- [x] Ad script only loads when `NEXT_PUBLIC_ADSENSE_CLIENT` is set
- [x] Placements are between content sections, never beside primary actions
- [x] Ads are labelled and never styled as buttons
- [x] The site is fully useful with advertising disabled
- [ ] Applied only once there is substantial content and real traffic
- [ ] Privacy page updated with the final advertising disclosure before ads go live

**Do not assume approval within a month.** Apply when the site has genuine
traffic, complete navigation, original content and no policy violations.

## Analytics

- [x] Provider-agnostic abstraction in place
- [x] Nothing is sent by default — no analytics requests at all
- [ ] Privacy-friendly provider chosen and wired, if you want one
- [ ] Privacy page updated before any analytics goes live

## Final smoke test on the live domain

```bash
for u in / /tools /tools/image-compressor /tools/json-formatter /calculators/age \
         /games/typing-test /games/typing-battle /ai /about /privacy /terms \
         /contact /sitemap.xml /robots.txt; do
  printf "%-32s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' https://do101.online$u)"
done
```

All should return `200`. A nonexistent path should return `404`.
