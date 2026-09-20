"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select, Toggle } from "@/components/ui/Field";
import { ErrorState, InfoNote } from "@/components/ui/Feedback";
import { buildGrid, gridToCsv, gridToMarkdown } from "@/lib/wbs/grid";
import { docToJson } from "@/lib/wbs/import";
import type { NumberingStyle, WbsDoc, WbsSettings } from "@/lib/wbs/model";
import { buildWorkbook, workbookFilename } from "@/lib/wbs/workbook";
import { track } from "@/lib/analytics";
import { WbsSheetPreview } from "./WbsSheetPreview";

const NUMBERING: { id: NumberingStyle; label: string; example: string }[] = [
  { id: "decimal", label: "Decimal", example: "1, 1.1, 1.1.1" },
  { id: "outline", label: "Outline", example: "I, I.A, I.A.1" },
  { id: "alpha", label: "Letters then numbers", example: "A, A.1, A.1.1" },
  { id: "flat", label: "Flat list", example: "1, 2, 3, 4" },
];

const DATE_FORMATS = [
  { id: "yyyy-mm-dd", label: "2026-03-14 (ISO)" },
  { id: "dd/mm/yyyy", label: "14/03/2026" },
  { id: "mm/dd/yyyy", label: "03/14/2026" },
  { id: "d mmm yyyy", label: "14 Mar 2026" },
];

const INDENTS = [
  { id: "    ", label: "Four spaces" },
  { id: "  ", label: "Two spaces" },
  { id: "— ", label: "Em dash" },
  { id: "› ", label: "Chevron" },
];

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Layout, numbering and download options.
 *
 * The preview underneath is built from the same grid the .xlsx is written
 * from, so it is not an impression of the export — it is the export.
 */
