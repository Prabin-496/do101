"use client";

import { PdfError } from "./engine";

/**
 * Password protection and removal.
 *
 * pdf-lib itself has no encryption support, so these two tools use
 * @cantoo/pdf-lib — a maintained MIT fork that adds it — loaded lazily so the
 * second parser only downloads on these two pages.
 *
 * Two behaviours were verified before this shipped, because getting either
 * wrong would hand someone a corrupted or falsely-protected document:
 *
 * 1. `PDFDocument.load(bytes, { ignoreEncryption: true })` does NOT decrypt the
 *    content streams. It only skips the check, so copying the pages afterwards
 *    produces a file whose text is unreadable garbage. Every path here loads
 *    with an explicit password instead — `""` for the empty user password that
 *    restriction-only documents use.
 * 2. A wrong password is rejected by the library rather than silently producing
 *    an empty document, so "unlocked" never means "quietly broken".
 */

type CantooLib = typeof import("@cantoo/pdf-lib");

let cached: CantooLib | null = null;

async function lib(): Promise<CantooLib> {
  if (!cached) cached = await import("@cantoo/pdf-lib");
  return cached;
}

export interface ProtectOptions {
  userPassword: string;
  ownerPassword?: string;
  allowPrinting: boolean;
  allowCopying: boolean;
  allowModifying: boolean;
  allowAnnotating: boolean;
}

export async function protectPdf(
  bytes: ArrayBuffer,
  options: ProtectOptions,
): Promise<Uint8Array> {
  if (!options.userPassword) {
    throw new PdfError("Choose a password before protecting the document.");
  }

  const { PDFDocument } = await lib();

  let doc;
  try {
    doc = await PDFDocument.load(bytes, { password: "" });
  } catch {
    throw new PdfError(
      "This PDF could not be opened. If it is already password-protected, remove that password first with the Unlock tool.",
    );
  }

  doc.encrypt({
    userPassword: options.userPassword,
    // Without a separate owner password the user password governs everything.
    ownerPassword: options.ownerPassword || options.userPassword,
    permissions: {
      printing: options.allowPrinting ? "highResolution" : undefined,
      copying: options.allowCopying,
      modifying: options.allowModifying,
      annotating: options.allowAnnotating,
    },
  });

  const saved = await doc.save();
  // Fail loudly rather than handing back a file that only looks protected.
  if (!containsEncryptDictionary(saved)) {
    throw new PdfError("Encryption did not apply to this document. Your original is unchanged.");
  }
  return saved;
}

export interface UnlockResult {
  bytes: Uint8Array;
  /** True when a password had to be supplied, false for restrictions-only files. */
  neededPassword: boolean;
}

/**
 * Removes encryption by decrypting and copying the pages into a fresh document.
 * `password` is only needed for files that ask for one when opening.
 */
export async function unlockPdf(bytes: ArrayBuffer, password = ""): Promise<UnlockResult> {
  const { PDFDocument } = await lib();

  let source;
  try {
    source = await PDFDocument.load(bytes, { password });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/password/i.test(message)) {
      throw new PdfError(
        password
          ? "That password was not accepted. Check it and try again."
          : "This PDF needs a password to open. Type the password you use to open it.",
      );
    }
    throw new PdfError("This PDF could not be opened. It may be corrupted.");
  }

  const out = await PDFDocument.create();
  const pages = await out.copyPages(source, source.getPageIndices());
  pages.forEach((page) => out.addPage(page));

  if (out.getPageCount() === 0) {
    throw new PdfError("No pages could be recovered from this document.");
  }

  const saved = await out.save();
  if (containsEncryptDictionary(saved)) {
    throw new PdfError("The encryption could not be removed from this document.");
  }

  return { bytes: saved, neededPassword: password.length > 0 };
}

/** Detects whether the saved bytes still carry an /Encrypt dictionary. */
function containsEncryptDictionary(bytes: Uint8Array): boolean {
  const marker = "/Encrypt";
  const haystack = new TextDecoder("latin1").decode(bytes);
  return haystack.includes(marker);
}

/** Reports whether a document opens without a password, for the UI to explain. */
export async function inspectProtection(
  bytes: ArrayBuffer,
): Promise<{ opensWithoutPassword: boolean; encrypted: boolean }> {
  const { PDFDocument } = await lib();
  const encrypted = containsEncryptDictionary(new Uint8Array(bytes));

  try {
    await PDFDocument.load(bytes, { password: "" });
    return { opensWithoutPassword: true, encrypted };
  } catch {
    return { opensWithoutPassword: false, encrypted: true };
  }
}
