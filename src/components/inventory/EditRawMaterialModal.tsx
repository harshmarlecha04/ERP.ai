import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Trash2, FileText, Eye, Link, ExternalLink, Check, ChevronsUpDown } from "lucide-react";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { RawMaterial } from "@/types/inventory";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import { useVendors } from "@/hooks/useVendors";

const formSchema = z.object({
  name: z.string().min(1, "Material name is required"),
  code: z.string().min(1, "RM code is required"),
  supplier: z.string().optional(),
  unit_of_measure: z.string().min(1, "Unit of measurement is required"),
  lots: z.array(z.object({
    id: z.string().optional(),
    lot_number: z.string().optional(),
    quantity: z.number().min(0, "Quantity must be 0 or greater"),
    expiry_date: z.string().optional(),
    receiving_date: z.string().optional(),
    cost: z.number().min(0, "Cost must be 0 or greater").optional(),
    coa_link: z.string().optional(),
  })),
});

type FormData = z.infer<typeof formSchema>;

interface EditRawMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: RawMaterial | null;
  onSuccess?: () => void;
}


const uomOptions = ["kg", "g", "L", "mL", "lbs", "Oz", "gallon"];

export function EditRawMaterialModal({ isOpen, onClose, material, onSuccess }: EditRawMaterialModalProps) {
  const { updateRawMaterial } = useRawMaterials();
  const { vendors, loading: vendorsLoading } = useVendors();
  const { toast } = useToast();
  const [lotToRemove, setLotToRemove] = useState<number | null>(null);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  
  // Debug logging
  console.log('EditRawMaterialModal rendered with vendors:', vendors.length, 'vendors, loading:', vendorsLoading);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      supplier: "",
      unit_of_measure: "",
      lots: [],
    },
  });

  const formatDateToMMDDYYYY = (dateStr: string): string => {
    const date = parseISO(dateStr);
    return format(date, "MM/dd/yyyy");
  };

  const formatMMDDYYYY = (date: Date): string => {
    return format(date, "MM/dd/yyyy");
  };

  const parseMMDDYYYYToISO = (mmddyyyy: string): string | null => {
    const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = mmddyyyy.match(dateRegex);
    if (match) {
      const [, month, day, year] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (date.getFullYear() == parseInt(year) && 
          date.getMonth() == parseInt(month) - 1 && 
          date.getDate() == parseInt(day)) {
        return format(date, "yyyy-MM-dd");
      }
    }
    return null;
  };

  useEffect(() => {
    if (material) {
      console.log('Loading material for editing:', material);
      console.log('Material lots:', material.lots);
      
      const formattedLots = material.lots.map((lot, index) => {
        console.log(`Lot ${index + 1}:`, lot);
        console.log(`  - receiving_date from lot:`, lot.receiving_date);
        console.log(`  - expires_on from lot:`, lot.expires_on);
        console.log(`  - cost from lot:`, lot.cost);
        
        return {
          id: lot.id,
          lot_number: lot.lot_number,
          quantity: lot.quantity,
          expiry_date: lot.expires_on ? formatDateToMMDDYYYY(lot.expires_on) : "",
          receiving_date: lot.receiving_date ? formatDateToMMDDYYYY(lot.receiving_date) : "",
          cost: (lot.cost === null || lot.cost === undefined || lot.cost === 0) ? undefined : lot.cost,
          coa_link: lot.coa_link || "",
        };
      });

      console.log('Formatted lots for form:', formattedLots);

      // Force form reset with new values
      form.reset({
        name: material.name,
        code: material.code,
        supplier: material.supplier,
        unit_of_measure: material.unit_of_measure,
        lots: formattedLots,
      });
      
      // Force re-render by manually triggering form update
      setTimeout(() => {
        form.setValue("lots", formattedLots);
      }, 0);
    }
  }, [material, form]);

  const onSubmit = async (data: FormData) => {
    if (!material) return;

    console.log('Form submit data:', data);

    // Validate all dates before saving
    for (let i = 0; i < data.lots.length; i++) {
      const lot = data.lots[i];
      if (lot.expiry_date && !parseMMDDYYYYToISO(lot.expiry_date)) {
        toast({
          title: "Validation Error",
          description: `Lot ${i + 1}: Enter a valid expiry date in MM/DD/YYYY format.`,
          variant: "destructive",
        });
        return;
      }
      if (lot.receiving_date && !parseMMDDYYYYToISO(lot.receiving_date)) {
        toast({
          title: "Validation Error",
          description: `Lot ${i + 1}: Enter a valid receiving date in MM/DD/YYYY format.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const updateData = {
        name: data.name,
        code: data.code,
        supplier: data.supplier || null,
        unit_of_measure: data.unit_of_measure,
        lots: data.lots.map(lot => {
          const processedLot = {
            id: lot.id,
            lot_number: lot.lot_number || null,
            quantity: lot.quantity,
            expires_on: lot.expiry_date ? parseMMDDYYYYToISO(lot.expiry_date) : null,
            receiving_date: lot.receiving_date ? parseMMDDYYYYToISO(lot.receiving_date) : null,
            cost: lot.cost || 0,
            coa_link: lot.coa_link?.trim() || null,
          };
          console.log('Processing lot for save:', lot, '-> processed:', processedLot);
          return processedLot;
        }),
      };

      console.log('Submitting update with data:', updateData);
      await updateRawMaterial(material.id, updateData);
      
      console.log('Update completed successfully');
      
      // Close modal - optimistic updates and toasts are handled by the hook
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Failed to update material:', error);
      // Error handling and rollback is already done by the hook
      // Keep modal open so user can fix issues and retry
    }
  };

  const addLot = () => {
    const currentLots = form.getValues("lots");
    
    const newLot = {
      lot_number: "",
      quantity: 0,
      cost: undefined,
      expiry_date: "",
      receiving_date: "",
      coa_link: "",
    };
    
    form.setValue("lots", [...currentLots, newLot]);
  };

  const removeLot = (index: number) => {
    setLotToRemove(index);
  };

  const confirmRemoveLot = () => {
    if (lotToRemove !== null) {
      const currentLots = form.getValues("lots");
      form.setValue("lots", currentLots.filter((_, i) => i !== lotToRemove));
      setLotToRemove(null);
    }
  };

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

  const lots = form.watch("lots");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:64rem] max-h-[min(calc(100vh-4rem),calc(100dvh-4rem))] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit Raw Material</DialogTitle>
          <DialogDescription>
            Update the raw material information including lot details, quantities, and COA links.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-y-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
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
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RM Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter RM code" {...field} />
                    </FormControl>
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
                  
                  console.log('Vendor field rendering, vendors:', vendors.length, 'filtered:', filteredVendors.length);
                  
                  return (
                    <FormItem>
                      <FormLabel>Vendor <span className="text-muted-foreground">(Optional)</span></FormLabel>
                      <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={vendorOpen}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value || "Select vendor..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
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
              
              <FormField
                control={form.control}
                name="unit_of_measure"
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
                  Add Lot
                </Button>
              </div>

              {lots.map((lot, index) => {
                const lotId = lot.id || `new-${index}`;
                const existingLot = material?.lots.find(l => l.id === lot.id);
                
                return (
                  <div key={lotId} className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Lot {index + 1}</h4>
                      <div className="flex items-center gap-2">
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
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`lots.${index}.lot_number`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lot Number <span className="text-muted-foreground">(Optional)</span></FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter lot number" 
                                {...field}
                              />
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
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              value={field.value === 0 ? "" : field.value}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === "" ? 0 : parseFloat(value) || 0);
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
                        name={`lots.${index}.cost`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost per Unit ($)</FormLabel>
                            <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                               placeholder=""
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
                        name={`lots.${index}.receiving_date`}
                        render={({ field }) => {
                          const [isReceivingPickerOpen, setIsReceivingPickerOpen] = useState(false);
                          
                          return (
                            <FormItem className="flex flex-col justify-end">
                              <FormLabel>Receiving Date (Optional)</FormLabel>
                              <div className="relative flex">
                                <FormControl>
                                  <Input
                                    placeholder="MM/DD/YYYY"
                                    value={field.value ?? ""}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      // Allow only digits and slashes
                                      if (value && !/^[\d/]*$/.test(value)) {
                                        return;
                                      }
                                      field.onChange(value);
                                    }}
                                    onClick={() => setIsReceivingPickerOpen(true)}
                                    className={cn(
                                      "pr-10 cursor-pointer",
                                      field.value && !parseMMDDYYYYToISO(field.value) ? "border-destructive" : ""
                                    )}
                                  />
                                </FormControl>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-accent"
                                  type="button"
                                  onClick={() => setIsReceivingPickerOpen(true)}
                                >
                                  <CalendarIcon className="h-4 w-4" />
                                </Button>
                              </div>
                              {field.value && !parseMMDDYYYYToISO(field.value) && (
                                <p className="text-sm text-destructive">Enter a valid receiving date.</p>
                              )}
                              <FormMessage />
                              
                              <Dialog open={isReceivingPickerOpen} onOpenChange={setIsReceivingPickerOpen}>
                                <DialogContent className="max-w-md p-0">
                                  <Calendar
                                    mode="single"
                                    selected={field.value ? (() => {
                                      const isoDate = parseMMDDYYYYToISO(field.value);
                                      return isoDate ? parseISO(isoDate) : undefined;
                                    })() : new Date()}
                                    onSelect={(date) => {
                                      if (date) {
                                        field.onChange(formatMMDDYYYY(date));
                                        setIsReceivingPickerOpen(false);
                                      }
                                    }}
                                    initialFocus
                                    className="p-3 pointer-events-auto"
                                  />
                                </DialogContent>
                              </Dialog>
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name={`lots.${index}.expiry_date`}
                        render={({ field }) => {
                          const [isExpiryPickerOpen, setIsExpiryPickerOpen] = useState(false);
                          
                          return (
                            <FormItem className="flex flex-col justify-end">
                              <FormLabel>Expiry Date (Optional)</FormLabel>
                              <div className="relative flex">
                                <FormControl>
                                  <Input
                                    placeholder="MM/DD/YYYY"
                                    value={field.value ?? ""}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      // Allow only digits and slashes
                                      if (value && !/^[\d/]*$/.test(value)) {
                                        return;
                                      }
                                      field.onChange(value);
                                    }}
                                    onClick={() => setIsExpiryPickerOpen(true)}
                                    className={cn(
                                      "pr-10 cursor-pointer",
                                      field.value && !parseMMDDYYYYToISO(field.value) ? "border-destructive" : ""
                                    )}
                                  />
                                </FormControl>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-accent"
                                  type="button"
                                  onClick={() => setIsExpiryPickerOpen(true)}
                                >
                                  <CalendarIcon className="h-4 w-4" />
                                </Button>
                              </div>
                              {field.value && !parseMMDDYYYYToISO(field.value) && (
                                <p className="text-sm text-destructive">Enter a valid expiry date.</p>
                              )}
                              <FormMessage />
                              
                              <Dialog open={isExpiryPickerOpen} onOpenChange={setIsExpiryPickerOpen}>
                                <DialogContent className="max-w-md p-0">
                                  <Calendar
                                    mode="single"
                                    selected={field.value ? (() => {
                                      const isoDate = parseMMDDYYYYToISO(field.value);
                                      return isoDate ? parseISO(isoDate) : undefined;
                                    })() : new Date()}
                                    onSelect={(date) => {
                                      if (date) {
                                        field.onChange(formatMMDDYYYY(date));
                                        setIsExpiryPickerOpen(false);
                                      }
                                    }}
                                    initialFocus
                                    className="p-3 pointer-events-auto"
                                  />
                                </DialogContent>
                              </Dialog>
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`lots.${index}.coa_link`}
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
                );
              })}
            </div>

            
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
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