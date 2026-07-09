import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, Trash2, Loader2, Check, ChevronsUpDown } from "lucide-react";
import type { RawMaterial, RawMaterialForm } from "@/types/inventory";
import { useVendors } from "@/hooks/useVendors";
import { cn } from "@/lib/utils";

const lotSchema = z.object({
  id: z.string().optional().nullable(),
  lot_number: z.string().optional().nullable(),
  quantity: z.number().min(0, "Quantity must be 0 or greater"),
  cost: z.number().min(0, "Cost must be 0 or greater").optional(),
  receiving_date: z.string().optional().nullable(),
  expires_on: z.string().optional().nullable(),
});

const rawMaterialSchema = z.object({
  id: z.string().optional().nullable(),
  code: z.string().min(1, "Material code is required"),
  name: z.string().min(1, "Material name is required"),
  uom: z.string().min(1, "Unit of measure is required"),
  supplier: z.string().optional().nullable(),
  density_kg_per_l: z.number().positive("Density must be positive").optional().nullable(),
  lots: z.array(lotSchema),
});

type FormData = z.infer<typeof rawMaterialSchema>;

interface RawMaterialModalProps {
  open: boolean;
  initial: RawMaterial | null;
  onClose: () => void;
  onSave: (data: RawMaterialForm) => Promise<void>;
  saving: boolean;
}

export function RawMaterialModal({
  open,
  initial,
  onClose,
  onSave,
  saving,
}: RawMaterialModalProps) {
  const { vendors, loading: vendorsLoading } = useVendors();
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  
  const form = useForm<FormData>({
    resolver: zodResolver(rawMaterialSchema),
    defaultValues: {
      id: null,
      code: "",
      name: "",
      uom: "kg",
      supplier: "",
      density_kg_per_l: null,
      lots: [{ lot_number: "", quantity: 0, cost: 0, receiving_date: "", expires_on: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lots",
  });

  // Reset form when modal opens/closes or initial data changes
  useEffect(() => {
    if (open) {
      // Reset vendor dropdown states
      setVendorOpen(false);
      setVendorSearch("");
      
      if (initial) {
        form.reset({
          id: initial.id,
          code: initial.code,
          name: initial.name,
          uom: initial.uom,
          supplier: initial.supplier || "",
          density_kg_per_l: initial.density_kg_per_l || null,
          lots: initial.lots.length > 0 
            ? initial.lots.map(lot => ({
                id: lot.id,
                lot_number: lot.lot_number || "",
                quantity: lot.quantity,
                cost: lot.cost,
                receiving_date: lot.receiving_date || "",
                expires_on: lot.expires_on || "",
              }))
            : [{ id: null, lot_number: "", quantity: 0, cost: 0, receiving_date: "", expires_on: "" }],
        });
      } else {
        form.reset({
          id: null,
          code: "",
          name: "",
          uom: "kg",
          supplier: "",
          density_kg_per_l: null,
          lots: [{ id: null, lot_number: "", quantity: 0, cost: 0, receiving_date: "", expires_on: "" }],
        });
      }
    } else {
      // Reset vendor dropdown states when modal closes
      setVendorOpen(false);
      setVendorSearch("");
    }
  }, [open, initial, form]);

  const handleSubmit = async (data: FormData) => {
    try {
      console.log('Form data before processing:', data);
      
      // Transform form data: ensure proper types and null handling
      const processedLots = data.lots.map(lot => ({
        ...lot,
        lot_number: lot.lot_number?.trim() || null,
        quantity: typeof lot.quantity === 'number' ? lot.quantity : Number(lot.quantity) || 0,
        cost: typeof lot.cost === 'number' ? lot.cost : Number(lot.cost) || 0,
        receiving_date: lot.receiving_date?.trim() ? lot.receiving_date.trim() : null,
        expires_on: lot.expires_on?.trim() ? lot.expires_on.trim() : null,
      }));

      // Merge duplicate lots (same lot_number, receiving_date, expires_on) by summing quantities
      const lotsMap = new Map<string, any>();
      processedLots.forEach(lot => {
        const key = `${lot.lot_number || ''}-${lot.receiving_date || ''}-${lot.expires_on || ''}`;
        if (lotsMap.has(key)) {
          const existing = lotsMap.get(key);
          existing.quantity += lot.quantity;
          // Keep the higher cost for merged lots
          existing.cost = Math.max(existing.cost, lot.cost);
        } else {
          lotsMap.set(key, { ...lot });
        }
      });

      const processedData: RawMaterialForm = {
        ...data,
        supplier: data.supplier?.trim() || null,
        lots: Array.from(lotsMap.values()),
      };

      console.log('Processed data being passed to onSave:', processedData);
      console.log('Is update mode:', !!processedData.id);
      
      await onSave(processedData);
    } catch (error) {
      console.error('Save error in modal:', error);
      // Error handling is now done in the hook's onError callback
    }
  };

  const addLot = () => {
    append({ id: null, lot_number: "", quantity: 0, cost: 0, receiving_date: "", expires_on: "" });
  };

  const removeLot = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:64rem] max-h-[min(calc(100vh-4rem),calc(100dvh-4rem))] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {initial ? "Edit Raw Material" : "Add Raw Material"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 min-w-0">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., RM001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Sodium Chloride" />
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
                      <FormLabel>Unit of Measure</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., kg, L, pcs" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="density_kg_per_l"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Density (kg/L) - Optional</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="e.g., 1.0 for water"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === "" ? null : Number(value));
                          }}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Required for volume↔weight conversions (e.g., gallons to kg)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplier"
                  render={({ field }) => {
                    const filteredVendors = vendors.filter(vendor =>
                      vendor.name.toLowerCase().includes(vendorSearch.toLowerCase())
                    );
                    
                    return (
                      <FormItem>
                        <FormLabel>Vendor (Optional)</FormLabel>
                        <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={vendorOpen}
                                className={cn(
                                  "w-full justify-between min-w-0 overflow-hidden",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <span className="flex-1 min-w-0 truncate text-left">
                                  {field.value || "Select vendor..."}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Search vendors..."
                                value={vendorSearch}
                                onValueChange={setVendorSearch}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {vendorsLoading ? "Loading vendors..." : "No vendors found."}
                                </CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value=""
                                    onSelect={() => {
                                      field.onChange("");
                                      setVendorOpen(false);
                                      setVendorSearch("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        !field.value ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    No vendor
                                  </CommandItem>
                                  {filteredVendors.map((vendor) => (
                                    <CommandItem
                                      key={vendor.id}
                                      value={vendor.name}
                                      onSelect={() => {
                                        field.onChange(vendor.name);
                                        setVendorOpen(false);
                                        setVendorSearch("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === vendor.name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {vendor.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </CardContent>
            </Card>

            {/* Lots Section */}
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                <CardTitle className="text-lg">Inventory Lots</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLot}
                  className="gap-2 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Add Lot
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 min-w-0">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 border rounded-lg min-w-0"
                  >
                    <FormField
                      control={form.control}
                      name={`lots.${index}.lot_number`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lot Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Lot #" />
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
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lots.${index}.cost`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === "" ? 0 : Number(value));
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lots.${index}.receiving_date`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receiving Date</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="date"
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`lots.${index}.expires_on`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiry Date</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="date"
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeLot(index)}
                        disabled={fields.length === 1}
                        className="w-full gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {initial ? "Update Material" : "Create Material"}
              </Button>
            </div>
          </form>
        </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}