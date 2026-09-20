import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { defaultChart, defaultFields, defaultGantt, defaultSettings } from "@/lib/wbs/fields";
import { flatten, newTask, type WbsDoc, type WbsTask } from "@/lib/wbs/model";
import { tableToTasks } from "@/lib/wbs/import";
import { buildWorkbook, readSpreadsheet, workbookFilename } from "@/lib/wbs/workbook";

/**
 * The Excel promise, checked by writing a workbook and reading it back with
 * the same library Excel-compatible tooling uses. If a claim on the page is
 * not true of the bytes, one of these fails.
 */

function sample(overrides: Partial<WbsDoc["settings"]> = {}): WbsDoc {
  const scope = {
    ...newTask("Scope"),
    values: { cost: 100, hours: 10, progress: 50, start: "2026-01-05", finish: "2026-01-09" },
  };
  const budget = {
    ...newTask("Budget"),
    values: { cost: 300, hours: 30, progress: 100, start: "2026-01-02", finish: "2026-01-20" },
  };
  const planning: WbsTask = { ...newTask("Planning"), description: "Everything before build", children: [scope, budget] };
  return {
    version: 1,
    settings: { ...defaultSettings(), projectName: "Bridge rebuild", ...overrides },
    chart: defaultChart(),
    gantt: defaultGantt(),
    fields: defaultFields(),
    tasks: [planning, { ...newTask("Delivery"), values: { cost: 50 } }],
  };
}

async function read(doc: WbsDoc) {
  const blob = await buildWorkbook(doc);
  const buffer = new Uint8Array(await blob.arrayBuffer());
  return XLSX.read(buffer, { type: "array", cellFormula: true, cellNF: true, cellStyles: true });
}

/** The column letter whose header cell carries this label. */
function columnOf(sheet: XLSX.WorkSheet, label: string): string {
  const range = XLSX.utils.decode_range(sheet["!ref"] as string);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if ((sheet[ref] as XLSX.CellObject | undefined)?.v === label) {
      return XLSX.utils.encode_col(c);
    }
  }
  throw new Error(`No column headed ${label}`);
}

