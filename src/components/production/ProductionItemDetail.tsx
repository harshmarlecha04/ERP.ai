import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Check, Package, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatET } from "@/utils/dateUtils";

interface ProductionScheduleItem {
  id: string;
  schedule_id: string;
  formula_id: string;
  formula_code: string;
  batches: number;
  total_required_kg: number;
  materials_ok: boolean;
  shortages_json: any[];
  created_at: string;
  schedule_date: string;
  formula_name?: string;
  order_header_id?: string | null;
}

interface IngredientRequirement {
  ingredient_id: string;
  ingredient_name: string;
  required_kg: number;
  supplier?: string;
  lot_number?: string;
  quantity_per_batch: number;
  total_quantity: number;
  cost_per_kg?: number;
  total_cost?: number;
}

interface Reservation {
  lot_id: string;
  lot_number: string;
  reserved_kg: number;
  ingredient_name: string;
}

interface ProductionItemDetailProps {
  item: ProductionScheduleItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function ProductionItemDetail({ item, open, onOpenChange, onUpdate }: ProductionItemDetailProps) {
  const [requirements, setRequirements] = useState<IngredientRequirement[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [orderInfo, setOrderInfo] = useState<{ po_number: string; customer_name: string; due_date: string } | null>(null);
  const [packagingInfo, setPackagingInfo] = useState<{
    bottle_name?: string;
    cap_name?: string;
    label_name?: string;
    corrugated_name?: string;
    estimated_bottles?: number;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && item) {
      loadItemDetails();
    }
  }, [open, item]);

