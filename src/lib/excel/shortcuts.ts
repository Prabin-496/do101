/**
 * Excel keyboard shortcuts.
 *
 * Each entry carries both key sets and, more importantly, what the shortcut is
 * actually for. A list of key combinations is easy to find and useless to read;
 * knowing that Ctrl+Shift+L is how you stop retyping filters is the part that
 * changes how someone works.
 *
 * Mac keys use the symbols printed on the keyboard: ⌘ command, ⌥ option,
 * ⌃ control, ⇧ shift.
 */

export type ShortcutCategory =
  | "essentials"
  | "navigation"
  | "selection"
  | "editing"
  | "formatting"
  | "formulas"
  | "rows-columns"
  | "workbook"
  | "data"
  | "view"
  | "paste";

export interface Shortcut {
  windows: string;
  mac: string;
  action: string;
  /** When you would actually reach for it. */
  useCase: string;
  category: ShortcutCategory;
  /** Marks the handful worth learning first. */
  essential?: boolean;
}

export const CATEGORY_LABELS: Record<ShortcutCategory, { label: string; icon: string }> = {
  essentials: { label: "Start here", icon: "⭐" },
  navigation: { label: "Moving around", icon: "🧭" },
  selection: { label: "Selecting", icon: "🔲" },
  editing: { label: "Editing", icon: "✏️" },
  formatting: { label: "Formatting", icon: "🎨" },
  formulas: { label: "Formulas", icon: "🧮" },
  "rows-columns": { label: "Rows & columns", icon: "📐" },
  workbook: { label: "Files & sheets", icon: "📁" },
  data: { label: "Data & filters", icon: "🔍" },
  view: { label: "View & windows", icon: "🖥️" },
  paste: { label: "Paste Special", icon: "📋" },
};

