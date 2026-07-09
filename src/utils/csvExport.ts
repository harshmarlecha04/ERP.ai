import { LabelInventoryRecord } from "@/hooks/useLabelInventory";
import { RawMaterial } from "@/hooks/useRawMaterials";
import { formatET, todayET } from "@/utils/dateUtils";

export const exportLabelInventoryToCSV = (data: LabelInventoryRecord[], filename?: string) => {
  const headers = [
    "Customer Product",
    "Date",
    "Received Qty",
    "Used Qty", 
    "On Hand",
    "Source Sheet",
    "Created At",
    "Updated At"
  ];

  const csvData = data.map(record => [
    record.customer_product,
    record.date,
    record.received_qty?.toString() || "",
    record.used_qty?.toString() || "",
    record.on_hand?.toString() || "",
    record.source_sheet || "",
    formatET(record.created_at, "MMM d, yyyy h:mm a"),
    formatET(record.updated_at, "MMM d, yyyy h:mm a")
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
  link.setAttribute("download", filename || `label_inventory_${todayET()}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportInventoryToExcel = (data: RawMaterial[], filename?: string) => {
  const headers = [
    "RM Code",
    "Material Name", 
    "Supplier",
    "Unit of Measure",
    "Lot Number",
    "Quantity",
    "Cost per Unit",
    "Total Value",
    "Receiving Date",
    "Expiry Date",
    "COA Link",
    "Created At",
    "Updated At"
  ];

  // Flatten the data - each lot gets its own row
  const csvData: string[][] = [];
  
  data.forEach(material => {
    if (material.lots && material.lots.length > 0) {
      material.lots.forEach(lot => {
        const totalValue = (lot.quantity || 0) * (lot.cost || 0);
        csvData.push([
          material.code || "",
          material.name || "",
          material.supplier || "",
          material.unit_of_measure || "",
          lot.lot_number || "",
          (lot.quantity || 0).toString(),
          (lot.cost || 0).toString(),
          totalValue.toFixed(2),
          lot.receiving_date || "",
          lot.expiry_date || "",
          lot.coa_link || "",
          new Date(material.created_at || Date.now()).toLocaleString(),
          new Date(material.updated_at || Date.now()).toLocaleString()
        ]);
      });
    } else {
      // Material with no lots
      csvData.push([
        material.code || "",
        material.name || "",
        material.supplier || "",
        material.unit_of_measure || "",
        "No lots available",
        "0",
        "0",
        "0",
        "",
        "",
        "",
        new Date(material.created_at || Date.now()).toLocaleString(),
        new Date(material.updated_at || Date.now()).toLocaleString()
      ]);
    }
  });

  // If no data, add a message row
  if (csvData.length === 0) {
    csvData.push([
      "No inventory data available", "", "", "", "", "", "", "", "", "", "", "", ""
    ]);
  }

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
  link.setAttribute("download", filename || `raw_materials_inventory_${todayET()}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};