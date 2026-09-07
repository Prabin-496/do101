# Deploying DO101

DO101 is designed to run on free tiers. Nothing in this guide requires a paid
plan.

## What actually needs a server

Almost nothing. Every tool page is statically prerendered, and all the tools
run in the visitor's browser. The only dynamic route is `POST /api/ai`, and
even that is optional — with no AI key configured it answers from a small
rule table with no external calls.

That means DO101 fits comfortably inside the Vercel Hobby (free) plan.

---

## 1. Push to GitHub

```bash
git init                # if the repo is not initialised yet
git add .
git commit -m "DO101 initial release"
git branch -M main
git remote add origin https://github.com/<you>/do101.git
git push -u origin main
```

Confirm `.env.local` is **not** in the commit — `.gitignore` excludes it.

## 2. Import the project into Vercel

1. Go to <https://vercel.com/new>.
2. Choose **Import Git Repository** and pick the repo.
3. Vercel detects Next.js automatically. Leave the build command
   (`next build`), output directory and install command at their defaults.
4. Do not deploy yet — set the environment variables first.

## 3. Configure environment variables

In **Project → Settings → Environment Variables**, add the following for the
**Production** environment (and Preview if you want previews to be accurate):

| Variable | Value | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://do101.online` | **Yes** |
| `NEXT_PUBLIC_CONTACT_EMAIL` | your real support address | Recommended |
| `NEXT_PUBLIC_TWITTER_HANDLE` | `@yourhandle` | No |
| `ANTHROPIC_API_KEY` | secret key | No |
| `ANTHROPIC_MODEL` | e.g. `claude-haiku-4-5-20251001` | No |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | `ca-pub-…` | Only after AdSense approval |
| `NEXT_PUBLIC_ADSENSE_SLOT_*` | slot ids | Only after AdSense approval |

`NEXT_PUBLIC_SITE_URL` must have **no trailing slash**. It drives canonical
URLs, Open Graph tags, `sitemap.xml`, `robots.txt` and Typing Battle invite
links, so getting it wrong is the single most damaging misconfiguration.

> **Never** prefix a secret with `NEXT_PUBLIC_`. Anything with that prefix is
> compiled into the JavaScript that ships to every visitor. `ANTHROPIC_API_KEY`
> is deliberately un-prefixed and is only ever read on the server.

## 4. Deploy

Press **Deploy**. The first build takes a couple of minutes. Every later push
to `main` deploys automatically, and every pull request gets a preview URL.

## 5. Connect do101.online

1. In Vercel, open **Project → Settings → Domains**.
2. Add `do101.online`, then add `www.do101.online` and set it to redirect to
   the apex domain (Vercel offers this as a one-click option).
3. Vercel shows the DNS records you need.

### 6. Configure DNS at your registrar

Use whichever of these Vercel shows you — the values it displays take
precedence over anything written here:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

If your registrar supports `ALIAS`/`ANAME` at the apex, that works too.
DNS changes usually propagate in minutes but can take up to 48 hours.

### 7. Verify HTTPS

Vercel issues a Let's Encrypt certificate automatically once DNS resolves.
The domain list shows **Valid Configuration** with a padlock when it is done.
Load `https://do101.online` and confirm there is no certificate warning and
that `http://` redirects to `https://`.

### 8. Verify the sitemap

```bash
curl -s https://do101.online/sitemap.xml | head -20
curl -s https://do101.online/robots.txt
```

Every `<loc>` must start with `https://do101.online`. If they say
`localhost` or a `*.vercel.app` address, `NEXT_PUBLIC_SITE_URL` is wrong or
was added after the last build — fix it and redeploy.

### 9. Verify canonical URLs

```bash
curl -s https://do101.online/tools/image-compressor | grep canonical
```

Expected:

```html
<link rel="canonical" href="https://do101.online/tools/image-compressor"/>
```

Spot-check a few more pages, including the homepage.

---

## Optional: enabling DO101 AI

1. Create an API key at <https://console.anthropic.com>.
2. Add it as `ANTHROPIC_API_KEY` in Vercel (Production only, if you want to
   keep preview deployments free).
3. Redeploy.

Cost control that is already in place:

- Input is capped at 8,000 characters per request.
- Requests time out after 12 seconds.
- A per-instance rate limit of 12 requests per minute per IP.
- Deterministic rules answer the common requests **before** the model is
  called, so most traffic costs nothing at all.
- The model is only asked to pick a tool name and arguments, so responses are
  capped at 512 tokens.

**Known limitation:** the rate limiter is in-memory. Serverless instances do
not share state, so a burst spread across many cold starts can exceed the
nominal limit. If DO101 AI ever gets meaningful traffic, move the counter to
a shared store (Vercel KV's free tier is sufficient) or put the route behind
Vercel's WAF rate-limiting rules.

## Optional: a Content-Security-Policy

`next.config.ts` sets sensible security headers but deliberately no CSP,
because a correct policy depends on what you enable:

- **AdSense** needs `pagead2.googlesyndication.com`, `googleads.g.doubleclick.net`
  and `tpc.googlesyndication.com` in `script-src`, `frame-src` and `img-src`.
- **Typing Battle** needs `wss://0.peerjs.com` in `connect-src`, plus STUN
  traffic which CSP does not govern.
- **Google Fonts** are self-hosted by `next/font`, so they need nothing.

Add a CSP once you know which of these are switched on, and test Typing
Battle and an ad-serving page before shipping it.

## Rolling back

Vercel keeps every previous deployment. **Deployments → ⋯ → Promote to
Production** restores an earlier build instantly, with no rebuild.
