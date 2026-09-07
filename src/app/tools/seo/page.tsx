import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "seo",
  path: "/tools/seo",
  title: "Free SEO Tools — Meta Tags, SERP Preview & Slugs | DO101",
  description: "Free SEO tools: generate meta and Open Graph tags, preview your Google snippet, and build clean URL slugs. No account, no upsell, no crawl limits.",
  heading: "SEO tools",
  lead: "Write metadata that actually fits, preview how it will look in Google, and build clean URLs — without an account or a credit-limited dashboard.",
  body: [
    {
      heading: "Small tools, disproportionate effect",
      text: (
        <>
          <p>Most SEO software sells you dashboards. The everyday work is much smaller than that: getting a title under the length Google will show, writing a description someone actually wants to click, and giving a page a URL a human can read.</p>
          <p>These tools do those specific jobs, show live character counts against real-world limits, and generate correctly-escaped markup you can paste straight into a page.</p>
        </>
      ),
    },
    {
      heading: "How to use them together",
      text: (
        <>
          <p>Start with the <Link href="/tools/serp-preview">SERP Snippet Preview</Link> to draft a title and description that survive truncation. Feed the finished title into the <Link href="/tools/slug-generator">URL Slug Generator</Link> for a clean permalink. Then use the <Link href="/tools/meta-tag-generator">Meta Tag Generator</Link> to produce the full head block, including Open Graph and Twitter card tags so the page looks right when someone shares it.</p>
          <p>The <Link href="/tools/word-counter">Word Counter</Link> also reports keyword density, which is a quick way to check a draft is genuinely about what you think it is about.</p>
        </>
      ),
    },
    {
      heading: "An honest note about SEO advice",
      text: (
        <>
          <p>Meta descriptions are not a ranking factor — Google has said so repeatedly — but they strongly affect click-through rate, which is why they still matter. Google also rewrites titles and descriptions whenever it judges another version fits the query better, so a preview is a guide rather than a guarantee.</p>
          <p>No tool can promise rankings. What these can do is stop you shipping a title that gets cut in half, a description that never appears, or a URL full of percent-encoded punctuation.</p>
        </>
      ),
    },
  ],
  faqs: [
    {
      q: "How long should a title tag be?",
      a: "Around 60 characters on desktop. Google measures pixel width rather than characters, so a title full of wide letters is cut sooner. Put the important words first.",
    },
    {
      q: "Do meta descriptions affect rankings?",
      a: "Not directly. They affect whether someone clicks your result, which is why they are still worth writing carefully.",
    },
    {
      q: "Why does Google show a different title from mine?",
      a: "Google rewrites titles when it believes another version better matches the query. Clear, accurate titles that reflect the page content are rewritten less often.",
    },
    {
      q: "Do I need both Open Graph and Twitter card tags?",
      a: "X falls back to Open Graph when Twitter tags are missing, so strictly speaking no. Including both gives precise control on each platform, which is why the generator emits both.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
