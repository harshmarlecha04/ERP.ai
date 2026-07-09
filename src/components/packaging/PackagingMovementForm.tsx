import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreatePackagingMovement, useCreatePackagingItem, usePackagingItems } from "@/hooks/usePackagingInventory";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const movementSchema = z.object({
  category: z.enum(['BOTTLES', 'CAPS', 'POUCHES', 'CORRUGATED']),
  item_name: z.string().min(1, "Item name is required"),
  move_date: z.date(),
  qty: z.number().positive("Quantity must be positive"),
  bottles_per_unit: z.number().int().min(1, "Bottles per unit must be at least 1"),
  po: z.string().optional(),
  vendor: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

type MovementFormData = z.infer<typeof movementSchema>;

interface PackagingMovementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movementType: 'RECEIPT' | 'USAGE' | 'ADJUSTMENT';
  preselectedCategory?: 'BOTTLES' | 'CAPS' | 'POUCHES' | 'CORRUGATED';
  preselectedItemId?: string;
}

export const PackagingMovementForm: React.FC<PackagingMovementFormProps> = ({
  open,
  onOpenChange,
  movementType,
  preselectedCategory,
  preselectedItemId,
}) => {
  const [isNewItem, setIsNewItem] = useState(false);
  const createMovement = useCreatePackagingMovement();
  const createItem = useCreatePackagingItem();
  const { data: items = [] } = usePackagingItems();

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      category: preselectedCategory || 'BOTTLES',
      item_name: "",
      move_date: new Date(),
      qty: 0,
      bottles_per_unit: 24,
      po: "",
      vendor: "",
      location: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (preselectedCategory) {
      form.setValue("category", preselectedCategory);
    }
  }, [preselectedCategory, form]);

  const watchedCategory = form.watch("category");
  const filteredItems = items.filter(item => item.category === watchedCategory);

  const onSubmit = async (data: MovementFormData) => {
    try {
      let itemId: string;

      if (isNewItem) {
        // Create new item first
        const newItem = await createItem.mutateAsync({
          category: data.category,
          item_name: data.item_name,
          uom: 'ea',
          min_level: 0,
          bottles_per_unit: data.bottles_per_unit,
          location: data.location,
          customer_id: null,
        });
        itemId = newItem.id;
      } else {
        // Find existing item
        const existingItem = filteredItems.find(item => item.item_name === data.item_name);
        if (!existingItem) {
          throw new Error("Selected item not found");
        }
        itemId = existingItem.id;
      }

      // Create movement
      let finalQty = data.qty;
      let packableBottles = 0;
      
      if (movementType === 'USAGE') {
        finalQty = -Math.abs(data.qty); // Ensure negative for usage
        packableBottles = -(Math.abs(data.qty) * data.bottles_per_unit); // Negative for usage
      } else if (movementType === 'ADJUSTMENT') {
        // For adjustments, allow both positive and negative
        packableBottles = data.qty * data.bottles_per_unit;
      } else {
        // Receipt
        packableBottles = data.qty * data.bottles_per_unit;
      }

      await createMovement.mutateAsync({
        item_id: itemId,
        move_date: format(data.move_date, 'yyyy-MM-dd'),
        move_type: movementType,
        qty: finalQty,
        packable_bottles: packableBottles,
        po: data.po || undefined,
        vendor: data.vendor || undefined,
        location: data.location || undefined,
        notes: data.notes || undefined,
      });

      form.reset();
      setIsNewItem(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create movement:", error);
    }
  };

  const getFormTitle = () => {
    const categoryName = preselectedCategory ? preselectedCategory.charAt(0) + preselectedCategory.slice(1).toLowerCase() : 'Packaging';
    switch (movementType) {
      case 'RECEIPT': return `Receive ${categoryName}`;
      case 'USAGE': return `Use/Consume ${categoryName}`;
      case 'ADJUSTMENT': return `Adjust ${categoryName} Inventory`;
      default: return `${categoryName} Movement`;
    }
  };

  const getFormDescription = () => {
    switch (movementType) {
      case 'RECEIPT': return 'Record incoming packaging materials';
      case 'USAGE': return 'Record packaging materials used in production';
      case 'ADJUSTMENT': return 'Adjust inventory quantities (use + for increase, - for decrease)';
      default: return 'Record packaging inventory movement';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getFormTitle()}</DialogTitle>
          <DialogDescription>{getFormDescription()}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Item Selection</FormLabel>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!isNewItem ? "default" : "outline"}
                  onClick={() => setIsNewItem(false)}
                  className="flex-1"
                >
                  Existing Item
                </Button>
                <Button
                  type="button"
                  variant={isNewItem ? "default" : "outline"}
                  onClick={() => setIsNewItem(true)}
                  className="flex-1"
                >
                  New Item
                </Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="item_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  {isNewItem ? (
                    <FormControl>
                      <Input placeholder="Enter new item name" {...field} />
                    </FormControl>
                  ) : (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select existing item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredItems.map((item) => (
                          <SelectItem key={item.id} value={item.item_name}>
                            {item.item_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="move_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
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
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="qty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Quantity {movementType === 'ADJUSTMENT' && '(+/- for increase/decrease)'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Enter quantity"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isNewItem && watchedCategory !== 'POUCHES' && (
              <FormField
                control={form.control}
                name="bottles_per_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bottles Per Unit</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter bottles per unit"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Number of bottles contained in each unit (e.g., 24 for a case of 24)
                    </p>
                  </FormItem>
                )}
              />
            )}

            {watchedCategory !== 'POUCHES' && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                <span className="text-sm font-medium">Packable Bottles:</span>
                <span className="text-sm font-semibold">{(form.watch("qty") * form.watch("bottles_per_unit")).toFixed(0)}</span>
              </div>
            )}

            {movementType === 'RECEIPT' && (
              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter vendor name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional notes"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMovement.isPending || createItem.isPending}
              >
                {createMovement.isPending || createItem.isPending ? "Processing..." : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};