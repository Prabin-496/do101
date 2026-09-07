import type { TextToolConfig } from "../text-tool-config";
import { parseJson, minifyJson } from "@/lib/dev/json";
import { csvToJson, jsonToCsv, detectDelimiter } from "@/lib/data/csv";
import { formatXml, minifyXml, jsonToXml } from "@/lib/data/xml";
import { formatCss, minifyCss, minifyHtml, formatSql, minifySql } from "@/lib/code/minify";
import { load as loadYaml, dump as dumpYaml } from "js-yaml";

const SAMPLE_JSON = `{"site":"DO101","tools":[{"id":"pdf-merge","free":true},{"id":"json-formatter","free":true}],"launched":2026}`;
const SAMPLE_CSV = `name,role,city\nAda,Engineer,London\n"Grace, M.",Admiral,New York\nAlan,Researcher,Manchester`;
const SAMPLE_XML = `<?xml version="1.0"?><catalog><book id="1"><title>Deep Work</title><price>12.99</price></book><book id="2"><title>Atomic Habits</title><price>10.50</price></book></catalog>`;
const SAMPLE_YAML = `site: DO101\nfree: true\ntools:\n  - pdf-merge\n  - json-formatter\nlaunched: 2026`;

const jsonError = (message: string) => ({ output: "", error: message });

export const jsonMinifierConfig: TextToolConfig = {
  id: "json-minifier",
  inputLabel: "Formatted JSON",
  outputLabel: "Minified JSON",
  placeholder: '{\n  "a": 1\n}',
  sample: `{\n  "site": "DO101",\n  "free": true,\n  "tools": [\n    "pdf-merge",\n    "json-formatter"\n  ]\n}`,
  monoInput: true,
  monoOutput: true,
  transform: (input) => {
    const result = minifyJson(input);
    if (!result.ok) return jsonError(`Invalid JSON: ${result.error.message}`);
    const saved = input.length - (result.output?.length ?? 0);
    return {
      output: result.output ?? "",
      extension: "json",
      stats: [
        { label: "Before", value: `${input.length.toLocaleString()} chars` },
        { label: "After", value: `${(result.output?.length ?? 0).toLocaleString()} chars` },
        {
          label: "Saved",
          value: `${Math.max(0, saved).toLocaleString()} (${input.length ? Math.round((saved / input.length) * 100) : 0}%)`,
        },
      ],
    };
  },
};

export const jsonEscapeConfig: TextToolConfig = {
  id: "json-escape",
  inputLabel: "Raw text or JSON",
  outputLabel: "Result",
  placeholder: 'He said "hello"\nand left.',
  sample: 'He said "hello"\nand left.\tTab here \\ backslash',
  monoOutput: true,
  options: [
    {
      id: "mode",
      label: "Direction",
      type: "select",
      default: "escape",
      choices: [
        { value: "escape", label: "Escape — make it safe inside a JSON string" },
        { value: "unescape", label: "Unescape — turn a JSON string back into text" },
      ],
    },
    {
      id: "quotes",
      label: "Wrap in quotes",
      description: "Produces a complete JSON string literal.",
      type: "toggle",
      default: false,
      showWhen: { id: "mode", equals: "escape" },
    },
  ],
  transform: (input, options) => {
    if (options.mode === "escape") {
      const escaped = JSON.stringify(input);
      return { output: options.quotes ? escaped : escaped.slice(1, -1) };
    }
    try {
      const wrapped = input.trim().startsWith('"') ? input.trim() : `"${input.replace(/\n/g, "\\n")}"`;
      return { output: String(JSON.parse(wrapped)) };
    } catch {
      return jsonError("That is not a valid escaped JSON string — check the backslashes.");
    }
  },
};

export const csvToJsonConfig: TextToolConfig = {
  id: "csv-to-json",
  inputLabel: "CSV",
  outputLabel: "JSON",
  placeholder: "name,age\nAda,36",
  sample: SAMPLE_CSV,
  monoInput: true,
  monoOutput: true,
  options: [
    {
      id: "header",
      label: "First row is a header",
      description: "On gives an array of objects; off gives an array of arrays.",
      type: "toggle",
      default: true,
    },
    {
      id: "typed",
      label: "Convert numbers and booleans",
      description: "Turns \"42\" into 42 and \"true\" into true.",
      type: "toggle",
      default: true,
    },
    {
      id: "delimiter",
      label: "Delimiter",
      type: "select",
      default: "auto",
      choices: [
        { value: "auto", label: "Detect automatically" },
        { value: ",", label: "Comma" },
        { value: ";", label: "Semicolon" },
        { value: "\t", label: "Tab" },
        { value: "|", label: "Pipe" },
      ],
    },
  ],
  transform: (input, options) => {
    const delimiter = options.delimiter === "auto" ? undefined : String(options.delimiter);
    const result = csvToJson(input, {
      header: Boolean(options.header),
      typed: Boolean(options.typed),
      delimiter,
    });
    if (result.error) return jsonError(result.error);
    return {
      output: JSON.stringify(result.json, null, 2),
      extension: "json",
      stats: [
        { label: "Rows", value: String(result.rows) },
        { label: "Columns", value: String(result.columns) },
        { label: "Delimiter", value: delimiter === "\t" ? "tab" : (delimiter ?? detectDelimiter(input)) === "\t" ? "tab (detected)" : `${delimiter ?? detectDelimiter(input)}${delimiter ? "" : " (detected)"}` },
      ],
    };
  },
};

