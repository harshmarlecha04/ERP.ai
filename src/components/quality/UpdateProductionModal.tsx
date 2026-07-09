import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, AlertCircle, Settings, Shield, Key, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { IngredientSplitModal } from './IngredientSplitModal';
import { TradeSecretAccessRequest } from '@/components/formula/TradeSecretAccessRequest';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatET } from "@/utils/dateUtils";

interface IngredientData {
  ingredient_id: string;
  ingredient_name: string;
  ingredient_code: string;
  required_quantity_kg: number;
  available_lots: any[];
  splits?: IngredientSplit[];
}

interface IngredientSplit {
  raw_material_id: string;
  lot_id?: string;
  supplier_name: string;
  lot_number?: string;
  batches_used: number;
  actual_quantity_kg: number;
}

interface UpdateProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleItem: {
    id: string;
    formula_id: string;
    formula_code: string;
    formula_name: string;
    batches: number;
    schedule_date: string;
    total_required_kg: number;
  } | null;
  onSuccess: () => void;
}

export const UpdateProductionModal: React.FC<UpdateProductionModalProps> = ({
  isOpen,
  onClose,
  scheduleItem,
  onSuccess
}) => {
  const [ingredients, setIngredients] = useState<IngredientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tradeSecretError, setTradeSecretError] = useState<{
    isTradeSecret: boolean;
    formulaName?: string;
    formulaId?: string;
  } | null>(null);
  const [splitModal, setSplitModal] = useState<{
    isOpen: boolean;
    ingredient: IngredientData | null;
  }>({
    isOpen: false,
    ingredient: null
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && scheduleItem) {
      console.log('UseEffect triggered - fetching ingredients for:', scheduleItem.formula_id);
      setTradeSecretError(null); // Reset trade secret error when modal opens
      fetchIngredients();
    }
  }, [isOpen, scheduleItem?.id]); // Use scheduleItem.id instead of full object to prevent unnecessary re-renders

  const fetchIngredients = useCallback(async () => {
    if (!scheduleItem || loading) return; // Prevent multiple calls when already loading
    
    if (!scheduleItem.formula_id || scheduleItem.formula_id === '') {
      toast({
        title: "Error",
        description: "No formula ID available for this schedule item",
        variant: "destructive"
      });
      return;
    }

    console.log('fetchIngredients called for formula:', scheduleItem.formula_id);
    setLoading(true);
    try {
      // Debug: Check if formula exists at all (bypass RLS for debugging)
      console.log('Debug: Checking formula existence for ID:', scheduleItem.formula_id);
      
      const { data: formulaExistsDebug, error: debugError } = await supabase
        .from('formulas')  
        .select('id, name, is_deleted, security_level, classification_level, code')
        .eq('id', scheduleItem.formula_id);
      
      console.log('Debug formula existence check:', formulaExistsDebug, 'Error:', debugError);

      // First, fetch the formula to get the recipe_json - RLS will enforce security
      const { data: formulaData, error: formulaError } = await supabase
        .from('formulas')
        .select('recipe_json, name, security_level, classification_level, is_deleted')
        .eq('id', scheduleItem.formula_id)
        .maybeSingle();

      if (formulaError) {
        console.error('Formula query error:', formulaError);
        throw formulaError;
      }

      console.log('Formula data received:', formulaData);
      
      // Handle trade secret access
      if (!formulaData) {
        console.log('Formula data is null, checking if formula exists...');
        
        // Try a direct query with minimal fields to bypass potential RLS issues
        const { data: basicFormulaCheck, error: basicError } = await supabase
          .from('formulas')
          .select('id, is_deleted, security_level')
          .eq('id', scheduleItem.formula_id)
          .limit(1);

        console.log('Basic formula check result:', basicFormulaCheck, 'Error:', basicError);

        if (basicFormulaCheck && basicFormulaCheck.length > 0) {
          const formula = basicFormulaCheck[0];
          if (formula.is_deleted) {
            console.log('Formula is soft-deleted');
            throw new Error('FORMULA_DELETED');
          } else {
            // Formula exists but user can't access it - likely trade secret or RLS blocking
            console.log('Formula exists but access denied - security level:', formula.security_level);
            throw new Error('TRADE_SECRET_ACCESS_REQUIRED');
          }
        } else {
          console.log('Formula truly does not exist or RLS completely blocking');
          throw new Error('FORMULA_NOT_FOUND');
        }
      }
      
      // Check if formula is soft-deleted
      if (formulaData.is_deleted) {
        console.log('Formula is soft-deleted');
        throw new Error('FORMULA_DELETED');
      }
      
      if (!formulaData?.recipe_json || (Array.isArray(formulaData.recipe_json) && formulaData.recipe_json.length === 0)) {
        console.error('No recipe data found for formula:', scheduleItem.formula_id, formulaData);
        throw new Error('No recipe data found for this formula');
      }

      // Parse ingredients from recipe_json and ensure it's an array
      const recipeIngredients = Array.isArray(formulaData.recipe_json) 
        ? formulaData.recipe_json 
        : [];
      
      console.log('Recipe ingredients:', recipeIngredients);

      // Check for existing production ingredient usage data
      const { data: existingUsageData } = await supabase
        .from('production_ingredient_usage')
        .select('*')
        .eq('schedule_item_id', scheduleItem.id);

      console.log('Existing usage data:', existingUsageData);

      // Process ingredients and fetch available lots for each
      const ingredientsWithData = await Promise.all(
        recipeIngredients.map(async (recipeIngredient: any) => {
          // Extract material ID from the ingredient name (format: materialId-lotId where both are UUIDs)
          // Split and take first 5 parts to get complete UUID (UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
          const nameParts = recipeIngredient.name ? recipeIngredient.name.split('-') : [];
          const materialId = nameParts.length >= 5 ? nameParts.slice(0, 5).join('-') : 'unknown';
          
          console.log('Processing ingredient:', recipeIngredient.materialName, 'Material ID:', materialId);
          
          // Fetch available lots for this raw material
          console.log('Fetching lots for ingredient:', recipeIngredient.materialName, 'with materialId:', materialId);
          const { data: lotsData, error: lotsError } = await supabase
            .from('raw_material_lots')
            .select(`
              id,
              lot_number,
              quantity,
              qty_reserved_kg,
              expires_on,
              receiving_date,
              cost,
              raw_material_id
            `)
            .eq('raw_material_id', materialId)
            .gt('quantity', 0); // Only get lots with available quantity

          if (lotsError) {
            console.error('Error fetching lots for', recipeIngredient.materialName, ':', lotsError);
          }

          console.log('Fetched lots data for', recipeIngredient.materialName, ':', lotsData, 'Count:', lotsData?.length || 0);

          // Fetch raw material info separately to avoid join issues
          const { data: rawMaterialData } = await supabase
            .from('raw_materials')
            .select('id, code, name, supplier')
            .eq('id', materialId)
            .single();

          const availableLots = lotsData?.map(lot => ({
            id: lot.id,
            lot_number: lot.lot_number || '',
            supplier: rawMaterialData?.supplier || 'Unknown',
            quantity: lot.quantity,
            qty_reserved_kg: lot.qty_reserved_kg || 0,
            available_qty: (lot.quantity || 0) - (lot.qty_reserved_kg || 0),
            receiving_date: lot.receiving_date || '',
            expires_on: lot.expires_on || '',
            cost: lot.cost || 0
          })).filter(lot => lot.available_qty > 0) || []; // Filter out lots with no available quantity

          console.log('Available lots for', recipeIngredient.materialName, ':', availableLots, 'Count:', availableLots.length);

          // Check if there's existing usage data for this ingredient
          const existingSplits = existingUsageData?.filter(usage => usage.raw_material_id === materialId);
          
          let splits;
          if (existingSplits && existingSplits.length > 0) {
            // Use existing splits from database
            splits = existingSplits.map(usage => ({
              raw_material_id: usage.raw_material_id,
              lot_id: usage.lot_id,
              supplier_name: usage.supplier_name,
              lot_number: usage.lot_number,
              batches_used: usage.batches_used,
              actual_quantity_kg: usage.actual_quantity_kg
            }));
            console.log('Using existing splits for', recipeIngredient.materialName, ':', splits);
          } else {
            // Create default split from recipe
            splits = [{
              raw_material_id: materialId,
              supplier_name: recipeIngredient.supplier || 'Unknown',
              lot_number: recipeIngredient.lotNumber || '',
              lot_id: availableLots.length > 0 ? availableLots[0].id : null,
              batches_used: scheduleItem.batches,
              actual_quantity_kg: (recipeIngredient.weightKg || 0) * scheduleItem.batches
            }];
            console.log('Using default splits for', recipeIngredient.materialName, ':', splits);
          }

          return {
            ingredient_id: materialId,
            ingredient_name: recipeIngredient.materialName || 'Unknown Material',
            ingredient_code: rawMaterialData?.code || recipeIngredient.materialName || 'Unknown',
            required_quantity_kg: (recipeIngredient.weightKg || 0) * scheduleItem.batches,
            available_lots: availableLots,
            splits: splits
          };
        })
      );

      console.log('Processed ingredients:', ingredientsWithData);
      setIngredients(ingredientsWithData);
      setTradeSecretError(null); // Clear trade secret error on successful load
    } catch (error: any) {
      console.error('Error fetching ingredients:', error);
      
      // Handle specific error types
      if (error.message === 'TRADE_SECRET_ACCESS_REQUIRED') {
        setTradeSecretError({
          isTradeSecret: true,
          formulaName: scheduleItem.formula_name,
          formulaId: scheduleItem.formula_id
        });
      } else if (error.message === 'FORMULA_NOT_FOUND') {
        toast({
          title: "Formula Not Found",
          description: "The specified formula could not be found or has been deleted.",
          variant: "destructive"
        });
      } else if (error.message === 'FORMULA_DELETED') {
        toast({
          title: "Formula Deleted",
          description: "This formula has been deleted and cannot be used for production.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to load formula ingredients: ${error.message}`,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  }, [scheduleItem, loading]); // Add dependencies for useCallback

  const handleSplitIngredient = (ingredient: IngredientData) => {
    setSplitModal({
      isOpen: true,
      ingredient
    });
  };

  const handleSplitSave = (ingredientId: string, splits: IngredientSplit[]) => {
    setIngredients(prev => prev.map(ing => 
      ing.ingredient_id === ingredientId 
        ? { ...ing, splits }
        : ing
    ));
    setSplitModal({ isOpen: false, ingredient: null });
  };

  const validateSplits = () => {
    for (const ingredient of ingredients) {
      if (!ingredient.splits || ingredient.splits.length === 0) {
        toast({
          title: "Validation Error",
          description: `No splits defined for ${ingredient.ingredient_name}`,
          variant: "destructive"
        });
        return false;
      }

      const totalBatches = ingredient.splits.reduce((sum, split) => sum + split.batches_used, 0);
      const totalQuantity = ingredient.splits.reduce((sum, split) => sum + split.actual_quantity_kg, 0);

      if (totalBatches !== scheduleItem?.batches) {
        toast({
          title: "Validation Error",
          description: `Total batches for ${ingredient.ingredient_name} (${totalBatches}) must equal scheduled batches (${scheduleItem?.batches})`,
          variant: "destructive"
        });
        return false;
      }

      if (Math.abs(totalQuantity - ingredient.required_quantity_kg) > 0.01) {
        toast({
          title: "Validation Error",
          description: `Total quantity for ${ingredient.ingredient_name} (${totalQuantity} kg) must equal required quantity (${ingredient.required_quantity_kg} kg)`,
          variant: "destructive"
        });
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!scheduleItem || !validateSplits()) return;

    setSaving(true);
    try {
      const usageData = ingredients.flatMap(ingredient => 
        ingredient.splits!.map(split => ({
          raw_material_id: split.raw_material_id,
          lot_id: split.lot_id,
          supplier_name: split.supplier_name,
          lot_number: split.lot_number,
          required_quantity_kg: ingredient.required_quantity_kg * (split.batches_used / scheduleItem.batches),
          actual_quantity_kg: split.actual_quantity_kg,
          batches_used: split.batches_used
        }))
      );

      const { data, error } = await supabase.rpc('save_production_ingredient_usage', {
        p_schedule_item_id: scheduleItem.id,
        p_usage_data: usageData
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to save production data');
      }

      toast({
        title: "Success",
        description: "Production ingredients updated successfully",
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving production:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save production data",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!scheduleItem) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="[--dialog-max-width:56rem] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Update Production - {scheduleItem.formula_code}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Formula Header */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{scheduleItem.formula_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Formula Code:</span>
                    <div className="font-medium">{scheduleItem.formula_code}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Batches:</span>
                    <div className="font-medium">{scheduleItem.batches}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Scheduled Date:</span>
                    <div className="font-medium">
                      {formatET(scheduleItem.schedule_date, "M/d/yyyy")}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Weight:</span>
                    <div className="font-medium">{scheduleItem.total_required_kg} kg</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ingredients List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Formula Ingredients</h3>
              
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading ingredients...
                </div>
              ) : tradeSecretError?.isTradeSecret ? (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Shield className="h-8 w-8 text-amber-600 mt-1" />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-amber-800 mb-2">
                          Trade Secret Access Required
                        </h3>
                        <p className="text-amber-700 mb-4">
                          This formula contains proprietary trade secrets and requires special access permissions. 
                          Production updates cannot be performed without proper authorization.
                        </p>
                        <Alert className="mb-4">
                          <Lock className="h-4 w-4" />
                          <AlertDescription>
                            Formula: <strong>{tradeSecretError.formulaName}</strong><br />
                            Access Level: Trade Secret<br />
                            Status: Access Required
                          </AlertDescription>
                        </Alert>
                        <div className="flex items-center gap-3">
                          <TradeSecretAccessRequest
                            formulaId={tradeSecretError.formulaId!}
                            formulaName={tradeSecretError.formulaName!}
                            onAccessRequested={() => {
                              toast({
                                title: "Access Request Submitted",
                                description: "Please wait for admin approval before proceeding with production updates."
                              });
                            }}
                          />
                          <span className="text-sm text-amber-700">
                            Request access to continue with production updates
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : ingredients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No ingredients found for this formula
                </div>
              ) : (
                ingredients.map((ingredient) => (
                  <Card key={ingredient.ingredient_id} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{ingredient.ingredient_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Code: {ingredient.ingredient_code} • Required: {ingredient.required_quantity_kg} kg
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSplitIngredient(ingredient)}
                          className="gap-2"
                        >
                          <Settings className="h-4 w-4" />
                          Split
                        </Button>
                      </div>

                      {/* Current Allocations */}
                      {ingredient.splits && ingredient.splits.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Current Allocations:</p>
                          <div className="grid gap-2">
                            {ingredient.splits.map((split, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                 <div className="text-sm">
                                   <span className="font-medium">
                                     {(() => {
                                       // Find the correct supplier name from available lots
                                       const correctLot = ingredient.available_lots?.find(lot => 
                                         lot.id === split.lot_id || lot.lot_number === split.lot_number
                                       );
                                       return correctLot?.supplier || split.supplier_name || 'Unknown';
                                     })()}
                                   </span>
                                  {split.lot_number && (
                                    <span className="text-muted-foreground ml-2">
                                      Lot: {split.lot_number}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-right">
                                  <div className="font-medium">
                                    {split.batches_used} batches
                                  </div>
                                  <div className="text-muted-foreground">
                                    {split.actual_quantity_kg} kg
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Validation Status */}
                      {ingredient.splits && (
                        <div className="mt-3">
                          {(() => {
                            const totalBatches = ingredient.splits.reduce((sum, split) => sum + split.batches_used, 0);
                            const totalQty = ingredient.splits.reduce((sum, split) => sum + split.actual_quantity_kg, 0);
                            const batchesValid = totalBatches === scheduleItem.batches;
                            const qtyValid = Math.abs(totalQty - ingredient.required_quantity_kg) < 0.01;

                            if (batchesValid && qtyValid) {
                              return (
                                <Badge className="bg-success text-success-foreground">
                                  Valid allocation
                                </Badge>
                              );
                            } else {
                              return (
                                <Badge variant="outline" className="text-destructive border-destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Invalid: {!batchesValid && 'batches'} {!batchesValid && !qtyValid && '& '} {!qtyValid && 'quantity'}
                                </Badge>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saving || loading || ingredients.length === 0 || tradeSecretError?.isTradeSecret}
            >
              {saving ? 'Saving...' : 'Save Production Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IngredientSplitModal
        isOpen={splitModal.isOpen}
        onClose={() => setSplitModal({ isOpen: false, ingredient: null })}
        ingredient={splitModal.ingredient}
        totalBatches={scheduleItem.batches}
        onSave={handleSplitSave}
      />
    </>
  );
};