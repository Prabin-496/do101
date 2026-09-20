"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Textarea } from "@/components/ui/Field";
import { ErrorState, InfoNote, SuccessNote } from "@/components/ui/Feedback";
import { FileDrop } from "@/components/ui/FileDrop";
import { parseDoc, parseOutline, tableToTasks } from "@/lib/wbs/import";
import type { WbsDoc, WbsField, WbsTask } from "@/lib/wbs/model";
import { TEMPLATES, templateTasks } from "@/lib/wbs/templates";
import { readSpreadsheet } from "@/lib/wbs/workbook";

const EXAMPLE = `Phase one
  First task
  Second task
Phase two
  1.1 also works
  - so do bullets`;

/**
 * Starting points: a template, a pasted outline, or a file.
 *
 * Nothing is uploaded — the spreadsheet reader runs on the bytes the browser
 * already has, which is also why it works with the tab closed to the network.
 */
export function WbsStartPanel({
  onReplace,
  onAppend,
  onDocument,
  onImportTable,
  fields,
}: {
  onReplace: (tasks: WbsTask[]) => void;
  onAppend: (tasks: WbsTask[]) => void;
  onDocument: (doc: WbsDoc) => void;
  onImportTable: (tasks: WbsTask[], fields: WbsField[], projectName: string) => void;
  fields: WbsField[];
}) {
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<string[]>([]);

  function applyOutline(replace: boolean) {
    const tasks = parseOutline(text);
    if (tasks.length === 0) {
      setError("Nothing to read there — write one task per line and indent the sub-tasks.");
      return;
    }
    setError(null);
    setNotes([`Added ${tasks.length} top-level ${tasks.length === 1 ? "task" : "tasks"}.`]);
    if (replace) onReplace(tasks);
    else onAppend(tasks);
    setText("");
  }

  async function importFile(file: File) {
    setError(null);
    setNotes([]);
    try {
      if (/\.json$/i.test(file.name)) {
        const restored = parseDoc(await file.text());
        if (!restored) {
          setError("That JSON file is not a saved WBS project.");
          return;
        }
        onDocument(restored);
        setNotes(["Project file opened, with its columns and settings."]);
        return;
      }

      if (/\.(txt|md)$/i.test(file.name)) {
        const tasks = parseOutline(await file.text());
        if (tasks.length === 0) {
          setError("No task lines were found in that file.");
          return;
        }
        onReplace(tasks);
        setNotes([`Read ${tasks.length} top-level tasks from the outline.`]);
        return;
      }

      const rows = await readSpreadsheet(file);
      const result = tableToTasks(rows, fields);
      if (result.tasks.length === 0) {
        setError("No task rows were found. The sheet needs a header row and a task column.");
        return;
      }
      // The current settings are kept; only the structure and columns come
      // from the file, so an import never resets someone's numbering choices.
      onImportTable(result.tasks, result.fields, file.name.replace(/\.[^.]+$/, ""));
      setNotes(result.notes);
    } catch {
      setError("That file could not be read. CSV, XLSX, XLS, ODS, TXT and JSON all work.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 text-base">Start from a template</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {TEMPLATES.map((template) => (
            <Card key={template.id} hover className="p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden className="text-2xl">
                  {template.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">{template.name}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                    {template.blurb}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => onReplace(templateTasks(template.id))}>
                      Use this
                    </Button>
                    <Button
                      size="sm"
                      tone="panel"
                      onClick={() => onAppend(templateTasks(template.id))}
                    >
                      Add to mine
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-base">Paste an outline</h3>
        <Label htmlFor="wbs-paste" hint="indent, or number as 1.2.1">
          One task per line
        </Label>
        <Textarea
          id="wbs-paste"
          value={text}
          placeholder={EXAMPLE}
          onChange={(event) => setText(event.target.value)}
          className="min-h-[150px]"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={() => applyOutline(false)} disabled={!text.trim()}>
            Add to my breakdown
          </Button>
          <Button tone="panel" onClick={() => applyOutline(true)} disabled={!text.trim()}>
            Replace everything
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-base">Open a file</h3>
        <FileDrop
          onFiles={(files) => files[0] && importFile(files[0])}
          accept=".xlsx,.xls,.ods,.csv,.txt,.md,.json"
          multiple={false}
          icon="📊"
          title="Drop a spreadsheet, outline or saved project"
          hint="XLSX, XLS, ODS, CSV, TXT, MD or a DO101 project file"
        />
      </div>

      {error ? <ErrorState message={error} /> : null}
      {notes.length > 0 ? <SuccessNote>{notes.join(" ")}</SuccessNote> : null}

      <InfoNote>
        The hierarchy is read from whichever convention the file already uses: a WBS code column
        like 1.2.1, a column per level, a numeric level column, or indented task names.
      </InfoNote>
    </div>
  );
}
