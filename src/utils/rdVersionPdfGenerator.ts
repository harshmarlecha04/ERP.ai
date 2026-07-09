import jsPDF from "jspdf";
import { parseDateString, formatET } from "@/utils/dateUtils";
import autoTable from "jspdf-autotable";

interface RDVersionActive {
  active_name: string;
  mg_per_gummy: number;
}

interface RDVersionInactive {
  name: string;
}

interface RDVersion {
  id: string;
  version_number: string;
  flavor: string;
  color: string;
  mold_size?: string | null;
  gummies_count?: number;
  scheduled_date?: string;
  notes?: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  rejection_reason?: string;
  approved_at?: string;
  approved_by?: string;
  created_at: string;
  actives?: RDVersionActive[];
  inactives?: RDVersionInactive[];
}


export const generateRDVersionPDF = (
  projectNumber: string,
  customerName: string,
  version: RDVersion,
  formulaReferenceLink?: string | null,
  projectName?: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 15;

  // Define colors (matching formulaPdfGenerator.ts)
  const tealColor = [0, 123, 131] as [number, number, number];
  const lightGray = [247, 247, 247] as [number, number, number];
  const darkText = [34, 34, 34] as [number, number, number];
  const borderGray = [200, 200, 200] as [number, number, number];

  // Header
  doc.setFillColor(...tealColor);
  doc.rect(0, 0, pageWidth, 35, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(23);
  doc.setFont("helvetica", "bold");
  doc.text("R&D Project Version Specification", pageWidth / 2, 15, { align: "center" });
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  const subtitle = projectName 
    ? `${projectNumber} • ${projectName} • ${version.version_number}`
    : `${projectNumber} • ${version.version_number} • ${customerName}`;
  doc.text(subtitle, pageWidth / 2, 25, { align: "center" });

  yPos = 45;

  // Reset text color
  doc.setTextColor(...darkText);

  // Project Information Card
  doc.setFillColor(...lightGray);
  doc.roundedRect(15, yPos, 85, 40, 2, 2, "F");
  doc.setDrawColor(...borderGray);
  doc.roundedRect(15, yPos, 85, 40, 2, 2, "S");

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("PROJECT INFORMATION", 20, yPos + 8);

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  if (projectName) {
    doc.text(`Project: ${projectName}`, 20, yPos + 18);
    doc.text(`Customer: ${customerName}`, 20, yPos + 25);
    doc.text(`Project #: ${projectNumber}`, 20, yPos + 32);
  } else {
    doc.text(`Customer: ${customerName}`, 20, yPos + 18);
    doc.text(`Project Number: ${projectNumber}`, 20, yPos + 25);
  }
  
  const statusText = version.status === 'pending_approval' ? 'Pending Approval' :
                     version.status === 'approved' ? 'Approved' :
                     'Rejected';
  
  const cardHeight = projectName ? 50 : 40;
  yPos = projectName ? yPos : yPos + 7;

  // Version Details Card
  doc.setFillColor(...lightGray);
  doc.roundedRect(110, yPos - (projectName ? 7 : 0), 85, 25, 2, 2, "F");
  doc.setDrawColor(...borderGray);
  doc.roundedRect(110, yPos - (projectName ? 7 : 0), 85, 25, 2, 2, "S");

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("VERSION DETAILS", 115, yPos + (projectName ? 1 : 8));

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(`Version: ${version.version_number}`, 115, yPos + (projectName ? 11 : 18));
  doc.text(`Status: ${statusText}`, 115, yPos + (projectName ? 18 : 0));

  yPos += projectName ? 57 : 50;

  // Formula Reference Link (if available)
  if (formulaReferenceLink) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    doc.text("Formula Reference:", 15, yPos);
    doc.setTextColor(0, 123, 131);
    doc.textWithLink(formulaReferenceLink, 55, yPos, { url: formulaReferenceLink });
    doc.setTextColor(...darkText);
    yPos += 15;
  }

  // Spec table: Mold Size / Color / Flavor / Gummies Count
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text("SPECIFICATION", 15, yPos);
  yPos += 5;

  const specRows: string[][] = [
    ["Mold Size", version.mold_size || "—"],
    ["Color", version.color || "—"],
    ["Flavor", version.flavor || "—"],
  ];
  if (version.gummies_count) {
    specRows.push(["Gummies Count", String(version.gummies_count)]);
  }
  if (version.scheduled_date) {
    specRows.push(["Scheduled Date", formatET(version.scheduled_date, "M/d/yyyy")]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [["Field", "Value"]],
    body: specRows,
    theme: "grid",
    headStyles: { fillColor: tealColor, textColor: [255, 255, 255], fontSize: 14, fontStyle: "bold", halign: "left" },
    bodyStyles: { fontSize: 13, textColor: darkText },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Active Ingredients
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text("ACTIVE INGREDIENTS", 15, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [["Active Ingredient", "mg per gummy"]],
    body: (version.actives && version.actives.length > 0)
      ? version.actives.map(a => [a.active_name, `${a.mg_per_gummy}`])
      : [["—", "—"]],
    theme: "grid",
    headStyles: { fillColor: tealColor, textColor: [255, 255, 255], fontSize: 14, fontStyle: "bold", halign: "left" },
    bodyStyles: { fontSize: 13, textColor: darkText },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: { 1: { halign: "right", cellWidth: 50 } },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Inactive Ingredients
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text("INACTIVE INGREDIENTS", 15, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [["Inactive Ingredient"]],
    body: (version.inactives && version.inactives.length > 0)
      ? version.inactives.map(i => [i.name])
      : [["—"]],
    theme: "grid",
    headStyles: { fillColor: tealColor, textColor: [255, 255, 255], fontSize: 14, fontStyle: "bold", halign: "left" },
    bodyStyles: { fontSize: 13, textColor: darkText },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;


  doc.text(`Created: ${formatET(version.created_at, "M/d/yyyy")}`, 15, yPos);
  yPos += 15;

  // Notes Section
  if (version.notes) {
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("NOTES", 15, yPos);
    yPos += 10;

    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    const splitNotes = doc.splitTextToSize(version.notes, pageWidth - 30);
    doc.text(splitNotes, 15, yPos);
    yPos += splitNotes.length * 5 + 5;
  }

  // Approval/Rejection Information
  if (version.status === 'approved' && version.approved_at) {
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("APPROVAL INFORMATION", 15, yPos);
    yPos += 7;

    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    doc.text(`Approved on: ${formatET(version.approved_at, "M/d/yyyy")}`, 15, yPos);
    yPos += 7;
  }

  if (version.status === 'rejected' && version.rejection_reason) {
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("REJECTION INFORMATION", 15, yPos);
    yPos += 7;

    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    doc.text("Reason:", 15, yPos);
    yPos += 5;
    const splitReason = doc.splitTextToSize(version.rejection_reason, pageWidth - 30);
    doc.text(splitReason, 15, yPos);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(12);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `${projectNumber} • Version ${version.version_number}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  // Save the PDF
  const fileName = `${projectNumber}_${version.version_number}_${customerName.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};
