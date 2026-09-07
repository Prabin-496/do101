"use client";

/**
 * XML → JSON using the browser's DOMParser.
 * The parsed document is never attached to the page, so nothing in the XML
 * can execute or reach the DOM.
 */
export interface XmlToJsonResult {
  json: unknown;
  error?: string;
}

export function xmlToJson(
  xml: string,
  { attributes = true, compact = true }: { attributes?: boolean; compact?: boolean } = {},
): XmlToJsonResult {
  if (!xml.trim()) return { json: null, error: "Paste some XML to convert." };

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const failure = doc.querySelector("parsererror");
  if (failure) {
    return {
      json: null,
      error: `This is not well-formed XML. ${failure.textContent?.split("\n")[1]?.trim() ?? ""}`.trim(),
    };
  }

  const convert = (node: Element): unknown => {
    const result: Record<string, unknown> = {};

    if (attributes) {
      for (const attribute of Array.from(node.attributes)) {
        result[`@${attribute.name}`] = attribute.value;
      }
    }

    const children = Array.from(node.children);
    if (!children.length) {
      const text = node.textContent?.trim() ?? "";
      if (!Object.keys(result).length) return compact ? text : { "#text": text };
      if (text) result["#text"] = text;
      return result;
    }

    for (const child of children) {
      const key = child.nodeName;
      const value = convert(child);
      if (key in result) {
        const existing = result[key];
        result[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  const root = doc.documentElement;
  return { json: { [root.nodeName]: convert(root) } };
}
