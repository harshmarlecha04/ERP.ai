// Raw materials data extracted from uploaded spreadsheet images
export interface RawMaterialLot {
  id: string;
  lotNumber: string;
  quantity: number;
  expiryDate: string;
  receivedDate: string;
  status: 'active' | 'warning' | 'expired' | 'quarantined';
  costPerUom: number;
}

export interface RawMaterial {
  rmCode: string;
  rmName: string;
  supplier: string;
  uom: string;
  lots: RawMaterialLot[];
  totalQuantity: number;
  totalCost: number;
  coaFile?: { name: string; url: string };
}

// Helper function to determine lot status based on expiry date
const getLotStatus = (expiryDate: string): 'active' | 'warning' | 'expired' | 'quarantined' => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'warning';
  return 'active';
};

// Inventory data from user upload
export const rawMaterialsData: RawMaterial[] = [
  {
    rmCode: "IIRM00286",
    rmName: "Carrageenan FD265 - seaweed",
    supplier: "AEP Colloids",
    uom: "kg",
    lots: [
      {
        id: "LOT001",
        lotNumber: "H006823",
        quantity: 9.5,
        expiryDate: "2026-04-30",
        receivedDate: "2024-01-15",
        status: getLotStatus("2026-04-30"),
        costPerUom: 1182,
      },
    ],
    totalQuantity: 9.5,
    totalCost: 11229.00,
  },
  {
    rmCode: "MARM00002",
    rmName: "Vegapure 95 D",
    supplier: "BASF Personal care",
    uom: "kg",
    lots: [
      {
        id: "LOT002",
        lotNumber: "28215408",
        quantity: 460,
        expiryDate: "2026-04-20",
        receivedDate: "2024-02-10",
        status: getLotStatus("2026-04-20"),
        costPerUom: 33,
      },
    ],
    totalQuantity: 460,
    totalCost: 15180.00,
  },
  {
    rmCode: "IIRM00322",
    rmName: "Licorice root extract liquid",
    supplier: "Bulk naturals",
    uom: "kg",
    lots: [
      {
        id: "LOT003",
        lotNumber: "BN9411975/LBE",
        quantity: 14,
        expiryDate: "2026-01-11",
        receivedDate: "2024-03-15",
        status: getLotStatus("2026-01-11"),
        costPerUom: 50,
      },
      {
        id: "LOT004",
        lotNumber: "BN9413425/LBE",
        quantity: 72,
        expiryDate: "2026-01-11",
        receivedDate: "2024-03-20",
        status: getLotStatus("2026-01-11"),
        costPerUom: 50,
      },
    ],
    totalQuantity: 86,
    totalCost: 4300.00,
  },
  {
    rmCode: "IIRM00257",
    rmName: "DL- Malic Acid",
    supplier: "Bulk Supplements",
    uom: "kg",
    lots: [
      {
        id: "LOT005",
        lotNumber: "2111088",
        quantity: 18,
        expiryDate: "2026-01-12",
        receivedDate: "2024-04-05",
        status: getLotStatus("2026-01-12"),
        costPerUom: 28.97,
      },
    ],
    totalQuantity: 18,
    totalCost: 521.46,
  },
  {
    rmCode: "IARM00241",
    rmName: "Lemon Balm Extract",
    supplier: "Bulk Supplements",
    uom: "kg",
    lots: [
      {
        id: "LOT006",
        lotNumber: "2417411",
        quantity: 14.6,
        expiryDate: "2026-01-13",
        receivedDate: "2024-04-10",
        status: getLotStatus("2026-01-13"),
        costPerUom: 36.8,
      },
    ],
    totalQuantity: 14.6,
    totalCost: 537.28,
  },
  {
    rmCode: "IARM00354",
    rmName: "Magnesium Glycinate",
    supplier: "Bulk Supplements",
    uom: "kg",
    lots: [
      {
        id: "LOT007",
        lotNumber: "24085003",
        quantity: 1,
        expiryDate: "2026-03-31",
        receivedDate: "2024-05-01",
        status: getLotStatus("2026-03-31"),
        costPerUom: 30.97,
      },
    ],
    totalQuantity: 1,
    totalCost: 30.97,
  },
  {
    rmCode: "OARM00261",
    rmName: "Organic Blueberry powder",
    supplier: "Bulk Supplements",
    uom: "kg",
    lots: [
      {
        id: "LOT008",
        lotNumber: "IARM00364",
        quantity: 1,
        expiryDate: "2024-10-05",
        receivedDate: "2024-05-15",
        status: getLotStatus("2024-10-05"),
        costPerUom: 0,
      },
    ],
    totalQuantity: 1,
    totalCost: 0.00,
  },
  {
    rmCode: "IARM00243",
    rmName: "passion Flower extract",
    supplier: "Bulk Supplements",
    uom: "kg",
    lots: [
      {
        id: "LOT009",
        lotNumber: "2405909",
        quantity: 1.55,
        expiryDate: "2027-09-30",
        receivedDate: "2024-06-01",
        status: getLotStatus("2027-09-30"),
        costPerUom: 46.97,
      },
    ],
    totalQuantity: 1.55,
    totalCost: 72.80,
  },
  {
    rmCode: "IARM00344",
    rmName: "Potassium Iodide",
    supplier: "Bulk Supplements",
    uom: "kg",
    lots: [
      {
        id: "LOT010",
        lotNumber: "2405705",
        quantity: 3.2,
        expiryDate: "2026-05-31",
        receivedDate: "2024-06-10",
        status: getLotStatus("2026-05-31"),
        costPerUom: 45.97,
      },
    ],
    totalQuantity: 3.2,
    totalCost: 147.10,
  },
  {
    rmCode: "IARM00357",
    rmName: "Riboflavin Vit B2",
    supplier: "Bulk Supplements",
    uom: "kg",
    lots: [
      {
        id: "LOT011",
        lotNumber: "20220823-05-1500g",
        quantity: 1.65,
        expiryDate: "2024-10-05",
        receivedDate: "2024-07-01",
        status: getLotStatus("2024-10-05"),
        costPerUom: 0,
      },
    ],
    totalQuantity: 1.65,
    totalCost: 0.00,
  },
  {
    rmCode: "IARM00361",
    rmName: "Vitamin K1 1%",
    supplier: "Bulk Supplements",
    uom: "g",
    lots: [
      {
        id: "LOT012",
        lotNumber: "2405009",
        quantity: 400,
        expiryDate: "2026-09-30",
        receivedDate: "2024-07-15",
        status: getLotStatus("2026-09-30"),
        costPerUom: 68.97,
      },
      {
        id: "LOT013",
        lotNumber: "2411011",
        quantity: 120,
        expiryDate: "2026-10-01",
        receivedDate: "2024-08-01",
        status: getLotStatus("2026-10-01"),
        costPerUom: 397.76,
      },
    ],
    totalQuantity: 520,
    totalCost: 75319.20,
  },
  {
    rmCode: "IARM00260",
    rmName: "Elderberry powder extract",
    supplier: "Cactus botanics",
    uom: "kg",
    lots: [
      {
        id: "LOT014",
        lotNumber: "21103-B5791",
        quantity: 0.9,
        expiryDate: "2026-10-02",
        receivedDate: "2024-08-15",
        status: getLotStatus("2026-10-02"),
        costPerUom: 185,
      },
    ],
    totalQuantity: 0.9,
    totalCost: 166.50,
  },
  {
    rmCode: "IARM00301",
    rmName: "Senna Extract",
    supplier: "Cactus botanics",
    uom: "kg",
    lots: [
      {
        id: "LOT015",
        lotNumber: "KVN/SEN/20/0701",
        quantity: 17.5,
        expiryDate: "2023-06-30",
        receivedDate: "2024-09-15",
        status: getLotStatus("2023-06-30"),
        costPerUom: 51,
      },
    ],
    totalQuantity: 17.5,
    totalCost: 892.50,
  },
  {
    rmCode: "IIRM00168",
    rmName: "Capol Wax - 418 Nop",
    supplier: "Capol",
    uom: "kg",
    lots: [
      {
        id: "LOT016",
        lotNumber: "PB00002401",
        quantity: 150,
        expiryDate: "2026-11-01",
        receivedDate: "2024-11-05",
        status: getLotStatus("2026-11-01"),
        costPerUom: 23.93,
      },
    ],
    totalQuantity: 150,
    totalCost: 3589.50,
  },
  {
    rmCode: "IIRM00149",
    rmName: "Pigment blend White",
    supplier: "Colorcon",
    uom: "kg",
    lots: [
      {
        id: "LOT017",
        lotNumber: "WP869766",
        quantity: 2.3,
        expiryDate: "2025-04-30",
        receivedDate: "2024-10-01",
        status: getLotStatus("2025-04-30"),
        costPerUom: 145.61,
      },
    ],
    totalQuantity: 2.3,
    totalCost: 334.90,
  },
  {
    rmCode: "OIRM00066",
    rmName: "Organic Peach Flavor",
    supplier: "Custom Flavors",
    uom: "kg",
    lots: [
      {
        id: "LOT018",
        lotNumber: "2023-07322",
        quantity: 0,
        expiryDate: "2025-05-01",
        receivedDate: "2024-10-15",
        status: getLotStatus("2025-05-01"),
        costPerUom: 53.586,
      },
    ],
    totalQuantity: 0,
    totalCost: 0.00,
  },
  {
    rmCode: "IIRM00260",
    rmName: "Blue color powder",
    supplier: "DDW",
    uom: "kg",
    lots: [
      {
        id: "LOT019",
        lotNumber: "202502170014",
        quantity: 34.75,
        expiryDate: "2026-02-17",
        receivedDate: "2024-11-01",
        status: getLotStatus("2026-02-17"),
        costPerUom: 38.889,
      },
    ],
    totalQuantity: 34.75,
    totalCost: 1351.39,
  },
  {
    rmCode: "IARM00259",
    rmName: "Vitamin C",
    supplier: "Cactus Botanics",
    uom: "kg",
    lots: [
      {
        id: "LOT020",
        lotNumber: "UK10C0064",
        quantity: 85.7,
        expiryDate: "2023-07-02",
        receivedDate: "2024-10-15",
        status: getLotStatus("2023-07-02"),
        costPerUom: 3.5,
      },
    ],
    totalQuantity: 85.7,
    totalCost: 299.95,
  },
];