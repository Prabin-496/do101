import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "developer",
  path: "/tools/developer",
  title: "Free Developer Tools — JSON, Base64, Regex & JWT | DO101",
  description: "23 free developer tools: JSON formatter and validator, Base64, URL encoding, JWT decoder, regex tester, hashes, YAML, XML, SQL and colour conversion.",
  heading: "Developer tools",
  lead: "The utilities you keep in a browser tab all day — JSON, Base64, regex, JWT, hashes, YAML, XML, SQL and colour — without the ad walls or the sign-up.",
  body: [
    {
      heading: "Why these run locally, and why that matters",
      text: (
        <>
          <p>Developer tools handle the most sensitive text most people ever paste into a website: production JSON payloads, JWTs from a live session, database queries with real table names, API responses full of customer records.</p>
          <p>Pasting any of that into a server-side tool means handing it to a third party. Every developer tool on DO101 runs in your browser on the platform&rsquo;s own APIs — <code>JSON.parse</code> for JSON, <code>TextEncoder</code> for Base64, Web Crypto for hashing, the browser&rsquo;s own engine for regular expressions.</p>
          <p>That is not a promise about a retention policy. There is simply no endpoint to send it to.</p>
        </>
      ),
    },
    {
      heading: "Honest about limits",
      text: (
        <>
          <p>The <Link href="/tools/jwt-decoder">JWT Decoder</Link> states plainly that decoding a token does not verify its signature — a distinction that matters enormously and that many tools blur.</p>
          <p>The <Link href="/tools/hash-generator">Hash Generator</Link> offers SHA-1 through SHA-512 but not MD5, because browsers do not ship MD5 in Web Crypto and it is cryptographically broken. It also says outright that a plain SHA hash is the wrong tool for passwords.</p>
          <p>The <Link href="/tools/sql-formatter">SQL Formatter</Link> reformats text and never claims to validate your query. The minifiers touch whitespace and comments only, never renaming or reordering anything, because those transformations can quietly change behaviour.</p>
        </>
      ),
    },
    {
      heading: "The daily set",
      text: (
        <>
          <p><strong>JSON:</strong> <Link href="/tools/json-formatter">format</Link>, <Link href="/tools/json-validator">validate</Link>, <Link href="/tools/json-minifier">minify</Link>, <Link href="/tools/json-escape">escape</Link>, and convert to <Link href="/tools/json-to-csv">CSV</Link>, <Link href="/tools/json-to-yaml">YAML</Link> or <Link href="/tools/json-to-xml">XML</Link>.</p>
          <p><strong>Encoding:</strong> <Link href="/tools/base64">Base64</Link> with full Unicode support, <Link href="/tools/url-encoder">URL encoding</Link> and <Link href="/tools/html-encoder">HTML entities</Link>.</p>
          <p><strong>Inspecting:</strong> <Link href="/tools/jwt-decoder">JWT Decoder</Link>, <Link href="/tools/regex-tester">Regex Tester</Link> with a catastrophic-backtracking guard, <Link href="/tools/timestamp-converter">Unix timestamps</Link> and <Link href="/tools/hash-generator">hashes</Link>.</p>
          <p><strong>Generating:</strong> <Link href="/tools/uuid-generator">UUID v4 in bulk</Link> from the browser&rsquo;s cryptographic random source.</p>
        </>
      ),
    },
  ],
  faqs: [
    {
      q: "Is it safe to paste a production JWT here?",
      a: "The decoding happens entirely in your browser and nothing is transmitted. Even so, treat live tokens like passwords — the safest habit is never to paste production credentials into any website, including this one.",
    },
    {
      q: "Why is MD5 not available?",
      a: "Browsers do not include MD5 in the Web Crypto API, and it has been cryptographically broken for years. Offering it would mean shipping a third-party implementation of an algorithm nobody should choose today.",
    },
    {
      q: "Do these tools work offline?",
      a: "Yes. Once a tool page has loaded, its code is cached and the tool keeps working with no connection at all.",
    },
    {
      q: "Why are there no ads covering the tool?",
      a: "Because the tool is the point. DO101 places advertising between content sections below the working area, and the whole site is fully usable with advertising disabled.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
