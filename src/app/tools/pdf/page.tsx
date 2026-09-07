import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "pdf",
  path: "/tools/pdf",
  title: "Free PDF Tools — Merge, Split, Compress & Convert | DO101",
  description:
    "21 free PDF tools that run in your browser: merge, split, compress, rotate, watermark, and convert to and from Word, JPG, PNG and text. No upload, no sign-up.",
  heading: "PDF tools",
  lead: "Merge, split, compress, rotate, number, watermark and convert PDFs — all of it inside your browser, so the document never leaves your device.",
  body: [
    {
      heading: "Why in-browser PDF tools matter",
      text: (
        <>
          <p>
            PDFs are the format people use for the documents they care about most: contracts,
            payslips, medical letters, passports, tax returns. Almost every free PDF site online
            asks you to upload those documents to a server you know nothing about, then trusts you
            to believe a promise that the file was deleted afterwards.
          </p>
          <p>
            DO101 takes the promise out of it. Every tool on this page uses{" "}
            <strong>pdf-lib</strong> and <strong>pdf.js</strong> running inside the page you are
            reading. There is no upload endpoint behind any of them, so your document physically
            cannot reach a server. Switch off your network after the page loads and most of them
            still work.
          </p>
        </>
      ),
    },
    {
      heading: "What each tool is for",
      text: (
        <>
          <p>
            <strong>Combining and separating:</strong>{" "}
            <Link href="/tools/pdf-merge">Merge PDF</Link> joins several files into one in the order
            you set. <Link href="/tools/pdf-split">Split PDF</Link> breaks one file into many.{" "}
            <Link href="/tools/pdf-extract-pages">Extract pages</Link> keeps a selection,{" "}
            <Link href="/tools/pdf-delete-pages">Delete pages</Link> drops one, and{" "}
            <Link href="/tools/pdf-reorder-pages">Reorder pages</Link> shuffles them.
          </p>
          <p>
            <strong>Fixing and finishing:</strong>{" "}
            <Link href="/tools/pdf-rotate">Rotate PDF</Link> saves the rotation into the file so it
            sticks. <Link href="/tools/pdf-page-numbers">Page numbers</Link> and{" "}
            <Link href="/tools/pdf-watermark">watermarks</Link> stamp every page.{" "}
            <Link href="/tools/pdf-compress">Compress PDF</Link> makes files smaller, and it is
            honest about the trade-off in each mode.
          </p>
          <p>
            <strong>Converting:</strong> Turn pages into{" "}
            <Link href="/tools/pdf-to-jpg">JPG</Link> or{" "}
            <Link href="/tools/pdf-to-png">PNG</Link>, build a PDF from{" "}
            <Link href="/tools/jpg-to-pdf">photos</Link> or{" "}
            <Link href="/tools/image-to-pdf">any images</Link>, pull out{" "}
            <Link href="/tools/pdf-to-text">plain text</Link>, produce an editable{" "}
            <Link href="/tools/pdf-to-word">Word document</Link>, go the other way with{" "}
            <Link href="/tools/word-to-pdf">Word to PDF</Link>, or read a scan with{" "}
            <Link href="/tools/pdf-ocr">PDF OCR</Link>.
          </p>
        </>
      ),
    },
    {
      heading: "What browser-based PDF tools cannot do",
      text: (
        <>
          <p>
            Being straight about the limits is part of the point. A browser cannot decrypt a
            password-protected PDF, so <strong>PDF unlocking is not offered</strong> — a tool that
            pretended otherwise would just fail on your file. Adding encryption is likewise not
            supported by the libraries that can run here.
          </p>
          <p>
            <strong>PDF to Word converts text, not layout.</strong> Rebuilding columns and tables
            needs heavy layout analysis that realistically belongs on a server. DO101 does the part
            it can do well and tells you plainly what it leaves out, instead of handing back a
            mangled document and calling it a conversion.
          </p>
          <p>
            <strong>Compression has real limits too.</strong> Re-encoding the individual images
            inside a PDF while leaving the text alone requires a full object rewriter. DO101 offers
            the two strategies it can genuinely deliver and explains what each one costs you.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      q: "Are my PDFs uploaded to a server?",
      a: "No. Every tool in this category runs in your browser using pdf-lib and pdf.js. DO101 operates no upload endpoint for PDFs, so the file cannot leave your device even by accident.",
    },
    {
      q: "Is there a file size limit?",
      a: "100 MB per file. The real constraint is your device's memory: a laptop handles large documents comfortably, an older phone will struggle above about 25 MB, and the tools warn you when a file is big enough to be slow.",
    },
    {
      q: "Do the tools add a watermark?",
      a: "Never. DO101 does not brand your documents. The only watermark that appears is the one you deliberately add with the watermark tool.",
    },
    {
      q: "Can I use these tools offline?",
      a: "Mostly yes. Once a tool page has loaded, its code is cached, so merging, splitting and rotating keep working without a connection. PDF OCR is the exception — it downloads a language model the first time you use it.",
    },
    {
      q: "Why can't I open my password-protected PDF?",
      a: "Encrypted PDFs cannot be decrypted by the browser libraries DO101 uses. Open the file in the application that created it, remove the password, then use the tool.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
