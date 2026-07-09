import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateAdjustmentTransaction } from "@/hooks/useOfficeSupplyTransactions";
import { OfficeSupply } from "@/hooks/useOfficeSupplies";
import { AlertCircle } from "lucide-react";

interface AdjustQuantityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supply: OfficeSupply | null;
}

type AdjustmentType = "increase" | "decrease" | "absolute";

export const AdjustQuantityModal = ({ open, onOpenChange, supply }: AdjustQuantityModalProps) => {
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("absolute");
  const [adjustmentValue, setAdjustmentValue] = useState<string>("");
  const [reason, setReason] = useState("");
  const createAdjustment = useCreateAdjustmentTransaction();

  useEffect(() => {
    if (!open) {
      setAdjustmentType("absolute");
      setAdjustmentValue("");
      setReason("");
    }
  }, [open]);

  if (!supply) return null;

  const currentQuantity = supply.quantity_on_hand;
  const adjustmentNum = parseFloat(adjustmentValue) || 0;

  const calculateNewQuantity = (): number => {
    switch (adjustmentType) {
      case "increase":
        return currentQuantity + adjustmentNum;
      case "decrease":
        return Math.max(0, currentQuantity - adjustmentNum);
      case "absolute":
        return Math.max(0, adjustmentNum);
      default:
        return currentQuantity;
    }
  };

  const newQuantity = calculateNewQuantity();
  const actualAdjustment = newQuantity - currentQuantity;

  const handleSubmit = async () => {
    if (!adjustmentValue || !reason.trim()) return;

    await createAdjustment.mutateAsync({
      item_id: supply.id,
      current_quantity: currentQuantity,
      new_quantity: newQuantity,
      adjustment_amount: actualAdjustment,
      notes: reason.trim(),
    });

    onOpenChange(false);
  };

  const isValid = adjustmentValue && parseFloat(adjustmentValue) > 0 && reason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Quantity</DialogTitle>
          <DialogDescription>
            Manually adjust inventory for {supply.item_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Quantity</Label>
            <div className="text-2xl font-bold">
              {currentQuantity} {supply.unit_of_measure}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-type">Adjustment Type</Label>
            <Select value={adjustmentType} onValueChange={(value: AdjustmentType) => setAdjustmentType(value)}>
              <SelectTrigger id="adjustment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absolute">Set to Absolute Value</SelectItem>
                <SelectItem value="increase">Increase By</SelectItem>
                <SelectItem value="decrease">Decrease By</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-value">
              {adjustmentType === "absolute" ? "New Quantity" : "Adjustment Amount"}
            </Label>
            <Input
              id="adjustment-value"
              type="number"
              min="0"
              step="0.01"
              value={adjustmentValue}
              onChange={(e) => setAdjustmentValue(e.target.value)}
              placeholder={`Enter ${adjustmentType === "absolute" ? "new quantity" : "amount"}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Required)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Inventory count correction, Found additional stock, etc."
              rows={3}
            />
          </div>

          {adjustmentValue && parseFloat(adjustmentValue) > 0 && (
            <div className="rounded-lg border bg-muted p-3 space-y-1">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="text-sm space-y-1">
                  <div className="font-medium">Preview:</div>
                  <div>
                    Current: <span className="font-bold">{currentQuantity}</span> {supply.unit_of_measure}
                    {" → "}
                    New: <span className="font-bold">{newQuantity}</span> {supply.unit_of_measure}
                  </div>
                  <div className={actualAdjustment >= 0 ? "text-green-600" : "text-red-600"}>
                    Adjustment: {actualAdjustment >= 0 ? "+" : ""}{actualAdjustment} {supply.unit_of_measure}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || createAdjustment.isPending}
          >
            {createAdjustment.isPending ? "Adjusting..." : "Confirm Adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
