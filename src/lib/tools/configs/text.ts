import type { TextToolConfig } from "../text-tool-config";
import {
  removeDuplicateLines,
  removeEmptyLines,
  removeExtraSpaces,
  sortLines,
  reverseText,
  findAndReplace,
  extractFromText,
  encodeHtml,
  decodeHtml,
  slugify,
  type SortMode,
  type ReverseMode,
  type ExtractKind,
} from "@/lib/text/transforms";

const countLines = (text: string) => (text ? text.split("\n").length : 0);

export const removeDuplicateLinesConfig: TextToolConfig = {
  id: "remove-duplicate-lines",
  inputLabel: "Your list",
  outputLabel: "Unique lines",
  placeholder: "apple\nbanana\napple\ncherry\nbanana",
  sample: "apple\nbanana\napple\ncherry\nBanana\n\ncherry\ndate",
  options: [
    {
      id: "caseSensitive",
      label: "Case sensitive",
      description: "Off means \"Apple\" and \"apple\" count as the same line.",
      type: "toggle",
      default: false,
    },
    {
      id: "trim",
      label: "Ignore surrounding spaces",
      description: "Treats \"  apple\" and \"apple\" as the same line.",
      type: "toggle",
      default: true,
    },
  ],
  transform: (input, options) => {
    const output = removeDuplicateLines(input, {
      caseSensitive: Boolean(options.caseSensitive),
      trim: Boolean(options.trim),
    });
    const before = countLines(input);
    const after = countLines(output);
    return {
      output,
      stats: [
        { label: "Lines in", value: String(before) },
        { label: "Lines out", value: String(after) },
        { label: "Duplicates removed", value: String(Math.max(0, before - after)) },
      ],
    };
  },
};

export const removeEmptyLinesConfig: TextToolConfig = {
  id: "remove-empty-lines",
  inputLabel: "Text with gaps",
  outputLabel: "Tightened text",
  placeholder: "First line\n\n\nSecond line\n   \nThird line",
  sample: "First line\n\n\nSecond line\n   \n\nThird line\n",
  options: [
    {
      id: "trimFirst",
      label: "Treat whitespace-only lines as empty",
      description: "A line containing only spaces or tabs is removed too.",
      type: "toggle",
      default: true,
    },
  ],
  transform: (input, options) => {
    const output = removeEmptyLines(input, { trimFirst: Boolean(options.trimFirst) });
    const before = countLines(input);
    const after = countLines(output);
    return {
      output,
      stats: [
        { label: "Lines in", value: String(before) },
        { label: "Lines out", value: String(after) },
        { label: "Blank lines removed", value: String(Math.max(0, before - after)) },
      ],
    };
  },
};

export const removeExtraSpacesConfig: TextToolConfig = {
  id: "remove-extra-spaces",
  inputLabel: "Messy text",
  outputLabel: "Single-spaced text",
  placeholder: "This    text  has   too many     spaces.",
  sample: "This    text  has   too many     spaces.   \n\n\n\nAnd  far  too  many  blank  lines.",
  options: [
    { id: "collapseInline", label: "Collapse repeated spaces", type: "toggle", default: true },
    { id: "trimLines", label: "Trim the start and end of each line", type: "toggle", default: true },
    { id: "collapseBlankLines", label: "Collapse runs of blank lines", type: "toggle", default: true },
  ],
  transform: (input, options) => {
    const output = removeExtraSpaces(input, {
      collapseInline: Boolean(options.collapseInline),
      trimLines: Boolean(options.trimLines),
      collapseBlankLines: Boolean(options.collapseBlankLines),
    });
    return {
      output,
      stats: [
        { label: "Characters in", value: input.length.toLocaleString() },
        { label: "Characters out", value: output.length.toLocaleString() },
        { label: "Removed", value: Math.max(0, input.length - output.length).toLocaleString() },
      ],
    };
  },
};

export const textSorterConfig: TextToolConfig = {
  id: "text-sorter",
  inputLabel: "Lines to sort",
  outputLabel: "Sorted lines",
  placeholder: "banana\napple\ncherry",
  sample: "banana\nApple\ncherry\ndate\nelderberry\nfig\napple",
  options: [
    {
      id: "mode",
      label: "Sort by",
      type: "select",
      default: "alpha",
      choices: [
        { value: "alpha", label: "A → Z" },
        { value: "alpha-desc", label: "Z → A" },
        { value: "numeric", label: "Smallest number first" },
        { value: "numeric-desc", label: "Largest number first" },
        { value: "length", label: "Shortest line first" },
        { value: "length-desc", label: "Longest line first" },
        { value: "reverse", label: "Reverse the current order" },
        { value: "random", label: "Shuffle randomly" },
      ],
    },
    { id: "caseSensitive", label: "Case sensitive", type: "toggle", default: false },
    { id: "removeDuplicates", label: "Remove duplicates while sorting", type: "toggle", default: false },
  ],
  transform: (input, options) => {
    const output = sortLines(input, {
      mode: options.mode as SortMode,
      caseSensitive: Boolean(options.caseSensitive),
      removeDuplicates: Boolean(options.removeDuplicates),
    });
    return {
      output,
      stats: [
        { label: "Lines in", value: String(countLines(input)) },
        { label: "Lines out", value: String(countLines(output)) },
      ],
    };
  },
};

