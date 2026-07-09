// Word (.docx) rendering — Pharmvista Supplement Facts panel.
// Matches Claude reference layout: logo header, address bar with rule,
// customer + product headings, full-width Supplement Facts panel table,
// directions, and warning block.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  AlignmentType,
  BorderStyle,
  WidthType,
  TabStopType,
  TabStopPosition,
} from "npm:docx@8.5.0";
import type { SupplementFactsPanel, PanelRow } from "./supplement-facts-logic.ts";

const BLACK = "000000";
const FONT = "Times New Roman";

// Border helpers
const heavy = { style: BorderStyle.SINGLE, size: 18, color: BLACK };
const medium = { style: BorderStyle.SINGLE, size: 8, color: BLACK };
const thin = { style: BorderStyle.SINGLE, size: 4, color: BLACK };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

const openBorders = { top: none, bottom: none, left: none, right: none };

function txt(text: string, opts: { bold?: boolean; size?: number; italics?: boolean; font?: string } = {}) {
  return new TextRun({
    text,
    bold: opts.bold,
    size: opts.size,
    italics: opts.italics,
    font: opts.font ?? FONT,
  });
}

// ---- Panel table ----

function panelCell(
  children: Paragraph[],
  opts: {
    colSpan?: number;
    width?: number;
    borders?: { top?: any; bottom?: any; left?: any; right?: any };
    leftPad?: number;
    topPad?: number;
    bottomPad?: number;
  } = {},
) {
  return new TableCell({
    columnSpan: opts.colSpan,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    borders: {
      top: opts.borders?.top ?? none,
      bottom: opts.borders?.bottom ?? none,
      left: openBorders.left,
      right: openBorders.right,
    },
    margins: {
      top: opts.topPad ?? 60,
      bottom: opts.bottomPad ?? 60,
      left: opts.leftPad ?? 80,
      right: 80,
    },
    children,
  });
}

function macroRow(row: PanelRow, isFirstAfterHeader = false): TableRow {
  const border = { top: isFirstAfterHeader ? heavy : none, bottom: none };
  const indentPad = row.indent ? 360 : 80;
  const bold = !row.indent;
  return new TableRow({
    children: [
      panelCell(
        [new Paragraph({ children: [txt(row.label, { bold, size: 22 })] })],
        { width: 5760, borders: border, leftPad: indentPad },
      ),
      panelCell(
        [new Paragraph({ alignment: AlignmentType.RIGHT, children: [txt(row.amount, { bold: true, size: 22 })] })],
        { width: 2000, borders: border },
      ),
      panelCell(
        [new Paragraph({ alignment: AlignmentType.RIGHT, children: [txt(row.percentDV, { bold: true, size: 22 })] })],
        { width: 1600, borders: border },
      ),
    ],
  });
}

function activeRow(row: PanelRow, isFirst: boolean): TableRow {
  const border = { top: isFirst ? heavy : thin, bottom: none };
  return new TableRow({
    children: [
      panelCell(
        [new Paragraph({ children: [txt(row.label, { bold: true, size: 22 })] })],
        { width: 5760, borders: border },
      ),
      panelCell(
        [new Paragraph({ alignment: AlignmentType.RIGHT, children: [txt(row.amount, { bold: true, size: 22 })] })],
        { width: 2000, borders: border },
      ),
      panelCell(
        [new Paragraph({ alignment: AlignmentType.RIGHT, children: [txt(row.percentDV, { bold: true, size: 22 })] })],
        { width: 1600, borders: border },
      ),
    ],
  });
}

