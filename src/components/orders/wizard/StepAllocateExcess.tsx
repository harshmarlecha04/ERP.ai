import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useExcessAllocation, ExcessAllocationEntry } from '@/hooks/useExcessAllocation';
import { Package } from 'lucide-react';

interface LineAllocation {
  lineItemId: string;
  lineNumber: string;
  formulaCode: string;
  formulaId: string;
  bottleSize: number;
  qtyRequested: number;
  available: number;
  allocating: number;
  qtyToProduce: number;
  entries: ExcessAllocationEntry[];
}

interface StepAllocateExcessProps {
  orderId: string;
  lineItems: Array<{
    id: string;
    line_number: string;
    formula_id: string;
    formula_code: string;
    bottles_ordered: number;
    bottle_size: number;
  }>;
  allocations: LineAllocation[];
  onAllocationsChange: (allocations: LineAllocation[]) => void;
}

export const StepAllocateExcess = ({ orderId, lineItems, allocations, onAllocationsChange }: StepAllocateExcessProps) => {
  const { suggestAllocation, getAvailableForFormula, getTotalAvailable } = useExcessAllocation();

  useEffect(() => {
    if (allocations.length > 0) return;
    // Build initial suggestions
    const initial: LineAllocation[] = lineItems.map(li => {
      const available = getTotalAvailable(li.formula_id, li.bottle_size);
      const { entries, totalAllocatable } = suggestAllocation(li.formula_id, li.bottle_size, li.bottles_ordered);
      return {
        lineItemId: li.id,
        lineNumber: li.line_number,
        formulaCode: li.formula_code,
        formulaId: li.formula_id,
        bottleSize: li.bottle_size,
        qtyRequested: li.bottles_ordered,
        available,
        allocating: totalAllocatable,
        qtyToProduce: li.bottles_ordered - totalAllocatable,
        entries,
      };
    });
    onAllocationsChange(initial);
  }, [lineItems.length]);

  const handleAllocChange = (idx: number, value: number) => {
    const updated = [...allocations];
    const line = updated[idx];
    const clamped = Math.min(Math.max(0, value), Math.min(line.available, line.qtyRequested));
    const { entries } = suggestAllocation(line.formulaId, line.bottleSize, clamped);
    updated[idx] = {
      ...line,
      allocating: clamped,
      qtyToProduce: line.qtyRequested - clamped,
      entries,
    };
    onAllocationsChange(updated);
  };

  const totalAllocating = allocations.reduce((s, a) => s + a.allocating, 0);
  const totalToProduce = allocations.reduce((s, a) => s + a.qtyToProduce, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Allocate existing bright stock (excess inventory) to this PO before scheduling new production. Oldest lots are used first (FIFO).
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Line</TableHead>
            <TableHead>Formula</TableHead>
            <TableHead className="text-right">PO Qty</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead className="text-right">Allocate</TableHead>
            <TableHead className="text-right">To Produce</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocations.map((alloc, idx) => (
            <TableRow key={alloc.lineItemId}>
              <TableCell className="font-medium">{alloc.lineNumber}</TableCell>
              <TableCell>
                <span className="font-medium">{alloc.formulaCode}</span>
                <span className="text-xs text-muted-foreground ml-1">({alloc.bottleSize}ct)</span>
              </TableCell>
              <TableCell className="text-right font-semibold">{alloc.qtyRequested.toLocaleString()}</TableCell>
              <TableCell className="text-right">
                {alloc.available > 0 ? (
                  <Badge className="bg-blue-100 text-blue-800">{alloc.available.toLocaleString()}</Badge>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  min={0}
                  max={Math.min(alloc.available, alloc.qtyRequested)}
                  value={alloc.allocating}
                  onChange={(e) => handleAllocChange(idx, parseInt(e.target.value) || 0)}
                  className="w-24 ml-auto text-right"
                  disabled={alloc.available === 0}
                />
              </TableCell>
              <TableCell className="text-right font-semibold">{alloc.qtyToProduce.toLocaleString()}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell colSpan={4}>Total</TableCell>
            <TableCell className="text-right text-blue-600">{totalAllocating.toLocaleString()}</TableCell>
            <TableCell className="text-right">{totalToProduce.toLocaleString()}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {totalAllocating > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg">
          <Package className="h-5 w-5" />
          <span className="text-sm font-medium">
            {totalAllocating.toLocaleString()} bottles will be allocated from existing bright stock
          </span>
        </div>
      )}
    </div>
  );
};

export type { LineAllocation };
