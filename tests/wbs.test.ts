import { describe, it, expect } from "vitest";
import {
  addChild,
  codeSegment,
  computeValues,
  duplicateTask,
  flatten,
  indentTask,
  isDescendant,
  maxDepth,
  moveTaskTo,
  moveTask,
  newTask,
  outdentTask,
  removeTask,
  stats,
  toAlpha,
  toRoman,
  type WbsDoc,
  type WbsTask,
} from "@/lib/wbs/model";
import { defaultChart, defaultFields, defaultGantt, defaultSettings, excelSerialDate, newField } from "@/lib/wbs/fields";
import { buildGrid, buildSummaryGrid, columnLetter, csvSafe, gridToCsv } from "@/lib/wbs/grid";
import { docToJson, parseDoc, parseOutline, parseOutlineLines, tableToTasks } from "@/lib/wbs/import";
import { starterTasks, TEMPLATES, templateTasks } from "@/lib/wbs/templates";

/**
 * A document that states its own environment rather than inheriting whatever
 * the product currently defaults to: the optional columns are shown and the
 * structure columns are on, so these tests keep testing behaviour when the
 * defaults are retuned. The defaults themselves are covered further down.
 */
function doc(tasks: WbsTask[], overrides: Partial<WbsDoc["settings"]> = {}): WbsDoc {
  return {
    version: 1,
    settings: {
      ...defaultSettings(),
      showLevel: true,
      showType: true,
      weightFieldId: "hours",
      ...overrides,
    },
    chart: defaultChart(),
    gantt: defaultGantt(),
    fields: defaultFields().map((field) =>
      ["cost", "hours", "status"].includes(field.id) ? { ...field, visible: true } : field,
    ),
    tasks,
  };
}

function tree(): WbsTask[] {
  const leafA = { ...newTask("Scope"), values: { cost: 100, hours: 10, progress: 50, start: "2026-01-05", finish: "2026-01-09" } };
  const leafB = { ...newTask("Budget"), values: { cost: 300, hours: 30, progress: 100, start: "2026-01-02", finish: "2026-01-20" } };
  const parent = { ...newTask("Planning"), children: [leafA, leafB] };
  const solo = { ...newTask("Delivery"), values: { cost: 50, hours: 5, progress: 0 } };
  return [parent, solo];
}

describe("code numbering", () => {
  it("numbers decimal codes by position in the tree", () => {
    const rows = flatten(doc(tree()));
    expect(rows.map((row) => row.code)).toEqual(["1", "1.1", "1.2", "2"]);
  });

  it("applies a prefix, separator and zero padding", () => {
    const rows = flatten(
      doc(tree(), { numbering: { style: "decimal", prefix: "PRJ-", separator: "-", pad: 2, startAt: 1 } }),
    );
    expect(rows.map((row) => row.code)).toEqual(["PRJ-01", "PRJ-01-01", "PRJ-01-02", "PRJ-02"]);
  });

  it("cycles roman, letter and digit segments for outline numbering", () => {
    expect(codeSegment("outline", 1, 4, 0)).toBe("IV");
    expect(codeSegment("outline", 2, 2, 0)).toBe("B");
    expect(codeSegment("outline", 3, 7, 0)).toBe("7");
    expect(codeSegment("outline", 4, 2, 0)).toBe("b");
    expect(codeSegment("outline", 5, 3, 0)).toBe("iii");
  });

  it("uses letters for the top level only in alpha numbering", () => {
    const rows = flatten(doc(tree(), { numbering: { style: "alpha", prefix: "", separator: ".", pad: 0, startAt: 1 } }));
    expect(rows.map((row) => row.code)).toEqual(["A", "A.1", "A.2", "B"]);
  });

  it("numbers every row sequentially when the style is flat", () => {
    const rows = flatten(doc(tree(), { numbering: { style: "flat", prefix: "", separator: ".", pad: 0, startAt: 1 } }));
    expect(rows.map((row) => row.code)).toEqual(["1", "2", "3", "4"]);
  });

  it("honours a starting number other than one", () => {
    const rows = flatten(doc(tree(), { numbering: { style: "decimal", prefix: "", separator: ".", pad: 0, startAt: 0 } }));
    expect(rows.map((row) => row.code)).toEqual(["0", "0.0", "0.1", "1"]);
  });

  it("converts roman numerals and spreadsheet-style letters", () => {
    expect(toRoman(1944)).toBe("MCMXLIV");
    expect(toAlpha(26)).toBe("Z");
    expect(toAlpha(27)).toBe("AA");
  });
});

