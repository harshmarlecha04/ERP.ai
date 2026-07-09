import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateRequest } from "@/hooks/useOfficeSupplyRequests";
import { useOfficeSupplies } from "@/hooks/useOfficeSupplies";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink } from "lucide-react";

interface RequestItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UNITS = ["units", "boxes", "bottles", "packs", "rolls", "cases", "each", "kg", "lbs", "gallons"];

export const RequestItemModal = ({ open, onOpenChange }: RequestItemModalProps) => {
  const createRequest = useCreateRequest();
  const { data: supplies = [], isLoading } = useOfficeSupplies();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    item_id: "",
    item_name: "",
    quantity_requested: "" as number | "",
    unit_of_measure: "",
    reason: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    buy_link: "",
  });
  const [useCustomItem, setUseCustomItem] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormData({
        item_id: "",
        item_name: "",
        quantity_requested: "",
        unit_of_measure: "",
        reason: "",
        priority: "medium",
        buy_link: "",
      });
      setUseCustomItem(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepare the request data
    const requestData: any = {
      item_name: formData.item_name,
      quantity_requested: typeof formData.quantity_requested === 'number' 
        ? formData.quantity_requested 
        : parseInt(String(formData.quantity_requested)) || 0,
      unit_of_measure: formData.unit_of_measure,
      reason: formData.reason,
      priority: formData.priority,
      buy_link: formData.buy_link || undefined,
    };
    
    // Only include item_id if it's a valid UUID (not empty string)
    if (formData.item_id && formData.item_id.trim() !== "") {
      requestData.item_id = formData.item_id;
    }
    
    await createRequest.mutateAsync(requestData);
    onOpenChange(false);
  };

  const handleSelectItem = (itemId: string) => {
    if (itemId === "custom") {
      setUseCustomItem(true);
      setFormData({ ...formData, item_id: "", item_name: "", buy_link: "" });
    } else {
      const selectedItem = supplies.find(s => s.id === itemId);
      if (selectedItem) {
        setUseCustomItem(false);
        setFormData({
          ...formData,
          item_id: selectedItem.id,
          item_name: selectedItem.item_name,
          buy_link: selectedItem.buy_link || "",
        });
      }
    }
  };

  const handleCopyLink = () => {
    if (formData.buy_link) {
      navigator.clipboard.writeText(formData.buy_link);
      toast({ title: "Link copied to clipboard!" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Office Supply</DialogTitle>
          <DialogDescription>
            Submit a request for office supplies or miscellaneous items you need
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="item">Item Name *</Label>
            {useCustomItem ? (
              <div className="space-y-2">
                <Input
                  placeholder="Enter custom item name..."
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUseCustomItem(false)}
                >
                  Choose from existing items
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Select
                  value={formData.item_id}
                  onValueChange={handleSelectItem}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoading ? "Loading..." : "Select an item..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {supplies.map((supply) => (
                      <SelectItem key={supply.id} value={supply.id}>
                        {supply.item_name} ({supply.category})
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">+ Request new item</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="quantity">Quantity Needed *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              required
              value={formData.quantity_requested}
              onChange={(e) => setFormData({ ...formData, quantity_requested: e.target.value ? parseInt(e.target.value) : "" })}
            />
          </div>

          <div>
            <Label htmlFor="unit_of_measure">Unit of Measure *</Label>
            <Select
              value={formData.unit_of_measure}
              onValueChange={(value) => setFormData({ ...formData, unit_of_measure: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select unit..." />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="buy_link">Buy Link (optional)</Label>
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
          </div>

          <div>
            <Label htmlFor="reason">Reason for Request</Label>
            <Textarea
              id="reason"
              placeholder="Why do you need this item?"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRequest.isPending || !formData.item_name || !formData.quantity_requested || formData.quantity_requested < 1 || !formData.unit_of_measure}>
              {createRequest.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};