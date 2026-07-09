export type RawMaterialLot = {
  id: string;
  raw_material_id: string;
  lot_number: string | null;
  quantity: number;
  cost: number;
  receiving_date: string | null;
  expires_on: string | null;
  coa_link?: string | null;
  created_at: string;
  updated_at: string;
};

export type RawMaterial = {
  id: string;
  code: string;
  name: string;
  uom: string;
  unit_of_measure: string;
  supplier: string | null;
  density_kg_per_l?: number | null;
  lots: RawMaterialLot[];
  created_at: string;
  updated_at: string;
  is_archived?: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
};

export type RawMaterialUsageStats = {
  raw_material_id: string;
  code: string;
  name: string;
  supplier: string | null;
  usage_count: number;
  total_quantity_used: number;
  last_used_date: string | null;
  first_used_date: string | null;
};

export type RawMaterialForm = {
  id?: string | null;
  code: string;
  name: string;
  uom: string;
  supplier?: string | null;
  density_kg_per_l?: number | null;
  lots: {
    id?: string | null;
    lot_number: string;
    quantity: number;
    cost: number;
    receiving_date?: string | null;
    expires_on?: string | null;
    coa_link?: string | null;
  }[];
};