import { PackagingBalance, PackagingHistory } from "@/hooks/usePackagingInventory";
import { todayET } from "@/utils/dateUtils";

export const exportPackagingToCSV = (data: PackagingBalance[], filename?: string) => {
  const headers = [
    "Category",
    "Item Name",
    "Description",
    "SKU",
    "On Hand",
    "UOM",
    "Location",
    "Min Level",
    "Notes"
  ];

  const csvData = data.map(record => [
    record.category,
    record.item_name,
    record.description || "",
    record.sku || "",
    record.on_hand?.toString() || "0",
    record.uom,
    record.location || "",
    record.min_level?.toString() || "0",
    record.notes || ""
  ]);

  // Escape quotes and handle commas in data
  const escapeCsvField = (field: string) => {
    if (field.includes('"') || field.includes(',') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const csvContent = [
    headers.join(","),
    ...csvData.map(row => row.map(cell => escapeCsvField(cell)).join(","))
  ].join("\n");

  // Add BOM for proper UTF-8 encoding in Excel
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename || `packaging_inventory_${todayET()}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportPackagingHistoryToCSV = (data: PackagingHistory[], filename?: string) => {
  const headers = [
    "Date",
    "Category",
    "Item Name",
    "Movement Type",
    "Quantity",
    "Vendor",
    "PO",
    "Location",
    "Notes"
  ];

  const csvData = data.map(record => [
    record.move_date,
    record.category,
    record.item_name,
    record.move_type,
    record.qty?.toString() || "0",
    record.vendor || "",
    record.po || "",
    record.location || "",
    record.notes || ""
  ]);

  // Escape quotes and handle commas in data
  const escapeCsvField = (field: string) => {
    if (field.includes('"') || field.includes(',') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const csvContent = [
    headers.join(","),
    ...csvData.map(row => row.map(cell => escapeCsvField(cell)).join(","))
  ].join("\n");

  // Add BOM for proper UTF-8 encoding in Excel
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename || `packaging_history_${todayET()}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generateItemsTemplate = () => {
  const headers = [
    "category",
    "item_name", 
    "description",
    "sku",
    "uom",
    "location",
    "min_level",
    "notes"
  ];

  const sampleData = [
    ["BOTTLES", "250cc Clear", "Clear plastic bottle 250ml", "BTL-250-CLR", "ea", "Rack A1", "100", "Standard clear bottle"],
    ["CAPS", "28mm White Cap", "White screw-on cap", "CAP-28-WHT", "ea", "Rack B2", "500", "Food grade plastic"],
    ["POUCHES", "Stand-up Pouch 8oz", "Aluminum stand-up pouch", "PCH-8OZ-STD", "ea", "Rack C3", "200", "Heat sealable"],
    ["CORRUGATED", "12x8x6 Box", "Shipping box corrugated", "BOX-12X8X6", "ea", "Rack D4", "50", "32 ECT rating"]
  ];

  const csvContent = [
    headers.join(","),
    ...sampleData.map(row => row.join(","))
  ].join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "packaging_items_template.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generateMovementsTemplate = () => {
  const headers = [
    "category",
    "item_name",
    "move_date",
    "move_type",
    "qty",
    "po",
    "vendor",
    "location",
    "notes"
  ];

  const sampleData = [
    ["BOTTLES", "250cc Clear", "2024-01-15", "RECEIPT", "1000", "PO-2024-001", "ABC Packaging", "Rack A1", "First delivery of month"],
    ["CAPS", "28mm White Cap", "2024-01-15", "RECEIPT", "2000", "PO-2024-002", "XYZ Caps Inc", "Rack B2", "Regular monthly order"],
    ["BOTTLES", "250cc Clear", "2024-01-16", "USAGE", "-100", "", "", "Production", "Used for Batch #123"],
    ["POUCHES", "Stand-up Pouch 8oz", "2024-01-17", "ADJUSTMENT", "50", "", "", "Rack C3", "Found extra inventory during count"]
  ];

  const csvContent = [
    headers.join(","),
    ...sampleData.map(row => row.join(","))
  ].join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "packaging_movements_template.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};