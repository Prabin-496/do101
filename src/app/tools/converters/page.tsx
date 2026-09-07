import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "converter",
  path: "/tools/converters",
  title: "Free File & Data Converters — CSV, JSON, XML, YAML | DO101",
  description: "Convert between CSV, JSON, XML, YAML, Markdown, HTML and PDF with correct quoting, strict parsing and clear errors. Free and processed in your browser.",
  heading: "Converters",
  lead: "Move data between formats without writing a script: CSV, JSON, XML, YAML, Markdown, HTML and PDF — with correct escaping and honest error messages.",
  body: [
    {
      heading: "Conversion is where the edge cases live",
      text: (
        <>
          <p>Format conversion looks trivial until it is not. A CSV field containing a comma inside quotes. A record missing a field, so every later column shifts by one. An ID like 007 that silently becomes the number 7. A YAML file where a single tab breaks the whole document.</p>
          <p>These converters handle those cases deliberately. CSV parsing is a real RFC 4180-style state machine, not a split on commas. JSON to CSV builds its header from the union of every object&rsquo;s keys, so sparse records still line up. Type conversion is a switch you control, so you can keep your leading zeros.</p>
        </>
      ),
    },
    {
      heading: "What converts to what",
      text: (
        <>
          <p><strong>Data:</strong> <Link href="/tools/csv-to-json">CSV to JSON</Link>, <Link href="/tools/json-to-csv">JSON to CSV</Link>, <Link href="/tools/xml-to-json">XML to JSON</Link>, <Link href="/tools/json-to-xml">JSON to XML</Link>, <Link href="/tools/yaml-to-json">YAML to JSON</Link> and <Link href="/tools/json-to-yaml">JSON to YAML</Link>.</p>
          <p><strong>Documents:</strong> <Link href="/tools/pdf-to-word">PDF to Word</Link>, <Link href="/tools/word-to-pdf">Word to PDF</Link>, <Link href="/tools/markdown-to-pdf">Markdown to PDF</Link>, <Link href="/tools/html-to-pdf">HTML to PDF</Link> and <Link href="/tools/pdf-to-text">PDF to text</Link>.</p>
          <p><strong>Markup:</strong> <Link href="/tools/markdown-to-html">Markdown to HTML</Link> and <Link href="/tools/html-to-markdown">HTML to Markdown</Link>.</p>
          <p><strong>Images:</strong> the full set lives in <Link href="/tools/image">image tools</Link>, including <Link href="/tools/heic-to-jpg">HEIC to JPG</Link> and the WebP converters.</p>
        </>
      ),
    },
    {
      heading: "What DO101 will not pretend to convert",
      text: (
        <>
          <p>Some conversions cannot be done well in a browser, and a tool that fails on your real file is worse than no tool at all.</p>
          <p><strong>PDF to Excel</strong> needs table-structure detection from visual layout, which is genuinely hard and unreliable without a heavy server-side engine. <strong>PowerPoint conversion</strong> in either direction has the same problem. <strong>PDF unlocking</strong> requires decryption the browser libraries cannot perform.</p>
          <p>Those are left out on purpose and named here, rather than shipped as a button that quietly hands back a broken file.</p>
        </>
      ),
    },
  ],
  faqs: [
    {
      q: "Are my files uploaded?",
      a: "No. Every converter here runs in your browser, which is what makes it safe to convert a spreadsheet of customer records or a config file full of internal hostnames.",
    },
    {
      q: "Why did my CSV import shift a column?",
      a: "Almost always an unescaped comma or quote in the source data. DO101's parser handles quoted fields containing commas and newlines correctly, which is exactly where naive converters go wrong.",
    },
    {
      q: "Why is my ID column turning into a number?",
      a: "Type conversion turns numeric-looking strings into real numbers, which drops leading zeros. Switch off \"convert numbers and booleans\" to keep every value as a string.",
    },
    {
      q: "Can you add PDF to Excel?",
      a: "Not until it can be done reliably in a browser. Extracting real table structure from a PDF's visual layout needs analysis that does not run well client-side, and an unreliable version would waste your time.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