describe("roll-ups", () => {
  it("sums cost and effort onto summary rows", () => {
    const rows = flatten(doc(tree()));
    expect(rows[0].values.cost).toBe(400);
    expect(rows[0].values.hours).toBe(40);
  });

  it("takes the earliest start and the latest finish", () => {
    const rows = flatten(doc(tree()));
    expect(rows[0].values.start).toBe("2026-01-02");
    expect(rows[0].values.finish).toBe("2026-01-20");
  });

  it("weights percent complete by the chosen column", () => {
    const rows = flatten(doc(tree()));
    // 50% of 10h and 100% of 30h is 87.5%, not the unweighted 75%.
    expect(rows[0].values.progress).toBe(87.5);
  });

  it("falls back to equal weighting when no weight column is set", () => {
    const rows = flatten(doc(tree(), { weightFieldId: null }));
    expect(rows[0].values.progress).toBe(75);
  });

  it("leaves a work package's own values untouched", () => {
    const rows = flatten(doc(tree()));
    expect(rows[1].values.cost).toBe(100);
    expect(rows[3].values.cost).toBe(50);
  });

  it("keeps a summary row's entered value when nothing beneath it has one", () => {
    const child = newTask("Empty child");
    const parent = { ...newTask("Parent"), values: { cost: 42 }, children: [child] };
    const rows = flatten(doc([parent]));
    expect(rows[0].values.cost).toBe(42);
  });

  it("does not roll up a column set to no roll-up", () => {
    const rows = flatten(doc(tree()));
    expect(rows[0].values.status).toBe(null);
  });

  it("rolls up through more than one level", () => {
    const deep = { ...newTask("Top"), children: tree() };
    const rows = flatten(doc([deep]));
    expect(rows[0].values.cost).toBe(450);
    expect(maxDepth([deep])).toBe(3);
  });

  it("counts work packages and summaries separately", () => {
    const summary = stats(doc(tree()));
    expect(summary.tasks).toBe(4);
    expect(summary.workPackages).toBe(3);
    expect(summary.summaries).toBe(1);
    expect(summary.totals.cost).toBe(450);
  });

  it("computes values for every task in the tree", () => {
    const tasks = tree();
    const map = computeValues(tasks, defaultFields(), "hours");
    expect(map.size).toBe(4);
  });
});

describe("tree editing", () => {
  it("indents a task under the sibling above it", () => {
    const tasks = tree();
    const moved = indentTask(tasks, tasks[1].id);
    expect(moved).toHaveLength(1);
    expect(moved[0].children).toHaveLength(3);
    expect(moved[0].children[2].name).toBe("Delivery");
  });

  it("refuses to indent the first task in a list", () => {
    const tasks = tree();
    expect(indentTask(tasks, tasks[0].id)).toEqual(tasks);
  });

  it("outdents a child to sit after its former parent", () => {
    const tasks = tree();
    const moved = outdentTask(tasks, tasks[0].children[0].id);
    expect(moved.map((task) => task.name)).toEqual(["Planning", "Scope", "Delivery"]);
    expect(moved[0].children).toHaveLength(1);
  });

  it("moves a task among its siblings", () => {
    const tasks = tree();
    const moved = moveTask(tasks, tasks[0].children[1].id, -1);
    expect(moved[0].children.map((task) => task.name)).toEqual(["Budget", "Scope"]);
  });

  it("ignores a move past the end of the list", () => {
    const tasks = tree();
    expect(moveTask(tasks, tasks[1].id, 1)).toEqual(tasks);
  });

  it("removes a task together with its children", () => {
    const tasks = tree();
    const left = removeTask(tasks, tasks[0].id);
    expect(left).toHaveLength(1);
    expect(left[0].name).toBe("Delivery");
  });

  it("duplicates a subtree with fresh ids", () => {
    const tasks = tree();
    const copied = duplicateTask(tasks, tasks[0].id);
    expect(copied).toHaveLength(3);
    expect(copied[1].name).toBe("Planning");
    expect(copied[1].id).not.toBe(tasks[0].id);
    expect(copied[1].children[0].id).not.toBe(tasks[0].children[0].id);
  });

  it("adds a child and expands the parent it was added to", () => {
    const tasks = [{ ...tree()[0], collapsed: true }];
    const next = addChild(tasks, tasks[0].id, newTask("New"));
    expect(next[0].collapsed).toBe(false);
    expect(next[0].children).toHaveLength(3);
  });

  it("hides the descendants of a collapsed task", () => {
    const tasks = tree();
    const collapsed = [{ ...tasks[0], collapsed: true }, tasks[1]];
    const rows = flatten(doc(collapsed));
    expect(rows.filter((row) => row.hidden).map((row) => row.name)).toEqual(["Scope", "Budget"]);
  });
});

