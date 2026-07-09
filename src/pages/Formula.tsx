import React, { useState, useMemo } from "react";
import { Plus, Trash2, Copy, Download, MoreVertical, Search, X, Check, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddFormulaModal } from "@/components/formula/AddFormulaModal";
import { FormulaCostEstimatorModal } from "@/components/formula/FormulaCostEstimatorModal";
import { useFormulas, type FormulaInput } from "@/hooks/useFormulas";
import { useBatchCalculation } from "@/hooks/useBatchCalculation";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AccessDenied } from "@/components/security/AccessDenied";
import { generateFormulaPDF } from "@/utils/formulaPdfGenerator";
import { useToast } from "@/hooks/use-toast";
import { TradeSecretWarning } from "@/components/security/TradeSecretWarning";
import { SecurityStatusIndicator } from "@/components/security/SecurityStatusIndicator";
import { FileText, Pencil, Eye } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { BatchCalculationDisplay } from "@/components/formula/BatchCalculationDisplay";
import { GenerateCOAModal } from "@/components/formula/GenerateCOAModal";
import { Award } from "lucide-react";

const Formula = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { formulas, loading, saveFormula, deleteFormula, transformFormulaForEdit, refreshFormulas } = useFormulas();
  const { customers } = useCustomers();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<any | null>(null);
  const [costEstimatorFormula, setCostEstimatorFormula] = useState<any | null>(null);
  const [coaFormula, setCoaFormula] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [selectedFormulaIds, setSelectedFormulaIds] = useState<Set<string>>(new Set());
  const [bulkAssignCustomerId, setBulkAssignCustomerId] = useState<string>("");
  
  // Filter formulas based on search term and customer
  const filteredFormulas = useMemo(() => {
    let filtered = formulas;
    
    // Filter by customer
    if (selectedCustomerId && selectedCustomerId !== "all") {
      filtered = filtered.filter(formula => 
        selectedCustomerId === "internal" 
          ? !formula.customer_id 
          : formula.customer_id === selectedCustomerId
      );
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(formula => 
        formula.code.toLowerCase().includes(search) ||
        formula.name.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [formulas, searchTerm, selectedCustomerId]);
  
  // Check if any visible formulas are trade secrets
  const hasTradeSecretFormulas = filteredFormulas.some(formula => 
    (formula.security_level || '').toLowerCase() === 'trade_secret'
  );
  
  // Check if user is authenticated - with the new security model, 
  // authenticated users can access this page but will only see formulas they have permissions for
  if (!user) {
    return <AccessDenied resource="formulas" />;
  }

  const handleDeleteFormula = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this formula?')) {
      try {
        await deleteFormula(id);
      } catch (error) {
        // Error handled in hook
      }
    }
  };

  const handleDuplicateFormula = async (formula: any) => {
    const transformedFormula = transformFormulaForEdit(formula);
    // Create a new code by appending "-COPY" and timestamp
    const timestamp = Date.now().toString().slice(-4);
    transformedFormula.productCode = `${transformedFormula.productCode}-COPY-${timestamp}`;
    transformedFormula.productNameFlavor = `${transformedFormula.productNameFlavor} (Copy)`;
    // Remove the ID to create a new formula
    delete transformedFormula.id;
    
    try {
      await saveFormula(transformedFormula, undefined, 'draft');
    } catch (error) {
      // Error handled in hook
    }
  };

  const openEditModal = (formula: any) => {
    console.log('🔍 openEditModal called with raw formula:', formula);
    console.log('🔍 Raw formula recipe_json:', formula.recipe_json);
    const transformedFormula = transformFormulaForEdit(formula);
    console.log('🔍 Transformed formula result:', transformedFormula);
    setEditingFormula(transformedFormula);
  };

  const handleDownloadPDF = async (formula: any) => {
    try {
      toast({
        title: "Generating PDF",
        description: "Creating manufacturing formula PDF...",
      });
      
      // Resolve active ingredient material names from DB before PDF generation
      let enrichedFormula = formula;
      const activeIngredients = formula.active_ingredients_json as any[];
      if (activeIngredients?.length > 0) {
        // Extract material IDs: compound UUID format is {uuid}-{uuid} (73 chars)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const materialIds = [...new Set(
          activeIngredients
            .map((ai: any) => {
              if (!ai.name) return null;
              const candidate = ai.name.length > 36 ? ai.name.substring(0, 36) : ai.name;
              return uuidRegex.test(candidate) ? candidate : null;
            })
            .filter(Boolean) as string[]
        )];
        
        if (materialIds.length > 0) {
          const { data: materials } = await supabase
            .from('raw_materials')
            .select('id, name')
            .in('id', materialIds);
          
          if (materials?.length) {
            const materialNameMap: Record<string, string> = {};
            materials.forEach((m: any) => { materialNameMap[m.id] = m.name; });
            
            const enrichedActiveIngredients = activeIngredients.map((ai: any) => {
              const candidate = ai.name?.length > 36 ? ai.name.substring(0, 36) : ai.name;
              const resolvedName = (candidate && uuidRegex.test(candidate)) ? materialNameMap[candidate] : undefined;
              return { ...ai, materialName: resolvedName || ai.materialName, ingredient_name: resolvedName || ai.ingredient_name };
            });
            enrichedFormula = { ...formula, active_ingredients_json: enrichedActiveIngredients };
          }
        }
      }
      
      generateFormulaPDF(enrichedFormula);
      
      toast({
        title: "PDF Downloaded",
        description: `Formula ${formula.code} has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Download Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleFormulaSelection = (formulaId: string) => {
    setSelectedFormulaIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(formulaId)) {
        newSet.delete(formulaId);
      } else {
        newSet.add(formulaId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFormulaIds.size === filteredFormulas.length) {
      setSelectedFormulaIds(new Set());
    } else {
      setSelectedFormulaIds(new Set(filteredFormulas.map(f => f.id)));
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignCustomerId || selectedFormulaIds.size === 0) return;

    try {
      const customerId = bulkAssignCustomerId === "internal" ? null : bulkAssignCustomerId;
      
      const updates = Array.from(selectedFormulaIds).map(id => 
        supabase
          .from('formulas')
          .update({ customer_id: customerId })
          .eq('id', id)
      );

      await Promise.all(updates);

      toast({
        title: "Success",
        description: `${selectedFormulaIds.size} formula(s) assigned to ${bulkAssignCustomerId === "internal" ? "Internal" : customers.find(c => c.id === bulkAssignCustomerId)?.company_name}`,
      });

      setSelectedFormulaIds(new Set());
      setBulkAssignCustomerId("");
      refreshFormulas();
    } catch (error) {
      console.error('Error bulk assigning:', error);
      toast({
        title: "Error",
        description: "Failed to assign formulas. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Formula Table Row Component
  const FormulaTableRow = ({ formula }: { formula: any }) => {
    return (
      <TableRow className="hover:bg-muted/50">
        {/* Checkbox */}
        <TableCell className="w-[50px]">
          <Checkbox
            checked={selectedFormulaIds.has(formula.id)}
            onCheckedChange={() => toggleFormulaSelection(formula.id)}
          />
        </TableCell>

        {/* Product Code */}
        <TableCell className="font-mono font-semibold">
          <div className="flex items-center gap-2">
            {formula.code}
            {formula.status === 'draft' && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                DRAFT
              </span>
            )}
          </div>
        </TableCell>

        {/* Product Name */}
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-medium">{formula.name}</span>
            {formula.customer_id ? (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {customers.find(c => c.id === formula.customer_id)?.company_name || 'Customer'}
              </span>
            ) : (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                Internal
              </span>
            )}
            <SecurityStatusIndicator 
              securityLevel={formula.security_level} 
              size="sm" 
            />
          </div>
        </TableCell>

        {/* Batch Size */}
        <TableCell className="text-right font-medium">
          {formula.default_batch_size_kg} kg
        </TableCell>

        {/* Can Make */}
        <TableCell className="text-right">
          <BatchCalculationDisplay 
            formulaId={formula.id}
            formulaName={formula.name}
            variant="inline"
          />
        </TableCell>

        {/* Actions */}
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border border-border shadow-lg z-50">
              <DropdownMenuItem onClick={() => navigate(`/formula/view/${formula.id}`)}>
                <Eye className="h-4 w-4 mr-2" />
                View Formula
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadPDF(formula)}>
                <FileText className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCostEstimatorFormula(formula)}>
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Cost
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCoaFormula(formula)}>
                <Award className="h-4 w-4 mr-2" />
                Generate COA
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openEditModal(formula)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Formula
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDuplicateFormula(formula)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate Formula
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDeleteFormula(formula.id)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Formula
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b border-border/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Formula Management
                </h1>
                <p className="text-lg text-muted-foreground/80">
                  Manage product formulas and recipes with precision - access is controlled based on security clearance
                </p>
              </div>
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 transition-all duration-200 flex items-center gap-2 px-6 py-3 text-base font-medium"
              >
                <Plus className="h-5 w-5" />
                Add New Formula
              </Button>
            </div>
            
            {/* Search and Filter Bar */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by product code or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
                />
              </div>
              
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="w-[240px] bg-background/50 border-border/50">
                  <SelectValue placeholder="Filter by customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Formulas</SelectItem>
                  <SelectItem value="internal">Internal/Generic</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filteredFormulas.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="whitespace-nowrap"
                >
                  <Checkbox 
                    checked={selectedFormulaIds.size === filteredFormulas.length && filteredFormulas.length > 0}
                    className="mr-2"
                  />
                  Select All
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-8">
        
        {/* Bulk Action Toolbar */}
        {selectedFormulaIds.size > 0 && (
          <div className="sticky top-4 z-10 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg shadow-lg p-4 animate-in slide-in-from-top">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5" />
                <span className="font-semibold">
                  {selectedFormulaIds.size} formula{selectedFormulaIds.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <Select value={bulkAssignCustomerId} onValueChange={setBulkAssignCustomerId}>
                  <SelectTrigger className="w-[240px] bg-background text-foreground">
                    <SelectValue placeholder="Assign to customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal/Generic</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  onClick={handleBulkAssign}
                  disabled={!bulkAssignCustomerId}
                  className="bg-background text-foreground hover:bg-background/90"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Assign
                </Button>
                
                <Button
                  onClick={() => setSelectedFormulaIds(new Set())}
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Security Notice for Trade Secrets - Only show if trade secret formulas are visible */}
        {hasTradeSecretFormulas && <TradeSecretWarning securityLevel="trade_secret" />}

        {/* Formulas List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="ml-4 text-muted-foreground text-lg">Loading accessible formulas...</p>
          </div>
        ) : filteredFormulas.length === 0 ? (
          <div className="text-center py-16 space-y-6">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
              <Search className="w-12 h-12 text-primary/60" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                {searchTerm 
                  ? "No formulas found" 
                  : selectedCustomerId !== "all"
                    ? "No formulas for this customer"
                    : "No accessible formulas found"
                }
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {searchTerm 
                  ? `No formulas match "${searchTerm}". Try a different search term.`
                  : selectedCustomerId !== "all"
                    ? selectedCustomerId === "internal"
                      ? "No internal/generic formulas found. All formulas are assigned to specific customers."
                      : `This customer doesn't have any formulas assigned yet. Create a new formula and assign it to ${customers.find(c => c.id === selectedCustomerId)?.company_name || 'this customer'}.`
                    : "You may not have access to any formulas yet, or none have been created. Contact your administrator for access to specific formulas if needed."
                }
              </p>
            </div>
            {!searchTerm && selectedCustomerId === "all" && (
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 transition-all duration-200 flex items-center gap-2 px-6 py-3"
              >
                <Plus className="h-4 w-4" />
                Create Your First Formula
              </Button>
            )}
          </div>
        ) : (
          <div className="border rounded-lg bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedFormulaIds.size === filteredFormulas.length && filteredFormulas.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[200px]">Product Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="w-[140px] text-right">Batch Size</TableHead>
                  <TableHead className="w-[120px] text-right">Can Make</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFormulas.map((formula) => (
                  <FormulaTableRow key={formula.id} formula={formula} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add Formula Modal */}
        <AddFormulaModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={refreshFormulas}
        />

        {/* Edit Formula Modal */}
        {editingFormula && (
          <AddFormulaModal
            isOpen={true}
            onClose={() => setEditingFormula(null)}
            onSave={refreshFormulas}
            editingFormula={editingFormula}
          />
        )}

        {/* Cost Estimator Modal */}
        <FormulaCostEstimatorModal
          isOpen={!!costEstimatorFormula}
          onClose={() => setCostEstimatorFormula(null)}
          formula={costEstimatorFormula}
        />
        {coaFormula && (
          <GenerateCOAModal
            formula={coaFormula}
            open={!!coaFormula}
            onOpenChange={(o) => !o && setCoaFormula(null)}
          />
        )}
      </div>
    </div>
  );
};

export default Formula;