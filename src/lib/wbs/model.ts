/**
 * Work Breakdown Structure model.
 *
 * A WBS is a tree of tasks plus a customisable set of columns. Everything in
 * this file is pure: tree edits return new trees, roll-ups are derived rather
 * than stored, and nothing touches the browser. That is what lets the
 * numbering and the totals be tested directly, and keeps the editor a thin
 * layer over the model.
 */

export type FieldType = "text" | "number" | "currency" | "percent" | "date" | "select";

/** How a summary task derives its value from the work packages beneath it. */
export type Rollup = "none" | "sum" | "min" | "max" | "average" | "weighted";

export type FieldValue = string | number | null;

export interface WbsField {
  id: string;
  label: string;
  type: FieldType;
  rollup: Rollup;
  /** Choices for a select column. */
  options?: string[];
  /** Column width in characters, used by the Excel export. */
  width: number;
  visible: boolean;
  /** Built-in columns can be renamed and hidden, but not deleted. */
  builtin?: boolean;
}

export interface WbsTask {
  id: string;
  name: string;
  /** The WBS dictionary entry: scope, acceptance criteria, assumptions. */
  description: string;
  values: Record<string, FieldValue>;
  children: WbsTask[];
  collapsed?: boolean;
  /** Per-node overrides set on the chart. Absent means "follow the theme". */
  style?: NodeStyle;
}

/**
 * Chart appearance for one task. The names match the diagram library's shape
 * vocabulary, so a styled node survives the trip out to the diagram editor.
 */
export interface NodeStyle {
  fill?: string;
  stroke?: string;
  shape?: ChartShape;
}

export type ChartShape =
  | "rounded"
  | "rectangle"
  | "ellipse"
  | "hexagon"
  | "note"
  | "document"
  | "parallelogram";

export const CHART_SHAPES: ChartShape[] = [
  "rounded",
  "rectangle",
  "ellipse",
  "hexagon",
  "note",
  "document",
  "parallelogram",
];

export type ChartOrientation = "down" | "right" | "stacked";
export type ChartRouting = "orthogonal" | "curved" | "straight";
export type ChartColouring = "level" | "branch" | "field" | "flat";

export interface ChartSettings {
  /** Which way the tree grows. "stacked" is the indented bracket look. */
  orientation: ChartOrientation;
  shape: ChartShape;
  routing: ChartRouting;
  palette: string;
  colourBy: ChartColouring;
  /** The choice column whose values pick a colour, when colouring by field. */
  colourFieldId: string | null;
  nodeWidth: number;
  nodeHeight: number;
  /** Gap between siblings, and between one level and the next. */
  siblingGap: number;
  levelGap: number;
  fontSize: number;
  showCode: boolean;
  /** Columns printed on the card under the task name. */
  showFields: string[];
  arrows: boolean;
  /** A node for the project itself, above the top-level branches. */
  showRoot: boolean;
  /** Grid size a dragged node snaps to. 0 turns snapping off. */
  snap: number;
  /** Positions set by dragging. Auto-layout clears them. */
  positions: Record<string, { x: number; y: number }>;
}

export type NumberingStyle = "decimal" | "outline" | "alpha" | "flat";

export interface NumberingOptions {
  style: NumberingStyle;
  /** Prepended to every code, e.g. "PRJ-". */
  prefix: string;
  separator: string;
  /** Zero-pad each segment to this width. 0 leaves numbers unpadded. */
  pad: number;
  startAt: number;
}

export interface WbsSettings {
  projectName: string;
  numbering: NumberingOptions;
  /** Structure columns written alongside the task name. */
  showCode: boolean;
  showLevel: boolean;
  showParent: boolean;
  showType: boolean;
  /**
   * How the task name is laid out: indented in one column, spread across one
   * column per level (the classic spreadsheet WBS), or flat.
   */
  nameLayout: "indent" | "levels" | "plain";
  indentUnit: string;
  currencySymbol: string;
  /** Excel number format for date columns. */
  dateFormat: string;
  /** Write =SUM()/=MIN()/=MAX() into summary rows instead of static numbers. */
  liveFormulas: boolean;
  /** Emit Excel outline levels so summary rows collapse with +/-. */
  groupRows: boolean;
  includeDictionary: boolean;
  includeSummary: boolean;
  /** Field whose values weight the "weighted" roll-up. null = equal weight. */
  weightFieldId: string | null;
}

export type GanttScale = "day" | "week" | "month" | "quarter";