describe("sheet grid", () => {
  it("indents the task column and keeps one column per level out of the way", () => {
    const grid = buildGrid(doc(tree()));
    const taskColumn = grid.columns.findIndex((column) => column.key === "name");
    expect(grid.rows[1][taskColumn].text).toBe("    Scope");
  });

  it("spreads names across a column per level when asked", () => {
    const grid = buildGrid(doc(tree(), { nameLayout: "levels" }));
    expect(grid.columns.filter((column) => column.key.startsWith("level-"))).toHaveLength(2);
    const first = grid.columns.findIndex((column) => column.key === "level-1");
    expect(grid.rows[0][first].text).toBe("Planning");
    expect(grid.rows[1][first].text).toBe("");
    expect(grid.rows[1][first + 1].text).toBe("Scope");
  });

  it("marks summary rows and work packages", () => {
    const grid = buildGrid(doc(tree()));
    const typeColumn = grid.columns.findIndex((column) => column.key === "type");
    expect(grid.rows[0][typeColumn].text).toBe("Summary");
    expect(grid.rows[1][typeColumn].text).toBe("Work package");
  });

  it("writes roll-up formulas that point at the direct children's rows", () => {
    const grid = buildGrid(doc(tree()));
    const costColumn = grid.columns.findIndex((column) => column.key === "cost");
    const letter = columnLetter(costColumn);
    // Header is row 1, so the two children sit on sheet rows 3 and 4.
    expect(grid.rows[0][costColumn].formula).toBe(`SUM(${letter}3,${letter}4)`);
    expect(grid.rows[1][costColumn].formula).toBeUndefined();
  });

  it("uses MIN and MAX formulas for date roll-ups", () => {
    const grid = buildGrid(doc(tree()));
    const startColumn = grid.columns.findIndex((column) => column.key === "start");
    expect(grid.rows[0][startColumn].formula?.startsWith("MIN(")).toBe(true);
  });

  it("omits formulas when live formulas are switched off", () => {
    const grid = buildGrid(doc(tree(), { liveFormulas: false }));
    const costColumn = grid.columns.findIndex((column) => column.key === "cost");
    expect(grid.rows[0][costColumn].formula).toBeUndefined();
    expect(grid.rows[0][costColumn].value).toBe(400);
  });

  it("writes percentages as fractions so Excel's % format is correct", () => {
    const grid = buildGrid(doc(tree()));
    const column = grid.columns.findIndex((c) => c.key === "progress");
    expect(grid.rows[1][column].value).toBe(0.5);
    expect(grid.rows[1][column].format).toBe("0%");
  });

  it("writes dates as Excel serial numbers", () => {
    const grid = buildGrid(doc(tree()));
    const column = grid.columns.findIndex((c) => c.key === "start");
    expect(grid.rows[1][column].value).toBe(excelSerialDate("2026-01-05"));
    expect(grid.rows[1][column].kind).toBe("date");
  });

  it("gives every row an outline level for Excel grouping", () => {
    const grid = buildGrid(doc(tree()));
    expect(grid.outline).toEqual([0, 1, 1, 0]);
  });

  it("flattens the outline when grouping is off", () => {
    expect(buildGrid(doc(tree(), { groupRows: false })).outline).toEqual([0, 0, 0, 0]);
  });

  it("includes hidden rows in the export even when collapsed on screen", () => {
    const tasks = tree();
    const grid = buildGrid(doc([{ ...tasks[0], collapsed: true }, tasks[1]]));
    expect(grid.rows).toHaveLength(4);
  });

  it("numbers columns the way a spreadsheet does", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
  });
});

