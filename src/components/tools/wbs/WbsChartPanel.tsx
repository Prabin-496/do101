"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select, Toggle } from "@/components/ui/Field";
import { ErrorState, InfoNote } from "@/components/ui/Feedback";
import { cn } from "@/lib/utils/cn";
import { copyPngToClipboard, downloadJson, downloadPng, downloadSvg } from "@/lib/diagram/download";
import { PALETTES, paletteFor, wbsToDiagram } from "@/lib/wbs/chart";
import { CHART_SHAPES, type ChartSettings, type NodeStyle, type WbsDoc, type WbsRow, type WbsTask } from "@/lib/wbs/model";
import { track } from "@/lib/analytics";
import { WbsChart } from "./WbsChart";

const ORIENTATIONS: { id: ChartSettings["orientation"]; label: string; hint: string }[] = [
  { id: "down", label: "Top down", hint: "The classic org-chart WBS" },
  { id: "right", label: "Left to right", hint: "Better when the tree is deep" },
  { id: "stacked", label: "Indented", hint: "A bracket list, one task per row" },
];

const SHAPE_LABELS: Record<(typeof CHART_SHAPES)[number], string> = {
  rounded: "Rounded box",
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  hexagon: "Hexagon",
  note: "Note",
  document: "Document",
  parallelogram: "Parallelogram",
};

const ROUTINGS: { id: ChartSettings["routing"]; label: string }[] = [
  { id: "orthogonal", label: "Elbow" },
  { id: "curved", label: "Curved" },
  { id: "straight", label: "Straight" },
];

/**
 * The chart tab: a canvas, the knobs that shape it, and the ways out.
 *
 * Everything is drawn from one diagram, so the picture, the PNG, the SVG and
 * the file that opens in the diagram maker never disagree.
 */
