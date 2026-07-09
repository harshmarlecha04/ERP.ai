import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BatchSheetData } from "./rdBatchSheetCalculator";
import { formatGramsValue } from "./rdBatchSheetCalculator";

const HIGHLIGHT_RGB: Record<string, [number, number, number]> = {
  yellow: [255, 244, 196],
  green: [220, 235, 200],
  blue: [210, 228, 240],
  orange: [253, 220, 190],
  red: [248, 215, 215],
  none: [255, 255, 255],
};

export const generateRDBatchSheetPDF = (data: BatchSheetData, fileName: string) => {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // Title centered, date right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(data.title, pageW / 2, y + 5, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.date, margin, y + 5);
  // underline
  doc.setLineWidth(0.3);
  doc.line(margin, y + 7, pageW - margin, y + 7);
  y += 11;

  // Mold size centered italic
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(11);
  doc.text(data.moldSize, pageW / 2, y, { align: "center" });
  y += 5;

  // Info block (objective + batch size + calculation lines)
  const infoLines: { text: string; highlight?: boolean }[] = [
    { text: `Objective: ${data.objective}` },
    { text: `Batch Size: ${data.batchSizeLine}`, highlight: true },
    ...data.calculationLines.map((c) => ({
      text: `${c.active_name} Calculations: ${c.text}`,
      highlight: true,
    })),
  ];

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  const lineH = 5.2;
  const blockH = infoLines.length * lineH + 2;
  doc.setDrawColor(0);
  doc.rect(margin, y, pageW - 2 * margin, blockH);
  let cursor = y + 1.5;
  infoLines.forEach((ln) => {
    if (ln.highlight) {
      doc.setFillColor(255, 244, 196);
      doc.rect(margin + 0.3, cursor + 0.6, pageW - 2 * margin - 0.6, lineH - 1, "F");
    }
    doc.setTextColor(20);
    const colonIdx = ln.text.indexOf(":");
    if (colonIdx > 0) {
      doc.setFont("helvetica", "bold");
      doc.text(ln.text.slice(0, colonIdx + 1), margin + 1.5, cursor + 4);
      const labelW = doc.getTextWidth(ln.text.slice(0, colonIdx + 1)) + 1;
      doc.setFont("helvetica", "normal");
      doc.text(ln.text.slice(colonIdx + 1).trim(), margin + 1.5 + labelW, cursor + 4);
    } else {
      doc.setFont("helvetica", "normal");
      doc.text(ln.text, margin + 1.5, cursor + 4);
    }
    cursor += lineH;
  });
  y += blockH + 3;

  // Ingredients table with section header rows
  const SECTION_LABELS: Record<string, string> = {
    inactive_bulk: "INACTIVE BULKS",
    actives: "ACTIVES",
    color_flavor: "COLOR & FLAVOR",
    sweetener_masking: "SWEETENERS & MASKING AGENTS",
  };
  type Row = { kind: "section"; label: string } | { kind: "ing"; idx: number };
  const rows: Row[] = [];
  let lastSec: string | null = null;
  data.ingredients.forEach((ing, idx) => {
    if (ing.section !== lastSec) {
      rows.push({ kind: "section", label: SECTION_LABELS[ing.section] || ing.section });
      lastSec = ing.section;
    }
    rows.push({ kind: "ing", idx });
  });

  const body: string[][] = rows.map((r) => {
    if (r.kind === "section") return [r.label, "", ""];
    const ing = data.ingredients[r.idx];
    const display = ing.supplier ? `${ing.name} - ${ing.supplier}` : ing.name;
    return [display, ing.percent.toFixed(2), formatGramsValue(ing.grams)];
  });
  body.push(["Total", data.totals.percent.toFixed(2), data.totals.grams.toFixed(2)]);

  autoTable(doc, {
    startY: y,
    head: [["INGREDIENTS", "%", "gm"]],
    body,
    theme: "grid",
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [253, 220, 190],
      textColor: [20, 20, 20],
      fontStyle: "bold",
      halign: "center",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 9.5, textColor: [25, 25, 25] },
    columnStyles: {
      0: { cellWidth: pageW - 2 * margin - 50 },
      1: { cellWidth: 25, halign: "right" },
      2: { cellWidth: 25, halign: "right" },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== "body") return;
      const rowIdx = hookData.row.index;
      const isTotal = rowIdx === body.length - 1;
      if (isTotal) {
        if (hookData.column.index === 0) {
          hookData.cell.styles.halign = "right";
          hookData.cell.styles.fontStyle = "bold";
        }
        return;
      }
      const r = rows[rowIdx];
      if (!r) return;
      if (r.kind === "section") {
        hookData.cell.styles.fillColor = [230, 230, 230];
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.halign = "left";
        return;
      }
      const ing = data.ingredients[r.idx];
      const color = HIGHLIGHT_RGB[ing.highlight] || HIGHLIGHT_RGB.none;
      hookData.cell.styles.fillColor = color;
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Procedure
  if (data.procedureSteps.length) {
    if (y > 240) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PROCEDURE:", margin, y);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1, margin + 28, y + 1);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    data.procedureSteps.forEach((step, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}. ${step}`, pageW - 2 * margin);
      if (y + wrapped.length * 5 > 265) {
        doc.addPage();
        y = margin;
      }
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 0.5;
    });
  }

  // Signature footer
  const pageH = doc.internal.pageSize.getHeight();
  const footerY = Math.max(y + 10, pageH - 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Processed & Understood by me,", margin, footerY);
  doc.text("Date", margin + 70, footerY);
  doc.text("Invented by:", margin + 95, footerY);
  doc.text("Date", margin + 150, footerY);
  doc.line(margin, footerY + 8, margin + 65, footerY + 8);
  doc.line(margin + 70, footerY + 8, margin + 90, footerY + 8);
  doc.line(margin + 95, footerY + 8, margin + 145, footerY + 8);
  doc.line(margin + 150, footerY + 8, margin + 170, footerY + 8);
  doc.text("Recorded by:", margin + 95, footerY + 14);
  doc.line(margin + 95, footerY + 22, margin + 145, footerY + 22);

  doc.save(fileName);
};
