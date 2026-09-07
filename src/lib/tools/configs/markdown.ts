import { marked } from "marked";
import TurndownService from "turndown";
import type { TextToolConfig } from "../text-tool-config";

const SAMPLE_MD = `# DO101

**Free tools** that run in your browser.

- No sign-up
- No upload
- No watermark

See the [tool directory](https://do101.online/tools).

> Do more. Simply.`;

const SAMPLE_HTML = `<h1>DO101</h1>
<p><strong>Free tools</strong> that run in your browser.</p>
<ul><li>No sign-up</li><li>No upload</li></ul>
<p>See the <a href="https://do101.online/tools">tool directory</a>.</p>`;

export const markdownToHtmlConfig: TextToolConfig = {
  id: "markdown-to-html",
  inputLabel: "Markdown",
  outputLabel: "HTML",
  placeholder: "# Heading\n\nSome **bold** text.",
  sample: SAMPLE_MD,
  monoInput: true,
  monoOutput: true,
  options: [
    {
      id: "breaks",
      label: "Treat single newlines as line breaks",
      description: "GitHub-style. Off follows the CommonMark rule that a single newline is a space.",
      type: "toggle",
      default: false,
    },
  ],
  transform: (input, options) => {
    const html = marked.parse(input, {
      async: false,
      breaks: Boolean(options.breaks),
      gfm: true,
    }) as string;
    return { output: html.trim(), extension: "html" };
  },
};

export const htmlToMarkdownConfig: TextToolConfig = {
  id: "html-to-markdown",
  inputLabel: "HTML",
  outputLabel: "Markdown",
  placeholder: "<h1>Heading</h1>\n<p>Some <strong>bold</strong> text.</p>",
  sample: SAMPLE_HTML,
  monoInput: true,
  monoOutput: true,
  options: [
    {
      id: "headingStyle",
      label: "Heading style",
      type: "select",
      default: "atx",
      choices: [
        { value: "atx", label: "# Heading" },
        { value: "setext", label: "Heading\\n=======" },
      ],
    },
    {
      id: "bulletListMarker",
      label: "Bullet marker",
      type: "select",
      default: "-",
      choices: [
        { value: "-", label: "- dash" },
        { value: "*", label: "* asterisk" },
        { value: "+", label: "+ plus" },
      ],
    },
  ],
  transform: (input, options) => {
    const service = new TurndownService({
      headingStyle: options.headingStyle === "setext" ? "setext" : "atx",
      bulletListMarker: String(options.bulletListMarker) as "-" | "*" | "+",
      codeBlockStyle: "fenced",
    });
    return { output: service.turndown(input).trim(), extension: "md" };
  },
};
