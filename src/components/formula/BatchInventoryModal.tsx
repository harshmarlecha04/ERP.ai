import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { BatchCalculationResult } from '@/hooks/useBatchCalculation';

interface BatchInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  formulaName: string;
  batchData: BatchCalculationResult | null;
}

export const BatchInventoryModal: React.FC<BatchInventoryModalProps> = ({
  isOpen,
  onClose,
  formulaName,
  batchData
}) => {
  if (!batchData) return null;

  const getStatusColor = (available: number, required: number) => {
    if (available >= required) return 'text-green-600 bg-green-50 border-green-200';
    if (available === 0) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  };

  const getStatusIcon = (available: number, required: number, isLimiting: boolean = false) => {
    if (isLimiting) return <AlertTriangle className="h-4 w-4 text-red-600" />;
    if (available >= required) return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  };

  const getStatusText = (available: number, required: number) => {
    if (available >= required) return 'Sufficient';
    if (available === 0) return 'Out of Stock';
    return 'Insufficient';
  };

  const maxBatches = batchData.max_batches || 0;
  const limitingIngredient = batchData.limiting_ingredient;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventory Details - {formulaName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Summary Section */}
          <div className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-lg p-4 border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{maxBatches}</p>
                <p className="text-sm text-muted-foreground">
                  {maxBatches === 1 ? 'Batch Possible' : 'Batches Possible'}
                </p>
              </div>
              
              {limitingIngredient && (
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">Limiting Ingredient</p>
                  <p className="font-semibold text-red-600">{limitingIngredient.ingredient_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {limitingIngredient.available_kg.toFixed(2)} kg available
                  </p>
                </div>
              )}
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-2">
                  {maxBatches > 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={`font-medium ${maxBatches > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {maxBatches > 0 ? 'Can Produce' : 'Cannot Produce'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Available (kg)</TableHead>
                  <TableHead className="text-right">Required/Batch (kg)</TableHead>
                  <TableHead className="text-right">Required for {maxBatches} Batches (kg)</TableHead>
                  <TableHead className="text-right">Max Possible Batches</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchData.ingredient_details.map((ingredient, index) => {
                  const requiredForMaxBatches = ingredient.required_per_batch_kg * maxBatches;
                  const isLimiting = limitingIngredient?.ingredient_id === ingredient.ingredient_id;
                  const hasInventoryMatch = ingredient.has_inventory_match !== false; // Default to true for backwards compatibility
                  
                  return (
                    <TableRow key={index} className={isLimiting ? 'bg-red-50/50' : (!hasInventoryMatch ? 'bg-orange-50/30' : '')}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="font-medium">{ingredient.ingredient_name}</span>
                            {ingredient.matched_material_name && 
                             ingredient.matched_material_name !== ingredient.ingredient_name && (
                              <span className="text-xs text-blue-600 italic">
                                matched: {ingredient.matched_material_name}
                              </span>
                            )}
                          </div>
                          {isLimiting && (
                            <Badge variant="destructive" className="text-xs">
                              Limiting
                            </Badge>
                          )}
                          {!hasInventoryMatch && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              No Match
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={!hasInventoryMatch ? 'text-orange-600' : ''}>
                          {ingredient.available_kg.toFixed(2)}
                          {!hasInventoryMatch && ' (no match)'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {ingredient.required_per_batch_kg.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={ingredient.available_kg >= ingredient.required_per_batch_kg ? 'text-green-600' : 'text-red-600'}>
                          {requiredForMaxBatches.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {ingredient.max_batches_from_ingredient}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(ingredient.available_kg, ingredient.required_per_batch_kg, isLimiting)}
                          <span className={`text-sm font-medium ${
                            !hasInventoryMatch 
                              ? 'text-orange-600' 
                              : isLimiting 
                                ? 'text-red-600' 
                                : ingredient.available_kg >= ingredient.required_per_batch_kg
                                  ? 'text-green-600'
                                  : 'text-red-600'
                          }`}>
                            {!hasInventoryMatch 
                              ? 'No Match' 
                              : isLimiting 
                                ? 'Limiting' 
                                : getStatusText(ingredient.available_kg, ingredient.required_per_batch_kg)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Additional Info */}
          {maxBatches === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900">Cannot produce any batches</h4>
                  <p className="text-sm text-red-700 mt-1">
                    One or more ingredients are out of stock or insufficient to produce even a single batch.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};