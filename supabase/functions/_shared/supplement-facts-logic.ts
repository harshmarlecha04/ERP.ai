// Pharmvista Supplement Facts — Portable business logic (ported from Claude skill).
// Deterministic math + defaults for gummy supplement facts panels.

export type Unit = "mg" | "mcg" | "IU" | "g";

export interface ActiveIngredient {
  name: string;
  amountPerServing: number;
  unit: Unit;
  percentDV?: number | null; // if null/omitted -> uses † footnote
}

export interface MacroProfile {
  calories: number;
  totalCarbohydrateG: number;
  dietaryFiberG: number;
  totalSugarsG: number;
  includesAddedSugarsG: number;
  addedSugarsPercentDV: number;
  sodiumMg: number;
}


export interface ProductInput {
  customerName?: string;
  productName: string;
  servingSizeGummies: number;      // gummies per serving (1, 2, 3, ...)
  activeIngredients: ActiveIngredient[];
  macros?: Partial<MacroProfile>;
  otherIngredients?: string[];
  directions?: string;
}

export interface SupplementFactsPanel {
  header: { customerName?: string; productName: string };
  servingSize: string;                // e.g. "2 Gummies"
  amountPerServingRows: PanelRow[];   // Calories, Total Carbs, Sugars, Added Sugars
  activeRows: PanelRow[];             // with unit-normalized amount + %DV
  otherIngredients: string;
  directions: string;
  warnings: string[];
  footnotes: string[];
  footnote?: string;
  servingsPerContainer?: number;

}


export interface PanelRow {
  label: string;
  amount: string;
  percentDV: string; // "10%" or "†" or "**" or ""
  indent?: boolean;
}

// FDA Reference Daily Values for common actives (adult 4+ years).
// Unit is the DV's unit — the panel should compare like-for-like.
export const DAILY_VALUES: Record<string, { dv: number; unit: Unit }> = {
  "vitamin a": { dv: 900, unit: "mcg" },
  "vitamin c": { dv: 90, unit: "mg" },
  "vitamin d": { dv: 20, unit: "mcg" },
  "vitamin d3": { dv: 20, unit: "mcg" },
  "vitamin e": { dv: 15, unit: "mg" },
  "vitamin k": { dv: 120, unit: "mcg" },
  "thiamin": { dv: 1.2, unit: "mg" },
  "riboflavin": { dv: 1.3, unit: "mg" },
  "niacin": { dv: 16, unit: "mg" },
  "vitamin b6": { dv: 1.7, unit: "mg" },
  "folate": { dv: 400, unit: "mcg" },
  "folic acid": { dv: 400, unit: "mcg" },
  "vitamin b12": { dv: 2.4, unit: "mcg" },
  "biotin": { dv: 30, unit: "mcg" },
  "pantothenic acid": { dv: 5, unit: "mg" },
  "choline": { dv: 550, unit: "mg" },
  "calcium": { dv: 1300, unit: "mg" },
  "iron": { dv: 18, unit: "mg" },
  "phosphorus": { dv: 1250, unit: "mg" },
  "iodine": { dv: 150, unit: "mcg" },
  "magnesium": { dv: 420, unit: "mg" },
  "zinc": { dv: 11, unit: "mg" },
  "selenium": { dv: 55, unit: "mcg" },
  "copper": { dv: 0.9, unit: "mg" },
  "manganese": { dv: 2.3, unit: "mg" },
  "chromium": { dv: 35, unit: "mcg" },
  "molybdenum": { dv: 45, unit: "mcg" },
  "chloride": { dv: 2300, unit: "mg" },
  "sodium": { dv: 2300, unit: "mg" },
  "potassium": { dv: 4700, unit: "mg" },
};

export const DEFAULT_OTHER_INGREDIENTS = [
  "Organic Tapioca Syrup",
  "Organic Cane Sugar",
  "Purified Water",
  "Seaweed Extract",
  "Pectin",
  "Tri Sodium Citrate",
  "Citric Acid",
  "Natural Flavor and Color",
];

const WARNINGS = [
  "STORE IN COOL, DRY PLACE.",
  "SEALED FOR YOUR PROTECTION.",
  "KEEP OUT OF THE REACH OF CHILDREN.",
  "IF YOU ARE PREGNANT, NURSING OR TAKING MEDICATION, CONSULT YOUR DOCTOR BEFORE USE.",
  "MADE IN THE USA WITH GLOBALLY SOURCED INGREDIENTS.",
];

// Per-gummy defaults (skill baseline).
const PER_GUMMY_CALORIES = 10;
const PER_GUMMY_TOTAL_CARBS_G = 4;
const PER_GUMMY_DIETARY_FIBER_G = 0.5;
const PER_GUMMY_TOTAL_SUGARS_G = 1;
const PER_GUMMY_ADDED_SUGARS_G = 0.5;
const PER_GUMMY_SODIUM_MG = 0;
const ADDED_SUGARS_DV_G = 50; // FDA Added Sugars DV
const TOTAL_CARB_DV_G = 275;
const FIBER_DV_G = 28;
const SODIUM_DV_MG = 2300;

export function scaledMacros(servingSizeGummies: number): MacroProfile {
  const s = Math.max(1, Math.round(servingSizeGummies));
  const added = PER_GUMMY_ADDED_SUGARS_G * s;
  return {
    calories: PER_GUMMY_CALORIES * s,
    totalCarbohydrateG: PER_GUMMY_TOTAL_CARBS_G * s,
    dietaryFiberG: PER_GUMMY_DIETARY_FIBER_G * s,
    totalSugarsG: PER_GUMMY_TOTAL_SUGARS_G * s,
    includesAddedSugarsG: added,
    addedSugarsPercentDV: Math.max(1, Math.round((added / ADDED_SUGARS_DV_G) * 100)),
    sodiumMg: PER_GUMMY_SODIUM_MG * s,
  };
}

