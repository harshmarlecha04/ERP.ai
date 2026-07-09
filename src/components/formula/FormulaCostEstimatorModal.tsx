import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Trash2, Save, FolderOpen, Calculator } from 'lucide-react';
import { useFormulaIngredientCosts } from '@/hooks/useFormulaIngredientCosts';
import { useFormulaCostEstimates, type LaborRow, type UtilityLine, type RMLine, type CostEstimateTotals, type CostEstimate, type PackagingMaterial } from '@/hooks/useFormulaCostEstimates';
import { usePackagingItems } from '@/hooks/usePackagingInventory';
import { cn } from '@/lib/utils';

// Fallback pricing for packaging materials
const BOTTLE_FALLBACK_PRICES: Record<string, number> = {
  '250cc Clear': 0.18,
  'Clear 250cc Bottle': 0.18,
  '250cc White': 0.18,
  'White 250cc Bottle': 0.18,
  '300cc Clear': 0.22,
  'Clear 300cc Bottle': 0.22,
  '400cc Clear': 0.24,
  'Clear 400cc Bottle': 0.24,
  '500cc Clear': 0.29,
  'Clear 500cc Bottle': 0.29,
};

const CAP_FALLBACK_PRICES: Record<string, number> = {
  '53MM CRC': 0.10,
  '53mm MRP': 0.10,
  '45MM CRC WHITE DEBOSSED': 0.07,
  '45mm Debossed MRP': 0.07,
};

const DEFAULT_BOTTLE_OPTIONS: PackagingMaterial[] = [
  { id: 'fallback-250-clear', name: '250cc Clear', unitCost: 0.18 },
  { id: 'fallback-250-white', name: '250cc White', unitCost: 0.18 },
  { id: 'fallback-300-clear', name: '300cc Clear', unitCost: 0.22 },
  { id: 'fallback-400-clear', name: '400cc Clear', unitCost: 0.24 },
  { id: 'fallback-500-clear', name: '500cc Clear', unitCost: 0.29 },
];

const DEFAULT_CAP_OPTIONS: PackagingMaterial[] = [
  { id: 'fallback-53mm', name: '53MM CRC', unitCost: 0.10 },
  { id: 'fallback-45mm', name: '45MM CRC WHITE DEBOSSED', unitCost: 0.07 },
];

