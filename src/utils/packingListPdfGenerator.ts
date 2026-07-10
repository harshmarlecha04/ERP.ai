import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/pharmvista-logo.png";
import { getCompanyInfo } from "@/lib/companyInfo";

export const PL_ROW_LABELS = [
  "Products:",
  "Count Type:",
  "# Of Units:",
  "Batch #s:",
  "Exp. Date:",
  "# of Shippers:",
  "Shipper Dimensions:",
  "Units per Shipper:",
  "Storage Condition:",
  "Shippers per pallet:",
  "# of Pallets:",
  "Pallet Dimensions:",
  "Gross Weight:",
  "Shipping Method:",
] as const;

export type PLRowKey =
  | "product"
  | "countType"
  | "units"
  | "batch"
  | "exp"
  | "shippers"
  | "shipperDim"
  | "unitsPerShipper"
  | "storage"
  | "shippersPerPallet"
  | "pallets"
  | "palletDim"
  | "grossWeight"
  | "shippingMethod";

export const PL_ROW_KEYS: PLRowKey[] = [
  "product",
  "countType",
  "units",
  "batch",
  "exp",
  "shippers",
  "shipperDim",
  "unitsPerShipper",
  "storage",
  "shippersPerPallet",
  "pallets",
  "palletDim",
  "grossWeight",
  "shippingMethod",
];

export interface PackingListColumn {
  product: string;
  countType: string;
  units: string;
  batch: string;
  exp: string;
  shippers: string;
  shipperDim: string;
  unitsPerShipper: string;
  storage: string;
  shippersPerPallet: string;
  pallets: string;
  palletDim: string;
  grossWeight: string;
  shippingMethod: string;
}

export interface PackingListInput {
  date: string; // MM/DD/YY
  poNumbers: string; // e.g. "PO1306 / PO1309"
  billTo: string;
  shipTo: string;
  columns: PackingListColumn[];
  fileName?: string;
}





const loadLogo = async (): Promise<string> => {
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

export const generatePackingListPdf = async (input: PackingListInput, autoDownload = true): Promise<Blob> => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  // Logo
  try {
    const logoData = await loadLogo();
    doc.addImage(logoData, "PNG", marginX, 30, 160, 55);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(200, 30, 30);
    doc.text(getCompanyInfo().name, marginX, 65);
    doc.setTextColor(0, 0, 0);
  }

  // Address line under logo (from company settings)
  const _ci = getCompanyInfo();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  if (_ci.address) doc.text(_ci.address, marginX, 100);
  if (_ci.phone) {
    doc.setFont("helvetica", "bold");
    doc.text(_ci.phone, pageWidth - marginX, 100, { align: "right" });
  }

  // Date + PO
  const topY = 140;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Date:`, marginX, topY);
  doc.setFont("helvetica", "normal");
  doc.text(` ${input.date}`, marginX + 34, topY);
  doc.setFont("helvetica", "bold");
  doc.text(input.poNumbers, pageWidth - marginX, topY, { align: "right" });

  // Bill To / Ship To boxes
  autoTable(doc, {
    startY: topY + 15,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
    head: [[{ content: "Bill To:", styles: { fontStyle: "bold" } }, { content: "Ship To:", styles: { fontStyle: "bold" } }]],
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.5, lineColor: [0, 0, 0] },
    body: [[input.billTo || "—", input.shipTo || "—"]],
    columnStyles: {
      0: { cellWidth: (pageWidth - marginX * 2) / 2, valign: "top" },
      1: { cellWidth: (pageWidth - marginX * 2) / 2, valign: "top" },
    },
    margin: { left: marginX, right: marginX },
  });

  const afterBoxes = (doc as any).lastAutoTable.finalY + 20;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("PACKING LIST", pageWidth / 2, afterBoxes, { align: "center" });

  // Build product table: 15 columns max (label + N products)
  const productCount = input.columns.length;
  const labelWidth = 110;
  const availableWidth = pageWidth - marginX * 2 - labelWidth;
  const perColWidth = Math.max(50, availableWidth / Math.max(1, productCount));

  const body: any[] = PL_ROW_KEYS.map((key, rowIdx) => {
    const label = { content: PL_ROW_LABELS[rowIdx], styles: { fontStyle: "bold" as const, fillColor: [245, 245, 245] as [number, number, number] } };
    // Check if all columns share the same value → merge into one wide cell
    const vals = input.columns.map((c) => c[key] || "");
    const allSame = vals.length > 1 && vals.every((v) => v === vals[0]);
    if (allSame) {
      return [label, { content: vals[0], colSpan: productCount, styles: { halign: "center" as const } }];
    }
    return [label, ...vals.map((v) => ({ content: v, styles: { halign: "center" as const } }))];
  });

  const columnStyles: Record<number, any> = { 0: { cellWidth: labelWidth, fontStyle: "bold" } };
  for (let i = 1; i <= productCount; i++) columnStyles[i] = { cellWidth: perColWidth };

  autoTable(doc, {
    startY: afterBoxes + 10,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0], valign: "middle" },
    body,
    columnStyles,
    margin: { left: marginX, right: marginX },
  });

  const fileName = input.fileName || `PackingList_${input.date.replace(/\//g, "-")}.pdf`;
  if (autoDownload) doc.save(fileName);
  return doc.output("blob");
};