export const jsonToCsvConfig: TextToolConfig = {
  id: "json-to-csv",
  inputLabel: "JSON array",
  outputLabel: "CSV",
  placeholder: '[{"name":"Ada","age":36}]',
  sample: `[\n  { "name": "Ada", "role": "Engineer", "city": "London" },\n  { "name": "Grace", "role": "Admiral", "city": "New York" },\n  { "name": "Alan", "role": "Researcher" }\n]`,
  monoInput: true,
  monoOutput: true,
  options: [
    { id: "header", label: "Include a header row", type: "toggle", default: true },
    {
      id: "delimiter",
      label: "Delimiter",
      type: "select",
      default: ",",
      choices: [
        { value: ",", label: "Comma" },
        { value: ";", label: "Semicolon" },
        { value: "\t", label: "Tab" },
        { value: "|", label: "Pipe" },
      ],
    },
  ],
  transform: (input, options) => {
    const parsed = parseJson(input);
    if (!parsed.ok) return jsonError(`Invalid JSON: ${parsed.error.message}`);
    const result = jsonToCsv(parsed.value, {
      delimiter: String(options.delimiter),
      header: Boolean(options.header),
    });
    if (result.error) return jsonError(result.error);
    const rows = result.csv ? result.csv.split("\n").length : 0;
    return {
      output: result.csv,
      extension: "csv",
      stats: [{ label: "Rows", value: String(rows) }],
    };
  },
};

export const xmlFormatterConfig: TextToolConfig = {
  id: "xml-formatter",
  inputLabel: "XML",
  outputLabel: "Formatted XML",
  placeholder: "<root><child>value</child></root>",
  sample: SAMPLE_XML,
  monoInput: true,
  monoOutput: true,
  options: [
    {
      id: "mode",
      label: "Action",
      type: "select",
      default: "format",
      choices: [
        { value: "format", label: "Beautify" },
        { value: "minify", label: "Minify" },
      ],
    },
    {
      id: "indent",
      label: "Indent size",
      type: "select",
      default: "2",
      choices: [
        { value: "2", label: "2 spaces" },
        { value: "4", label: "4 spaces" },
      ],
      showWhen: { id: "mode", equals: "format" },
    },
  ],
  transform: (input, options) => ({
    output:
      options.mode === "minify"
        ? minifyXml(input)
        : formatXml(input, { indent: Number(options.indent) || 2 }),
    extension: "xml",
  }),
};

export const jsonToXmlConfig: TextToolConfig = {
  id: "json-to-xml",
  inputLabel: "JSON",
  outputLabel: "XML",
  placeholder: '{"book":{"title":"Deep Work"}}',
  sample: SAMPLE_JSON,
  monoInput: true,
  monoOutput: true,
  options: [
    { id: "rootName", label: "Root element name", type: "text", default: "root" },
    {
      id: "itemName",
      label: "Array item name",
      description: "Array entries have no key of their own, so they need one.",
      type: "text",
      default: "item",
    },
  ],
  transform: (input, options) => {
    const parsed = parseJson(input);
    if (!parsed.ok) return jsonError(`Invalid JSON: ${parsed.error.message}`);
    return {
      output: jsonToXml(parsed.value, {
        rootName: String(options.rootName || "root"),
        itemName: String(options.itemName || "item"),
      }),
      extension: "xml",
    };
  },
};