describe("CSV output", () => {
  it("quotes fields containing commas and doubles inner quotes", () => {
    const tasks = [newTask('Write "the" report, twice')];
    const csv = gridToCsv(buildGrid(doc(tasks)));
    expect(csv).toContain('"Write ""the"" report, twice"');
  });

  it("defuses a task name that a spreadsheet would treat as a formula", () => {
    expect(csvSafe("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvSafe("+1")).toBe("'+1");
    expect(csvSafe("Normal name")).toBe("Normal name");
  });

  it("separates rows with CRLF", () => {
    const csv = gridToCsv(buildGrid(doc(tree())));
    expect(csv.split("\r\n")).toHaveLength(5);
  });
});

describe("summary sheet", () => {
  it("totals each top-level branch and its share of the project", () => {
    const grid = buildSummaryGrid(doc(tree()));
    expect(grid.rows).toHaveLength(2);
    const costColumn = grid.columns.findIndex((column) => column.key === "cost");
    expect(grid.rows[0][costColumn].value).toBe(400);
    const shareColumn = grid.columns.findIndex((column) => column.key === "share");
    expect(grid.rows[0][shareColumn].text).toBe("89%");
  });
});

describe("outline import", () => {
  it("reads indentation as depth", () => {
    const tasks = parseOutline("Phase one\n  Task A\n  Task B\nPhase two");
    expect(tasks).toHaveLength(2);
    expect(tasks[0].children.map((task) => task.name)).toEqual(["Task A", "Task B"]);
  });

  it("reads tabs as depth", () => {
    const tasks = parseOutline("Phase\n\tTask");
    expect(tasks[0].children[0].name).toBe("Task");
  });

  it("takes depth from a numbered prefix ahead of indentation", () => {
    const tasks = parseOutline("1. Phase one\n1.1 Task A\n1.1.1 Subtask\n2. Phase two");
    expect(tasks).toHaveLength(2);
    expect(tasks[0].children[0].children[0].name).toBe("Subtask");
  });

  it("strips bullet characters", () => {
    expect(parseOutlineLines("- Task A\n* Task B")[0].name).toBe("Task A");
  });

  it("clamps a level that skips a step", () => {
    const tasks = parseOutline("Phase\n      Deeply indented");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].children[0].name).toBe("Deeply indented");
  });

  it("ignores blank lines", () => {
    expect(parseOutlineLines("A\n\n\nB")).toHaveLength(2);
  });

  it("names an empty line's task rather than leaving it blank", () => {
    expect(parseOutline("1.")[0].name).toBe("Untitled task");
  });

  it("keeps a task named only with digits", () => {
    const tasks = parseOutline("Roadmap\n  2026\n  2027");
    expect(tasks[0].children.map((task) => task.name)).toEqual(["2026", "2027"]);
  });
});

