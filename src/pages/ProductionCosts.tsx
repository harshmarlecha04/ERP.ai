import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { DollarSign, Calculator, Download, Loader2, CheckCircle2, Search, ChevronDown, ChevronRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";
import { FinancialAccessDenied } from "@/components/access-control/FinancialAccessDenied";
import { formatET } from "@/utils/dateUtils";

interface Formula {
  id: string;
  code: string;
  name: string;
  gummies_per_batch: number | null;
  customer_id: string | null;
  customer_name: string | null;
}

interface RowInputState {
  formulaId: string;
  numberOfBottles: string;
  countSize: string;
  customCountSize: string;
  gummiesPerBatch: string;
  // Results
  calculated: boolean;
  isCalculating: boolean;
  totalGummies: number;
  numberOfBatches: number;
  totalProductionCost: number;
  costPerBottle: number;
  baseCostPerBatch: number;
}

const COUNT_SIZE_OPTIONS = ["60", "70", "90", "120", "custom"];

export default function ProductionCosts() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [costEstimates, setCostEstimates] = useState<Record<string, { costPerBatch: number; gummiesPerBatch?: number }>>({});
  const [rowStates, setRowStates] = useState<Record<string, RowInputState>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { canAccessFinancialData, loading: rolesLoading } = useUserRoles();

  // Load formulas and their default cost estimates
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Get accessible formulas
        const { data: formulasData, error: formulasError } = await supabase
          .rpc('get_accessible_formulas');

        if (formulasError) throw formulasError;

        // Get customer IDs and fetch customer names
        const customerIds = (formulasData || [])
          .map((f: any) => f.customer_id)
          .filter((id: string | null) => id !== null);

        let customerMap: Record<string, string> = {};
        if (customerIds.length > 0) {
          const { data: customersData } = await supabase
            .from('customers')
            .select('id, company_name')
            .in('id', customerIds);
          
          customerMap = Object.fromEntries(
            (customersData || []).map(c => [c.id, c.company_name])
          );
        }

        const accessibleFormulas: Formula[] = (formulasData || []).map((f: any) => ({
          id: f.id,
          code: f.code,
          name: f.name,
          gummies_per_batch: f.gummies_per_batch,
          customer_id: f.customer_id,
          customer_name: f.customer_id ? customerMap[f.customer_id] || null : null
        }));

        setFormulas(accessibleFormulas);
        
        // Groups start collapsed - users expand manually

        // Get default cost estimates for all formulas
        if (accessibleFormulas.length > 0) {
          const formulaIds = accessibleFormulas.map(f => f.id);
          const { data: estimatesData } = await supabase
            .from('formula_cost_estimates')
            .select('formula_id, totals, batches')
            .in('formula_id', formulaIds)
            .eq('is_default', true);

          const estimatesMap: Record<string, { costPerBatch: number; gummiesPerBatch?: number }> = {};
          (estimatesData || []).forEach((est: any) => {
            const totals = est.totals || {};
            estimatesMap[est.formula_id] = {
              costPerBatch: totals.costPerBatch || 0,
              gummiesPerBatch: totals.gummiesPerBatch
            };
          });
          setCostEstimates(estimatesMap);

          // Initialize row states
          const initialStates: Record<string, RowInputState> = {};
          accessibleFormulas.forEach(formula => {
            const estimate = estimatesMap[formula.id];
            const defaultGummies = formula.gummies_per_batch || 
              estimate?.gummiesPerBatch || 
              43000;
            
            initialStates[formula.id] = {
              formulaId: formula.id,
              numberOfBottles: "",
              countSize: "60",
              customCountSize: "",
              gummiesPerBatch: String(defaultGummies),
              calculated: false,
              isCalculating: false,
              totalGummies: 0,
              numberOfBatches: 0,
              totalProductionCost: 0,
              costPerBottle: 0,
              baseCostPerBatch: estimate?.costPerBatch || 0
            };
          });
          setRowStates(initialStates);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load formulas");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);


  // Update a single row's input
  const updateRowInput = useCallback((formulaId: string, field: keyof RowInputState, value: string | number | boolean) => {
    setRowStates(prev => ({
      ...prev,
      [formulaId]: {
        ...prev[formulaId],
        [field]: value,
        // Reset calculated state when inputs change
        ...(field !== 'calculated' && field !== 'isCalculating' ? { calculated: false } : {})
      }
    }));
  }, []);

  // Calculate cost per batch from recipe if no saved estimate exists
  const calculateCostPerBatchFromRecipe = async (formulaId: string): Promise<number> => {
    const { data: formulaData } = await supabase
      .from('formulas')
      .select('recipe_json')
      .eq('id', formulaId)
      .single();

    if (!formulaData?.recipe_json || !Array.isArray(formulaData.recipe_json)) {
      return 0;
    }

    let recipeCost = 0;

    // Get all raw materials for matching
    const { data: allMaterials } = await supabase
      .from('raw_materials')
      .select('id, name, supplier')
      .eq('is_archived', false);

    for (const ingredientRaw of formulaData.recipe_json) {
      // Cast to proper type for accessing properties
      const ingredient = ingredientRaw as Record<string, unknown>;
      const ingredientName = (ingredient.materialName as string) || (ingredient.name as string);
      if (!ingredientName) continue;

      let materialName = ingredientName;
      let supplierName: string | null = null;

      // Parse supplier from name if present
      const supplierMatch = ingredientName.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (supplierMatch) {
        materialName = supplierMatch[1].trim();
        supplierName = supplierMatch[2].trim();
      }

      // Find matching material
      let material = null;
      if (supplierName) {
        material = allMaterials?.find(m =>
          m.name.toLowerCase() === materialName.toLowerCase() &&
          m.supplier?.toLowerCase() === supplierName.toLowerCase()
        );
      }

      if (!material) {
        material = allMaterials?.find(m =>
          m.name.toLowerCase() === materialName.toLowerCase()
        );
      }

      if (!material) continue;

      // Get latest lot cost
      const { data: lots } = await supabase
        .from('raw_material_lots')
        .select('cost, quantity')
        .eq('raw_material_id', material.id)
        .gt('quantity', 0)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lots && lots.length > 0 && lots[0].cost) {
        const qtyPerBatch = parseFloat(String(ingredient.weightKg || 0));
        recipeCost += qtyPerBatch * lots[0].cost;
      }
    }

    return recipeCost;
  };

  // Calculate cost for a row
  const calculateRowCost = useCallback(async (formulaId: string) => {
    const state = rowStates[formulaId];
    if (!state) return;

    // Get the actual count size
    const countSize = state.countSize === "custom" 
      ? parseFloat(state.customCountSize) 
      : parseFloat(state.countSize);
    
    const numberOfBottles = parseFloat(state.numberOfBottles);
    const gummiesPerBatch = parseFloat(state.gummiesPerBatch);

    // Validation
    if (!numberOfBottles || numberOfBottles <= 0) {
      toast.error("Number of bottles must be greater than 0");
      return;
    }
    if (!countSize || countSize <= 0) {
      toast.error("Count size must be greater than 0");
      return;
    }
    if (!gummiesPerBatch || gummiesPerBatch <= 0) {
      toast.error("Gummies per batch must be greater than 0");
      return;
    }

    // Set calculating state
    updateRowInput(formulaId, 'isCalculating', true);

    try {
      // Step 1: Total Gummies = Number of Bottles × Count Size
      const totalGummies = numberOfBottles * countSize;

      // Step 2: Number of Batches = Total Gummies / Gummies per Batch (round up)
      const numberOfBatches = Math.ceil(totalGummies / gummiesPerBatch);

      // Step 3: Get base cost per batch
      let baseCostPerBatch = state.baseCostPerBatch;
      
      // If no saved estimate, calculate from recipe
      if (!baseCostPerBatch || baseCostPerBatch === 0) {
        baseCostPerBatch = await calculateCostPerBatchFromRecipe(formulaId);
      }

      // Step 4: Total Production Cost = Number of Batches × Cost per Batch
      const totalProductionCost = numberOfBatches * baseCostPerBatch;

      // Step 5: Cost per Bottle = Total Production Cost / Number of Bottles
      const costPerBottle = numberOfBottles > 0 ? totalProductionCost / numberOfBottles : 0;

      // Update state with results
      setRowStates(prev => ({
        ...prev,
        [formulaId]: {
          ...prev[formulaId],
          calculated: true,
          isCalculating: false,
          totalGummies,
          numberOfBatches,
          totalProductionCost,
          costPerBottle,
          baseCostPerBatch
        }
      }));

      toast.success(`Calculated: ${numberOfBatches} batch${numberOfBatches !== 1 ? 'es' : ''} needed`);
    } catch (error) {
      console.error("Calculation error:", error);
      toast.error("Failed to calculate cost");
      updateRowInput(formulaId, 'isCalculating', false);
    }
  }, [rowStates, updateRowInput]);

  // Export to CSV
  const handleExport = () => {
    const headers = [
      "Product Code",
      "Formula Name",
      "Number of Bottles",
      "Count Size",
      "Gummies per Batch",
      "Total Gummies",
      "Number of Batches",
      "Cost per Batch",
      "Total Production Cost",
      "Cost per Bottle"
    ];

    const rows = formulas
      .filter(f => rowStates[f.id]?.calculated)
      .map(formula => {
        const state = rowStates[formula.id];
        const countSize = state.countSize === "custom" ? state.customCountSize : state.countSize;
        return [
          formula.code,
          formula.name,
          state.numberOfBottles,
          countSize,
          state.gummiesPerBatch,
          state.totalGummies,
          state.numberOfBatches,
          state.baseCostPerBatch.toFixed(2),
          state.totalProductionCost.toFixed(2),
          state.costPerBottle.toFixed(4)
        ];
      });

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production-costs-${formatET(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

  // Filter formulas based on search
  const filteredFormulas = useMemo(() => {
    if (!searchQuery.trim()) return formulas;
    const query = searchQuery.toLowerCase();
    return formulas.filter(f =>
      f.code.toLowerCase().includes(query) ||
      f.name.toLowerCase().includes(query) ||
      (f.customer_name?.toLowerCase() || '').includes(query)
    );
  }, [formulas, searchQuery]);

  // Group formulas by company name
  const groupedFormulas = useMemo(() => {
    const groups: Record<string, Formula[]> = {};
    filteredFormulas.forEach(formula => {
      const groupName = formula.customer_name || "Uncategorized";
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(formula);
    });
    // Sort groups alphabetically, but keep "Uncategorized" at the end
    const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
    return sortedGroups;
  }, [filteredFormulas]);

  // Toggle group expansion
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // Summary stats
  const calculatedCount = Object.values(rowStates).filter(r => r.calculated).length;
  const totalEstimatedCost = Object.values(rowStates)
    .filter(r => r.calculated)
    .reduce((sum, r) => sum + r.totalProductionCost, 0);

  if (rolesLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccessFinancialData()) {
    return (
      <div className="p-6">
        <FinancialAccessDenied feature="Production Costs" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            Production Costs
          </h1>
          <p className="text-muted-foreground">
            Estimate production costs by bottle quantity
          </p>
        </div>
        <Button onClick={handleExport} disabled={calculatedCount === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Formulas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formulas.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Calculated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {calculatedCount} / {formulas.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Estimated Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ${totalEstimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Calculator</CardTitle>
          <CardDescription>
            Enter bottle quantities and count sizes to calculate production costs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by product code, formula name, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Grouped Tables */}
          {groupedFormulas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-md">
              {searchQuery ? "No formulas match your search" : "No formulas available"}
            </div>
          ) : (
            <div className="space-y-3">
              {groupedFormulas.map(([groupName, groupFormulas]) => (
                <Collapsible
                  key={groupName}
                  open={expandedGroups.has(groupName)}
                  onOpenChange={() => toggleGroup(groupName)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between px-4 py-3 h-auto hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        {expandedGroups.has(groupName) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-semibold">{groupName}</span>
                        <Badge variant="secondary" className="ml-2">
                          {groupFormulas.length} formula{groupFormulas.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="rounded-md border mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">Product Code</TableHead>
                            <TableHead className="w-[200px]">Formula Name</TableHead>
                            <TableHead className="w-[120px]"># of Bottles</TableHead>
                            <TableHead className="w-[160px]">Count Size</TableHead>
                            <TableHead className="w-[140px]">Gummies/Batch</TableHead>
                            <TableHead className="w-[80px]">Action</TableHead>
                            <TableHead>Results</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupFormulas.map(formula => {
                            const state = rowStates[formula.id];
                            if (!state) return null;

                            return (
                              <TableRow key={formula.id} className={state.calculated ? "bg-green-50 dark:bg-green-950/20" : ""}>
                                <TableCell className="font-mono text-sm font-medium">
                                  {formula.code}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formula.name}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="1"
                                    placeholder="Enter qty"
                                    value={state.numberOfBottles}
                                    onChange={(e) => updateRowInput(formula.id, 'numberOfBottles', e.target.value)}
                                    className="w-full"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Select
                                      value={state.countSize}
                                      onValueChange={(value) => updateRowInput(formula.id, 'countSize', value)}
                                    >
                                      <SelectTrigger className="w-[90px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {COUNT_SIZE_OPTIONS.map(opt => (
                                          <SelectItem key={opt} value={opt}>
                                            {opt === "custom" ? "Custom" : opt}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {state.countSize === "custom" && (
                                      <Input
                                        type="number"
                                        min="1"
                                        placeholder="Size"
                                        value={state.customCountSize}
                                        onChange={(e) => updateRowInput(formula.id, 'customCountSize', e.target.value)}
                                        className="w-[70px]"
                                      />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="1"
                                    placeholder="Gummies"
                                    value={state.gummiesPerBatch}
                                    onChange={(e) => updateRowInput(formula.id, 'gummiesPerBatch', e.target.value)}
                                    className="w-full"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    onClick={() => calculateRowCost(formula.id)}
                                    disabled={state.isCalculating}
                                  >
                                    {state.isCalculating ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Calculator className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TableCell>
                                <TableCell>
                                  {state.calculated ? (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <span className="text-sm font-medium">
                                          {state.numberOfBatches} batch{state.numberOfBatches !== 1 ? 'es' : ''}
                                        </span>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        Total: <span className="font-semibold text-foreground">
                                          ${state.totalProductionCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        Per bottle: <span className="font-semibold text-foreground">
                                          ${state.costPerBottle.toFixed(4)}
                                        </span>
                                      </div>
                                      {state.baseCostPerBatch === 0 && (
                                        <Badge variant="outline" className="text-xs w-fit text-amber-600 border-amber-300">
                                          No cost data
                                        </Badge>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
