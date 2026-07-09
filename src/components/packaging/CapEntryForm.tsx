import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Plus, X } from "lucide-react";
import { CustomerPOSelect } from "./CustomerPOSelect";
import { todayET } from "@/utils/dateUtils";

interface CapEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_CAP_TYPES = ["45mm Debossed MRP", "53mm MRP"];

export function CapEntryForm({ open, onOpenChange }: CapEntryFormProps) {
  const [capType, setCapType] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [lotNumber, setLotNumber] = useState<string>("");
  const [orderHeaderId, setOrderHeaderId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [capTypes, setCapTypes] = useState<string[]>(DEFAULT_CAP_TYPES);
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("packaging_item")
        .select("item_name")
        .eq("category", "CAPS");
      const names = (data ?? []).map((r) => r.item_name).filter(Boolean) as string[];
      const merged = Array.from(new Set([...DEFAULT_CAP_TYPES, ...names]));
      setCapTypes(merged);
    })();
  }, [open]);

  const handleAddNew = () => {
    const v = newType.trim();
    if (!v) return;
    if (capTypes.some((t) => t.toLowerCase() === v.toLowerCase())) {
      toast({ title: "Already exists", description: `"${v}" is already in the list.`, variant: "destructive" });
      return;
    }
    setCapTypes((prev) => [...prev, v]);
    setCapType(v);
    setNewType("");
    setShowAdd(false);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!capType || !quantity || Number(quantity) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please select a cap type and enter a valid quantity.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Check if cap item exists
      const { data: existingItem } = await supabase
        .from("packaging_item")
        .select("id")
        .eq("category", "CAPS")
        .eq("item_name", capType)
        .maybeSingle();

      let itemId = existingItem?.id;

      // Create item if it doesn't exist
      if (!itemId) {
        const { data: newItem, error: createError } = await supabase
          .from("packaging_item")
          .insert({
            category: "CAPS",
            item_name: capType,
            description: `${capType} cap`,
            uom: "ea",
          })
          .select("id")
          .single();

        if (createError) throw createError;
        itemId = newItem.id;
      }

      // Create packaging movement
      const { error: movementError } = await supabase
        .from("packaging_movement")
        .insert({
          item_id: itemId,
          move_type: "RECEIPT",
          move_date: todayET(),
          qty: Number(quantity),
          lot_number: lotNumber.trim() || null,
          order_header_id: orderHeaderId,
          notes: notes || null,
        });

      if (movementError) throw movementError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["packaging-balances"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-summary"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-history"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-stats"] });

      toast({
        title: "Success",
        description: "Cap info saved.",
      });

      // Reset form
      setCapType("");
      setQuantity("");
      setLotNumber("");
      setOrderHeaderId(null);
      setNotes("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving cap entry:", error);
      toast({
        title: "Error",
        description: "Failed to save cap entry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <DialogTitle>Cap Entry</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Record new cap inventory receipt
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Cap Type</Label>
            <ToggleGroup
              type="single"
              value={capType}
              onValueChange={(v) => v && setCapType(v)}
              className="grid grid-cols-2 gap-3"
            >
              {capTypes.map((type) => (
                <ToggleGroupItem
                  key={type}
                  value={type}
                  className="border-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary h-11"
                >
                  {type}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {showAdd ? (
              <div className="flex gap-2 pt-2">
                <Input
                  autoFocus
                  placeholder="e.g., 38mm CRC White"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAddNew(); }
                    if (e.key === "Escape") { setShowAdd(false); setNewType(""); }
                  }}
                  className="h-9"
                />
                <Button type="button" size="sm" onClick={handleAddNew}>Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewType(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add new cap type
              </Button>
            )}
          </div>


          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="1"
              placeholder="Enter quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lot_number">Lot Number (Optional)</Label>
              <Input
                id="lot_number"
                placeholder="e.g., LOT-2026-001"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Link to Customer PO (Optional)</Label>
              <CustomerPOSelect value={orderHeaderId} onChange={setOrderHeaderId} />
            </div>
          </div>


          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g., color, defects, batch info..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Entry"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
