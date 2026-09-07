"use client";

import type { TextToolConfig } from "../text-tool-config";
import { xmlToJson } from "@/lib/data/xml-parse";

/** Needs the browser's DOMParser, so it lives apart from the isomorphic configs. */
export const xmlToJsonConfig: TextToolConfig = {
  id: "xml-to-json",
  inputLabel: "XML",
  outputLabel: "JSON",
  placeholder: "<root><item>value</item></root>",
  sample: `<?xml version="1.0"?>
<catalog>
  <book id="1">
    <title>Deep Work</title>
    <price currency="GBP">12.99</price>
  </book>
  <book id="2">
    <title>Atomic Habits</title>
    <price currency="GBP">10.50</price>
  </book>
</catalog>`,
  monoInput: true,
  monoOutput: true,
  options: [
    {
      id: "attributes",
      label: "Keep attributes",
      description: "Attributes appear as keys prefixed with @.",
      type: "toggle",
      default: true,
    },
    {
      id: "compact",
      label: "Compact leaf nodes",
      description: "An element with only text becomes a plain string.",
      type: "toggle",
      default: true,
    },
  ],
  transform: (input, options) => {
    const result = xmlToJson(input, {
      attributes: Boolean(options.attributes),
      compact: Boolean(options.compact),
    });
    if (result.error) return { output: "", error: result.error };
    return { output: JSON.stringify(result.json, null, 2), extension: "json" };
  },
};
