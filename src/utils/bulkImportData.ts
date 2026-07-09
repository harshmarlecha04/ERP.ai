import { useRawMaterials } from '@/hooks/useRawMaterials';

export const inventoryData = [
  {
    "PartNumber":"IIRM00286",
    " MaterialName":"Carrageenan FD265 - seaweed",
    "Supplier ":"AEP Colloids",
    "LotNumber":"H006823",
    "Quantity":1182.0,
    "UnitOfMeasurement":"kg",
    "CostPerUnit":9.5,
    "ExpiryDate":"4/30/2026"
  },
  {
    "PartNumber":"MARM00002",
    " MaterialName":"Vegapure 95 D",
    "Supplier ":"BASF Personal care",
    "LotNumber":"28215408",
    "Quantity":460.0,
    "UnitOfMeasurement":"kg",
    "CostPerUnit":33.0,
    "ExpiryDate":"4/20/2026"
  },
  {
    "PartNumber":"IIRM00322",
    " MaterialName":"Licorice root extract liquid",
    "Supplier ":"Bulk naturals",
    "LotNumber":"BN9411975/LBE",
    "Quantity":14.0,
    "UnitOfMeasurement":"kg",
    "CostPerUnit":50.0,
    "ExpiryDate":"1/11/2026"
  },
  {
    "PartNumber":"IIRM00322",
    " MaterialName":"Licorice root extract liquid",
    "Supplier ":"Bulk naturals",
    "LotNumber":"BN9413425/LBE",
    "Quantity":72.0,
    "UnitOfMeasurement":"kg",
    "CostPerUnit":50.0,
    "ExpiryDate":"1/11/2026"
  },
  {
    "PartNumber":"IIRM00257",
    " MaterialName":"DL- Malic Acid",
    "Supplier ":"Bulk Supplements",
    "LotNumber":"2111088",
    "Quantity":18.0,
    "UnitOfMeasurement":"kg",
    "CostPerUnit":28.97,
    "ExpiryDate":"1/12/2026"
  },
  {
    "PartNumber":"IARM00241",
    " MaterialName":"Lemon Balm Extract",
    "Supplier ":"Bulk Supplements",
    "LotNumber":"2417411",
    "Quantity":14.6,
    "UnitOfMeasurement":"kg",
    "CostPerUnit":36.8,
    "ExpiryDate":"1/13/2026"
  },
  {
    "PartNumber":"IARM00354",
    " MaterialName":"Magnesium Glycinate",
    "Supplier ":"Bulk Supplements",
    "LotNumber":"24085003",
    "Quantity":1.0,
    "UnitOfMeasurement":"kg",
    "CostPerUnit":30.97,
    "ExpiryDate":"3/31/2026"
  },
  {
    "PartNumber":"OARM00261",
    " MaterialName":"Organic Blueberry powder",
    "Supplier ":"Bulk Supplements",
    "LotNumber":"2405909",
    "Quantity":1.55,
    "UnitOfMeasurement":"kg",
    "CostPerUnit":46.97,
    "ExpiryDate":"9/30/2027"
  },
  {
    "PartNumber":"IARM00364",
    " MaterialName":"passion Flower extract",
    "Supplier ":"Bulk Supplements",
    "LotNumber":"2405705",
    "Quantity":3.2,
    "UnitOfMeasurement":"kg",
    "CostPerUnit":45.97,
    "ExpiryDate":"5/31/2026"
  },
  {
    "PartNumber":"IARM00243",
    " MaterialName":"Potassium Iodide",
    "Supplier ":"Bulk Supplements",
    "LotNumber":"20220823-05-1500g",
    "Quantity":1.65,
    "UnitOfMeasurement":"kg",
    "CostPerUnit":0.0,
    "ExpiryDate":"10/5/2024"
  },
  {
    "PartNumber":"IARM00344",
    " MaterialName":"Riboflavin Vit B2",
    "Supplier ":"Bulk Supplements",
    "LotNumber":"2406908",
    "Quantity":2.14,
    "UnitOfMeasurement":"kg",
    "CostPerUnit":100.0,
    "ExpiryDate":"3/31/2027"
  }
];

export function formatDateForDatabase(dateString: string): string {
  const [month, day, year] = dateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function groupInventoryDataByPartNumber() {
  const grouped = new Map();
  
  inventoryData.forEach(item => {
    const partNumber = item.PartNumber;
    if (!grouped.has(partNumber)) {
      grouped.set(partNumber, {
        code: partNumber,
        name: item[' MaterialName'].trim(),
        supplier: item['Supplier '].trim(),
        unit_of_measure: item.UnitOfMeasurement,
        lots: []
      });
    }
    
    grouped.get(partNumber).lots.push({
      lot_number: item.LotNumber,
      quantity: item.Quantity,
      cost: item.CostPerUnit,
      expiry_date: formatDateForDatabase(item.ExpiryDate)
    });
  });
  
  return Array.from(grouped.values());
}

export async function bulkImportInventory(createRawMaterial: any) {
  const groupedData = groupInventoryDataByPartNumber();
  
  for (const material of groupedData) {
    try {
      await createRawMaterial(material);
    } catch (error) {
      console.error(`Failed to import ${material.code}:`, error);
    }
  }
}