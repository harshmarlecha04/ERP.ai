import Papa from 'papaparse';
import Fuse from 'fuse.js';
import type { ContactItem } from '@/hooks/useVendors';
import { readExcelFile } from './excelReader';

export interface ParsedVendor {
  name: string;
  contact_info?: string;
  emails: ContactItem[];
  phone_numbers: ContactItem[];
  notes?: string;
  vetting_link?: string;
  address?: string;
}

interface RawVendorRow {
  [key: string]: any;
}

// Column mappings for vendor data
const VENDOR_COLUMN_MAPPINGS = {
  name: ['name', 'vendor name', 'supplier name', 'company', 'company name', 'business name'],
  contactInfo: ['contact info', 'contact_info', 'contact information', 'general contact'],
  email: ['email', 'email address', 'primary email', 'contact email', 'emails'],
  phone: ['phone', 'phone number', 'telephone', 'mobile', 'contact number', 'phone numbers'],
  notes: ['notes', 'comments', 'description', 'remarks', 'additional info'],
  vettingLink: ['vetting link', 'vetting_link', 'certification', 'website', 'url', 'link'],
  address: ['address', 'location', 'company address', 'business address', 'office address', 'mailing address', 'street address']
};

export function parseVendorFile(file: File): Promise<ParsedVendor[]> {
  return new Promise((resolve, reject) => {
    const fileType = file.name.split('.').pop()?.toLowerCase();

    if (fileType === 'xlsx' || fileType === 'xls') {
      parseVendorExcelFile(file).then(resolve).catch(reject);
    } else if (fileType === 'csv') {
      parseVendorCsvFile(file, ',').then(resolve).catch(reject);
    } else if (fileType === 'tsv') {
      parseVendorCsvFile(file, '\t').then(resolve).catch(reject);
    } else if (fileType === 'json') {
      parseVendorJsonFile(file).then(resolve).catch(reject);
    } else {
      reject(new Error('Unsupported file type. Please use .xlsx, .csv, .tsv, or .json files.'));
    }
  });
}

async function parseVendorExcelFile(file: File): Promise<ParsedVendor[]> {
  try {
    const jsonData = await readExcelFile(file);
    if (jsonData.length === 0) return [];
    return processVendorRowData(jsonData);
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parseVendorCsvFile(file: File, delimiter: string): Promise<ParsedVendor[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      delimiter,
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const vendors = processVendorRowData(results.data as any[][]);
          resolve(vendors);
        } catch (error) {
          reject(new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      },
      error: (error) => reject(new Error(`CSV parsing error: ${error.message}`))
    });
  });
}

