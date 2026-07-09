import React, { useState, useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calculator, Download, DollarSign, ChevronDown, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { useFormulas } from "@/hooks/useFormulas";
import { useCustomers } from "@/hooks/useCustomers";
import { useFormulaIngredientCosts } from "@/hooks/useFormulaIngredientCosts";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatET } from "@/utils/dateUtils";

const CT_OPTIONS = [60, 90, 120, 150, 180, 240];
const UTILITY_PERCENT = 5;
const MARGIN_PERCENT = 30;

export default function Quoting() {
  const { formulas, loading: formulasLoading } = useFormulas();
  const { customers, isLoading: customersLoading } = useCustomers();
  const { toast } = useToast();

  // Form state
  const [selectedFormula, setSelectedFormula] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [numberOfBottles, setNumberOfBottles] = useState<string>("");
  const [ctPerBottle, setCtPerBottle] = useState<string>("60");
  const [bottleCost, setBottleCost] = useState<string>("");
  const [capCost, setCapCost] = useState<string>("");
  const [packagingCost, setPackagingCost] = useState<string>("");
  const [batchesPlanned, setBatchesPlanned] = useState<string>("");
  const [showIngredientBreakdown, setShowIngredientBreakdown] = useState(false);

  const selectedFormulaData = formulas.find(f => f.id === selectedFormula);
  
  // Get actual ingredient costs from database
  const { 
    totalBatchCost, 
    ingredients: ingredientCosts, 
    loading: costsLoading, 
    missingMaterials 
  } = useFormulaIngredientCosts(selectedFormula || null);

  // Calculate costs
  const calculations = useMemo(() => {
    const bottles = parseFloat(numberOfBottles) || 0;
    const batches = parseFloat(batchesPlanned) || 0;
    const bottle = parseFloat(bottleCost) || 0;
    const cap = parseFloat(capCost) || 0;
    const packaging = parseFloat(packagingCost) || 0;

    if (bottles === 0 || batches === 0) {
      return null;
    }

    // Use actual batch cost from formula ingredients
    const batchCost = totalBatchCost;

    const ingredientCost = batchCost * batches;
    const totalPackagingCost = (bottle + cap + packaging) * bottles;
    const subtotal = ingredientCost + totalPackagingCost;
    const utilityCost = subtotal * (UTILITY_PERCENT / 100);
    const totalCOGS = subtotal + utilityCost;
    const cogsPerBottle = totalCOGS / bottles;
    const sellingPricePerBottle = cogsPerBottle * (1 + MARGIN_PERCENT / 100);
    const quoteTotal = sellingPricePerBottle * bottles;

    return {
      ingredientCost,
      totalPackagingCost,
      subtotal,
      utilityCost,
      totalCOGS,
      cogsPerBottle,
      sellingPricePerBottle,
      quoteTotal,
      batchCost
    };
  }, [numberOfBottles, batchesPlanned, bottleCost, capCost, packagingCost, totalBatchCost]);

  const isFormValid = selectedFormula && numberOfBottles && batchesPlanned;

  const generateQuotePDF = () => {
    if (!calculations || !selectedFormula) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const formula = formulas.find(f => f.id === selectedFormula);
    const customer = customers.find(c => c.id === selectedCustomer);
    const doc = new jsPDF();
    const quoteNumber = `QT-${Date.now().toString().slice(-8)}`;

    // Header
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("QUOTE", 20, 25);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Quote #: ${quoteNumber}`, 20, 35);
    doc.text(`Date: ${formatET(new Date(), "M/d/yyyy")}`, 20, 42);
    doc.text(`Valid Until: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}`, 20, 49);

    // Company info
    doc.setFont("helvetica", "bold");
    doc.text("From:", 130, 35);
    doc.setFont("helvetica", "normal");
    doc.text("ERP.ai Manufacturing", 130, 42);

    // Customer info
    if (customer) {
      doc.setFont("helvetica", "bold");
      doc.text("To:", 20, 65);
      doc.setFont("helvetica", "normal");
      doc.text(customer.company_name, 20, 72);
      if (customer.contact_person) doc.text(customer.contact_person, 20, 79);
      if (customer.email) doc.text(customer.email, 20, 86);
    }

    // Product details table
    autoTable(doc, {
      startY: customer ? 100 : 70,
      head: [['Description', 'Details']],
      body: [
        ['Product', `${formula?.name} (${formula?.code})`],
        ['Count per Bottle', `${ctPerBottle} ct`],
        ['Number of Bottles', parseInt(numberOfBottles).toLocaleString()],
        ['Batches Planned', batchesPlanned],
      ],
      theme: 'striped',
      headStyles: { fillColor: [0, 123, 131] },
    });

    // Pricing table
    const pricingY = (doc as any).lastAutoTable.finalY + 10;
    autoTable(doc, {
      startY: pricingY,
      head: [['Cost Breakdown', 'Amount']],
      body: [
        ['Ingredient Cost', `$${calculations.ingredientCost.toFixed(2)}`],
        ['Packaging Cost', `$${calculations.totalPackagingCost.toFixed(2)}`],
        ['Utility (5%)', `$${calculations.utilityCost.toFixed(2)}`],
        ['Total COGS', `$${calculations.totalCOGS.toFixed(2)}`],
      ],
      foot: [
        ['COGS per Bottle', `$${calculations.cogsPerBottle.toFixed(2)}`],
        ['Selling Price per Bottle', `$${calculations.sellingPricePerBottle.toFixed(2)}`],
        ['Quote Total', `$${calculations.quoteTotal.toFixed(2)}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [0, 123, 131] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    // Terms
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Terms & Conditions:", 20, finalY);
    doc.setFont("helvetica", "normal");
    doc.text("• Quote valid for 30 days", 20, finalY + 8);
    doc.text("• Payment terms: Net 30", 20, finalY + 15);
    doc.text("• Lead time: 2-4 weeks from order confirmation", 20, finalY + 22);

    doc.save(`Quote_${quoteNumber}.pdf`);
    toast({ title: "Quote PDF generated successfully" });
  };

  if (formulasLoading || customersLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 space-y-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quoting</h1>
            <p className="text-muted-foreground">Calculate COGS-based quotes for customers</p>
          </div>
          <Button onClick={generateQuotePDF} disabled={!calculations}>
            <Download className="mr-2 h-4 w-4" />
            Generate Quote PDF
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Quote Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Quote Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Formula Selection */}
              <div className="space-y-2">
                <Label>Formula *</Label>
                <Select value={selectedFormula} onValueChange={setSelectedFormula}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select formula" />
                  </SelectTrigger>
                  <SelectContent>
                    {formulas.filter(f => !f.is_deleted).map(formula => (
                      <SelectItem key={formula.id} value={formula.id}>
                        {formula.code} - {formula.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Company Selection */}
              <div className="space-y-2">
                <Label>Company (optional)</Label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Bottle Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Number of Bottles *</Label>
                  <Input
                    type="number"
                    value={numberOfBottles}
                    onChange={(e) => setNumberOfBottles(e.target.value)}
                    placeholder="e.g. 10000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ct/Bottle *</Label>
                  <Select value={ctPerBottle} onValueChange={setCtPerBottle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CT_OPTIONS.map(ct => (
                        <SelectItem key={ct} value={ct.toString()}>
                          {ct} ct
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Packaging Costs */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Packaging Costs (per unit)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Bottle Cost ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bottleCost}
                      onChange={(e) => setBottleCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Cap Cost ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={capCost}
                      onChange={(e) => setCapCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Packaging Cost ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={packagingCost}
                      onChange={(e) => setPackagingCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Batches Planned */}
              <div className="space-y-2">
                <Label>Number of Batches Planned *</Label>
                <Input
                  type="number"
                  value={batchesPlanned}
                  onChange={(e) => setBatchesPlanned(e.target.value)}
                  placeholder="e.g. 5"
                />
                {selectedFormulaData && (
                  <p className="text-xs text-muted-foreground">
                    Batch size: {selectedFormulaData.default_batch_size_kg} kg
                  </p>
                )}
              </div>

              {/* Fixed Rates Display */}
              <div className="flex items-center gap-6 p-3 bg-muted/50 rounded-lg">
                <div className="text-sm">
                  <span className="text-muted-foreground">Utility:</span>{" "}
                  <span className="font-medium">{UTILITY_PERCENT}%</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Margin:</span>{" "}
                  <span className="font-medium">{MARGIN_PERCENT}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cost Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!calculations ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Enter quote details to see cost breakdown</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Warnings */}
                  {missingMaterials.length > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Missing cost data for:</p>
                        <p className="text-xs">{missingMaterials.join(', ')}</p>
                      </div>
                    </div>
                  )}

                  {/* Cost Items */}
                  <div className="space-y-3">
                    <Collapsible open={showIngredientBreakdown} onOpenChange={setShowIngredientBreakdown}>
                      <CollapsibleTrigger className="flex justify-between items-center py-2 w-full hover:bg-muted/50 rounded px-2 -mx-2">
                        <span className="text-muted-foreground flex items-center gap-1">
                          {showIngredientBreakdown ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          Ingredient Cost
                          {costsLoading && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                        </span>
                        <span className="font-medium">${calculations.ingredientCost.toFixed(2)}</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 mb-3 pl-5 space-y-1 text-sm border-l-2 border-muted ml-1">
                          <div className="text-xs text-muted-foreground font-medium pb-1">
                            Cost per batch: ${calculations.batchCost.toFixed(2)}
                          </div>
                          {ingredientCosts.map((ing, idx) => (
                            <div key={idx} className="flex justify-between text-muted-foreground">
                              <span className={!ing.hasData ? 'text-destructive/70' : ''}>
                                {ing.materialName}
                                {!ing.hasData && ' *'}
                              </span>
                              <span>
                                {ing.weightKg.toFixed(2)} kg × ${ing.costPerKg.toFixed(2)} = ${ing.totalCost.toFixed(2)}
                              </span>
                            </div>
                          ))}
                          {ingredientCosts.length === 0 && (
                            <p className="text-muted-foreground italic">No ingredients found</p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Packaging Cost</span>
                      <span className="font-medium">${calculations.totalPackagingCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">${calculations.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Utility ({UTILITY_PERCENT}%)</span>
                      <span className="font-medium">${calculations.utilityCost.toFixed(2)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* COGS */}
                  <div className="flex justify-between py-2 text-lg">
                    <span className="font-semibold">Total COGS</span>
                    <span className="font-bold">${calculations.totalCOGS.toFixed(2)}</span>
                  </div>

                  <Separator />

                  {/* Per Bottle Breakdown */}
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">COGS per Bottle</span>
                      <span className="font-medium">${calculations.cogsPerBottle.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Selling Price per Bottle</span>
                      <span className="font-medium text-primary">${calculations.sellingPricePerBottle.toFixed(2)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Quote Total */}
                  <div className="flex justify-between py-4 text-xl">
                    <span className="font-bold">Quote Total</span>
                    <span className="font-bold text-primary">${calculations.quoteTotal.toFixed(2)}</span>
                  </div>

                  {/* Summary Info */}
                  <div className="text-sm text-muted-foreground space-y-1 pt-2">
                    <p>• {parseInt(numberOfBottles).toLocaleString()} bottles @ {ctPerBottle} ct each</p>
                    <p>• {batchesPlanned} batch(es) planned</p>
                    <p>• {MARGIN_PERCENT}% margin applied</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
