import React, { useState, useMemo, useEffect } from "react";
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
import { useUpdateOrCreateLabelInventory, useLabelInventory } from "@/hooks/useLabelInventory";
import { useCustomers } from "@/hooks/useCustomers";
import { format } from "date-fns";
import { Plus, History, ChevronDown, ChevronUp } from "lucide-react";
import { AddCustomerModal } from "@/components/orders/AddCustomerModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CustomerPOSelect } from "./CustomerPOSelect";
import { formatET } from "@/utils/dateUtils";

const receiveLabelsSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  product_name: z.string().min(1, "Product name is required"),
  date: z.string().min(1, "Date is required"),
  received_qty: z.number().min(0, "Received quantity must be 0 or greater"),
  source_sheet: z.string().optional(),
  lot_number: z.string().optional(),
  order_header_id: z.string().nullable().optional(),
});

type ReceiveLabelsFormData = z.infer<typeof receiveLabelsSchema>;

interface ReceiveLabelsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReceiveLabelsForm: React.FC<ReceiveLabelsFormProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const updateOrCreateRecord = useUpdateOrCreateLabelInventory();
  const { customers } = useCustomers();
  const { data: labelInventory } = useLabelInventory();
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  const form = useForm<ReceiveLabelsFormData>({
    resolver: zodResolver(receiveLabelsSchema),
    defaultValues: {
      customer_id: "",
      product_name: "",
      date: formatET(new Date(), "yyyy-MM-dd"),
      received_qty: undefined,
      source_sheet: "",
      lot_number: "",
      order_header_id: null,
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.reset({
        customer_id: "",
        product_name: "",
        date: formatET(new Date(), "yyyy-MM-dd"),
        received_qty: undefined,
        source_sheet: "",
        lot_number: "",
        order_header_id: null,
      });
      setIsCustomProduct(false);
      setShowHistory(true);
    }
  }, [open, form]);

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

  // Get receiving history for selected product
  const productHistory = useMemo(() => {
    const customerId = form.watch("customer_id");
    const productName = form.watch("product_name");
    
    if (!customerId || !productName || !labelInventory) {
      return { records: [], totalReceived: 0 };
    }
    
    const records = labelInventory
      .filter(item => 
        item.customer_id === customerId && 
        item.product_name === productName &&
        item.received_qty !== null &&
        item.received_qty > 0
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const totalReceived = records.reduce((sum, record) => sum + (record.received_qty || 0), 0);
    
    return { records, totalReceived };
  }, [form.watch("customer_id"), form.watch("product_name"), labelInventory]);

  const onSubmit = async (data: ReceiveLabelsFormData) => {
    try {
      const customer = customers.find(c => c.id === data.customer_id);
      const customerProduct = customer ? `${customer.company_name} - ${data.product_name}` : data.product_name;
      
      await updateOrCreateRecord.mutateAsync({
        customer_product: customerProduct,
        date: data.date,
        received_qty: data.received_qty,
        used_qty: 0,
        on_hand: data.received_qty,
        source_sheet: data.source_sheet || null,
        customer_id: data.customer_id,
        product_name: data.product_name,
        lot_number: data.lot_number?.trim() || null,
        order_header_id: data.order_header_id || null,
      });

      toast({
        title: "Labels Received",
        description: `Successfully recorded ${data.received_qty} labels for ${data.product_name}`,
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record label receipt. Please try again.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive Labels</DialogTitle>
          <DialogDescription>
            Record labels received into inventory
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
              name="received_qty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Received Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === '' ? undefined : parseFloat(value) || 0);
                      }}
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

            <FormField
              control={form.control}
              name="lot_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lot Number (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., LOT-2026-001" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="order_header_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link to Customer PO (Optional)</FormLabel>
                  <FormControl>
                    <CustomerPOSelect
                      value={field.value ?? null}
                      onChange={(id) => field.onChange(id)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            {/* Product Receiving History */}
            {productHistory.records.length > 0 && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-blue-600" />
                      <CardTitle className="text-sm font-medium">
                        Receiving History for "{form.watch("product_name")}"
                      </CardTitle>
                      <Badge variant="secondary" className="ml-2">
                        {productHistory.records.length} {productHistory.records.length === 1 ? 'receipt' : 'receipts'}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowHistory(!showHistory)}
                      className="h-8 w-8 p-0"
                    >
                      {showHistory ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                {showHistory && (
                  <CardContent className="pt-0">
                    <div className="rounded-md border bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[140px]">Date</TableHead>
                            <TableHead className="text-right">Received Qty</TableHead>
                            <TableHead className="text-right">Current On Hand</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productHistory.records.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">
                                {formatET(record.date, "MMM dd, yyyy")}
                              </TableCell>
                              <TableCell className="text-right">
                                {record.received_qty?.toLocaleString() || 0}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {record.on_hand?.toLocaleString() || 0}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-blue-50 font-semibold">
                            <TableCell>Total Received</TableCell>
                            <TableCell className="text-right text-blue-700">
                              {productHistory.totalReceived.toLocaleString()}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    {productHistory.records[0]?.source_sheet && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Last source: {productHistory.records[0].source_sheet}
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateOrCreateRecord.isPending}>
                {updateOrCreateRecord.isPending ? "Recording..." : "Record Receipt"}
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