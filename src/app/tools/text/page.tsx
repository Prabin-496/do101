import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "text",
  path: "/tools/text",
  title: "Free Text Tools — Count, Clean, Compare & Convert | DO101",
  description: "14 free text tools: word and character counters, duplicate line removal, sorting, find and replace, diff, case conversion and Markdown converters. All private.",
  heading: "Text tools",
  lead: "Count it, clean it, sort it, compare it, convert it. Fourteen tools for the everyday text jobs that are fiddly by hand and instant here.",
  body: [
    {
      heading: "Built for the jobs that waste your afternoon",
      text: (
        <>
          <p>Text work is rarely difficult and often tedious. Someone sends a list with duplicates. A paragraph copied out of a PDF arrives with a line break after every line. An essay needs to come in under a word count. A meta description has to fit inside 155 characters.</p>
          <p>None of that needs a spreadsheet or a script. Each tool here does one job, updates as you type, and tells you exactly what it changed — how many duplicates it dropped, how many characters it removed, how many replacements it made.</p>
        </>
      ),
    },
    {
      heading: "Everything stays in your browser",
      text: (
        <>
          <p>Text is often more sensitive than people expect: draft contracts, customer lists, private notes, unpublished writing. None of it is sent anywhere. These tools are plain JavaScript string operations running in the page you are reading, which is also why they are instant.</p>
          <p>You can prove it to yourself — load a tool page, switch off your network, and it keeps working.</p>
        </>
      ),
    },
    {
      heading: "Where to start",
      text: (
        <>
          <p><strong>Counting:</strong> the <Link href="/tools/word-counter">Word Counter</Link> covers words, sentences, reading time and keyword density; the <Link href="/tools/character-counter">Character Counter</Link> adds live limit bars for X posts, SEO titles and SMS.</p>
          <p><strong>Cleaning:</strong> <Link href="/tools/text-cleaner">Text Cleaner</Link> handles the PDF-paste problem, while <Link href="/tools/remove-duplicate-lines">Remove Duplicate Lines</Link>, <Link href="/tools/remove-empty-lines">Remove Empty Lines</Link> and <Link href="/tools/remove-extra-spaces">Remove Extra Spaces</Link> each do one thing precisely.</p>
          <p><strong>Rearranging:</strong> <Link href="/tools/text-sorter">Text Sorter</Link> orders lines eight ways with natural number sorting, and <Link href="/tools/find-and-replace">Find and Replace</Link> supports regular expressions.</p>
          <p><strong>Comparing and converting:</strong> <Link href="/tools/text-diff">Text Diff</Link> highlights changes word by word, and <Link href="/tools/case-converter">Case Converter</Link> plus the <Link href="/tools/markdown-to-html">Markdown converters</Link> reshape text for wherever it is going next.</p>
        </>
      ),
    },
  ],
  faqs: [
    {
      q: "Is my text sent to a server?",
      a: "No. Every text tool on DO101 runs as JavaScript inside your browser tab. Nothing is transmitted, logged or stored, which is why it is safe to paste a draft contract into one.",
    },
    {
      q: "Is there a length limit?",
      a: "Only your browser's memory. Documents of hundreds of thousands of characters process instantly. The Text Diff tool caps very large comparisons and tells you when it does.",
    },
    {
      q: "Why do my counts differ from Microsoft Word?",
      a: "Word applies its own rules to hyphenated words, numbers and footnotes. DO101 counts any run of non-whitespace characters as one word, which matches most style guides and other online counters.",
    },
    {
      q: "Can I chain tools together?",
      a: "Yes. Every tool has a \"use as input\" button that feeds its output straight back into the input box, so you can clean, then deduplicate, then sort without copying anything.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
