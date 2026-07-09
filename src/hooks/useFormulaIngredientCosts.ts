import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IngredientCost {
  materialName: string;
  weightKg: number;
  costPerKg: number;
  totalCost: number;
  hasData: boolean;
}

export interface FormulaIngredientCosts {
  ingredients: IngredientCost[];
  totalBatchCost: number;
  loading: boolean;
  error: string | null;
  missingMaterials: string[];
}

export const useFormulaIngredientCosts = (formulaId: string | null) => {
  const [data, setData] = useState<FormulaIngredientCosts>({
    ingredients: [],
    totalBatchCost: 0,
    loading: false,
    error: null,
    missingMaterials: [],
  });

  useEffect(() => {
    if (!formulaId) {
      setData({
        ingredients: [],
        totalBatchCost: 0,
        loading: false,
        error: null,
        missingMaterials: [],
      });
      return;
    }

    const calculateCosts = async () => {
      setData(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Fetch formula with recipe_json
        const { data: formula, error: formulaError } = await supabase
          .from('formulas')
          .select('recipe_json')
          .eq('id', formulaId)
          .single();

        if (formulaError) throw formulaError;
        if (!formula?.recipe_json) {
          setData({
            ingredients: [],
            totalBatchCost: 0,
            loading: false,
            error: 'No recipe found for this formula',
            missingMaterials: [],
          });
          return;
        }

        const recipe = formula.recipe_json as Array<{ materialName: string; weightKg: string | number }>;
        const ingredients: IngredientCost[] = [];
        const missingMaterials: string[] = [];
        let totalBatchCost = 0;

        for (const ingredient of recipe) {
          const materialName = ingredient.materialName;
          const weightKg = parseFloat(String(ingredient.weightKg)) || 0;

          // Find raw material by name (case-insensitive) - try exact match first
          let rawMaterial = null;
          const { data: exactMatch } = await supabase
            .from('raw_materials')
            .select('id, name')
            .ilike('name', materialName)
            .maybeSingle();

          if (exactMatch) {
            rawMaterial = exactMatch;
          } else {
            // Try partial match (ingredient name is a prefix of inventory name)
            const { data: partialMatch } = await supabase
              .from('raw_materials')
              .select('id, name')
              .ilike('name', `${materialName}%`)
              .maybeSingle();
            
            if (partialMatch) {
              rawMaterial = partialMatch;
            }
          }

          if (!rawMaterial) {
            missingMaterials.push(materialName);
            ingredients.push({
              materialName,
              weightKg,
              costPerKg: 0,
              totalCost: 0,
              hasData: false,
            });
            continue;
          }

          // Get ALL lots for cost calculation (including depleted lots for historical cost)
          const { data: lots } = await supabase
            .from('raw_material_lots')
            .select('cost, quantity')
            .eq('raw_material_id', rawMaterial.id);

          let avgCostPerKg = 0;

          if (lots && lots.length > 0) {
            // First, try weighted average from in-stock lots
            let totalCost = 0;
            let totalQty = 0;

            for (const lot of lots) {
              const lotCost = parseFloat(String(lot.cost)) || 0;
              const lotQty = parseFloat(String(lot.quantity)) || 0;
              if (lotCost > 0 && lotQty > 0) {
                totalCost += lotCost * lotQty;
                totalQty += lotQty;
              }
            }

            if (totalQty > 0) {
              avgCostPerKg = totalCost / totalQty;
            } else {
              // Fallback: use average of all lots with cost data (even depleted ones)
              const lotsWithCost = lots.filter(l => parseFloat(String(l.cost)) > 0);
              if (lotsWithCost.length > 0) {
                const sumCosts = lotsWithCost.reduce((sum, l) => sum + parseFloat(String(l.cost)), 0);
                avgCostPerKg = sumCosts / lotsWithCost.length;
              }
            }
          }

          const ingredientCost = weightKg * avgCostPerKg;
          totalBatchCost += ingredientCost;

          ingredients.push({
            materialName,
            weightKg,
            costPerKg: avgCostPerKg,
            totalCost: ingredientCost,
            hasData: avgCostPerKg > 0,
          });
        }

        setData({
          ingredients,
          totalBatchCost,
          loading: false,
          error: null,
          missingMaterials,
        });
      } catch (err) {
        console.error('Error calculating formula costs:', err);
        setData(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to calculate ingredient costs',
        }));
      }
    };

    calculateCosts();
  }, [formulaId]);

  return data;
};
