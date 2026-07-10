import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoPng from '@/assets/pharmvista-logo.png';

export interface CoaActiveIngredient {
  name: string;
  labelClaim: string; // e.g. "3000 mcg"
  input: string; // e.g. "6000 mcg*"
}

export interface CoaAttributes {
  color?: string | null;
  shape?: string | null;
  consistency?: string | null;
  flavor?: string | null;
  foreign_particles?: string | null;
  average_weight?: string | null;
}

export interface CoaActiveAssay {
  name: string;
  specification?: string | null;
  result?: string | null;
}

export interface CoaHeavyMetals {
  lead?: string | null;
  arsenic?: string | null;
  mercury?: string | null;
  cadmium?: string | null;
}

export interface CoaMicro {
  total_aerobic_microbial_count?: string | null;
  total_coliforms?: string | null;
  total_yeast_mold?: string | null;
  e_coli?: string | null;
  salmonella?: string | null;
  staphylococcus_aureus?: string | null;
}

export interface CoaSettings {
  qf_revision: string;
  shelf_life_text: string;
  storage_condition: string;
  shelf_life_bullets: string[];
  transport_text: string;
  data_logger_text: string;
  overage_text: string;
  analytical_testing_text: string;
  stability_text: string;
  allergen_text: string;
  others_bullets: string[];
  shelf_life_months?: number;
  active_assay_tolerance_pct?: number;
}


export interface CoaPdfData {
  productCode: string;
  productName: string;
  customerName: string;
  weight: string; // e.g. "3.0 g/ gummy"
  remark: string;
  batchLot: string;
  expirationDate: string; // already formatted "FEB 2028"
  servingSize?: number; // gummies count used in ingredient / assay columns
  ingredients: CoaActiveIngredient[];
  attributes: CoaAttributes;
  attributeSpecs?: {
    color?: string;
    shape?: string;
    consistency?: string;
    flavor?: string;
    foreign_particles?: string;
    average_weight?: string;
  };
  attributeResults?: {
    color?: string;
    shape?: string;
    consistency?: string;
    flavor?: string;
    foreign_particles?: string;
    average_weight?: string;
  };
  activeAssays: CoaActiveAssay[];
  heavyMetals: CoaHeavyMetals;
  heavyMetalsResults?: CoaHeavyMetals;
  microbiological: CoaMicro;
  microbiologicalResults?: CoaMicro;
  approverName?: string;
  approvalDate?: string;
  signatureDataUrl?: string;
  settings: CoaSettings;
}


import { getCompanyInfo } from '@/lib/companyInfo';

const MAROON: [number, number, number] = [144, 38, 47]; // #90262F
const LIGHT_BLUE: [number, number, number] = [220, 230, 241]; // #DCE6F1
const BLACK: [number, number, number] = [0, 0, 0];

const ADDRESS_LINE =
  'ERP.ai Manufacturing';

async function loadImageDataUrl(src: string): Promise<string> {
  const resp = await fetch(src);
  const blob = await resp.blob();
  return await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
}

function drawHeader(doc: jsPDF, logoData: string, qfRevision: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  // Logo (left)
  try {
    doc.addImage(logoData, 'PNG', 36, 28, 130, 36);
  } catch {
    // skip if image fails
  }
  // QF revision (right)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(qfRevision, pageWidth - 36, 48, { align: 'right' });

  // Address line (from company settings)
  const _ci = getCompanyInfo();
  const _addr = [_ci.name, _ci.address, _ci.phone].filter(Boolean).join('    ');
  doc.setFontSize(10);
  doc.text(_addr || _ci.name, 36, 82);
  // www in blue underline (visual cue, not real link)
  const before = 'ERP.ai Manufacturing    ';
  const beforeWidth = doc.getTextWidth(before);
  doc.setTextColor(0, 0, 238);
  doc.text('', 36 + beforeWidth, 82);
  const linkW = doc.getTextWidth('');
  doc.setDrawColor(0, 0, 238);
  doc.line(36 + beforeWidth, 84, 36 + beforeWidth + linkW, 84);
  doc.setTextColor(...BLACK);
}

function drawFooter(doc: jsPDF, page: number, total: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(`Page ${page} of ${total}`, pageWidth / 2, pageHeight - 30, {
    align: 'center',
  });
}

