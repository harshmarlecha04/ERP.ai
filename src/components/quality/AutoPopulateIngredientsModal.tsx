import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Package, Zap, AlertTriangle, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { OverwriteConfirmationModal } from './OverwriteConfirmationModal';

interface Assignment {
  ingredient_name: string;
  raw_material_id: string;
  lot_id: string;
  supplier_name: string;
  lot_number: string;
  allocated_qty: number;
  current_lot_qty: number;
  after_deduction_qty: number;
  current_total_inventory_kg: number;
  after_total_inventory_kg: number;
}

interface Shortage {
  ingredient_name: string;
  required_kg: number;
  current_total_inventory_kg?: number;
  after_deduction_kg?: number;
  allocated_kg?: number;
  shortfall_kg?: number;
  error: string;
}

interface AutoPopulateResult {
  success: boolean;
  assignments: Assignment[];
  shortages: Shortage[];
  total_ingredients_processed: number;
  message: string;
  requires_overwrite_confirmation?: boolean;
  existing_assignments?: any[];
  existing_count?: number;
  was_cached?: boolean;
  session_checksum?: string;
  existing_assignments_replaced?: number;
}

interface AutoPopulateIngredientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  scheduleItem: {
    id: string;
    formula_id: string;
    formula_code: string;
    formula_name: string;
    batches: number;
    schedule_date: string;
  } | null;
}

