import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface InvoicePdfLine {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface InvoicePdfInput {
  invoice_number: string;
  issue_date: string;
  due_date?: string | null;
  customer_name?: string | null;
  order_po?: string | null;
  notes?: string | null;
  lines: InvoicePdfLine[];
  subtotal: number;
  tax: number;
  total: number;
}

export const generateInvoicePdf = (inv: InvoicePdfInput, autoDownload = true): Blob => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 40, 50);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice #: ${inv.invoice_number}`, pageWidth - 40, 50, { align: "right" });
  doc.text(`Issue Date: ${inv.issue_date}`, pageWidth - 40, 65, { align: "right" });
  if (inv.due_date) doc.text(`Due Date: ${inv.due_date}`, pageWidth - 40, 80, { align: "right" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 40, 100);
  doc.setFont("helvetica", "normal");
  doc.text(inv.customer_name || "—", 40, 115);
  if (inv.order_po) doc.text(`Customer PO: ${inv.order_po}`, 40, 130);

  autoTable(doc, {
    startY: 150,
    head: [["Description", "Qty", "Unit Price", "Line Total"]],
    body: inv.lines.map((l) => [
      l.description,
      String(l.quantity),
      `$${l.unit_price.toFixed(2)}`,
      `$${l.line_total.toFixed(2)}`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(10);
  doc.text(`Subtotal: $${inv.subtotal.toFixed(2)}`, pageWidth - 40, finalY, { align: "right" });
  doc.text(`Tax: $${inv.tax.toFixed(2)}`, pageWidth - 40, finalY + 15, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(`Total: $${inv.total.toFixed(2)}`, pageWidth - 40, finalY + 32, { align: "right" });

  if (inv.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Notes:", 40, finalY + 60);
    doc.text(doc.splitTextToSize(inv.notes, pageWidth - 80), 40, finalY + 75);
  }

  if (autoDownload) doc.save(`${inv.invoice_number}.pdf`);
  return doc.output("blob");
};