function buildPanelTable(panel: SupplementFactsPanel): Table {
  const rows: TableRow[] = [];

  // "Supplement Facts" title
  rows.push(new TableRow({
    children: [
      panelCell(
        [new Paragraph({ children: [txt("Supplement Facts", { bold: true, size: 40 })] })],
        { colSpan: 3, borders: { top: heavy, bottom: thin }, topPad: 80, bottomPad: 60 },
      ),
    ],
  }));

  // Serving size
  rows.push(new TableRow({
    children: [
      panelCell(
        [new Paragraph({ children: [txt(`Serving Size ${panel.servingSize}`, { bold: true, size: 22 })] })],
        { colSpan: 3, borders: { top: none, bottom: none }, topPad: 40, bottomPad: 20 },
      ),
    ],
  }));

  // Servings per container
  rows.push(new TableRow({
    children: [
      panelCell(
        [new Paragraph({ children: [txt(`Servings Per Container ${panel.servingsPerContainer ?? 2}`, { bold: true, size: 22 })] })],
        { colSpan: 3, borders: { top: none, bottom: heavy }, topPad: 20, bottomPad: 40 },
      ),
    ],
  }));

  // Column headers: blank | Amount Per Serving | % Daily Value*
  rows.push(new TableRow({
    children: [
      panelCell(
        [new Paragraph({ children: [txt("Amount Per Serving", { bold: true, size: 22 })] })],
        { width: 5760, borders: { top: none, bottom: thin } },
      ),
      panelCell(
        [new Paragraph({ children: [txt("", { size: 22 })] })],
        { width: 2000, borders: { top: none, bottom: thin } },
      ),
      panelCell(
        [new Paragraph({ alignment: AlignmentType.RIGHT, children: [txt("% Daily Value*", { bold: true, size: 22 })] })],
        { width: 1600, borders: { top: none, bottom: thin } },
      ),
    ],
  }));

  // Macros
  panel.amountPerServingRows.forEach((r) => rows.push(macroRow(r)));

  // Actives (first has heavy top border)
  panel.activeRows.forEach((r, i) => rows.push(activeRow(r, i === 0)));

  // Footnote row
  rows.push(new TableRow({
    children: [
      panelCell(
        [new Paragraph({ children: [txt(panel.footnote ?? panel.footnotes.join(" "), { size: 18 })] })],
        { colSpan: 3, borders: { top: heavy, bottom: thin }, topPad: 40, bottomPad: 40 },
      ),
    ],
  }));

  // Other ingredients row
  rows.push(new TableRow({
    children: [
      panelCell(
        [new Paragraph({
          children: [
            txt("Other Ingredients: ", { bold: true, size: 22 }),
            txt(panel.otherIngredients, { size: 22 }),
          ],
        })],
        { colSpan: 3, borders: { top: none, bottom: heavy }, topPad: 60, bottomPad: 60 },
      ),
    ],
  }));

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [5760, 2000, 1600],
    borders: {
      top: none, bottom: none, left: none, right: none,
      insideHorizontal: none, insideVertical: none,
    },
    rows,
  });
}

// ---- Header (logo + address bar) ----

async function loadLogo(): Promise<Uint8Array | null> {
  try {
    const { LOGO_BASE64 } = await import("./pharmvista-gummy-logo.ts");
    const bin = atob(LOGO_BASE64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch (_e) {
    return null;
  }
}


async function buildTopHeader(): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  const logo = await loadLogo();
  if (logo) {
    paragraphs.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new ImageRun({
          data: logo,
          transformation: { width: 160, height: 76 },
          altText: { title: "Pharmvista Gummy", description: "Pharmvista Gummy logo", name: "logo" },
        } as any),

      ],
    }));
  }

  // Address row with tab stops + bottom border rule
  paragraphs.push(new Paragraph({
    tabStops: [
      { type: TabStopType.LEFT, position: 3200 },
      { type: TabStopType.LEFT, position: 6400 },
    ],
    border: {
      bottom: { color: "808080", space: 4, style: BorderStyle.SINGLE, size: 6 },
    },
    spacing: { after: 200 },
    children: [
      txt("East Hanover, NJ", { size: 22 }),
      txt("\twww.pharmvista.com", { size: 22 }),
      txt("\tPhone: 1-973-997-0243", { size: 22 }),
    ],
  }));

  return paragraphs;
}

// ---- Main export ----

export async function renderSupplementFactsDocx(panel: SupplementFactsPanel): Promise<Uint8Array> {
  const headerParagraphs = await buildTopHeader();

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children: [
          ...headerParagraphs,

          // Customer name (left, bold)
          new Paragraph({
            spacing: { after: 120 },
            children: [txt(panel.header.customerName ?? "", { bold: true, size: 24 })],
          }),

          // Product name (centered, bold)
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [txt(panel.header.productName, { bold: true, size: 26 })],
          }),

          buildPanelTable(panel),

          // Directions
          new Paragraph({
            spacing: { before: 300, after: 240 },
            children: [txt(`Directions: ${panel.directions}`, { size: 22 })],
          }),

          // Warning block
          ...panel.warnings.map((w) =>
            new Paragraph({
              spacing: { after: 60 },
              children: [txt(w, { size: 22 })],
            })
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
