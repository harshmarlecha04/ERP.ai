import React, { useState, useEffect } from "react";
import { Package, Check, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { todayET } from "@/utils/dateUtils";

interface BottleRequirement {
  bottle_id: string;
  bottle_name: string;
  needed: number;
  available: number;
  shortage: number;
}

interface BottleRequirementsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BottleRequirementsModal({ open, onOpenChange }: BottleRequirementsModalProps) {
  const [requirements, setRequirements] = useState<BottleRequirement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadRequirements();
    }
  }, [open]);

  const loadRequirements = async () => {
    setLoading(true);
    try {
      const today = todayET();

      // Get scheduled production items with bottle selections (current and future)
      const { data: schedules, error: scheduleError } = await supabase
        .from('production_schedule_items')
        .select(`
          selected_bottle_id,
          estimated_bottles,
          production_schedules!inner(schedule_date)
        `)
        .gte('production_schedules.schedule_date', today)
        .not('selected_bottle_id', 'is', null);

      if (scheduleError) throw scheduleError;

      // Aggregate bottles needed by type
      const bottleNeeds: Record<string, number> = {};
      (schedules || []).forEach((item: any) => {
        const bottleId = item.selected_bottle_id;
        const bottles = item.estimated_bottles || 0;
        bottleNeeds[bottleId] = (bottleNeeds[bottleId] || 0) + bottles;
      });

      // Get bottle inventory from v_packaging_balances
      const { data: inventory, error: invError } = await supabase
        .from('v_packaging_balances')
        .select('*')
        .eq('category', 'BOTTLES');

      if (invError) throw invError;

      // Build requirements list
      const reqList: BottleRequirement[] = [];
      const inventoryMap = new Map(
        (inventory || []).map((item: any) => [item.item_id, item])
      );

      // Add bottles that are needed
      for (const [bottleId, needed] of Object.entries(bottleNeeds)) {
        const invItem = inventoryMap.get(bottleId);
        const available = invItem?.on_hand || 0;
        const bottleName = invItem?.item_name || 'Unknown Bottle';
        
        reqList.push({
          bottle_id: bottleId,
          bottle_name: bottleName,
          needed,
          available,
          shortage: Math.max(0, needed - available),
        });
        
        // Remove from map so we can add remaining inventory items
        inventoryMap.delete(bottleId);
      }


      // Sort: items with shortage first, then by name
      reqList.sort((a, b) => {
        if (a.shortage > 0 && b.shortage === 0) return -1;
        if (b.shortage > 0 && a.shortage === 0) return 1;
        return a.bottle_name.localeCompare(b.bottle_name);
      });

      setRequirements(reqList);
    } catch (error) {
      console.error('Error loading bottle requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalNeeded = requirements.reduce((sum, r) => sum + r.needed, 0);
  const totalShortage = requirements.filter(r => r.shortage > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:42rem] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Bottle Requirements
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Summary of bottles needed for all scheduled production vs current inventory
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : requirements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No bottle requirements found for scheduled production
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bottle Type</TableHead>
                    <TableHead className="text-right">Needed</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requirements.map((req) => (
                    <TableRow key={req.bottle_id}>
                      <TableCell className="font-medium">{req.bottle_name}</TableCell>
                      <TableCell className="text-right">{req.needed.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{req.available.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {req.shortage > 0 ? (
                          <span className="inline-flex items-center gap-1 text-destructive font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            Buy {req.shortage.toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                            <Check className="h-4 w-4" />
                            Excess
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">
                Total bottles needed: <span className="font-medium text-foreground">{totalNeeded.toLocaleString()}</span>
              </span>
              {totalShortage > 0 && (
                <span className="text-destructive font-medium">
                  {totalShortage} bottle type{totalShortage > 1 ? 's' : ''} with shortage
                </span>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
