import React, { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  LabelInventoryRecord,
  useUpdateLabelInventoryRecord,
  useLabelInventory,
} from "@/hooks/useLabelInventory";
import { useCustomers } from "@/hooks/useCustomers";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Plus } from "lucide-react";
import { AddCustomerModal } from "@/components/orders/AddCustomerModal";

const TIMEZONE = "America/New_York"; // EST/EDT

const formSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  product_name: z.string().min(1, "Product name is required"),
  date: z.string().min(1, "Date is required"),
  received_qty: z.number().min(0, "Must be 0 or greater"),
  used_qty: z.number().min(0, "Must be 0 or greater"),
  on_hand: z.number().min(0, "Must be 0 or greater"),
});

type FormValues = z.infer<typeof formSchema>;

interface EditLabelInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: LabelInventoryRecord | null;
}

export const EditLabelInventoryModal: React.FC<EditLabelInventoryModalProps> = ({
  open,
  onOpenChange,
  record,
}) => {
  const { toast } = useToast();
  const updateRecord = useUpdateLabelInventoryRecord();
  const { customers } = useCustomers();
  const { data: labelInventory } = useLabelInventory();
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: "",
      product_name: "",
      date: "",
      received_qty: 0,
      used_qty: 0,
      on_hand: 0,
    },
  });

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

  useEffect(() => {
    if (record) {
      const receivedQty = record.received_qty || 0;
      const usedQty = record.used_qty || 0;
      const calculatedOnHand = receivedQty - usedQty;
      
      form.reset({
        customer_id: record.customer_id || "",
        product_name: record.product_name || record.customer_product,
        date: record.date,
        received_qty: receivedQty,
        used_qty: usedQty,
        on_hand: calculatedOnHand,
      });
    }
  }, [record, form]);

  // Auto-calculate on_hand when received_qty or used_qty changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'received_qty' || name === 'used_qty') {
        const received = value.received_qty || 0;
        const used = value.used_qty || 0;
        const calculated = received - used;
        form.setValue('on_hand', calculated, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = async (values: FormValues) => {
    if (!record) return;

    try {
      const customer = customers.find(c => c.id === values.customer_id);
      const customerProduct = customer ? `${customer.company_name} - ${values.product_name}` : values.product_name;

      await updateRecord.mutateAsync({
        id: record.id,
        customer_id: values.customer_id,
        product_name: values.product_name,
        customer_product: customerProduct,
        date: values.date,
        received_qty: values.received_qty,
        used_qty: values.used_qty,
        on_hand: values.on_hand,
      });

      toast({
        title: "Record Updated",
        description: "Label inventory record has been updated successfully.",
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update record. Please try again.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Label Inventory Record</DialogTitle>
          <DialogDescription>
            Update the label inventory details below.
            {record?.source_sheet && (
              <span className="block mt-2 text-xs">
                Source: {record.source_sheet}
              </span>
            )}
            {record?.created_at && (
              <span className="block text-xs">
                Created: {format(toZonedTime(new Date(record.created_at), TIMEZONE), "MMM dd, yyyy h:mm a")}
              </span>
            )}
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

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="received_qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Received</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
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
                    <FormLabel>Used</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
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
                        min="0"
                        step="1"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        disabled={true}
                        className="bg-muted"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateRecord.isPending}>
                {updateRecord.isPending ? "Saving..." : "Save Changes"}
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
