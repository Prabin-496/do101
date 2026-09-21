import { describe, it, expect } from "vitest";
import { defaultChart, defaultFields, defaultGantt, defaultSettings } from "@/lib/wbs/fields";
import { flatten, newTask, type GanttSettings, type WbsDoc, type WbsTask } from "@/lib/wbs/model";
import {
  addDays,
  buildGanttGrid,
  buildPeriods,
  coversPeriod,
  dayDiff,
  describeRange,
  ganttBars,
  ganttRange,
  isWeekend,
  MAX_PERIODS,
  parseIso,
  periodStart,
  shiftBar,
  timeBands,
  toIso,
  todayIso,
} from "@/lib/wbs/gantt";
import { gridToHtml, gridToTsv } from "@/lib/wbs/grid";

function doc(tasks: WbsTask[], gantt: Partial<GanttSettings> = {}): WbsDoc {
  return {
    version: 1,
    settings: { ...defaultSettings(), projectName: "Harbour" },
    chart: defaultChart(),
    gantt: { ...defaultGantt(), ...gantt },
    fields: defaultFields(),
    tasks,
  };
}

function tree(): WbsTask[] {
  const scope = {
    ...newTask("Scope"),
    values: { start: "2026-03-02", finish: "2026-03-06", progress: 100, owner: "Ada" },
  };
  const budget = {
    ...newTask("Budget"),
    values: { start: "2026-03-09", finish: "2026-03-20", progress: 50, owner: "Bo" },
  };
  return [
    { ...newTask("Planning"), children: [scope, budget] },
    { ...newTask("Delivery"), values: { start: "2026-04-01", finish: "2026-04-10" } },
  ];
}

