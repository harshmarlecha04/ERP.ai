import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Calculator, ExternalLink } from 'lucide-react';
import { useFormulaCostEstimates, type CostEstimate } from '@/hooks/useFormulaCostEstimates';
import { cn } from '@/lib/utils';

interface ProductionScheduleCostViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  formulaId: string;
  formulaCode: string;
  formulaName: string;
  scheduledBatches: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const ProductionScheduleCostViewerModal: React.FC<ProductionScheduleCostViewerModalProps> = ({
  isOpen,
  onClose,
  formulaId,
  formulaCode,
  formulaName,
  scheduledBatches,
}) => {
  const [template, setTemplate] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState(scheduledBatches);
  const { getDefaultCostTemplate } = useFormulaCostEstimates(formulaId);

  // Fetch default template when modal opens
  useEffect(() => {
    if (isOpen && formulaId) {
      setLoading(true);
      setBatches(scheduledBatches);
      getDefaultCostTemplate(formulaId).then((result) => {
        setTemplate(result);
        setLoading(false);
      });
    }
  }, [isOpen, formulaId, scheduledBatches]);

  // Calculate scaled values based on current batches
  const scaledValues = useMemo(() => {
    if (!template) return null;

    const templateBatches = template.batches || 1;
    const scaleFactor = batches / templateBatches;

    // Scale RM costs
    const rmSubtotal = template.rm_lines.reduce((sum, line) => {
      return sum + (line.qtyPerBatch * batches * line.unitCost);
    }, 0);

    // Labor scaling depends on mode
    const laborScalingMode = template.totals.laborScalingMode || 'flat';
    const laborTotal = laborScalingMode === 'per_batch' 
      ? template.totals.laborTotal * scaleFactor
      : template.totals.laborTotal;

    // Utilities scaling
    const utilitiesScalingMode = template.totals.utilitiesScalingMode || 'percent';
    let utilitiesSubtotal: number;
    if (utilitiesScalingMode === 'percent') {
      const utilitiesPercent = template.utilities_value.percent || 5;
      utilitiesSubtotal = (rmSubtotal + laborTotal) * (utilitiesPercent / 100);
    } else if (utilitiesScalingMode === 'per_batch') {
      utilitiesSubtotal = template.totals.utilitiesSubtotal * scaleFactor;
    } else {
      utilitiesSubtotal = template.totals.utilitiesSubtotal;
    }

    // Calculate bottle output
    const gummiesPerBatch = template.totals.gummiesPerBatch || 43000;
    const bottleCount = template.totals.bottleCount || 60;
    const totalGummies = gummiesPerBatch * batches;
    const fullBottles = Math.floor(totalGummies / bottleCount);

    // Packaging materials
    const bottleUnitCost = template.totals.packagingBottle?.unitCost || 0;
    const capUnitCost = template.totals.packagingCap?.unitCost || 0;
    const bottleTotal = fullBottles * bottleUnitCost;
    const capTotal = fullBottles * capUnitCost;
    const packagingMaterialsSubtotal = bottleTotal + capTotal;

    const grandTotal = rmSubtotal + laborTotal + utilitiesSubtotal + packagingMaterialsSubtotal;
    const costPerBatch = batches > 0 ? grandTotal / batches : 0;
    const costPerBottle = fullBottles > 0 ? grandTotal / fullBottles : 0;

    return {
      rmSubtotal,
      laborTotal,
      laborManufacturing: laborScalingMode === 'per_batch' 
        ? template.totals.laborManufacturing * scaleFactor 
        : template.totals.laborManufacturing,
      laborCoating: laborScalingMode === 'per_batch' 
        ? template.totals.laborCoating * scaleFactor 
        : template.totals.laborCoating,
      laborPackaging: laborScalingMode === 'per_batch' 
        ? template.totals.laborPackaging * scaleFactor 
        : template.totals.laborPackaging,
      utilitiesSubtotal,
      packagingMaterialsSubtotal,
      grandTotal,
      costPerBatch,
      costPerBottle,
      fullBottles,
      gummiesPerBatch,
      bottleCount,
      bottleTotal,
      capTotal,
      scaleFactor,
    };
  }, [template, batches]);

  // Scaled RM lines for display
  const scaledRmLines = useMemo(() => {
    if (!template) return [];
    return template.rm_lines.map(line => ({
      ...line,
      extendedCost: line.qtyPerBatch * batches * line.unitCost,
    }));
  }, [template, batches]);

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="[--dialog-max-width:56rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              View Costs — {formulaCode}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!template) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              View Costs — {formulaCode}
            </DialogTitle>
            <DialogDescription>
              {formulaName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-5 w-5" />
              <span>No saved cost template for this formula.</span>
            </div>
            <p className="text-sm text-muted-foreground">
              To view costs for production schedules, first save a default cost template using the Formula Cost Calculator.
            </p>
            <Button variant="outline" onClick={onClose}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Cost Calculator from Formula Page
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            View Costs — {formulaCode}
          </DialogTitle>
          <DialogDescription>
            {formulaName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Batches Input */}
          <div className="flex items-center gap-4">
            <Label htmlFor="viewBatches" className="font-medium">Batches:</Label>
            <Input
              id="viewBatches"
              type="number"
              min={0.1}
              step={0.1}
              value={batches}
              onChange={(e) => setBatches(parseFloat(e.target.value) || 1)}
              className="w-32"
            />
            {batches !== scheduledBatches && (
              <span className="text-sm text-muted-foreground">
                (Scheduled: {scheduledBatches})
              </span>
            )}
          </div>

          {/* Raw Materials Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Raw Materials</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Qty/Batch</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Extended Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scaledRmLines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{line.materialName}</TableCell>
                      <TableCell className="text-right">{line.qtyPerBatch.toFixed(3)} {line.unit}</TableCell>
                      <TableCell className="text-right">
                        {line.hasCost ? (
                          `${formatCurrency(line.unitCost)}/kg`
                        ) : (
                          <span className="text-amber-600">Missing</span>
                        )}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", !line.hasCost && "text-muted-foreground")}>
                        {formatCurrency(line.extendedCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end mt-3 pt-3 border-t">
                <span className="font-semibold">RM Subtotal: {formatCurrency(scaledValues?.rmSubtotal || 0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Labor Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Labor Costs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Manufacturing Labor</span>
                  <span className="font-medium">{formatCurrency(scaledValues?.laborManufacturing || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Coating Labor</span>
                  <span className="font-medium">{formatCurrency(scaledValues?.laborCoating || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Packaging Labor</span>
                  <span className="font-medium">{formatCurrency(scaledValues?.laborPackaging || 0)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Total Labor</span>
                  <span>{formatCurrency(scaledValues?.laborTotal || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Utilities & Packaging */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Utilities/Overhead</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end">
                  <span className="font-semibold">{formatCurrency(scaledValues?.utilitiesSubtotal || 0)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Packaging Materials</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Bottles ({scaledValues?.fullBottles?.toLocaleString()})</span>
                    <span>{formatCurrency(scaledValues?.bottleTotal || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Caps ({scaledValues?.fullBottles?.toLocaleString()})</span>
                    <span>{formatCurrency(scaledValues?.capTotal || 0)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Subtotal</span>
                    <span>{formatCurrency(scaledValues?.packagingMaterialsSubtotal || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Totals Summary */}
          <Card className="bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Totals Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <span>Raw Materials</span>
                <span className="text-right">{formatCurrency(scaledValues?.rmSubtotal || 0)}</span>
                
                <span>Labor (Total)</span>
                <span className="text-right">{formatCurrency(scaledValues?.laborTotal || 0)}</span>
                
                <span>Utilities/Overhead</span>
                <span className="text-right">{formatCurrency(scaledValues?.utilitiesSubtotal || 0)}</span>
                
                <span>Packaging Materials</span>
                <span className="text-right">{formatCurrency(scaledValues?.packagingMaterialsSubtotal || 0)}</span>
                
                <span className="font-bold text-base pt-2 border-t">Grand Total</span>
                <span className="text-right font-bold text-base pt-2 border-t">{formatCurrency(scaledValues?.grandTotal || 0)}</span>
                
                <span className="text-muted-foreground">Cost per Batch</span>
                <span className="text-right text-muted-foreground">{formatCurrency(scaledValues?.costPerBatch || 0)}</span>
                
                <span className="text-muted-foreground">Cost per Bottle</span>
                <span className="text-right text-muted-foreground">{formatCurrency(scaledValues?.costPerBottle || 0)}</span>
                
                <span className="text-muted-foreground">Total Bottles</span>
                <span className="text-right text-muted-foreground">{scaledValues?.fullBottles?.toLocaleString() || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
