import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { todayET } from "@/utils/dateUtils";

export interface FormulaData {
  id: string;
  code: string;
  name: string;
  default_batch_size_kg: number;
  version?: string;
  security_level?: string;
  classification_level?: string;
  product_code_line?: string;
  procedure_text?: string;
  notes?: string;
  recipe_json?: Array<{
    name?: string;
    materialName?: string;
    percentage?: number;
    category?: string;
    supplier?: string;
    weightKg?: number;
    weightG?: number;
    lotNumber?: string;
    vessel?: 'cooker' | 'holding' | null;
  }>;
  active_ingredients_json?: Array<{
    name?: string;
    materialName?: string;
    ingredient_name?: string;
    percentage?: number;
    quantityMg?: number;
    concentration?: string;
  }>;
  created_at?: string;
  total_pieces?: number;
  average_piece_weight?: number;
}

export const generateFormulaPDF = (formula: FormulaData) => {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Footer function to add formula name at bottom of each page
  const addFooter = () => {
    const footerY = pageHeight - 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100); // Gray color
    const footerText = formula.name;
    const footerWidth = doc.getTextWidth(footerText);
    doc.text(footerText, (pageWidth - footerWidth) / 2, footerY);
  };

  // Compressed header with teal background
  doc.setFillColor(0, 123, 131); // Teal
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const titleText = 'Pharmvista Manufacturing Formula';
  const titleWidth = doc.getTextWidth(titleText);
  doc.text(titleText, (pageWidth - titleWidth) / 2, 14);
  
  // Formula details in header - compressed
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const formulaText = `${formula.code} – ${formula.default_batch_size_kg} – ${formula.name}`;
  const formulaWidth = doc.getTextWidth(formulaText);
  doc.text(formulaText, (pageWidth - formulaWidth) / 2, 21);
  
  // Reset text color and position
  doc.setTextColor(34, 34, 34); // Dark charcoal
  yPosition = 35;
  
  // Add footer to first page
  addFooter();
  
  const ingredients = formula.recipe_json || [];
  const activeIngredients = formula.active_ingredients_json || [];
  
  // Priority ingredient ordering for PDF
  const priorityIngredients = [
    'water',
    'seaweed', 'carrageenan', 'carragel', 'gelymar',
    'pectin',
    'tapioca',
    'sugar',
    'trisodium'
  ];
  
  // Smart decimal formatter: up to 4 decimal places, trim trailing zeros
  const formatSmartDecimal = (num: number): string => {
    const formatted = num.toFixed(4);
    return formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  };
  
  // Smart quantity formatter: shows grams for <1kg, kg for >=1kg
  const formatQuantityWithUnit = (quantityKg: number): string => {
    if (quantityKg < 1) {
      const grams = quantityKg * 1000;
      return `${formatSmartDecimal(grams)}g`;
    } else {
      return `${formatSmartDecimal(quantityKg)}kg`;
    }
  };
  
  // Compressed side-by-side cards
  const cardWidth = (pageWidth - 3 * margin) / 2;
  const cardHeight = 28;
  const maxTextWidth = cardWidth - 6;
  
  // Formula Overview Card (Left)
  doc.setFillColor(247, 247, 247);
  doc.roundedRect(margin, yPosition, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPosition, cardWidth, cardHeight, 2, 2, 'S');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 123, 131);
  doc.text('FORMULA OVERVIEW', margin + 3, yPosition + 7);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(34, 34, 34);
  doc.text(`Batch Size: ${formula.default_batch_size_kg} kg`, margin + 3, yPosition + 14);
  doc.text(`Total Pieces: ${formula.total_pieces || 'N/A'}`, margin + 3, yPosition + 20);
  
  // Product Details Card (Right)
  const rightCardX = margin + cardWidth + margin;
  doc.setFillColor(247, 247, 247);
  doc.roundedRect(rightCardX, yPosition, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightCardX, yPosition, cardWidth, cardHeight, 2, 2, 'S');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 123, 131);
  doc.text('PRODUCT DETAILS', rightCardX + 3, yPosition + 7);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(34, 34, 34);
  
  const productNameText = `Product: ${formula.name}`;
  const productNameLines = doc.splitTextToSize(productNameText, maxTextWidth);
  let currentTextY = yPosition + 14;
  productNameLines.forEach((line: string, index: number) => {
    if (index < 2 && currentTextY < yPosition + cardHeight - 3) {
      doc.text(line, rightCardX + 3, currentTextY);
      currentTextY += 5;
    }
  });
  
  if (formula.product_code_line && currentTextY < yPosition + cardHeight - 3) {
    doc.text(`Line: ${formula.product_code_line}`, rightCardX + 3, currentTextY);
  }
  
  yPosition += cardHeight + 8;

  // Compressed batch information
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 34, 34);
  doc.text('Batch Info:', margin, yPosition);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Batches:', margin + 25, yPosition);
  doc.setDrawColor(0, 123, 131);
  doc.setLineWidth(0.8);
  doc.line(margin + 45, yPosition + 1, margin + 75, yPosition + 1);
  
  doc.text('Date:', margin + 85, yPosition);
  doc.line(margin + 100, yPosition + 1, margin + 140, yPosition + 1);
  
  yPosition += 10;
  
  // Combined Ingredients Table (Active + Recipe)
  if (ingredients.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 123, 131);
    doc.text('RECIPE INGREDIENTS', margin, yPosition);
    yPosition += 8;

    // Vessel indicators - compact
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 34, 34);
    
    doc.setFillColor(76, 175, 80);
    doc.circle(margin + 3, yPosition - 0.5, 1, 'F');
    doc.text('C=Cooker', margin + 7, yPosition);
    
    doc.setFillColor(255, 193, 7);
    doc.circle(margin + 35, yPosition - 0.5, 1, 'F');
    doc.text('H=Holding', margin + 39, yPosition);
    
    yPosition += 6;

    // Create active ingredients map for lookup
    const activeIngMap: { [key: string]: string } = {};
    
    // Helper: extract material ID from compound UUID (materialId-lotId format)
    // Compound UUIDs are two UUIDs joined, so materialId is the first 36 chars
    const extractMaterialId = (compoundId: string): string => {
      if (!compoundId) return compoundId;
      // UUID format: 8-4-4-4-12 = 36 chars. If string is longer, first 36 is materialId
      if (compoundId.length > 36 && compoundId[36] === '-') {
        return compoundId.substring(0, 36);
      }
      return compoundId;
    };

    // Build two maps from recipe ingredients:
    // 1. exactName → materialName (existing behavior)
    // 2. materialId → materialName (new: matches across different lots)
    const recipeNameMap: { [key: string]: string } = {};
    const recipeMaterialIdMap: { [key: string]: string } = {};
    
    if (ingredients.length > 0) {
      ingredients.forEach((recipeItem: any) => {
        if (recipeItem.name && recipeItem.materialName) {
          recipeNameMap[recipeItem.name] = recipeItem.materialName;
          const matId = extractMaterialId(recipeItem.name);
          recipeMaterialIdMap[matId] = recipeItem.materialName;
        }
      });
    }
    
    // Normalize a name into meaningful tokens for fuzzy matching
    const tokenize = (str: string): string[] => {
      if (!str) return [];
      return str
        .toLowerCase()
        .replace(/[()\/\-,.:;]/g, ' ')  // remove punctuation
        .split(/\s+/)
        .filter(t => t.length > 1);  // drop single-char noise like "B"
    };

    // Score token overlap between two token arrays
    const tokenOverlap = (a: string[], b: string[]): number => {
      if (a.length === 0 || b.length === 0) return 0;
      const setB = new Set(b);
      const matched = a.filter(t => setB.has(t)).length;
      return matched / Math.min(a.length, b.length);
    };

    // Build a normalized lookup for row-time fallback
    const normalizedActiveMap: { [normalizedKey: string]: string } = {};

    activeIngredients.forEach((ai: any) => {
      const concentration = ai.quantityMg ? `${ai.quantityMg}mg` : (ai.concentration ? `${ai.concentration}mg` : '');
      if (!concentration) return;

      const aiMaterialId = extractMaterialId(ai.name);

      // 1) Material ID match (same material, different lot)
      const matchedByMatId = recipeMaterialIdMap[aiMaterialId];
      if (matchedByMatId) {
        activeIngMap[matchedByMatId] = concentration;
        return;
      }

      // 2) Exact compound UUID match
      const matchedByName = recipeNameMap[ai.name];
      if (matchedByName) {
        activeIngMap[matchedByName] = concentration;
        return;
      }

      // 3) Token-overlap matching using resolved materialName from DB
      const resolvedName = ai.materialName || ai.ingredient_name;
      if (resolvedName) {
        activeIngMap[resolvedName] = concentration;
        const aiTokens = tokenize(resolvedName);

        // Find best matching recipe ingredient by token overlap
        let bestMatch = '';
        let bestScore = 0;
        for (const recipeMatName of Object.values(recipeMaterialIdMap)) {
          const recipeTokens = tokenize(recipeMatName);
          const score = tokenOverlap(aiTokens, recipeTokens);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = recipeMatName;
          }
        }
        // Require at least 50% token overlap AND at least 2 shared tokens
        if (bestScore >= 0.5 && bestMatch) {
          const aiSet = new Set(aiTokens);
          const sharedCount = tokenize(bestMatch).filter(t => aiSet.has(t)).length;
          if (sharedCount >= 2) {
            activeIngMap[bestMatch] = concentration;
          }
        }

        // Also store under normalized key for row-time fallback
        const normKey = tokenize(resolvedName).sort().join('|');
        if (normKey) normalizedActiveMap[normKey] = concentration;
      }
    });

    // Sort ingredients: cooker first, then holding, with priority order within each vessel
    const sortedIngredients = [...ingredients].sort((a: any, b: any) => {
      // Vessel grouping: cooker (1) > holding (2) > no vessel (3)
      const vesselOrder: { [key: string]: number } = { cooker: 1, holding: 2 };
      const vesselA = a.vessel ? vesselOrder[a.vessel] || 3 : 3;
      const vesselB = b.vessel ? vesselOrder[b.vessel] || 3 : 3;
      
      if (vesselA !== vesselB) return vesselA - vesselB;
      
      // Within same vessel, sort by priority
      const nameA = (a.materialName || a.name || '').toLowerCase();
      const nameB = (b.materialName || b.name || '').toLowerCase();
      
      const getPriority = (name: string) => {
        for (let i = 0; i < priorityIngredients.length; i++) {
          if (name.includes(priorityIngredients[i])) return i;
        }
        return 999; // Non-priority items go to end
      };
      
      return getPriority(nameA) - getPriority(nameB);
    });

    // Build consolidated table data
    const tableData = sortedIngredients.map((ingredient: any) => {
      const percentage = ingredient.percentage || (ingredient.weightKg ? (ingredient.weightKg / formula.default_batch_size_kg * 100) : 0);
      const quantityKg = ingredient.weightKg || (formula.default_batch_size_kg * percentage / 100);
      const ingredientName = ingredient.materialName || ingredient.name || 'Unknown';
      const supplier = ingredient.vendor || ingredient.supplier || 'N/A';
      const vesselText = ingredient.vessel === 'cooker' ? 'C' : ingredient.vessel === 'holding' ? 'H' : '';
      // Look up active concentration: exact key first, then normalized fallback
      let activeConc = activeIngMap[ingredientName] || '';
      if (!activeConc) {
        const normKey = ingredientName
          .toLowerCase()
          .replace(/[()\/\-,.:;]/g, ' ')
          .split(/\s+/)
          .filter((t: string) => t.length > 1)
          .sort()
          .join('|');
        activeConc = normalizedActiveMap[normKey] || '';
      }
      
      return [
        ingredientName,
        supplier,
        `${percentage.toFixed(2)}%`,
        formatQuantityWithUnit(quantityKg),
        vesselText,
        activeConc
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Ingredient Name', 'Supplier', '%', 'Qty', 'V', 'Active']],
      body: tableData,
      theme: 'grid',
      tableLineColor: [100, 100, 100],
      tableLineWidth: 0.3,
      headStyles: { 
        fillColor: [0, 123, 131],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [247, 247, 247] },
      styles: { 
        fontSize: 9,
        textColor: [34, 34, 34],
        cellPadding: 2.5
      },
      didParseCell: function(data: any) {
        if (data.section === 'body') {
          const vesselValue = data.row.cells[4].text[0];
          const activeValue = data.row.cells[5].text[0];
          
          // Keep existing row background coloring
          if (vesselValue === 'C') {
            data.cell.styles.fillColor = [209, 242, 235];
          } else if (vesselValue === 'H') {
            data.cell.styles.fillColor = [255, 243, 205];
          }
          
          // Special styling for Active column (column index 5) when it has a value
          if (data.column.index === 5 && activeValue) {
            if (vesselValue === 'C') {
              // Cooker actives: Teal background with white text
              data.cell.styles.fillColor = [0, 123, 131];
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontStyle = 'bold';
            } else if (vesselValue === 'H') {
              // Holding actives: Orange/amber background with white text
              data.cell.styles.fillColor = [230, 126, 34];
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      },
      margin: { left: margin, right: margin },
      didDrawPage: function() {
        addFooter();
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 8;
  }

  // Compressed Manufacturing Procedure with smart page break
  if (formula.procedure_text) {
    // Smart page break: if less than 60mm remains, start new page
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = margin;
      addFooter();
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 123, 131);
    doc.text('MANUFACTURING PROCEDURE', margin, yPosition);
    yPosition += 8;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 34, 34);
    const maxWidth = pageWidth - (margin * 2);
    
    const procedureSteps = formula.procedure_text.split(/\d+\.\s*/).filter(step => step.trim());
    
    procedureSteps.forEach((step, index) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = margin;
        addFooter();
      }
      
      const stepNumber = `${index + 1}.`;
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 34, 34);
      doc.text(stepNumber, margin, yPosition);
      
      doc.setFont('helvetica', 'normal');
      const stepText = step.trim();
      const lines = doc.splitTextToSize(stepText, maxWidth - 25);
      
      lines.forEach((line: string, lineIndex: number) => {
        if (yPosition > pageHeight - 10) {
          doc.addPage();
          yPosition = margin;
          addFooter();
        }
        const xPos = margin + 12;
        doc.text(line, xPos, yPosition);
        yPosition += 3.5;
      });
      
      yPosition += 2;
    });
    
    yPosition += 6;
  }

  // Compressed Notes Section
  if (formula.notes) {
    if (yPosition > pageHeight - 25) {
      doc.addPage();
      yPosition = margin;
      addFooter();
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 123, 131);
    doc.text('NOTES', margin, yPosition);
    yPosition += 8;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 34, 34);
    const maxWidth = pageWidth - (margin * 2);
    const lines = doc.splitTextToSize(formula.notes, maxWidth);
    
    const maxNotesHeight = 50;
    const startY = yPosition;
    
    lines.forEach((line: string) => {
      if (yPosition > pageHeight - 10 || (yPosition - startY) > maxNotesHeight) {
        return;
      }
      doc.text(line, margin, yPosition);
      yPosition += 3.5;
    });
  }


  // Save the PDF
  const fileName = `Formula_${formula.code.replace(/[^a-zA-Z0-9]/g, '_')}_${todayET()}.pdf`;
  doc.save(fileName);
};