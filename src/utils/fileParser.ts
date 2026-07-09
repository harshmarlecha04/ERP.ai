import Papa from 'papaparse';
import Fuse from 'fuse.js';
import { readExcelFile } from './excelReader';

export interface ParsedLot {
  lot_number: string;
  quantity: number;
  cost: number;
  expiry_date: string;
}

export interface ParsedMaterial {
  code: string;
  name: string;
  supplier: string;
  unit_of_measure: string;
  lots: ParsedLot[];
}

interface RawRow {
  [key: string]: any;
}

// Common column mappings for fuzzy matching
const COLUMN_MAPPINGS = {
  partNumber: ['partnumber', 'part_number', 'part number', 'rm code', 'rmcode', 'material code', 'code', 'item code'],
  materialName: ['materialname', 'material_name', 'material name', 'name', 'rm name', 'rmname', 'item name', 'description'],
  supplier: ['supplier', 'vendor', 'manufacturer', 'source'],
  lotNumber: ['lotnumber', 'lot_number', 'lot number', 'batch', 'batch number', 'batchnumber'],
  quantity: ['quantity', 'qty', 'amount', 'stock', 'inventory'],
  unitOfMeasurement: ['unitofmeasurement', 'unit_of_measurement', 'unit of measurement', 'uom', 'unit', 'units'],
  costPerUnit: ['costperunit', 'cost_per_unit', 'cost per unit', 'unit cost', 'unitcost', 'price', 'cost'],
  expiryDate: ['expirydate', 'expiry_date', 'expiry date', 'expiration', 'expiration date', 'exp date', 'best before']
};

export function parseFile(file: File): Promise<ParsedMaterial[]> {
  return new Promise((resolve, reject) => {
    const fileType = file.name.split('.').pop()?.toLowerCase();

    if (fileType === 'xlsx' || fileType === 'xls') {
      parseExcelFile(file).then(resolve).catch(reject);
    } else if (fileType === 'csv') {
      parseCsvFile(file, ',').then(resolve).catch(reject);
    } else if (fileType === 'tsv') {
      parseCsvFile(file, '\t').then(resolve).catch(reject);
    } else if (fileType === 'json') {
      parseJsonFile(file).then(resolve).catch(reject);
    } else {
      reject(new Error('Unsupported file type. Please use .xlsx, .csv, .tsv, or .json files.'));
    }
  });
}

async function parseExcelFile(file: File): Promise<ParsedMaterial[]> {
  try {
    const jsonData = await readExcelFile(file);
    return processRowData(jsonData);
  } catch (error) {
    throw new Error('Failed to read Excel file');
  }
}

function parseCsvFile(file: File, delimiter: string): Promise<ParsedMaterial[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      delimiter,
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedData = processRowData(results.data as any[][]);
          resolve(parsedData);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error)
    });
  });
}

function parseJsonFile(file: File): Promise<ParsedMaterial[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonText = e.target?.result as string;
        const jsonData = JSON.parse(jsonText);
        console.log('🔍 JSON data received:', jsonData);
        
        // Handle different JSON structures
        let materials: ParsedMaterial[] = [];
        
        // Extract the array of items to process
        let itemsToProcess: any[] = [];
        
        if (Array.isArray(jsonData)) {
          // Direct array of materials
          itemsToProcess = jsonData;
        } else if (jsonData.materials && Array.isArray(jsonData.materials)) {
          // Nested structure with materials array
          itemsToProcess = jsonData.materials;
        } else {
          throw new Error('Invalid JSON format. Expected an array of materials or an object with a "materials" property.');
        }
        
        // Group items by RM Code and create materials with multiple lots
        const materialGroups = new Map<string, any[]>();
        
        itemsToProcess.forEach((item, index) => {
          const rmCode = item.code || item.rmCode || item.rm_code || item.partNumber || item.part_number || item["RM Code"] || `ITEM-${index}`;
          
          if (!materialGroups.has(rmCode)) {
            materialGroups.set(rmCode, []);
          }
          materialGroups.get(rmCode)!.push(item);
        });
        
        // Convert grouped items to ParsedMaterial format
        materials = Array.from(materialGroups.entries()).map(([rmCode, items]) => {
          const firstItem = items[0]; // Use first item for material info
          
          return {
            code: rmCode,
            name: firstItem.name || firstItem.materialName || firstItem.material_name || firstItem.description || firstItem["Material Name"] || '',
            supplier: firstItem.supplier || firstItem.vendor || firstItem.manufacturer || firstItem["Supplier"] || '',
            unit_of_measure: firstItem.unit_of_measure || firstItem.uom || firstItem.unit || firstItem["UoM"] || 'kg',
            lots: items.map((item, lotIndex) => ({
              lot_number: item.lot_number || item.lotNumber || item.batch || item["Lot Number"] || `LOT-${Date.now()}-${lotIndex}`,
              quantity: parseFloat(item.quantity || item.qty || item["Quantity"]) || 0,
              cost: parseFloat(item.cost || item.price || item.costPerUnit || item.cost_per_unit) || 0,
              expiry_date: formatExpiryDate(item.expiry_date || item.expiryDate || item.expiration || '') || ''
            }))
          };
        });
        
        console.log(`🎉 Successfully parsed ${materials.length} materials from JSON:`, materials);
        resolve(materials);
      } catch (error) {
        console.error('❌ JSON parsing error:', error);
        reject(new Error('Invalid JSON file format. Please check your file structure.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read JSON file'));
    reader.readAsText(file);
  });
}

