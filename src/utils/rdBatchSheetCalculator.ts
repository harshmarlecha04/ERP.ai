import type { RDBaseTemplate, RDBaseTemplateIngredient } from "@/hooks/useRDBaseTemplates";

export interface BatchActive {
  active_name: string;
  mg_per_gummy: number;
  overage_pct?: number;
}

export type RowSection = "inactive_bulk" | "actives" | "color_flavor" | "sweetener_masking";

export interface ComputedIngredientRow {
  name: string;
  supplier?: string | null;
  percent: number;
  grams: number;
  highlight: string;
  isActive: boolean;
  section: RowSection;
}

export interface CalculationLine {
  active_name: string;
  text: string;
  grams: number;
}

export interface BatchSheetData {
  title: string;
  date: string;
  moldSize: string;
  objective: string;
  batchSizeLine: string;
  pieceWeightG: number;
  gummiesCount: number;
  calculationLines: CalculationLine[];
  ingredients: ComputedIngredientRow[];
  totals: { percent: number; grams: number };
  procedureSteps: string[];
}

const formatGrams = (g: number, role?: string | null): string => {
  if (g === 0) return "0";
  // Tiny actives: up to 5 decimals, strip trailing zeros
  if (g < 0.01) return g.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
  if (role === "syrup" || role === "sugar" || role === "water") {
    // whole gm if >= 10, else 1 decimal
    return g >= 10 ? Math.round(g).toString() : g.toFixed(2);
  }
  if (g < 1) return g.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return g.toFixed(2);
};

export const formatGramsValue = formatGrams;

const round2 = (n: number) => Math.round(n * 100) / 100;

export const calculateBatchSheet = (params: {
  projectName: string;
  customerName: string;
  flavor: string;
  date?: Date;
  template: RDBaseTemplate;
  gummiesCount: number;
  pieceWeightG: number;
  actives: BatchActive[];
}): BatchSheetData => {
  const { template, gummiesCount, pieceWeightG, actives, projectName, customerName, flavor } = params;
  const targetBatchG = gummiesCount * pieceWeightG;

  // Compute active grams + calculation lines
  const calculationLines: CalculationLine[] = [];
  const activeRows: ComputedIngredientRow[] = actives.map((a) => {
    const mgTotal = gummiesCount * a.mg_per_gummy;
    const baseG = mgTotal / 1000;
    const overage = a.overage_pct || 0;
    const grams = baseG * (1 + overage / 100);
    let text = `${gummiesCount} gummies × ${a.mg_per_gummy} mg = ${mgTotal.toLocaleString()} mg ÷ 1000 = ${baseG.toFixed(baseG < 0.01 ? 5 : 2)} gm`;
    if (overage > 0) text += ` + ${overage}% = ${grams.toFixed(grams < 0.01 ? 5 : 2)} gm`;
    calculationLines.push({ active_name: a.active_name, text, grams });
    return {
      name: a.active_name,
      supplier: null,
      percent: 0, // recomputed
      grams,
      highlight: "orange",
      isActive: true,
      section: "actives" as const,
    };
  });

  // Base ingredient rows
  const baseRows: ComputedIngredientRow[] = (template.ingredients || []).map((ing: RDBaseTemplateIngredient) => {
    const grams = (Number(ing.default_percent) / 100) * targetBatchG;
    return {
      name: ing.name,
      supplier: ing.supplier ?? null,
      percent: 0,
      grams,
      highlight: ing.highlight_color || "none",
      isActive: false,
      section: (ing.section || "inactive_bulk") as RowSection,
    };
  });

  // Order: inactive_bulk -> actives -> color_flavor -> sweetener_masking
  const sectionOrder: RowSection[] = ["inactive_bulk", "actives", "color_flavor", "sweetener_masking"];
  const all: ComputedIngredientRow[] = [];
  sectionOrder.forEach((sec) => {
    if (sec === "actives") {
      all.push(...activeRows);
    } else {
      all.push(...baseRows.filter((r) => r.section === sec));
    }
  });
  const totalG = all.reduce((s, r) => s + r.grams, 0);
  all.forEach((r) => {
    r.percent = totalG > 0 ? (r.grams / totalG) * 100 : 0;
  });

  // Procedure: substitute tokens
  const substitute = (txt: string) =>
    txt
      .replace(/\{cook_temp\}/g, String(template.cook_temp_c ?? ""))
      .replace(/\{brix\}/g, String(template.brix_target ?? ""))
      .replace(/\{add_active_temp\}/g, String(template.add_active_temp_c ?? ""))
      .replace(/\{tri_sodium_citrate_temp\}/g, String(template.tri_sodium_citrate_temp_c ?? ""));

  const procedureSteps = (template.steps || []).map((s) => substitute(s.text));

  const date = params.date || new Date();
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;

  const activeNamesShort = actives.map((a) => a.active_name).join(", ") || "Active";
  const objective = `Develop ${activeNamesShort} in ${flavor || "—"} flavor for ${customerName}`;

  return {
    title: projectName,
    date: dateStr,
    moldSize: template.mold_size || "—",
    objective,
    batchSizeLine: `${Math.round(targetBatchG)} gm (${gummiesCount} gummies) - Average Piece Weight: ${pieceWeightG} gm`,
    pieceWeightG,
    gummiesCount,
    calculationLines,
    ingredients: all,
    totals: { percent: round2(all.reduce((s, r) => s + r.percent, 0)), grams: round2(totalG) },
    procedureSteps,
  };
};
