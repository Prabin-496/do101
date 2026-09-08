import { describe, expect, it } from "vitest";
import {
  buildMonth, daysBetween, dayOfYear, describeDay, isLeapYear, isoWeek,
  relativeDay, daysInMonth,
} from "../src/lib/calendar/grid";
import {
  derivedTitle, fromMarkdown, newNote, preview, searchNotes, sortNotes,
  toMarkdown, wordCount, type Note,
} from "../src/lib/notes/store";
import { CATEGORY_LABELS, SHORTCUTS, searchShortcuts } from "../src/lib/excel/shortcuts";
import { DEFAULT_WORKSPACE, LAYOUT_MAP, PANES, normalise } from "../src/lib/workspace/panes";

describe("calendar maths", () => {
  it("knows which years are leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(1900)).toBe(false); // divisible by 100
    expect(isLeapYear(2000)).toBe(true);  // but also by 400
  });

  it("counts the days in a month, February included", () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2025, 1)).toBe(28);
    expect(daysInMonth(2025, 0)).toBe(31);
    expect(daysInMonth(2025, 3)).toBe(30);
  });

  it("computes ISO week numbers, including the awkward year boundaries", () => {
    // 1 Jan 2021 was a Friday, so it belongs to week 53 of 2020.
    expect(isoWeek(new Date(2021, 0, 1))).toBe(53);
    // 4 Jan is always in week 1 by definition.
    expect(isoWeek(new Date(2021, 0, 4))).toBe(1);
    expect(isoWeek(new Date(2024, 0, 1))).toBe(1);
    expect(isoWeek(new Date(2026, 8, 9))).toBe(37);
  });

  it("counts the day of the year across a leap day", () => {
    expect(dayOfYear(new Date(2024, 0, 1))).toBe(1);
    expect(dayOfYear(new Date(2024, 1, 29))).toBe(60);
    expect(dayOfYear(new Date(2024, 11, 31))).toBe(366);
    expect(dayOfYear(new Date(2025, 11, 31))).toBe(365);
  });

  it("counts whole days between dates regardless of the clock", () => {
    expect(daysBetween(new Date(2025, 0, 1), new Date(2025, 0, 2))).toBe(1);
    expect(daysBetween(new Date(2025, 0, 2), new Date(2025, 0, 1))).toBe(-1);
    expect(daysBetween(new Date(2024, 1, 28), new Date(2024, 2, 1))).toBe(2);
    // Across a daylight-saving change, where adding 24-hour blocks drifts.
    expect(daysBetween(new Date(2025, 2, 29), new Date(2025, 2, 31))).toBe(2);
  });

  it("builds a six-row grid whatever the month", () => {
    for (let month = 0; month < 12; month += 1) {
      const grid = buildMonth(2025, month);
      expect(grid.weeks, `month ${month}`).toHaveLength(6);
      for (const week of grid.weeks) expect(week).toHaveLength(7);
    }
  });

  it("starts the grid on the requested weekday", () => {
    const monday = buildMonth(2025, 0, { weekStartsMonday: true });
    expect(monday.weeks[0][0].date.getDay()).toBe(1);
    const sunday = buildMonth(2025, 0, { weekStartsMonday: false });
    expect(sunday.weeks[0][0].date.getDay()).toBe(0);
  });

  it("contains every day of the month exactly once", () => {
    const grid = buildMonth(2025, 1);
    const inMonth = grid.weeks.flat().filter((cell) => cell.inMonth);
    expect(inMonth).toHaveLength(28);
    expect(new Set(inMonth.map((c) => c.day)).size).toBe(28);
  });

  it("marks today, and only today", () => {
    const today = new Date(2025, 5, 15);
    const grid = buildMonth(2025, 5, { today });
    const marked = grid.weeks.flat().filter((cell) => cell.isToday);
    expect(marked).toHaveLength(1);
    expect(marked[0].day).toBe(15);
  });

  it("describes a date consistently", () => {
    const facts = describeDay(new Date(2024, 1, 29), new Date(2024, 1, 28));
    expect(facts.iso).toBe("2024-02-29");
    expect(facts.dayOfYear).toBe(60);
    expect(facts.daysLeftInYear).toBe(306);
    expect(facts.quarter).toBe(1);
    expect(facts.fromToday).toBe(1);
    expect(facts.leapYear).toBe(true);
  });

  it("puts dates in words", () => {
    expect(relativeDay(0)).toBe("Today");
    expect(relativeDay(1)).toBe("Tomorrow");
    expect(relativeDay(-1)).toBe("Yesterday");
    expect(relativeDay(5)).toMatch(/5 days from now/);
    expect(relativeDay(-30)).toMatch(/ago/);
  });
});

