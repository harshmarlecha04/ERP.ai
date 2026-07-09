import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePurchase } from "@/hooks/useOfficeSupplyPurchases";
import { todayET } from "@/utils/dateUtils";

interface AddPurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  unitOfMeasure: string;
}

export const AddPurchaseModal = ({ 
  open, 
  onOpenChange, 
  itemId, 
  itemName,
  unitOfMeasure 
}: AddPurchaseModalProps) => {
  const createPurchase = useCreatePurchase();
  const [formData, setFormData] = useState({
    purchase_date: todayET(),
    quantity: "",
    unit_cost: "",
    shipping_cost: "",
    tax: "",
    supplier: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) {
      setFormData({
        purchase_date: todayET(),
        quantity: "",
        unit_cost: "",
        shipping_cost: "",
        tax: "",
        supplier: "",
        notes: "",
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantity = parseFloat(formData.quantity) || 0;
    const unitCost = parseFloat(formData.unit_cost) || 0;
    const shippingCost = parseFloat(formData.shipping_cost) || 0;
    const tax = parseFloat(formData.tax) || 0;
    const totalCost = (quantity * unitCost) + shippingCost + tax;

    await createPurchase.mutateAsync({
      item_id: itemId,
      purchase_date: formData.purchase_date,
      quantity,
      unit_cost: unitCost,
      shipping_cost: shippingCost,
      tax,
      total_cost: totalCost,
      supplier: formData.supplier || undefined,
      notes: formData.notes || undefined,
    });

    onOpenChange(false);
  };

  const totalCost = (
    (parseFloat(formData.quantity) || 0) * (parseFloat(formData.unit_cost) || 0) +
    (parseFloat(formData.shipping_cost) || 0) +
    (parseFloat(formData.tax) || 0)
  ).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:42rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Purchase - {itemName}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="purchase_date">Purchase Date *</Label>
              <Input
                id="purchase_date"
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="quantity">Quantity ({unitOfMeasure}) *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="unit_cost">Unit Cost ($) *</Label>
              <Input
                id="unit_cost"
                type="number"
                step="0.01"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="shipping_cost">Shipping Cost ($)</Label>
              <Input
                id="shipping_cost"
                type="number"
                step="0.01"
                value={formData.shipping_cost}
                onChange={(e) => setFormData({ ...formData, shipping_cost: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="tax">Tax ($)</Label>
              <Input
                id="tax"
                type="number"
                step="0.01"
                value={formData.tax}
                onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="total_cost">Total Cost ($)</Label>
              <Input
                id="total_cost"
                type="text"
                value={totalCost}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPurchase.isPending}>
              {createPurchase.isPending ? "Recording..." : "Record Purchase"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