function processRowData(data: any[][]): ParsedMaterial[] {
  console.log('🔍 Processing file data. Total rows:', data.length);
  
  if (data.length < 2) {
    throw new Error('File must contain at least a header row and one data row');
  }

  const headers = data[0].map((h: any) => String(h).toLowerCase().trim());
  console.log('📋 Raw headers found:', headers);
  
  const mappedColumns = mapColumns(headers);
  console.log('🗺️ Column mapping result:', mappedColumns);
  
  // Group rows by part number
  const groupedData = new Map<string, RawRow[]>();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    console.log(`📝 Processing row ${i}:`, row);
    
    const partNumber = getColumnValue(row, mappedColumns.partNumber);
    console.log(`🔑 Part number for row ${i}:`, partNumber);
    
    if (!partNumber) {
      console.log(`⚠️ Skipping row ${i} - no part number found`);
      continue;
    }
    
    const rowData: RawRow = {};
    Object.entries(mappedColumns).forEach(([key, colIndex]) => {
      if (colIndex !== -1) {
        const value = getColumnValue(row, colIndex);
        rowData[key] = value;
        console.log(`  ${key}: "${value}" (from column ${colIndex})`);
      }
    });
    
    if (!groupedData.has(partNumber)) {
      groupedData.set(partNumber, []);
    }
    groupedData.get(partNumber)!.push(rowData);
  }
  
  // Convert grouped data to ParsedMaterial format
  const materials: ParsedMaterial[] = [];
  console.log(`🏗️ Converting ${groupedData.size} unique part numbers to materials`);
  
  groupedData.forEach((rows, partNumber) => {
    console.log(`🔧 Processing material: ${partNumber} with ${rows.length} rows`);
    
    const firstRow = rows[0];
    const material: ParsedMaterial = {
      code: partNumber,
      name: firstRow.materialName || '',
      supplier: firstRow.supplier || '',
      unit_of_measure: firstRow.unitOfMeasurement || 'kg',
      lots: []
    };
    
    console.log(`📦 Created material:`, material);
    
    rows.forEach((row, index) => {
      console.log(`🔍 Checking lot data for row ${index}:`, {
        lotNumber: row.lotNumber,
        quantity: row.quantity,
        rawQuantity: row.quantity,
        parsedQuantity: parseFloat(row.quantity),
        costPerUnit: row.costPerUnit
      });
      
      // Improved lot creation logic - create lot if we have ANY meaningful data
      const hasQuantity = row.quantity && !isNaN(parseFloat(row.quantity)) && parseFloat(row.quantity) > 0;
      const hasLotNumber = row.lotNumber && String(row.lotNumber).trim().length > 0;
      const hasCost = row.costPerUnit && !isNaN(parseFloat(row.costPerUnit));
      
      if (hasQuantity || hasLotNumber || hasCost || rows.length === 1) {
        const lot = {
          lot_number: row.lotNumber || `LOT-${Date.now()}-${index}`,
          quantity: parseFloat(row.quantity) || 0,
          cost: parseFloat(row.costPerUnit) || 0,
          expiry_date: formatExpiryDate(row.expiryDate) || ''
        };
        
        console.log(`✅ Created lot:`, lot);
        material.lots.push(lot);
      } else {
        console.log(`❌ Skipped lot creation - insufficient data`);
      }
    });
    
    // If no lots with data, create a default lot
    if (material.lots.length === 0) {
      console.log(`🔄 Creating default lot for material: ${partNumber}`);
      material.lots.push({
        lot_number: `DEFAULT-${Date.now()}`,
        quantity: 0,
        cost: 0,
        expiry_date: ''
      });
    }
    
    console.log(`📋 Final material with ${material.lots.length} lots:`, material);
    materials.push(material);
  });
  
  console.log(`🎉 Successfully processed ${materials.length} materials:`, materials);
  return materials;
}

function mapColumns(headers: string[]): Record<string, number> {
  const mappedColumns: Record<string, number> = {};
  console.log('🔍 Starting column mapping for headers:', headers);
  
  Object.entries(COLUMN_MAPPINGS).forEach(([key, variations]) => {
    console.log(`🔎 Mapping column "${key}" with variations:`, variations);
    
    const fuse = new Fuse(headers, { threshold: 0.3 });
    let bestMatch = -1;
    let bestScore = 1;
    
    variations.forEach(variation => {
      const results = fuse.search(variation);
      if (results.length > 0) {
        console.log(`  Variation "${variation}" matches:`, results[0]);
        if (results[0].score! < bestScore) {
          bestScore = results[0].score!;
          bestMatch = results[0].refIndex;
        }
      }
    });
    
    mappedColumns[key] = bestMatch;
    console.log(`✅ Column "${key}" mapped to index ${bestMatch} (${bestMatch >= 0 ? headers[bestMatch] : 'NOT FOUND'})`);
  });
  
  return mappedColumns;
}

function getColumnValue(row: any[], columnIndex: number): string {
  if (columnIndex === -1 || columnIndex >= row.length) return '';
  
  const value = row[columnIndex];
  console.log(`🔍 Raw value at column ${columnIndex}:`, value, `(type: ${typeof value})`);
  
  if (value === null || value === undefined) return '';
  
  // Handle different Excel value types
  let stringValue = '';
  if (typeof value === 'number') {
    stringValue = value.toString();
  } else if (typeof value === 'boolean') {
    stringValue = value.toString();
  } else {
    stringValue = String(value);
  }
  
  // Clean up the value - remove extra whitespace and handle special characters
  stringValue = stringValue.trim().replace(/\u00A0/g, ' '); // Replace non-breaking spaces
  
  console.log(`🧹 Cleaned value:`, stringValue);
  return stringValue;
}

function formatExpiryDate(dateString: string): string {
  if (!dateString) return '';
  
  // Try to parse various date formats
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    // Try MM/DD/YYYY format
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return '';
  }
  
  return date.toISOString().split('T')[0];
}