export interface GanttSettings {
  scale: GanttScale;
  /** Which columns hold the dates. Any date column can be used. */
  startFieldId: string;
  endFieldId: string;
  progressFieldId: string | null;
  showProgress: boolean;
  showToday: boolean;
  /** Shades Saturdays and Sundays. Only meaningful at the day scale. */
  showWeekends: boolean;
  /** A bar drawn with block characters, which survives a copy and paste. */
  showTextBar: boolean;
  barWidth: number;
  colourBy: ChartColouring;
  colourFieldId: string | null;
  /** Pin the timeline to these dates instead of fitting the work. */
  rangeStart: string | null;
  rangeEnd: string | null;
  /** Columns shown beside the task name. */
  showFields: string[];
  /** Adds a Gantt sheet to the Excel download. */
  includeInWorkbook: boolean;
}

export interface WbsDoc {
  version: 1;
  settings: WbsSettings;
  chart: ChartSettings;
  gantt: GanttSettings;
  fields: WbsField[];
  tasks: WbsTask[];
}

/* ---------------------------- construction ---------------------------- */

let counter = 0;

export function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newTask(name = "", values: Record<string, FieldValue> = {}): WbsTask {
  return { id: newId(), name, description: "", values, children: [] };
}

/* ------------------------------ numbering ------------------------------ */

const ROMAN: ReadonlyArray<readonly [number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
  if (n < 1) return String(n);
  let left = Math.floor(n);
  let out = "";
  for (const [value, numeral] of ROMAN) {
    while (left >= value) {
      out += numeral;
      left -= value;
    }
  }
  return out;
}

