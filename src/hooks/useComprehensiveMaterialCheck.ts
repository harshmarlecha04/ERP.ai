import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PackagingItemDetail {
  item_id?: string;
  item_name?: string;
  description?: string;
  sku?: string;
  on_hand: number;
  location?: string;
  label_id?: string;
  customer_product?: string;
  product_name?: string;
}

export interface MaterialStatus {
  status: 'available' | 'partial' | 'critical' | 'checking' | 'pending';
  available: number;
  needed: number;
  shortage: number;
  items?: PackagingItemDetail[];
}

export interface IngredientStatus {
  status: 'available' | 'partial' | 'critical' | 'checking' | 'pending';
  maxBatches: number;
  shortages: Array<{
    ingredient_id: string;
    ingredient_name: string;
    available_kg: number;
    required_kg: number;
    shortage_kg: number;
    max_batches_from_ingredient: number;
  }>;
}

export interface ComprehensiveMaterialStatus {
  ingredients: IngredientStatus | null;
  bottles: MaterialStatus | null;
  caps: MaterialStatus | null;
  labels: MaterialStatus | null;
  overallStatus: 'available' | 'partial' | 'critical' | 'checking' | 'pending';
}

export const useComprehensiveMaterialCheck = (
  formulaId: string | undefined,
  bottlesOrdered: number,
  bottleSize: number,
  batchesNeeded: number,
  selectedLabelInventory?: number,
  selectedBottleId?: string,
  selectedCapId?: string,
  selectedLabelId?: string
) => {
  const [materialStatus, setMaterialStatus] = useState<ComprehensiveMaterialStatus>({
    ingredients: null,
    bottles: null,
    caps: null,
    labels: null,
    overallStatus: 'checking',
  });

  useEffect(() => {
    if (!formulaId || !batchesNeeded || bottlesOrdered <= 0) {
      setMaterialStatus({
        ingredients: null,
        bottles: null,
        caps: null,
        labels: null,
        overallStatus: 'pending',
      });
      return;
    }

    const checkMaterials = async () => {
      // Set checking status while API calls are in progress
      setMaterialStatus({
        ingredients: null,
        bottles: null,
        caps: null,
        labels: null,
        overallStatus: 'checking',
      });
      try {
        // Check ingredients
        const { data: ingredientsData, error: ingredientsError } = await supabase.rpc(
          'calculate_max_batches',
          { p_formula_id: formulaId }
        );

        if (ingredientsError) throw ingredientsError;

        // Check packaging
        const { data: packagingData, error: packagingError } = await supabase.rpc(
          'check_packaging_availability',
          {
            p_formula_id: formulaId,
            p_batches_needed: batchesNeeded,
            p_bottle_size: bottleSize,
            p_selected_bottle_id: selectedBottleId || null,
            p_selected_cap_id: selectedCapId || null,
            p_selected_label_id: selectedLabelId || null,
          }
        );

        if (packagingError) throw packagingError;

        // Process ingredients
        const ingredientsResult = ingredientsData as any;
        const ingredientShortages = ingredientsResult.ingredient_details
          ?.filter((i: any) => i.max_batches_from_ingredient < batchesNeeded)
          .map((i: any) => ({
            ingredient_id: i.ingredient_id,
            ingredient_name: i.ingredient_name,
            available_kg: i.available_kg,
            required_kg: i.required_per_batch_kg * batchesNeeded,
            shortage_kg: (i.required_per_batch_kg * batchesNeeded) - i.available_kg,
            max_batches_from_ingredient: i.max_batches_from_ingredient,
          })) || [];

        const ingredientsStatus: IngredientStatus = {
          status: ingredientsResult.has_sufficient_inventory && ingredientsResult.max_batches >= batchesNeeded
            ? 'available'
            : ingredientsResult.max_batches > 0
            ? 'partial'
            : 'critical',
          maxBatches: ingredientsResult.max_batches || 0,
          shortages: ingredientShortages,
        };

        // Process packaging
        const packaging = packagingData as any;
        
        // Transform bottles array to expected format
        const bottlesArray = packaging.bottles || [];
        const bottlesAvailable = bottlesArray.reduce((sum: number, item: any) => sum + (item.available_quantity || 0), 0);
        const bottlesItems: PackagingItemDetail[] = bottlesArray.map((item: any) => ({
          item_id: item.item_id,
          item_name: item.item_name,
          on_hand: item.available_quantity || 0,
        }));
        const bottlesShortage = Math.max(0, bottlesOrdered - bottlesAvailable);
        const bottlesStatus: MaterialStatus = {
          status: bottlesAvailable >= bottlesOrdered ? 'available' : bottlesAvailable > 0 ? 'partial' : 'critical',
          available: bottlesAvailable,
          needed: bottlesOrdered,
          shortage: bottlesShortage,
          items: bottlesItems,
        };

        // Transform caps array to expected format
        const capsArray = packaging.caps || [];
        const capsAvailable = capsArray.reduce((sum: number, item: any) => sum + (item.available_quantity || 0), 0);
        const capsItems: PackagingItemDetail[] = capsArray.map((item: any) => ({
          item_id: item.item_id,
          item_name: item.item_name,
          on_hand: item.available_quantity || 0,
        }));
        const capsShortage = Math.max(0, bottlesOrdered - capsAvailable);
        const capsStatus: MaterialStatus = {
          status: capsAvailable >= bottlesOrdered ? 'available' : capsAvailable > 0 ? 'partial' : 'critical',
          available: capsAvailable,
          needed: bottlesOrdered,
          shortage: capsShortage,
          items: capsItems,
        };

        // Transform labels array to expected format
        const labelsArray = packaging.labels || [];
        const labelsAvailableFromRPC = labelsArray.reduce((sum: number, item: any) => sum + (item.available_quantity || 0), 0);
        const labelsItems: PackagingItemDetail[] = labelsArray.map((item: any) => ({
          label_id: item.label_id,
          customer_product: item.customer_product,
          product_name: item.product_name,
          on_hand: item.available_quantity || 0,
        }));
        // Use selected label inventory if provided, otherwise use RPC result
        const labelsAvailable = selectedLabelInventory !== undefined ? selectedLabelInventory : labelsAvailableFromRPC;
        const labelsShortage = Math.max(0, bottlesOrdered - labelsAvailable);
        const labelsStatus: MaterialStatus = {
          status: labelsAvailable >= bottlesOrdered ? 'available' : labelsAvailable > 0 ? 'partial' : 'critical',
          available: labelsAvailable,
          needed: bottlesOrdered,
          shortage: labelsShortage,
          items: labelsItems,
        };

        // Determine overall status
        const allStatuses = [
          ingredientsStatus.status,
          bottlesStatus.status,
          capsStatus.status,
          labelsStatus.status,
        ];

        let overallStatus: 'available' | 'partial' | 'critical' = 'available';
        if (allStatuses.includes('critical')) {
          overallStatus = 'critical';
        } else if (allStatuses.includes('partial')) {
          overallStatus = 'partial';
        }

        setMaterialStatus({
          ingredients: ingredientsStatus,
          bottles: bottlesStatus,
          caps: capsStatus,
          labels: labelsStatus,
          overallStatus,
        });
      } catch (error) {
        console.error('Material check failed:', error);
        setMaterialStatus({
          ingredients: null,
          bottles: null,
          caps: null,
          labels: null,
          overallStatus: 'checking',
        });
      }
    };

    checkMaterials();
  }, [formulaId, bottlesOrdered, bottleSize, batchesNeeded, selectedLabelInventory, selectedBottleId, selectedCapId, selectedLabelId]);

  return materialStatus;
};
