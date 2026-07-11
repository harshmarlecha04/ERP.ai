// Central industry definitions, grounded in how each industry actually manufactures.
// Drives: the signup dropdown, industry-aware sample data, terminology, and the
// Industry Profile shown in Settings. Expand this file to reskin the app further.
export type IndustryKey =
  | 'nutraceuticals' | 'food_beverage' | 'cosmetics'
  | 'chemicals' | 'pharmaceuticals' | 'general';

export interface IndustryDef {
  key: IndustryKey;
  label: string;
  blurb: string;
  terms: { product: string; formula: string; unit: string; batch: string };
  productionStages: string[];   // the real workflow steps for this industry
  units: string[];              // common output / packaging units
  materialCategories: string[]; // typical raw-material groupings
  documents: string[];          // compliance / QC paperwork
}

export const INDUSTRIES: IndustryDef[] = [
  {
    key: 'nutraceuticals',
    label: 'Nutraceuticals / Supplements',
    blurb: 'Gummies, capsules, powders and other dietary supplements.',
    terms: { product: 'Product', formula: 'Formula', unit: 'Bottle', batch: 'Batch' },
    productionStages: ['Weighing', 'Mixing', 'Deposit / Encapsulation', 'Drying', 'Coating', 'Packaging'],
    units: ['Bottle', 'Pouch', 'Case', 'kg'],
    materialCategories: ['Active ingredients', 'Excipients', 'Flavors & colors', 'Coatings', 'Packaging'],
    documents: ['Supplement Facts panel', 'Certificate of Analysis (COA)', 'Batch record'],
  },
  {
    key: 'food_beverage',
    label: 'Food & Beverage',
    blurb: 'Packaged foods, snacks, and beverages under HACCP / FSMA.',
    terms: { product: 'Product', formula: 'Recipe', unit: 'Case', batch: 'Batch' },
    productionStages: ['Receiving', 'Preparation', 'Cooking / Mixing', 'Cooling', 'Filling', 'Packaging'],
    units: ['Case', 'Pallet', 'Bottle', 'kg', 'L'],
    materialCategories: ['Ingredients', 'Additives', 'Flavors', 'Packaging', 'Labels'],
    documents: ['Nutrition Facts panel', 'HACCP plan', 'Certificate of Analysis (COA)', 'Lot traceability record'],
  },
  {
    key: 'cosmetics',
    label: 'Cosmetics / Personal Care',
    blurb: 'Skincare, haircare and color cosmetics — emulsions and fills.',
    terms: { product: 'Product', formula: 'Formulation', unit: 'Unit', batch: 'Batch' },
    productionStages: ['Weighing', 'Phase preparation', 'Emulsification', 'Cooling', 'QC', 'Filling', 'Packaging'],
    units: ['Unit', 'Jar', 'Tube', 'Bottle', 'kg'],
    materialCategories: ['Actives', 'Emulsifiers', 'Emollients', 'Fragrance', 'Preservatives', 'Packaging'],
    documents: ['Certificate of Analysis (COA)', 'Product safety assessment', 'Batch record'],
  },
  {
    key: 'chemicals',
    label: 'Chemicals / Specialty Chemicals',
    blurb: 'Reacted or blended chemical products in batch reactors.',
    terms: { product: 'Product', formula: 'Formulation', unit: 'Drum', batch: 'Lot' },
    productionStages: ['Charging', 'Reaction', 'Distillation / Filtration', 'Blending', 'QC', 'Drumming / Filling'],
    units: ['Drum', 'Tote / IBC', 'kg', 'L'],
    materialCategories: ['Feedstocks', 'Catalysts', 'Solvents', 'Additives', 'Packaging'],
    documents: ['Certificate of Analysis (COA)', 'Safety Data Sheet (SDS)', 'Batch record'],
  },
  {
    key: 'pharmaceuticals',
    label: 'Pharmaceuticals',
    blurb: 'Tablets, capsules and liquids under GMP.',
    terms: { product: 'Product', formula: 'Formulation', unit: 'Unit', batch: 'Batch' },
    productionStages: ['Dispensing', 'Granulation', 'Drying', 'Blending', 'Compression', 'Coating', 'Packaging'],
    units: ['Unit', 'Blister', 'Bottle', 'kg'],
    materialCategories: ['Active pharmaceutical ingredients', 'Excipients', 'Coatings', 'Solvents', 'Packaging'],
    documents: ['Batch Manufacturing Record', 'Certificate of Analysis (COA)', 'GMP compliance record'],
  },
  {
    key: 'general',
    label: 'General Manufacturing',
    blurb: 'Discrete or process manufacturing — a flexible default.',
    terms: { product: 'Product', formula: 'BOM', unit: 'Unit', batch: 'Batch' },
    productionStages: ['Intake', 'Fabrication', 'Assembly', 'QC', 'Packaging'],
    units: ['Unit', 'Case', 'Pallet', 'kg'],
    materialCategories: ['Raw materials', 'Components', 'Consumables', 'Packaging'],
    documents: ['Certificate of Analysis (COA)', 'Inspection report', 'Work order'],
  },
];

export function industryByKey(key?: string | null): IndustryDef {
  return INDUSTRIES.find((i) => i.key === key) || INDUSTRIES[INDUSTRIES.length - 1];
}
