import React, { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Trash2, AlertTriangle, Plus, Link, Eye, ExternalLink } from "lucide-react";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  rmName: z.string().min(1, "Material name is required"),
  rmCode: z.string().min(1, "RM code is required").refine(
    (code) => code.trim().length > 0,
    "RM code cannot be empty"
  ),
  supplier: z.string().optional(),
  uom: z.string().min(1, "Unit of measurement is required"),
  lots: z.array(z.object({
    lotNumber: z.string().optional(),
    quantity: z.number().optional(),
    receivingDate: z.date().optional(),
    expiryDate: z.date().optional(),
    costPerUom: z.number().optional(),
    coaLink: z.string().optional(),
  })).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface RawMaterialLot {
  id: string;
  lotNumber: string;
  quantity: number;
  expiryDate: string;
  status: 'active' | 'warning' | 'expired' | 'quarantined';
  costPerUom: number;
}

interface RawMaterial {
  rmCode: string;
  rmName: string;
  supplier: string;
  uom: string;
  lots: RawMaterialLot[];
  totalQuantity: number;
  totalCost: number;
}

interface AddRawMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const uomOptions = ["kg", "g", "L", "mL", "lbs", "Oz", "gallon"];

export function AddRawMaterialModal({ 
  isOpen, 
  onClose
}: AddRawMaterialModalProps) {
  const { createRawMaterial, rawMaterials } = useRawMaterials();
  const [supplierInput, setSupplierInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryData, setRetryData] = useState<{ material: any; idempotencyKey: string } | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rmName: "",
      rmCode: "",
      supplier: "",
      uom: "",
      lots: [],
    },
  });


  // Check for duplicate RM codes
  const checkDuplicateCode = (code: string): boolean => {
    return rawMaterials.some(material => 
      material.code.toUpperCase() === code.toUpperCase()
    );
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const lots = data.lots || [];
      const material = {
        code: data.rmCode.trim(),
        name: data.rmName.trim(),
        supplier: data.supplier?.trim() || null,
        unit_of_measure: data.uom,
        lots: lots.map(lot => ({
          lot_number: lot.lotNumber?.trim() || null,
          quantity: lot.quantity || 0,
          cost: lot.costPerUom || 0,
          receiving_date: lot.receivingDate ? format(lot.receivingDate, "yyyy-MM-dd") : null,
          expiry_date: lot.expiryDate ? format(lot.expiryDate, "yyyy-MM-dd") : null,
          coa_link: lot.coaLink?.trim() || null,
        }))
      };
      
      // Use existing idempotency key for retries, generate new one for fresh attempts
      const idempotencyKey = retryData ? retryData.idempotencyKey : undefined;
      
      const result = await createRawMaterial(material, idempotencyKey);
      
      // Store data for potential retry
      setRetryData({ material, idempotencyKey: result.idempotencyKey });
      
      // Close modal and reset form on successful submission
      handleClose();
    } catch (error) {
      console.error('Failed to create raw material:', error);
      
      // Store retry data for timeout/network errors
      if (error instanceof Error && (error as any).shouldRetry) {
        const lots = data.lots || [];
        const material = {
          code: data.rmCode.trim(),
          name: data.rmName.trim(),
          supplier: data.supplier?.trim() || null,
          unit_of_measure: data.uom,
          lots: lots.map(lot => ({
            lot_number: lot.lotNumber?.trim() || null,
            quantity: lot.quantity || 0,
            cost: lot.costPerUom || 0,
            receiving_date: lot.receivingDate ? format(lot.receivingDate, "yyyy-MM-dd") : null,
            expiry_date: lot.expiryDate ? format(lot.expiryDate, "yyyy-MM-dd") : null,
            coa_link: lot.coaLink?.trim() || null,
          }))
        };
        setRetryData({ material, idempotencyKey: (error as any).idempotencyKey });
      } else {
        setRetryData(null);
      }
      
      // Handle specific duplicate code error
      if (error instanceof Error && error.message.includes('already exists')) {
        form.setError("rmCode", {
          type: "manual",
          message: error.message
        });
      }
      // Other errors are handled by the hook with toast
      // Keep modal open so user can fix issues and retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (retryData) {
      onSubmit(form.getValues());
    }
  };

  const handleClose = () => {
    form.reset();
    setSupplierInput("");
    setRetryData(null);
    onClose();
  };

  const addLot = () => {
    const currentLots = form.getValues("lots") || [];
    form.setValue("lots", [
      ...currentLots,
      {
        lotNumber: "",
        quantity: undefined,
        receivingDate: undefined,
        expiryDate: undefined,
        costPerUom: undefined,
        coaLink: "",
      }
    ]);
  };

  const [lotToRemove, setLotToRemove] = useState<number | null>(null);

  const removeLot = (index: number) => {
    setLotToRemove(index);
  };

  const confirmRemoveLot = () => {
    if (lotToRemove !== null) {
      const currentLots = form.getValues("lots") || [];
      form.setValue("lots", currentLots.filter((_, i) => i !== lotToRemove));
      setLotToRemove(null);
    }
  };

  const handleSupplierInputChange = (value: string) => {
    setSupplierInput(value);
    form.setValue("supplier", value);
  };


  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear + i);

  const validateCoaLink = (url: string): boolean => {
    if (!url.trim()) return true; // Empty is valid
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleViewCOA = (url: string) => {
    if (validateCoaLink(url)) {
      window.open(url, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="[--dialog-max-width:42rem] max-h-[min(calc(100vh-4rem),calc(100dvh-4rem))] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Add New Raw Material</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rmName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter material name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="rmCode"
                render={({ field }) => (
                  <FormItem>
                      <FormLabel>RM Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter RM code" 
                        {...field}
                        onBlur={(e) => {
                          field.onBlur();
                          const code = e.target.value.trim();
                          if (code && checkDuplicateCode(code)) {
                            form.setError("rmCode", {
                              type: "manual",
                              message: `RM code "${code}" already exists. Please use a different code.`
                            });
                          } else {
                            form.clearErrors("rmCode");
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
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter supplier name"
                        value={supplierInput}
                        onChange={(e) => handleSupplierInputChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
                <FormField
                  control={form.control}
                  name="uom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit of Measurement</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {uomOptions.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Lot Information</h3>
                <Button type="button" onClick={addLot} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Lot
                </Button>
              </div>

              {(form.watch("lots") || []).map((lot, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Lot {index + 1}</h4>
                    <Button
                      type="button"
                      onClick={() => removeLot(index)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`lots.${index}.lotNumber`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lot Number (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter lot number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lots.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === "" ? undefined : parseFloat(value) || undefined);
                              }}
                              onFocus={(e) => e.target.select()}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lots.${index}.costPerUom`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost per Unit ($) (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === "" ? undefined : parseFloat(value) || undefined);
                              }}
                              onFocus={(e) => e.target.select()}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lots.${index}.receivingDate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receiving Date (Optional)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "MM/dd/yyyy")
                                  ) : (
                                    <span>mm/dd/yyyy</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lots.${index}.expiryDate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiry Date (Optional)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "MM/dd/yyyy")
                                  ) : (
                                    <span>mm/dd/yyyy</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date < new Date()
                                }
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                    <FormField
                      control={form.control}
                      name={`lots.${index}.coaLink`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>COA (Dropbox URL) (Optional)</FormLabel>
                          <FormControl>
                            <div className="flex items-center space-x-2">
                              <Link className="h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="https://..."
                                {...field}
                                className="flex-1"
                              />
                              {field.value && validateCoaLink(field.value) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewCOA(field.value)}
                                  className="p-2"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </FormControl>
                          {field.value && !validateCoaLink(field.value) && (
                            <p className="text-sm text-destructive">
                              Please enter a valid URL
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              {retryData && !isSubmitting && (
                <Button type="button" variant="secondary" onClick={handleRetry}>
                  Retry
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Material"}
              </Button>
            </div>
          </form>
        </Form>
        </div>
      </DialogContent>
      
      <DeleteConfirmationModal
        isOpen={lotToRemove !== null}
        onClose={() => setLotToRemove(null)}
        onConfirm={confirmRemoveLot}
        title="Remove Lot"
        description="Remove this lot?"
      />
    </Dialog>
  );
}