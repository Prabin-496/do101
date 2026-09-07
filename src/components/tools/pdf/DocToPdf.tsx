"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select, Textarea } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState, EmptyState, InfoNote, Progress, Stat, SuccessNote } from "@/components/ui/Feedback";
import { htmlToBlocks } from "@/lib/docs/html-to-blocks";
import { blocksToPdf, type RenderReport } from "@/lib/docs/blocks-to-pdf";
import { downloadBytes } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

export type DocSource = "docx" | "html" | "txt" | "markdown";

const MAX_DOC_BYTES = 30 * 1024 * 1024;

const COPY: Record<DocSource, { icon: string; title: string; accept: string; verb: string }> = {
  docx: { icon: "📝", title: "Drop your Word document", accept: ".docx", verb: "Convert to PDF" },
  html: { icon: "🌐", title: "Drop an HTML file", accept: ".html,.htm,text/html", verb: "Convert to PDF" },
  txt: { icon: "🔤", title: "Drop a text file", accept: ".txt,text/plain", verb: "Convert to PDF" },
  markdown: { icon: "⬇️", title: "Drop a Markdown file", accept: ".md,.markdown,text/markdown", verb: "Convert to PDF" },
};

export function DocToPdf({ source }: { source: DocSource }) {
  const [name, setName] = React.useState<string | null>(null);
  const [pasted, setPasted] = React.useState("");
  const [mode, setMode] = React.useState<"file" | "paste">(source === "docx" ? "file" : "file");
  const [pageSize, setPageSize] = React.useState<"a4" | "letter">("a4");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<RenderReport | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const copy = COPY[source];

  const buildFromHtml = React.useCallback(
    async (html: string, sourceName: string, extraWarnings: string[] = []) => {
      const blocks = htmlToBlocks(html);
      if (!blocks.length) {
        throw new Error("That document appears to be empty — there was nothing to lay out.");
      }
      const result = await blocksToPdf(blocks, { pageSize });
      setReport(result);
      setName(sourceName);

      const notes = [...extraWarnings];
      if (result.droppedCharacters > 0) {
        notes.push(
          `${result.droppedCharacters} character${result.droppedCharacters === 1 ? "" : "s"} outside the Latin alphabet were replaced with "?". The standard PDF fonts cannot draw scripts such as Devanagari, Arabic, Chinese, Japanese or Korean.`,
        );
      }
      if (result.imagesSkipped > 0) {
        notes.push(`${result.imagesSkipped} image${result.imagesSkipped === 1 ? "" : "s"} could not be embedded and were left out.`);
      }
      if (result.tablesFlattened > 0) {
        notes.push(
          `${result.tablesFlattened} table${result.tablesFlattened === 1 ? " was" : "s were"} flattened into plain lines — real table layout is not reproduced.`,
        );
      }
      setWarnings(notes);
      track("tool_complete", { tool: `${source}-to-pdf` });
      recordCompletion(15);
    },
    [pageSize, source],
  );

  const escapeHtml = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const textToHtml = (text: string) =>
    text
      .split(/\n{2,}/)
      .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
      .join("");

  const onFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (file.size > MAX_DOC_BYTES) {
      setError(`${file.name} is ${formatBytes(file.size)} — the limit is 30 MB.`);
      return;
    }
    setBusy(true);
    setError(null);
    setReport(null);
    setWarnings([]);

    try {
      if (source === "docx") {
        if (!/\.docx$/i.test(file.name)) {
          throw new Error(
            /\.doc$/i.test(file.name)
              ? "That is a legacy .doc file. Open it in Word and save it as .docx first — the old binary format cannot be read in a browser."
              : "That is not a .docx file.",
          );
        }
        const mammoth = await import("mammoth");
        const { value, messages } = await mammoth.convertToHtml(
          { arrayBuffer: await file.arrayBuffer() },
          { convertImage: undefined },
        );
        const notes = messages
          .filter((m) => m.type === "warning")
          .slice(0, 3)
          .map((m) => m.message);
        await buildFromHtml(value, file.name, notes);
      } else if (source === "html") {
        await buildFromHtml(await file.text(), file.name);
      } else if (source === "markdown") {
        const { marked } = await import("marked");
        const html = await marked.parse(await file.text(), { async: true });
        await buildFromHtml(html, file.name);
      } else {
        await buildFromHtml(textToHtml(await file.text()), file.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That document could not be converted.");
    } finally {
      setBusy(false);
    }
  };

  const convertPasted = async () => {
    if (!pasted.trim()) return;
    setBusy(true);
    setError(null);
    setReport(null);
    setWarnings([]);
    try {
      if (source === "markdown") {
        const { marked } = await import("marked");
        await buildFromHtml(await marked.parse(pasted, { async: true }), "pasted.md");
      } else if (source === "html") {
        await buildFromHtml(pasted, "pasted.html");
      } else {
        await buildFromHtml(textToHtml(pasted), "pasted.txt");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be converted.");
    } finally {
      setBusy(false);
    }
  };

  const outputName = (name ?? "document").replace(/\.(docx|html?|txt|md|markdown)$/i, "") + ".pdf";

  return (
    <div className="space-y-4">
      {source === "docx" ? (
        <InfoNote icon="ℹ️">
          <strong>Text and structure, not pixel-perfect layout.</strong> Headings, paragraphs, lists,
          bold and italic are preserved and the result is a real, selectable-text PDF. Exact fonts,
          columns, floated images and complex table layout are not reproduced. Modern{" "}
          <code className="font-mono">.docx</code> only — the old binary{" "}
          <code className="font-mono">.doc</code> format cannot be read in a browser.
        </InfoNote>
      ) : null}

      {source !== "docx" ? (
        <Tabs
          ariaLabel="Input method"
          value={mode}
          onChange={(v) => setMode(v as "file" | "paste")}
          items={[
            { id: "file", label: "Upload a file" },
            { id: "paste", label: "Paste content" },
          ]}
        />
      ) : null}

      {mode === "file" || source === "docx" ? (
        <FileDrop
          onFiles={onFiles}
          accept={copy.accept}
          multiple={false}
          icon={copy.icon}
          title={copy.title}
          hint="Converted on your device · nothing is uploaded"
          disabled={busy}
        />
      ) : (
        <div>
          <Label htmlFor="doc-paste">
            {source === "markdown" ? "Markdown" : source === "html" ? "HTML" : "Text"}
          </Label>
          <Textarea
            id="doc-paste"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={
              source === "markdown"
                ? "# My document\n\nSome **bold** text and a list:\n\n- one\n- two"
                : source === "html"
                  ? "<h1>My document</h1>\n<p>Some <strong>bold</strong> text.</p>"
                  : "Paste your text here…"
            }
            className="min-h-[220px] font-mono text-sm"
          />
          <Button className="mt-3" tone="cherry" onClick={convertPasted} disabled={busy || !pasted.trim()}>
            {busy ? "Converting…" : copy.verb}
          </Button>
        </div>
      )}

      <Card className="p-5">
        <div className="max-w-xs">
          <Label htmlFor="doc-page-size">Page size</Label>
          <Select
            id="doc-page-size"
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as "a4" | "letter")}
          >
            <option value="a4">A4</option>
            <option value="letter">US Letter</option>
          </Select>
        </div>
      </Card>

      {busy ? <Progress value={70} tone="cherry" label="Laying out the document" /> : null}
      {error ? <ErrorState message={error} /> : null}

      {report ? (
        <>
          <SuccessNote>
            PDF ready — {report.pages} page{report.pages === 1 ? "" : "s"},{" "}
            {formatBytes(report.bytes.length)}.
          </SuccessNote>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Pages" value={report.pages} tone="cherry" />
            <Stat label="Images kept" value={report.imagesEmbedded} tone="grass" />
            <Stat label="Size" value={formatBytes(report.bytes.length)} tone="sky" />
          </div>

          {warnings.length ? (
            <Card className="bg-[var(--sun-soft)] p-4">
              <p className="text-sm font-extrabold">What changed in conversion</p>
              <ul className="mt-2 space-y-1">
                {warnings.map((warning) => (
                  <li key={warning} className="text-sm font-semibold">
                    • {warning}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Button tone="grass" onClick={() => downloadBytes(report.bytes, outputName)}>
            Download PDF
          </Button>
        </>
      ) : null}

      {!report && !busy && !error ? (
        <EmptyState
          icon={copy.icon}
          title="Nothing converted yet"
          description="Add a document and a real PDF is built in your browser — no upload, no watermark."
        />
      ) : null}
    </div>
  );
}