export const AutoPopulateIngredientsModal: React.FC<AutoPopulateIngredientsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  scheduleItem
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutoPopulateResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [processedItemId, setProcessedItemId] = useState<string | null>(null);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [pendingOverwrite, setPendingOverwrite] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const { toast } = useToast();

  const autoPopulateIngredients = async (forceOverwrite = false) => {
    if (!scheduleItem) return;

    try {
      setLoading(true);
      setResult(null);

      const { data, error } = await supabase.rpc('auto_populate_production_ingredients_safe', {
        p_schedule_item_id: scheduleItem.id,
        p_formula_id: scheduleItem.formula_id,
        p_batches: scheduleItem.batches,
        p_idempotency_key: idempotencyKey,
        p_force_overwrite: forceOverwrite
      });

      if (error) throw error;

      const result = data as unknown as AutoPopulateResult;
      setResult(result);

      // Handle overwrite confirmation requirement
      if (result.requires_overwrite_confirmation) {
        setShowOverwriteWarning(true);
        toast({
          title: "Existing Assignments Found",
          description: `Found ${result.existing_count} existing assignments. Please confirm to overwrite.`,
          variant: "destructive"
        });
        return;
      }

      if (result.success) {
        const message = result.was_cached 
          ? "Retrieved cached auto-population results"
          : `Auto-populated ${result.total_ingredients_processed} ingredients with FIFO allocation`;
        
        toast({
          title: "Success",
          description: message,
        });
      } else {
        toast({
          title: "Partial Success",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error auto-populating ingredients:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to auto-populate ingredients",
        variant: "destructive"
      });
      setResult({
        success: false,
        assignments: [],
        shortages: [{ 
          ingredient_name: 'System Error', 
          required_kg: 0, 
          error: error.message || 'Failed to auto-populate ingredients' 
        }],
        total_ingredients_processed: 0,
        message: 'Auto-population failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOverwrite = async () => {
    setShowOverwriteWarning(false);
    setPendingOverwrite(true);
    await autoPopulateIngredients(true); // Force overwrite
    setPendingOverwrite(false);
  };

  const handleOverwriteConfirm = () => {
    handleConfirmOverwrite();
  };

  const handleCancelOverwrite = () => {
    setShowOverwriteWarning(false);
    setResult(null);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    setProcessedItemId(null);
    setResult(null);
    setShowOverwriteWarning(false);
    setIdempotencyKey(crypto.randomUUID());
    onClose();
  };

  useEffect(() => {
    if (isOpen && scheduleItem && scheduleItem.id !== processedItemId) {
      setProcessedItemId(scheduleItem.id);
      setResult(null);
      setShowOverwriteWarning(false);
      setIdempotencyKey(crypto.randomUUID());
      autoPopulateIngredients(false);
    }
  }, [isOpen, scheduleItem?.id]);

  if (!scheduleItem) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="[--dialog-max-width:72rem] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Auto-Populate All Required Ingredients
              {result?.existing_assignments_replaced > 0 && (
                <Badge variant="outline" className="ml-2">
                  <Shield className="h-3 w-3 mr-1" />
                  Safe Transaction
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <div className="text-foreground">
                This will automatically assign all required ingredients using FIFO (First In, First Out) lot assignment
                with enhanced safety features including transaction protection and overwrite warnings.
              </div>
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="text-sm space-y-1">
                  <div><strong>Formula:</strong> {scheduleItem.formula_code} - {scheduleItem.formula_name}</div>
                  <div><strong>Batches:</strong> {scheduleItem.batches}</div>
                  <div><strong>Scheduled Date:</strong> {new Date(scheduleItem.schedule_date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-6">
            {(loading || pendingOverwrite) ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-64" />
                  {pendingOverwrite && (
                    <Badge variant="outline" className="animate-pulse">
                      Processing Overwrite...
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </div>
            ) : result ? (
            <>
              {/* Overwrite Warning */}
              {showOverwriteWarning && result?.requires_overwrite_confirmation && (
                <Card className="border-warning bg-warning/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-warning">
                      <AlertTriangle className="h-5 w-5" />
                      Existing Assignments Found
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      This schedule item already has <strong>{result.existing_count}</strong> ingredient assignments. 
                      Proceeding will <strong>replace all existing assignments</strong> with new FIFO allocations.
                    </div>
                    
                    {result.existing_assignments && result.existing_assignments.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Current Assignments:</div>
                        <div className="bg-muted/50 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                          {result.existing_assignments.map((assignment, index) => (
                            <div key={index} className="text-xs flex justify-between">
                              <span>{assignment.ingredient_name}</span>
                              <span className="text-muted-foreground">
                                {assignment.supplier_name} - {assignment.lot_number} ({assignment.allocated_qty} kg)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowOverwriteWarning(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleOverwriteConfirm}
                        disabled={loading}
                        className="flex-1 bg-warning text-warning-foreground hover:bg-warning/90"
                      >
                        {loading ? 'Processing...' : 'Replace Assignments'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    )}
                    Auto-Population Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Ingredients:</span>
                      <div className="font-medium text-lg">{result.total_ingredients_processed}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Successfully Assigned:</span>
                      <div className="font-medium text-lg text-success">
                        {result.assignments.length}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Issues Found:</span>
                      <div className="font-medium text-lg text-destructive">
                        {result.shortages.length}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div className="font-medium">
                        <Badge variant={result.success ? "default" : "destructive"}>
                          {result.success ? (result.was_cached ? "Cached" : "Complete") : "Partial"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Successful Assignments */}
              {result.assignments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-success">
                      <CheckCircle className="h-5 w-5" />
                      Successfully Assigned Ingredients ({result.assignments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ingredient</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Lot Number</TableHead>
                            <TableHead className="text-right">Allocated (kg)</TableHead>
                            <TableHead className="text-right">Current Inventory (kg)</TableHead>
                            <TableHead className="text-right">After Deduction (kg)</TableHead>
                          </TableRow>
                        </TableHeader>
                      <TableBody>
                        {result.assignments.map((assignment, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {assignment.ingredient_name}
                            </TableCell>
                            <TableCell>
                              {assignment.supplier_name || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {assignment.lot_number || 'N/A'}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-success">
                              {assignment.allocated_qty.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {assignment.current_total_inventory_kg.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              <span className={assignment.after_total_inventory_kg === 0 ? "text-warning" : "text-muted-foreground"}>
                                {assignment.after_total_inventory_kg.toFixed(2)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Shortages and Issues */}
              {result.shortages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      Issues Found ({result.shortages.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ingredient</TableHead>
                            <TableHead className="text-right">Required (kg)</TableHead>
                            <TableHead className="text-right">Current Inventory (kg)</TableHead>
                            <TableHead className="text-right">After Deduction (kg)</TableHead>
                            <TableHead>Issue</TableHead>
                          </TableRow>
                        </TableHeader>
                      <TableBody>
                        {result.shortages.map((shortage, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {shortage.ingredient_name}
                            </TableCell>
                            <TableCell className="text-right">
                              {shortage.required_kg.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {shortage.current_total_inventory_kg?.toFixed(2) || 'N/A'}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              <span className={shortage.after_deduction_kg === 0 ? "text-warning" : "text-destructive"}>
                                {shortage.after_deduction_kg?.toFixed(2) || 'N/A'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="text-xs">
                                {shortage.error}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {result.success && !showOverwriteWarning && (
                <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                  <div className="flex items-center gap-2 text-success font-medium">
                    <CheckCircle className="h-4 w-4" />
                    {result.was_cached 
                      ? "Using cached ingredient assignments (no database changes made)"
                      : `All ingredients have been successfully auto-populated and are ready for deduction!${result.existing_assignments_replaced ? ` Replaced ${result.existing_assignments_replaced} existing assignments.` : ''}`
                    }
                  </div>
                  {result.session_checksum && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Session: {result.session_checksum.substring(0, 8)}...
                    </div>
                  )}
                </div>
              )}
            </>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            {result?.success && !showOverwriteWarning && (
              <Button 
                onClick={handleConfirm}
                disabled={confirming}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                {confirming ? 'Processing...' : 'Proceed to Deduct Inventory'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Overwrite Warning Dialog */}
      <OverwriteConfirmationModal
        isOpen={showOverwriteWarning && result?.requires_overwrite_confirmation === true}
        onCancel={handleCancelOverwrite}
        onConfirm={handleConfirmOverwrite}
        existingAssignments={result?.existing_assignments || []}
        existingCount={result?.existing_count || 0}
        scheduleItem={scheduleItem}
      />
    </>
  );
};