export const cssMinifierConfig: TextToolConfig = {
  id: "css-minifier",
  inputLabel: "CSS",
  outputLabel: "Result",
  placeholder: ".button { color: red; }",
  sample: `/* Buttons */\n.button {\n  color: #4cc93f;\n  padding: 12px 24px;\n  border-radius: 16px;\n}\n\n.button:hover { filter: brightness(1.05); }`,
  monoInput: true,
  monoOutput: true,
  options: [
    {
      id: "mode",
      label: "Action",
      type: "select",
      default: "minify",
      choices: [
        { value: "minify", label: "Minify" },
        { value: "format", label: "Beautify" },
      ],
    },
  ],
  transform: (input, options) => {
    const output = options.mode === "minify" ? minifyCss(input) : formatCss(input);
    const saved = input.length - output.length;
    return {
      output,
      extension: "css",
      stats: [
        { label: "Before", value: `${input.length.toLocaleString()} chars` },
        { label: "After", value: `${output.length.toLocaleString()} chars` },
        {
          label: saved >= 0 ? "Saved" : "Grew",
          value: `${Math.abs(saved).toLocaleString()} chars`,
        },
      ],
    };
  },
};

export const htmlMinifierConfig: TextToolConfig = {
  id: "html-minifier",
  inputLabel: "HTML",
  outputLabel: "Minified HTML",
  placeholder: "<div>\n  <p>Hello</p>\n</div>",
  sample: `<!-- page -->\n<div class="card">\n  <h1>DO101</h1>\n  <p>Do more.   Simply.</p>\n  <pre>  keep   this  </pre>\n</div>`,
  monoInput: true,
  monoOutput: true,
  options: [{ id: "removeComments", label: "Remove comments", type: "toggle", default: true }],
  transform: (input, options) => {
    const output = minifyHtml(input, { removeComments: Boolean(options.removeComments) });
    const saved = input.length - output.length;
    return {
      output,
      extension: "html",
      stats: [
        { label: "Before", value: `${input.length.toLocaleString()} chars` },
        { label: "After", value: `${output.length.toLocaleString()} chars` },
        { label: "Saved", value: `${Math.max(0, saved).toLocaleString()} chars` },
      ],
    };
  },
};

export const sqlFormatterConfig: TextToolConfig = {
  id: "sql-formatter",
  inputLabel: "SQL",
  outputLabel: "Result",
  placeholder: "select * from users where id = 1",
  sample:
    "select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.active = true and u.created_at > '2026-01-01' group by u.id, u.name order by orders desc limit 20;",
  monoInput: true,
  monoOutput: true,
  options: [
    {
      id: "mode",
      label: "Action",
      type: "select",
      default: "format",
      choices: [
        { value: "format", label: "Beautify" },
        { value: "minify", label: "Minify" },
      ],
    },
    {
      id: "uppercase",
      label: "Uppercase keywords",
      type: "toggle",
      default: true,
      showWhen: { id: "mode", equals: "format" },
    },
  ],
  transform: (input, options) => ({
    output:
      options.mode === "minify"
        ? minifySql(input)
        : formatSql(input, { uppercase: Boolean(options.uppercase) }),
    extension: "sql",
  }),
};

/* --------------------------------- YAML --------------------------------- */

export const yamlToJsonConfig: TextToolConfig = {
  id: "yaml-to-json",
  inputLabel: "YAML",
  outputLabel: "JSON",
  placeholder: "site: DO101\nfree: true",
  sample: SAMPLE_YAML,
  monoInput: true,
  monoOutput: true,
  transform: (input) => {
    try {
      const value = loadYaml(input);
      if (value === undefined) return jsonError("That YAML document is empty.");
      return { output: JSON.stringify(value, null, 2), extension: "json" };
    } catch (err) {
      return jsonError(
        err instanceof Error
          ? `Invalid YAML: ${err.message.split("\n")[0]}`
          : "That is not valid YAML.",
      );
    }
  },
};

export const jsonToYamlConfig: TextToolConfig = {
  id: "json-to-yaml",
  inputLabel: "JSON",
  outputLabel: "YAML",
  placeholder: '{"site":"DO101"}',
  sample: SAMPLE_JSON,
  monoInput: true,
  monoOutput: true,
  options: [
    {
      id: "indent",
      label: "Indent size",
      type: "select",
      default: "2",
      choices: [
        { value: "2", label: "2 spaces" },
        { value: "4", label: "4 spaces" },
      ],
    },
    {
      id: "quoteStrings",
      label: "Always quote strings",
      description: "Safer for values that could be read as numbers or booleans.",
      type: "toggle",
      default: false,
    },
  ],
  transform: (input, options) => {
    const parsed = parseJson(input);
    if (!parsed.ok) return jsonError(`Invalid JSON: ${parsed.error.message}`);
    try {
      return {
        output: dumpYaml(parsed.value, {
          indent: Number(options.indent) || 2,
          lineWidth: 100,
          forceQuotes: Boolean(options.quoteStrings),
        }),
        extension: "yaml",
      };
    } catch {
      return jsonError("This JSON contains a value YAML cannot represent.");
    }
  },
};
