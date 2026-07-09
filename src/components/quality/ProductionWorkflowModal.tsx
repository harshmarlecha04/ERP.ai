import React, { useState, useEffect, useCallback } from 'react';
import { parseDateString, formatET } from "@/utils/dateUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, AlertCircle, Settings, Shield, ArrowRight, AlertTriangle, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { IngredientSplitModal } from './IngredientSplitModal';
import { TradeSecretAccessRequest } from '@/components/formula/TradeSecretAccessRequest';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

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

interface IngredientUsage {
  id: string;
  raw_material_id: string;
  ingredient_name: string;
  supplier_name: string | null;
  lot_number: string | null;
  lot_id: string | null;
  required_quantity_kg: number;
  actual_quantity_kg: number;
  current_lot_quantity: number;
  batches_used: number;
  after_deduction_quantity: number;
  is_over_deduction: boolean;
  will_use_fifo: boolean;
  fifo_allocation?: Array<{
    lot_number: string;
    supplier_name: string;
    available_qty: number;
    will_deduct: number;
    is_primary: boolean;
  }>;
}

interface ProductionWorkflowModalProps {
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
  onDeductInventory?: (
    scheduleItemId: string,
    formulaCode: string,
    formulaName: string,
    batchCount: number,
    totalProducedQty: number
  ) => Promise<any>;
  initialStep?: 1 | 2;
}

