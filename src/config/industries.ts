// Central industry definitions. Drives the signup dropdown, industry-aware
// sample data, and (progressively) terminology across the app.
export type IndustryKey =
  | 'nutraceuticals'
  | 'food_beverage'
  | 'cosmetics'
  | 'chemicals'
  | 'pharmaceuticals'
  | 'general';

export interface IndustryDef {
  key: IndustryKey;
  label: string;
  // Terminology overrides — expand over time to reskin the UI per industry.
  terms: {
    product: string;   // what a finished good is called
    formula: string;   // recipe/formulation term
    unit: string;      // countable output unit
    batch: string;
  };
}

export const INDUSTRIES: IndustryDef[] = [
  { key: 'nutraceuticals', label: 'Nutraceuticals / Supplements',
    terms: { product: 'Product', formula: 'Formula', unit: 'Bottle', batch: 'Batch' } },
  { key: 'food_beverage', label: 'Food & Beverage',
    terms: { product: 'Product', formula: 'Recipe', unit: 'Case', batch: 'Batch' } },
  { key: 'cosmetics', label: 'Cosmetics / Personal Care',
    terms: { product: 'Product', formula: 'Formulation', unit: 'Unit', batch: 'Batch' } },
  { key: 'chemicals', label: 'Chemicals / Specialty Chemicals',
    terms: { product: 'Product', formula: 'Formulation', unit: 'Drum', batch: 'Lot' } },
  { key: 'pharmaceuticals', label: 'Pharmaceuticals',
    terms: { product: 'Product', formula: 'Formulation', unit: 'Unit', batch: 'Batch' } },
  { key: 'general', label: 'General Manufacturing',
    terms: { product: 'Product', formula: 'BOM', unit: 'Unit', batch: 'Batch' } },
];

export function industryByKey(key?: string | null): IndustryDef {
  return INDUSTRIES.find((i) => i.key === key) || INDUSTRIES[INDUSTRIES.length - 1];
}
