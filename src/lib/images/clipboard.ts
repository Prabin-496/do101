"use client";

/**
 * Putting a picture on the clipboard so it can be pasted into Word, Excel,
 * Google Docs, Slides, email or a chat window.
 *
 * Office applications take a bitmap from the system clipboard and paste it as
 * a picture, so a PNG is the format that works everywhere. Getting it there
 * reliably is the fiddly part, and there are three routes because no single
 * one works in every browser:
 *
 *  1. `ClipboardItem` holding a *promise* for the bytes. Safari requires the
 *     item to be constructed during the click that triggered it, so awaiting
 *     the PNG first and writing afterwards throws "not allowed" there.
 *  2. The same call with an already-resolved Blob, for browsers whose
 *     `ClipboardItem` does not accept a promise.
 *  3. A hidden editable element holding an <img>, copied with the deprecated
 *     `execCommand`. It is the only route that works where the async clipboard
 *     API is unavailable, and it is exactly what Word and Excel expect.
 */

export type CopyMethod = "clipboard-item" | "clipboard-item-blob" | "html-fallback";

export class ClipboardUnavailableError extends Error {}

/** Escapes a value for an HTML attribute; the data URL is generated, not typed, but this is markup. */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * The snippet handed to the fallback route.
 *
 * Word and Excel size a pasted picture from the width and height attributes,
 * so they are set from the real pixel size rather than left for the
 * application to guess.
 */
export function imageHtml(dataUrl: string, width?: number, height?: number): string {
  const size =
    width && height ? ` width="${Math.round(width)}" height="${Math.round(height)}"` : "";
  return `<img src="${escapeAttribute(dataUrl)}"${size} alt="Diagram" />`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("The picture could not be read."));
    reader.readAsDataURL(blob);
  });
}

function imageSize(dataUrl: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ w: image.naturalWidth, h: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

/**
 * Selects a hidden <img> and copies it.
 *
 * `execCommand` is deprecated, but it remains the only way to put rich
 * clipboard content on the clipboard in browsers without `ClipboardItem`, and
 * it is what makes the paste land in Word as a picture rather than as text.
 */
function copyViaHiddenElement(html: string): boolean {
  const holder = document.createElement("div");
  holder.contentEditable = "true";
  holder.setAttribute("aria-hidden", "true");
  // Kept on screen but out of view: an element with `display: none` has no
  // selectable range, and the copy silently does nothing.
  holder.style.cssText =
    "position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
  holder.innerHTML = html;
  document.body.appendChild(holder);

  const selection = window.getSelection();
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  let copied = false;
  try {
    const range = document.createRange();
    range.selectNodeContents(holder);
    selection?.removeAllRanges();
    selection?.addRange(range);
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    selection?.removeAllRanges();
    // Whatever the visitor had selected before is put back.
    if (previous) selection?.addRange(previous);
    holder.remove();
  }
  return copied;
}

export interface CopyImageResult {
  method: CopyMethod;
}

/**
 * Copies a rendered picture, given a function that produces it.
 *
 * The renderer is called once and its promise is reused, so a large board is
 * never rasterised twice while the routes are tried in turn.
 */
export async function copyImageToClipboard(
  render: () => Promise<Blob>,
): Promise<CopyImageResult> {
  const pending = render();
  // A rejected render must not surface as "your browser cannot copy".
  pending.catch(() => {});

  if (typeof navigator !== "undefined" && navigator.clipboard && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pending })]);
      return { method: "clipboard-item" };
    } catch {
      try {
        const blob = await pending;
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        return { method: "clipboard-item-blob" };
      } catch {
        // Falls through to the hidden-element route below.
      }
    }
  }

  const blob = await pending;
  const dataUrl = await blobToDataUrl(blob);
  const size = await imageSize(dataUrl);
  if (copyViaHiddenElement(imageHtml(dataUrl, size?.w, size?.h))) {
    return { method: "html-fallback" };
  }

  throw new ClipboardUnavailableError(
    "This browser would not let the page copy a picture. Download the PNG instead, then insert it in Word or Excel.",
  );
}
