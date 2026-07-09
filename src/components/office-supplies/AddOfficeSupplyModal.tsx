import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateOfficeSupply } from "@/hooks/useOfficeSupplies";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink } from "lucide-react";

interface AddOfficeSupplyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  "Office Supplies",
  "Facility",
  "Printing",
  "Stationery",
  "Cleaning",
  "Kitchen",
  "Safety",
  "Other",
];

const UNITS = ["units", "boxes", "bottles", "packs", "rolls", "cases", "each", "kg", "lbs", "gallons"];

export const AddOfficeSupplyModal = ({ open, onOpenChange }: AddOfficeSupplyModalProps) => {
  const createSupply = useCreateOfficeSupply();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    item_name: "",
    category: "",
    description: "",
    quantity_on_hand: "",
    unit_of_measure: "",
    supplier: "",
    min_quantity: "",
    notes: "",
    buy_link: "",
  });

  useEffect(() => {
    if (!open) {
      setFormData({
        item_name: "",
        category: "",
        description: "",
        quantity_on_hand: "",
        unit_of_measure: "",
        supplier: "",
        min_quantity: "",
        notes: "",
        buy_link: "",
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantity = parseFloat(formData.quantity_on_hand) || 0;

    await createSupply.mutateAsync({
      item_name: formData.item_name,
      category: formData.category,
      description: formData.description || undefined,
      quantity_on_hand: quantity,
      unit_of_measure: formData.unit_of_measure,
      supplier: formData.supplier || undefined,
      min_quantity: parseFloat(formData.min_quantity) || undefined,
      notes: formData.notes || undefined,
      buy_link: formData.buy_link || undefined,
    });

    onOpenChange(false);
  };

  const handleCopyLink = () => {
    if (formData.buy_link) {
      navigator.clipboard.writeText(formData.buy_link);
      toast({ title: "Link copied to clipboard!" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:42rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Office Supply Item</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Add item details here. You can record purchases later using the "Record Purchase" button.
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="item_name">Item Name *</Label>
              <Input
                id="item_name"
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <option value="">Select Category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="quantity_on_hand">Initial Quantity (optional)</Label>
              <Input
                id="quantity_on_hand"
                type="number"
                step="0.01"
                value={formData.quantity_on_hand}
                onChange={(e) => setFormData({ ...formData, quantity_on_hand: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank or 0 to add purchases later
              </p>
            </div>

            <div>
              <Label htmlFor="unit_of_measure">Unit of Measure *</Label>
              <select
                id="unit_of_measure"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.unit_of_measure}
                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                required
              >
                <option value="">Select Unit</option>
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="supplier">Default Supplier</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                placeholder="Preferred supplier name"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="buy_link">Buy Link</Label>
              <div className="flex gap-2">
                <Input
                  id="buy_link"
                  type="url"
                  value={formData.buy_link}
                  onChange={(e) => setFormData({ ...formData, buy_link: e.target.value })}
                  placeholder="https://amazon.com/dp/..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  disabled={!formData.buy_link}
                  title="Copy link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {formData.buy_link && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(formData.buy_link, '_blank')}
                    title="Open link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Direct purchase link for quick reordering
              </p>
            </div>

            <div className="col-span-2">
              <Label htmlFor="min_quantity">Minimum Quantity (for low stock alerts)</Label>
              <Input
                id="min_quantity"
                type="number"
                step="0.01"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                placeholder="0"
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
            <Button type="submit" disabled={createSupply.isPending}>
              {createSupply.isPending ? "Adding..." : "Add Item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};