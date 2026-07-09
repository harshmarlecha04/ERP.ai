import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateLabelInventoryRecord, useLabelInventory } from "@/hooks/useLabelInventory";
import { useCustomers } from "@/hooks/useCustomers";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { AddCustomerModal } from "@/components/orders/AddCustomerModal";
import { formatET } from "@/utils/dateUtils";

const useLabelsSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  product_name: z.string().min(1, "Product name is required"),
  date: z.string().min(1, "Date is required"),
  used_qty: z.number().min(0, "Used quantity must be 0 or greater"),
  source_sheet: z.string().optional(),
});

type UseLabelsFormData = z.infer<typeof useLabelsSchema>;

interface UseLabelsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UseLabelsForm: React.FC<UseLabelsFormProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const createRecord = useCreateLabelInventoryRecord();
  const { customers } = useCustomers();
  const { data: labelInventory } = useLabelInventory();
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const form = useForm<UseLabelsFormData>({
    resolver: zodResolver(useLabelsSchema),
    defaultValues: {
      customer_id: "",
      product_name: "",
      date: formatET(new Date(), "yyyy-MM-dd"),
      used_qty: 0,
      source_sheet: "",
    },
  });

  // Get unique products for selected customer
  const customerProducts = useMemo(() => {
    const customerId = form.watch("customer_id");
    if (!customerId || !labelInventory) return [];
    
    const products = labelInventory
      .filter(item => item.customer_id === customerId && item.product_name)
      .map(item => item.product_name!)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort();
    
    return products;
  }, [form.watch("customer_id"), labelInventory]);

  const onSubmit = async (data: UseLabelsFormData) => {
    try {
      const customer = customers.find(c => c.id === data.customer_id);
      const customerProduct = customer ? `${customer.company_name} - ${data.product_name}` : data.product_name;
      
      await createRecord.mutateAsync({
        customer_product: customerProduct,
        date: data.date,
        received_qty: 0,
        used_qty: data.used_qty,
        on_hand: -data.used_qty,
        source_sheet: data.source_sheet || null,
        customer_id: data.customer_id,
        product_name: data.product_name,
      });

      toast({
        title: "Labels Used",
        description: `Successfully recorded ${data.used_qty} labels used for ${data.product_name}`,
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record label usage. Please try again.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Use Labels</DialogTitle>
          <DialogDescription>
            Record labels used from inventory
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <div className="flex gap-2">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowAddCustomer(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={!isCustomProduct ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsCustomProduct(false)}
                        disabled={!form.watch("customer_id")}
                      >
                        Select Existing
                      </Button>
                      <Button
                        type="button"
                        variant={isCustomProduct ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsCustomProduct(true)}
                      >
                        Enter New
                      </Button>
                    </div>
                    
                    {isCustomProduct ? (
                      <FormControl>
                        <Input
                          placeholder="Enter product name"
                          {...field}
                        />
                      </FormControl>
                    ) : (
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!form.watch("customer_id") || customerProducts.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={
                              !form.watch("customer_id") 
                                ? "Select customer first" 
                                : customerProducts.length === 0 
                                  ? "No products found - enter new" 
                                  : "Select product"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customerProducts.map((product) => (
                            <SelectItem key={product} value={product}>
                              {product}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="used_qty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Used Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="source_sheet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Sheet (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Source reference"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createRecord.isPending}>
                {createRecord.isPending ? "Recording..." : "Record Usage"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
      
      <AddCustomerModal
        open={showAddCustomer}
        onOpenChange={setShowAddCustomer}
      />
    </Dialog>
  );
};