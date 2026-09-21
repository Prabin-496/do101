import type { Guide } from "./types";

/**
 * The how-to guides, one per specific job people search for.
 *
 * Kept in the order the index page lists them within each category. The facts
 * here are the tool registry's facts — when a tool's behaviour changes, the
 * guide that points at it has to change too.
 */
export const GUIDES: Guide[] = [
  // ─── PDF ───────────────────────────────────────────────────────────────
  {
    slug: "merge-pdf-files-without-uploading",
    tool: "pdf-merge",
    heading: "How to merge PDF files without uploading them",
    seoTitle: "How to Merge PDF Files Free Without Uploading Them | DO101",
    seoDescription:
      "Combine several PDFs into one file for free, in your browser, without sending them to a server. No watermark, no page limit, no sign-up.",
    answer:
      "Open the DO101 PDF Merger, drop in your PDF files, drag them into the order you want and press Merge. The files are combined by pdf-lib running inside your browser, so they are never uploaded — there is no server behind the tool to upload them to. There is no watermark, no file limit and no account.",
    steps: [
      "Open the PDF Merger.",
      "Drop your PDFs onto the page, or tap to choose them. The page count of each file appears next to it.",
      "Drag the files into the order the pages should appear in.",
      "Press Merge and download the combined PDF.",
    ],
    sections: [
      {
        heading: "Why merging without uploading matters",
        paragraphs: [
          "Most online PDF mergers upload your files to their server, merge them there and keep them for a while before deleting them. For a menu or a flyer that is fine. For a signed contract, a bank statement or a medical letter, it means a copy of the document now sits on a stranger's computer.",
          "DO101 merges on your own device. You can check this yourself: open your browser's developer tools, switch to the Network tab and merge a file — nothing is sent.",
        ],
      },
      {
        heading: "Does merging change the pages?",
        paragraphs: [
          "No. Pages are copied across whole, not re-rendered, so text stays selectable and searchable and images keep their original resolution. The combined file is roughly the size of the originals added together.",
          "If the result is too big to email, run it through the PDF Compressor afterwards — but read how compression works first, because the stronger setting turns pages into pictures.",
        ],
      },
      {
        heading: "What it cannot do",
        paragraphs: [
          "A PDF that asks for a password before it opens cannot be merged until the password is removed. If you know the password, the PDF Unlocker removes it, also without uploading. The practical size ceiling is your device's memory: a few hundred megabytes of PDFs is comfortable on a laptop, less on an older phone.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is there a limit on how many PDFs I can merge?",
        a: "There is no fixed limit on files or pages. The only ceiling is your device's memory.",
      },
      {
        q: "Can I merge PDFs on my phone?",
        a: "Yes. The merger works in Safari and Chrome on iPhone and Android. Choose the files from Files or your downloads, reorder them with your finger, and the merged PDF saves to your downloads.",
      },
      {
        q: "Can I merge only some pages from each file?",
        a: "Merge the whole files first, then use Delete PDF Pages to drop the pages you do not want — or pull just the pages you need out of each file with the Page Extractor before merging.",
      },
    ],
    related: ["compress-pdf-to-send-by-email", "remove-password-from-pdf", "sign-a-pdf-without-printing-it"],
  },
  {
    slug: "compress-pdf-to-send-by-email",
    tool: "pdf-compress",
    heading: "How to make a PDF small enough to email",
    seoTitle: "How to Compress a PDF to Email It — Free, No Upload | DO101",
    seoDescription:
      "Shrink a PDF that is too big for Gmail or Outlook, free and without uploading it. Which compression setting to use, and what each one costs you.",
    answer:
      "Open the DO101 PDF Compressor and drop in the file. Try the safe mode first: it keeps text selectable and works well on PDFs that were saved inefficiently. If the PDF is a scan or full of photos and still too big, switch to the stronger mode, which re-draws each page as an image and shrinks scans dramatically. Both run in your browser.",
    steps: [
      "Open the PDF Compressor and drop in the PDF.",
      "Run the safe mode first and check the before and after sizes it shows.",
      "If it is still too large and the PDF is a scan, choose the stronger mode and lower the image quality until it fits.",
      "Download the result and keep the original.",
    ],
    sections: [
      {
        heading: "How big is too big for email?",
        paragraphs: [
          "Gmail accepts attachments up to 25 MB and Outlook up to 20 MB, but attachments grow by about a third when they are encoded for sending, so a file that is only just under the limit can still bounce. Aim for comfortably under — 10 to 15 MB is safe almost everywhere, and many company mail servers set a much lower limit of their own.",
        ],
      },
      {
        heading: "The two ways DO101 compresses, and what they cost",
        paragraphs: [
          "The safe mode rewrites the file's internal structure. Text stays text, and nothing about how the document looks changes. On a PDF exported by modern software the saving is often small, because there is little waste to remove — the tool tells you when a file did not get smaller rather than handing you a copy that is no better.",
          "The stronger mode renders each page to a JPEG and rebuilds the PDF around those images. A 30 MB phone scan can fall to a few megabytes. The price is that the result is a picture of your document: the text can no longer be selected, searched or copied. That is usually fine for a signed form you are sending back, and not fine for a report someone needs to quote from.",
        ],
      },
      {
        heading: "If it still will not fit",
        paragraphs: [
          "Split it. The PDF Splitter cuts a document into parts by page range, and two 12 MB attachments send where one 24 MB file does not. Or send only the pages that matter with the Page Extractor.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why did my PDF barely shrink?",
        a: "It was already efficiently built, which most PDFs from Word or Google Docs are. The big savings come from scans and image-heavy files, and those need the stronger mode.",
      },
      {
        q: "Why do some websites compress more?",
        a: "Server-based compressors can re-encode just the images inside a PDF and leave the text alone. That needs a full PDF rewriter, which a browser cannot do reliably, so DO101 offers the two methods it can genuinely deliver and labels them.",
      },
      {
        q: "Is my PDF uploaded?",
        a: "No. Both modes run on your device.",
      },
    ],
    related: ["merge-pdf-files-without-uploading", "compress-image-under-100kb", "copy-text-from-a-scanned-pdf"],
  },
  {
    slug: "sign-a-pdf-without-printing-it",
    tool: "pdf-sign",
    heading: "How to sign a PDF without printing it",
    seoTitle: "How to Sign a PDF Online Free — No Printing, No Account | DO101",
    seoDescription:
      "Add your handwritten signature to a PDF form or agreement free, on a laptop or phone, without printing, scanning or creating an account.",
    answer:
      "Open the DO101 PDF Signer and load the PDF. Draw your signature with a mouse, trackpad or finger — or upload a picture of it — then click the spot on the page where it belongs, resize it, and download the signed PDF. The document and your signature stay on your device and are discarded when you close the tab.",
    steps: [
      "Open the PDF Signer and choose your PDF.",
      "Draw your signature in the box, or upload a PNG of it.",
      "Click where the signature should go on the page, and adjust its size.",
      "Download the signed PDF.",
    ],
    sections: [
      {
        heading: "Getting a signature that looks like yours",
        paragraphs: [
          "On a laptop, a trackpad gives a smoother signature than a mouse; on a phone or tablet, your finger or a stylus works best of all. If you already have your signature on paper, photograph it on white paper in good light, remove the background, and upload it as a PNG — a JPG keeps a white box around the signature that shows on coloured or lined forms.",
        ],
      },
      {
        heading: "Is it legally valid?",
        paragraphs: [
          "This places a visual signature — the same thing as signing a printout and scanning it back, without the printer. That is what most everyday forms, tenancy paperwork, school permission slips and freelance agreements ask for.",
          "It is not a cryptographic digital signature. It creates no certificate, no audit trail and no proof of who signed. When a contract specifically requires a verifiable e-signature, use a dedicated e-signature service.",
        ],
      },
      {
        heading: "Before you send it back",
        paragraphs: [
          "Open the downloaded file and check the signature sits on the line, at a sensible size, on every page that needs one — initials on each page of a lease are easy to miss. Keep the unsigned original too. If the signed file is too large to attach, the PDF Compressor's safe mode shrinks it without turning the pages into pictures.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I sign on my phone?",
        a: "Yes. Open the page in your phone's browser, draw with your finger, and tap the page to place the signature.",
      },
      {
        q: "Is my signature saved anywhere?",
        a: "No. It exists only in the open page and is gone when you close the tab.",
      },
      {
        q: "Can I sign more than one page?",
        a: "Yes. Place the signature on as many pages as you need before downloading.",
      },
    ],
    related: ["merge-pdf-files-without-uploading", "redact-a-pdf-properly", "compress-pdf-to-send-by-email"],
  },
  {
    slug: "remove-password-from-pdf",
    tool: "pdf-unlock",
    heading: "How to remove a password from a PDF you can open",
    seoTitle: "How to Remove a Password From a PDF — Free, In Browser | DO101",
    seoDescription:
      "Remove the open password or the printing and copying locks from your own PDF, free and without uploading it. Not a password cracker.",
    answer:
      "Open the DO101 PDF Unlocker and load the file. If the PDF opens but blocks printing or copying, those restrictions are removed without any password. If it asks for a password to open, type the password you already use and download an unprotected copy. It will not open a PDF you do not have the password for.",
    steps: [
      "Open the PDF Unlocker and choose the PDF.",
      "The tool tells you which kind of protection the file has.",
      "For printing and copying locks, press Unlock. For an open password, type it first.",
      "Download the unlocked PDF.",
    ],
    sections: [
      {
        heading: "Why remove a password you already know?",
        paragraphs: [
          "Bank statements, payslips and tax documents often arrive locked with a password such as a date of birth. That is sensible in transit, but tiresome once the file is yours: you type the password every time, and other tools — mergers, compressors, accounting software uploads — refuse to open it at all. Removing it once saves the trouble.",
          "Keep the unlocked copy somewhere private, such as an encrypted drive or your password manager's file storage, since it no longer protects itself.",
        ],
      },
      {
        heading: "The two kinds of PDF protection",
        paragraphs: [
          "An owner password restricts what you can do with a PDF that opens normally — printing, copying text, editing. Those restrictions come off with no password at all.",
          "A user password is required to open the PDF in the first place. Its contents are encrypted, and only the right password decrypts them. DO101 decrypts properly and checks the result, so the text is intact afterwards; a wrong password is rejected.",
        ],
      },
      {
        heading: "Use it on your own documents",
        paragraphs: [
          "Only remove protection from documents you own or are allowed to change. Taking it off someone else's document can breach copyright or a contract, depending on where you live.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can this open a PDF if I forgot the password?",
        a: "No. It is deliberately not a password cracker, and a wrong password is rejected.",
      },
      {
        q: "Is my password sent anywhere?",
        a: "No. The file and the password stay on your device; the decryption happens in the page.",
      },
      {
        q: "Can I add a password back later?",
        a: "Yes, with the PDF Protector, which applies real AES encryption in your browser.",
      },
    ],
    related: ["merge-pdf-files-without-uploading", "compress-pdf-to-send-by-email", "redact-a-pdf-properly"],
  },
  {
    slug: "copy-text-from-a-scanned-pdf",
    tool: "pdf-ocr",
    heading: "How to copy text from a scanned PDF",
    seoTitle: "How to Copy Text From a Scanned PDF — Free OCR Online | DO101",
    seoDescription:
      "Get selectable, copyable text out of a scanned PDF with free OCR that runs in your browser. 17 languages, a confidence score, nothing uploaded.",
    answer:
      "A scanned PDF is a picture of text, so there is nothing to select. Run it through DO101 PDF OCR: it reads each page with optical character recognition, gives you the text to copy or download as a .txt file, and shows a confidence score so you know how much to trust it. It supports 17 languages and runs on your device.",
    steps: [
      "Open PDF OCR and choose the scanned PDF.",
      "Pick the language the document is written in.",
      "Start recognition. The first run downloads the OCR engine, which your browser then keeps.",
      "Check the confidence score, then copy the text or download it.",
    ],
    sections: [
      {
        heading: "How to tell a scan from a normal PDF",
        paragraphs: [
          "Try to select a word. If the cursor drags a blue box over the whole page instead of highlighting text, the PDF is an image. Phone scanning apps, office photocopiers and old archive documents all produce these.",
        ],
      },
      {
        heading: "Getting accurate results",
        paragraphs: [
          "OCR is only as good as the image. A straight, flat, high-contrast scan comes out very well; a crooked phone photo of a faded receipt comes out poorly. If the score is below 70%, DO101 warns you — rescanning in better light usually does more than any setting.",
          "Choose the right language. Recognition uses a language model, and reading French with the English model misses accents and common words.",
        ],
      },
      {
        heading: "Limits",
        paragraphs: [
          "Up to 20 pages per run, to keep the browser responsive — split a longer document first. The first run downloads the engine and language model, about 12 to 15 MB, from a public CDN; your PDF itself is never uploaded.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I get a Word document instead of plain text?",
        a: "Copy the OCR text into Word, or, for a PDF that already has a text layer, use PDF to Word directly.",
      },
      {
        q: "Does it work on photos, not PDFs?",
        a: "Yes — use Image to Text for a JPG or PNG. It uses the same engine.",
      },
      {
        q: "Which languages are supported?",
        a: "Seventeen, including English, Spanish, French, German, Portuguese, Italian, Japanese and Chinese. The full list is in the language picker.",
      },
    ],
    related: ["convert-pdf-table-to-excel", "compress-pdf-to-send-by-email", "merge-pdf-files-without-uploading"],
  },
  {
    slug: "redact-a-pdf-properly",
    tool: "pdf-redact",
    heading: "How to redact a PDF so the text is really gone",
    seoTitle: "How to Redact a PDF Properly — Free, No Upload | DO101",
    seoDescription:
      "Black out names, account numbers and addresses in a PDF so they cannot be copied back out. Free, in your browser, with nothing uploaded.",
    answer:
      "Drawing a black box over text in a PDF only hides it — the words are still in the file and can be copied out. To redact properly, open the DO101 PDF Redactor, drag over everything that must go, and download. Each page is flattened to an image with those areas painted out, so the original text is genuinely removed.",
    steps: [
      "Open the PDF Redactor and choose the PDF.",
      "Drag a box over each area to remove, on any page. Click a box to take it off again.",
      "Download the redacted PDF.",
      "Check it: try to select or search for a redacted word. It should not be found.",
    ],
    sections: [
      {
        heading: "Why a black rectangle is not enough",
        paragraphs: [
          "A PDF stores text and drawings separately. A rectangle drawn on top sits over the words without touching them, so anyone can select the text underneath, copy it, or extract it with a converter. Court filings and government reports have leaked exactly this way.",
        ],
      },
      {
        heading: "The trade-off",
        paragraphs: [
          "Because redacted pages are turned into images, the rest of the text on those pages is no longer selectable or searchable either. That is the price of certainty. If you need the unredacted pages to stay searchable, extract just the pages that need redacting, redact those, and merge them back.",
          "Up to 40 pages can be redacted per run.",
        ],
      },
      {
        heading: "What people forget to redact",
        paragraphs: [
          "The same detail repeated elsewhere: a name in the page footer, an account number in the header of every page, a reference number that identifies the person anyway. Signatures and handwritten initials. Text inside images and stamps. Go through every page once with a single question — could someone work out what I removed from what I left?",
        ],
      },
      {
        heading: "Why it matters that nothing is uploaded",
        paragraphs: [
          "The documents people redact are, by definition, the ones with something to hide. Rendering, painting and rebuilding all happen on your device, so the unredacted original never leaves it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does redaction remove hidden data too?",
        a: "The redacted pages are rebuilt from images, so the text objects on them are gone. Check the document properties for an author name or title you also want removed.",
      },
      {
        q: "Can I redact on a phone?",
        a: "Yes. Marking areas works with touch as well as a mouse.",
      },
    ],
    related: ["sign-a-pdf-without-printing-it", "remove-password-from-pdf", "merge-pdf-files-without-uploading"],
  },
  {
    slug: "convert-pdf-table-to-excel",
    tool: "pdf-to-excel",
    heading: "How to get a table out of a PDF and into Excel",
    seoTitle: "How to Convert a PDF Table to Excel Free — No Upload | DO101",
    seoDescription:
      "Pull tables out of a PDF bank statement, invoice or report into a real Excel file, free and in your browser, with a confidence score for each table.",
    answer:
      "Open DO101 PDF to Excel and drop in the PDF. It finds tables from where each word sits on the page, shows you a preview with a confidence score, and builds a real .xlsx with one sheet per page. It works on PDFs that contain text; a scanned PDF needs OCR first. Everything runs in your browser.",
    steps: [
      "Open PDF to Excel and choose the PDF.",
      "Look over the preview and the confidence score for each table.",
      "Download the .xlsx workbook — one sheet per page.",
      "Open it in Excel or Google Sheets and tidy anything the preview flagged.",
    ],
    sections: [
      {
        heading: "What converts well",
        paragraphs: [
          "Ordinary tables with ruled lines or neatly aligned columns: bank statements, price lists, timetables, invoice line items, results tables in reports. Words on the same baseline become a row and words that line up vertically become a column.",
        ],
      },
      {
        heading: "What needs checking",
        paragraphs: [
          "Merged cells, tables inside tables, and cells whose text wraps onto a second line are where position-based detection struggles. That is why every table gets a confidence score and a preview before you trust it. Commercial converters run trained layout models on a server and do better on messy tables; this one does the job without your statement leaving your device.",
        ],
      },
      {
        heading: "If it finds no tables",
        paragraphs: [
          "Either the PDF is a scan — try selecting a word; if you cannot, run it through PDF OCR first — or the data is laid out as free text rather than aligned columns.",
        ],
      },
      {
        heading: "Cleaning up in Excel afterwards",
        paragraphs: [
          "Numbers copied from PDFs often arrive as text — right-align them to check. Select the column and use Data › Text to Columns › Finish to turn them back into numbers, or multiply by 1 in a helper column. Totals and subtotal rows from the PDF come across as ordinary rows, so delete them before summing, or you will count everything twice. A statement that runs across several pages lands on several sheets; copy them under one another to get a single table.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is it a real Excel file or a CSV?",
        a: "A real .xlsx workbook, with one sheet per page of the PDF.",
      },
      {
        q: "Is my bank statement uploaded?",
        a: "No. The PDF is read and the workbook built inside your browser.",
      },
    ],
    related: ["copy-text-from-a-scanned-pdf", "remove-password-from-pdf", "remove-duplicates-from-a-list"],
  },

  // ─── Images ────────────────────────────────────────────────────────────
  {
    slug: "compress-image-under-100kb",
    tool: "image-compressor",
    heading: "How to compress a photo to under 100 KB for an online form",
    seoTitle: "Compress an Image to Under 100 KB (or 20, 50, 200 KB) Free | DO101",
    seoDescription:
      "Shrink a photo or signature to fit an upload limit like 20 KB, 50 KB, 100 KB or 200 KB, free and without uploading it. Works on phones.",
    answer:
      "Open the DO101 Image Compressor, add the photo, switch to target-size mode and type the limit in kilobytes — 100, 50, 20, whatever the form asks for. DO101 re-encodes the image at different quality levels and keeps the best-looking version that fits. It runs in your browser, so the photo is never uploaded.",
    steps: [
      "Open the Image Compressor and add the photo.",
      "Switch to target-size mode and type the limit in KB.",
      "Press Compress and compare the before and after.",
      "Download the result and upload it to the form.",
    ],
    sections: [
      {
        heading: "Why forms set tiny limits",
        paragraphs: [
          "Exam registrations, visa and passport applications, job portals and university admissions often cap photos at 20 KB to 200 KB, and signatures even lower. A phone photo is usually 2 to 5 MB, fifty times over.",
        ],
      },
      {
        heading: "Resize first for a sharper result",
        paragraphs: [
          "Compression alone has to squeeze a 4000-pixel-wide photo into the same few kilobytes as a small one, and it does it by throwing away quality. If the form also gives pixel dimensions — 200 × 230 for a passport-style photo is common — resize to those first with the Image Resizer. A smaller image fits the limit at a much higher quality.",
        ],
      },
      {
        heading: "Choosing a format",
        paragraphs: [
          "Use JPG for photos unless the form asks for something else — it is accepted everywhere and compresses photographs well. PNG suits signatures and screenshots with flat colour but is usually bigger for photos. WebP is smaller still, but some older government portals reject it.",
        ],
      },
      {
        heading: "If the form still rejects the photo",
        paragraphs: [
          "Check the file extension it wants — some portals accept .jpg but not .jpeg, or reject upper-case .JPG. Check the pixel dimensions too; a limit on size in KB often comes with a minimum or exact width and height.",
        ],
      },
    ],
    faqs: [
      {
        q: "Will the photo look worse?",
        a: "At normal limits, not noticeably. Most photos look the same at 70–80% quality while losing more than half their size. Very low limits on large images will show blockiness — resize first to avoid it.",
      },
      {
        q: "Can I compress several photos at once?",
        a: "Yes. Batch mode compresses several images in one pass.",
      },
      {
        q: "My photo is HEIC from an iPhone — will it work?",
        a: "Convert it to JPG first with HEIC to JPG, then compress it.",
      },
    ],
    related: ["convert-iphone-heic-photos-to-jpg", "compress-pdf-to-send-by-email", "sign-a-pdf-without-printing-it"],
  },
  {
    slug: "convert-iphone-heic-photos-to-jpg",
    tool: "heic-to-jpg",
    heading: "How to convert iPhone HEIC photos to JPG",
    seoTitle: "How to Convert iPhone HEIC Photos to JPG Free — No Upload | DO101",
    seoDescription:
      "Open iPhone photos on Windows, Android or any upload form by converting HEIC to JPG free, in a batch, without uploading your camera roll.",
    answer:
      "Open DO101 HEIC to JPG, drop in the .heic photos — as many as you like — and download them as ordinary JPGs that open everywhere. The conversion uses a WebAssembly build of libheif inside your browser, so your photos are never uploaded. To stop your iPhone creating HEIC files at all, choose Settings › Camera › Formats › Most Compatible.",
    steps: [
      "Open HEIC to JPG.",
      "Drop in your .heic photos, or choose them from your files.",
      "Wait for each one to convert — sizes before and after are shown.",
      "Download the JPGs.",
    ],
    sections: [
      {
        heading: "Why iPhone photos will not open",
        paragraphs: [
          "Since iOS 11, iPhones save photos as HEIC, which takes roughly half the space of a JPG at the same quality. Apple devices read it natively; Windows needs an extra codec, many Android phones and most websites' upload forms refuse it entirely.",
        ],
      },
      {
        heading: "Converting keeps the quality",
        paragraphs: [
          "Both formats are lossy, so re-encoding costs a sliver of quality, but DO101 deliberately converts at a high setting where the difference is invisible on screen. The JPG will be larger than the HEIC — that is the space HEIC was saving.",
        ],
      },
      {
        heading: "Avoiding HEIC in the first place",
        paragraphs: [
          "Settings › Camera › Formats › Most Compatible makes the camera shoot JPG, at the cost of larger files. Alternatively, Settings › Photos › Transfer to Mac or PC › Automatic converts photos to JPG when you copy them to a computer over a cable. Neither changes photos you have already taken — those still need converting.",
        ],
      },
      {
        heading: "Sending the converted photos",
        paragraphs: [
          "A converted iPhone photo is often 3 to 6 MB as a JPG. If a form or email will not take it, run it through the Image Compressor next, which can hit a target size in kilobytes. Your photo's date and location data may or may not survive conversion, so do not rely on the JPG to keep them.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I convert on the iPhone itself?",
        a: "Yes. Open the page in Safari, choose the photos from your library, and save the JPGs to Files.",
      },
      {
        q: "I need PNG, not JPG.",
        a: "Use HEIC to PNG. PNG files are larger but lossless.",
      },
      {
        q: "Are my photos uploaded?",
        a: "No. The decoder runs inside the page, so your camera roll stays on your device.",
      },
    ],
    related: ["compress-image-under-100kb", "merge-pdf-files-without-uploading", "compress-pdf-to-send-by-email"],
  },

  // ─── Writing and text ──────────────────────────────────────────────────
  {
    slug: "check-essay-grammar-free-without-uploading",
    tool: "grammar-checker",
    heading: "How to check an essay's grammar for free without uploading it",
    seoTitle: "Free Grammar Check for Essays — No Word Limit, No Upload | DO101",
    seoDescription:
      "Check an essay or report for spelling, grammar, punctuation and wordiness free, with no word limit and no account. Your writing never leaves your browser.",
    answer:
      "Paste the essay into the DO101 Grammar Checker. Spelling slips, punctuation errors, subject–verb disagreements, confusable words, wordy phrases and passive voice are underlined in place, each with an explanation, and the clear-cut mistakes fix in one click. There is no word limit and no account, and the checking runs in your browser, so your work is not uploaded.",
    steps: [
      "Open the Grammar Checker and paste your text.",
      "Work through the underlined issues. Each one explains what is wrong.",
      "Apply one-click fixes to the unambiguous errors, and decide the rest yourself.",
      "Use the filter chips to hide categories — passive voice, say — that do not apply to your writing.",
    ],
    sections: [
      {
        heading: "Why it matters that the essay stays on your device",
        paragraphs: [
          "Unpublished coursework, a thesis chapter or a job application is work you would rather not hand to a third-party server. Many checkers upload what you paste and keep it. This one is a rule engine that ships with the page, so there is nothing to send — you can confirm that in your browser's Network tab.",
        ],
      },
      {
        heading: "What it catches, and what it does not",
        paragraphs: [
          "It finds mistakes that follow recognisable patterns: misspellings, a/an errors, their/there and its/it's, double negatives, comma splices, doubled words and wordy phrases like \"in order to\". It is rule-based, so it catches less than tools built on trained language models, and it will occasionally flag something that is correct.",
          "No checker can tell whether your argument holds or whether you have used a real word in the wrong sense. Read your work aloud once as well.",
        ],
      },
      {
        heading: "After the grammar check",
        paragraphs: [
          "The Readability Checker tells you whether sentences run long for your audience, the Word Counter keeps you inside the limit, and the Citation Generator formats your references.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is there a word limit?",
        a: "No. Paste a whole dissertation chapter if you like.",
      },
      {
        q: "Can I switch off checks I do not need?",
        a: "Yes. Every flag can be ignored, and whole categories — passive voice, hedging, long sentences — can be hidden with the filter chips.",
      },
      {
        q: "Is it as good as Grammarly?",
        a: "It catches less, honestly. What it offers instead is unlimited free checking, an explanation for every flag, and text that never leaves your device.",
      },
    ],
    related: ["make-an-apa-citation", "remove-duplicates-from-a-list", "copy-text-from-a-scanned-pdf"],
  },
  {
    slug: "make-an-apa-citation",
    tool: "citation-generator",
    heading: "How to make an APA 7 citation for free",
    seoTitle: "Free APA 7 Citation Generator — Reference & In-Text | DO101",
    seoDescription:
      "Make an APA 7th edition reference and in-text citation for a journal article, book or website free, with italics that survive pasting into Word.",
    answer:
      "Open the DO101 Citation Generator, choose APA 7 and the type of source, and fill in the fields it asks for — authors, year, title, journal or publisher, DOI or URL. You get the reference-list entry and the in-text citation together. Copy it and the italics paste into Word or Google Docs intact. MLA, Harvard, Chicago, IEEE and Vancouver work the same way.",
    steps: [
      "Open the Citation Generator and pick APA 7.",
      "Choose the source type: journal article, book, website, and so on.",
      "Fill in the fields. Missing ones the style expects are flagged.",
      "Copy the reference and the in-text citation, or add it to your running reference list.",
    ],
    sections: [
      {
        heading: "What an APA 7 reference looks like",
        paragraphs: [
          "A journal article: Author, A. A., & Author, B. B. (Year). Title of the article in sentence case. Journal Name in Title Case, volume(issue), pages. https://doi.org/… — with the journal name and volume number in italics.",
          "In the text, one or two authors are cited by surname and year — (Smith & Lee, 2021) — and three or more by the first author and \"et al.\" — (Smith et al., 2021). In APA 7 that shortening applies from the first citation.",
        ],
      },
      {
        heading: "The details marks come off for",
        paragraphs: [
          "Sentence case for article titles but title case for journals. An ampersand before the last author, not \"and\". A DOI written as a full https://doi.org/ link. No \"Retrieved from\" for most web pages. The generator handles all of these, which is where hand-typed references usually slip.",
        ],
      },
      {
        heading: "Always check against your course guide",
        paragraphs: [
          "Corporate authors, missing dates, translated works and secondary citations all have special rules, and many departments have a house variation. Treat the output as a correct first draft and check it against your referencing guide.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the reference list saved?",
        a: "Yes, in your browser on this device, sorted the way APA expects. It is not sent anywhere and will not appear on another computer.",
      },
      {
        q: "Can it find the details from a DOI automatically?",
        a: "No — you fill in the fields. That keeps it working offline and means nothing about your research is sent anywhere.",
      },
    ],
    related: ["check-essay-grammar-free-without-uploading", "copy-text-from-a-scanned-pdf", "remove-duplicates-from-a-list"],
  },
  {
    slug: "remove-duplicates-from-a-list",
    tool: "remove-duplicate-lines",
    heading: "How to remove duplicates from a list online",
    seoTitle: "Remove Duplicates From a List Online Free — Keep the Order | DO101",
    seoDescription:
      "Paste a list of emails, names, keywords or IDs and remove every duplicate line instantly, keeping the original order. Case and spaces can be ignored.",
    answer:
      "Paste the list into DO101 Remove Duplicate Lines. Every repeated line disappears, the first occurrence is kept and the original order is preserved, and the tool tells you how many duplicates it removed. Turn on \"ignore surrounding spaces\" and turn off \"case sensitive\" to catch near-duplicates such as \"Anna@mail.com \" and \"anna@mail.com\".",
    steps: [
      "Open Remove Duplicate Lines and paste your list, one item per line.",
      "Choose whether capitals and surrounding spaces should count as differences.",
      "Copy the cleaned list.",
    ],
    sections: [
      {
        heading: "Why duplicates slip through",
        paragraphs: [
          "Lists copied from spreadsheets and emails pick up trailing spaces and inconsistent capitals, so two lines that look identical are not identical to a computer. That is the usual reason another tool \"missed\" a duplicate. Ignoring case and surrounding spaces fixes it.",
        ],
      },
      {
        heading: "Doing it in Excel or Google Sheets instead",
        paragraphs: [
          "Excel has Data › Remove Duplicates, and Google Sheets has Data › Data cleanup › Remove duplicates. Both work on whole rows, and both treat \"Anna\" and \"Anna \" as different. For a single column pasted from anywhere, pasting it here is faster, and the list never leaves your browser.",
        ],
      },
      {
        heading: "Common jobs it saves time on",
        paragraphs: [
          "Merging two email lists before a mail-out, so nobody gets the message twice. Cleaning a keyword list gathered from several research tools. Checking a column of order numbers, student IDs or SKUs pasted from two exports. Tidying a list of links or file names. In each case the useful number is the count of removed lines — if you expected ten repeats and it removed three hundred, something upstream was exported twice.",
        ],
      },
      {
        heading: "Before you paste",
        paragraphs: [
          "Put one item per line. If your list is comma-separated, use Find and Replace to turn each comma into a new line first. Blank lines count as items too — Remove Empty Lines clears them out.",
        ],
      },
    ],
    faqs: [
      {
        q: "Which copy is kept?",
        a: "The first one. Later repeats are removed, so the order stays as it was.",
      },
      {
        q: "How long can the list be?",
        a: "Tens of thousands of lines process instantly. The only ceiling is your browser's memory.",
      },
      {
        q: "Can I sort the list as well?",
        a: "Yes — paste the result into the Text Sorter.",
      },
    ],
    related: ["check-essay-grammar-free-without-uploading", "convert-pdf-table-to-excel", "make-a-wifi-qr-code"],
  },

  // ─── Everyday ──────────────────────────────────────────────────────────
  {
    slug: "make-a-wifi-qr-code",
    tool: "qr-generator",
    heading: "How to make a Wi-Fi QR code guests can scan",
    seoTitle: "Make a Wi-Fi QR Code Free — No Expiry, No Sign-Up | DO101",
    seoDescription:
      "Create a QR code that joins your Wi-Fi network when scanned. Free, never expires, downloads as PNG or SVG for printing, and made in your browser.",
    answer:
      "Open the DO101 QR Code Generator, choose Wi-Fi, and enter the network name, password and security type (almost always WPA/WPA2). Download the code as a PNG or SVG and print it. Guests point their phone camera at it and join without typing the password. The code contains the details directly, so it never expires.",
    steps: [
      "Open the QR Code Generator and pick the Wi-Fi option.",
      "Type the network name exactly as it appears, including capitals.",
      "Enter the password and choose the security type.",
      "Download as PNG for sharing or SVG for sharp printing.",
    ],
    sections: [
      {
        heading: "Will every phone scan it?",
        paragraphs: [
          "Yes, on anything recent. The iPhone camera app has read Wi-Fi codes since iOS 11, and Android phones read them from the camera or the Wi-Fi settings screen. If a scan joins nothing, the network name is usually mistyped — it is case-sensitive.",
        ],
      },
      {
        heading: "Why it never stops working",
        paragraphs: [
          "Many QR websites encode a short link to their own server, which redirects to your content — and can be switched off, or put behind a subscription, later. DO101 encodes your network details directly into the pattern, so there is no redirect and nothing to expire. If you change the Wi-Fi password, make a new code.",
        ],
      },
      {
        heading: "Before you print it",
        paragraphs: [
          "The code contains your password in plain text, so anyone who scans it can join, and can read the password. Put it where you would be happy telling people the password. For a café or rental, a separate guest network is the safer choice. Pick the high error-correction level if it will be printed small or laminated.",
        ],
      },
      {
        heading: "Where to put it",
        paragraphs: [
          "At eye level near where guests sit, printed at least 3 cm across so phones focus on it easily, with the network name written underneath for anyone whose camera will not scan. A small frame by the door or on the fridge works well at home.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does it work for hidden networks?",
        a: "Hidden networks are supported by the Wi-Fi QR format, but some phones join them less reliably. A visible network is the smoother experience for guests.",
      },
      {
        q: "Can I make QR codes for links too?",
        a: "Yes. The same generator makes codes for links, plain text, email addresses and phone numbers.",
      },
    ],
    related: ["remove-duplicates-from-a-list", "get-woken-up-before-your-train-stop", "compress-image-under-100kb"],
  },
  {
    slug: "get-woken-up-before-your-train-stop",
    tool: "station-alarm",
    heading: "How to get woken up before your train stop",
    seoTitle: "Station Alarm — Wake Up Before Your Train Stop, Free | DO101",
    seoDescription:
      "A free GPS alarm that vibrates and rings as your train nears your station, so you can sleep on the commute. Works in tunnels. No app to install.",
    answer:
      "Open the DO101 Station Alarm in your phone's browser, search for your destination station and press start. As you come within the radius you chose — 800 m suits a city train, 2–3 km a fast intercity — the phone rings, flashes a full-screen alert and, on Android, vibrates. It uses GPS, so it keeps working in tunnels. Keep the page open with the screen on.",
    steps: [
      "Open the Station Alarm on your phone and allow location access.",
      "Search for your destination and pick it.",
      "Choose a radius and press start.",
      "Leave the page open and the screen on, with the volume up.",
    ],
    sections: [
      {
        heading: "Why a timer alarm does not work on trains",
        paragraphs: [
          "Trains run late, sit outside stations and get held at signals. A 40-minute alarm either wakes you at the wrong stop or too late. A distance alarm goes off when you are actually close, however long the journey takes.",
        ],
      },
      {
        heading: "The one thing to know",
        paragraphs: [
          "Browsers pause pages that are in the background, so the phone must stay on this page with the screen on — no locking the phone or switching apps. The tool asks the browser to keep the screen awake and tells you if it refuses. Plug in if the journey is long.",
          "On an iPhone, Safari does not let web pages use the vibration motor, so the alarm uses sound and the full-screen alert instead. Turn the volume up, or use earphones.",
        ],
      },
      {
        heading: "Choosing the radius",
        paragraphs: [
          "GPS is accurate to 5–20 m in the open and much worse between tall buildings or underground. The tool shows the accuracy it is getting and warns when it is worse than 100 m. On a fast train, a bigger radius gives you about a minute to wake up and gather your things.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does it need mobile data?",
        a: "Only to search for the station. Once started, it runs on GPS alone — the map may not load in a tunnel, but the countdown and alarm keep going.",
      },
      {
        q: "Is my location sent anywhere?",
        a: "No. Your position is read by the page and never leaves the phone.",
      },
      {
        q: "Does it work on buses?",
        a: "Yes. Pick the stop's location and a smaller radius.",
      },
    ],
    related: ["make-a-wifi-qr-code", "calculate-emi-on-a-loan", "calculate-compound-interest-with-monthly-deposits"],
  },

  // ─── Money ─────────────────────────────────────────────────────────────
  {
    slug: "calculate-emi-on-a-loan",
    tool: "loan-emi",
    heading: "How to calculate the EMI on a home, car or personal loan",
    seoTitle: "How to Calculate Loan EMI — Formula, Example & Calculator | DO101",
    seoDescription:
      "Work out the monthly EMI on any loan from the amount, rate and term, see the total interest, and find how much an extra monthly payment saves.",
    answer:
      "EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1), where P is the loan amount, r the monthly interest rate (annual rate ÷ 12 ÷ 100) and n the number of months. A ₹5,00,000 loan at 9.5% for 20 years comes to about ₹4,661 a month. The DO101 Loan & EMI Calculator does this for you, with the full amortisation schedule.",
    steps: [
      "Open the Loan & EMI Calculator.",
      "Enter the loan amount, the annual interest rate and the term in years or months.",
      "Read the EMI, the total interest and the total repaid.",
      "Add an extra monthly payment to see how much sooner the loan ends and how much interest that saves.",
    ],
    sections: [
      {
        heading: "Working through the example",
        paragraphs: [
          "For ₹5,00,000 at 9.5% a year over 20 years: the monthly rate r is 9.5 ÷ 12 ÷ 100 = 0.0079167, and n is 240 months. (1 + r)^240 comes to about 6.635. So EMI = 5,00,000 × 0.0079167 × 6.635 ÷ 5.635 ≈ ₹4,661.",
          "Over 240 payments that is about ₹11,18,600 repaid — more than ₹6,18,000 of it interest, which is more than the amount borrowed. That is why the term matters as much as the rate.",
        ],
      },
      {
        heading: "Why early payments are mostly interest",
        paragraphs: [
          "Interest is charged on what you still owe. In the first year you owe nearly everything, so most of each EMI covers interest; by the final years most of it repays principal. The amortisation schedule shows that shift year by year, or month by month.",
        ],
      },
      {
        heading: "The fastest way to pay less interest",
        paragraphs: [
          "An extra payment each month goes straight to principal and stops interest being charged on that money for the rest of the loan. Even a small top-up can take years off a long home loan — the calculator shows exactly how many months and how much interest. Check whether your lender charges a prepayment fee first.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does the EMI include processing fees or insurance?",
        a: "No. Those vary by lender and are not part of the EMI formula. Add them separately when comparing offers.",
      },
      {
        q: "What about floating-rate loans?",
        a: "The calculation assumes one fixed rate. When your rate changes, run it again with the new rate, the outstanding balance and the remaining term.",
      },
    ],
    related: ["calculate-compound-interest-with-monthly-deposits", "calculate-lot-size-for-gold-trading", "get-woken-up-before-your-train-stop"],
  },
  {
    slug: "calculate-compound-interest-with-monthly-deposits",
    tool: "compound-interest",
    heading: "How to calculate compound interest with monthly deposits",
    seoTitle: "Compound Interest With Monthly Deposits — Formula & Calculator | DO101",
    seoDescription:
      "Work out what regular monthly savings grow to with compound interest, the split between deposits and interest, and the result in today's money.",
    answer:
      "Saving 200 a month at 7% a year, compounded monthly, grows to about 104,000 after 20 years — 48,000 of it your deposits and about 56,000 interest. To work out your own figures, enter the starting amount, monthly deposit, rate, compounding frequency and years into the DO101 Compound Interest Calculator; it shows the growth year by year.",
    steps: [
      "Open the Compound Interest Calculator.",
      "Enter the starting balance, the monthly deposit, the annual rate and the number of years.",
      "Choose how often interest compounds, and whether deposits land at the start or end of the month.",
      "Optionally add an inflation rate to see the result in today's money.",
    ],
    sections: [
      {
        heading: "The formula",
        paragraphs: [
          "With no deposits, the balance after t years is A = P(1 + r/n)^(nt), where P is the starting amount, r the annual rate as a decimal and n the number of compounding periods a year. Regular deposits add the future value of a series of payments on top: with monthly compounding, D × ((1 + r/12)^(12t) − 1) ÷ (r/12) for a deposit D at the end of each month.",
          "That shortcut only works when deposits and compounding happen at the same frequency. When they differ — monthly deposits into an account that compounds quarterly — the calculator works month by month at the equivalent monthly rate, which gives the right answer either way.",
        ],
      },
      {
        heading: "What makes the biggest difference",
        paragraphs: [
          "Time, then rate. Compounding frequency matters far less than people expect: 6% compounded monthly is about 6.17% a year, and daily only nudges that to about 6.18%. At 7%, money roughly doubles every ten years, so the last decade of a 30-year plan adds more than the first two.",
        ],
      },
      {
        heading: "What it does not tell you",
        paragraphs: [
          "It assumes one fixed rate and ignores tax and fees. That is exact for a fixed deposit or savings account. Money invested in markets goes up and down, so for investments treat the result as an illustration, not a forecast.",
        ],
      },
    ],
    faqs: [
      {
        q: "What does 'in today's money' mean?",
        a: "Prices rise over time, so a future amount buys less. With an inflation rate entered, the calculator divides the final balance by the rise in prices to show what it would buy today.",
      },
      {
        q: "Start or end of the month — does it matter?",
        a: "A little. Deposits at the start earn one more month of interest each, so the total comes out slightly higher.",
      },
    ],
    related: ["calculate-emi-on-a-loan", "calculate-lot-size-for-gold-trading", "get-woken-up-before-your-train-stop"],
  },
  {
    slug: "calculate-lot-size-for-gold-trading",
    tool: "position-size",
    heading: "How to calculate lot size for gold (XAU/USD)",
    seoTitle: "How to Calculate Lot Size for Gold (XAU/USD) — Free | DO101",
    seoDescription:
      "Work out the right lot size for a gold or forex trade from your account balance, risk percentage and stop-loss, with the formula and a worked example.",
    answer:
      "Lot size = money at risk ÷ (stop distance in pips × pip value per lot). On XAU/USD a pip is usually $0.01 and a standard lot is 100 oz, so one pip is $1 per lot. Risking 1% of $10,000 ($100) with a $5 (500-pip) stop: 100 ÷ (500 × 1) = 0.20 lots. The DO101 Position Size Calculator does this for gold and forex pairs.",
    steps: [
      "Open the Position Size Calculator and pick XAU/USD or your pair.",
      "Enter your account balance, account currency and the percentage you are willing to risk.",
      "Enter the stop-loss, in pips or as a price.",
      "Read the lot size, rounded down to 0.01 so the real risk stays under your limit.",
    ],
    sections: [
      {
        heading: "Why size from the stop, not from a feeling",
        paragraphs: [
          "Most blown accounts come from positions that were too big for where the stop was. Fixing the loss you accept first — often 0.5% to 2% of the account per trade — and working back to the size means a wider stop automatically gets a smaller position, and no single trade can do serious damage.",
        ],
      },
      {
        heading: "Check your broker's contract size",
        paragraphs: [
          "100 oz per standard lot and a $0.01 pip are the common retail values, but brokers differ, and some quote gold to a different number of decimals. Check the contract specification in your trading platform before relying on any calculator's numbers.",
        ],
      },
      {
        heading: "What about leverage?",
        paragraphs: [
          "Leverage does not change what your stop costs — the lot size does. It only caps how large a position you are allowed to open. The calculator warns you when leverage, rather than your risk limit, is what limits the size, and it never suggests a leverage level.",
        ],
      },
    ],
    faqs: [
      {
        q: "What if my account is not in dollars?",
        a: "Pick your account currency and the pip value is converted at the ECB reference rate, or at your broker's rate if you type it in.",
      },
      {
        q: "Is this trading advice?",
        a: "No. It is arithmetic on the numbers you enter. It does not suggest trades or know your circumstances.",
      },
    ],
    related: ["calculate-emi-on-a-loan", "calculate-compound-interest-with-monthly-deposits", "make-a-work-breakdown-structure-in-excel"],
  },

  // ─── Projects ──────────────────────────────────────────────────────────
  {
    slug: "make-a-work-breakdown-structure-in-excel",
    tool: "wbs",
    heading: "How to make a work breakdown structure (WBS) in Excel",
    seoTitle: "How to Make a Work Breakdown Structure in Excel — Free Tool | DO101",
    seoDescription:
      "Build a numbered WBS with owners, dates, durations and a Gantt timeline, then download it as a finished Excel file. Free, no account, no upload.",
    answer:
      "Build the breakdown in the DO101 WBS Builder, which works like a spreadsheet: one row per task, indented under its parent, with WBS numbers (1, 1.1, 1.1.1) that renumber themselves as you move things. Add owners, start and due dates and % complete, check the Gantt timeline, then download a real .xlsx with frozen headings, coloured timeline bars and live SUM formulas on the summary rows.",
    steps: [
      "Open the WBS Builder and type the project's major deliverables or phases as top-level rows.",
      "Add the work under each one and indent it, until every lowest row is a task one person or team can own.",
      "Fill in owners, start and due dates. Durations and summary-row dates work themselves out.",
      "Check the Gantt timeline, then download the Excel workbook.",
    ],
    sections: [
      {
        heading: "What a WBS is for",
        paragraphs: [
          "A work breakdown structure splits the whole of a project into smaller pieces, level by level, until each piece is small enough to estimate and assign. The top levels are deliverables or phases; the bottom level holds the work packages people actually do. The rule that makes it useful: everything the project delivers appears somewhere in it, and nothing out of scope does.",
        ],
      },
      {
        heading: "How deep to go",
        paragraphs: [
          "Far enough that each work package can be estimated, owned and tracked, and no further. A common rule of thumb is that a work package should take between eight and eighty hours. Three or four levels covers most projects; beyond that you are usually breaking down the schedule rather than the scope.",
        ],
      },
      {
        heading: "Why not just type it into Excel?",
        paragraphs: [
          "You can, but keeping 1.2.3-style numbers correct by hand after every insertion is where Excel WBS sheets go wrong, and so do summary rows that no longer add up. The builder does the numbering and roll-ups, then hands Excel a finished workbook: dates, durations and percentages as real Excel values, conditional-format timeline bars, and a landscape page set up to print. It can also open an existing WBS spreadsheet and read its hierarchy back in.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the download a real Excel file?",
        a: "Yes, a genuine .xlsx, not a renamed CSV. Summary rows can carry live =SUM(), =MIN() and =MAX() formulas, so totals recalculate when you edit a task in Excel.",
      },
      {
        q: "Where is my WBS saved?",
        a: "In this browser on this device. There is no account, so export a project file if you want a backup.",
      },
      {
        q: "Can I draw it as a tree diagram instead?",
        a: "Yes. The Chart view lays the same WBS out as a tree you can rearrange, and exports it as PNG or SVG.",
      },
    ],
    related: ["calculate-lot-size-for-gold-trading", "convert-pdf-table-to-excel", "remove-duplicates-from-a-list"],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** The guides that hand readers to a given tool, for linking back from its page. */
export function guidesForTool(toolId: string): Guide[] {
  return GUIDES.filter((g) => g.tool === toolId);
}

export const guidePath = (guide: Guide) => `/how-to/${guide.slug}`;
