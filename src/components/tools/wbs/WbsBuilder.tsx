"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { InfoNote } from "@/components/ui/Feedback";
import { writeLocal } from "@/lib/utils/storage";
import { useIsHydrated, useLocalValue } from "@/lib/utils/use-local";
import { track } from "@/lib/analytics";
import { formatValue } from "@/lib/wbs/fields";
import {
  addChild,
  addSibling,
  duplicateTask,
  findTask,
  flatten,
  indentTask,
  moveTask,
  moveTaskTo,
  newTask,
  outdentTask,
  removeTask,
  setAllCollapsed,
  setValue,
  stats,
  toggleCollapse,
  updateTask,
  visibleRows,
  type ChartSettings,
  type FieldValue,
  type GanttSettings,
  type NodeStyle,
  type WbsDoc,
  type WbsField,
  type WbsSettings,
  type WbsTask,
} from "@/lib/wbs/model";
import { createDoc, starterTasks, WBS_STORAGE_KEY } from "@/lib/wbs/templates";
import { prunePositions } from "@/lib/wbs/chart";
import { normaliseDoc } from "@/lib/wbs/import";
import { WbsChartPanel } from "./WbsChartPanel";
import { WbsGanttPanel } from "./WbsGanttPanel";
import { WbsLivePreview, type PreviewKind } from "./WbsLivePreview";
import { WbsSplit } from "./WbsSplit";
import { WbsColumnsPanel } from "./WbsColumnsPanel";
import { WbsExportPanel } from "./WbsExportPanel";
import { WbsGrid } from "./WbsGrid";
import { WbsStartPanel } from "./WbsStartPanel";

/** How the tool is laid out. Personal to this browser, not part of the document. */
interface ViewState {
  split: boolean;
  ratio: number;
  preview: PreviewKind;
}

const WBS_VIEW_KEY = "wbs-view";
// The sheet is the tool; the timeline is what is worth seeing beside it. The
// chart stays a tab of its own rather than the default second pane.
const DEFAULT_VIEW: ViewState = { split: true, ratio: 0.62, preview: "gantt" };

const TABS = [
  { id: "build", label: "Build" },
  { id: "chart", label: "Chart" },
  { id: "gantt", label: "Gantt" },
  { id: "columns", label: "Columns" },
  { id: "export", label: "Layout & export" },
  { id: "start", label: "Templates & import" },
];

/**
 * The WBS editor.
 *
 * State lives here and is saved to this browser's localStorage a moment after
 * each change — there is no account and no server, so the breakdown belongs to
 * this device and the project file is how it travels.
 */