export const textReverserConfig: TextToolConfig = {
  id: "text-reverser",
  inputLabel: "Your text",
  outputLabel: "Reversed",
  placeholder: "Hello world",
  sample: "Hello world\nThe quick brown fox",
  options: [
    {
      id: "mode",
      label: "Reverse",
      type: "select",
      default: "characters",
      choices: [
        { value: "characters", label: "Every character" },
        { value: "words", label: "Word order" },
        { value: "lines", label: "Line order" },
        { value: "each-word", label: "Letters inside each word" },
      ],
    },
  ],
  transform: (input, options) => ({
    output: reverseText(input, options.mode as ReverseMode),
  }),
};

export const findAndReplaceConfig: TextToolConfig = {
  id: "find-and-replace",
  inputLabel: "Your text",
  outputLabel: "After replacing",
  placeholder: "Paste the text you want to edit…",
  sample: "The cat sat on the mat. The cat was happy. CAT!",
  options: [
    { id: "find", label: "Find", type: "text", default: "cat", placeholder: "text to search for" },
    { id: "replace", label: "Replace with", type: "text", default: "dog", placeholder: "leave blank to delete" },
    { id: "caseSensitive", label: "Case sensitive", type: "toggle", default: false },
    { id: "wholeWord", label: "Whole words only", description: "\"cat\" will not match \"category\".", type: "toggle", default: false },
    { id: "useRegex", label: "Treat “find” as a regular expression", type: "toggle", default: false },
  ],
  transform: (input, options) => {
    const result = findAndReplace(input, {
      find: String(options.find ?? ""),
      replace: String(options.replace ?? ""),
      useRegex: Boolean(options.useRegex),
      caseSensitive: Boolean(options.caseSensitive),
      wholeWord: Boolean(options.wholeWord),
    });
    return {
      output: result.output,
      error: result.error,
      stats: [{ label: "Replacements", value: String(result.count) }],
    };
  },
};

export const textExtractorConfig: TextToolConfig = {
  id: "text-extractor",
  inputLabel: "Text to search",
  outputLabel: "What was found",
  placeholder: "Paste an email, a page of HTML, a log file…",
  sample:
    "Contact hello@do101.online or sales@example.com.\nSee https://do101.online/tools and http://example.com/x?a=1\nServer 192.168.1.24 responded in 240 ms. #launch @do101",
  options: [
    {
      id: "kind",
      label: "Extract",
      type: "select",
      default: "emails",
      choices: [
        { value: "emails", label: "Email addresses" },
        { value: "urls", label: "URLs" },
        { value: "numbers", label: "Numbers" },
        { value: "ips", label: "IP addresses" },
        { value: "hashtags", label: "Hashtags" },
        { value: "mentions", label: "@mentions" },
        { value: "phones", label: "Phone-like numbers" },
      ],
    },
    { id: "unique", label: "Remove duplicates", type: "toggle", default: true },
    { id: "sort", label: "Sort alphabetically", type: "toggle", default: false },
  ],
  transform: (input, options) => {
    const found = extractFromText(input, options.kind as ExtractKind, {
      unique: Boolean(options.unique),
      sort: Boolean(options.sort),
    });
    return {
      output: found.join("\n"),
      stats: [{ label: "Found", value: String(found.length) }],
    };
  },
};

export const htmlEncodeConfig: TextToolConfig = {
  id: "html-encoder",
  inputLabel: "Raw text or markup",
  outputLabel: "HTML-encoded",
  placeholder: '<a href="x">Tom & Jerry</a>',
  sample: '<script>alert("hi")</script> — Tom & Jerry\'s café',
  monoOutput: true,
  options: [
    {
      id: "allCharacters",
      label: "Also encode non-ASCII characters",
      description: "Turns é into &#233; — useful for legacy systems.",
      type: "toggle",
      default: false,
    },
  ],
  transform: (input, options) => ({
    output: encodeHtml(input, { allCharacters: Boolean(options.allCharacters) }),
  }),
};

export const htmlDecodeConfig: TextToolConfig = {
  id: "html-decoder",
  inputLabel: "HTML-encoded text",
  outputLabel: "Decoded text",
  placeholder: "&lt;p&gt;Tom &amp; Jerry&lt;/p&gt;",
  sample: "&lt;p&gt;Tom &amp; Jerry&#39;s caf&eacute; &mdash; 50&#37; off&lt;/p&gt;",
  monoInput: true,
  transform: (input) => ({ output: decodeHtml(input) }),
};

export const slugGeneratorConfig: TextToolConfig = {
  id: "slug-generator",
  inputLabel: "Title or phrase",
  outputLabel: "URL slug",
  placeholder: "10 Ways to Compress Images — Fast!",
  sample: "10 Ways to Compress Images — Fast!\nCafé Crème & Co.\nHow to Convert PDF to Word",
  monoOutput: true,
  options: [
    {
      id: "separator",
      label: "Separator",
      type: "select",
      default: "-",
      choices: [
        { value: "-", label: "Hyphen (recommended)" },
        { value: "_", label: "Underscore" },
      ],
    },
    { id: "lowercase", label: "Lowercase", type: "toggle", default: true },
    {
      id: "maxLength",
      label: "Maximum length",
      description: "0 means no limit. 60–70 characters is a sensible cap for URLs.",
      type: "number",
      default: 0,
      min: 0,
      max: 200,
    },
  ],
  transform: (input, options) => {
    const lines = input.split("\n").filter((l) => l.trim());
    const slugs = lines.map((line) =>
      slugify(line, {
        separator: String(options.separator),
        lowercase: Boolean(options.lowercase),
        maxLength: Number(options.maxLength) || 0,
      }),
    );
    return {
      output: slugs.join("\n"),
      stats: [
        { label: "Slugs", value: String(slugs.length) },
        { label: "Longest", value: String(Math.max(0, ...slugs.map((s) => s.length))) },
      ],
    };
  },
};