async function parseVendorJsonFile(file: File): Promise<ParsedVendor[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const jsonContent = JSON.parse(e.target?.result as string);
        
        if (Array.isArray(jsonContent)) {
          const vendors = jsonContent.map(item => parseVendorJsonObject(item));
          resolve(vendors);
        } else if (typeof jsonContent === 'object') {
          // Single vendor object
          const vendor = parseVendorJsonObject(jsonContent);
          resolve([vendor]);
        } else {
          reject(new Error('Invalid JSON format. Expected array or object.'));
        }
      } catch (error) {
        reject(new Error(`Failed to parse JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read JSON file'));
    reader.readAsText(file);
  });
}

function processVendorRowData(data: any[][]): ParsedVendor[] {
  if (data.length === 0) return [];
  
  // First row is headers
  const headers = data[0].map(h => String(h || '').toLowerCase().trim());
  const columnMapping = mapVendorColumns(headers);
  
  const vendors: ParsedVendor[] = [];
  
  // Process each row (skip header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every(cell => !cell)) continue; // Skip empty rows
    
    const vendor = parseVendorRow(row, columnMapping);
    if (vendor.name) {
      vendors.push(vendor);
    }
  }
  
  return vendors;
}

function mapVendorColumns(headers: string[]): Record<string, number> {
  const columnMap: Record<string, number> = {};
  
  // Create Fuse instance for fuzzy matching
  const fuse = new Fuse(headers, {
    threshold: 0.3,
    includeScore: true
  });
  
  // Map each expected column to the best matching header
  Object.entries(VENDOR_COLUMN_MAPPINGS).forEach(([key, aliases]) => {
    let bestMatch = -1;
    let bestScore = 1;
    
    aliases.forEach(alias => {
      const results = fuse.search(alias);
      if (results.length > 0 && results[0].score! < bestScore) {
        bestScore = results[0].score!;
        bestMatch = headers.indexOf(results[0].item);
      }
    });
    
    if (bestMatch !== -1) {
      columnMap[key] = bestMatch;
    }
  });
  
  return columnMap;
}

function parseVendorRow(row: any[], columnMapping: Record<string, number>): ParsedVendor {
  const vendor: ParsedVendor = {
    name: '',
    emails: [],
    phone_numbers: []
  };
  
  // Extract basic fields
  vendor.name = getColumnValue(row, columnMapping.name);
  vendor.contact_info = getColumnValue(row, columnMapping.contactInfo) || undefined;
  vendor.notes = getColumnValue(row, columnMapping.notes) || undefined;
  vendor.vetting_link = getColumnValue(row, columnMapping.vettingLink) || undefined;
  vendor.address = getColumnValue(row, columnMapping.address) || undefined;
  
  // Parse emails
  const emailValue = getColumnValue(row, columnMapping.email);
  if (emailValue) {
    vendor.emails = parseContactArray(emailValue, 'email');
  }
  
  // Parse phone numbers
  const phoneValue = getColumnValue(row, columnMapping.phone);
  if (phoneValue) {
    vendor.phone_numbers = parseContactArray(phoneValue, 'phone');
  }
  
  return vendor;
}

function parseVendorJsonObject(obj: any): ParsedVendor {
  // Debug logging - log available keys
  console.log('Raw JSON object keys:', Object.keys(obj));
  console.log('Raw address value:', obj.address);
  
  const vendor: ParsedVendor = {
    name: obj.name || obj.vendor_name || obj.company || '',
    emails: [],
    phone_numbers: []
  };
  
  vendor.contact_info = obj.contact_info || obj.contactInfo || undefined;
  vendor.notes = obj.notes || obj.comments || obj.description || undefined;
  vendor.vetting_link = obj.vetting_link || obj.vettingLink || obj.website || obj.url || undefined;
  vendor.address = obj.address || obj.location || obj.company_address || obj.office_address || obj.mailing_address || undefined;
  
  // Debug logging - confirm address extraction
  console.log('Extracted address:', vendor.address);
  
  // Parse emails - handle array or string
  if (obj.emails && Array.isArray(obj.emails)) {
    vendor.emails = obj.emails.map((email: any) => ({
      id: crypto.randomUUID(),
      value: typeof email === 'string' ? email : email.value || email.email || '',
      type: typeof email === 'object' ? (email.type || 'other') : 'other',
      label: typeof email === 'object' ? email.label : undefined
    }));
  } else if (obj.email || obj.primary_email) {
    vendor.emails = parseContactArray(obj.email || obj.primary_email, 'email');
  }
  
  // Parse phone numbers - handle array or string
  if (obj.phone_numbers && Array.isArray(obj.phone_numbers)) {
    vendor.phone_numbers = obj.phone_numbers.map((phone: any) => ({
      id: crypto.randomUUID(),
      value: typeof phone === 'string' ? phone : phone.value || phone.number || '',
      type: typeof phone === 'object' ? (phone.type || 'other') : 'other',
      label: typeof phone === 'object' ? phone.label : undefined
    }));
  } else if (obj.phone || obj.telephone || obj.mobile) {
    vendor.phone_numbers = parseContactArray(obj.phone || obj.telephone || obj.mobile, 'phone');
  }
  
  // Debug logging - final vendor object
  console.log('Final parsed vendor:', vendor);
  
  return vendor;
}

function parseContactArray(value: string, contactType: 'email' | 'phone'): ContactItem[] {
  if (!value) return [];
  
  // Split by common delimiters
  const items = value.split(/[,;|\n]/).map(item => item.trim()).filter(item => item);
  
  return items.map(item => ({
    id: crypto.randomUUID(),
    value: item,
    type: contactType === 'email' ? 'primary' : 'office',
    label: undefined
  }));
}

function getColumnValue(row: any[], columnIndex: number): string {
  if (columnIndex === undefined || columnIndex === -1 || columnIndex >= row.length) {
    return '';
  }
  
  const value = row[columnIndex];
  if (value === null || value === undefined) return '';
  
  return String(value).trim();
}