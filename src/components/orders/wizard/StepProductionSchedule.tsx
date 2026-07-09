import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Factory } from 'lucide-react';
import { LineAllocation } from './StepAllocateExcess';
import { todayET } from "@/utils/dateUtils";

interface ScheduleEntry {
  lineItemId: string;
  lineNumber: string;
  formulaCode: string;
  qtyToProduce: number;
  scheduleQty: number;
  scheduleDate: string;
  overrideReason: string;
  isOverride: boolean;
  existingScheduleItemId?: string;
}

interface StepProductionScheduleProps {
  allocations: LineAllocation[];
  existingBatches: Array<{ production_schedule_item_id: string; formula_code: string; estimated_bottles: number }>;
  scheduleEntries: ScheduleEntry[];
  onScheduleEntriesChange: (entries: ScheduleEntry[]) => void;
}

export const StepProductionSchedule = ({
  allocations,
  existingBatches,
  scheduleEntries,
  onScheduleEntriesChange,
}: StepProductionScheduleProps) => {
  // Initialize if empty
  if (scheduleEntries.length === 0 && allocations.length > 0) {
    const initial: ScheduleEntry[] = allocations
      .filter(a => a.qtyToProduce > 0)
      .map(a => ({
        lineItemId: a.lineItemId,
        lineNumber: a.lineNumber,
        formulaCode: a.formulaCode,
        qtyToProduce: a.qtyToProduce,
        scheduleQty: a.qtyToProduce,
        scheduleDate: todayET(),
        overrideReason: '',
        isOverride: false,
      }));
    onScheduleEntriesChange(initial);
    return null;
  }

  const handleChange = (idx: number, field: keyof ScheduleEntry, value: any) => {
    const updated = [...scheduleEntries];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'scheduleQty') {
      updated[idx].isOverride = value !== updated[idx].qtyToProduce;
    }
    onScheduleEntriesChange(updated);
  };

  const linesToProduce = scheduleEntries.filter(e => e.qtyToProduce > 0);
  const nothingToProduce = allocations.every(a => a.qtyToProduce === 0);

  if (nothingToProduce) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
        <h3 className="text-lg font-semibold">No Production Needed</h3>
        <p className="text-sm text-muted-foreground mt-1">
          All bottles are covered by excess inventory allocation. You can skip to packaging.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Schedule production for the remaining quantities after excess allocation. You can override quantities to intentionally overproduce (requires reason).
      </p>

      {existingBatches.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium mb-1">Existing Production Batches</p>
          <div className="flex flex-wrap gap-2">
            {existingBatches.map(b => (
              <Badge key={b.production_schedule_item_id} variant="outline">
                {b.formula_code}: {b.estimated_bottles.toLocaleString()} bottles
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Line</TableHead>
            <TableHead>Formula</TableHead>
            <TableHead className="text-right">Qty Needed</TableHead>
            <TableHead className="text-right">Schedule Qty</TableHead>
            <TableHead>Schedule Date</TableHead>
            <TableHead>Override Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scheduleEntries.map((entry, idx) => (
            <TableRow key={entry.lineItemId}>
              <TableCell className="font-medium">{entry.lineNumber}</TableCell>
              <TableCell className="font-medium">{entry.formulaCode}</TableCell>
              <TableCell className="text-right">{entry.qtyToProduce.toLocaleString()}</TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  min={0}
                  value={entry.scheduleQty}
                  onChange={(e) => handleChange(idx, 'scheduleQty', parseInt(e.target.value) || 0)}
                  className="w-24 ml-auto text-right"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="date"
                  value={entry.scheduleDate}
                  onChange={(e) => handleChange(idx, 'scheduleDate', e.target.value)}
                  className="w-40"
                />
              </TableCell>
              <TableCell>
                {entry.isOverride && (
                  <Textarea
                    placeholder="Reason for override..."
                    value={entry.overrideReason}
                    onChange={(e) => handleChange(idx, 'overrideReason', e.target.value)}
                    rows={1}
                    className="min-h-[32px] text-sm"
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center gap-2 p-3 bg-purple-50 text-purple-700 rounded-lg">
        <Factory className="h-5 w-5" />
        <span className="text-sm font-medium">
          {linesToProduce.reduce((s, e) => s + e.scheduleQty, 0).toLocaleString()} bottles scheduled for production
        </span>
      </div>
    </div>
  );
};

export type { ScheduleEntry };
