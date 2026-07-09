import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type IngredientSection = "inactive_bulk" | "color_flavor" | "sweetener_masking";

export interface RDBaseTemplateIngredient {
  id?: string;
  sort_order: number;
  name: string;
  supplier?: string | null;
  default_percent: number;
  highlight_color?: string | null;
  role?: string | null;
  section?: IngredientSection;
}

export interface RDBaseTemplateStep {
  id?: string;
  step_number: number;
  text: string;
}

export interface RDBaseTemplate {
  id: string;
  name: string;
  mold_size: string | null;
  default_piece_weight_g: number;
  default_batch_weight_g: number;
  cook_temp_c: number | null;
  brix_target: number | null;
  add_active_temp_c: number | null;
  tri_sodium_citrate_temp_c: number | null;
  is_active: boolean;
  ingredients: RDBaseTemplateIngredient[];
  steps: RDBaseTemplateStep[];
}

export const useRDBaseTemplates = () => {
  return useQuery({
    queryKey: ["rd-base-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rd_base_templates")
        .select(`*, ingredients:rd_base_template_ingredients(*), steps:rd_base_template_steps(*)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      (data || []).forEach((t: any) => {
        (t.ingredients || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        (t.steps || []).sort((a: any, b: any) => (a.step_number ?? 0) - (b.step_number ?? 0));
      });
      return (data || []) as unknown as RDBaseTemplate[];
    },
  });
};

export const useSaveRDBaseTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      tpl: Partial<RDBaseTemplate> & { ingredients: RDBaseTemplateIngredient[]; steps: RDBaseTemplateStep[] }
    ) => {
      let templateId = tpl.id;
      const base = {
        name: tpl.name,
        mold_size: tpl.mold_size ?? null,
        default_piece_weight_g: tpl.default_piece_weight_g ?? 3.5,
        default_batch_weight_g: tpl.default_batch_weight_g ?? 500,
        cook_temp_c: tpl.cook_temp_c ?? null,
        brix_target: tpl.brix_target ?? null,
        add_active_temp_c: tpl.add_active_temp_c ?? null,
        tri_sodium_citrate_temp_c: tpl.tri_sodium_citrate_temp_c ?? null,
        is_active: tpl.is_active ?? true,
      };
      if (templateId) {
        const { error } = await supabase.from("rd_base_templates").update(base).eq("id", templateId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("rd_base_templates").insert(base as any).select().single();
        if (error) throw error;
        templateId = data.id;
      }
      // Replace ingredients
      await supabase.from("rd_base_template_ingredients").delete().eq("template_id", templateId);
      if (tpl.ingredients.length) {
        const rows = tpl.ingredients.map((i, idx) => ({
          template_id: templateId,
          sort_order: idx,
          name: i.name,
          supplier: i.supplier || null,
          default_percent: Number(i.default_percent) || 0,
          highlight_color: i.highlight_color || "none",
          role: i.role || "other",
          section: i.section || "inactive_bulk",
        }));
        const { error } = await supabase.from("rd_base_template_ingredients").insert(rows);
        if (error) throw error;
      }
      // Replace steps
      await supabase.from("rd_base_template_steps").delete().eq("template_id", templateId);
      if (tpl.steps.length) {
        const rows = tpl.steps.map((s, idx) => ({
          template_id: templateId,
          step_number: idx + 1,
          text: s.text,
        }));
        const { error } = await supabase.from("rd_base_template_steps").insert(rows);
        if (error) throw error;
      }
      return templateId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rd-base-templates"] });
      toast.success("Base template saved");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save template"),
  });
};

export const useDeleteRDBaseTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rd_base_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rd-base-templates"] });
      toast.success("Template deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
  });
};