export function defaultDirections(servingSizeGummies: number): string {
  const s = Math.max(1, Math.round(servingSizeGummies));
  const word = numberWord(s);
  return `For adults, fully chew ${s} (${word}) gumm${s === 1 ? "y" : "ies"} per day or as directed by a health professional.`;
}

function numberWord(n: number): string {
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  return words[n] ?? String(n);
}


function lookupDV(name: string): { dv: number; unit: Unit } | null {
  const key = name.trim().toLowerCase();
  if (DAILY_VALUES[key]) return DAILY_VALUES[key];
  // Fuzzy: try first two words
  const parts = key.split(/\s+/);
  for (let i = parts.length; i > 0; i--) {
    const candidate = parts.slice(0, i).join(" ");
    if (DAILY_VALUES[candidate]) return DAILY_VALUES[candidate];
  }
  return null;
}

function convertToUnit(amount: number, from: Unit, to: Unit): number | null {
  if (from === to) return amount;
  if (from === "g" && to === "mg") return amount * 1000;
  if (from === "mg" && to === "g") return amount / 1000;
  if (from === "mg" && to === "mcg") return amount * 1000;
  if (from === "mcg" && to === "mg") return amount / 1000;
  return null; // IU or unsupported cross-unit
}

function fmtAmount(amount: number, unit: Unit): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : String(rounded)} ${unit}`;
}

function fmtPercent(p: number): string {
  return `${Math.round(p)}%`;
}

export interface UnitMismatch {
  name: string;
  providedUnit: Unit;
  dvUnit: Unit;
  suggestion: string;
}

export function detectUnitMismatches(actives: ActiveIngredient[]): UnitMismatch[] {
  const out: UnitMismatch[] = [];
  for (const a of actives) {
    const dv = lookupDV(a.name);
    if (!dv) continue;
    if (dv.unit !== a.unit) {
      // If auto-convertible, it's fine — no mismatch to flag.
      if (convertToUnit(a.amountPerServing, a.unit, dv.unit) !== null) continue;
      out.push({
        name: a.name,
        providedUnit: a.unit,
        dvUnit: dv.unit,
        suggestion: `The Daily Value for ${a.name} is expressed in ${dv.unit}. The provided amount is in ${a.unit}. Please confirm the correct unit.`,
      });
    }
  }
  return out;
}

function buildActiveRows(actives: ActiveIngredient[]): PanelRow[] {
  return actives.map((a) => {
    const dv = lookupDV(a.name);
    let pct: string = "†";
    let displayAmount = a.amountPerServing;
    let displayUnit = a.unit;
    if (dv) {
      const converted = convertToUnit(a.amountPerServing, a.unit, dv.unit);
      if (converted !== null) {
        displayAmount = converted;
        displayUnit = dv.unit;
        const p = (converted / dv.dv) * 100;
        pct = fmtPercent(p);
      }
    }
    if (typeof a.percentDV === "number") pct = fmtPercent(a.percentDV);
    return {
      label: a.name,
      amount: fmtAmount(displayAmount, displayUnit),
      percentDV: pct,
    };
  });
}

export function buildSupplementFactsPanel(input: ProductInput): SupplementFactsPanel {
  const macros: MacroProfile = { ...scaledMacros(input.servingSizeGummies), ...(input.macros ?? {}) };
  const s = Math.max(1, Math.round(input.servingSizeGummies));

  const fiberPct = Math.round((macros.dietaryFiberG / FIBER_DV_G) * 100);
  const carbPct = Math.round((macros.totalCarbohydrateG / TOTAL_CARB_DV_G) * 100);
  const sodiumPct = Math.round((macros.sodiumMg / SODIUM_DV_MG) * 100);
  const addedSugarsLabel = macros.includesAddedSugarsG < 1
    ? `Includes <1 g Added Sugars`
    : `Includes ${macros.includesAddedSugarsG} g Added Sugars`;

  const amountPerServingRows: PanelRow[] = [
    { label: "Calories", amount: String(macros.calories), percentDV: "" },
    { label: "Total Carbohydrate", amount: `${macros.totalCarbohydrateG} g`, percentDV: `${carbPct}%†` },
    { label: "Dietary Fiber", amount: `${macros.dietaryFiberG} g`, percentDV: `${fiberPct}%†`, indent: true },
    { label: "Total Sugars", amount: `${macros.totalSugarsG} g`, percentDV: "", indent: true },
    { label: addedSugarsLabel, amount: "", percentDV: `${macros.addedSugarsPercentDV}%†`, indent: true },
    { label: "Sodium", amount: `${macros.sodiumMg} mg`, percentDV: `${sodiumPct}%` },
  ];

  const footnote = "*Percent Daily Values are based on a 2,000 calorie diet. †Daily Value not established.";

  return {
    header: { customerName: input.customerName, productName: input.productName },
    servingSize: `${s} Gumm${s === 1 ? "y" : "ies"}`,
    servingsPerContainer: 2,
    amountPerServingRows,
    activeRows: buildActiveRows(input.activeIngredients),
    otherIngredients: (input.otherIngredients?.length ? input.otherIngredients : DEFAULT_OTHER_INGREDIENTS).join(", ") + ".",
    directions: input.directions ?? defaultDirections(input.servingSizeGummies),
    warnings: WARNINGS,
    footnotes: [footnote],
    footnote,
  };
}

