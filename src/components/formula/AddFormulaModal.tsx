import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Minus, Bold, Type, Search, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DeleteConfirmationModal } from "@/components/inventory/DeleteConfirmationModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCustomers } from "@/hooks/useCustomers";

// Sample raw materials from inventory
const sampleRawMaterials = [
  "CBD Oil",
  "Sugar",
  "Glucose Syrup",
  "Pectin",
  "Citric Acid",
  "Natural Flavoring",
  "Red Coloring",
  "Vitamin C",
  "Gelatin",
  "Water"
];

const sampleVendors = [
  "Vendor A",
  "Vendor B", 
  "Vendor C",
  "Global Ingredients Ltd",
  "Natural Extracts Co"
];

const ingredientSchema = z.object({
  name: z.string().min(1, "Ingredient name is required"),
  materialName: z.string().optional(),
  vendor: z.string().optional(),
  lotNumber: z.string().optional(),
  weightKg: z.number().min(0).optional(), // Always stored in kg
  weightInput: z.number().min(0).optional(), // User's input value
  weightUnit: z.enum(['kg', 'g']).optional(), // User's selected unit (kg or g only)
  vessel: z.enum(['cooker', 'holding']).optional().nullable(),
});

// Unit conversion helpers
const convertToKg = (value: number, unit: 'kg' | 'g'): number => {
  switch (unit) {
    case 'kg': return value;
    case 'g': return value / 1000;
    default: return value;
  }
};

const getSmartUnit = (kg: number): { unit: 'kg' | 'g'; value: number } => {
  if (kg === 0) return { unit: 'g', value: 0 };
  if (kg >= 1) return { unit: 'kg', value: kg };
  // Everything under 1 kg displays in grams
  return { unit: 'g', value: kg * 1000 };
};

const activeIngredientSchema = z.object({
  name: z.string().min(1, "Active ingredient is required"),
  labelClaim: z.string().optional(),
  overageAdded: z.number().min(0).optional(),
  quantityMg: z.number().min(0, "Quantity in mg must be 0 or greater"),
  quantityG: z.number().min(0, "Quantity in g must be 0 or greater"),
});

const formulaSchema = z.object({
  productCode: z.string().optional(),
  lineNumber: z.string().optional(),
  productNameFlavor: z.string().min(1, "Product name / flavor is required"),
  batchSize: z.number().min(0.1, "Batch size must be greater than 0"),
  averagePieceWeight: z.number().min(0.1, "Average piece weight must be greater than 0"),
  activeIngredients: z.array(activeIngredientSchema),
  ingredients: z.array(ingredientSchema),
  procedureText: z.string().optional(),
  customerId: z.string().min(1, "Customer selection is required"),
});

type FormulaFormData = z.infer<typeof formulaSchema>;

interface FormulaData extends FormulaFormData {
  totalPieces: number;
  id?: string;
  status: 'active' | 'draft';
  createdAt?: string;
  updatedAt?: string;
}

// Interface for compatibility with existing Formula page
interface FormulaInput {
  productCode: string;
  lineNumber: string;
  productNameFlavor: string;
  batchSize: number;
  averagePieceWeight: number;
  activeIngredients: any[];
  ingredients: any[];
  procedureText: string;
}

interface AddFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => Promise<void>; // Optional refresh callback
  editingFormula?: any;
}

