export type Unit = "mg" | "mcg" | "IU" | "g";

export interface ActiveIngredient {
  name: string;
  amountPerServing: number;
  unit: Unit;
  percentDV?: number | null;
}

export interface PanelRow {
  label: string;
  amount: string;
  percentDV: string;
  indent?: boolean;
}

export interface SupplementFactsPanel {
  header: { customerName?: string; productName: string };
  servingSize: string;
  servingsPerContainer?: number; // legacy/optional
  amountPerServingRows: PanelRow[];
  activeRows: PanelRow[];
  otherIngredients: string;
  directions: string;
  warnings: string[];
  footnotes: string[];
}

export interface ProductInput {
  customerName?: string;
  productName: string;
  servingSizeGummies: number;
  activeIngredients: ActiveIngredient[];
  otherIngredients?: string[] | null;
  directions?: string | null;
  macros?: any | null;
}


export interface VersionContext {
  version: any;
  project: any;
  servingSize: number;
  batchGummyCount?: number;
  activesRaw?: Array<{ name: string; mgPerGummy: number; unit: Unit }>;
  activeIngredients: ActiveIngredient[];
  inactives?: string[];
  defaultOtherIngredients?: string;
  unitMismatches: Array<{ name: string; providedUnit: Unit; dvUnit: Unit; suggestion: string }>;
  productName: string;
  customerName: string | null;
}
