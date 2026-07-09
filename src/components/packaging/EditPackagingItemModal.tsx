import React, { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useUpdatePackagingItem, usePackagingItemDetail } from "@/hooks/usePackagingInventory";
import { todayET } from "@/utils/dateUtils";

const editSchema = z.object({
  item_name: z.string().trim().min(1, "Item name is required").max(200, "Item name must be less than 200 characters"),
  on_hand: z.number().int().min(0, "On hand must be 0 or greater"),
  notes: z.string().trim().max(500, "Notes must be less than 500 characters").optional(),
});

type EditFormData = z.infer<typeof editSchema>;

interface EditPackagingItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
}

export const EditPackagingItemModal: React.FC<EditPackagingItemModalProps> = ({
  open,
  onOpenChange,
  itemId,
}) => {
  const queryClient = useQueryClient();
  const updateItem = useUpdatePackagingItem();
  const { data: item } = usePackagingItemDetail(itemId || "");
  
  // Fetch balance to get current on_hand
  const { data: balances } = useQuery({
    queryKey: ["packaging-balance-for-edit", itemId],
    queryFn: async () => {
      if (!itemId) return null;
      const { data, error } = await supabase
        .from("v_packaging_balances")
        .select("*")
        .eq("item_id", itemId)
        .single();
      if (error) throw error;
      return data as { on_hand: number; category: string };
    },
    enabled: !!itemId,
  });


  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      item_name: "",
      on_hand: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (item && balances) {
      form.reset({
        item_name: item.item_name,
        on_hand: balances.on_hand || 0,
        notes: item.notes || "",
      });
    }
  }, [item, balances, form]);

  const onSubmit = async (data: EditFormData) => {
    if (!itemId || !balances) return;

    try {
      // Update item name and notes
      await updateItem.mutateAsync({
        id: itemId,
        item_name: data.item_name,
        notes: data.notes,
      });

      // If on_hand changed, create an adjustment movement
      const currentOnHand = balances.on_hand || 0;
      const newOnHand = data.on_hand;
      const adjustment = newOnHand - currentOnHand;

      if (adjustment !== 0) {
        await supabase
          .from("packaging_movement")
          .insert({
            item_id: itemId,
            move_date: todayET(),
            move_type: 'ADJUSTMENT',
            qty: adjustment,
            notes: `Adjusted from ${currentOnHand} to ${newOnHand}`,
          });
        
        // Invalidate queries to refresh the data immediately
        queryClient.invalidateQueries({ queryKey: ["packaging-balances"] });
        queryClient.invalidateQueries({ queryKey: ["packaging-history"] });
        queryClient.invalidateQueries({ queryKey: ["packaging-balance-for-edit"] });
        queryClient.invalidateQueries({ queryKey: ["packaging-summary"] });
        queryClient.invalidateQueries({ queryKey: ["packaging-stats"] });
      }

      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update item:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Packaging Item</DialogTitle>
          <DialogDescription>Update the packaging item details</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="item_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter item name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="on_hand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>On Hand</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Enter quantity on hand"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
            </FormItem>
              )}
            />

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
                disabled={updateItem.isPending}
              >
                {updateItem.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