describe("spreadsheet import", () => {
  it("rebuilds the hierarchy from a WBS code column", () => {
    const rows = [
      ["WBS", "Task", "Cost"],
      ["1", "Planning", "400"],
      ["1.1", "Scope", "100"],
      ["1.2", "Budget", "300"],
      ["2", "Delivery", "50"],
    ];
    const result = tableToTasks(rows, defaultFields());
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].children).toHaveLength(2);
    expect(result.tasks[0].children[1].values.cost).toBe(300);
  });

  it("rebuilds the hierarchy from one column per level", () => {
    const rows = [
      ["Level 1", "Level 2", "Task Owner"],
      ["Planning", "", "Ada"],
      ["", "Scope", "Bo"],
      ["", "Budget", "Cy"],
    ];
    const result = tableToTasks(rows, defaultFields());
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].children.map((task) => task.name)).toEqual(["Scope", "Budget"]);
    expect(result.tasks[0].children[0].values.owner).toBe("Bo");
  });

  it("rebuilds the hierarchy from indentation in the task column", () => {
    const rows = [
      ["Task", "Owner"],
      ["Planning", "Ada"],
      ["    Scope", "Bo"],
    ];
    const result = tableToTasks(rows, defaultFields());
    expect(result.tasks[0].children[0].name).toBe("Scope");
  });

  it("creates columns the file has and the editor does not", () => {
    const rows = [
      ["WBS", "Task", "Contractor"],
      ["1", "Planning", "Acme Ltd"],
    ];
    const result = tableToTasks(rows, defaultFields());
    const created = result.fields.find((field) => field.label === "Contractor");
    expect(created?.type).toBe("text");
    expect(result.tasks[0].values[created!.id]).toBe("Acme Ltd");
  });

  it("matches an existing column by its label rather than duplicating it", () => {
    const rows = [
      ["WBS", "Task", "Cost"],
      ["1", "Planning", "10"],
    ];
    const result = tableToTasks(rows, defaultFields());
    expect(result.fields.filter((field) => field.label === "Cost")).toHaveLength(1);
  });

  it("guesses the type of a new numeric column", () => {
    const rows = [
      ["WBS", "Task", "Headcount"],
      ["1", "Planning", "3"],
      ["2", "Delivery", "5"],
    ];
    const result = tableToTasks(rows, defaultFields());
    const created = result.fields.find((field) => field.label === "Headcount");
    expect(created?.type).toBe("number");
    expect(created?.rollup).toBe("sum");
  });

  it("reads the description column into the WBS dictionary", () => {
    const rows = [
      ["WBS", "Task", "Description"],
      ["1", "Planning", "Everything before work starts"],
    ];
    const result = tableToTasks(rows, defaultFields());
    expect(result.tasks[0].description).toBe("Everything before work starts");
  });

  it("reports an empty file rather than throwing", () => {
    expect(tableToTasks([], defaultFields()).tasks).toEqual([]);
  });
});

describe("saving and reopening", () => {
  it("round-trips a document through JSON", () => {
    const original = doc(tree(), { projectName: "Bridge" });
    const restored = parseDoc(docToJson(original));
    expect(restored?.settings.projectName).toBe("Bridge");
    expect(flatten(restored!).map((row) => row.code)).toEqual(["1", "1.1", "1.2", "2"]);
  });

  it("rejects a file that is not a document", () => {
    expect(parseDoc("nonsense")).toBe(null);
    expect(parseDoc('{"hello":true}')).toBe(null);
  });

  it("fills in settings a older file is missing", () => {
    const restored = parseDoc('{"tasks":[{"name":"A"}]}');
    expect(restored?.settings.numbering.style).toBe("decimal");
    expect(restored?.fields.length).toBeGreaterThan(0);
  });
});

describe("columns", () => {
  it("derives a unique id from a column label", () => {
    const first = newField("Unit cost", "currency", []);
    const second = newField("Unit cost", "currency", [first.id]);
    expect(first.id).toBe("unit-cost");
    expect(second.id).toBe("unit-cost-2");
    expect(first.rollup).toBe("sum");
  });

  it("gives a choice column some options to start from", () => {
    expect(newField("Phase", "select", []).options).toHaveLength(2);
  });
});

describe("templates", () => {
  it("parses every template into a tree with children", () => {
    for (const template of TEMPLATES) {
      const tasks = templateTasks(template.id);
      expect(tasks.length).toBeGreaterThan(2);
      expect(tasks[0].children.length).toBeGreaterThan(0);
    }
  });

  it("returns nothing for an unknown template", () => {
    expect(templateTasks("nope")).toEqual([]);
  });

  it("opens with a small starter breakdown", () => {
    expect(starterTasks()).toHaveLength(3);
  });
});

