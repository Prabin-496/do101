/**
 * Office polish the spreadsheet library cannot write itself.
 *
 * SheetJS's community build writes values, number formats, widths, filters and
 * formulas, but not styling — so the workbook it produces is correct and
 * completely plain. This adds the parts that make it behave like a project
 * plan when it is opened in Excel: frozen headings, conditional formatting
 * that turns the timeline blocks into coloured bars without anyone touching
 * the ribbon, a data bar down the % Complete column, and a page set up to
 * print across a landscape sheet.
 *
 * It works on the finished file — unzip, edit the XML parts, zip again —
 * because the library offers no hook for any of it. Every edit is placed in
 * the order the SpreadsheetML schema requires, and the whole thing is a
 * best-effort step: if anything here fails, the caller keeps the plain
 * workbook rather than a broken one.
 */

import { unzipSync, zipSync } from "fflate";
import { columnLetter } from "./grid";

export interface SheetEnhancement {
  /** The sheet's name, as it appears in the workbook. */
  sheet: string;
  /** Columns and rows to freeze, counted from the top left. */
  freezeColumns: number;
  freezeRows: number;
  /** Data rows, not counting the header. */
  rows: number;
  /** Zero-based columns holding block-character bars. */
  barColumns: number[];
  /** Zero-based column of a 0–1 percentage, which gets a data bar. */
  percentColumn: number | null;
  landscape: boolean;
}

/** The block a running period is marked with, and what colours it. */
const BLOCK = "█";
const PART = "▒";
const BAR_FILL = "FF4CC93F";
const PART_FILL = "FFBDE8B6";
const PROGRESS_FILL = "FF22B8F0";

const DXFS = `<dxfs count="2">`
  + `<dxf><fill><patternFill patternType="solid"><fgColor rgb="${BAR_FILL}"/><bgColor rgb="${BAR_FILL}"/></patternFill></fill></dxf>`
  + `<dxf><fill><patternFill patternType="solid"><fgColor rgb="${PART_FILL}"/><bgColor rgb="${PART_FILL}"/></patternFill></fill></dxf>`
  + `</dxfs>`;

const DXF_DONE = 0;
const DXF_LEFT = 1;

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function encode(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(text);
  // TextEncoder can hand back a view on a SharedArrayBuffer, which the zip
  // writer's types do not accept; a copy is always a plain buffer.
  return bytes.buffer instanceof ArrayBuffer
    ? (bytes as Uint8Array<ArrayBuffer>)
    : new Uint8Array(bytes);
}