describe("date maths", () => {
  it("reads and writes ISO dates without a timezone shifting them", () => {
    expect(toIso(parseIso("2026-03-02")!)).toBe("2026-03-02");
    expect(parseIso("not a date")).toBe(null);
    expect(parseIso(null)).toBe(null);
  });

  it("adds days across a month boundary", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles the leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(dayDiff("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("counts the same day as no days apart", () => {
    expect(dayDiff("2026-03-02", "2026-03-02")).toBe(0);
  });

  it("knows a weekend from a weekday", () => {
    expect(isWeekend("2026-03-07")).toBe(true);
    expect(isWeekend("2026-03-08")).toBe(true);
    expect(isWeekend("2026-03-09")).toBe(false);
  });

  it("gives today as an ISO date", () => {
    expect(todayIso(new Date(2026, 2, 14))).toBe("2026-03-14");
  });
});

describe("periods", () => {
  it("snaps a week to its Monday", () => {
    expect(periodStart("2026-03-05", "week")).toBe("2026-03-02");
  });

  it("snaps a month and a quarter to the first", () => {
    expect(periodStart("2026-03-17", "month")).toBe("2026-03-01");
    expect(periodStart("2026-05-17", "quarter")).toBe("2026-04-01");
  });

  it("builds one column per day", () => {
    const { periods } = buildPeriods("2026-03-02", "2026-03-06", "day");
    expect(periods).toHaveLength(5);
    expect(periods[0].label).toBe("2 Mar");
  });

  it("builds one column per week, labelled by ISO week", () => {
    const { periods } = buildPeriods("2026-03-02", "2026-03-20", "week");
    expect(periods).toHaveLength(3);
    expect(periods[0].label).toMatch(/^W\d+$/);
  });

  it("builds months and quarters", () => {
    expect(buildPeriods("2026-01-05", "2026-04-20", "month").periods.map((p) => p.label)).toEqual([
      "Jan 2026",
      "Feb 2026",
      "Mar 2026",
      "Apr 2026",
    ]);
    expect(buildPeriods("2026-01-05", "2026-08-20", "quarter").periods.map((p) => p.label)).toEqual([
      "Q1 2026",
      "Q2 2026",
      "Q3 2026",
    ]);
  });

  it("rolls a month over the end of the year", () => {
    const { periods } = buildPeriods("2026-12-01", "2027-01-31", "month");
    expect(periods.map((p) => p.label)).toEqual(["Dec 2026", "Jan 2027"]);
  });

  it("marks weekend days", () => {
    const { periods } = buildPeriods("2026-03-06", "2026-03-09", "day");
    expect(periods.map((p) => p.weekend)).toEqual([false, true, true, false]);
  });

  it("stops rather than building thousands of columns", () => {
    const { periods, truncated } = buildPeriods("2020-01-01", "2030-01-01", "day");
    expect(truncated).toBe(true);
    expect(periods).toHaveLength(MAX_PERIODS);
  });
});

describe("the timeline window", () => {
  it("covers every dated task", () => {
    const d = doc(tree());
    expect(ganttRange(flatten(d), d.gantt)).toEqual({ start: "2026-03-02", end: "2026-04-10" });
  });

  it("can be pinned to chosen dates", () => {
    const d = doc(tree(), { rangeStart: "2026-01-01", rangeEnd: "2026-12-31" });
    expect(ganttRange(flatten(d), d.gantt)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("shows the month ahead when nothing has dates yet", () => {
    const d = doc([newTask("No dates")]);
    const range = ganttRange(flatten(d), d.gantt);
    expect(dayDiff(range.start, range.end)).toBe(30);
  });

  it("describes itself for a heading", () => {
    const d = doc(tree());
    expect(describeRange(ganttRange(flatten(d), d.gantt), d)).toContain("40 days");
  });
});

describe("bars", () => {
  it("spans a summary task across its children", () => {
    const d = doc(tree());
    const rows = flatten(d);
    const bars = ganttBars(d, rows, ganttRange(rows, d.gantt));
    const planning = bars.find((bar) => bar.row.name === "Planning")!;
    expect(planning.start).toBe("2026-03-02");
    expect(planning.end).toBe("2026-03-20");
    expect(planning.days).toBe(19);
  });

  it("counts a one-day task as one day", () => {
    const d = doc([{ ...newTask("Kickoff"), values: { start: "2026-03-02", finish: "2026-03-02" } }]);
    const rows = flatten(d);
    expect(ganttBars(d, rows, ganttRange(rows, d.gantt))[0].days).toBe(1);
  });

  it("treats a task with only one date as a milestone", () => {
    const d = doc([{ ...newTask("Launch"), values: { finish: "2026-03-09" } }]);
    const rows = flatten(d);
    const bar = ganttBars(d, rows, ganttRange(rows, d.gantt))[0];
    expect(bar.start).toBe("2026-03-09");
    expect(bar.days).toBe(1);
  });

  it("gives a task with no dates no bar at all", () => {
    const d = doc([newTask("Someday")]);
    const rows = flatten(d);
    const bar = ganttBars(d, rows, ganttRange(rows, d.gantt))[0];
    expect(bar.days).toBe(0);
    expect(bar.length).toBe(0);
  });

  it("places the first bar at the start of the timeline", () => {
    const d = doc(tree());
    const rows = flatten(d);
    const bars = ganttBars(d, rows, ganttRange(rows, d.gantt));
    const scope = bars.find((bar) => bar.row.name === "Scope")!;
    expect(scope.offset).toBe(0);
    expect(scope.length).toBeCloseTo(5 / 40, 5);
  });

  it("never runs a bar off the end of the timeline", () => {
    const d = doc(tree(), { rangeStart: "2026-03-01", rangeEnd: "2026-03-31" });
    const rows = flatten(d);
    for (const bar of ganttBars(d, rows, ganttRange(rows, d.gantt))) {
      expect(bar.offset + bar.length).toBeLessThanOrEqual(1);
    }
  });

  it("knows which periods a bar covers", () => {
    const d = doc(tree());
    const rows = flatten(d);
    const range = ganttRange(rows, d.gantt);
    const bars = ganttBars(d, rows, range);
    const scope = bars.find((bar) => bar.row.name === "Scope")!;
    const { periods } = buildPeriods(range.start, range.end, "week");
    expect(coversPeriod(scope, periods[0])).toBe(true);
    expect(coversPeriod(scope, periods[2])).toBe(false);
  });
});

describe("the Gantt sheet", () => {
  it("has a column per period and a row per task", () => {
    const d = doc(tree(), { scale: "week" });
    const grid = buildGanttGrid(d);
    expect(grid.rows).toHaveLength(4);
    expect(grid.columns.filter((column) => column.key.startsWith("p-"))).toHaveLength(6);
  });

  it("puts a block in the periods a task is running", () => {
    const d = doc(tree(), { scale: "week" });
    const grid = buildGanttGrid(d);
    const first = grid.columns.findIndex((column) => column.key.startsWith("p-"));
    const scope = grid.rows[1];
    expect(scope[first].text).toBe("█");
    expect(scope[first + 2].text).toBe("");
  });

  it("writes the dates as real dates, not text", () => {
    const d = doc(tree());
    const grid = buildGanttGrid(d);
    const column = grid.columns.findIndex((entry) => entry.key === "start");
    expect(grid.rows[1][column].kind).toBe("date");
    expect(typeof grid.rows[1][column].value).toBe("number");
  });

  it("includes the duration the sheet works out", () => {
    const d = doc(tree());
    const grid = buildGanttGrid(d);
    const column = grid.columns.findIndex((entry) => entry.key === "duration");
    expect(grid.rows[1][column].value).toBe(5);
  });

  it("leads with the same columns as the WBS sheet, then the periods", () => {
    const d = doc(tree(), { scale: "month" });
    const labels = buildGanttGrid(d).columns.map((column) => column.label);
    expect(labels.slice(0, 8)).toEqual([
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

  it("carries the sheet's own columns, so the structure matches", () => {
    const d = doc(tree());
    const grid = buildGanttGrid(d);
    expect(grid.columns.some((column) => column.key === "owner")).toBe(true);
    expect(grid.columns.some((column) => column.key === "timeline")).toBe(true);
  });

  it("indents the task names the way the sheet export does", () => {
    const d = doc(tree());
    const grid = buildGanttGrid(d);
    const column = grid.columns.findIndex((entry) => entry.key === "name");
    expect(grid.rows[1][column].text).toBe("    Scope");
  });

  it("groups the rows so branches fold in Excel", () => {
    const d = doc(tree());
    expect(buildGanttGrid(d).outline).toEqual([0, 1, 1, 0]);
  });
});

describe("copying to a spreadsheet", () => {
  it("separates cells with tabs and rows with CRLF", () => {
    const d = doc(tree(), { scale: "month" });
    const tsv = gridToTsv(buildGanttGrid(d));
    const lines = tsv.split("\r\n");
    expect(lines).toHaveLength(5);
    expect(lines[0].split("\t").length).toBe(buildGanttGrid(d).columns.length);
  });

  it("never lets a cell's own tabs or newlines break a column", () => {
    const d = doc([{ ...newTask("Two\tparts\nhere"), values: { start: "2026-03-02", finish: "2026-03-03" } }]);
    const tsv = gridToTsv(buildGanttGrid(d));
    expect(tsv.split("\r\n")).toHaveLength(2);
    expect(tsv).toContain("Two parts here");
  });

  it("also offers an HTML table, with codes marked as text", () => {
    const d = doc(tree(), { scale: "month" });
    const html = gridToHtml(buildGanttGrid(d));
    expect(html.startsWith("<table>")).toBe(true);
    expect(html).toContain("mso-number-format");
    expect(html).toContain("Planning");
  });

  it("escapes markup in a task name", () => {
    const d = doc([newTask("<script>&")]);
    expect(gridToHtml(buildGanttGrid(d))).toContain("&lt;script&gt;&amp;");
  });
});

describe("what Excel actually receives", () => {
  it("keeps the outline indent, which HTML would otherwise collapse", () => {
    const d = doc(tree(), { scale: "month" });
    const html = gridToHtml(buildGanttGrid(d));
    expect(html).toContain("&nbsp;&nbsp;&nbsp;&nbsp;Scope");
  });

  it("keeps the block characters that draw the bar", () => {
    const d = doc(tree(), { scale: "month" });
    const grid = buildGanttGrid(d);
    expect(gridToTsv(grid)).toContain("█");
    expect(gridToHtml(grid)).toContain("█");
  });
});

describe("collapsed branches", () => {
  it("still appear in the copy and the download", () => {
    const tasks = tree();
    const collapsed = [{ ...tasks[0], collapsed: true }, tasks[1]];
    const d = doc(collapsed);
    expect(buildGanttGrid(d).rows).toHaveLength(4);
  });
});

describe("the band above the columns", () => {
  it("groups day columns under their month", () => {
    const { periods } = buildPeriods("2026-02-26", "2026-03-03", "day");
    const bands = timeBands(periods, "day");
    expect(bands.map((band) => [band.label, band.span])).toEqual([
      ["Feb 2026", 3],
      ["Mar 2026", 3],
    ]);
  });

  it("groups week columns under their month", () => {
    const { periods } = buildPeriods("2026-03-02", "2026-04-10", "week");
    const bands = timeBands(periods, "week");
    expect(bands.map((band) => band.label)).toEqual(["Mar 2026", "Apr 2026"]);
  });

  it("groups months and quarters under their year", () => {
    const { periods } = buildPeriods("2026-11-01", "2027-02-01", "month");
    expect(timeBands(periods, "month").map((band) => [band.label, band.span])).toEqual([
      ["2026", 2],
      ["2027", 2],
    ]);
  });

  it("covers exactly as many columns as there are periods", () => {
    const { periods } = buildPeriods("2026-01-01", "2026-12-31", "week");
    const total = timeBands(periods, "week").reduce((sum, band) => sum + band.span, 0);
    expect(total).toBe(periods.length);
  });
});

describe("milestones", () => {
  it("marks a one-day work package as a milestone", () => {
    const d = doc([{ ...newTask("Launch"), values: { start: "2026-03-09", finish: "2026-03-09" } }]);
    const rows = flatten(d);
    expect(ganttBars(d, rows, ganttRange(rows, d.gantt))[0].milestone).toBe(true);
  });

  it("does not mark a summary task as a milestone", () => {
    const child = { ...newTask("One day"), values: { start: "2026-03-09", finish: "2026-03-09" } };
    const d = doc([{ ...newTask("Phase"), children: [child] }]);
    const rows = flatten(d);
    const bars = ganttBars(d, rows, ganttRange(rows, d.gantt));
    expect(bars[0].milestone).toBe(false);
    expect(bars[1].milestone).toBe(true);
  });
});

describe("dragging a bar", () => {
  function bar() {
    const d = doc(tree());
    const rows = flatten(d);
    return ganttBars(d, rows, ganttRange(rows, d.gantt)).find((b) => b.row.name === "Scope")!;
  }

  it("moves both ends together", () => {
    expect(shiftBar(bar(), 3, "move")).toEqual({ start: "2026-03-05", end: "2026-03-09" });
  });

  it("moves one end when an edge is dragged", () => {
    expect(shiftBar(bar(), -2, "start")).toEqual({ start: "2026-02-28", end: "2026-03-06" });
    expect(shiftBar(bar(), 4, "end")).toEqual({ start: "2026-03-02", end: "2026-03-10" });
  });

  it("never lets a task finish before it starts", () => {
    expect(shiftBar(bar(), 30, "start")).toEqual({ start: "2026-03-06", end: "2026-03-06" });
    expect(shiftBar(bar(), -30, "end")).toEqual({ start: "2026-03-02", end: "2026-03-02" });
  });

  it("does nothing for a task with no dates", () => {
    const d = doc([newTask("Someday")]);
    const rows = flatten(d);
    const none = ganttBars(d, rows, ganttRange(rows, d.gantt))[0];
    expect(shiftBar(none, 5, "move")).toBe(null);
  });
});
