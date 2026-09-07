/**
 * XML helpers.
 *
 * Formatting and JSON→XML are pure string work so they can be unit tested.
 * XML→JSON uses the browser's own DOMParser, which is both faster and safer
 * than hand-rolling a parser — the document is inert and never enters the page.
 */

export interface XmlFormatOptions {
  indent?: number;
  collapseEmpty?: boolean;
}

/** Re-indents XML without needing a full parse. */
export function formatXml(xml: string, { indent = 2 }: XmlFormatOptions = {}): string {
  const pad = " ".repeat(indent);
  const normalised = xml
    .replace(/\r\n?/g, "\n")
    .replace(/>\s*</g, "><")
    .trim();

  const tokens = normalised.match(/<[^>]+>|[^<]+/g) ?? [];
  let depth = 0;
  const lines: string[] = [];

  for (const token of tokens) {
    const text = token.trim();
    if (!text) continue;

    const isClosing = /^<\//.test(text);
    const isSelfClosing = /\/>$/.test(text) || /^<\?/.test(text) || /^<!/.test(text);
    const isOpening = /^<[^/!?]/.test(text) && !isSelfClosing;

    if (isClosing) depth = Math.max(0, depth - 1);
    lines.push(pad.repeat(depth) + text);
    if (isOpening) depth++;
  }

  return lines.join("\n");
}

export function minifyXml(xml: string): string {
  return xml.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
}

const ESCAPES: Array<[RegExp, string]> = [
  [/&/g, "&amp;"],
  [/</g, "&lt;"],
  [/>/g, "&gt;"],
  [/"/g, "&quot;"],
];

function escapeXml(value: string): string {
  return ESCAPES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

/** XML element names cannot start with a digit or contain most punctuation. */
function safeTag(name: string): string {
  const cleaned = name.replace(/[^\w.-]/g, "_");
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

export function jsonToXml(
  value: unknown,
  { rootName = "root", indent = 2, itemName = "item" }: { rootName?: string; indent?: number; itemName?: string } = {},
): string {
  const pad = " ".repeat(indent);

  const build = (node: unknown, name: string, depth: number): string[] => {
    const prefix = pad.repeat(depth);
    const tag = safeTag(name);

    if (node === null || node === undefined) return [`${prefix}<${tag}/>`];

    if (Array.isArray(node)) {
      const lines = [`${prefix}<${tag}>`];
      node.forEach((child) => lines.push(...build(child, itemName, depth + 1)));
      lines.push(`${prefix}</${tag}>`);
      return lines;
    }

    if (typeof node === "object") {
      const entries = Object.entries(node as Record<string, unknown>);
      if (!entries.length) return [`${prefix}<${tag}/>`];
      const lines = [`${prefix}<${tag}>`];
      entries.forEach(([key, child]) => lines.push(...build(child, key, depth + 1)));
      lines.push(`${prefix}</${tag}>`);
      return lines;
    }

    return [`${prefix}<${tag}>${escapeXml(String(node))}</${tag}>`];
  };

  return ['<?xml version="1.0" encoding="UTF-8"?>', ...build(value, rootName, 0)].join("\n");
}
