import * as React from "react";

/**
 * Tools that can run inside a workspace pane.
 *
 * Only tools that are useful in a narrow column and hold no full-screen state
 * belong here. Each one is loaded on demand, so opening the workspace does not
 * download every tool on the site — a pane costs nothing until it is chosen.
 */

export type PaneId =
  | "empty"
  | "notes"
  | "japanese-translator"
  | "kana-converter"
  | "calendar"
  | "excel-shortcuts"
  | "grammar-checker"
  | "paraphrasing-tool"
  | "readability-checker"
  | "tone-checker"
  | "citation-generator"
  | "text-similarity-checker";

export interface PaneDefinition {
  id: PaneId;
  name: string;
  icon: string;
  /** Where the full-size version lives. */
  route?: string;
  group: "Write" | "Study" | "Language" | "Organise";
  load: () => Promise<{ default: React.ComponentType }>;
}

/** A named default export keeps every lazy chunk shaped the same way. */
const named = <T extends Record<string, React.ComponentType>>(
  loader: () => Promise<T>,
  key: keyof T,
) => async () => {
  const mod = await loader();
  return { default: mod[key] };
};

export const PANES: PaneDefinition[] = [
  {
    id: "notes",
    name: "Notes",
    icon: "🗒️",
    route: "/tools/notes",
    group: "Organise",
    load: named(
      () => import("@/components/tools/notes/NotesApp"),
      "NotesApp",
    ),
  },
  {
    id: "japanese-translator",
    name: "Japanese Translator",
    icon: "🇯🇵",
    route: "/tools/japanese-translator",
    group: "Language",
    load: named(
      () => import("@/components/tools/japanese/JapaneseTranslator"),
      "JapaneseTranslator",
    ),
  },
  {
    id: "kana-converter",
    name: "Romaji & Kana",
    icon: "あ",
    route: "/tools/romaji-converter",
    group: "Language",
    load: named(
      () => import("@/components/tools/japanese/KanaConverter"),
      "KanaConverter",
    ),
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: "📅",
    route: "/tools/calendar",
    group: "Organise",
    load: named(
      () => import("@/components/tools/calendar/CalendarTool"),
      "CalendarTool",
    ),
  },
  {
    id: "excel-shortcuts",
    name: "Excel Shortcuts",
    icon: "⌨️",
    route: "/tools/excel-shortcuts",
    group: "Organise",
    load: named(
      () => import("@/components/tools/excel/ExcelShortcuts"),
      "ExcelShortcuts",
    ),
  },
  {
    id: "grammar-checker",
    name: "Grammar Checker",
    icon: "✅",
    route: "/tools/grammar-checker",
    group: "Write",
    load: named(
      () => import("@/components/tools/writing/WritingChecker"),
      "WritingChecker",
    ),
  },
  {
    id: "paraphrasing-tool",
    name: "Paraphraser",
    icon: "✂️",
    route: "/tools/paraphrasing-tool",
    group: "Write",
    load: named(
      () => import("@/components/tools/writing/Paraphraser"),
      "Paraphraser",
    ),
  },
  {
    id: "readability-checker",
    name: "Readability",
    icon: "📊",
    route: "/tools/readability-checker",
    group: "Write",
    load: named(
      () => import("@/components/tools/writing/ReadabilityAnalyser"),
      "ReadabilityAnalyser",
    ),
  },
  {
    id: "tone-checker",
    name: "Tone Checker",
    icon: "🎭",
    route: "/tools/tone-checker",
    group: "Write",
    load: named(
      () => import("@/components/tools/writing/ToneChecker"),
      "ToneChecker",
    ),
  },
  {
    id: "citation-generator",
    name: "Citations",
    icon: "📚",
    route: "/tools/citation-generator",
    group: "Study",
    load: named(
      () => import("@/components/tools/writing/CitationGenerator"),
      "CitationGenerator",
    ),
  },
  {
    id: "text-similarity-checker",
    name: "Similarity Checker",
    icon: "🔍",
    route: "/tools/text-similarity-checker",
    group: "Study",
    load: named(
      () => import("@/components/tools/writing/SimilarityChecker"),
      "SimilarityChecker",
    ),
  },
];

export const PANE_MAP = new Map<PaneId, PaneDefinition>(PANES.map((pane) => [pane.id, pane]));

export const PANE_GROUPS = ["Write", "Study", "Language", "Organise"] as const;

export type LayoutId = "single" | "two-columns" | "three-columns" | "two-rows" | "grid";

export interface LayoutDefinition {
  id: LayoutId;
  name: string;
  /** Drawn as a tiny diagram in the picker. */
  cells: number;
  direction: "row" | "column" | "grid";
  icon: string;
}

export const LAYOUTS: LayoutDefinition[] = [
  { id: "single", name: "One tool", cells: 1, direction: "row", icon: "▭" },
  { id: "two-columns", name: "Side by side", cells: 2, direction: "row", icon: "▯▯" },
  { id: "three-columns", name: "Three columns", cells: 3, direction: "row", icon: "▯▯▯" },
  { id: "two-rows", name: "Stacked", cells: 2, direction: "column", icon: "☰" },
  { id: "grid", name: "Four panes", cells: 4, direction: "grid", icon: "⊞" },
];

export const LAYOUT_MAP = new Map<LayoutId, LayoutDefinition>(
  LAYOUTS.map((layout) => [layout.id, layout]),
);

export interface WorkspaceState {
  layout: LayoutId;
  panes: PaneId[];
  /** Relative sizes of the panes along the split axis. */
  sizes: number[];
  compact: boolean;
}

export const DEFAULT_WORKSPACE: WorkspaceState = {
  layout: "two-columns",
  panes: ["japanese-translator", "notes", "empty", "empty"],
  sizes: [1, 1, 1, 1],
  compact: false,
};

/** Guards against a stored layout from an older version of the tool. */
export function normalise(state: Partial<WorkspaceState> | null): WorkspaceState {
  const layout = LAYOUT_MAP.has(state?.layout as LayoutId)
    ? (state!.layout as LayoutId)
    : DEFAULT_WORKSPACE.layout;
  const cells = LAYOUT_MAP.get(layout)!.cells;

  const panes: PaneId[] = [];
  for (let i = 0; i < 4; i += 1) {
    const candidate = state?.panes?.[i];
    panes.push(candidate === "empty" || PANE_MAP.has(candidate as PaneId) ? (candidate as PaneId) : "empty");
  }

  const sizes = Array.from({ length: 4 }, (_, i) => {
    const value = state?.sizes?.[i];
    return typeof value === "number" && value > 0.15 && value < 4 ? value : 1;
  });

  // A layout with more cells than chosen tools still needs every slot filled.
  for (let i = 0; i < cells; i += 1) {
    if (!panes[i]) panes[i] = "empty";
  }

  return { layout, panes, sizes, compact: state?.compact === true };
}
