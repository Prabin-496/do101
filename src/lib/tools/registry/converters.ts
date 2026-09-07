import type { Tool } from "../types";

/**
 * File and data format converters. Documents, spreadsheets and structured
 * data, all converted inside the visitor's browser.
 */
export const CONVERTERS_TOOLS: Tool[] = [
  {
    id: "csv-to-json",
    name: "CSV to JSON",
    short: "Turn a spreadsheet export into JSON.",
    long: "Converts CSV into JSON, detecting the delimiter automatically, honouring quoted fields with embedded commas and newlines, and optionally converting numbers and booleans to real types.",
    category: "converter",
    route: "/tools/csv-to-json",
    keywords: ["csv to json", "convert csv to json", "csv json converter", "spreadsheet to json", "excel csv to json"],
    aliases: ["convert csv file to json", "csv json"],
    icon: "📊",
    accent: "sky",
    browserOnly: true,
    aiInvocable: true,
    input: "text",
    output: "text",
    related: ["json-to-csv", "json-formatter", "xml-to-json", "yaml-to-json"],
    seoTitle: "CSV to JSON Converter — Free Online Tool | DO101",
    seoDescription: "Convert CSV to JSON with automatic delimiter detection, proper quoted-field handling and optional type conversion. Free and browser-based.",
    steps: [
      "Paste your CSV, or export one from your spreadsheet.",
      "Confirm the header row and delimiter.",
      "Copy or download the JSON.",
    ],
    features: [
      "Detects comma, semicolon, tab and pipe delimiters",
      "Handles quoted fields containing commas and newlines",
      "Optional number and boolean conversion",
      "Header row produces objects; no header produces arrays",
      "Runs in your browser",
    ],
    faqs: [
      {
        q: "How are quoted fields handled?",
        a: "Properly. A field wrapped in quotes may contain commas, newlines and escaped quotes, and all of it is preserved — which is where naive split-on-comma converters go wrong.",
      },
      {
        q: "Why is my ID column turning into a number?",
        a: "Type conversion turns numeric-looking values into numbers, which can drop leading zeros. Switch off \"convert numbers and booleans\" to keep everything as strings.",
      },
      {
        q: "Is my spreadsheet uploaded?",
        a: "No. Conversion happens on your device, which matters when the file contains customer data.",
      },
    ],
  },
  {
    id: "json-to-csv",
    name: "JSON to CSV",
    short: "Flatten a JSON array into a spreadsheet-ready CSV.",
    long: "Turns an array of JSON objects into CSV, building the header from the union of every object's keys so records with missing fields still line up. Values containing commas or quotes are escaped correctly.",
    category: "converter",
    route: "/tools/json-to-csv",
    keywords: ["json to csv", "convert json to csv", "json to excel", "json csv converter", "api response to spreadsheet"],
    aliases: ["json to spreadsheet", "export json as csv"],
    icon: "📈",
    accent: "sky",
    browserOnly: true,
    aiInvocable: true,
    input: "text",
    output: "text",
    related: ["csv-to-json", "json-formatter", "json-to-yaml", "json-minifier"],
    seoTitle: "JSON to CSV Converter — Free Online Tool | DO101",
    seoDescription: "Convert a JSON array into CSV ready for Excel or Google Sheets, with correct escaping and a header built from every key. Free and private.",
    steps: [
      "Paste a JSON array.",
      "Choose the delimiter and whether to include a header.",
      "Copy or download the CSV.",
    ],
    features: [
      "Header built from the union of all keys",
      "Correct quoting for commas, quotes and newlines",
      "Nested objects serialised as JSON in the cell",
      "Comma, semicolon, tab or pipe output",
      "Runs in your browser",
    ],
    faqs: [
      {
        q: "What happens to nested objects?",
        a: "CSV is flat, so a nested object or array is written into the cell as JSON text. Flatten the structure first if you need separate columns.",
      },
      {
        q: "Why do some rows have empty cells?",
        a: "The header is the union of every object's keys, so a record missing a field gets an empty cell rather than a shifted row.",
      },
      {
        q: "Will Excel open it correctly?",
        a: "Yes. If your locale uses semicolons as the list separator, choose semicolon as the delimiter and Excel will split the columns properly.",
      },
    ],
  },
];