describe("notes", () => {
  const make = (overrides: Partial<Note>): Note => ({ ...newNote(), ...overrides });

  it("gives every note a distinct id", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newNote().id));
    expect(ids.size).toBe(200);
  });

  it("puts pinned notes first, then the most recently edited", () => {
    const notes = [
      make({ id: "a", updated: 100 }),
      make({ id: "b", updated: 300 }),
      make({ id: "c", updated: 200, pinned: true }),
    ];
    expect(sortNotes(notes).map((n) => n.id)).toEqual(["c", "b", "a"]);
  });

  it("falls back to the first line when a note has no title", () => {
    expect(derivedTitle(make({ title: "", body: "Shopping list\nmilk" }))).toBe("Shopping list");
    expect(derivedTitle(make({ title: "Real title", body: "body" }))).toBe("Real title");
    expect(derivedTitle(make({ title: "", body: "" }))).toBe("Untitled note");
  });

  it("does not repeat the title in the preview", () => {
    const note = make({ title: "", body: "First line\nSecond line" });
    expect(preview(note)).toBe("Second line");
  });

  it("searches titles and bodies, case-insensitively", () => {
    const notes = [
      make({ id: "a", title: "Groceries", body: "" }),
      make({ id: "b", title: "", body: "Buy MILK" }),
      make({ id: "c", title: "Other", body: "nothing" }),
    ];
    expect(searchNotes(notes, "milk").map((n) => n.id)).toEqual(["b"]);
    expect(searchNotes(notes, "GROCER").map((n) => n.id)).toEqual(["a"]);
    expect(searchNotes(notes, "")).toHaveLength(3);
  });

  it("counts words the way the rest of the site does", () => {
    expect(wordCount("one two three")).toBe(3);
    expect(wordCount("well-known isn't two")).toBe(3);
    expect(wordCount("")).toBe(0);
  });

  it("survives an export and re-import", () => {
    const notes = [
      make({ title: "First", body: "Body of the first note.\nWith two lines." }),
      make({ title: "Second", body: "Another note." }),
    ];
    const restored = fromMarkdown(toMarkdown(notes));
    expect(restored).toHaveLength(2);
    expect(restored.map((n) => n.title).sort()).toEqual(["First", "Second"]);
    expect(restored.find((n) => n.title === "First")!.body).toContain("With two lines.");
  });

  it("imports a plain text file as a single note", () => {
    const restored = fromMarkdown("just some text with no heading");
    expect(restored).toHaveLength(1);
    expect(restored[0].body).toBe("just some text with no heading");
  });
});

describe("excel shortcuts", () => {
  it("gives every shortcut both platforms, an action and a use case", () => {
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.windows, shortcut.action).toBeTruthy();
      expect(shortcut.mac, shortcut.action).toBeTruthy();
      expect(shortcut.action).toBeTruthy();
      // The use case is the point of the tool, so it must never be a stub.
      expect(shortcut.useCase.length, shortcut.action).toBeGreaterThan(20);
    }
  });

  it("uses a known category for every entry", () => {
    for (const shortcut of SHORTCUTS) {
      expect(CATEGORY_LABELS[shortcut.category], shortcut.action).toBeDefined();
    }
  });

  it("marks a missing binding rather than inventing one", () => {
    for (const shortcut of SHORTCUTS) {
      // An em dash is the explicit "no default shortcut" marker.
      if (shortcut.mac === "—") continue;
      expect(shortcut.mac, shortcut.action).not.toMatch(/^\s*$/);
    }
  });

  it("lists no duplicate actions", () => {
    const actions = SHORTCUTS.map((s) => `${s.category}:${s.action}`);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it("searches by intent, not just by keys", () => {
    const found = searchShortcuts("filter", "all");
    expect(found.some((s) => s.action.includes("filter"))).toBe(true);
    expect(searchShortcuts("", "formulas").every((s) => s.category === "formulas")).toBe(true);
    expect(searchShortcuts("zzzznothing", "all")).toHaveLength(0);
  });

  it("keeps the starred shortlist short enough to be useful", () => {
    const essentials = SHORTCUTS.filter((s) => s.essential);
    expect(essentials.length).toBeGreaterThan(10);
    expect(essentials.length).toBeLessThan(40);
  });
});

describe("workspace state", () => {
  it("accepts its own default", () => {
    expect(normalise(DEFAULT_WORKSPACE)).toEqual(DEFAULT_WORKSPACE);
  });

  it("repairs a stored layout from an older version", () => {
    const state = normalise({ layout: "seven-columns" as never, panes: ["nope" as never] });
    expect(LAYOUT_MAP.has(state.layout)).toBe(true);
    expect(state.panes[0]).toBe("empty");
  });

  it("always fills every slot the layout needs", () => {
    for (const layout of LAYOUT_MAP.keys()) {
      const state = normalise({ layout, panes: [] });
      const cells = LAYOUT_MAP.get(layout)!.cells;
      for (let i = 0; i < cells; i += 1) {
        expect(state.panes[i], `${layout} slot ${i}`).toBeDefined();
      }
    }
  });

  it("rejects sizes that would collapse a pane", () => {
    const state = normalise({ ...DEFAULT_WORKSPACE, sizes: [0, 99, -1, Number.NaN] });
    for (const size of state.sizes) {
      expect(size).toBeGreaterThan(0);
      expect(Number.isFinite(size)).toBe(true);
    }
  });

  it("handles null, which is what an empty storage key returns", () => {
    expect(() => normalise(null)).not.toThrow();
    expect(LAYOUT_MAP.has(normalise(null).layout)).toBe(true);
  });

  it("points every pane at a real tool route", () => {
    for (const pane of PANES) {
      expect(pane.route, pane.name).toMatch(/^\//);
      expect(pane.name).toBeTruthy();
      expect(typeof pane.load).toBe("function");
    }
  });
});
