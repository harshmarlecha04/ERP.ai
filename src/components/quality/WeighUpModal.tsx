import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Scale, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatET } from "@/utils/dateUtils";

interface WeighUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleItem: {
    id: string;
    formulaCode: string;
    formulaName: string;
    batches: number;
    actual_yield_kg?: number | null;
    avg_wet_piece_weight_g?: number | null;
    number_of_towers?: number | null;
    weighed_at?: string | null;
  };
  onSuccess: () => void;
}

export const WeighUpModal = ({ isOpen, onClose, scheduleItem, onSuccess }: WeighUpModalProps) => {
  const [wetWeightKg, setWetWeightKg] = useState("");
  const [avgWetPieceWeightG, setAvgWetPieceWeightG] = useState("3.5");
  const [numberOfTowers, setNumberOfTowers] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Initialize state with existing values when modal opens
  useEffect(() => {
    if (isOpen && scheduleItem) {
      setWetWeightKg(scheduleItem.actual_yield_kg?.toString() || "");
      setAvgWetPieceWeightG(scheduleItem.avg_wet_piece_weight_g?.toString() || "3.5");
      setNumberOfTowers(scheduleItem.number_of_towers?.toString() || "");
    }
  }, [isOpen, scheduleItem]);

  const calculatedGummies = wetWeightKg && avgWetPieceWeightG 
    ? Math.floor((parseFloat(wetWeightKg) * 1000) / parseFloat(avgWetPieceWeightG))
    : 0;

  const handleSave = async () => {
    if (!wetWeightKg || !avgWetPieceWeightG || !numberOfTowers) {
      toast({
        title: "Missing Information",
        description: "Please enter wet weight, average piece weight, and number of towers",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("production_schedule_items")
        .update({
          actual_yield_kg: parseFloat(wetWeightKg),
          actual_gummies_produced: calculatedGummies,
          avg_wet_piece_weight_g: parseFloat(avgWetPieceWeightG),
          number_of_towers: parseInt(numberOfTowers),
          weighed_at: new Date().toISOString(),
        })
        .eq("id", scheduleItem.id);

      if (error) throw error;

      toast({
        title: "Weigh-Up Recorded",
        description: `Recorded ${wetWeightKg} kg wet weight, ${numberOfTowers} towers, calculated ${calculatedGummies.toLocaleString()} gummies`,
      });

      onSuccess();
      onClose();
      
      // Reset form
      setWetWeightKg("");
      setAvgWetPieceWeightG("3.5");
      setNumberOfTowers("");
    } catch (error: any) {
      console.error("Error saving weigh-up data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save weigh-up data",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setWetWeightKg("");
    setAvgWetPieceWeightG("3.5");
    setNumberOfTowers("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            {scheduleItem.weighed_at ? "Edit Weigh-Up Data" : "Post-Production Weigh-Up"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Record the wet weight after production to calculate actual gummy count. This data will be used for accurate yield calculation.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Batch Information</p>
              <p className="text-sm text-muted-foreground">
                {scheduleItem.formulaCode} - {scheduleItem.formulaName}
              </p>
              <p className="text-sm text-muted-foreground">
                Batches: {scheduleItem.batches}
              </p>
            </div>

            {scheduleItem.weighed_at && (
              <div className="bg-muted p-2 rounded-md">
                <p className="text-xs text-muted-foreground">
                  Originally recorded: {formatET(scheduleItem.weighed_at, "MMM d, yyyy h:mm a")}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="wetWeight">Wet Weight (kg) *</Label>
              <Input
                id="wetWeight"
                type="number"
                step="0.01"
                placeholder="e.g., 1000"
                value={wetWeightKg}
                onChange={(e) => setWetWeightKg(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avgPieceWeight">Average Wet Piece Weight (g) *</Label>
              <Input
                id="avgPieceWeight"
                type="number"
                step="0.01"
                placeholder="e.g., 3.5"
                value={avgWetPieceWeightG}
                onChange={(e) => setAvgWetPieceWeightG(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="towers">Number of Towers *</Label>
              <Input
                id="towers"
                type="number"
                step="1"
                placeholder="e.g., 12"
                value={numberOfTowers}
                onChange={(e) => setNumberOfTowers(e.target.value)}
              />
            </div>

            {calculatedGummies > 0 && (
              <Alert className="bg-primary/10 border-primary">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Calculated Gummy Count:</strong> {calculatedGummies.toLocaleString()} gummies
                  <br />
                  <span className="text-xs">
                    ({wetWeightKg} kg × 1000 g/kg ÷ {avgWetPieceWeightG} g/piece)
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !wetWeightKg || !avgWetPieceWeightG || !numberOfTowers}>
            {saving ? "Saving..." : scheduleItem.weighed_at ? "Update Weigh-Up" : "Save Weigh-Up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