export function WbsExportPanel({
  doc,
  onSettings,
}: {
  doc: WbsDoc;
  onSettings: (changes: Partial<WbsSettings>) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const grid = React.useMemo(() => buildGrid(doc), [doc]);
  const numericFields = doc.fields.filter(
    (field) => field.type === "number" || field.type === "currency",
  );

  const setNumbering = (changes: Partial<WbsSettings["numbering"]>) =>
    onSettings({ numbering: { ...doc.settings.numbering, ...changes } });

  async function downloadExcel() {
    setBusy(true);
    setError(null);
    try {
      const blob = await buildWorkbook(doc);
      save(blob, workbookFilename(doc, "xlsx"));
      track("tool_complete", { tool: "wbs", format: "xlsx" });
    } catch {
      setError("The workbook could not be built in this browser. Try the CSV download instead.");
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    save(
      new Blob([gridToCsv(grid)], { type: "text/csv;charset=utf-8" }),
      workbookFilename(doc, "csv"),
    );
    track("tool_complete", { tool: "wbs", format: "csv" });
  }

  function downloadJson() {
    save(
      new Blob([docToJson(doc)], { type: "application/json" }),
      workbookFilename(doc, "json"),
    );
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(gridToMarkdown(grid));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("This browser blocked clipboard access. Download the CSV instead.");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 text-base">Numbering</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="wbs-style">Style</Label>
            <Select
              id="wbs-style"
              value={doc.settings.numbering.style}
              onChange={(event) => setNumbering({ style: event.target.value as NumberingStyle })}
            >
              {NUMBERING.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label} — {entry.example}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="wbs-prefix" hint="optional">
              Code prefix
            </Label>
            <Input
              id="wbs-prefix"
              value={doc.settings.numbering.prefix}
              placeholder="PRJ-"
              onChange={(event) => setNumbering({ prefix: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="wbs-separator">Separator</Label>
            <Select
              id="wbs-separator"
              value={doc.settings.numbering.separator}
              onChange={(event) => setNumbering({ separator: event.target.value })}
            >
              <option value=".">Full stop — 1.2.1</option>
              <option value="-">Hyphen — 1-2-1</option>
              <option value="/">Slash — 1/2/1</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wbs-pad" hint="0 = off">
                Pad to
              </Label>
              <Input
                id="wbs-pad"
                type="number"
                min={0}
                max={4}
                value={doc.settings.numbering.pad}
                onChange={(event) =>
                  setNumbering({ pad: Math.max(0, Math.min(4, Number(event.target.value) || 0)) })
                }
              />
            </div>
            <div>
              <Label htmlFor="wbs-start">Start at</Label>
              <Input
                id="wbs-start"
                type="number"
                min={0}
                max={99}
                value={doc.settings.numbering.startAt}
                onChange={(event) => setNumbering({ startAt: Number(event.target.value) || 0 })}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-base">Sheet layout</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="wbs-layout">Task names</Label>
            <Select
              id="wbs-layout"
              value={doc.settings.nameLayout}
              onChange={(event) =>
                onSettings({ nameLayout: event.target.value as WbsSettings["nameLayout"] })
              }
            >
              <option value="indent">One column, indented</option>
              <option value="levels">A column per level</option>
              <option value="plain">One column, no indent</option>
            </Select>
          </div>
          {doc.settings.nameLayout === "indent" ? (
            <div>
              <Label htmlFor="wbs-indent">Indent with</Label>
              <Select
                id="wbs-indent"
                value={doc.settings.indentUnit}
                onChange={(event) => onSettings({ indentUnit: event.target.value })}
              >
                {INDENTS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div>
            <Label htmlFor="wbs-currency">Currency symbol</Label>
            <Input
              id="wbs-currency"
              value={doc.settings.currencySymbol}
              maxLength={3}
              onChange={(event) => onSettings({ currencySymbol: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="wbs-date">Date format</Label>
            <Select
              id="wbs-date"
              value={doc.settings.dateFormat}
              onChange={(event) => onSettings({ dateFormat: event.target.value })}
            >
              {DATE_FORMATS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="wbs-weight" hint="for weighted roll-ups">
              Weight by
            </Label>
            <Select
              id="wbs-weight"
              value={doc.settings.weightFieldId ?? ""}
              onChange={(event) => onSettings({ weightFieldId: event.target.value || null })}
            >
              <option value="">Every task equally</option>
              {numericFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Toggle
            checked={doc.settings.showCode}
            onChange={(value) => onSettings({ showCode: value })}
            label="WBS code column"
          />
          <Toggle
            checked={doc.settings.showLevel}
            onChange={(value) => onSettings({ showLevel: value })}
            label="Level column"
          />
          <Toggle
            checked={doc.settings.showParent}
            onChange={(value) => onSettings({ showParent: value })}
            label="Parent code column"
          />
          <Toggle
            checked={doc.settings.showType}
            onChange={(value) => onSettings({ showType: value })}
            label="Summary / work package column"
          />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-base">Excel options</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            checked={doc.settings.liveFormulas}
            onChange={(value) => onSettings({ liveFormulas: value })}
            label="Live roll-up formulas"
            description="Summary rows get =SUM(), =MIN() and =MAX() over their children, so totals recalculate in Excel."
          />
          <Toggle
            checked={doc.settings.groupRows}
            onChange={(value) => onSettings({ groupRows: value })}
            label="Collapsible row groups"
            description="Adds Excel's outline levels, so branches fold away with the +/- controls."
          />
          <Toggle
            checked={doc.settings.includeDictionary}
            onChange={(value) => onSettings({ includeDictionary: value })}
            label="WBS dictionary sheet"
            description="A second sheet with each task's description and acceptance criteria."
          />
          <Toggle
            checked={doc.settings.includeSummary}
            onChange={(value) => onSettings({ includeSummary: value })}
            label="Summary sheet"
            description="Totals per top-level branch, with each one's share of the project."
          />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={downloadExcel} disabled={busy}>
          {busy ? "Building…" : "Download .xlsx"}
        </Button>
        <Button tone="sky" onClick={downloadCsv}>
          Download .csv
        </Button>
        <Button tone="panel" onClick={copyMarkdown}>
          {copied ? "Copied" : "Copy as Markdown"}
        </Button>
        <Button tone="panel" onClick={downloadJson}>
          Save project file
        </Button>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <InfoNote>
        The workbook is written in your browser. Numbers, dates and percentages arrive as real
        Excel values with number formats — not text — so you can sort, filter and chart them
        straight away. Cell colouring is not written, since the spreadsheet library used here
        does not produce it.
      </InfoNote>

      <div>
        <h3 className="mb-2 text-base">
          Preview{" "}
          <span className="text-sm font-bold text-[var(--muted)]">
            — {grid.rows.length} rows, {grid.columns.length} columns
          </span>
        </h3>
        <WbsSheetPreview grid={grid} />
      </div>
    </div>
  );
}