  const loadItemDetails = async () => {
    setLoading(true);
    setOrderInfo(null);
    setPackagingInfo(null);
    try {
      console.log('Loading item details for:', item);
      
      // Check for linked order and packaging selections via order_header_id
      const { data: scheduleItem } = await supabase
        .from('production_schedule_items')
        .select(`
          order_header_id,
          selected_bottle_id,
          bottle_label_override,
          selected_cap_id,
          selected_label_id,
          selected_corrugated_id,
          estimated_bottles,
          order_headers(po_number, due_date, customers(company_name))
        `)
        .eq('id', item.id)
        .single();
      
      if (scheduleItem?.order_headers) {
        const order = scheduleItem.order_headers as any;
        setOrderInfo({
          po_number: order.po_number || 'No PO#',
          customer_name: order.customers?.company_name || 'Unknown Customer',
          due_date: order.due_date
        });
      } else {
        // No linked order - try to get customer from formula
        const { data: formulaData } = await supabase
          .from('formulas')
          .select('customer_id, customers(company_name)')
          .eq('id', item.formula_id)
          .single();
        
        if (formulaData?.customers) {
          const customer = formulaData.customers as any;
          setOrderInfo({
            po_number: 'No PO#',
            customer_name: customer.company_name || 'Unknown Customer',
            due_date: ''
          });
        }
      }

      // Fetch packaging details
      const packagingData: typeof packagingInfo = {
        estimated_bottles: scheduleItem?.estimated_bottles || undefined
      };

      // Fetch bottle details — prefer explicit override (Bulk / Bright Stock)
      if ((scheduleItem as any)?.bottle_label_override) {
        packagingData.bottle_name = (scheduleItem as any).bottle_label_override;
      } else if (scheduleItem?.selected_bottle_id) {
        const { data: bottleData } = await supabase
          .from('packaging_item')
          .select('item_name')
          .eq('id', scheduleItem.selected_bottle_id)
          .single();
        if (bottleData) packagingData.bottle_name = bottleData.item_name;
      }

      // Fetch cap details
      if (scheduleItem?.selected_cap_id) {
        const { data: capData } = await supabase
          .from('packaging_item')
          .select('item_name')
          .eq('id', scheduleItem.selected_cap_id)
          .single();
        if (capData) packagingData.cap_name = capData.item_name;
      }

      // Fetch label details
      if (scheduleItem?.selected_label_id) {
        const { data: labelData } = await supabase
          .from('label_inventory')
          .select('customer_product, product_name')
          .eq('id', scheduleItem.selected_label_id)
          .single();
        if (labelData) packagingData.label_name = labelData.product_name || labelData.customer_product;
      }

      // Fetch corrugated box details
      if (scheduleItem?.selected_corrugated_id) {
        const { data: corrugatedData } = await supabase
          .from('corrugated_shippers')
          .select('name')
          .eq('id', scheduleItem.selected_corrugated_id)
          .single();
        if (corrugatedData) packagingData.corrugated_name = corrugatedData.name;
      }

      // Only set packaging info if we have any data
      if (packagingData.bottle_name || packagingData.cap_name || packagingData.label_name || packagingData.corrugated_name || packagingData.estimated_bottles) {
        setPackagingInfo(packagingData);
      }
      
      // Get the formula data first to access the recipe - RLS will enforce security
      const { data: formulaData, error: formulaError } = await supabase
        .from('formulas')
        .select('recipe_json, name')
        .eq('id', item.formula_id)
        .maybeSingle();

      if (formulaError) {
        console.error('Formula error:', formulaError);
        throw formulaError;
      }

      console.log('Formula data:', formulaData);
      const recipe = formulaData?.recipe_json || [];
      console.log('Recipe:', recipe);
      
      const enhancedRequirements: IngredientRequirement[] = [];
      
      // Process each ingredient from the recipe - ensure it's an array
      const recipeArray = Array.isArray(recipe) ? recipe : [];
      console.log('Recipe array:', recipeArray);
      
      // Get all raw materials to match against
      const { data: allMaterials, error: materialsError } = await supabase
        .from('raw_materials')
        .select('id, name, supplier, code')
        .eq('is_archived', false);

      if (materialsError) {
        console.error('Materials error:', materialsError);
        throw materialsError;
      }

      console.log('All materials:', allMaterials);
      
      for (const ingredientData of recipeArray) {
        if (!ingredientData || typeof ingredientData !== 'object') continue;
        
        console.log('Processing ingredient:', ingredientData);
        
        // Type assertion for ingredient properties - using actual data structure
        const ingredient = ingredientData as { 
          materialName?: string; 
          weightKg?: number;
          supplier?: string;
          lotNumber?: string;
        };
        
        if (!ingredient.materialName) {
          console.warn('No materialName found in:', ingredientData);
          continue;
        }

        // Extract material name and supplier from ingredient name (e.g., "Red Color (Colorcon)")
        const ingredientName = ingredient.materialName;
        let materialName = ingredientName;
        let supplierName = null;
        
        // Check if ingredient name contains supplier in parentheses
        const supplierMatch = ingredientName.match(/^(.+?)\s*\(([^)]+)\)$/);
        if (supplierMatch) {
          materialName = supplierMatch[1].trim();
          supplierName = supplierMatch[2].trim();
        }

        console.log('Parsing ingredient:', {
          original: ingredientName,
          materialName,
          supplierName
        });

        // First try: exact match with name and supplier
        let material = null;

        if (supplierName) {
          console.log('Attempting exact match with supplier:', materialName, supplierName);
          material = allMaterials?.find(m => 
            m.name.toLowerCase() === materialName.toLowerCase() &&
            m.supplier?.toLowerCase() === supplierName.toLowerCase()
          );
          
          if (material) {
            console.log('Found exact name+supplier match:', material);
          } else {
            console.log('No exact name+supplier match found');
          }
        }

        // Fallback: match by name only, but prioritize non-zero cost materials
        if (!material) {
          console.log('Attempting name-only match with cost prioritization for:', materialName);
          
          // Get all materials with matching name
          const nameMatches = allMaterials?.filter(m => 
            m.name.toLowerCase() === materialName.toLowerCase()
          ) || [];

          if (nameMatches.length > 0) {
            console.log('Found name matches:', nameMatches);
            
            // For each material, get cost information to prioritize
            const materialsWithCosts = await Promise.all(
              nameMatches.map(async (mat) => {
                const { data: lotData } = await supabase
                  .from('raw_material_lots')
                  .select('cost, quantity')
                  .eq('raw_material_id', mat.id)
                  .gt('quantity', 0);

                const avgCost = lotData && lotData.length > 0 
                  ? lotData.reduce((sum, lot) => sum + (lot.cost || 0), 0) / lotData.length 
                  : 0;
                
                return { ...mat, avgCost };
              })
            );

            // Sort by cost (non-zero costs first, then by highest cost)
            materialsWithCosts.sort((a, b) => {
              if (a.avgCost === 0 && b.avgCost > 0) return 1;
              if (b.avgCost === 0 && a.avgCost > 0) return -1;
              return b.avgCost - a.avgCost;
            });

            console.log('Materials sorted by cost priority:', materialsWithCosts);
            material = materialsWithCosts[0];
            console.log('Selected best match:', material);
          }
        }

        // If still no match, try partial matching as last resort
        if (!material) {
          console.log('Attempting partial name matching');
          material = allMaterials?.find(m => 
            m.name.toLowerCase().includes(materialName.toLowerCase()) ||
            materialName.toLowerCase().includes(m.name.toLowerCase())
          );
          
          if (material) {
            console.log('Found partial match:', material);
          }
        }

        const quantityPerBatch = ingredient.weightKg || 0;
        const totalQuantity = quantityPerBatch * item.batches;

        if (!material) {
          console.warn('Material not found for:', ingredient.materialName);
          console.log('Available materials:', allMaterials?.map(m => m.name));
          
          // Still add the ingredient even if material not found, with recipe data
          enhancedRequirements.push({
            ingredient_id: 'not-found',
            ingredient_name: ingredient.materialName,
            required_kg: totalQuantity,
            supplier: ingredient.supplier || 'N/A',
            lot_number: ingredient.lotNumber || 'N/A',
            quantity_per_batch: quantityPerBatch,
            total_quantity: totalQuantity,
            cost_per_kg: 0,
            total_cost: 0
          });
          continue;
        }

        console.log('Found material:', material);

        // Get lot details with cost information
        console.log('Fetching lots for material ID:', material.id, 'Material name:', material.name);
        const { data: lotData, error: lotError } = await supabase
          .from('raw_material_lots')
          .select('lot_number, cost, quantity, receiving_date')
          .eq('raw_material_id', material.id)
          .gt('quantity', 0)
          .order('receiving_date', { ascending: false })
          .limit(1);

        if (lotError) {
          console.error('Lot error for material:', material.name, lotError);
        }

        console.log('Lot data for', material.name, ':', lotData);
        const latestLot = lotData?.[0];
        const costPerKg = latestLot?.cost || 0;
        const totalCost = totalQuantity * costPerKg;
        
        console.log('Cost calculation for', material.name, ':', {
          latestLot,
          costPerKg,
          totalQuantity,
          totalCost
        });

        console.log('Adding requirement:', {
          material: material.name,
          quantityPerBatch,
          totalQuantity,
          costPerKg,
          totalCost
        });

        enhancedRequirements.push({
          ingredient_id: material.id,
          ingredient_name: ingredient.materialName,
          required_kg: totalQuantity,
          supplier: ingredient.supplier || material.supplier || 'N/A',
          lot_number: ingredient.lotNumber || latestLot?.lot_number || 'N/A',
          quantity_per_batch: quantityPerBatch,
          total_quantity: totalQuantity,
          cost_per_kg: costPerKg,
          total_cost: totalCost
        });
      }

      setRequirements(enhancedRequirements);

      // Load reservations
      const { data: resData, error: resError } = await supabase
        .from('inventory_reservations')
        .select(`
          lot_id,
          reserved_kg
        `)
        .eq('schedule_item_id', item.id);

      if (resError) throw resError;

      // Now fetch lot details separately to avoid ambiguous relationships
      const reservationsList: Reservation[] = [];
      
      for (const res of resData || []) {
        // First get the lot data
        const { data: lotData, error: lotError } = await supabase
          .from('raw_material_lots')
          .select('lot_number, raw_material_id')
          .eq('id', res.lot_id)
          .single();

        if (lotError) {
          console.warn('Error fetching lot details:', lotError);
          continue;
        }

        // Then get the material name
        const { data: materialData, error: materialError } = await supabase
          .from('raw_materials')
          .select('name')
          .eq('id', lotData.raw_material_id)
          .single();

        if (materialError) {
          console.warn('Error fetching material details:', materialError);
          continue;
        }

        reservationsList.push({
          lot_id: res.lot_id,
          reserved_kg: res.reserved_kg,
          lot_number: lotData?.lot_number || 'Unknown Lot',
          ingredient_name: materialData?.name || 'Unknown Material'
        });
      }

      setReservations(reservationsList);
    } catch (error: any) {
      toast({
        title: "Error loading item details",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Delete reservations first (due to foreign key constraints)
      const { error: resError } = await supabase
        .from('inventory_reservations')
        .delete()
        .eq('schedule_item_id', item.id);

      if (resError) throw resError;

      // Update lots to unreserve materials
      for (const reservation of reservations) {
        // Get current qty_reserved_kg and subtract the reservation
        const { data: currentLot, error: fetchError } = await supabase
          .from('raw_material_lots')
          .select('qty_reserved_kg')
          .eq('id', reservation.lot_id)
          .single();

        if (fetchError) throw fetchError;

        const newReservedKg = Math.max(0, (currentLot?.qty_reserved_kg || 0) - reservation.reserved_kg);

        const { error: lotError } = await supabase
          .from('raw_material_lots')
          .update({ qty_reserved_kg: newReservedKg })
          .eq('id', reservation.lot_id);

        if (lotError) throw lotError;
      }

      // Delete schedule item
      const { error: itemError } = await supabase
        .from('production_schedule_items')
        .delete()
        .eq('id', item.id);

      if (itemError) throw itemError;

      toast({
        title: "Schedule item deleted",
        description: "Materials have been unreserved and returned to inventory"
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error deleting item",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };

  const groupedReservations = reservations.reduce((groups, reservation) => {
    const key = reservation.ingredient_name;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(reservation);
    return groups;
  }, {} as Record<string, Reservation[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:48rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Production Schedule Details
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading details...</p>
          </div>
        ) : (
          <div className="space-y-6 min-w-0">
            {/* PO Number Info */}
            {orderInfo && (
              <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20 min-w-0">
                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-primary">{orderInfo.po_number}</span>
                  <span className="text-muted-foreground truncate"> • {orderInfo.customer_name}</span>
                  {orderInfo.due_date && (
                    <span className="text-sm text-muted-foreground ml-2">
                      Due {formatET(orderInfo.due_date, 'MMM dd, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4 min-w-0">
              <div className="min-w-0">
                <h3 className="font-semibold mb-2">Formula</h3>
                <p className="text-lg truncate">{item.formula_code}</p>
                <p className="text-muted-foreground truncate">{item.formula_name}</p>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold mb-2">Schedule Date</h3>
                <p className="text-lg">{formatET(item.schedule_date, 'PPP')}</p>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold mb-2">Batches</h3>
                <p className="text-lg">{item.batches}</p>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold mb-2">Company</h3>
                <p className="text-lg truncate">{orderInfo?.customer_name || 'N/A'}</p>
              </div>
            </div>

            {/* Packaging Details */}
            {packagingInfo && (
              <div>
                <h3 className="font-semibold mb-2">Packaging Details</h3>
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg min-w-0">
                  {packagingInfo.bottle_name && (
                    <div>
                      <span className="text-sm text-muted-foreground">Bottle:</span>
                      <p className="font-medium">{packagingInfo.bottle_name}</p>
                    </div>
                  )}
                  {packagingInfo.cap_name && (
                    <div>
                      <span className="text-sm text-muted-foreground">Cap:</span>
                      <p className="font-medium">{packagingInfo.cap_name}</p>
                    </div>
                  )}
                  {packagingInfo.label_name && (
                    <div>
                      <span className="text-sm text-muted-foreground">Label:</span>
                      <p className="font-medium">{packagingInfo.label_name}</p>
                    </div>
                  )}
                  {packagingInfo.corrugated_name && (
                    <div>
                      <span className="text-sm text-muted-foreground">Corrugated Box:</span>
                      <p className="font-medium">{packagingInfo.corrugated_name}</p>
                    </div>
                  )}
                  {packagingInfo.estimated_bottles && (
                    <div>
                      <span className="text-sm text-muted-foreground">Est. Bottles:</span>
                      <p className="font-medium">{packagingInfo.estimated_bottles.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Materials Status */}
            <div>
              <h3 className="font-semibold mb-2">Materials Status</h3>
              <div className="flex items-center gap-2">
                {item.materials_ok ? (
                  <>
                    <Check className="h-5 w-5 text-success" />
                    <Badge variant="default" className="bg-success text-success-foreground">
                      All materials reserved
                    </Badge>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <Badge variant="destructive">Material shortages</Badge>
                  </>
                )}
              </div>

              {!item.materials_ok && item.shortages_json?.length > 0 && (
                <div className="mt-3 space-y-2">
                  <h4 className="font-medium">Shortages:</h4>
                  {item.shortages_json.map((shortage: any, index: number) => (
                    <div key={index} className="bg-destructive/10 p-3 rounded border">
                      <div className="font-medium">{shortage.ingredient_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Required: {shortage.required_kg}kg, Available: {shortage.available_kg}kg,
                        Shortfall: {shortage.shortfall_kg}kg
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Formula Requirements */}
            <div>
              <h3 className="font-semibold mb-3">Formula Requirements</h3>
              <div className="space-y-3">
                {requirements.map((req) => (
                  <div key={req.ingredient_id} className="p-4 bg-muted/30 rounded-lg border">
                    <div className="grid grid-cols-2 gap-4 min-w-0">
                      <div>
                        <h4 className="font-semibold text-base">{req.ingredient_name}</h4>
                        <div className="text-sm text-muted-foreground space-y-1 mt-2">
                          <div><span className="font-medium">Supplier:</span> {req.supplier}</div>
                          <div><span className="font-medium">Lot Number:</span> {req.lot_number}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="font-medium">Qty/Batch:</span> {req.quantity_per_batch.toFixed(3)} kg
                          </div>
                          <div className="text-lg font-semibold">
                            <span className="text-sm font-medium">Total Qty:</span> {req.total_quantity.toFixed(2)} kg
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Cost per kg:</span> ${req.cost_per_kg?.toFixed(2) || '0.00'}
                          </div>
                          <div className="text-base font-semibold text-primary">
                            <span className="text-sm font-medium">Total Cost:</span> ${req.total_cost?.toFixed(2) || '0.00'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Material Reservations */}
            {item.materials_ok && (
              <div>
                <h3 className="font-semibold mb-3">Material Reservations</h3>
                <div className="space-y-4">
                  {Object.entries(groupedReservations).map(([ingredientName, lots]) => (
                    <div key={ingredientName}>
                      <h4 className="font-medium mb-2">{ingredientName}</h4>
                      <div className="space-y-1">
                        {lots.map((lot) => (
                          <div key={lot.lot_id} className="flex justify-between items-center p-2 bg-muted/30 rounded text-sm">
                            <span>Lot: {lot.lot_number}</span>
                            <span>{(lot.reserved_kg || 0).toFixed(2)} kg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Schedule Item
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Schedule Item</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this schedule item? This will unreserve all materials
                      and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                      {deleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <Button variant="outline" onClick={() => onOpenChange(false)} className="ml-auto">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}