export const ProductionWorkflowModal: React.FC<ProductionWorkflowModalProps> = ({
  isOpen,
  onClose,
  scheduleItem,
  onSuccess,
  onDeductInventory,
  initialStep = 1
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(initialStep);
  const [ingredients, setIngredients] = useState<IngredientData[]>([]);
  const [deductionPreview, setDeductionPreview] = useState<IngredientUsage[]>([]);
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
      setCurrentStep(initialStep);
      setTradeSecretError(null);
      if (initialStep === 1) {
        fetchIngredients();
      } else {
        calculateDeductionPreview();
      }
    }
  }, [isOpen, scheduleItem?.id]);

  const fetchIngredients = useCallback(async () => {
    if (!scheduleItem || loading) return;
    
    if (!scheduleItem.formula_id || scheduleItem.formula_id === '') {
      toast({
        title: "Error",
        description: "No formula ID available for this schedule item",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Use the secure RPC function to get accessible formulas
      const { data: accessibleFormulas, error: formulaError } = await supabase
        .rpc('get_accessible_formulas');

      if (formulaError) throw formulaError;
      
      // Find the specific formula we need
      const formulaData = accessibleFormulas?.find(f => f.id === scheduleItem.formula_id);
      
      if (!formulaData) {
        // Check if formula exists at all
        const { data: basicCheck } = await supabase
          .from('formulas')
          .select('id, is_deleted, security_level, name')
          .eq('id', scheduleItem.formula_id)
          .maybeSingle();

        if (basicCheck) {
          if (basicCheck.is_deleted) {
            throw new Error('FORMULA_DELETED');
          } else if (basicCheck.security_level === 'trade_secret') {
            // Show trade secret access request
            setTradeSecretError({
              isTradeSecret: true,
              formulaId: scheduleItem.formula_id,
              formulaName: basicCheck.name || scheduleItem.formula_name
            });
            setLoading(false);
            return;
          } else {
            throw new Error('TRADE_SECRET_ACCESS_REQUIRED');
          }
        } else {
          throw new Error('FORMULA_NOT_FOUND');
        }
      }
      
      if (formulaData.is_deleted) {
        throw new Error('FORMULA_DELETED');
      }
      
      if (!formulaData?.recipe_json || (Array.isArray(formulaData.recipe_json) && formulaData.recipe_json.length === 0)) {
        throw new Error('No recipe data found for this formula');
      }

      const recipeIngredients = Array.isArray(formulaData.recipe_json) 
        ? formulaData.recipe_json 
        : [];

      const { data: existingUsageData } = await supabase
        .from('production_ingredient_usage')
        .select('*')
        .eq('schedule_item_id', scheduleItem.id);

      const ingredientsWithData = await Promise.all(
        recipeIngredients.map(async (recipeIngredient: any) => {
          const nameParts = recipeIngredient.name ? recipeIngredient.name.split('-') : [];
          const materialId = nameParts.length >= 5 ? nameParts.slice(0, 5).join('-') : 'unknown';
          
          const { data: lotsData } = await supabase
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
            .gt('quantity', 0);

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
          })).filter(lot => lot.available_qty > 0) || [];

          const existingSplits = existingUsageData?.filter(usage => usage.raw_material_id === materialId);
          
          let splits;
          if (existingSplits && existingSplits.length > 0) {
            splits = existingSplits.map(usage => ({
              raw_material_id: usage.raw_material_id,
              lot_id: usage.lot_id,
              supplier_name: usage.supplier_name,
              lot_number: usage.lot_number,
              batches_used: usage.batches_used,
              actual_quantity_kg: usage.actual_quantity_kg
            }));
          } else {
            splits = [{
              raw_material_id: materialId,
              supplier_name: recipeIngredient.vendor || 'Unknown',
              lot_number: recipeIngredient.lotNumber || '',
              lot_id: availableLots.length > 0 ? availableLots[0].id : null,
              batches_used: scheduleItem.batches,
              actual_quantity_kg: (recipeIngredient.weightKg || 0) * scheduleItem.batches
            }];
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

      setIngredients(ingredientsWithData);
      setTradeSecretError(null);
    } catch (error: any) {
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
  }, [scheduleItem, loading]);

  const calculateDeductionPreview = async () => {
    if (!scheduleItem?.id) return;

    try {
      setLoading(true);
      
      const { data: usageData, error: usageError } = await supabase
        .from('production_ingredient_usage')
        .select('*')
        .eq('schedule_item_id', scheduleItem.id);

      if (usageError) throw usageError;

      if (!usageData || usageData.length === 0) {
        setDeductionPreview([]);
        return;
      }

      const materialIds = [...new Set(usageData.map(usage => usage.raw_material_id))];
      const { data: materialsData } = await supabase
        .from('raw_materials')
        .select('id, name')
        .in('id', materialIds);

      const lotIds = usageData.filter(usage => usage.lot_id).map(usage => usage.lot_id);
      const { data: lotsData } = await supabase
        .from('raw_material_lots')
        .select('id, quantity, lot_number')
        .in('id', lotIds);

      const materialsMap = new Map(materialsData?.map(m => [m.id, m.name]) || []);
      const lotsMap = new Map(lotsData?.map(l => [l.id, l.quantity]) || []);

      const ingredientsData: IngredientUsage[] = await Promise.all(
        usageData.map(async (usage: any) => {
          const ingredientName = materialsMap.get(usage.raw_material_id) || 'Unknown Ingredient';
          const currentQty = usage.lot_id ? (lotsMap.get(usage.lot_id) || 0) : 0;
          const deductionQty = usage.actual_quantity_kg;
          let remainingToDeduct = deductionQty;
          
          const fifoAllocation: Array<{
            lot_number: string;
            supplier_name: string;
            available_qty: number;
            will_deduct: number;
            is_primary: boolean;
          }> = [];

          if (usage.lot_id && currentQty > 0) {
            const primaryDeduction = Math.min(currentQty, remainingToDeduct);
            fifoAllocation.push({
              lot_number: usage.lot_number || 'Unknown',
              supplier_name: usage.supplier_name || 'Unknown',
              available_qty: currentQty,
              will_deduct: primaryDeduction,
              is_primary: true
            });
            remainingToDeduct -= primaryDeduction;
          }

          if (remainingToDeduct > 0) {
            const { data: allLots } = await supabase
              .from('raw_material_lots')
              .select(`
                id, quantity, lot_number, receiving_date, created_at,
                raw_materials!inner(supplier)
              `)
              .eq('raw_material_id', usage.raw_material_id)
              .gt('quantity', 0)
              .order('receiving_date', { ascending: true, nullsFirst: false })
              .order('created_at', { ascending: true });

            const alreadyUsedLotIds = new Set(fifoAllocation.map(alloc => alloc.lot_number));
            
            for (const lot of allLots || []) {
              if (remainingToDeduct <= 0) break;
              if (alreadyUsedLotIds.has(lot.lot_number)) continue;
              
              const lotDeduction = Math.min(lot.quantity, remainingToDeduct);
              fifoAllocation.push({
                lot_number: lot.lot_number || 'Unknown',
                supplier_name: (lot.raw_materials as any)?.supplier || 'Unknown',
                available_qty: lot.quantity,
                will_deduct: lotDeduction,
                is_primary: false
              });
              remainingToDeduct -= lotDeduction;
            }
          }

          const willUseFifo = fifoAllocation.length > 1 || (fifoAllocation.length === 1 && !fifoAllocation[0].is_primary);
          const isOverDeduction = remainingToDeduct > 0;

          return {
            id: usage.id,
            raw_material_id: usage.raw_material_id,
            ingredient_name: materialsMap.get(usage.raw_material_id) || 'Unknown Ingredient',
            supplier_name: usage.supplier_name,
            lot_number: usage.lot_number,
            lot_id: usage.lot_id,
            required_quantity_kg: usage.required_quantity_kg,
            actual_quantity_kg: usage.actual_quantity_kg,
            current_lot_quantity: currentQty,
            batches_used: usage.batches_used,
            after_deduction_quantity: Math.max(currentQty - Math.min(currentQty, deductionQty), 0),
            is_over_deduction: isOverDeduction,
            will_use_fifo: willUseFifo,
            fifo_allocation: fifoAllocation
          };
        })
      );

      setDeductionPreview(ingredientsData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load ingredient usage data. Please ensure production data has been updated first.",
        variant: "destructive"
      });
      setDeductionPreview([]);
    } finally {
      setLoading(false);
    }
  };

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

  const handleNext = async () => {
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
        description: "Production ingredients saved. Moving to deduction review...",
      });

      // Move to step 2 and calculate deduction preview
      setCurrentStep(2);
      await calculateDeductionPreview();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save production data",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeductInventory = async () => {
    if (!scheduleItem) return;
    
    try {
      setSaving(true);
      
      // Actually call the deduction function
      if (onDeductInventory) {
        const result = await onDeductInventory(
          scheduleItem.id,
          scheduleItem.formula_code,
          scheduleItem.formula_name,
          scheduleItem.batches,
          scheduleItem.total_required_kg
        );
        
        if (result?.success === false) {
          throw new Error(result.error || 'Failed to deduct inventory');
        }
      }
      
      toast({
        title: "Success",
        description: "Inventory deducted successfully",
      });
      
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to deduct inventory",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  if (!scheduleItem) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="[--dialog-max-width:56rem] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {currentStep === 1 ? 'Step 1: Update Production' : 'Step 2: Review & Deduct Inventory'} - {scheduleItem.formula_code}
            </DialogTitle>
            {/* Step Indicator */}
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Badge variant={currentStep === 1 ? "default" : "secondary"}>
                Step 1: Update Production
              </Badge>
              <ChevronRight className="h-4 w-4" />
              <Badge variant={currentStep === 2 ? "default" : "outline"}>
                Step 2: Review & Deduct
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {currentStep === 1 ? (
              // STEP 1: Update Production
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
                    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <Shield className="h-8 w-8 text-amber-600 mt-1" />
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
                              Trade Secret Access Required
                            </h3>
                            <p className="text-amber-800 dark:text-amber-200 mb-4">
                              This formula contains trade secret information. You need special access to view its ingredients.
                            </p>
                            <TradeSecretAccessRequest
                              formulaName={tradeSecretError.formulaName || scheduleItem.formula_name}
                              formulaId={tradeSecretError.formulaId || scheduleItem.formula_id}
                              onAccessRequested={() => {
                                toast({
                                  title: "Access Requested",
                                  description: "Your access request has been submitted for approval.",
                                });
                                onClose();
                              }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : ingredients.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No ingredients found for this formula.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    ingredients.map((ingredient) => (
                      <Card key={ingredient.ingredient_id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base">{ingredient.ingredient_name}</CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                Code: {ingredient.ingredient_code}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Required</p>
                              <p className="text-lg font-semibold">{ingredient.required_quantity_kg.toFixed(2)} kg</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-medium mb-2">Current Allocation:</p>
                              {ingredient.splits && ingredient.splits.length > 0 ? (
                                <div className="space-y-2">
                                  {ingredient.splits.map((split, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                                      <div>
                                        <span className="font-medium">{split.supplier_name}</span>
                                        {split.lot_number && <span className="text-muted-foreground ml-2">Lot: {split.lot_number}</span>}
                                      </div>
                                      <div className="text-right">
                                        <span className="font-medium">{split.actual_quantity_kg.toFixed(2)} kg</span>
                                        <span className="text-muted-foreground ml-2">({split.batches_used} batches)</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No allocation set</p>
                              )}
                            </div>
                            
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleSplitIngredient(ingredient)}
                              className="w-full"
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Split Ingredient Allocation
                            </Button>

                            {ingredient.available_lots.length === 0 && (
                              <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                  No available lots for this ingredient
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            ) : (
              // STEP 2: Review & Deduct Inventory
              <div className="space-y-4">
                <DialogDescription>
                  This will permanently deduct ingredients from inventory using automatic FIFO allocation. This action cannot be undone.
                </DialogDescription>

                {/* Batch Info */}
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="text-sm space-y-1">
                    <div><strong>Formula:</strong> {scheduleItem.formula_code} - {scheduleItem.formula_name}</div>
                    <div className="flex gap-4">
                      <span><strong>Batches:</strong> {scheduleItem.batches}</span>
                      <span><strong>Date:</strong> {parseDateString(scheduleItem.schedule_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                {/* Ingredient Usage */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4" />
                    <h3 className="font-semibold">Ingredient Usage Details with FIFO Allocation</h3>
                  </div>
                  
                  <ScrollArea className="h-[300px]">
                    <div className="pr-4 space-y-4">
                      {loading ? (
                        <div className="space-y-2">
                          {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : deductionPreview.length > 0 ? (
                        <div className="space-y-4">
                          {deductionPreview.map((ingredient) => (
                            <div key={ingredient.id} className="border rounded-lg p-4 bg-muted/20">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-semibold text-foreground truncate">{ingredient.ingredient_name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Required: {ingredient.actual_quantity_kg.toFixed(2)} kg
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  {ingredient.is_over_deduction ? (
                                    <Badge variant="destructive" className="text-xs">
                                      Insufficient Stock
                                    </Badge>
                                  ) : ingredient.will_use_fifo ? (
                                    <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">
                                      FIFO Allocation
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">
                                      Single Lot
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* FIFO Allocation Details */}
                              {ingredient.fifo_allocation && ingredient.fifo_allocation.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">
                                    {ingredient.will_use_fifo ? 'Automatic FIFO Allocation:' : 'Lot Details:'}
                                  </p>
                                  
                                  <div className="space-y-1">
                                    {ingredient.fifo_allocation.map((allocation, index) => (
                                      <div key={index} className="flex items-center gap-2 text-sm p-2 bg-background/50 rounded">
                                        {allocation.is_primary && (
                                          <Badge variant="secondary" className="text-xs">Primary</Badge>
                                        )}
                                        <span className="font-mono text-xs">
                                          {allocation.lot_number}
                                        </span>
                                        <span className="text-muted-foreground">
                                          ({allocation.supplier_name})
                                        </span>
                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                        <span className="font-semibold">
                                          {allocation.will_deduct.toFixed(2)} kg
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                          of {allocation.available_qty.toFixed(2)} kg
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  {ingredient.is_over_deduction && (
                                    <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                                      <p className="text-destructive font-medium">
                                        ⚠️ Still short {(ingredient.actual_quantity_kg - 
                                          ingredient.fifo_allocation.reduce((sum, alloc) => sum + alloc.will_deduct, 0)
                                        ).toFixed(2)} kg after using all available lots
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No production data found for this batch.</p>
                          <p className="text-sm">Please go back and update production data first.</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Warning Messages */}
                <div className="space-y-2">
                  {deductionPreview.some(i => i.will_use_fifo) && (
                    <div className="text-xs bg-blue-50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                      🔄 <strong>FIFO (First In, First Out) Allocation:</strong> When a lot doesn't have enough stock, 
                      the system will automatically use older lots to complete the deduction.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
            {currentStep === 1 ? (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleNext}
                  disabled={saving || loading || ingredients.length === 0 || tradeSecretError?.isTradeSecret}
                >
                  {saving ? 'Saving...' : 'Next: Review Deduction'}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleBack} disabled={saving}>
                  Back
                </Button>
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleDeductInventory}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deductionPreview.length === 0 || saving}
                >
                  {saving ? 'Deducting...' : 'Deduct Inventory'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ingredient Split Modal */}
      <IngredientSplitModal
        isOpen={splitModal.isOpen}
        onClose={() => setSplitModal({ isOpen: false, ingredient: null })}
        ingredient={splitModal.ingredient}
        totalBatches={scheduleItem?.batches || 0}
        onSave={handleSplitSave}
      />
    </>
  );
};
