import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpdateOfficeSupply, OfficeSupply } from "@/hooks/useOfficeSupplies";
import { useCreateAdjustmentTransaction } from "@/hooks/useOfficeSupplyTransactions";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink } from "lucide-react";

interface EditOfficeSupplyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supply: OfficeSupply | null;
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

export const EditOfficeSupplyModal = ({ open, onOpenChange, supply }: EditOfficeSupplyModalProps) => {
  const updateSupply = useUpdateOfficeSupply();
  const createAdjustment = useCreateAdjustmentTransaction();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    item_name: "",
    category: "",
    description: "",
    unit_of_measure: "",
    supplier: "",
    min_quantity: "",
    quantity_on_hand: "",
    notes: "",
    buy_link: "",
  });

  const [recordUsage, setRecordUsage] = useState(false);
  const [usageQuantity, setUsageQuantity] = useState("");
  const [usageReason, setUsageReason] = useState("");

  useEffect(() => {
    if (supply && open) {
      setFormData({
        item_name: supply.item_name,
        category: supply.category,
        description: supply.description || "",
        unit_of_measure: supply.unit_of_measure,
        supplier: supply.supplier || "",
        min_quantity: supply.min_quantity?.toString() || "",
        quantity_on_hand: supply.quantity_on_hand?.toString() || "",
        notes: supply.notes || "",
        buy_link: supply.buy_link || "",
      });
      setRecordUsage(false);
      setUsageQuantity("");
      setUsageReason("");
    }
  }, [supply, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supply) return;

    // First, record usage if requested
    if (recordUsage && usageQuantity && parseFloat(usageQuantity) > 0) {
      const usedAmount = parseFloat(usageQuantity);
      const newQuantity = supply.quantity_on_hand - usedAmount;
      
      await createAdjustment.mutateAsync({
        item_id: supply.id,
        current_quantity: supply.quantity_on_hand,
        new_quantity: newQuantity,
        adjustment_amount: -usedAmount,
        notes: usageReason || "Usage recorded",
      });
    }

    // Check if quantity was manually adjusted (independent of usage recording)
    const newQuantity = parseFloat(formData.quantity_on_hand);
    const oldQuantity = recordUsage ? (supply.quantity_on_hand - parseFloat(usageQuantity || "0")) : supply.quantity_on_hand;
    
    if (newQuantity !== oldQuantity) {
      await createAdjustment.mutateAsync({
        item_id: supply.id,
        current_quantity: oldQuantity,
        new_quantity: newQuantity,
        adjustment_amount: newQuantity - oldQuantity,
        notes: "Manual quantity adjustment",
      });
    }

    // Then update item details
    await updateSupply.mutateAsync({
      id: supply.id,
      item_name: formData.item_name,
      category: formData.category,
      description: formData.description || undefined,
      unit_of_measure: formData.unit_of_measure,
      supplier: formData.supplier || undefined,
      min_quantity: parseFloat(formData.min_quantity) || undefined,
      quantity_on_hand: newQuantity || 0,
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

  if (!supply) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:42rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Office Supply Item</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Edit item details and optionally record usage.
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Record Usage Section */}
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recordUsage"
                checked={recordUsage}
                onCheckedChange={(checked) => setRecordUsage(checked as boolean)}
              />
              <Label htmlFor="recordUsage" className="font-semibold cursor-pointer">
                Record Usage
              </Label>
            </div>

            {recordUsage && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Stock:</span>
                  <span className="font-semibold">
                    {supply.quantity_on_hand} {supply.unit_of_measure}
                  </span>
                </div>

                <div>
                  <Label htmlFor="usageQuantity">Quantity Used *</Label>
                  <Input
                    id="usageQuantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={usageQuantity}
                    onChange={(e) => setUsageQuantity(e.target.value)}
                    placeholder="Enter quantity used"
                    required={recordUsage}
                  />
                </div>

                <div>
                  <Label htmlFor="usageReason">Reason / Notes</Label>
                  <Textarea
                    id="usageReason"
                    value={usageReason}
                    onChange={(e) => setUsageReason(e.target.value)}
                    placeholder="e.g., Used for office party, Monthly consumption"
                    rows={2}
                  />
                </div>

                {usageQuantity && parseFloat(usageQuantity) > 0 && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">Remaining:</span>
                    <span className="font-semibold text-primary">
                      {supply.quantity_on_hand} → {(supply.quantity_on_hand - parseFloat(usageQuantity)).toFixed(2)} {supply.unit_of_measure}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Item Details Section */}
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
              <Label htmlFor="quantity_on_hand">Current Quantity</Label>
              <div className="flex gap-2">
                <Input
                  id="quantity_on_hand"
                  type="number"
                  step="0.01"
                  value={formData.quantity_on_hand}
                  onChange={(e) => setFormData({ ...formData, quantity_on_hand: e.target.value })}
                  placeholder="Current quantity on hand"
                />
                <span className="flex items-center text-sm text-muted-foreground">
                  {formData.unit_of_measure}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Update this to correct inventory counts
              </p>
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
            <Button type="submit" disabled={updateSupply.isPending}>
              {updateSupply.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};