export function WbsBuilder() {
  const hydrated = useIsHydrated();
  const [tab, setTab] = React.useState("build");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const reported = React.useRef(false);

  // The starter document is built once and kept, because a snapshot that
  // changed identity on every render would loop the external store below.
  const [starter] = React.useState<WbsDoc>(createDoc);

  // What this browser already had, read without an effect so the first client
  // render matches the server's.
  const stored = useLocalValue<unknown>(WBS_STORAGE_KEY, null);
  // Edits are held here as well as written to storage, so the editor still
  // works in a browser that refuses to store anything — private windows and
  // blocked site data would otherwise make typing look frozen.
  const [edited, setEdited] = React.useState<WbsDoc | null>(null);

  const doc = React.useMemo<WbsDoc>(() => {
    if (edited) return edited;
    // Whatever this browser has stored may predate any part of the document,
    // so it is normalised rather than trusted: a plan saved before the Gantt
    // existed would otherwise arrive without its settings and take the tool
    // down with it.
    return normaliseDoc(stored) ?? starter;
  }, [edited, stored, starter]);

  const setDoc = React.useCallback(
    (update: WbsDoc | ((current: WbsDoc) => WbsDoc)) => {
      const draft = typeof update === "function" ? update(doc) : update;
      const positions = prunePositions(draft.tasks, draft.chart.positions);
      const next =
        positions === draft.chart.positions
          ? draft
          : { ...draft, chart: { ...draft.chart, positions } };
      setEdited(next);
      writeLocal(WBS_STORAGE_KEY, next);
    },
    [doc],
  );

  const storedView = useLocalValue<Partial<ViewState> | null>(WBS_VIEW_KEY, null);
  const view: ViewState = {
    split: typeof storedView?.split === "boolean" ? storedView.split : DEFAULT_VIEW.split,
    ratio:
      typeof storedView?.ratio === "number"
        ? Math.min(0.75, Math.max(0.25, storedView.ratio))
        : DEFAULT_VIEW.ratio,
    preview:
      storedView?.preview === "sheet" || storedView?.preview === "chart"
        ? storedView.preview
        : DEFAULT_VIEW.preview,
  };
  const setView = (patch: Partial<ViewState>) => writeLocal(WBS_VIEW_KEY, { ...view, ...patch });

  const rows = React.useMemo(() => flatten(doc), [doc]);
  const shown = React.useMemo(() => visibleRows(rows), [rows]);
  const fields = React.useMemo(() => doc.fields.filter((field) => field.visible), [doc.fields]);
  const summary = React.useMemo(() => stats(doc), [doc]);
  const selected = selectedId ? findTask(doc.tasks, selectedId) : null;

  function edit(update: (tasks: WbsTask[]) => WbsTask[]) {
    setDoc((current) => ({ ...current, tasks: update(current.tasks) }));
    if (!reported.current) {
      reported.current = true;
      track("tool_complete", { tool: "wbs" });
    }
  }

  function settings(changes: Partial<WbsSettings>) {
    setDoc((current) => ({ ...current, settings: { ...current.settings, ...changes } }));
  }

  function ganttSettings(changes: Partial<GanttSettings>) {
    setDoc((current) => ({ ...current, gantt: { ...current.gantt, ...changes } }));
  }

  function chartSettings(changes: Partial<ChartSettings>) {
    setDoc((current) => ({ ...current, chart: { ...current.chart, ...changes } }));
  }

  /** A bar dragged on the timeline is a change to the date columns. */
  function setDates(id: string, dates: { start: string; end: string }) {
    edit((tasks) => {
      const withStart = setValue(tasks, id, doc.gantt.startFieldId, dates.start);
      return setValue(withStart, id, doc.gantt.endFieldId, dates.end);
    });
  }

  function styleTask(id: string, style: NodeStyle | undefined) {
    edit((tasks) => updateTask(tasks, id, { style }));
  }

  /** Remembers where a card was dropped, against the task it belongs to. */
  function placeTask(id: string, position: { x: number; y: number }) {
    setDoc((current) => ({
      ...current,
      chart: { ...current.chart, positions: { ...current.chart.positions, [id]: position } },
    }));
  }

  function addTask(parentId: string | null, afterId: string | null) {
    const task = newTask();
    edit((tasks) =>
      afterId ? addSibling(tasks, afterId, task) : addChild(tasks, parentId, task),
    );
    setSelectedId(task.id);
    setFocusId(task.id);
  }

  function addSubtask(id: string) {
    const task = newTask();
    edit((tasks) => addChild(tasks, id, task));
    setSelectedId(task.id);
    setFocusId(task.id);
  }

  function remove(id: string) {
    const index = shown.findIndex((row) => row.id === id);
    const next = shown[index + 1] ?? shown[index - 1] ?? null;
    edit((tasks) => removeTask(tasks, id));
    setSelectedId(next?.id ?? null);
  }

  function onKeyDown(id: string, event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      addTask(null, id);
      return;
    }
    if (!event.altKey) return;
    const actions: Record<string, () => void> = {
      ArrowUp: () => edit((tasks) => moveTask(tasks, id, -1)),
      ArrowDown: () => edit((tasks) => moveTask(tasks, id, 1)),
      ArrowRight: () => edit((tasks) => indentTask(tasks, id)),
      ArrowLeft: () => edit((tasks) => outdentTask(tasks, id)),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
    setFocusId(id);
    // The same row is re-focused after the move, so a run of keystrokes keeps
    // acting on the task the person is thinking about.
    window.setTimeout(() => setFocusId(null), 0);
  }

  if (!hydrated) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-bold text-[var(--muted)]">Opening the builder…</p>
      </Card>
    );
  }

  const panels = (
    <>
      {tab === "build" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => addTask(null, selectedId)}>
              + Task
            </Button>
            <Button
              size="sm"
              tone="sky"
              onClick={() => selectedId && addSubtask(selectedId)}
              disabled={!selectedId}
            >
              + Sub-task
            </Button>
            <Button
              size="sm"
              tone="panel"
              onClick={() => selectedId && edit((tasks) => outdentTask(tasks, selectedId))}
              disabled={!selectedId}
              aria-label="Promote a level"
            >
              ←
            </Button>
            <Button
              size="sm"
              tone="panel"
              onClick={() => selectedId && edit((tasks) => indentTask(tasks, selectedId))}
              disabled={!selectedId}
              aria-label="Demote a level"
            >
              →
            </Button>
            <Button
              size="sm"
              tone="panel"
              onClick={() => selectedId && edit((tasks) => moveTask(tasks, selectedId, -1))}
              disabled={!selectedId}
              aria-label="Move up"
            >
              ↑
            </Button>
            <Button
              size="sm"
              tone="panel"
              onClick={() => selectedId && edit((tasks) => moveTask(tasks, selectedId, 1))}
              disabled={!selectedId}
              aria-label="Move down"
            >
              ↓
            </Button>
            <Button
              size="sm"
              tone="panel"
              onClick={() => selectedId && edit((tasks) => duplicateTask(tasks, selectedId))}
              disabled={!selectedId}
            >
              Duplicate
            </Button>
            <Button
              size="sm"
              tone="cherry"
              onClick={() => selectedId && remove(selectedId)}
              disabled={!selectedId}
            >
              Delete
            </Button>
            <span className="flex-1" />
            <Button
              size="sm"
              tone="panel"
              onClick={() => edit((tasks) => setAllCollapsed(tasks, true))}
            >
              Collapse all
            </Button>
            <Button
              size="sm"
              tone="panel"
              onClick={() => edit((tasks) => setAllCollapsed(tasks, false))}
            >
              Expand all
            </Button>
          </div>

          <WbsGrid
            doc={doc}
            rows={shown}
            fields={fields}
            selectedId={selectedId}
            focusId={focusId}
            handlers={{
              onSelect: setSelectedId,
              onName: (id, name) => edit((tasks) => updateTask(tasks, id, { name })),
              onValue: (id: string, fieldId: string, value: FieldValue) =>
                edit((tasks) => setValue(tasks, id, fieldId, value)),
              onToggle: (id) => edit((tasks) => toggleCollapse(tasks, id)),
              onKeyDown,
              onReorder: (id, targetId, position) =>
                edit((tasks) => moveTaskTo(tasks, id, targetId, position)),
              onResizeField: (fieldId, chars) =>
                setDoc((current) => ({
                  ...current,
                  fields: current.fields.map((field) =>
                    field.id === fieldId
                      ? { ...field, width: Math.min(80, Math.max(4, chars)) }
                      : field,
                  ),
                })),
              onResizeColumn: (column, px) =>
                settings(
                  column === "code"
                    ? { codeWidth: Math.min(320, Math.max(70, px)) }
                    : { nameWidth: Math.min(640, Math.max(140, px)) },
                ),
            }}
            height={view.split ? 460 : 560}
          />

          <p className="text-xs font-semibold text-[var(--muted)]">
            Enter adds a task below. Alt with the arrow keys moves the selected task up, down, or
            in and out a level. Summary rows show totals rolled up from the work packages beneath
            them.
          </p>

          {selected ? (
            <Card className="p-4">
              <Label htmlFor="wbs-description" hint="goes on the dictionary sheet">
                Description for “{selected.name || "this task"}”
              </Label>
              <Textarea
                id="wbs-description"
                value={selected.description}
                placeholder="Scope, deliverable and acceptance criteria."
                className="min-h-[90px]"
                onChange={(event) =>
                  edit((tasks) =>
                    updateTask(tasks, selected.id, { description: event.target.value }),
                  )
                }
              />
            </Card>
          ) : (
            <InfoNote icon="💡">
              Select a task to add its dictionary description, or to move it around with the
              buttons above.
            </InfoNote>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {confirmClear ? (
              <>
                <span className="text-sm font-bold">Clear the whole breakdown?</span>
                <Button
                  size="sm"
                  tone="cherry"
                  onClick={() => {
                    setDoc((current) => ({ ...current, tasks: starterTasks() }));
                    setSelectedId(null);
                    setConfirmClear(false);
                  }}
                >
                  Yes, start again
                </Button>
                <Button size="sm" tone="panel" onClick={() => setConfirmClear(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button size="sm" tone="ghost" onClick={() => setConfirmClear(true)}>
                Start again
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {tab === "chart" ? (
        <WbsChartPanel
          doc={doc}
          rows={rows}
          selectedId={selectedId}
          selectedTask={selected}
          onSelect={setSelectedId}
          onChartSettings={chartSettings}
          onStyle={styleTask}
          onRename={(id, name) => edit((tasks) => updateTask(tasks, id, { name }))}
          onToggle={(id) => edit((tasks) => toggleCollapse(tasks, id))}
          onMove={placeTask}
          onAddChild={addSubtask}
          onAddSibling={(id) => addTask(null, id)}
          onDelete={remove}
        />
      ) : null}

      {tab === "gantt" ? (
        <WbsGanttPanel
          doc={doc}
          rows={shown}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onGantt={ganttSettings}
          onDates={setDates}
          height={view.split ? 420 : 520}
        />
      ) : null}

      {tab === "columns" ? (
        <WbsColumnsPanel
          fields={doc.fields}
          onChange={(next: WbsField[]) =>
            setDoc((current) => ({
              ...current,
              fields: next,
              settings: {
                ...current.settings,
                // A weight column that has just been deleted would silently
                // turn every weighted roll-up into an equal average.
                weightFieldId: next.some((field) => field.id === current.settings.weightFieldId)
                  ? current.settings.weightFieldId
                  : null,
              },
            }))
          }
        />
      ) : null}

      {tab === "export" ? <WbsExportPanel doc={doc} onSettings={settings} /> : null}

      {tab === "start" ? (
        <WbsStartPanel
          fields={doc.fields}
          onReplace={(tasks) => {
            setDoc((current) => ({ ...current, tasks }));
            setSelectedId(null);
            setTab("build");
          }}
          onAppend={(tasks) => {
            setDoc((current) => ({ ...current, tasks: [...current.tasks, ...tasks] }));
            setTab("build");
          }}
          onDocument={(next) => {
            setDoc(next);
            setSelectedId(null);
            setTab("build");
          }}
          onImportTable={(tasks, importedFields, projectName) => {
            setDoc((current) => ({
              ...current,
              fields: importedFields,
              tasks,
              settings: { ...current.settings, projectName },
            }));
            setSelectedId(null);
            setTab("build");
          }}
        />
      ) : null}
    </>
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor="wbs-project">Project name</Label>
            <Input
              id="wbs-project"
              value={doc.settings.projectName}
              onChange={(event) => settings({ projectName: event.target.value })}
              placeholder="New project"
            />
          </div>
          <dl className="flex flex-wrap gap-4 pb-1">
            <div>
              <dt className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Tasks
              </dt>
              <dd className="text-lg font-extrabold">{summary.tasks}</dd>
            </div>
            <div>
              <dt className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Work packages
              </dt>
              <dd className="text-lg font-extrabold">{summary.workPackages}</dd>
            </div>
            <div>
              <dt className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Levels
              </dt>
              <dd className="text-lg font-extrabold">{summary.depth}</dd>
            </div>
            {doc.fields
              .filter((field) => field.rollup === "sum" && field.visible)
              .slice(0, 2)
              .map((field) => (
                <div key={field.id}>
                  <dt className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                    {field.label}
                  </dt>
                  <dd className="text-lg font-extrabold">
                    {formatValue(summary.totals[field.id] ?? 0, field, doc.settings)}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          items={TABS}
          value={tab}
          onChange={setTab}
          ariaLabel="WBS builder sections"
          className="flex-1"
        />
        <Button
          size="sm"
          tone={view.split ? "sky" : "panel"}
          aria-pressed={view.split}
          onClick={() => setView({ split: !view.split })}
        >
          {view.split ? "Split view on" : "Split view"}
        </Button>
      </div>

      {view.split ? (
        <WbsSplit
          ratio={view.ratio}
          onRatio={(ratio) => setView({ ratio })}
          leftLabel="Breakdown editor"
          rightLabel="Live preview"
          left={<div className="space-y-4">{panels}</div>}
          right={
            <WbsLivePreview
              doc={doc}
              rows={rows}
              kind={view.preview}
              onKind={(preview) => setView({ preview })}
              editing={tab === "chart" ? "chart" : tab === "gantt" ? "gantt" : null}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRename={(id, name) => edit((tasks) => updateTask(tasks, id, { name }))}
              onToggle={(id) => edit((tasks) => toggleCollapse(tasks, id))}
              onMove={placeTask}
              onAddChild={addSubtask}
              onAddSibling={(id) => addTask(null, id)}
              onDelete={remove}
              onDates={setDates}
            />
          }
        />
      ) : (
        panels
      )}
    </div>
  );
}
