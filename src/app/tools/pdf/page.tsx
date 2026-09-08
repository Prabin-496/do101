import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "pdf",
  path: "/tools/pdf",
  title: "Free PDF Tools — Merge, Split, Compress, Protect | DO101",
  description:
    "34 free PDF tools that run in your browser: merge, split, compress, protect, unlock, sign, redact, scan, OCR and convert to and from Word, Excel, PowerPoint and images.",
  heading: "PDF tools",
  lead: "Merge, split, compress, protect, unlock, sign, redact, scan and convert PDFs — all of it inside your browser, so the document never leaves your device.",
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
      heading: "Where the honest limits are",
      text: (
        <>
          <p>
            Almost everything a PDF service offers can be done in a browser, and DO101 now does
            nearly all of it — including{" "}
            <Link href="/tools/pdf-protect">real AES password protection</Link>,{" "}
            <Link href="/tools/pdf-unlock">removing protection</Link> from documents you own, and{" "}
            <Link href="/tools/pdf-to-powerpoint">building a PowerPoint deck</Link>. Two things are
            genuinely different, and pretending otherwise would waste your time.
          </p>
          <p>
            <strong>PDF to Word converts text, not layout.</strong> Rebuilding columns and tables
            needs heavy layout analysis that realistically belongs on a server. DO101 does the part
            it can do well and tells you plainly what it leaves out, instead of handing back a
            mangled document and calling it a conversion. The same applies to{" "}
            <Link href="/tools/pdf-to-powerpoint">PDF to PowerPoint</Link>, where each page becomes
            a picture on a slide rather than editable text boxes.
          </p>
          <p>
            <strong>PDF/A archiving is not offered.</strong> True PDF/A conformance requires
            embedding every font, attaching colour profiles and writing conforming XMP metadata. A
            file that claims to be PDF/A but is not would fail exactly when it matters — at the
            archive that rejects it years later.
          </p>
          <p>
            <strong>Unlocking is not cracking.</strong> The unlock tool removes restrictions from a
            document that already opens for you, and removes a password when you type it yourself. A
            wrong password is rejected. It will not open a document you do not have access to, and
            it will not be changed to.
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
      q: "Can I open a password-protected PDF here?",
      a: "Most tools need an unprotected file, so run it through the Unlock tool first — it removes the password when you type the one you already use, and strips printing or copying restrictions with no password at all. It is not a cracker: a wrong password is rejected.",
    },
    {
      q: "Is the password protection real encryption?",
      a: "Yes. Protect PDF applies standard AES encryption on your device, and verifies the output genuinely carries an encryption dictionary before offering the download. The password is never transmitted or stored, which also means nobody can recover it for you.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