describe("the default sheet", () => {
  /** The product defaults, unlike doc() above, which sets its own. */
  function plain(tasks: WbsTask[]): WbsDoc {
    return {
      version: 1,
      settings: defaultSettings(),
      chart: defaultChart(),
      gantt: defaultGantt(),
      fields: defaultFields(),
      tasks,
    };
  }

  function dated(): WbsTask[] {
    const a = { ...newTask("Requirements"), values: { start: "2026-03-02", finish: "2026-03-13", progress: 100 } };
    const b = { ...newTask("Stakeholders"), values: { start: "2026-03-16", finish: "2026-03-27", progress: 0 } };
    return [{ ...newTask("Initiation"), children: [a, b] }];
  }

  it("arrives in the order a project WBS is expected in", () => {
    const grid = buildGrid(plain(dated()));
    expect(grid.columns.map((column) => column.label)).toEqual([
      "WBS Number",
      "Task Title",
      "Task Owner",
      "Start Date",
      "Due Date",
      "Duration",
      "% Complete",
      "Timeline/Weeks",
    ]);
  });

  it("keeps cost, effort and status available but out of the way", () => {
    const hidden = defaultFields().filter((field) => !field.visible).map((field) => field.id);
    expect(hidden).toContain("cost");
    expect(hidden).toContain("hours");
    expect(hidden).toContain("status");
  });

  it("counts duration in whole days, both ends included", () => {
    const rows = flatten(plain(dated()));
    expect(rows[1].values.duration).toBe(12);
  });

  it("spans a summary task's duration across its children", () => {
    const rows = flatten(plain(dated()));
    expect(rows[0].values.duration).toBe(26);
  });

  it("leaves duration empty when a task has no dates", () => {
    const rows = flatten(plain([newTask("Someday")]));
    expect(rows[0].values.duration).toBe(null);
  });

  it("draws a timeline bar with one character per week", () => {
    const rows = flatten(plain(dated()));
    const bar = rows[1].values.timeline as string;
    expect(bar).toHaveLength(4);
    expect(bar).toMatch(/^[█▒·]+$/);
  });

  it("lines every row's bar up on the same weeks", () => {
    const rows = flatten(plain(dated()));
    const lengths = new Set(rows.map((row) => String(row.values.timeline ?? "").length));
    expect(lengths.size).toBe(1);
  });

  it("shows progress in the bar: done weeks are full blocks", () => {
    const rows = flatten(plain(dated()));
    expect(String(rows[1].values.timeline)).toContain("█");
    expect(String(rows[2].values.timeline)).not.toContain("█");
  });

  it("derives the computed columns rather than storing them", () => {
    const tasks = dated();
    const rows = flatten(plain(tasks));
    expect(rows[1].own.duration).toBeUndefined();
    expect(rows[1].values.duration).toBe(12);
  });

  it("numbers the hierarchy in the WBS Number column", () => {
    const grid = buildGrid(plain(dated()));
    const codes = grid.rows.map((row) => row[0].text);
    expect(codes).toEqual(["1", "1.1", "1.2"]);
  });
});

describe("dragging a row somewhere else", () => {
  it("drops a task after the row it was dropped on, at that row's level", () => {
    const tasks = tree();
    const moved = moveTaskTo(tasks, tasks[1].id, tasks[0].children[0].id, "after");
    expect(moved).toHaveLength(1);
    expect(moved[0].children.map((task) => task.name)).toEqual(["Scope", "Delivery", "Budget"]);
  });

  it("drops a task before the row it was dropped on", () => {
    const tasks = tree();
    const moved = moveTaskTo(tasks, tasks[1].id, tasks[0].children[0].id, "before");
    expect(moved[0].children.map((task) => task.name)).toEqual(["Delivery", "Scope", "Budget"]);
  });

  it("carries the children along with the row", () => {
    const tasks = tree();
    const moved = moveTaskTo(tasks, tasks[0].id, tasks[1].id, "after");
    expect(moved.map((task) => task.name)).toEqual(["Delivery", "Planning"]);
    expect(moved[1].children).toHaveLength(2);
  });

  it("refuses to drop a task inside itself", () => {
    const tasks = tree();
    expect(moveTaskTo(tasks, tasks[0].id, tasks[0].children[1].id, "after")).toEqual(tasks);
    expect(isDescendant(tasks, tasks[0].id, tasks[0].children[1].id)).toBe(true);
  });

  it("does nothing when a row is dropped on itself", () => {
    const tasks = tree();
    expect(moveTaskTo(tasks, tasks[0].id, tasks[0].id, "after")).toEqual(tasks);
  });
});