export const generateCoaPDF = async (data: CoaPdfData): Promise<Blob> => {
  const doc = new jsPDF('portrait', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;

  const logoData = await loadImageDataUrl(logoPng);

  // ============ PAGE 1 ============
  drawHeader(doc, logoData, data.settings.qf_revision);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('PRODUCT CERTIFICATE OF ANALYSIS', pageWidth / 2, 115, {
    align: 'center',
  });

  // Info grid (2-column key/value)
  autoTable(doc, {
    startY: 132,
    margin: { left: margin, right: margin },
    body: [
      [
        { content: 'Product Code', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: data.productCode, styles: { halign: 'center' } },
        { content: 'Customer Name', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: data.customerName, styles: { halign: 'center' } },
      ],
      [
        { content: 'Product Name', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: data.productName, styles: { halign: 'center' } },
        { content: 'Weight', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: data.weight, styles: { halign: 'center' } },
      ],
      [
        { content: 'Remark', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: data.remark || 'None', colSpan: 3, styles: { halign: 'center' } },
      ],
      [
        { content: 'Batch / Lot:', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: data.batchLot, colSpan: 3, styles: { halign: 'center' } },
      ],
      [
        { content: 'Shelf Life', styles: { fontStyle: 'bold', halign: 'center' } },
        {
          content: data.settings.shelf_life_text,
          colSpan: 3,
          styles: { halign: 'center' },
        },
      ],
      [
        { content: 'Expiration Date:', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: data.expirationDate, colSpan: 3, styles: { halign: 'center' } },
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 5,
      lineColor: BLACK,
      lineWidth: 0.5,
      textColor: BLACK,
    },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 200 },
      2: { cellWidth: 110 },
      3: { cellWidth: 120 },
    },
  });

  // Ingredient / Label Claim / Input table (maroon header)
  const svg = data.servingSize && data.servingSize > 0 ? data.servingSize : 2;
  const gummiesLabel = `${svg} gumm${svg === 1 ? 'y' : 'ies'}`;
  let y = (doc as any).lastAutoTable.finalY + 14;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Ingredient', `Label Claim / ${gummiesLabel}`, `Input / ${gummiesLabel}`]],
    body: data.ingredients.length
      ? data.ingredients.map((i) => [i.name, i.labelClaim, i.input])
      : [['—', '—', '—']],
    theme: 'grid',
    headStyles: {
      fillColor: MAROON,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 10,
    },
    bodyStyles: {
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 10,
      lineColor: BLACK,
      lineWidth: 0.5,
      textColor: BLACK,
    },
  });

  // Attributes
  const aSpec = data.attributeSpecs || {};
  const aRes = data.attributeResults || {};
  y = (doc as any).lastAutoTable.finalY + 14;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Attributes', 'Specification', 'Results']],
    body: [
      ['Color (Organoleptic)', aSpec.color ?? data.attributes.color ?? '', aRes.color ?? 'Complies'],
      ['Shape', aSpec.shape ?? data.attributes.shape ?? '', aRes.shape ?? 'Complies'],
      ['Consistency', aSpec.consistency ?? data.attributes.consistency ?? '', aRes.consistency ?? 'Complies'],
      ['Flavor', aSpec.flavor ?? data.attributes.flavor ?? '', aRes.flavor ?? 'Complies'],
      ['Foreign Particles', aSpec.foreign_particles ?? data.attributes.foreign_particles ?? 'No visible foreign matter', aRes.foreign_particles ?? 'Complies'],
      ['Average Weight (g/ gummy)', aSpec.average_weight ?? data.attributes.average_weight ?? '', aRes.average_weight ?? 'Complies'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: LIGHT_BLUE,
      textColor: BLACK,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10, lineColor: BLACK, lineWidth: 0.5, textColor: BLACK },
  });


  // Active ingredient testing
  y = (doc as any).lastAutoTable.finalY + 14;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Test for Active Ingredients', 'Specification', 'Results']],
    body: data.activeAssays.length
      ? data.activeAssays.map((a) => [
          `Assay for ${a.name}`,
          a.specification ?? '',
          a.result ?? '',
        ])
      : [['—', '—', '—']],
    theme: 'grid',
    headStyles: {
      fillColor: LIGHT_BLUE,
      textColor: BLACK,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10, lineColor: BLACK, lineWidth: 0.5, textColor: BLACK },
  });

  // Heavy metals
  y = (doc as any).lastAutoTable.finalY + 14;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Heavy Metals (ICP-MS)', 'Specifications', 'Results']],
    body: [
      ['Lead', '<0.1 PPM', data.heavyMetals.lead ?? ''],
      ['Arsenic', '<0.5 PPM', data.heavyMetals.arsenic ?? ''],
      ['Mercury', '<0.1 PPM', data.heavyMetals.mercury ?? ''],
      ['Cadmium', '<1.0 PPM', data.heavyMetals.cadmium ?? ''],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: LIGHT_BLUE,
      textColor: BLACK,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10, lineColor: BLACK, lineWidth: 0.5, textColor: BLACK },
  });

  // Microbiological
  y = (doc as any).lastAutoTable.finalY + 14;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Microbiological Analysis (USP)', 'Specifications', 'Results']],
    body: [
      ['Total Aerobic Microbial Count', '<2,000 CFU/g', data.microbiological.total_aerobic_microbial_count ?? ''],
      ['Total Coliforms', '<10 CFU/g', data.microbiological.total_coliforms ?? ''],
      ['Total Yeast & Mold', '<200 CFU/g', data.microbiological.total_yeast_mold ?? ''],
      ['E. coli', 'Absent', data.microbiological.e_coli ?? ''],
      ['Salmonella', 'Absent', data.microbiological.salmonella ?? ''],
      ['Staphylococcus Aureus', 'Absent', data.microbiological.staphylococcus_aureus ?? ''],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: LIGHT_BLUE,
      textColor: BLACK,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10, lineColor: BLACK, lineWidth: 0.5, textColor: BLACK },
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('*Refer to the overage Statement on next page.', margin, y);
  doc.text('*Other Ingredients refer to the label attached.', margin, y + 12);

  drawFooter(doc, 1, 2);

  // ============ PAGE 2 ============
  doc.addPage();
  drawHeader(doc, logoData, data.settings.qf_revision);

  // Remarks block — section header in maroon, sub-headers in light blue
  const remarksRows: any[] = [
    [{ content: 'Remarks', colSpan: 1, styles: { fillColor: MAROON, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 11 } }],
    [{ content: 'Storage Condition', styles: { fillColor: LIGHT_BLUE, fontStyle: 'bold', halign: 'center' } }],
    [{ content: data.settings.storage_condition }],
    [{ content: 'Shelf Life', styles: { fillColor: LIGHT_BLUE, fontStyle: 'bold', halign: 'center' } }],
    [{ content: data.settings.shelf_life_bullets.map((b) => `• ${b}`).join('\n') }],
    [{ content: 'Transport', styles: { fillColor: LIGHT_BLUE, fontStyle: 'bold', halign: 'center' } }],
    [{ content: data.settings.transport_text }],
    [{ content: 'Data Logger', styles: { fillColor: LIGHT_BLUE, fontStyle: 'bold', halign: 'center' } }],
    [{ content: data.settings.data_logger_text }],
    [{ content: 'Overage', styles: { fillColor: LIGHT_BLUE, fontStyle: 'bold', halign: 'center' } }],
    [{ content: data.settings.overage_text }],
    [{ content: 'Analytical Testing', styles: { fillColor: LIGHT_BLUE, fontStyle: 'bold', halign: 'center' } }],
    [{ content: data.settings.analytical_testing_text }],
    [{ content: 'Stability', styles: { fillColor: LIGHT_BLUE, fontStyle: 'bold', halign: 'center' } }],
    [{ content: data.settings.stability_text }],
    [{ content: 'Allergen Statement', styles: { fillColor: LIGHT_BLUE, fontStyle: 'bold', halign: 'center' } }],
    [{ content: data.settings.allergen_text }],
    [{ content: 'Others', styles: { fillColor: LIGHT_BLUE, fontStyle: 'bold', halign: 'center' } }],
    ...data.settings.others_bullets.map((b, i) => [{ content: `${i + 1}. ${b}` }]),
  ];

  autoTable(doc, {
    startY: 105,
    margin: { left: margin, right: margin },
    body: remarksRows,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 5,
      lineColor: BLACK,
      lineWidth: 0.5,
      textColor: BLACK,
    },
  });

  // Approval signatures
  let sigY = (doc as any).lastAutoTable.finalY + 50;
  if (sigY > 680) sigY = 680;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  // QA — signature image if present
  doc.text('Approved by:', margin, sigY);
  if (data.signatureDataUrl) {
    try {
      doc.addImage(data.signatureDataUrl, 'PNG', margin + 70, sigY - 25, 110, 40);
    } catch {
      // ignore
    }
  }
  doc.line(margin, sigY + 22, margin + 200, sigY + 22);
  doc.text('Quality Assurance', margin, sigY + 36);
  if (data.approvalDate) {
    doc.text(`Date: ${data.approvalDate}`, margin, sigY + 52);
  }

  // Customer signature line
  const rightX = pageWidth / 2 + 40;
  doc.text('Approved by:', rightX, sigY);
  doc.line(rightX, sigY + 22, rightX + 200, sigY + 22);
  doc.text('Step Change Representative', rightX, sigY + 36);
  doc.text('Date: ______________', rightX, sigY + 52);

  drawFooter(doc, 2, 2);

  return doc.output('blob');
};