export function WbsChartPanel({
  doc,
  rows,
  selectedId,
  selectedTask,
  onSelect,
  onChartSettings,
  onStyle,
  onRename,
  onToggle,
  onMove,
  onAddChild,
  onAddSibling,
  onDelete,
}: {
  doc: WbsDoc;
  rows: WbsRow[];
  selectedId: string | null;
  selectedTask: WbsTask | null;
  onSelect: (id: string | null) => void;
  onChartSettings: (changes: Partial<ChartSettings>) => void;
  onStyle: (id: string, style: NodeStyle | undefined) => void;
  onRename: (id: string, name: string) => void;
  onToggle: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onAddChild: (id: string) => void;
  onAddSibling: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const chart = React.useMemo(() => wbsToDiagram(doc, rows), [doc, rows]);
  const palette = paletteFor(doc.chart.palette);
  const placed = Object.keys(doc.chart.positions).length;
  const choiceFields = doc.fields.filter((field) => field.type === "select");

  async function withBusy(work: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await work();
      track("tool_complete", { tool: "wbs", format: "chart" });
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <WbsChart
        chart={chart}
        snap={doc.chart.snap}
        selectedId={selectedId}
        onSelect={onSelect}
        onRename={onRename}
        onToggle={onToggle}
        onMove={onMove}
        onAddChild={onAddChild}
        onAddSibling={onAddSibling}
        onDelete={onDelete}
        height={540}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            withBusy(
              () => downloadPng(chart.diagram, 2),
              "The image could not be made in this browser. The SVG download still works.",
            )
          }
          disabled={busy}
        >
          {busy ? "Rendering…" : "Download PNG"}
        </Button>
        <Button tone="sky" onClick={() => downloadSvg(chart.diagram)}>
          Download SVG
        </Button>
        <Button
          tone="panel"
          onClick={() =>
            withBusy(async () => {
              await copyPngToClipboard(chart.diagram, 2);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }, "This browser blocked the clipboard. Download the PNG instead.")
          }
          disabled={busy}
        >
          {copied ? "Copied" : "Copy image"}
        </Button>
        <Button tone="panel" onClick={() => downloadJson(chart.diagram)}>
          Send to Canvas
        </Button>
        {placed > 0 ? (
          <Button tone="ghost" onClick={() => onChartSettings({ positions: {} })}>
            Auto-layout ({placed} moved)
          </Button>
        ) : null}
      </div>

      {error ? <ErrorState message={error} /> : null}

      <InfoNote icon="🎨">
        The chart is drawn and exported in your browser. “Send to Canvas” saves a diagram file
        you can open in the{" "}
        <a className="underline" href="/tools/canvas">
          canvas
        </a>{" "}
        to add free-form shapes, arrows and notes — the WBS itself stays here, where the codes and
        the Excel export live.
      </InfoNote>

      {selectedTask ? (
        <Card className="p-4">
          <h3 className="mb-3 text-base">Style for “{selectedTask.name || "this task"}”</h3>
          <div className="flex flex-wrap items-center gap-2">
            {palette.swatches.map((swatch) => (
              <button
                key={swatch.fill}
                type="button"
                aria-label={`Use the ${swatch.stroke} colour`}
                onClick={() =>
                  onStyle(selectedTask.id, {
                    ...selectedTask.style,
                    fill: swatch.fill,
                    stroke: swatch.stroke,
                  })
                }
                className={cn(
                  "h-9 w-9 rounded-xl border-2",
                  selectedTask.style?.fill === swatch.fill
                    ? "ring-2 ring-[var(--sky)] ring-offset-2"
                    : "",
                )}
                style={{ background: swatch.fill, borderColor: swatch.stroke }}
              />
            ))}
            <div className="min-w-[10rem]">
              <Select
                aria-label="Shape for this task"
                value={selectedTask.style?.shape ?? ""}
                onChange={(event) =>
                  onStyle(selectedTask.id, {
                    ...selectedTask.style,
                    shape: (event.target.value || undefined) as NodeStyle["shape"],
                  })
                }
              >
                <option value="">Shape: follow the theme</option>
                {CHART_SHAPES.map((shape) => (
                  <option key={shape} value={shape}>
                    {SHAPE_LABELS[shape]}
                  </option>
                ))}
              </Select>
            </div>
            {selectedTask.style ? (
              <Button size="sm" tone="panel" onClick={() => onStyle(selectedTask.id, undefined)}>
                Reset
              </Button>
            ) : null}
          </div>
        </Card>
      ) : (
        <InfoNote icon="💡">
          Click a card to style it on its own, drag it to place it by hand, or double-click to
          rename it. Everything else follows the theme below.
        </InfoNote>
      )}

      <Card className="p-4">
        <h3 className="mb-3 text-base">Shape of the chart</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="wbs-orientation">Direction</Label>
            <Select
              id="wbs-orientation"
              value={doc.chart.orientation}
              onChange={(event) =>
                onChartSettings({
                  orientation: event.target.value as ChartSettings["orientation"],
                  // Hand-placed cards are meaningless in a new direction.
                  positions: {},
                })
              }
            >
              {ORIENTATIONS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label} — {entry.hint}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="wbs-node-shape">Card shape</Label>
            <Select
              id="wbs-node-shape"
              value={doc.chart.shape}
              onChange={(event) =>
                onChartSettings({ shape: event.target.value as ChartSettings["shape"] })
              }
            >
              {CHART_SHAPES.map((shape) => (
                <option key={shape} value={shape}>
                  {SHAPE_LABELS[shape]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="wbs-routing">Connector</Label>
            <Select
              id="wbs-routing"
              value={doc.chart.routing}
              onChange={(event) =>
                onChartSettings({ routing: event.target.value as ChartSettings["routing"] })
              }
            >
              {ROUTINGS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="wbs-palette">Colour theme</Label>
            <Select
              id="wbs-palette"
              value={doc.chart.palette}
              onChange={(event) => onChartSettings({ palette: event.target.value })}
            >
              {PALETTES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="wbs-colour-by">Colour cards by</Label>
            <Select
              id="wbs-colour-by"
              value={doc.chart.colourBy}
              onChange={(event) =>
                onChartSettings({ colourBy: event.target.value as ChartSettings["colourBy"] })
              }
            >
              <option value="level">Level</option>
              <option value="branch">Top-level branch</option>
              <option value="field">A choice column</option>
              <option value="flat">One colour</option>
            </Select>
          </div>
          {doc.chart.colourBy === "field" ? (
            <div>
              <Label htmlFor="wbs-colour-field">Column</Label>
              <Select
                id="wbs-colour-field"
                value={doc.chart.colourFieldId ?? ""}
                onChange={(event) => onChartSettings({ colourFieldId: event.target.value || null })}
              >
                <option value="">Pick a column</option>
                {choiceFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {(
            [
              ["nodeWidth", "Card width", 120, 420],
              ["nodeHeight", "Card height", 48, 220],
              ["siblingGap", "Gap between cards", 8, 160],
              ["levelGap", "Gap between levels", 24, 240],
            ] as const
          ).map(([key, label, min, max]) => (
            <div key={key}>
              <Label htmlFor={`wbs-${key}`} hint="px">
                {label}
              </Label>
              <Input
                id={`wbs-${key}`}
                type="number"
                min={min}
                max={max}
                value={doc.chart[key]}
                onChange={(event) =>
                  onChartSettings({
                    [key]: Math.min(max, Math.max(min, Number(event.target.value) || min)),
                  } as Partial<ChartSettings>)
                }
              />
            </div>
          ))}
          <div>
            <Label htmlFor="wbs-font" hint="px">
              Text size
            </Label>
            <Input
              id="wbs-font"
              type="number"
              min={9}
              max={28}
              value={doc.chart.fontSize}
              onChange={(event) =>
                onChartSettings({
                  fontSize: Math.min(28, Math.max(9, Number(event.target.value) || 13)),
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="wbs-snap" hint="0 = off">
              Snap grid
            </Label>
            <Input
              id="wbs-snap"
              type="number"
              min={0}
              max={50}
              value={doc.chart.snap}
              onChange={(event) =>
                onChartSettings({ snap: Math.min(50, Math.max(0, Number(event.target.value) || 0)) })
              }
            />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-base">What the cards show</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <Toggle
            checked={doc.chart.showCode}
            onChange={(value) => onChartSettings({ showCode: value })}
            label="WBS codes"
          />
          <Toggle
            checked={doc.chart.showRoot}
            onChange={(value) => onChartSettings({ showRoot: value })}
            label="A card for the project"
          />
          <Toggle
            checked={doc.chart.arrows}
            onChange={(value) => onChartSettings({ arrows: value })}
            label="Arrowheads"
          />
        </div>

        <div className="mt-4">
          <Label>Columns printed on each card</Label>
          <div className="flex flex-wrap gap-2">
            {doc.fields.map((field) => {
              const on = doc.chart.showFields.includes(field.id);
              return (
                <button
                  key={field.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onChartSettings({
                      showFields: on
                        ? doc.chart.showFields.filter((id) => id !== field.id)
                        : [...doc.chart.showFields, field.id],
                    })
                  }
                  className={cn(
                    "rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold",
                    on
                      ? "border-[var(--grass)] bg-[var(--grass-soft)]"
                      : "border-[var(--border)] hover:bg-[var(--panel)]",
                  )}
                >
                  {field.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
            Each column adds a line to every card, and the cards grow to fit.
          </p>
        </div>
      </Card>
    </div>
  );
}
