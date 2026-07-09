import { readExcelFile } from './excelReader';

export interface ParsedLabelInventory {
  customer_product: string;
  on_hand: number;
  notes?: string;
  isValid: boolean;
  validationError?: string;
}

export async function parseLabelInventoryFile(file: File): Promise<ParsedLabelInventory[]> {
  try {
    const rawData = await readExcelFile(file);
    return processLabelInventoryData(rawData);
  } catch (error) {
    throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function processLabelInventoryData(data: any[][]): ParsedLabelInventory[] {
  const results: ParsedLabelInventory[] = [];
  
  // Find where data starts - skip headers and empty rows
  let startRow = 0;
  for (let i = 0; i < data.length && i < 10; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    const firstCell = row[0]?.toString().toLowerCase() || '';
    const secondCell = row[1];
    
    // Check if this looks like a header row (common patterns)
    const isHeader = 
      firstCell.includes('customer') || 
      firstCell.includes('product') ||
      firstCell.includes('label') ||
      firstCell.includes('name') ||
      firstCell.includes('item') ||
      (firstCell.length < 50 && !secondCell); // Short text with no quantity is likely a header
    
    if (isHeader) {
      startRow = i + 1;
      break;
    }
    
    // If first row has a valid quantity, start from row 0
    if (i === 0 && (typeof secondCell === 'number' || !isNaN(parseFloat(String(secondCell))))) {
      startRow = 0;
      break;
    }
  }
  
  // If no header found and first row doesn't have quantity, assume first row is header
  if (startRow === 0 && data.length > 0) {
    const firstRowSecondCell = data[0][1];
    if (!firstRowSecondCell || isNaN(parseFloat(String(firstRowSecondCell)))) {
      startRow = 1;
    }
  }

  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const productName = row[0]?.toString().trim() || '';
    const onHandValue = row[1];
    const notes = row[2]?.toString().trim() || undefined;

    // Skip empty rows
    if (!productName) continue;

    // Skip category headers - these are typically short labels without quantities
    // Examples: "USA Labels", "UK Labels", "Label Inventory", etc.
    const looksLikeCategoryHeader = 
      productName.length < 30 && // Short text
      (onHandValue === null || onHandValue === undefined || onHandValue === '') && // No quantity
      (
        productName.toLowerCase().includes('label') ||
        productName.toLowerCase().includes('usa') ||
        productName.toLowerCase().includes('uk') ||
        productName.toLowerCase().includes('japan') ||
        productName.toLowerCase().includes('inventory') ||
        productName.toLowerCase().includes('section')
      );
    
    if (looksLikeCategoryHeader) {
      continue;
    }

    // Parse on-hand quantity
    let onHand = 0;
    let isValid = true;
    let validationError: string | undefined;

    if (onHandValue === null || onHandValue === undefined || onHandValue === '') {
      onHand = 0;
    } else if (typeof onHandValue === 'number') {
      onHand = onHandValue;
    } else if (typeof onHandValue === 'string') {
      const cleaned = onHandValue.trim();
      if (cleaned === '*' || cleaned === '' || cleaned.toLowerCase() === 'in use') {
        onHand = 0;
      } else {
        const parsed = parseFloat(cleaned.replace(/,/g, ''));
        if (isNaN(parsed)) {
          isValid = false;
          validationError = `Invalid quantity: "${cleaned}"`;
          onHand = 0;
        } else {
          onHand = parsed;
        }
      }
    }

    // Validate product name
    if (!productName || productName.length < 3) {
      isValid = false;
      validationError = 'Product name too short';
    }

    results.push({
      customer_product: productName,
      on_hand: onHand,
      notes,
      isValid,
      validationError,
    });
  }

  return results;
}