export const SHORTCUTS: Shortcut[] = [
  // Essentials
  { windows: "Ctrl + Z", mac: "⌘ + Z", action: "Undo", useCase: "The first thing to learn. Excel keeps a long undo history, so you can step back through several mistakes.", category: "essentials", essential: true },
  { windows: "Ctrl + Y", mac: "⌘ + Y", action: "Redo", useCase: "Steps forward again after undoing one step too many.", category: "essentials", essential: true },
  { windows: "Ctrl + S", mac: "⌘ + S", action: "Save", useCase: "Press it after every meaningful change. AutoSave only covers files stored in OneDrive or SharePoint.", category: "essentials", essential: true },
  { windows: "Ctrl + C", mac: "⌘ + C", action: "Copy", useCase: "The marching-ants border stays active, so you can paste the same thing into several places.", category: "essentials", essential: true },
  { windows: "Ctrl + V", mac: "⌘ + V", action: "Paste", useCase: "Pastes everything: values, formulas, formatting and validation.", category: "essentials", essential: true },
  { windows: "Ctrl + X", mac: "⌘ + X", action: "Cut", useCase: "Moving cells with cut keeps formulas pointing at them correct, which retyping does not.", category: "essentials", essential: true },
  { windows: "Ctrl + F", mac: "⌘ + F", action: "Find", useCase: "Searching a sheet for a value. Add Options to search the whole workbook rather than one sheet.", category: "essentials", essential: true },
  { windows: "Ctrl + H", mac: "⌃ + H", action: "Find and Replace", useCase: "Cleaning imported data — stripping stray characters, fixing inconsistent spellings across thousands of rows at once.", category: "essentials", essential: true },
  { windows: "Ctrl + P", mac: "⌘ + P", action: "Print", useCase: "Opens print preview, where you can check the page breaks before wasting paper.", category: "essentials" },

  // Navigation
  { windows: "Ctrl + Arrow", mac: "⌘ + Arrow", action: "Jump to the edge of the data", useCase: "The fastest way to the bottom of a long column. Also tells you where your data actually ends, which matters when a stray value is sitting 4,000 rows down.", category: "navigation", essential: true },
  { windows: "Ctrl + Home", mac: "⌘ + Fn + ←", action: "Go to cell A1", useCase: "Getting back to the top of a sheet from anywhere.", category: "navigation", essential: true },
  { windows: "Ctrl + End", mac: "⌘ + Fn + →", action: "Go to the last used cell", useCase: "Shows the real extent of the sheet. If it lands far past your data, there is invisible formatting bloating the file size.", category: "navigation" },
  { windows: "Ctrl + Page Down", mac: "⌥ + →", action: "Next worksheet", useCase: "Moving between sheets without reaching for the mouse.", category: "navigation", essential: true },
  { windows: "Ctrl + Page Up", mac: "⌥ + ←", action: "Previous worksheet", useCase: "Moving back through sheets. Hold it down to run through a whole workbook quickly.", category: "navigation" },
  { windows: "Ctrl + G", mac: "⌃ + G", action: "Go To", useCase: "Type a cell reference to jump straight there. Go To Special underneath it is where the real power is.", category: "navigation" },
  { windows: "F5", mac: "F5", action: "Go To dialog", useCase: "Same as Ctrl+G, and the route to Go To Special.", category: "navigation" },
  { windows: "Alt + Page Down", mac: "⌥ + Fn + ↓", action: "One screen right", useCase: "Scanning across a wide sheet a screen at a time.", category: "navigation" },
  { windows: "Home", mac: "Fn + ←", action: "Start of the row", useCase: "Back to column A on the current row, without leaving the row you are reading.", category: "navigation" },
  { windows: "Ctrl + Tab", mac: "⌘ + `", action: "Next open workbook", useCase: "Switching between two files you are comparing.", category: "navigation" },

  // Selection
  { windows: "Ctrl + A", mac: "⌘ + A", action: "Select the current region, then the whole sheet", useCase: "Pressing it once selects the block of data you are inside; pressing it again takes the entire sheet.", category: "selection", essential: true },
  { windows: "Ctrl + Shift + Arrow", mac: "⌘ + ⇧ + Arrow", action: "Select to the edge of the data", useCase: "The standard way to select a whole column of data without dragging or catching the empty rows below it.", category: "selection", essential: true },
  { windows: "Ctrl + Space", mac: "⌃ + Space", action: "Select the entire column", useCase: "Before formatting or deleting a whole column.", category: "selection", essential: true },
  { windows: "Shift + Space", mac: "⇧ + Space", action: "Select the entire row", useCase: "Selects the whole row. Follow it with Ctrl and minus to delete the row outright.", category: "selection", essential: true },
  { windows: "Shift + Arrow", mac: "⇧ + Arrow", action: "Extend the selection one cell", useCase: "Nudging a selection by one cell when Ctrl+Shift+Arrow overshoots past a blank.", category: "selection" },
  { windows: "Ctrl + Shift + End", mac: "⌘ + ⇧ + Fn + →", action: "Select to the last used cell", useCase: "Grabbing everything from here to the end of the data in one press.", category: "selection" },
  { windows: "Ctrl + Shift + Space", mac: "⌃ + ⇧ + Space", action: "Select the whole table or sheet", useCase: "Inside a Table it selects the table; outside it takes the sheet.", category: "selection" },
  { windows: "Alt + ;", mac: "⌘ + ⇧ + Z", action: "Select visible cells only", useCase: "Essential after filtering. Copying a filtered range without this quietly copies the hidden rows too.", category: "selection", essential: true },
  { windows: "Ctrl + Shift + O", mac: "⌃ + ⇧ + O", action: "Select all cells with comments", useCase: "Finding every note left in a workbook before sending it on.", category: "selection" },

  // Editing
  { windows: "F2", mac: "⌃ + U", action: "Edit the active cell", useCase: "Puts the cursor inside the cell instead of overwriting it. Also shows which cells a formula refers to, colour-coded.", category: "editing", essential: true },
  { windows: "Ctrl + D", mac: "⌘ + D", action: "Fill down", useCase: "Copies the cell above into the selection. Faster than dragging the fill handle down 500 rows.", category: "editing", essential: true },
  { windows: "Ctrl + R", mac: "⌘ + R", action: "Fill right", useCase: "Copies the cell to the left across the selection — useful for filling a row of month columns.", category: "editing", essential: true },
  { windows: "Alt + Enter", mac: "⌃ + ⌥ + Enter", action: "New line inside a cell", useCase: "Multi-line addresses or notes in one cell, without a merged mess.", category: "editing", essential: true },
  { windows: "Ctrl + Enter", mac: "⌃ + Enter", action: "Fill the whole selection with what you typed", useCase: "Select a range, type once, press this — every selected cell gets it. Excellent for filling gaps.", category: "editing", essential: true },
  { windows: "Ctrl + ;", mac: "⌃ + ;", action: "Insert today's date", useCase: "A fixed date, unlike TODAY(), so it will not change tomorrow.", category: "editing" },
  { windows: "Ctrl + Shift + ;", mac: "⌘ + ;", action: "Insert the current time", useCase: "Timestamping a row as you work through a list.", category: "editing" },
  { windows: "Ctrl + '", mac: "⌃ + '", action: "Copy the formula from the cell above", useCase: "Copies the formula text exactly, without adjusting the references.", category: "editing" },
  { windows: "Esc", mac: "Esc", action: "Cancel the edit", useCase: "Backs out of a cell without saving what you typed.", category: "editing" },
  { windows: "Ctrl + K", mac: "⌘ + K", action: "Insert a hyperlink", useCase: "Linking to a source file or a sheet elsewhere in the workbook.", category: "editing" },

  // Formatting
  { windows: "Ctrl + 1", mac: "⌘ + 1", action: "Format Cells dialog", useCase: "The single most useful shortcut in Excel. Number formats, alignment, borders, custom formats — all behind one key.", category: "formatting", essential: true },
  { windows: "Ctrl + B", mac: "⌘ + B", action: "Bold", useCase: "Marking header rows and totals so the eye finds the structure quickly.", category: "formatting", essential: true },
  { windows: "Ctrl + I", mac: "⌘ + I", action: "Italic", useCase: "Notes and caveats beside figures, where you want them visibly secondary.", category: "formatting" },
  { windows: "Ctrl + U", mac: "⌘ + U", action: "Underline", useCase: "Rarely the right choice in a spreadsheet — a bottom border usually reads better.", category: "formatting" },
  { windows: "Ctrl + Shift + $", mac: "⌃ + ⇧ + $", action: "Currency format", useCase: "Two decimals and a thousands separator in one press.", category: "formatting", essential: true },
  { windows: "Ctrl + Shift + %", mac: "⌃ + ⇧ + %", action: "Percentage format", useCase: "Careful: 0.15 becomes 15%, but 15 becomes 1500%.", category: "formatting", essential: true },
  { windows: "Ctrl + Shift + #", mac: "⌃ + ⇧ + #", action: "Date format", useCase: "Turning a serial number back into a readable date.", category: "formatting" },
  { windows: "Ctrl + Shift + ~", mac: "⌃ + ⇧ + ~", action: "General format", useCase: "Strips a number format to see the raw stored value — the quickest way to check whether a date is really a date.", category: "formatting", essential: true },
  { windows: "Ctrl + Shift + &", mac: "⌘ + ⌥ + 0", action: "Add an outline border", useCase: "Boxes off a block of figures, which reads better than underlining a total.", category: "formatting" },
  { windows: "Ctrl + Shift + _", mac: "⌘ + ⌥ + _", action: "Remove all borders", useCase: "Undoing inherited border formatting from pasted data.", category: "formatting" },
  { windows: "Alt + H, A, C", mac: "⌘ + E", action: "Centre align", useCase: "Headers. Leave the numbers right-aligned so the digits line up.", category: "formatting" },

  // Formulas
  { windows: "=", mac: "=", action: "Start a formula", useCase: "Excel treats anything starting with = as a formula. Typing + or - first also works, a habit from Lotus 1-2-3.", category: "formulas", essential: true },
  { windows: "Alt + =", mac: "⌘ + ⇧ + T", action: "AutoSum", useCase: "Excel guesses the range above or to the left. Check the guess before pressing Enter.", category: "formulas", essential: true },
  { windows: "F4", mac: "⌘ + T", action: "Cycle absolute and relative references", useCase: "Press it while the cursor is on a reference to toggle A1 → $A$1 → A$1 → $A1. The fix for formulas that break when copied.", category: "formulas", essential: true },
  { windows: "F9", mac: "Fn + F9", action: "Evaluate the selected part of a formula", useCase: "Select part of a long formula in the formula bar and press this to see what that piece returns. The best debugging tool Excel has.", category: "formulas", essential: true },
  { windows: "Ctrl + `", mac: "⌃ + `", action: "Show all formulas", useCase: "Switches the sheet to showing formulas instead of results — how you audit an inherited workbook.", category: "formulas", essential: true },
  { windows: "Ctrl + Shift + Enter", mac: "⌃ + ⇧ + Enter", action: "Enter as an array formula", useCase: "Only needed in older Excel. Modern versions spill arrays automatically.", category: "formulas" },
  { windows: "F3", mac: "F3", action: "Paste a name into a formula", useCase: "Using named ranges without remembering exactly what you called them.", category: "formulas" },
  { windows: "Ctrl + Shift + U", mac: "⌃ + ⇧ + U", action: "Expand the formula bar", useCase: "Reading a long nested formula without scrolling sideways.", category: "formulas" },
  { windows: "Ctrl + [", mac: "⌃ + [", action: "Go to the cells this formula refers to", useCase: "Tracing where a number came from, one hop at a time.", category: "formulas" },
  { windows: "Ctrl + ]", mac: "⌃ + ]", action: "Go to the cells that refer to this one", useCase: "Checking what will break before you change or delete a cell.", category: "formulas" },

  // Rows and columns
  { windows: "Ctrl + Shift + +", mac: "⌃ + ⇧ + +", action: "Insert rows or columns", useCase: "Select whole rows first and it inserts that many at once.", category: "rows-columns", essential: true },
  { windows: "Ctrl + -", mac: "⌘ + -", action: "Delete rows or columns", useCase: "With a whole row selected it deletes without asking.", category: "rows-columns", essential: true },
  { windows: "Ctrl + 9", mac: "⌃ + 9", action: "Hide rows", useCase: "Tucking away intermediate calculations before printing or sharing a sheet.", category: "rows-columns" },
  { windows: "Ctrl + Shift + 9", mac: "⌃ + ⇧ + 9", action: "Unhide rows", useCase: "Select rows either side of the hidden ones first, then press this to bring them back.", category: "rows-columns" },
  { windows: "Ctrl + 0", mac: "⌃ + 0", action: "Hide columns", useCase: "Same idea sideways. Grouping is usually a better habit than hiding.", category: "rows-columns" },
  { windows: "Alt + H, O, I", mac: "—", action: "AutoFit column width", useCase: "Sizes columns to their content. Double-clicking the column border does the same thing.", category: "rows-columns" },
  { windows: "Alt + Shift + →", mac: "⌘ + ⇧ + K", action: "Group rows or columns", useCase: "Collapsible sections beat hidden rows, because the little +/- tells the next reader something is there.", category: "rows-columns" },
  { windows: "Alt + Shift + ←", mac: "⌘ + ⇧ + J", action: "Ungroup", useCase: "Flattens a grouped section back out when the outline is getting in the way.", category: "rows-columns" },

  // Workbook and sheets
  { windows: "Ctrl + N", mac: "⌘ + N", action: "New workbook", useCase: "A clean file for scratch work, so you are not testing something risky in the real workbook.", category: "workbook" },
  { windows: "Ctrl + O", mac: "⌘ + O", action: "Open", useCase: "Straight to the file browser, including the recent files list.", category: "workbook" },
  { windows: "Ctrl + W", mac: "⌘ + W", action: "Close the workbook", useCase: "Closes this workbook but leaves Excel open, prompting for unsaved changes.", category: "workbook" },
  { windows: "F12", mac: "⌘ + ⇧ + S", action: "Save As", useCase: "Making a dated copy before a big change — the cheapest insurance there is.", category: "workbook", essential: true },
  { windows: "Shift + F11", mac: "⇧ + F11", action: "Insert a new worksheet", useCase: "Adds a worksheet immediately before the current one, ready to name.", category: "workbook" },
  { windows: "Alt + F4", mac: "⌘ + Q", action: "Close Excel", useCase: "Closes every workbook and quits Excel, prompting for anything unsaved.", category: "workbook" },

  // Data and filters
  { windows: "Ctrl + Shift + L", mac: "⌘ + ⇧ + F", action: "Toggle filters", useCase: "Turns the filter dropdowns on and off. Toggling clears every filter at once, which is faster than reopening each one.", category: "data", essential: true },
  { windows: "Alt + ↓", mac: "⌥ + ↓", action: "Open the filter dropdown", useCase: "Filtering entirely from the keyboard, once the cursor is on a header cell.", category: "data" },
  { windows: "Ctrl + T", mac: "⌃ + T", action: "Create a Table", useCase: "Tables grow automatically, keep formulas consistent down a column, and give ranges readable names. Worth doing to almost any dataset.", category: "data", essential: true },
  { windows: "Ctrl + Shift + T", mac: "—", action: "Toggle the Total row", useCase: "Adds a summary row to a Table with a choice of function.", category: "data" },
  { windows: "Alt + A, S, S", mac: "—", action: "Sort dialog", useCase: "Multi-level sorting. Always sort the whole table, never one column on its own.", category: "data" },
  { windows: "Ctrl + Shift + P", mac: "⌘ + ⇧ + P", action: "Format Cells: font tab", useCase: "Jumps to the font tab of Format Cells, skipping the number and alignment tabs.", category: "data" },
  { windows: "Alt + A, R, A", mac: "—", action: "Clear all filters", useCase: "Showing everything again without hunting through each dropdown.", category: "data" },
  { windows: "Alt + N, V", mac: "—", action: "Insert PivotTable", useCase: "The fastest route to summarising thousands of rows.", category: "data" },

  // View
  { windows: "Ctrl + Shift + F1", mac: "⌘ + ⌥ + R", action: "Toggle the ribbon", useCase: "Collapses the ribbon to reclaim a couple of rows of screen on a laptop.", category: "view" },
  { windows: "Alt + W, F, F", mac: "—", action: "Freeze panes", useCase: "Keeps headers visible while you scroll. Put the cursor below and right of what you want frozen first.", category: "view", essential: true },
  { windows: "Ctrl + F1", mac: "⌘ + ⌥ + R", action: "Collapse the ribbon", useCase: "The same ribbon toggle with fewer keys on Windows. Click any tab to use it while collapsed.", category: "view" },
  { windows: "Ctrl + Scroll", mac: "⌘ + Scroll", action: "Zoom", useCase: "Zooming out to see the shape of a large sheet.", category: "view" },
  { windows: "Alt + W, S", mac: "—", action: "Split the window", useCase: "Comparing two distant parts of the same sheet.", category: "view" },
  { windows: "Ctrl + F9", mac: "⌘ + M", action: "Minimise the window", useCase: "Drops the window out of the way without closing anything you are working on.", category: "view" },

  // Paste Special
  { windows: "Ctrl + Alt + V", mac: "⌃ + ⌘ + V", action: "Paste Special dialog", useCase: "The gateway to pasting values, formats or formulas separately.", category: "paste", essential: true },
  { windows: "Ctrl + Alt + V, then V", mac: "⌃ + ⌘ + V, then V", action: "Paste values only", useCase: "Stripping formulas so numbers stop changing. The most-used paste in any finance team.", category: "paste", essential: true },
  { windows: "Ctrl + Alt + V, then T", mac: "⌃ + ⌘ + V, then T", action: "Paste formats only", useCase: "Copying the look of one range onto another without touching the data.", category: "paste" },
  { windows: "Ctrl + Alt + V, then F", mac: "⌃ + ⌘ + V, then F", action: "Paste formulas only", useCase: "Bringing formulas across without dragging the source formatting with them.", category: "paste" },
  { windows: "Ctrl + Alt + V, then E", mac: "⌃ + ⌘ + V, then E", action: "Paste transposed", useCase: "Flipping a row into a column. Handy when a report arrives the wrong way round.", category: "paste" },
  { windows: "Ctrl + Alt + V, then W", mac: "⌃ + ⌘ + V, then W", action: "Paste column widths", useCase: "Making a copied sheet match the original's layout.", category: "paste" },
];

export function searchShortcuts(query: string, category: ShortcutCategory | "all"): Shortcut[] {
  const needle = query.trim().toLowerCase();
  return SHORTCUTS.filter((shortcut) => {
    if (category !== "all" && shortcut.category !== category) return false;
    if (!needle) return true;
    return (
      shortcut.action.toLowerCase().includes(needle) ||
      shortcut.useCase.toLowerCase().includes(needle) ||
      shortcut.windows.toLowerCase().includes(needle) ||
      shortcut.mac.toLowerCase().includes(needle)
    );
  });
}