// Database save function using RPC
const saveFormulaToDatabase = async (formulaData: FormulaData, editingId?: string): Promise<{ data: any; error: any }> => {
  try {
    console.log('💾 Saving formula via RPC:', formulaData);
    
    // Prepare the data for the RPC call
    const rpcPayload = {
      id: editingId || null,
      code: formulaData.productCode || null,
      product_code_line: formulaData.lineNumber || null,
      name: formulaData.productNameFlavor,
      default_batch_size_kg: formulaData.batchSize,
      average_piece_weight: formulaData.averagePieceWeight,
      total_pieces: formulaData.totalPieces,
      active_ingredients_json: formulaData.activeIngredients || [],
      recipe_json: formulaData.ingredients || [],
      procedure_text: formulaData.procedureText || null,
      status: formulaData.status,
      customer_id: formulaData.customerId === '__none__' ? null : (formulaData.customerId || null),
    };

    console.log('💾 RPC payload with customer_id:', rpcPayload.customer_id);
    console.log('💾 Full RPC payload:', rpcPayload);

    const { data, error } = await supabase.rpc('save_formula', {
      p_formula_data: rpcPayload,
      p_formula_id: editingId || null
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      throw error;
    }

    if (!data || typeof data !== 'object' || !(data as any).success) {
      console.error('RPC function returned error:', data);
      throw new Error((data as any)?.message || 'Unknown error from save_formula RPC');
    }

    console.log('Successfully saved formula via RPC:', data);
    return { data: (data as any).data, error: null };
  } catch (error) {
    console.error('Error saving formula via RPC:', error);
    return { data: null, error };
  }
};

export function AddFormulaModal({ isOpen, onClose, onSave, editingFormula }: AddFormulaModalProps) {
  const [activeTab, setActiveTab] = useState("header");
  const [ingredientSearchOpen, setIngredientSearchOpen] = useState<number | null>(null);
  const { customers } = useCustomers();
  const [regularIngredientSearchOpen, setRegularIngredientSearchOpen] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [regularSearchTerm, setRegularSearchTerm] = useState<string>("");
  const [debouncedRegularSearchTerm, setDebouncedRegularSearchTerm] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    index: number;
    type: 'active' | 'regular';
  }>({ isOpen: false, index: -1, type: 'regular' });
  const [customerValidationDialog, setCustomerValidationDialog] = useState(false);
  const { rawMaterials, loading } = useRawMaterials();

  // Debounced search to prevent constant re-renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRegularSearchTerm(regularSearchTerm);
    }, 150);
    return () => clearTimeout(timer);
  }, [regularSearchTerm]);

  // Memoized ingredient options - only recalculate when rawMaterials change
  const ingredientOptions = useMemo(() => {
    if (!rawMaterials || !Array.isArray(rawMaterials) || rawMaterials.length === 0) {
      return [];
    }

    const options: Array<{
      value: string;
      label: string;
      materialName: string;
      materialCode: string;
      lotNumber: string;
      lotId: string;
      vendor: string;
      quantity: number;
      unit: string;
    }> = [];

    try {
      rawMaterials.forEach((material) => {
        if (!material) return;

        if (material.lots && Array.isArray(material.lots) && material.lots.length > 0) {
          material.lots.forEach((lot) => {
            if (!lot) return;
            
            const materialName = material.name || 'Unknown';
            const vendor = material.supplier || 'Unknown';
            const lotNumber = lot.lot_number || 'N/A';
            const quantity = lot.quantity || 0;
            const unit = material.unit_of_measure || '';
            
            options.push({
              value: `${material.id}-${lot.id}`,
              label: `${materialName} — ${vendor} — ${lotNumber} — ${quantity} ${unit}`,
              materialName,
              materialCode: material.code || '',
              lotNumber,
              lotId: lot.id,
              vendor,
              quantity,
              unit,
            });
          });
        } else {
          const materialName = material.name || 'Unknown';
          const vendor = material.supplier || 'Unknown';
          
          options.push({
            value: material.id || `material-${material.name}`,
            label: `${materialName} — ${vendor} — No lots available`,
            materialName,
            materialCode: material.code || '',
            lotNumber: '',
            lotId: '',
            vendor,
            quantity: 0,
            unit: material.unit_of_measure || '',
          });
        }
      });
    } catch (error) {
      console.error('Error processing rawMaterials:', error);
      return [];
    }

    // Sort: ingredients with quantity > 0 first, then 0 quantity at bottom
    return options.sort((a, b) => {
      if ((a.quantity > 0 && b.quantity > 0) || (a.quantity === 0 && b.quantity === 0)) {
        return a.materialName.localeCompare(b.materialName);
      }
      return a.quantity > 0 ? -1 : 1;
    });
  }, [rawMaterials]);

  // Memoized filtered options - only recalculate when options or search term change
  const filteredIngredientOptions = useMemo(() => {
    let filtered = ingredientOptions;
    
    if (debouncedRegularSearchTerm) {
      const searchLower = debouncedRegularSearchTerm.toLowerCase();
      filtered = ingredientOptions.filter((option) => 
        option.materialCode.toLowerCase().includes(searchLower) ||
        option.materialName.toLowerCase().includes(searchLower) ||
        option.vendor.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort: ingredients with quantity > 0 first, then 0 quantity at bottom
    return filtered.sort((a, b) => {
      if ((a.quantity > 0 && b.quantity > 0) || (a.quantity === 0 && b.quantity === 0)) {
        return a.materialName.localeCompare(b.materialName);
      }
      return a.quantity > 0 ? -1 : 1;
    });
  }, [ingredientOptions, debouncedRegularSearchTerm]);

  const form = useForm<FormulaFormData>({
    resolver: zodResolver(formulaSchema),
    defaultValues: {
      productCode: "",
      lineNumber: "",
      productNameFlavor: "",
      batchSize: 150,
      averagePieceWeight: 3.5,
      activeIngredients: [],
        ingredients: [{ name: "", materialName: "", vendor: "", lotNumber: "", weightInput: 0, weightUnit: 'g' as const }],
      procedureText: `1. Set Cooker temperature at 140 °C, add Water, bring it to boiling point
2. Add Carrageenan & Pectine Powders into Cooker, mix well until all lumps dissolved
3. Add Organic Tapioca Syrup 42 DE into Cooker, continue to mix
4. Add Beet Root, Pomegranate & Proprietary blends, mix well until no lumps
5. Slowly add Organic Cane Sugar, continue to mix
6. Add Tri Sodium Citrate at 80 °C, mix well
7. Cook Candy mass to 88 °C until Brix reaches 69 % Solid
8. Reduce Cooker temp to 125 °C, transfer Candy mass into HOLDING TANKS
9. Add remaining ingredients, mix well then transfer into HOPPERS, BEGIN DEPOSITING`,
      customerId: "__none__",
    },
  });

  // Stable selection handler - prevent re-renders on selection
  const handleIngredientSelection = useCallback((index: number, option: any) => {
    // Batch all form updates together
    const updates = [
      [`ingredients.${index}.name`, option.value],
      [`ingredients.${index}.materialName`, option.materialName],
      [`ingredients.${index}.vendor`, option.vendor],
      [`ingredients.${index}.lotNumber`, option.lotNumber],
    ];
    
    updates.forEach(([field, value]) => {
      form.setValue(field as any, value);
    });
    
    setRegularIngredientSearchOpen(null);
    setRegularSearchTerm("");
  }, [form]);

  const { fields: activeIngredientFields, append: appendActiveIngredient, remove: removeActiveIngredient } = useFieldArray({
    control: form.control,
    name: "activeIngredients",
  });

  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient } = useFieldArray({
    control: form.control,
    name: "ingredients",
  });

  // Load editing data
  useEffect(() => {
    console.log('🔄 AddFormulaModal useEffect - editingFormula changed:', editingFormula);
    console.log('🔄 AddFormulaModal useEffect - isOpen:', isOpen);
    if (editingFormula && isOpen) {
      console.log('🔄 Setting form with editing formula ingredients:', editingFormula.ingredients);
      
      // Transform ingredients to add smart unit detection
      const transformedIngredients = (editingFormula.ingredients || []).map((ing: any) => {
        const kg = ing.weightKg || 0;
        
        // Use saved unit preference if available, otherwise auto-detect
        let unit: 'kg' | 'g';
        let value: number;
        
        if (ing.weightUnit && (ing.weightUnit === 'kg' || ing.weightUnit === 'g')) {
          unit = ing.weightUnit;
          value = unit === 'kg' ? kg : kg * 1000;
        } else {
          const smartUnit = getSmartUnit(kg);
          unit = smartUnit.unit;
          value = smartUnit.value;
        }
        
        return {
          ...ing,
          weightInput: value,
          weightUnit: unit,
        };
      });
      
      form.reset({
        productCode: editingFormula.productCode || "",
        lineNumber: editingFormula.lineNumber || "",
        productNameFlavor: editingFormula.productNameFlavor || "",
        batchSize: editingFormula.batchSize,
        averagePieceWeight: editingFormula.averagePieceWeight,
        activeIngredients: editingFormula.activeIngredients || [],
        ingredients: transformedIngredients.length > 0 ? transformedIngredients : [{ name: "", materialName: "", vendor: "", lotNumber: "", weightInput: 0, weightUnit: 'g' as const }],
        procedureText: editingFormula.procedureText || "",
        customerId: editingFormula.customerId || "__none__",
      });
      console.log('🔄 Form reset complete. Current form values:', form.getValues());
    } else if (!editingFormula && isOpen) {
      form.reset({
        productCode: "",
        lineNumber: "",
        productNameFlavor: "",
        batchSize: 150,
        averagePieceWeight: 3.5,
        activeIngredients: [],
        ingredients: [{ name: "", materialName: "", vendor: "", lotNumber: "", weightInput: 0, weightUnit: 'g' as const }],
        procedureText: `1. Set Cooker temperature at 140 °C, add Water, bring it to boiling point
2. Add Carrageenan & Pectine Powders into Cooker, mix well until all lumps dissolved
3. Add Organic Tapioca Syrup 42 DE into Cooker, continue to mix
4. Add Beet Root, Pomegranate & Proprietary blends, mix well until no lumps
5. Slowly add Organic Cane Sugar, continue to mix
6. Add Tri Sodium Citrate at 80 °C, mix well
7. Cook Candy mass to 88 °C until Brix reaches 69 % Solid
8. Reduce Cooker temp to 125 °C, transfer Candy mass into HOLDING TANKS
9. Add remaining ingredients, mix well then transfer into HOPPERS, BEGIN DEPOSITING`,
        customerId: "__none__",
      });
    }
  }, [editingFormula, isOpen, form]);

  // Auto-calculate fields
  const watchedBatchSize = form.watch("batchSize");
  const watchedAveragePieceWeight = form.watch("averagePieceWeight");
  const watchedIngredients = form.watch("ingredients");
  const watchedActiveIngredients = form.watch("activeIngredients");

  const calculateTotals = () => {
    const batchSizeInG = watchedBatchSize * 1000;
    const totalPieces = Math.floor(batchSizeInG / watchedAveragePieceWeight);
    
    return { totalPieces };
  };

  const { totalPieces } = calculateTotals();

  // Note: Conversion to kg is now handled inline in the weight input onChange

  const handleDeleteConfirmation = () => {
    if (deleteConfirmation.type === 'active') {
      removeActiveIngredient(deleteConfirmation.index);
    } else {
      removeIngredient(deleteConfirmation.index);
    }
    setDeleteConfirmation({ isOpen: false, index: -1, type: 'regular' });
  };

  const openDeleteConfirmation = (index: number, type: 'active' | 'regular') => {
    setDeleteConfirmation({ isOpen: true, index, type });
  };

  const importActiveIngredients = useCallback(() => {
    const currentActives = form.getValues('activeIngredients');
    const currentIngredients = form.getValues('ingredients');
    
    if (!currentActives || currentActives.length === 0) {
      toast({
        title: "No Active Ingredients",
        description: "Please add active ingredients in the Header Info tab first.",
      });
      return;
    }
    
    let importedCount = 0;
    let skippedCount = 0;
    
    currentActives.forEach((active) => {
      // Check if this active ingredient already exists in ingredients list
      const existsInIngredients = currentIngredients.some(
        (ing) => ing.name === active.name
      );
      
      if (existsInIngredients) {
        skippedCount++;
        return;
      }
      
      // Find the full ingredient details from ingredientOptions
      const ingredientDetail = ingredientOptions.find(
        (opt) => opt.value === active.name
      );
      
      // Create new ingredient entry with smart unit detection
      const weightKg = active.quantityG / 1000;
      const { unit, value } = getSmartUnit(weightKg);
      const newIngredient = {
        name: active.name,
        materialName: ingredientDetail?.materialName || active.name,
        vendor: ingredientDetail?.vendor || "",
        lotNumber: ingredientDetail?.lotNumber || "",
        weightKg,
        weightInput: value,
        weightUnit: unit,
        vessel: null as 'cooker' | 'holding' | null,
      };
      
      // Add to ingredients array
      appendIngredient(newIngredient);
      importedCount++;
    });
    
    // Show success message
    if (importedCount > 0) {
      toast({
        title: "Active Ingredients Imported",
        description: `Added ${importedCount} active ingredient${importedCount > 1 ? 's' : ''} to the ingredients list${skippedCount > 0 ? ` (${skippedCount} already existed)` : ''}.`,
      });
    } else {
      toast({
        title: "All Actives Already Added",
        description: "All active ingredients are already in the ingredients list.",
      });
    }
  }, [form, ingredientOptions, appendIngredient]);

  const onSubmit = async (data: FormulaFormData) => {
    // Prevent simultaneous save operations
    if (saving || savingDraft) return;
    
    setSaving(true);
    try {
      console.log('🚀 onSubmit called with data:', data);
      console.log('🚀 Customer ID from form:', data.customerId);
      
      // Customer assignment is optional — Internal formulas (no customer) save as active
      
      // Check if form is valid
      const isValid = await form.trigger();
      console.log('Form validation result:', isValid);
      
      if (!isValid) {
        console.log('Form validation errors:', form.formState.errors);
        toast({
          title: "Validation Error",
          description: "Please fix the form errors before submitting.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      
      const { totalPieces } = calculateTotals();
      console.log('Calculated totalPieces:', totalPieces);
      
      // Ensure all ingredient fields are properly captured
      const processedIngredients = data.ingredients.map(ingredient => {
        const weightKg = ingredient.weightKg ?? 0;
        return {
          name: ingredient.name || '',
          materialName: ingredient.materialName || '',
          vendor: ingredient.vendor || '',
          lotNumber: ingredient.lotNumber || '',
          weightKg,
          qty_per_batch_kg: weightKg,
          vessel: ingredient.vessel || null,
          weightUnit: ingredient.weightUnit || 'g',
        };
      });
      
      const submitData: FormulaData = {
        ...data,
        ingredients: processedIngredients as any,
        totalPieces,
        status: 'active', // Update Formula button always sets to active status
      };
      
      console.log('✅ Submitting data with customer_id:', submitData.customerId);
      console.log('✅ Full submit data:', submitData);
      
      let result;
      // Use the unified RPC function for both create and update
      result = await saveFormulaToDatabase(submitData, editingFormula?.id);
      
      if (result.error) {
        console.error('Database operation failed:', result.error);
        toast({
          title: "Error",
          description: `Failed to ${editingFormula ? 'update' : 'save'} formula: ${result.error.message}`,
          variant: "destructive",
        });
        return;
      }
      
      console.log('✅ Database operation successful:', result.data);
      
      const customerName = data.customerId && data.customerId !== '__none__' 
        ? customers.find(c => c.id === data.customerId)?.company_name 
        : null;
      
      toast({
        title: "Success",
        description: customerName 
          ? `Formula ${editingFormula ? 'updated' : 'saved'} and assigned to ${customerName}!`
          : `Formula ${editingFormula ? 'updated' : 'saved'} successfully!`,
      });
      
      // Call refresh callback if provided
      if (onSave) {
        await onSave();
      }
      
      // Reset form and close modal
      form.reset();
      setActiveTab("header");
      onClose();
    } catch (error) {
      console.error('Error in onSubmit:', error);
      toast({
        title: "Error",
        description: `An unexpected error occurred: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    // Prevent simultaneous save operations
    if (saving || savingDraft) return;
    
    setSavingDraft(true);
    try {
      const data = form.getValues();
      const { totalPieces } = calculateTotals();
      
      // Ensure all ingredient fields are properly captured for draft
      const processedIngredients = data.ingredients.map(ingredient => {
        const weightKg = ingredient.weightKg ?? 0;
        return {
          name: ingredient.name || '',
          materialName: ingredient.materialName || '',
          vendor: ingredient.vendor || '',
          lotNumber: ingredient.lotNumber || '',
          weightKg,
          qty_per_batch_kg: weightKg,
          vessel: ingredient.vessel || null,
          weightUnit: ingredient.weightUnit || 'g',
        };
      });
      
      const submitData: FormulaData = {
        ...data,
        ingredients: processedIngredients as any,
        totalPieces,
        status: 'draft', // Save Draft button always sets to draft status
      };
      
      console.log('Saving draft:', submitData);
      
      const result = await saveFormulaToDatabase(submitData, editingFormula?.id);
      
      if (result.error) {
        console.error('Failed to save draft:', result.error);
        toast({
          title: "Error",
          description: `Failed to save draft: ${result.error.message}`,
          variant: "destructive",
        });
        return;
      }
      
      console.log('Draft saved successfully:', result.data);
      toast({
        title: "Success",
        description: "Draft saved successfully!",
      });
      
      // Call refresh callback if provided  
      if (onSave) {
        await onSave();
      }
      
      // Reset form and close modal
      form.reset();
      setActiveTab("header");
      onClose();
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Error",
        description: `Failed to save draft: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setActiveTab("header");
    onClose();
  };

  const handleAssignCustomer = () => {
    setCustomerValidationDialog(false);
    setActiveTab("header");
    // Focus on customer field after a short delay to allow tab switch
    setTimeout(() => {
      const customerSelect = document.querySelector('[name="customerId"]');
      if (customerSelect) {
        (customerSelect as HTMLElement).focus();
      }
    }, 100);
  };

  return (
    <>
      <AlertDialog open={customerValidationDialog} onOpenChange={setCustomerValidationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Customer Assigned</AlertDialogTitle>
            <AlertDialogDescription>
              This formula has no customer assigned. You can either save it as a draft to complete later, or assign a customer to activate it now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCustomerValidationDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <Button 
              variant="outline" 
              onClick={() => {
                setCustomerValidationDialog(false);
                handleSaveDraft();
              }}
            >
              Save as Draft
            </Button>
            <AlertDialogAction onClick={handleAssignCustomer}>
              Assign Customer & Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="[--dialog-max-width:80rem] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="text-2xl">
            {editingFormula ? "Edit Formula" : "Add New Formula"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-3 flex-shrink-0 mb-4">
                <TabsTrigger value="header">Header Info</TabsTrigger>
                <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
                <TabsTrigger value="procedure">Procedure</TabsTrigger>
              </TabsList>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="pr-4 pb-28 space-y-6">
                  {/* Header Section */}
                  <TabsContent value="header" className="space-y-6 mt-0 data-[state=active]:block data-[state=inactive]:hidden relative">
                  <Card>
                    <CardHeader>
                      <CardTitle>Formula Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Row 1: Product Code and Line # */}
                        <FormField
                          control={form.control}
                          name="productCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Code</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="lineNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Line #</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Empty cell to maintain grid structure */}
                        <div className="hidden md:block"></div>

                        {/* Row 2: Product Name / Flavor (full width) */}
                        <FormField
                          control={form.control}
                          name="productNameFlavor"
                          render={({ field }) => (
                            <FormItem className="md:col-span-3">
                              <FormLabel>Product Name / Flavor</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Customer Selection */}
                        <FormField
                          control={form.control}
                          name="customerId"
                          render={({ field }) => (
                            <FormItem className="md:col-span-3">
                              <FormLabel>Customer</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                value={field.value || undefined}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a customer" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none__">Internal/Generic Formula</SelectItem>
                                  {customers.map((customer) => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                      {customer.company_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Row 3: Batch Size, Average Piece Weight, Total Pieces */}
                        <FormField
                          control={form.control}
                          name="batchSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Batch Size (Kg)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.1"
                                  placeholder=""
                                  {...field} 
                                  value={field.value || ""}
                                  onChange={e => {
                                    const value = e.target.value;
                                    field.onChange(value === "" ? undefined : Number(value));
                                  }}
                                  onFocus={e => {
                                    if (e.target.value === "0") {
                                      e.target.value = "";
                                      field.onChange(undefined);
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="averagePieceWeight"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel className="flex items-center gap-2">
                                Average Piece Weight (g)
                                <span className="text-xs font-normal text-muted-foreground">• Critical for calculations</span>
                              </FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <Input 
                                    type="number" 
                                    step="0.1"
                                    placeholder=""
                                    {...field} 
                                    value={field.value || ""}
                                    onChange={e => {
                                      const value = e.target.value;
                                      field.onChange(value === "" ? undefined : Number(value));
                                    }}
                                    onFocus={e => {
                                      if (e.target.value === "0") {
                                        e.target.value = "";
                                        field.onChange(undefined);
                                      }
                                    }}
                                  />
                                  <div className="flex gap-2">
                                    {[3, 3.5, 4, 4.5, 5].map((weight) => (
                                      <Button
                                        key={weight}
                                        type="button"
                                        variant={field.value === weight ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => field.onChange(weight)}
                                        className="flex-1"
                                      >
                                        {weight}g
                                      </Button>
                                    ))}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Select the weight of each individual gummy for this product variant
                                  </p>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormItem className="md:col-start-1">
                          <FormLabel>Total Pieces</FormLabel>
                          <FormControl>
                            <Input 
                              value={totalPieces.toLocaleString()}
                              readOnly
                              className="bg-muted"
                            />
                          </FormControl>
                        </FormItem>
                      </div>

                      {/* Active Ingredients Section */}
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle>Active Ingredients</CardTitle>
                           <Button
                            type="button"
                            onClick={() => appendActiveIngredient({ name: "", labelClaim: "", overageAdded: 0, quantityMg: 0, quantityG: 0 })}
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add Active
                          </Button>
                        </CardHeader>
                        <CardContent>
                          {activeIngredientFields.length > 0 && (
                            <div className="space-y-3">
                              {activeIngredientFields.map((field, index) => (
                                <div key={field.id} className="flex items-end gap-3 p-4 border rounded-lg">
                                  <FormField
                                    control={form.control}
                                    name={`activeIngredients.${index}.name`}
                                    render={({ field }) => {
                                      const selectedOption = ingredientOptions.find((option) => option.value === field.value);
                                      const displayName = selectedOption ? selectedOption.materialName : field.value;
                                      
                                      return (
                                        <FormItem className="flex-1 min-w-[200px]">
                                          <FormLabel>Active Ingredient</FormLabel>
                                        <FormControl>
                                          <Popover open={ingredientSearchOpen === index} onOpenChange={(open) => {
                                            setIngredientSearchOpen(open ? index : null);
                                            if (!open) setSearchTerm("");
                                          }}>
                                            <PopoverTrigger asChild>
                                               <Button
                                                 variant="outline"
                                                 role="combobox"
                                                 aria-expanded={ingredientSearchOpen === index}
                                                 className="w-full justify-between text-left h-10"
                                               >
                                                 <span className="flex-1 text-left truncate">
                                                   {displayName || "Select ingredient..."}
                                                 </span>
                                                 <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                               </Button>
                                            </PopoverTrigger>
                                             <PopoverContent className="w-[450px] p-0 z-[100] bg-popover border pointer-events-auto" align="start" sideOffset={5}>
                                               <div className="flex flex-col max-h-80 pointer-events-auto">
                                                 {/* Search Input */}
                                                 <div className="flex items-center border-b border-border/50 px-3 py-2">
                                                   <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                   <input
                                                     placeholder="Search ingredients..."
                                                     value={searchTerm}
                                                     onChange={(e) => setSearchTerm(e.target.value)}
                                                     className="flex-1 bg-transparent border-0 outline-none text-sm"
                                                     onKeyDown={(e) => {
                                                       if (e.key === 'Escape') {
                                                         setIngredientSearchOpen(null);
                                                         setSearchTerm("");
                                                       }
                                                     }}
                                                   />
                                                 </div>
                                                 
                                                {/* Custom Results List */}
                                                  <div 
                                                    className="flex-1 overflow-y-scroll overscroll-contain pointer-events-auto"
                                                    style={{ 
                                                      maxHeight: '300px',
                                                      overscrollBehavior: 'contain',
                                                      touchAction: 'pan-y',
                                                      WebkitOverflowScrolling: 'touch',
                                                    }}
                                                    onWheel={(e) => e.stopPropagation()}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                    tabIndex={0}
                                                  >
                                                    {(() => {
                                                      if (loading && ingredientOptions.length === 0) {
                                                        return (
                                                          <div className="p-4 text-center text-muted-foreground">
                                                            Loading ingredients...
                                                          </div>
                                                        );
                                                      }

                                                      const filteredOptions = ingredientOptions
                                                        .filter((option) => {
                                                          if (!searchTerm) return true;
                                                          const searchLower = searchTerm.toLowerCase();
                                                          return (
                                                            option.materialName.toLowerCase().includes(searchLower) ||
                                                            option.lotNumber.toLowerCase().includes(searchLower) ||
                                                            option.vendor.toLowerCase().includes(searchLower)
                                                          );
                                                        })
                                                        .sort((a, b) => {
                                                          if ((a.quantity > 0 && b.quantity > 0) || (a.quantity === 0 && b.quantity === 0)) {
                                                            return a.materialName.localeCompare(b.materialName);
                                                          }
                                                          return a.quantity > 0 ? -1 : 1;
                                                        });

                                                      if (filteredOptions.length === 0) {
                                                        return (
                                                          <div className="p-4 text-center text-muted-foreground text-sm">
                                                            {ingredientOptions.length === 0 ? "No ingredients available" : "No matching ingredients found"}
                                                          </div>
                                                        );
                                                      }

                                                      return filteredOptions.map((option) => (
                                                        <div
                                                          key={option.value}
                                                          className="cursor-pointer py-3 px-3 hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/50 last:border-b-0"
                                                          onClick={() => {
                                                            field.onChange(option.value);
                                                            setIngredientSearchOpen(null);
                                                            setSearchTerm("");
                                                          }}
                                                        >
                                                          <div className="flex flex-col w-full gap-1">
                                                            <span className="font-medium text-sm">{option.materialName}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                              {option.lotNumber && `Lot #${option.lotNumber} | `}
                                                              Vendor: {option.vendor} |
                                                              Qty: {option.quantity}{option.unit}
                                                            </span>
                                                          </div>
                                                        </div>
                                                      ));
                                                    })()}
                                                  </div>
                                               </div>
                                             </PopoverContent>
                                          </Popover>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    );
                                  }}
                                  />
                                  <FormField
                                    control={form.control}
                                    name={`activeIngredients.${index}.labelClaim`}
                                    render={({ field }) => (
                                      <FormItem className="w-32">
                                        <FormLabel>Label Claim/Gum</FormLabel>
                                         <FormControl>
                                            <Input 
                                              type="text" 
                                              placeholder="e.g. 500mg"
                                              className="h-10"
                                              {...field} 
                                              value={field.value || ""}
                                            />
                                         </FormControl>
                                         <FormMessage />
                                       </FormItem>
                                     )}
                                   />
                                  <FormField
                                    control={form.control}
                                    name={`activeIngredients.${index}.overageAdded`}
                                    render={({ field }) => (
                                      <FormItem className="w-32">
                                        <FormLabel>Overage Added</FormLabel>
                                         <FormControl>
                                            <div className="relative">
                                              <Input 
                                                type="number" 
                                                step="any"
                                                min="0"
                                                placeholder="0"
                                                className="h-10 pr-7"
                                                {...field} 
                                                value={field.value || ""}
                                                onChange={e => {
                                                  const value = e.target.value;
                                                  const numValue = value === "" ? 0 : Number(value);
                                                  field.onChange(numValue >= 0 ? numValue : 0);
                                                }}
                                              />
                                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                                            </div>
                                         </FormControl>
                                         <FormMessage />
                                       </FormItem>
                                     )}
                                   />
                                  <FormField
                                    control={form.control}
                                    name={`activeIngredients.${index}.quantityMg`}
                                    render={({ field }) => (
                                      <FormItem className="w-32">
                                        <FormLabel>Quantity in mg</FormLabel>
                                         <FormControl>
                                            <Input 
                                              type="number" 
                                              step="any"
                                              min="0"
                                             placeholder="0"
                                             className="h-10"
                                             {...field} 
                                             value={field.value || ""}
                                             onChange={e => {
                                               const value = e.target.value;
                                               const numValue = value === "" ? 0 : Number(value);
                                               field.onChange(numValue >= 0 ? numValue : 0);
                                             }}
                                           />
                                         </FormControl>
                                         <FormMessage />
                                       </FormItem>
                                     )}
                                   />
                                    <FormField
                                      control={form.control}
                                      name={`activeIngredients.${index}.quantityG`}
                                      render={({ field }) => (
                                        <FormItem className="w-32">
                                          <FormLabel>Quantity in g</FormLabel>
                                          <FormControl>
                                             <Input 
                                              type="number" 
                                              step="any"
                                              min="0"
                                              placeholder="0"
                                              className="h-10"
                                              {...field} 
                                              value={field.value || ""}
                                              onChange={e => {
                                                const value = e.target.value;
                                                const numValue = value === "" ? 0 : Number(value);
                                                field.onChange(numValue >= 0 ? numValue : 0);
                                              }}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                   <Button
                                     type="button"
                                     onClick={() => openDeleteConfirmation(index, 'active')}
                                     size="sm"
                                     variant="outline"
                                     className="h-10 px-3 text-destructive hover:text-destructive"
                                   >
                                     <Trash2 className="h-4 w-4" />
                                   </Button>
                                 </div>
                               ))}
                             </div>
                           )}
                          </CardContent>
                        </Card>
                    </CardContent>
                  </Card>
                </TabsContent>

               {/* Ingredients Section */}
               <TabsContent value="ingredients" className="space-y-6 mt-0 data-[state=active]:block data-[state=inactive]:hidden relative">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Ingredients</CardTitle>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={importActiveIngredients}
                          size="sm"
                          variant="secondary"
                          className="flex items-center gap-2"
                          disabled={activeIngredientFields.length === 0}
                        >
                          <Download className="h-4 w-4" />
                          Import Active Ingredients
                          {activeIngredientFields.length > 0 && (
                            <Badge variant="outline" className="ml-1">
                              {activeIngredientFields.length}
                            </Badge>
                          )}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => appendIngredient({ name: "", materialName: "", vendor: "", lotNumber: "", weightInput: 0, weightUnit: 'g', vessel: null })}
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Ingredient
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Vessel Legend */}
                      <div className="flex justify-end items-center gap-2 mb-4">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                          <span className="w-4 h-4 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-semibold">C</span>
                          Cooker
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                          <span className="w-4 h-4 rounded-full bg-yellow-500 text-black text-xs flex items-center justify-center font-semibold">H</span>
                          Holding
                        </div>
                      </div>
                      <div className="space-y-4">
                        {ingredientFields.map((field, index) => {
                          const watchedIngredient = watchedIngredients[index];
                          const vesselValue = watchedIngredient?.vessel;
                          
                          // Apply row highlighting based on vessel selection
                          const rowHighlightClass = vesselValue === 'cooker' 
                            ? 'bg-green-50 border-l-green-500 border-l-4' 
                            : vesselValue === 'holding' 
                            ? 'bg-yellow-50 border-l-yellow-500 border-l-4' 
                            : '';
                          
                          return (
                            <div 
                              key={field.id} 
                              className={`grid grid-cols-1 md:grid-cols-10 gap-3 p-4 border rounded-lg ${rowHighlightClass}`}
                              onKeyDown={(e) => {
                                // Only apply shortcuts when not typing in an input field
                                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                                  return;
                                }
                                
                                if (e.key === 'c' || e.key === 'C') {
                                  e.preventDefault();
                                  const currentVessel = form.getValues(`ingredients.${index}.vessel`);
                                  form.setValue(`ingredients.${index}.vessel`, currentVessel === 'cooker' ? null : 'cooker');
                                } else if (e.key === 'h' || e.key === 'H') {
                                  e.preventDefault();
                                  const currentVessel = form.getValues(`ingredients.${index}.vessel`);
                                  form.setValue(`ingredients.${index}.vessel`, currentVessel === 'holding' ? null : 'holding');
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  form.setValue(`ingredients.${index}.vessel`, null);
                                }
                              }}
                              tabIndex={0}
                            >
                             <div className="md:col-span-2">
                               <FormField
                                 control={form.control}
                                 name={`ingredients.${index}.materialName`}
                                 render={({ field }) => (
                                   <FormItem>
                                     <FormLabel>Ingredient</FormLabel>
                                     <FormControl>
                                       <div className="relative">
                                         <Input 
                                           {...field} 
                                           placeholder="Enter ingredient name"
                                           className="h-10 pr-10"
                                         />
                                         <Popover open={regularIngredientSearchOpen === index} onOpenChange={(open) => {
                                           setRegularIngredientSearchOpen(open ? index : null);
                                           if (!open) setRegularSearchTerm("");
                                         }}>
                                           <PopoverTrigger asChild>
                                             <Button
                                               type="button"
                                               variant="ghost"
                                               size="sm"
                                               className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-accent"
                                             >
                                               <Search className="h-4 w-4" />
                                             </Button>
                                           </PopoverTrigger>
                                        <PopoverContent className="w-[450px] p-0 z-[100] bg-popover border pointer-events-auto" align="start" sideOffset={5}>
                                          <div className="flex flex-col max-h-80 pointer-events-auto">
                                            {/* Search Input */}
                                            <div className="flex items-center border-b border-border/50 px-3 py-2">
                                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                              <input
                                                placeholder="Search ingredients..."
                                                value={regularSearchTerm}
                                                onChange={(e) => setRegularSearchTerm(e.target.value)}
                                                className="flex-1 bg-transparent border-0 outline-none text-sm"
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Escape') {
                                                    setRegularIngredientSearchOpen(null);
                                                    setRegularSearchTerm("");
                                                  }
                                                }}
                                              />
                                            </div>
                                            
                                            {/* Custom Results List */}
                                            <div 
                                              className="flex-1 overflow-y-scroll overscroll-contain pointer-events-auto"
                                              style={{ 
                                                maxHeight: '300px',
                                                overscrollBehavior: 'contain',
                                                touchAction: 'pan-y',
                                                WebkitOverflowScrolling: 'touch',
                                              }}
                                              onWheel={(e) => e.stopPropagation()}
                                              onTouchStart={(e) => e.stopPropagation()}
                                              tabIndex={0}
                                            >
                                              {(() => {
                                                if (loading && ingredientOptions.length === 0) {
                                                  return (
                                                    <div className="p-4 text-center text-muted-foreground">
                                                      Loading ingredients...
                                                    </div>
                                                  );
                                                }

                                                if (filteredIngredientOptions.length === 0) {
                                                  return (
                                                    <div className="p-4 text-center text-muted-foreground text-sm">
                                                      {ingredientOptions.length === 0 ? "No ingredients available" : "No matching ingredients found"}
                                                    </div>
                                                  );
                                                }

                                                return filteredIngredientOptions.map((option) => (
                                                  <div
                                                    key={option.value}
                                                    className="cursor-pointer py-3 px-3 hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/50 last:border-b-0"
                                                    onClick={() => {
                                                      handleIngredientSelection(index, option);
                                                      // Also update the materialName field for the editable input
                                                      form.setValue(`ingredients.${index}.materialName`, option.materialName);
                                                    }}
                                                  >
                                                    <div className="flex flex-col w-full gap-1">
                                                      <span className="font-medium text-sm">{option.materialName}</span>
                                                      <span className="text-xs text-muted-foreground">
                                                        Code: {option.materialCode} | 
                                                        {option.lotNumber && ` Lot #${option.lotNumber} |`}
                                                        Vendor: {option.vendor} | 
                                                        Qty: {option.quantity}{option.unit}
                                                      </span>
                                                    </div>
                                                  </div>
                                                ));
                                              })()}
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                     </FormControl>
                                     <FormMessage />
                                   </FormItem>
                                 )}
                               />
                             </div>
                            
                             <div className="md:col-span-2">
                               <FormField
                                 control={form.control}
                                 name={`ingredients.${index}.vendor`}
                                 render={({ field }) => {
                                   console.log(`🔍 Vendor field render for ingredient ${index}:`, field.value);
                                   return (
                                     <FormItem>
                                       <FormLabel>Vendor</FormLabel>
                                       <FormControl>
                                         <Input 
                                           {...field} 
                                           placeholder="Enter vendor"
                                           className="h-10"
                                           onChange={(e) => {
                                             console.log(`🔍 Vendor field changed for ingredient ${index}:`, e.target.value);
                                             field.onChange(e);
                                           }}
                                         />
                                       </FormControl>
                                       <FormMessage />
                                     </FormItem>
                                   );
                                 }}
                               />
                             </div>

                               <FormField
                                 control={form.control}
                                 name={`ingredients.${index}.lotNumber`}
                                 render={({ field }) => (
                                   <FormItem>
                                     <FormLabel>Lot Number</FormLabel>
                                     <FormControl>
                                       <Input 
                                         {...field} 
                                         placeholder="Enter lot number"
                                         className="h-10"
                                       />
                                     </FormControl>
                                     <FormMessage />
                                   </FormItem>
                                 )}
                               />

                               {/* Unified Weight Input with Unit Selector */}
                               <div className="md:col-span-2 flex gap-2">
                                 <FormField
                                   control={form.control}
                                   name={`ingredients.${index}.weightInput`}
                                   render={({ field }) => (
                                     <FormItem className="flex-1">
                                       <FormLabel>Weight</FormLabel>
                                       <FormControl>
                                         <Input 
                                           type="number" 
                                           step="any"
                                           min="0"
                                           placeholder="0"
                                           className="h-10"
                                           {...field} 
                                           value={field.value ?? ""}
                                           onChange={e => {
                                             const value = e.target.value;
                                             const numValue = value === "" ? 0 : Number(value);
                                             field.onChange(numValue >= 0 ? numValue : 0);
                                             
                                             // Auto-convert to kg for storage
                                             const unit = form.getValues(`ingredients.${index}.weightUnit`) || 'g';
                                             const kg = convertToKg(numValue >= 0 ? numValue : 0, unit);
                                             form.setValue(`ingredients.${index}.weightKg`, kg, { shouldValidate: false });
                                           }}
                                         />
                                       </FormControl>
                                       <FormMessage />
                                     </FormItem>
                                   )}
                                 />
                                 
                                 <FormField
                                   control={form.control}
                                   name={`ingredients.${index}.weightUnit`}
                                   render={({ field }) => (
                                     <FormItem className="w-20">
                                       <FormLabel>&nbsp;</FormLabel>
                                       <Select 
                                         value={field.value || 'g'} 
                                         onValueChange={(newUnit: 'kg' | 'g') => {
                                           field.onChange(newUnit);
                                           
                                           // Recalculate kg when unit changes
                                           const inputValue = form.getValues(`ingredients.${index}.weightInput`) || 0;
                                           const kg = convertToKg(inputValue, newUnit);
                                           form.setValue(`ingredients.${index}.weightKg`, kg, { shouldValidate: false });
                                         }}
                                       >
                                         <SelectTrigger className="h-10">
                                           <SelectValue />
                                         </SelectTrigger>
                                         <SelectContent>
                                           <SelectItem value="kg">kg</SelectItem>
                                           <SelectItem value="g">g</SelectItem>
                                         </SelectContent>
                                       </Select>
                                     </FormItem>
                                   )}
                                 />
                               </div>

                                 {/* Cooker Column */}
                                 <FormField
                                   control={form.control}
                                   name={`ingredients.${index}.vessel`}
                                   render={({ field }) => (
                                     <FormItem>
                                       <FormLabel className="text-xs text-center block">Cooker</FormLabel>
                                       <div className="flex justify-center">
                                         <button
                                           type="button"
                                           onClick={() => {
                                             const currentValue = field.value;
                                             field.onChange(currentValue === 'cooker' ? null : 'cooker');
                                           }}
                                           className={`w-10 h-10 rounded-full text-xs font-semibold transition-all duration-200 ${
                                             field.value === 'cooker'
                                               ? 'bg-green-600 text-white shadow-md'
                                               : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                                           }`}
                                           title="Send this ingredient to Cooker"
                                         >
                                           C
                                         </button>
                                       </div>
                                     </FormItem>
                                   )}
                                 />

                                 {/* Holding Column */}
                                 <FormField
                                   control={form.control}
                                   name={`ingredients.${index}.vessel`}
                                   render={({ field }) => (
                                     <FormItem>
                                       <FormLabel className="text-xs text-center block">Holding</FormLabel>
                                       <div className="flex justify-center">
                                         <button
                                           type="button"
                                           onClick={() => {
                                             const currentValue = field.value;
                                             field.onChange(currentValue === 'holding' ? null : 'holding');
                                           }}
                                           className={`w-10 h-10 rounded-full text-xs font-semibold transition-all duration-200 ${
                                             field.value === 'holding'
                                               ? 'bg-yellow-500 text-black shadow-md'
                                               : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                                           }`}
                                           title="Send this ingredient to Holding"
                                         >
                                           H
                                         </button>
                                       </div>
                                     </FormItem>
                                   )}
                                 />

                                 {/* Delete Column */}
                                 <FormItem>
                                   <FormLabel className="text-xs text-center block opacity-0">Delete</FormLabel>
                                   <div className="flex justify-center">
                                     <Button
                                       type="button"
                                       onClick={() => openDeleteConfirmation(index, 'regular')}
                                       size="sm"
                                       variant="outline"
                                       className="w-10 h-10 p-0 text-destructive hover:text-destructive"
                                     >
                                       <Trash2 className="h-4 w-4" />
                                     </Button>
                                   </div>
                                 </FormItem>
                            </div>
                           );
                         })}
                      </div>
                   </CardContent>
                 </Card>
               </TabsContent>

               {/* Procedure Section */}
               <TabsContent value="procedure" className="space-y-6 mt-0 data-[state=active]:block data-[state=inactive]:hidden relative">
                 <Card>
                   <CardHeader>
                     <CardTitle>Manufacturing Procedure</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <FormField
                       control={form.control}
                       name="procedureText"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Instructions</FormLabel>
                           <FormControl>
                             <Textarea 
                               {...field} 
                               placeholder="Enter detailed manufacturing procedure..."
                               className="min-h-[300px] resize-none"
                             />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                   </CardContent>
                 </Card>
                </TabsContent>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex-shrink-0 flex justify-between items-center p-6 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleSaveDraft}
                    disabled={saving || savingDraft}
                  >
                    {savingDraft ? 'Saving Draft...' : 'Save Draft'}
                  </Button>
                  <Button type="submit" disabled={saving || savingDraft}>
                    {saving ? 'Saving...' : (editingFormula ? 'Update Formula' : 'Save Formula')}
                  </Button>
                </div>
              </div>
            </Tabs>
          </form>
        </Form>

       {/* Delete Confirmation Modal */}
       <DeleteConfirmationModal
         isOpen={deleteConfirmation.isOpen}
         onClose={() => setDeleteConfirmation({ isOpen: false, index: -1, type: 'regular' })}
         onConfirm={handleDeleteConfirmation}
         title="Delete Ingredient"
         description={`Are you sure you want to delete this ${deleteConfirmation.type} ingredient? This action cannot be undone.`}
       />
      </DialogContent>
    </Dialog>
    </>
  );
}