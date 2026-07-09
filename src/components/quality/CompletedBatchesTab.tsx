import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Undo2, Package, Calendar, ChevronDown, ChevronRight, ArrowUpDown, FileText } from 'lucide-react';
import { useCompletedBatches } from '@/hooks/useCompletedBatches';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatInTimeZone } from 'date-fns-tz';
import { GenerateCOAModal, type CoaBatchPrefill } from '@/components/formula/GenerateCOAModal';
import { todayET } from "@/utils/dateUtils";


export const CompletedBatchesTab: React.FC = () => {
  const { completedBatches, loading, undoDeduction } = useCompletedBatches();
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [ingredientCosts, setIngredientCosts] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<'default' | 'newest' | 'oldest' | 'scheduled_newest' | 'scheduled_oldest'>('default');
  const [coaFormula, setCoaFormula] = useState<any | null>(null);
  const [coaPrefill, setCoaPrefill] = useState<CoaBatchPrefill | null>(null);
  const [coaOpen, setCoaOpen] = useState(false);
  const [loadingCoaBatchId, setLoadingCoaBatchId] = useState<string | null>(null);

  const openCoaForBatch = async (batch: any) => {
    try {
      setLoadingCoaBatchId(batch.id);
      const { data: item } = await supabase
        .from('production_schedule_items')
        .select('formula_id')
        .eq('id', batch.schedule_item_id)
        .maybeSingle();
      if (!item?.formula_id) throw new Error('Formula not linked to this batch');
      const { data: formula } = await supabase
        .from('formulas').select('*').eq('id', item.formula_id).maybeSingle();
      if (!formula) throw new Error('Formula not found');

      const completedIso = batch.completed_at
        ? new Date(batch.completed_at).toISOString().slice(0, 10)
        : todayET();
      const mfg = new Date(completedIso);
      const mmddyyyy = `${String(mfg.getMonth() + 1).padStart(2, '0')}${String(mfg.getDate()).padStart(2, '0')}${mfg.getFullYear()}`;
      const batchLot = `PV${mmddyyyy}-${batch.batch_count || 1}`;

      setCoaFormula(formula);
      setCoaPrefill({
        batchLot,
        manufacturingDate: completedIso,
        productionBatchId: batch.id,
      });
      setCoaOpen(true);
    } catch (err: any) {
      console.error('Failed to open COA modal', err);
    } finally {
      setLoadingCoaBatchId(null);
    }
  };


  const handleUndoDeduction = async (batchId: string) => {
    await undoDeduction(batchId);
  };

  const calculateIngredientCost = async (ingredientName: string, deductedQuantity: number) => {
    try {
      // Find raw material by name
      const { data: rawMaterial } = await supabase
        .from('raw_materials')
        .select('id')
        .ilike('name', ingredientName)
        .maybeSingle();

      if (!rawMaterial) return 0;
      
      // Get average cost from all lots for this ingredient
      const { data: lots } = await supabase
        .from('raw_material_lots')
        .select('cost, quantity')
        .eq('raw_material_id', rawMaterial.id)
        .gt('quantity', 0);

      if (!lots || lots.length === 0) return 0;

      // Calculate weighted average cost
      let totalWeight = 0;
      let weightedCostSum = 0;
      
      lots.forEach(lot => {
        const cost = lot.cost || 0;
        const quantity = lot.quantity || 0;
        weightedCostSum += cost * quantity;
        totalWeight += quantity;
      });
      
      const avgCostPerKg = totalWeight > 0 ? weightedCostSum / totalWeight : 0;
      return avgCostPerKg * deductedQuantity;
    } catch (error) {
      console.error('Error calculating ingredient cost:', error);
      return 0;
    }
  };

  const loadIngredientCosts = async () => {
    const costs: Record<string, number> = {};
    
    for (const batch of completedBatches) {
      for (const deduction of batch.ingredient_deductions) {
        const costKey = `${batch.id}-${deduction.id}`;
        const cost = await calculateIngredientCost(deduction.ingredient_name, deduction.deducted_quantity_kg);
        costs[costKey] = cost;
      }
    }
    
    setIngredientCosts(costs);
  };

  const toggleExpanded = (batchId: string) => {
    const newExpanded = new Set(expandedBatches);
    if (newExpanded.has(batchId)) {
      newExpanded.delete(batchId);
    } else {
      newExpanded.add(batchId);
    }
    setExpandedBatches(newExpanded);
  };

  const getSortedBatches = () => {
    if (sortBy === 'default') return completedBatches;
    
    return [...completedBatches].sort((a, b) => {
      if (sortBy === 'newest' || sortBy === 'oldest') {
        // Sort by completed date
        const dateA = new Date(a.completed_at).getTime();
        const dateB = new Date(b.completed_at).getTime();
        return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
      } else if (sortBy === 'scheduled_newest' || sortBy === 'scheduled_oldest') {
        // Sort by scheduled date, fallback to completed date if no scheduled date
        const dateA = new Date(a.scheduled_date || a.completed_at).getTime();
        const dateB = new Date(b.scheduled_date || b.completed_at).getTime();
        return sortBy === 'scheduled_newest' ? dateB - dateA : dateA - dateB;
      }
      return 0;
    });
  };

  useEffect(() => {
    if (completedBatches.length > 0) {
      loadIngredientCosts();
    }
  }, [completedBatches]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deducted':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'reversed':
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (completedBatches.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">No Completed Batches</h3>
        <p className="text-muted-foreground">
          Completed batch deductions will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Completed Batches</h2>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value: 'default' | 'newest' | 'oldest' | 'scheduled_newest' | 'scheduled_oldest') => setSortBy(value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Order</SelectItem>
              <SelectItem value="newest">Completed: Newest First</SelectItem>
              <SelectItem value="oldest">Completed: Oldest First</SelectItem>
              <SelectItem value="scheduled_newest">Scheduled: Newest First</SelectItem>
              <SelectItem value="scheduled_oldest">Scheduled: Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {getSortedBatches().map((batch) => {
        const isExpanded = expandedBatches.has(batch.id);
        return (
          <Card key={batch.id} className="border-l-4 border-l-primary">
            <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(batch.id)}>
              <CardContent className="p-6">
                {/* Main batch row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-0 h-auto">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">
                        {batch.formula_code} - {batch.formula_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Batches: {batch.batch_count}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Total Qty: {batch.total_produced_qty} kg
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Scheduled: {batch.scheduled_date ? 
                            formatInTimeZone(new Date(batch.scheduled_date + 'T12:00:00'), 'America/New_York', 'MM/dd/yyyy') : 'N/A'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Completed: {new Date(batch.completed_at).toLocaleDateString('en-US', { 
                            month: '2-digit', 
                            day: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-green-600">
                          TCP: ${batch.tcp.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Badge className={getStatusColor(batch.status)}>
                      {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCoaForBatch(batch)}
                      disabled={loadingCoaBatchId === batch.id}
                      className="flex items-center gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Generate COA
                    </Button>
                    {batch.status === 'deducted' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUndoDeduction(batch.id)}
                        className="flex items-center gap-1"
                      >
                        <Undo2 className="h-3 w-3" />
                        Undo Deduction
                      </Button>
                    )}
                  </div>

                </div>

                {/* Expandable ingredient deductions */}
                <CollapsibleContent className="mt-4">
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Ingredient Deductions
                    </h4>
                    <div className="space-y-2">
                      {batch.ingredient_deductions.map((deduction) => {
                        const costKey = `${batch.id}-${deduction.id}`;
                        const ingredientCost = ingredientCosts[costKey] || 0;
                        
                        return (
                          <div
                            key={deduction.id}
                            className="grid grid-cols-12 gap-4 p-3 bg-muted/50 rounded-lg items-center"
                          >
                            <div className="col-span-4">
                              <div className="font-medium">{deduction.ingredient_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {deduction.supplier_name && (
                                  <span>Supplier: {deduction.supplier_name}</span>
                                )}
                                {deduction.supplier_name && deduction.lot_number && <span> • </span>}
                                {deduction.lot_number && (
                                  <span>Lot: {deduction.lot_number}</span>
                                )}
                              </div>
                            </div>
                            <div className="col-span-3 text-right">
                              <div className="font-medium text-destructive">
                                {deduction.deducted_quantity_kg === 0 ? '0.00' : `-${deduction.deducted_quantity_kg.toFixed(2)}`} kg
                              </div>
                            </div>
                            <div className="col-span-3 text-right">
                              <div className="font-medium text-destructive">
                                ${ingredientCost.toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ${(ingredientCost / deduction.deducted_quantity_kg).toFixed(2)}/kg
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Collapsible>
          </Card>
        );
      })}
      {coaFormula && (
        <GenerateCOAModal
          formula={coaFormula}
          open={coaOpen}
          onOpenChange={(o) => { setCoaOpen(o); if (!o) { setCoaFormula(null); setCoaPrefill(null); } }}
          prefill={coaPrefill || undefined}
        />
      )}
    </div>
  );
};
