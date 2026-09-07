"use client";

/**
 * Spreadsheet reading and writing with SheetJS, in the browser.
 *
 * The patched 0.20.x release is installed from SheetJS's own distribution
 * rather than the abandoned npm copy, which carries unfixed advisories — see
 * package.json. Nothing is uploaded: workbooks are parsed on the device.
 */

export interface SheetData {
  name: string;
  rows: Array<Array<string | number | boolean | null>>;
}

export const MAX_SHEET_BYTES = 30 * 1024 * 1024;

export class SheetError extends Error {}

export async function readWorkbook(file: File): Promise<SheetData[]> {
  if (file.size > MAX_SHEET_BYTES) {
    throw new SheetError(`${file.name} is larger than the 30 MB limit.`);
  }

  const XLSX = await import("xlsx");
  let workbook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  } catch {
    throw new SheetError(
      `${file.name} could not be read as a spreadsheet. Supported formats are .xlsx, .xls, .csv, .ods and .txt.`,
    );
  }

  const sheets: SheetData[] = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    }) as Array<Array<string | number | boolean | null>>,
  })).filter((sheet) => sheet.rows.length > 0);

  if (!sheets.length) throw new SheetError("That workbook has no readable data in it.");
  return sheets;
}

export async function writeWorkbook(
  sheets: SheetData[],
  format: "xlsx" | "csv" = "xlsx",
): Promise<Blob> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet, i) => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    // Sheet names are capped at 31 characters and must be unique.
    const name = (sheet.name || `Sheet${i + 1}`).slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  });

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(
      XLSX.utils.aoa_to_sheet(sheets[0]?.rows ?? []),
    );
    return new Blob([csv], { type: "text/csv;charset=utf-8" });
  }

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Renders sheets as paginated tables in a PDF, in landscape by default. */
export async function sheetsToPdf(
  sheets: SheetData[],
  {
    orientation = "landscape",
    fontSize = 8,
    includeSheetNames = true,
  }: { orientation?: "portrait" | "landscape"; fontSize?: number; includeSheetNames?: boolean } = {},
): Promise<{ bytes: Uint8Array; pages: number; truncatedColumns: number }> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const { sanitizeWinAnsi } = await import("./layout");

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const [shortSide, longSide] = [595.28, 841.89];
  const pageWidth = orientation === "landscape" ? longSide : shortSide;
  const pageHeight = orientation === "landscape" ? shortSide : longSide;
  const margin = 32;
  const usableWidth = pageWidth - margin * 2;
  const lineHeight = fontSize * 1.7;

  let page = doc.addPage([pageWidth, pageHeight]);
  let cursor = pageHeight - margin;
  let truncatedColumns = 0;

  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    cursor = pageHeight - margin;
  };

  for (const sheet of sheets) {
    if (includeSheetNames) {
      if (cursor - lineHeight * 2 < margin) newPage();
      page.drawText(sanitizeWinAnsi(sheet.name).text, {
        x: margin,
        y: cursor - fontSize * 1.4,
        size: fontSize * 1.6,
        font: bold,
        color: rgb(0.1, 0.12, 0.15),
      });
      cursor -= lineHeight * 2;
    }

    const columnCount = Math.max(1, ...sheet.rows.map((r) => r.length));
    // Columns share the width evenly; anything wider than its share is clipped.
    const columnWidth = usableWidth / columnCount;
    const charBudget = Math.max(3, Math.floor(columnWidth / (fontSize * 0.55)));

    sheet.rows.forEach((row, rowIndex) => {
      if (cursor - lineHeight < margin) newPage();

      row.forEach((cell, columnIndex) => {
        const raw = cell === null || cell === undefined ? "" : String(cell);
        const clean = sanitizeWinAnsi(raw).text;
        const shown = clean.length > charBudget ? `${clean.slice(0, charBudget - 1)}…` : clean;
        if (shown !== clean) truncatedColumns++;

        page.drawText(shown, {
          x: margin + columnIndex * columnWidth,
          y: cursor - fontSize,
          size: fontSize,
          font: rowIndex === 0 ? bold : font,
          color: rgb(0.12, 0.14, 0.17),
        });
      });

      // A rule under the header row makes the table readable.
      if (rowIndex === 0) {
        page.drawLine({
          start: { x: margin, y: cursor - fontSize - 4 },
          end: { x: pageWidth - margin, y: cursor - fontSize - 4 },
          thickness: 0.7,
          color: rgb(0.75, 0.78, 0.8),
        });
      }
      cursor -= lineHeight;
    });

    cursor -= lineHeight;
  }

  return {
    bytes: await doc.save({ useObjectStreams: true }),
    pages: doc.getPageCount(),
    truncatedColumns,
  };
}
