import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { CustomerPOSelect } from "./CustomerPOSelect";
import { todayET } from "@/utils/dateUtils";

interface BottleEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_BOTTLE_COLORS = ["Clear", "White", "Black"];
const DEFAULT_BOTTLE_SIZES = ["100cc", "250cc", "300cc", "400cc", "500cc"];

// Parse "Color SIZE Bottle" -> { color, size }
function parseBottleName(name: string): { color?: string; size?: string } {
  const m = name.match(/^(\S+)\s+(\S+)\s+Bottle$/i);
  if (!m) return {};
  return { color: m[1], size: m[2] };
}

export const BottleEntryForm: React.FC<BottleEntryFormProps> = ({ open, onOpenChange }) => {
  const [bottleColor, setBottleColor] = useState<string>("");
  const [bottleSize, setBottleSize] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [lotNumber, setLotNumber] = useState<string>("");
  const [orderHeaderId, setOrderHeaderId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [colors, setColors] = useState<string[]>(DEFAULT_BOTTLE_COLORS);
  const [sizes, setSizes] = useState<string[]>(DEFAULT_BOTTLE_SIZES);
  const [showAddColor, setShowAddColor] = useState(false);
  const [showAddSize, setShowAddSize] = useState(false);
  const [newColor, setNewColor] = useState("");
  const [newSize, setNewSize] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("packaging_item")
        .select("item_name")
        .eq("category", "BOTTLES");
      const dynColors = new Set<string>();
      const dynSizes = new Set<string>();
      (data ?? []).forEach((r) => {
        const { color, size } = parseBottleName(r.item_name || "");
        if (color) dynColors.add(color);
        if (size) dynSizes.add(size);
      });
      setColors(Array.from(new Set([...DEFAULT_BOTTLE_COLORS, ...dynColors])));
      setSizes(Array.from(new Set([...DEFAULT_BOTTLE_SIZES, ...dynSizes])));
    })();
  }, [open]);

  const addOption = (
    val: string,
    list: string[],
    setList: (v: string[]) => void,
    setSelected: (v: string) => void,
    clear: () => void,
  ) => {
    const v = val.trim();
    if (!v) return;
    if (list.some((x) => x.toLowerCase() === v.toLowerCase())) {
      toast({ title: "Already exists", description: `"${v}" is already in the list.`, variant: "destructive" });
      return;
    }
    setList([...list, v]);
    setSelected(v);
    clear();
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bottleColor || !bottleSize || !quantity) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create item name: "Clear 100cc Bottle"
      const itemName = `${bottleColor} ${bottleSize} Bottle`;

      // Check if packaging_item exists
      const { data: existingItems } = await supabase
        .from("packaging_item")
        .select("id")
        .eq("category", "BOTTLES")
        .eq("item_name", itemName)
        .single();

      let itemId: string;

      if (existingItems) {
        itemId = existingItems.id;
      } else {
        // Create new packaging_item
        const { data: newItem, error: itemError } = await supabase
          .from("packaging_item")
          .insert({
            category: "BOTTLES",
            item_name: itemName,
            description: `${bottleColor} ${bottleSize} bottle`,
            uom: "ea",
          })
          .select("id")
          .single();

        if (itemError) throw itemError;
        itemId = newItem.id;
      }

      // Record the receipt in packaging_movement
      const { error: movementError } = await supabase
        .from("packaging_movement")
        .insert({
          item_id: itemId,
          move_type: "RECEIPT",
          move_date: todayET(),
          qty: qty,
          lot_number: lotNumber.trim() || null,
          order_header_id: orderHeaderId,
          notes: notes
            ? `Bottle entry: ${bottleColor} ${bottleSize} - ${notes}`
            : `Bottle entry: ${bottleColor} ${bottleSize}`,
        });

      if (movementError) throw movementError;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["packaging-balances"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-summary"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-history"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-stats"] });

      toast({
        title: "Success",
        description: "Bottle info saved.",
      });

      // Clear form
      setBottleColor("");
      setBottleSize("");
      setQuantity("");
      setLotNumber("");
      setOrderHeaderId(null);
      setNotes("");
      
      // Close dialog
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving bottle entry:", error);
      toast({
        title: "Error",
        description: "Failed to save bottle entry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Bottle Entry</DialogTitle>
          <DialogDescription>
            Record new bottle inventory receipt
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Bottle Color */}
          <div className="space-y-3">
            <Label>Bottle Color</Label>
            <ToggleGroup 
              type="single" 
              value={bottleColor} 
              onValueChange={(v) => v && setBottleColor(v)}
              className="justify-start gap-3 flex-wrap"
            >
              {colors.map((color) => (
                <ToggleGroupItem 
                  key={color} 
                  value={color}
                  className="px-6 py-2.5 border-2 border-input data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                >
                  {color}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {showAddColor ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="e.g., Amber"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addOption(newColor, colors, setColors, setBottleColor, () => { setNewColor(""); setShowAddColor(false); }); }
                    if (e.key === "Escape") { setShowAddColor(false); setNewColor(""); }
                  }}
                  className="h-9"
                />
                <Button type="button" size="sm" onClick={() => addOption(newColor, colors, setColors, setBottleColor, () => { setNewColor(""); setShowAddColor(false); })}>Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowAddColor(false); setNewColor(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddColor(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add new color
              </Button>
            )}
          </div>

          {/* Bottle Size */}
          <div className="space-y-3">
            <Label>Bottle Size</Label>
            <ToggleGroup 
              type="single" 
              value={bottleSize} 
              onValueChange={(v) => v && setBottleSize(v)}
              className="justify-start gap-2 flex-wrap"
            >
              {sizes.map((size) => (
                <ToggleGroupItem 
                  key={size} 
                  value={size}
                  className="px-4 py-2.5 border-2 border-input data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                >
                  {size}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {showAddSize ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="e.g., 750cc"
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addOption(newSize, sizes, setSizes, setBottleSize, () => { setNewSize(""); setShowAddSize(false); }); }
                    if (e.key === "Escape") { setShowAddSize(false); setNewSize(""); }
                  }}
                  className="h-9"
                />
                <Button type="button" size="sm" onClick={() => addOption(newSize, sizes, setSizes, setBottleSize, () => { setNewSize(""); setShowAddSize(false); })}>Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowAddSize(false); setNewSize(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddSize(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add new size
              </Button>
            )}
          </div>


          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              placeholder="Enter quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0"
              step="1"
              className="h-11"
            />
          </div>

          {/* Lot Number + PO Link */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="bottle_lot">Lot Number (Optional)</Label>
              <Input
                id="bottle_lot"
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


          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any comments about this bottle entry..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Entry
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