describe("the exported workbook", () => {
  it("is a real xlsx that opens, with the sheets that were asked for", async () => {
    const workbook = await read(sample());
    expect(workbook.SheetNames).toEqual(["WBS", "Dictionary", "Gantt", "Summary"]);
  });

  it("leaves out the extra sheets when they are switched off", async () => {
    const base = sample({ includeDictionary: false, includeSummary: false });
    const workbook = await read({ ...base, gantt: { ...base.gantt, includeInWorkbook: false } });
    expect(workbook.SheetNames).toEqual(["WBS"]);
  });

  it("writes a header row and one row per task", async () => {
    const sheet = (await read(sample())).Sheets.WBS;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    expect(rows[0]).toContain("WBS");
    expect(rows).toHaveLength(5);
  });

  it("stores cost as a number with a currency format, not as text", async () => {
    const sheet = (await read(sample())).Sheets.WBS;
    const cell = Object.values(sheet).find(
      (value) => typeof value === "object" && value !== null && (value as XLSX.CellObject).v === 300,
    ) as XLSX.CellObject;
    expect(cell.t).toBe("n");
    expect(cell.z).toContain("#,##0.00");
  });

  it("stores a date as an Excel date rather than a string", async () => {
    const sheet = (await read(sample())).Sheets.WBS;
    const dates = Object.entries(sheet).filter(
      ([ref, cell]) => !ref.startsWith("!") && (cell as XLSX.CellObject).z === "yyyy-mm-dd",
    );
    expect(dates.length).toBeGreaterThan(0);
    const [, cell] = dates[0];
    expect((cell as XLSX.CellObject).t).toBe("n");
    expect((cell as XLSX.CellObject).w).toBe("2026-01-02");
  });

  it("stores a percentage as a fraction so Excel's % format is right", async () => {
    const sheet = (await read(sample())).Sheets.WBS;
    const percents = Object.values(sheet).filter(
      (cell) => typeof cell === "object" && cell !== null && (cell as XLSX.CellObject).z === "0%",
    ) as XLSX.CellObject[];
    expect(percents.map((cell) => cell.v)).toContain(0.5);
  });

  it("puts a live SUM formula on the summary row, with the right answer cached", async () => {
    const sheet = (await read(sample())).Sheets.WBS;
    const letter = columnOf(sheet, "Cost");
    // Row 2 is the "Planning" summary; its children are on rows 3 and 4.
    const cell = sheet[`${letter}2`] as XLSX.CellObject;
    expect(cell.f).toBe(`SUM(${letter}3,${letter}4)`);
    expect(cell.v).toBe(400);
  });

  it("uses MIN for a start date that rolls up to the earliest child", async () => {
    const sheet = (await read(sample())).Sheets.WBS;
    const letter = columnOf(sheet, "Start");
    const cell = sheet[`${letter}2`] as XLSX.CellObject;
    expect(cell.f).toBe(`MIN(${letter}3,${letter}4)`);
    expect(cell.w).toBe("2026-01-02");
  });

  it("omits formulas when the option is off", async () => {
    const sheet = (await read(sample({ liveFormulas: false }))).Sheets.WBS;
    const formulas = Object.values(sheet).filter(
      (cell) => typeof cell === "object" && cell !== null && (cell as XLSX.CellObject).f,
    );
    expect(formulas).toHaveLength(0);
  });

  it("groups child rows into a collapsible outline", async () => {
    const sheet = (await read(sample())).Sheets.WBS;
    const rows = sheet["!rows"] as { level?: number }[] | undefined;
    expect(rows?.[2]?.level).toBe(1);
    expect(rows?.[1]?.level).toBeUndefined();
  });

  it("sets column widths and an autofilter over the used range", async () => {
    const sheet = (await read(sample())).Sheets.WBS;
    expect((sheet["!cols"] as { wch?: number }[])?.length).toBeGreaterThan(3);
    expect((sheet["!autofilter"] as { ref: string }).ref).toBe(sheet["!ref"]);
  });

  it("carries the task descriptions on the dictionary sheet", async () => {
    const sheet = (await read(sample())).Sheets.Dictionary;
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(rows[0]["Description / acceptance criteria"]).toBe("Everything before build");
  });

  it("totals each branch on the summary sheet", async () => {
    const sheet = (await read(sample())).Sheets.Summary;
    const rows = XLSX.utils.sheet_to_json<Record<string, number | string>>(sheet);
    expect(rows).toHaveLength(2);
    expect(rows[0].Cost).toBe(400);
  });

  it("names the file after the project", async () => {
    expect(workbookFilename(sample(), "xlsx")).toMatch(/^bridge-rebuild-wbs-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});

describe("reopening an exported workbook", () => {
  it("rebuilds the same tree, names and numbers from the file it wrote", async () => {
    const original = sample();
    const blob = await buildWorkbook(original);
    const file = new File([await blob.arrayBuffer()], "bridge-rebuild-wbs.xlsx");

    const rows = await readSpreadsheet(file);
    const result = tableToTasks(rows, defaultFields());

    expect(result.tasks.map((task) => task.name.trim())).toEqual(["Planning", "Delivery"]);
    expect(result.tasks[0].children.map((task) => task.name.trim())).toEqual(["Scope", "Budget"]);

    const reopened: WbsDoc = { ...original, fields: result.fields, tasks: result.tasks };
    expect(flatten(reopened).map((row) => row.code)).toEqual(
      flatten(original).map((row) => row.code),
    );
  });

  it("brings the numbers back as numbers, not as formatted text", async () => {
    const blob = await buildWorkbook(sample());
    const file = new File([await blob.arrayBuffer()], "wbs.xlsx");
    const result = tableToTasks(await readSpreadsheet(file), defaultFields());
    const budget = result.tasks[0].children[1];
    expect(budget.values.cost).toBe(300);
    expect(budget.values.progress).toBe(100);
    expect(budget.values.start).toBe("2026-01-02");
  });

  it("does not invent duplicate columns when reopening its own export", async () => {
    const blob = await buildWorkbook(sample());
    const file = new File([await blob.arrayBuffer()], "wbs.xlsx");
    const result = tableToTasks(await readSpreadsheet(file), defaultFields());
    expect(result.fields).toHaveLength(defaultFields().length);
  });
});

describe("the Gantt sheet", () => {
  it("is included when asked for, and left out when not", async () => {
    const withGantt = await read(sample());
    expect(withGantt.SheetNames).toContain("Gantt");

    const base = sample();
    const without = await read({ ...base, gantt: { ...base.gantt, includeInWorkbook: false } });
    expect(without.SheetNames).not.toContain("Gantt");
  });

  it("carries real dates and a duration in days", async () => {
    const sheet = (await read(sample())).Sheets.Gantt;
    // raw:false asks for the formatted text, which is what Excel shows.
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false });
    const scope = rows.find((row) => String(row.Task).trim() === "Scope")!;
    expect(scope.Days).toBe("5");
    expect(scope.Start).toBe("2026-01-05");
  });

  it("marks a block in each period the task is running", async () => {
    const sheet = (await read(sample())).Sheets.Gantt;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const scope = rows.find((row) => String(row.Task).trim() === "Scope")!;
    const blocks = Object.values(scope).filter((value) => value === "█");
    expect(blocks.length).toBeGreaterThan(0);
  });
});