/** Sheet name to the part that holds it, read from the workbook's own map. */
function sheetParts(files: Record<string, Uint8Array>): Map<string, string> {
  const result = new Map<string, string>();
  const workbook = files["xl/workbook.xml"];
  const rels = files["xl/_rels/workbook.xml.rels"];
  if (!workbook || !rels) return result;

  const targets = new Map<string, string>();
  for (const match of decode(rels).matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    targets.set(match[1], match[2]);
  }

  for (const match of decode(workbook).matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const target = targets.get(match[2]);
    if (!target) continue;
    const path = target.startsWith("/")
      ? target.slice(1)
      : `xl/${target.replace(/^\.\//, "")}`;
    result.set(unescapeXml(match[1]), path);
  }
  return result;
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** A1-style range over whole columns of the data rows. */
function range(columns: number[], rows: number): string | null {
  if (columns.length === 0 || rows < 1) return null;
  const sorted = [...columns].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (const column of sorted.slice(1)) {
    if (column === previous + 1) {
      previous = column;
      continue;
    }
    parts.push(`${columnLetter(start)}2:${columnLetter(previous)}${rows + 1}`);
    start = column;
    previous = column;
  }
  parts.push(`${columnLetter(start)}2:${columnLetter(previous)}${rows + 1}`);
  return parts.join(" ");
}

function freezePane(columns: number, rows: number): string {
  if (columns <= 0 && rows <= 0) return `<sheetView workbookViewId="0"/>`;
  const topLeft = `${columnLetter(columns)}${rows + 1}`;
  const attrs = [
    columns > 0 ? `xSplit="${columns}"` : "",
    rows > 0 ? `ySplit="${rows}"` : "",
    `topLeftCell="${topLeft}"`,
    `activePane="bottomRight"`,
    `state="frozen"`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    `<sheetView workbookViewId="0">` +
    `<pane ${attrs}/>` +
    `<selection pane="bottomRight" activeCell="${topLeft}" sqref="${topLeft}"/>` +
    `</sheetView>`
  );
}

function conditionalFormatting(plan: SheetEnhancement): string {
  const blocks: string[] = [];
  let priority = 1;

  const bars = range(plan.barColumns, plan.rows);
  if (bars) {
    const first = `${columnLetter(Math.min(...plan.barColumns))}2`;
    // Two rules: a solid colour where a period is finished, a lighter one
    // where it is still to do. Text rules, so the blocks stay readable if the
    // formatting is ever cleared.
    blocks.push(
      `<conditionalFormatting sqref="${bars}">` +
        `<cfRule type="containsText" dxfId="${DXF_DONE}" priority="${priority++}" operator="containsText" text="${BLOCK}">` +
        `<formula>NOT(ISERROR(SEARCH("${BLOCK}",${first})))</formula></cfRule>` +
        `<cfRule type="containsText" dxfId="${DXF_LEFT}" priority="${priority++}" operator="containsText" text="${PART}">` +
        `<formula>NOT(ISERROR(SEARCH("${PART}",${first})))</formula></cfRule>` +
        `</conditionalFormatting>`,
    );
  }

  if (plan.percentColumn !== null && plan.rows > 0) {
    const letter = columnLetter(plan.percentColumn);
    blocks.push(
      `<conditionalFormatting sqref="${letter}2:${letter}${plan.rows + 1}">` +
        `<cfRule type="dataBar" priority="${priority++}">` +
        `<dataBar><cfvo type="num" val="0"/><cfvo type="num" val="1"/>` +
        `<color rgb="${PROGRESS_FILL}"/></dataBar></cfRule>` +
        `</conditionalFormatting>`,
    );
  }

  return blocks.join("");
}

function enhanceSheet(xml: string, plan: SheetEnhancement): string {
  let out = xml;

  if (plan.landscape) {
    out = out.replace(/(<worksheet[^>]*>)/, `$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`);
  }

  out = out.replace(
    /<sheetView workbookViewId="0"\s*\/>/,
    freezePane(plan.freezeColumns, plan.freezeRows),
  );

  const tail =
    conditionalFormatting(plan) +
    (plan.landscape
      ? `<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>` +
        `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>`
      : "");

  if (!tail) return out;

  // The schema fixes the order of a worksheet's children: these belong after
  // the data and the filter, and before ignoredErrors.
  const anchor = out.indexOf("<ignoredErrors");
  if (anchor >= 0) return out.slice(0, anchor) + tail + out.slice(anchor);
  return out.replace("</worksheet>", `${tail}</worksheet>`);
}

/**
 * Returns the workbook with the Office extras applied, or the bytes it was
 * given if anything about the file is not what this expects.
 */
export function enhanceXlsx(
  bytes: Uint8Array<ArrayBuffer>,
  plans: SheetEnhancement[],
): Uint8Array<ArrayBuffer> {
  if (plans.length === 0) return bytes;
  try {
    const files = unzipSync(bytes);
    const parts = sheetParts(files);
    let touched = false;

    for (const plan of plans) {
      const path = parts.get(plan.sheet);
      if (!path || !files[path]) continue;
      files[path] = encode(enhanceSheet(decode(files[path]), plan));
      touched = true;
    }
    if (!touched) return bytes;

    const styles = files["xl/styles.xml"];
    if (styles) {
      const text = decode(styles);
      // SheetJS always writes an empty dxfs element, which is the slot the
      // conditional formats above refer to by index.
      if (text.includes('<dxfs count="0"/>')) {
        files["xl/styles.xml"] = encode(text.replace('<dxfs count="0"/>', DXFS));
      } else if (!text.includes("<dxfs")) {
        files["xl/styles.xml"] = encode(text.replace("<tableStyles", `${DXFS}<tableStyles`));
      }
    }

    return zipSync(files) as Uint8Array<ArrayBuffer>;
  } catch {
    // A plain workbook beats a broken one.
    return bytes;
  }
}