/** 1 → A, 26 → Z, 27 → AA. */
export function toAlpha(n: number): string {
  if (n < 1) return String(n);
  let left = Math.floor(n);
  let out = "";
  while (left > 0) {
    const rem = (left - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    left = Math.floor((left - 1) / 26);
  }
  return out;
}

function padNumber(n: number, pad: number): string {
  return pad > 0 ? String(n).padStart(pad, "0") : String(n);
}

/** The segment for one level of a code, before ancestors are joined on. */
export function codeSegment(
  style: NumberingStyle,
  level: number,
  position: number,
  pad: number,
): string {
  switch (style) {
    case "alpha":
      return level === 1 ? toAlpha(position) : padNumber(position, pad);
    case "outline":
      // Cycles the way outlines are conventionally numbered: I, A, 1, a, i.
      switch (level % 5) {
        case 1: return toRoman(position);
        case 2: return toAlpha(position);
        case 3: return padNumber(position, pad);
        case 4: return toAlpha(position).toLowerCase();
        default: return toRoman(position).toLowerCase();
      }
    case "decimal":
    case "flat":
    default:
      return padNumber(position, pad);
  }
}

/* ------------------------------ roll-ups ------------------------------ */

export function asNumber(value: FieldValue): number | null {
  if (value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isBlank(value: FieldValue): boolean {
  return value === null || value === undefined || value === "";
}

/** Numeric where possible, lexical otherwise — which is why dates are ISO. */
function compareValues(a: FieldValue, b: FieldValue): number {
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na - nb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function aggregate(
  rollup: Rollup,
  childValues: FieldValue[],
  childWeights: number[],
): FieldValue {
  const present = childValues.filter((v) => !isBlank(v));
  if (present.length === 0) return null;

  switch (rollup) {
    case "sum": {
      const numbers = present.map(asNumber).filter((n): n is number => n !== null);
      if (numbers.length === 0) return null;
      return round(numbers.reduce((total, n) => total + n, 0));
    }
    case "average": {
      const numbers = present.map(asNumber).filter((n): n is number => n !== null);
      if (numbers.length === 0) return null;
      return round(numbers.reduce((total, n) => total + n, 0) / numbers.length);
    }
    case "min":
      return present.reduce((best, v) => (compareValues(v, best) < 0 ? v : best));
    case "max":
      return present.reduce((best, v) => (compareValues(v, best) > 0 ? v : best));
    case "weighted": {
      let weighted = 0;
      let weight = 0;
      childValues.forEach((value, i) => {
        const n = asNumber(value);
        if (n === null) return;
        // A zero or missing weight would silently drop the child, so an
        // unweighted child counts as one unit rather than nothing.
        const w = childWeights[i] > 0 ? childWeights[i] : 1;
        weighted += n * w;
        weight += w;
      });
      if (weight === 0) return null;
      return round(weighted / weight);
    }
    default:
      return null;
  }
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Effective values for every task: entered values on work packages, derived
 * values on summary tasks. Computed bottom-up in a single pass.
 */
export function computeValues(
  tasks: WbsTask[],
  fields: WbsField[],
  weightFieldId: string | null,
): Map<string, Record<string, FieldValue>> {
  const result = new Map<string, Record<string, FieldValue>>();

  const visit = (task: WbsTask): Record<string, FieldValue> => {
    const childValues = task.children.map(visit);
    const own = task.values ?? {};
    const effective: Record<string, FieldValue> = {};

    const weights = childValues.map((child) => {
      if (!weightFieldId) return 1;
      return asNumber(child[weightFieldId] ?? null) ?? 0;
    });

    for (const field of fields) {
      const entered = own[field.id] ?? null;
      if (task.children.length === 0 || field.rollup === "none") {
        effective[field.id] = entered;
        continue;
      }
      const derived = aggregate(
        field.rollup,
        childValues.map((child) => child[field.id] ?? null),
        weights,
      );
      // An entered value still wins when nothing beneath it has one.
      effective[field.id] = derived === null ? entered : derived;
    }

    result.set(task.id, effective);
    return effective;
  };

  tasks.forEach(visit);
  return result;
}

/* ------------------------------ flattening ------------------------------ */

export interface WbsRow {
  id: string;
  code: string;
  level: number;
  name: string;
  description: string;
  isSummary: boolean;
  parentId: string | null;
  parentCode: string;
  /** Indexes into the flattened array — how Excel formulas find their inputs. */
  childRows: number[];
  /** Effective (rolled-up) values. */
  values: Record<string, FieldValue>;
  /** Values as entered on this task, before any roll-up. */
  own: Record<string, FieldValue>;
  collapsed: boolean;
  /** Whether an ancestor is collapsed, i.e. the row is hidden in the editor. */
  hidden: boolean;
}

export function flatten(doc: WbsDoc): WbsRow[] {
  const values = computeValues(doc.tasks, doc.fields, doc.settings.weightFieldId);
  const { style, prefix, separator, pad, startAt } = doc.settings.numbering;
  const rows: WbsRow[] = [];
  let flatCounter = startAt - 1;

  const walk = (
    task: WbsTask,
    level: number,
    position: number,
    ancestors: string[],
    parent: WbsRow | null,
    hidden: boolean,
  ): number => {
    const segments = [...ancestors, codeSegment(style, level, position, pad)];
    let code: string;
    if (style === "flat") {
      flatCounter += 1;
      code = `${prefix}${padNumber(flatCounter, pad)}`;
    } else {
      code = prefix + segments.join(separator);
    }

    const row: WbsRow = {
      id: task.id,
      code,
      level,
      name: task.name,
      description: task.description ?? "",
      isSummary: task.children.length > 0,
      parentId: parent?.id ?? null,
      parentCode: parent?.code ?? "",
      childRows: [],
      values: values.get(task.id) ?? {},
      own: task.values ?? {},
      collapsed: Boolean(task.collapsed),
      hidden,
    };
    const index = rows.length;
    rows.push(row);
    if (parent) parent.childRows.push(index);

    task.children.forEach((child, i) => {
      walk(
        child,
        level + 1,
        startAt + i,
        segments,
        row,
        hidden || Boolean(task.collapsed),
      );
    });
    return index;
  };

  doc.tasks.forEach((task, i) => walk(task, 1, startAt + i, [], null, false));
  return rows;
}

export function visibleRows(rows: WbsRow[]): WbsRow[] {
  return rows.filter((row) => !row.hidden);
}

export function maxDepth(tasks: WbsTask[]): number {
  const depth = (list: WbsTask[]): number =>
    list.reduce((deepest, task) => Math.max(deepest, 1 + depth(task.children)), 0);
  return depth(tasks);
}

export function countTasks(tasks: WbsTask[]): number {
  return tasks.reduce((total, task) => total + 1 + countTasks(task.children), 0);
}

/* ---------------------------- tree editing ---------------------------- */

type Mapper = (task: WbsTask) => WbsTask | null;

function mapTree(tasks: WbsTask[], fn: Mapper): WbsTask[] {
  const out: WbsTask[] = [];
  for (const task of tasks) {
    const mapped = fn(task);
    if (mapped === null) continue;
    out.push(
      mapped.children === task.children
        ? { ...mapped, children: mapTree(task.children, fn) }
        : mapped,
    );
  }
  return out;
}

export function findTask(tasks: WbsTask[], id: string): WbsTask | null {
  for (const task of tasks) {
    if (task.id === id) return task;
    const found = findTask(task.children, id);
    if (found) return found;
  }
  return null;
}

/** The list a task sits in, together with its position in it. */
export function locate(
  tasks: WbsTask[],
  id: string,
): { siblings: WbsTask[]; index: number; parent: WbsTask | null } | null {
  type Found = { siblings: WbsTask[]; index: number; parent: WbsTask | null } | null;
  const search = (list: WbsTask[], parent: WbsTask | null): Found => {
    const index = list.findIndex((task) => task.id === id);
    if (index >= 0) return { siblings: list, index, parent };
    for (const task of list) {
      const found = search(task.children, task);
      if (found) return found;
    }
    return null;
  };
  return search(tasks, null);
}

export function updateTask(tasks: WbsTask[], id: string, patch: Partial<WbsTask>): WbsTask[] {
  return mapTree(tasks, (task) => (task.id === id ? { ...task, ...patch } : task));
}

export function setValue(
  tasks: WbsTask[],
  id: string,
  fieldId: string,
  value: FieldValue,
): WbsTask[] {
  return mapTree(tasks, (task) =>
    task.id === id ? { ...task, values: { ...task.values, [fieldId]: value } } : task,
  );
}

export function removeTask(tasks: WbsTask[], id: string): WbsTask[] {
  return mapTree(tasks, (task) => (task.id === id ? null : task));
}

export function addChild(tasks: WbsTask[], parentId: string | null, task: WbsTask): WbsTask[] {
  if (parentId === null) return [...tasks, task];
  return mapTree(tasks, (node) =>
    node.id === parentId
      ? { ...node, collapsed: false, children: [...node.children, task] }
      : node,
  );
}

export function addSibling(tasks: WbsTask[], afterId: string, task: WbsTask): WbsTask[] {
  const insert = (list: WbsTask[]): WbsTask[] => {
    const index = list.findIndex((node) => node.id === afterId);
    if (index >= 0) {
      const next = [...list];
      next.splice(index + 1, 0, task);
      return next;
    }
    return list.map((node) => ({ ...node, children: insert(node.children) }));
  };
  return insert(tasks);
}

export function duplicateTask(tasks: WbsTask[], id: string): WbsTask[] {
  const original = findTask(tasks, id);
  if (!original) return tasks;
  const clone = (task: WbsTask): WbsTask => ({
    ...task,
    id: newId(),
    values: { ...task.values },
    children: task.children.map(clone),
  });
  return addSibling(tasks, id, clone(original));
}

export function moveTask(tasks: WbsTask[], id: string, delta: -1 | 1): WbsTask[] {
  const move = (list: WbsTask[]): WbsTask[] => {
    const index = list.findIndex((node) => node.id === id);
    if (index >= 0) {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    }
    return list.map((node) => ({ ...node, children: move(node.children) }));
  };
  return move(tasks);
}

/** Demotes a task to be the last child of the sibling above it. */
export function indentTask(tasks: WbsTask[], id: string): WbsTask[] {
  const step = (list: WbsTask[]): WbsTask[] => {
    const index = list.findIndex((node) => node.id === id);
    if (index > 0) {
      const next = [...list];
      const [moved] = next.splice(index, 1);
      const host = next[index - 1];
      next[index - 1] = { ...host, collapsed: false, children: [...host.children, moved] };
      return next;
    }
    // The first item in a list has nothing to tuck under.
    if (index === 0) return list;
    return list.map((node) => ({ ...node, children: step(node.children) }));
  };
  return step(tasks);
}

/** Promotes a task to sit directly after its former parent. */
export function outdentTask(tasks: WbsTask[], id: string): WbsTask[] {
  const step = (list: WbsTask[], grandparentList: WbsTask[] | null): WbsTask[] | null => {
    for (let i = 0; i < list.length; i++) {
      const parent = list[i];
      const childIndex = parent.children.findIndex((child) => child.id === id);
      if (childIndex >= 0) {
        const children = [...parent.children];
        const [moved] = children.splice(childIndex, 1);
        const next = [...list];
        next[i] = { ...parent, children };
        next.splice(i + 1, 0, moved);
        return next;
      }
      const deeper = step(parent.children, list);
      if (deeper) {
        const next = [...list];
        next[i] = { ...parent, children: deeper };
        return next;
      }
    }
    void grandparentList;
    return null;
  };
  return step(tasks, null) ?? tasks;
}

export function toggleCollapse(tasks: WbsTask[], id: string): WbsTask[] {
  return mapTree(tasks, (task) =>
    task.id === id ? { ...task, collapsed: !task.collapsed } : task,
  );
}

export function setAllCollapsed(tasks: WbsTask[], collapsed: boolean): WbsTask[] {
  return mapTree(tasks, (task) => (task.children.length > 0 ? { ...task, collapsed } : task));
}

/* ------------------------------- summary ------------------------------- */

export interface WbsStats {
  tasks: number;
  workPackages: number;
  summaries: number;
  depth: number;
  /** Totals for every field that rolls up by sum, keyed by field id. */
  totals: Record<string, number>;
}

export function stats(doc: WbsDoc): WbsStats {
  const rows = flatten(doc);
  const totals: Record<string, number> = {};
  for (const field of doc.fields) {
    if (field.rollup !== "sum") continue;
    totals[field.id] = rows
      .filter((row) => !row.isSummary)
      .reduce((sum, row) => sum + (asNumber(row.values[field.id] ?? null) ?? 0), 0);
  }
  return {
    tasks: rows.length,
    workPackages: rows.filter((row) => !row.isSummary).length,
    summaries: rows.filter((row) => row.isSummary).length,
    depth: maxDepth(doc.tasks),
    totals,
  };
}