interface FormulaCostEstimatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  formula: {
    id: string;
    code: string;
    name: string;
    default_batch_size_kg: number;
  } | null;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const FormulaCostEstimatorModal: React.FC<FormulaCostEstimatorModalProps> = ({
  isOpen,
  onClose,
  formula,
}) => {
  // State
  const [batches, setBatches] = useState(1);
  const [laborManufacturing, setLaborManufacturing] = useState<LaborRow[]>([]);
  const [laborCoating, setLaborCoating] = useState<LaborRow[]>([]);
  const [laborPackaging, setLaborPackaging] = useState<LaborRow[]>([]);
  const [laborMode, setLaborMode] = useState<'detailed' | 'total'>('detailed');
  const [laborManufacturingTotal, setLaborManufacturingTotal] = useState(0);
  const [laborCoatingTotal, setLaborCoatingTotal] = useState(0);
  const [laborPackagingTotal, setLaborPackagingTotal] = useState(0);
  const [utilitiesMode, setUtilitiesMode] = useState<'percent' | 'manual'>('percent');
  const [utilitiesPercent, setUtilitiesPercent] = useState(5);
  const [utilitiesLines, setUtilitiesLines] = useState<UtilityLine[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    manufacturing: false,
    coating: false,
    packaging: false,
  });
  const [currentEstimateId, setCurrentEstimateId] = useState<string | null>(null);
  const [estimateName, setEstimateName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [gummiesPerBatch, setGummiesPerBatch] = useState(43000);
  const [bottleCount, setBottleCount] = useState(60);
  const [isCustomBottleCount, setIsCustomBottleCount] = useState(false);
  const [customBottleCount, setCustomBottleCount] = useState(100);
  
  // Packaging materials state
  const [selectedBottle, setSelectedBottle] = useState<PackagingMaterial | null>(null);
  const [selectedCap, setSelectedCap] = useState<PackagingMaterial | null>(null);
  const [bottleUnitCostOverride, setBottleUnitCostOverride] = useState<number | null>(null);
  const [capUnitCostOverride, setCapUnitCostOverride] = useState<number | null>(null);

  // Hooks
  const ingredientCosts = useFormulaIngredientCosts(formula?.id || null);
  const { estimates, saveEstimate, deleteEstimate, saveDefaultCostTemplate } = useFormulaCostEstimates(formula?.id || null);
  const { data: packagingItems } = usePackagingItems();
  
  // Packaging options from inventory or fallback
  const bottleOptions = useMemo(() => {
    const invBottles = packagingItems?.filter(p => p.category === 'BOTTLES') || [];
    if (invBottles.length === 0) return DEFAULT_BOTTLE_OPTIONS;
    
    return invBottles.map(b => ({
      id: b.id,
      name: b.item_name,
      unitCost: BOTTLE_FALLBACK_PRICES[b.item_name] ?? 0,
    }));
  }, [packagingItems]);

  const capOptions = useMemo(() => {
    const invCaps = packagingItems?.filter(p => p.category === 'CAPS') || [];
    if (invCaps.length === 0) return DEFAULT_CAP_OPTIONS;
    
    return invCaps.map(c => ({
      id: c.id,
      name: c.item_name,
      unitCost: CAP_FALLBACK_PRICES[c.item_name] ?? 0,
    }));
  }, [packagingItems]);

  // Reset state when formula changes
  useEffect(() => {
    if (isOpen && formula) {
      setBatches(1);
      setLaborManufacturing([]);
      setLaborCoating([]);
      setLaborPackaging([]);
      setLaborMode('detailed');
      setLaborManufacturingTotal(0);
      setLaborCoatingTotal(0);
      setLaborPackagingTotal(0);
      setUtilitiesMode('percent');
      setUtilitiesPercent(5);
      setUtilitiesLines([]);
      setCurrentEstimateId(null);
      setEstimateName('');
      setGummiesPerBatch(43000);
      setBottleCount(60);
      setIsCustomBottleCount(false);
      setCustomBottleCount(100);
      // Reset packaging selections
      setSelectedBottle(null);
      setSelectedCap(null);
      setBottleUnitCostOverride(null);
      setCapUnitCostOverride(null);
    }
  }, [isOpen, formula?.id]);

  // Set default packaging selections when options are loaded
  useEffect(() => {
    if (!selectedBottle && bottleOptions.length > 0) {
      const defaultBottle = bottleOptions.find(b => b.name.includes('250') && b.name.toLowerCase().includes('clear')) 
        || bottleOptions[0];
      setSelectedBottle(defaultBottle);
    }
    if (!selectedCap && capOptions.length > 0) {
      const defaultCap = capOptions.find(c => c.name.includes('53')) || capOptions[0];
      setSelectedCap(defaultCap);
    }
  }, [bottleOptions, capOptions, selectedBottle, selectedCap]);

  // Calculate RM lines with batches
  const rmLines: RMLine[] = useMemo(() => {
    return ingredientCosts.ingredients.map(ing => ({
      materialName: ing.materialName,
      qtyPerBatch: ing.weightKg,
      unit: 'kg',
      unitCost: ing.costPerKg,
      extendedCost: ing.weightKg * batches * ing.costPerKg,
      hasCost: ing.hasData,
    }));
  }, [ingredientCosts.ingredients, batches]);

  const missingCostCount = rmLines.filter(r => !r.hasCost).length;

  // Calculate labor subtotals
  const calculateLaborSubtotal = useCallback((rows: LaborRow[]) => {
    return rows.reduce((sum, row) => sum + (row.payPerHour * row.hours), 0);
  }, []);

  const laborManufacturingSubtotal = useMemo(() => 
    laborMode === 'total' ? laborManufacturingTotal : calculateLaborSubtotal(laborManufacturing), 
    [laborMode, laborManufacturingTotal, laborManufacturing, calculateLaborSubtotal]
  );
  const laborCoatingSubtotal = useMemo(() => 
    laborMode === 'total' ? laborCoatingTotal : calculateLaborSubtotal(laborCoating), 
    [laborMode, laborCoatingTotal, laborCoating, calculateLaborSubtotal]
  );
  const laborPackagingSubtotal = useMemo(() => 
    laborMode === 'total' ? laborPackagingTotal : calculateLaborSubtotal(laborPackaging), 
    [laborMode, laborPackagingTotal, laborPackaging, calculateLaborSubtotal]
  );
  const laborTotal = laborManufacturingSubtotal + laborCoatingSubtotal + laborPackagingSubtotal;

  // Calculate RM subtotal
  const rmSubtotal = useMemo(() => {
    return rmLines.reduce((sum, line) => sum + line.extendedCost, 0);
  }, [rmLines]);

  // Calculate utilities
  const utilitiesSubtotal = useMemo(() => {
    if (utilitiesMode === 'percent') {
      return (rmSubtotal + laborTotal) * (utilitiesPercent / 100);
    } else {
      return utilitiesLines.reduce((sum, line) => sum + line.cost, 0);
    }
  }, [utilitiesMode, utilitiesPercent, utilitiesLines, rmSubtotal, laborTotal]);

  // Bottle cost calculations
  const totalGummies = useMemo(() => 
    (batches || 0) * (gummiesPerBatch || 0), 
    [batches, gummiesPerBatch]
  );
  const effectiveBottleCount = isCustomBottleCount ? customBottleCount : bottleCount;
  const exactBottles = useMemo(() => 
    effectiveBottleCount > 0 ? totalGummies / effectiveBottleCount : 0, 
    [totalGummies, effectiveBottleCount]
  );
  const fullBottles = useMemo(() => 
    effectiveBottleCount > 0 ? Math.floor(exactBottles) : 0, 
    [exactBottles, effectiveBottleCount]
  );
  const leftoverGummies = useMemo(() => 
    totalGummies - (fullBottles * effectiveBottleCount), 
    [totalGummies, fullBottles, effectiveBottleCount]
  );

  // Packaging materials costs
  const bottleUnitCost = bottleUnitCostOverride ?? selectedBottle?.unitCost ?? 0;
  const capUnitCost = capUnitCostOverride ?? selectedCap?.unitCost ?? 0;
  const bottleTotal = useMemo(() => fullBottles * bottleUnitCost, [fullBottles, bottleUnitCost]);
  const capTotal = useMemo(() => fullBottles * capUnitCost, [fullBottles, capUnitCost]);
  const packagingMaterialsSubtotal = useMemo(() => bottleTotal + capTotal, [bottleTotal, capTotal]);

  // Grand total (including packaging materials)
  const grandTotal = rmSubtotal + laborTotal + utilitiesSubtotal + packagingMaterialsSubtotal;
  const costPerBatch = batches > 0 ? grandTotal / batches : 0;

  // Cost per bottle
  const costPerBottle = useMemo(() => 
    fullBottles > 0 ? grandTotal / fullBottles : null, 
    [grandTotal, fullBottles]
  );

  // Cost per gummy in cents
  const costPerGummyCents = useMemo(() => 
    totalGummies > 0 ? (grandTotal / totalGummies) * 100 : null,
    [grandTotal, totalGummies]
  );

  // Labor row management
  const addLaborRow = (section: 'manufacturing' | 'coating' | 'packaging') => {
    const newRow: LaborRow = { id: generateId(), role: '', payPerHour: 0, hours: 0 };
    if (section === 'manufacturing') {
      setLaborManufacturing([...laborManufacturing, newRow]);
      setExpandedSections(prev => ({ ...prev, manufacturing: true }));
    } else if (section === 'coating') {
      setLaborCoating([...laborCoating, newRow]);
      setExpandedSections(prev => ({ ...prev, coating: true }));
    } else {
      setLaborPackaging([...laborPackaging, newRow]);
      setExpandedSections(prev => ({ ...prev, packaging: true }));
    }
  };

  const updateLaborRow = (section: 'manufacturing' | 'coating' | 'packaging', id: string, field: keyof LaborRow, value: string | number) => {
    const updateFn = (rows: LaborRow[]) =>
      rows.map(row => (row.id === id ? { ...row, [field]: value } : row));
    
    if (section === 'manufacturing') setLaborManufacturing(updateFn);
    else if (section === 'coating') setLaborCoating(updateFn);
    else setLaborPackaging(updateFn);
  };

  const removeLaborRow = (section: 'manufacturing' | 'coating' | 'packaging', id: string) => {
    const filterFn = (rows: LaborRow[]) => rows.filter(row => row.id !== id);
    
    if (section === 'manufacturing') setLaborManufacturing(filterFn);
    else if (section === 'coating') setLaborCoating(filterFn);
    else setLaborPackaging(filterFn);
  };

  // Utility line management
  const addUtilityLine = () => {
    setUtilitiesLines([...utilitiesLines, { id: generateId(), name: '', cost: 0 }]);
  };

  const updateUtilityLine = (id: string, field: keyof UtilityLine, value: string | number) => {
    setUtilitiesLines(lines =>
      lines.map(line => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const removeUtilityLine = (id: string) => {
    setUtilitiesLines(lines => lines.filter(line => line.id !== id));
  };

  // Save/Load handlers
  const handleSave = async (saveAs: boolean = false) => {
    if (!formula) return;
    
    const name = saveAs || !currentEstimateId ? estimateName.trim() : estimates.find(e => e.id === currentEstimateId)?.estimate_name || 'Untitled';
    
    if (!name) {
      setShowSaveDialog(true);
      return;
    }

    const totals: CostEstimateTotals = {
      rmSubtotal,
      laborManufacturing: laborManufacturingSubtotal,
      laborCoating: laborCoatingSubtotal,
      laborPackaging: laborPackagingSubtotal,
      laborTotal,
      utilitiesSubtotal,
      packagingMaterialsSubtotal,
      grandTotal,
      costPerBatch,
      gummiesPerBatch,
      bottleCount: effectiveBottleCount,
      isCustomBottleCount,
      packagingBottle: selectedBottle ? {
        id: selectedBottle.id,
        name: selectedBottle.name,
        unitCost: bottleUnitCost,
      } : undefined,
      packagingCap: selectedCap ? {
        id: selectedCap.id,
        name: selectedCap.name,
        unitCost: capUnitCost,
      } : undefined,
      laborScalingMode: 'flat',
      utilitiesScalingMode: utilitiesMode === 'percent' ? 'percent' : 'flat',
      laborMode,
      laborTotals: laborMode === 'total' ? {
        manufacturing: laborManufacturingTotal,
        coating: laborCoatingTotal,
        packaging: laborPackagingTotal,
      } : undefined,
    };

    const estimateData = {
      formula_id: formula.id,
      estimate_name: name,
      batches,
      rm_lines: rmLines,
      labor_manufacturing: laborManufacturing,
      labor_coating: laborCoating,
      labor_packaging: laborPackaging,
      utilities_mode: utilitiesMode,
      utilities_value: utilitiesMode === 'percent' ? { percent: utilitiesPercent } : { lines: utilitiesLines },
      totals,
    };

    const savedId = await saveEstimate(estimateData, saveAs ? undefined : currentEstimateId || undefined);
    if (savedId) {
      setCurrentEstimateId(savedId);
      setShowSaveDialog(false);
      setEstimateName('');
    }
  };

  // Save as default cost template for production schedule
  const handleSaveDefault = async () => {
    if (!formula) return;

    const totals: CostEstimateTotals = {
      rmSubtotal,
      laborManufacturing: laborManufacturingSubtotal,
      laborCoating: laborCoatingSubtotal,
      laborPackaging: laborPackagingSubtotal,
      laborTotal,
      utilitiesSubtotal,
      packagingMaterialsSubtotal,
      grandTotal,
      costPerBatch,
      gummiesPerBatch,
      bottleCount: effectiveBottleCount,
      isCustomBottleCount,
      packagingBottle: selectedBottle ? {
        id: selectedBottle.id,
        name: selectedBottle.name,
        unitCost: bottleUnitCost,
      } : undefined,
      packagingCap: selectedCap ? {
        id: selectedCap.id,
        name: selectedCap.name,
        unitCost: capUnitCost,
      } : undefined,
      laborScalingMode: 'flat',
      utilitiesScalingMode: utilitiesMode === 'percent' ? 'percent' : 'flat',
      laborMode,
      laborTotals: laborMode === 'total' ? {
        manufacturing: laborManufacturingTotal,
        coating: laborCoatingTotal,
        packaging: laborPackagingTotal,
      } : undefined,
    };

    await saveDefaultCostTemplate({
      formula_id: formula.id,
      estimate_name: 'Default Cost',
      batches: 1,
      rm_lines: rmLines,
      labor_manufacturing: laborManufacturing,
      labor_coating: laborCoating,
      labor_packaging: laborPackaging,
      utilities_mode: utilitiesMode,
      utilities_value: utilitiesMode === 'percent' ? { percent: utilitiesPercent } : { lines: utilitiesLines },
      totals,
    });
  };

  const loadEstimate = (estimate: CostEstimate) => {
    setBatches(estimate.batches);
    setLaborManufacturing(estimate.labor_manufacturing);
    setLaborCoating(estimate.labor_coating);
    setLaborPackaging(estimate.labor_packaging);
    
    // Restore labor mode
    const savedLaborMode = estimate.totals.laborMode || 'detailed';
    setLaborMode(savedLaborMode);
    if (savedLaborMode === 'total' && estimate.totals.laborTotals) {
      setLaborManufacturingTotal(estimate.totals.laborTotals.manufacturing || 0);
      setLaborCoatingTotal(estimate.totals.laborTotals.coating || 0);
      setLaborPackagingTotal(estimate.totals.laborTotals.packaging || 0);
    }
    
    setUtilitiesMode(estimate.utilities_mode);
    if (estimate.utilities_mode === 'percent') {
      setUtilitiesPercent(estimate.utilities_value.percent || 5);
    } else {
      setUtilitiesLines(estimate.utilities_value.lines || []);
    }
    setCurrentEstimateId(estimate.id);
    setGummiesPerBatch(estimate.totals.gummiesPerBatch ?? 43000);
    const isCustom = estimate.totals.isCustomBottleCount ?? false;
    setIsCustomBottleCount(isCustom);
    if (isCustom) {
      setCustomBottleCount(estimate.totals.bottleCount ?? 100);
    } else {
      setBottleCount(estimate.totals.bottleCount ?? 60);
    }
    
    // Restore packaging selections
    if (estimate.totals.packagingBottle) {
      setSelectedBottle(estimate.totals.packagingBottle);
      setBottleUnitCostOverride(estimate.totals.packagingBottle.unitCost);
    }
    if (estimate.totals.packagingCap) {
      setSelectedCap(estimate.totals.packagingCap);
      setCapUnitCostOverride(estimate.totals.packagingCap.unitCost);
    }
    
    setShowLoadDialog(false);
  };

  // Render labor section
  const renderLaborSection = (
    title: string,
    sectionKey: 'manufacturing' | 'coating' | 'packaging',
    rows: LaborRow[],
    subtotal: number
  ) => {
    const isExpanded = expandedSections[sectionKey];
    
    return (
      <Collapsible
        open={isExpanded}
        onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, [sectionKey]: open }))}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-medium">{title}</span>
            {rows.length > 0 && (
              <Badge variant="secondary" className="ml-2">{rows.length} row{rows.length !== 1 ? 's' : ''}</Badge>
            )}
          </div>
          <span className="font-semibold">{formatCurrency(subtotal)}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="space-y-2 pl-6">
            {rows.map(row => (
              <div key={row.id} className="flex items-center gap-2">
                <Input
                  placeholder="Employee/Role"
                  value={row.role}
                  onChange={(e) => updateLaborRow(sectionKey, row.id, 'role', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="$/hr"
                  value={row.payPerHour || ''}
                  onChange={(e) => updateLaborRow(sectionKey, row.id, 'payPerHour', parseFloat(e.target.value) || 0)}
                  className="w-24"
                />
                <Input
                  type="number"
                  placeholder="Hours"
                  value={row.hours || ''}
                  onChange={(e) => updateLaborRow(sectionKey, row.id, 'hours', parseFloat(e.target.value) || 0)}
                  className="w-20"
                />
                <span className="w-24 text-right font-medium">
                  {formatCurrency(row.payPerHour * row.hours)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLaborRow(sectionKey, row.id)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addLaborRow(sectionKey)}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  if (!formula) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="[--dialog-max-width:64rem] max-h-[min(calc(100vh-4rem),calc(100dvh-4rem))] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <DialogTitle className="flex items-center gap-2 min-w-0 flex-1">
              <Calculator className="h-5 w-5 shrink-0" />
              <span className="truncate">Cost Estimate — {formula.code}</span>
            </DialogTitle>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button 
                variant="default" 
                size="sm"
                onClick={handleSaveDefault}
                className="bg-primary"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Cost
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Estimates
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleSave(false)}>
                    <Save className="h-4 w-4 mr-2" />
                    {currentEstimateId ? 'Save Estimate' : 'Save New...'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
                    <Save className="h-4 w-4 mr-2" />
                    Save As...
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowLoadDialog(true)}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Load Previous
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
          {/* Warning Banner */}
          {missingCostCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="font-medium">{missingCostCount} material{missingCostCount !== 1 ? 's' : ''} missing cost data</span>
            </div>
          )}

          {/* Batches Input */}
          <div className="flex items-center gap-4">
            <Label htmlFor="batches" className="font-medium">Batches:</Label>
            <Input
              id="batches"
              type="number"
              min={0.1}
              step={0.1}
              value={batches}
              onChange={(e) => setBatches(parseFloat(e.target.value) || 1)}
              className="w-32"
            />
          </div>

          {/* Raw Materials Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Raw Materials</CardTitle>
            </CardHeader>
            <CardContent>
              {ingredientCosts.loading ? (
                <div className="text-center py-4 text-muted-foreground">Loading ingredient costs...</div>
              ) : (
                <>
                  <div className="w-full min-w-0 overflow-x-auto">
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
                        {rmLines.map((line, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium max-w-[200px] truncate">{line.materialName}</TableCell>
                            <TableCell className="text-right">{line.qtyPerBatch.toFixed(3)} {line.unit}</TableCell>
                            <TableCell className="text-right">
                              {line.hasCost ? (
                                `${formatCurrency(line.unitCost)}/kg`
                              ) : (
                                <span className="text-amber-600 flex items-center justify-end gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Missing cost
                                </span>
                              )}
                            </TableCell>
                            <TableCell className={cn("text-right font-medium", !line.hasCost && "text-muted-foreground")}>
                              {formatCurrency(line.extendedCost)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end mt-3 pt-3 border-t">
                    <span className="font-semibold">RM Subtotal: {formatCurrency(rmSubtotal)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Labor Sections */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Labor Costs</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={laborMode === 'detailed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLaborMode('detailed')}
                  >
                    Detailed
                  </Button>
                  <Button
                    variant={laborMode === 'total' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      // Pre-fill totals from detailed calculations when switching
                      if (laborMode === 'detailed') {
                        setLaborManufacturingTotal(calculateLaborSubtotal(laborManufacturing));
                        setLaborCoatingTotal(calculateLaborSubtotal(laborCoating));
                        setLaborPackagingTotal(calculateLaborSubtotal(laborPackaging));
                      }
                      setLaborMode('total');
                    }}
                  >
                    Total
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {laborMode === 'detailed' ? (
                <>
                  {renderLaborSection('Manufacturing Labor', 'manufacturing', laborManufacturing, laborManufacturingSubtotal)}
                  {renderLaborSection('Coating Labor', 'coating', laborCoating, laborCoatingSubtotal)}
                  {renderLaborSection('Packaging Labor', 'packaging', laborPackaging, laborPackagingSubtotal)}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Label className="w-40">Manufacturing Labor:</Label>
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={laborManufacturingTotal || ''}
                      onChange={(e) => setLaborManufacturingTotal(parseFloat(e.target.value) || 0)}
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <Label className="w-40">Coating Labor:</Label>
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={laborCoatingTotal || ''}
                      onChange={(e) => setLaborCoatingTotal(parseFloat(e.target.value) || 0)}
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <Label className="w-40">Packaging Labor:</Label>
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={laborPackagingTotal || ''}
                      onChange={(e) => setLaborPackagingTotal(parseFloat(e.target.value) || 0)}
                      className="w-32"
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end mt-3 pt-3 border-t">
                <span className="font-semibold">Total Labor: {formatCurrency(laborTotal)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Utilities Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Utilities / Overhead</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={utilitiesMode === 'percent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUtilitiesMode('percent')}
                  >
                    Percent
                  </Button>
                  <Button
                    variant={utilitiesMode === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUtilitiesMode('manual')}
                  >
                    Manual
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {utilitiesMode === 'percent' ? (
                <div className="flex items-center gap-4">
                  <Label htmlFor="overhead-percent">Overhead % (of RM + Labor):</Label>
                  <Input
                    id="overhead-percent"
                    type="number"
                    min={0}
                    step={0.5}
                    value={utilitiesPercent}
                    onChange={(e) => setUtilitiesPercent(parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">
                    = {formatCurrency(utilitiesSubtotal)}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {utilitiesLines.map(line => (
                    <div key={line.id} className="flex items-center gap-2">
                      <Input
                        placeholder="Name (Rent, Power, etc.)"
                        value={line.name}
                        onChange={(e) => updateUtilityLine(line.id, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Cost"
                        value={line.cost || ''}
                        onChange={(e) => updateUtilityLine(line.id, 'cost', parseFloat(e.target.value) || 0)}
                        className="w-32"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeUtilityLine(line.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addUtilityLine}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line
                  </Button>
                </div>
              )}
              <div className="flex justify-end mt-3 pt-3 border-t">
                <span className="font-semibold">Utilities Subtotal: {formatCurrency(utilitiesSubtotal)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Packaging Materials Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Packaging Materials (Bottles + Caps)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bottles used info */}
              <div className="text-sm text-muted-foreground">
                Bottles used for costing: <span className="font-medium text-foreground">{fullBottles.toLocaleString()}</span>
              </div>
              {fullBottles === 0 && (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Set batches + gummies/bottle count to calculate bottles.
                </div>
              )}

              {/* Bottle Selection */}
              <div className="space-y-2">
                <Label>Bottle</Label>
                <div className="flex items-center gap-4">
                  <Select
                    value={selectedBottle?.id || selectedBottle?.name || ''}
                    onValueChange={(val) => {
                      const option = bottleOptions.find(b => b.id === val || b.name === val);
                      if (option) {
                        setSelectedBottle(option);
                        setBottleUnitCostOverride(null);
                      }
                    }}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select bottle type" />
                    </SelectTrigger>
                    <SelectContent>
                      {bottleOptions.map(opt => (
                        <SelectItem key={opt.id || opt.name} value={opt.id || opt.name}>
                          {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">@ $</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={bottleUnitCost}
                      onChange={(e) => setBottleUnitCostOverride(parseFloat(e.target.value) || 0)}
                      className="w-20 h-8"
                    />
                  </div>
                  
                  <span className="font-medium ml-auto">
                    {formatCurrency(bottleTotal)}
                  </span>
                </div>
                {selectedBottle && bottleUnitCost === 0 && (
                  <span className="text-xs text-amber-600">Missing cost - enter unit price</span>
                )}
              </div>

              {/* Cap Selection */}
              <div className="space-y-2">
                <Label>Cap</Label>
                <div className="flex items-center gap-4">
                  <Select
                    value={selectedCap?.id || selectedCap?.name || ''}
                    onValueChange={(val) => {
                      const option = capOptions.find(c => c.id === val || c.name === val);
                      if (option) {
                        setSelectedCap(option);
                        setCapUnitCostOverride(null);
                      }
                    }}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select cap type" />
                    </SelectTrigger>
                    <SelectContent>
                      {capOptions.map(opt => (
                        <SelectItem key={opt.id || opt.name} value={opt.id || opt.name}>
                          {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">@ $</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={capUnitCost}
                      onChange={(e) => setCapUnitCostOverride(parseFloat(e.target.value) || 0)}
                      className="w-20 h-8"
                    />
                  </div>
                  
                  <span className="font-medium ml-auto">
                    {formatCurrency(capTotal)}
                  </span>
                </div>
                {selectedCap && capUnitCost === 0 && (
                  <span className="text-xs text-amber-600">Missing cost - enter unit price</span>
                )}
              </div>

              {/* Subtotal */}
              <div className="flex justify-end mt-3 pt-3 border-t">
                <span className="font-semibold">Packaging Materials Subtotal: {formatCurrency(packagingMaterialsSubtotal)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Totals Summary */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Totals Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-2">
                <span>RM Subtotal</span>
                <span className="text-right">{formatCurrency(rmSubtotal)}</span>
                
                <span>Manufacturing Labor</span>
                <span className="text-right">{formatCurrency(laborManufacturingSubtotal)}</span>
                
                <span>Coating Labor</span>
                <span className="text-right">{formatCurrency(laborCoatingSubtotal)}</span>
                
                <span>Packaging Labor</span>
                <span className="text-right">{formatCurrency(laborPackagingSubtotal)}</span>
                
                <span className="font-medium">Total Labor</span>
                <span className="text-right font-medium">{formatCurrency(laborTotal)}</span>
                
                <span>Utilities/Overhead</span>
                <span className="text-right">{formatCurrency(utilitiesSubtotal)}</span>
                
                <span>Packaging Materials</span>
                <span className="text-right">{formatCurrency(packagingMaterialsSubtotal)}</span>
                
                <div className="col-span-2 border-t my-2"></div>
                
                <span className="text-lg font-bold">GRAND TOTAL</span>
                <span className="text-right text-lg font-bold text-primary">{formatCurrency(grandTotal)}</span>
                
                <span className="text-muted-foreground">Cost per Batch</span>
                <span className="text-right text-muted-foreground">{formatCurrency(costPerBatch)}</span>

                <span className="text-muted-foreground">Cost per Gummy</span>
                <span className="text-right text-muted-foreground">
                  {costPerGummyCents !== null ? `${costPerGummyCents.toFixed(2)}¢` : '—'}
                </span>

                {/* Cost per Bottle Section */}
                <div className="col-span-2 border-t my-3"></div>
                <span className="col-span-2 font-semibold text-base">Cost per Bottle</span>

                {/* Gummies per Batch Input */}
                <span className="text-sm">Gummies per batch</span>
                <div className="flex justify-end">
                  <Input
                    type="number"
                    value={gummiesPerBatch}
                    onChange={(e) => setGummiesPerBatch(parseInt(e.target.value) || 0)}
                    className="w-28 h-8 text-sm text-right"
                    min={0}
                  />
                </div>
                <span className="col-span-2 text-xs text-muted-foreground -mt-1 mb-1">
                  Example: 1 batch = 43,000 gummies
                </span>

                {/* Total Gummies (auto) */}
                <span className="text-sm">Total gummies</span>
                <span className="text-right font-medium">
                  {totalGummies.toLocaleString()}
                </span>

                {/* Bottle Count Dropdown */}
                <span className="text-sm">Bottle count (ct)</span>
                <div className="flex justify-end gap-2">
                  {isCustomBottleCount ? (
                    <>
                      <Input
                        type="number"
                        className="w-20 h-8 text-sm"
                        value={customBottleCount}
                        onChange={(e) => setCustomBottleCount(parseInt(e.target.value) || 0)}
                        min={1}
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2 text-xs"
                        onClick={() => setIsCustomBottleCount(false)}
                      >
                        Standard
                      </Button>
                    </>
                  ) : (
                    <Select 
                      value={bottleCount.toString()} 
                      onValueChange={(v) => {
                        if (v === 'custom') {
                          setIsCustomBottleCount(true);
                        } else {
                          setBottleCount(parseInt(v));
                        }
                      }}
                    >
                      <SelectTrigger className="w-20 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">60</SelectItem>
                        <SelectItem value="70">70</SelectItem>
                        <SelectItem value="90">90</SelectItem>
                        <SelectItem value="120">120</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Exact Bottles */}
                <span className="text-sm">Exact bottles</span>
                <span className="text-right text-muted-foreground">
                  {exactBottles.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>

                {/* Full Bottles (rounded) */}
                <span className="text-sm font-medium">Full bottles</span>
                <span className="text-right font-medium">
                  {fullBottles.toLocaleString()}
                </span>

                {/* Leftover Gummies Warning */}
                {leftoverGummies > 0 && (
                  <span className="col-span-2 text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Leftover gummies: {leftoverGummies.toLocaleString()} (not included in bottle count)
                  </span>
                )}

                {/* Cost per Bottle Result */}
                <span className="text-lg font-bold">Cost per Bottle</span>
                <span className="text-right text-lg font-bold text-primary">
                  {costPerBottle !== null ? formatCurrency(costPerBottle) : '—'}
                </span>

                {/* Cost per Gummy Result */}
                <span className="text-sm font-medium">Cost per Gummy</span>
                <span className="text-right text-sm font-medium text-primary">
                  {costPerGummyCents !== null ? `${costPerGummyCents.toFixed(2)}¢` : '—'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
            <Card className="w-96">
              <CardHeader>
                <CardTitle>Save Estimate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="estimate-name">Estimate Name</Label>
                  <Input
                    id="estimate-name"
                    value={estimateName}
                    onChange={(e) => setEstimateName(e.target.value)}
                    placeholder="e.g., Q1 2024 Estimate"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => handleSave(true)} disabled={!estimateName.trim()}>
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Load Dialog */}
        {showLoadDialog && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
            <Card className="w-[500px] max-h-[60vh]">
              <CardHeader>
                <CardTitle>Load Previous Estimate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 overflow-y-auto max-h-[400px]">
                {estimates.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No saved estimates for this formula.</p>
                ) : (
                  estimates.map(estimate => (
                    <div
                      key={estimate.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => loadEstimate(estimate)}
                    >
                      <div>
                        <p className="font-medium">{estimate.estimate_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {estimate.batches} batch{estimate.batches !== 1 ? 'es' : ''} • {formatCurrency(estimate.totals.grandTotal)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEstimate(estimate.id);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
                <div className="flex justify-end pt-4">
                  <Button variant="outline" onClick={() => setShowLoadDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
