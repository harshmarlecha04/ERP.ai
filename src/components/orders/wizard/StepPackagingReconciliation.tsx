import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle2, Package } from 'lucide-react';

interface PackagingLine {
  lineItemId: string;
  lineNumber: string;
  formulaCode: string;
  plannedBottles: number;
  actualBottles: number;
  isRecorded: boolean;
  delta: number;
  shortageAction: 'none' | 'produce_later' | 'accept_shortage';
  shortageReason: string;
}

interface StepPackagingReconciliationProps {
  lineItems: Array<{
    id: string;
    line_number: string;
    formula_code: string;
    bottles_ordered: number;
  }>;
  fulfillmentLines: Array<{
    lineItemId: string;
    qtyRequested: number;
    qtyAllocatedFromExcess: number;
    qtyPacked: number;
  }>;
  packagingLines: PackagingLine[];
  onPackagingLinesChange: (lines: PackagingLine[]) => void;
}

export const StepPackagingReconciliation = ({
  lineItems,
  fulfillmentLines,
  packagingLines,
  onPackagingLinesChange,
}: StepPackagingReconciliationProps) => {
  // Initialize
  if (packagingLines.length === 0 && lineItems.length > 0) {
    const initial: PackagingLine[] = lineItems.map(li => {
      const fl = fulfillmentLines.find(f => f.lineItemId === li.id);
      const planned = li.bottles_ordered;
      const alreadyPacked = fl?.qtyPacked || 0;
      return {
        lineItemId: li.id,
        lineNumber: li.line_number,
        formulaCode: li.formula_code,
        plannedBottles: planned,
        actualBottles: alreadyPacked || planned,
        isRecorded: alreadyPacked > 0,
        delta: (alreadyPacked || planned) - planned,
        shortageAction: 'none' as const,
        shortageReason: '',
      };
    });
    onPackagingLinesChange(initial);
    return null;
  }

  const handleActualChange = (idx: number, value: number) => {
    const updated = [...packagingLines];
    const line = updated[idx];
    updated[idx] = {
      ...line,
      actualBottles: value,
      delta: value - line.plannedBottles,
      shortageAction: value < line.plannedBottles ? line.shortageAction : 'none',
    };
    onPackagingLinesChange(updated);
  };

  const handleShortageAction = (idx: number, action: 'produce_later' | 'accept_shortage') => {
    const updated = [...packagingLines];
    updated[idx] = { ...updated[idx], shortageAction: action };
    onPackagingLinesChange(updated);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Record actual bottles packed for each line. Excess will automatically create bright stock; shortages require action.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Line</TableHead>
            <TableHead>Formula</TableHead>
            <TableHead className="text-right">Planned</TableHead>
            <TableHead className="text-right">Actual Packed</TableHead>
            <TableHead className="text-right">Delta</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {packagingLines.map((line, idx) => (
            <>
              <TableRow key={line.lineItemId}>
                <TableCell className="font-medium">{line.lineNumber}</TableCell>
                <TableCell className="font-medium">{line.formulaCode}</TableCell>
                <TableCell className="text-right">{line.plannedBottles.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  {line.isRecorded ? (
                    <span className="font-medium">{line.actualBottles.toLocaleString()}</span>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      value={line.actualBottles}
                      onChange={(e) => handleActualChange(idx, parseInt(e.target.value) || 0)}
                      className="w-24 ml-auto text-right"
                    />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {line.delta > 0 ? (
                    <span className="text-purple-600 font-medium">+{line.delta.toLocaleString()}</span>
                  ) : line.delta < 0 ? (
                    <span className="text-red-600 font-medium">{line.delta.toLocaleString()}</span>
                  ) : (
                    <span className="text-green-600">Exact</span>
                  )}
                </TableCell>
                <TableCell>
                  {line.delta > 0 && (
                    <Badge className="bg-purple-100 text-purple-800">Excess → Bright Stock</Badge>
                  )}
                  {line.delta < 0 && (
                    <Badge className="bg-red-100 text-red-800">Shortage</Badge>
                  )}
                  {line.delta === 0 && (
                    <Badge className="bg-green-100 text-green-800">Match</Badge>
                  )}
                </TableCell>
              </TableRow>
              {line.delta < 0 && !line.isRecorded && (
                <TableRow key={`${line.lineItemId}-action`}>
                  <TableCell colSpan={6} className="py-2">
                    <div className="flex items-center gap-3 pl-4">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                      <span className="text-sm text-muted-foreground">Action:</span>
                      <Button
                        size="sm"
                        variant={line.shortageAction === 'produce_later' ? 'default' : 'outline'}
                        onClick={() => handleShortageAction(idx, 'produce_later')}
                      >
                        Produce Later
                      </Button>
                      <Button
                        size="sm"
                        variant={line.shortageAction === 'accept_shortage' ? 'default' : 'outline'}
                        onClick={() => handleShortageAction(idx, 'accept_shortage')}
                      >
                        Accept Shortage
                      </Button>
                      {line.shortageAction === 'accept_shortage' && (
                        <Textarea
                          placeholder="Reason..."
                          value={line.shortageReason}
                          onChange={(e) => {
                            const updated = [...packagingLines];
                            updated[idx] = { ...updated[idx], shortageReason: e.target.value };
                            onPackagingLinesChange(updated);
                          }}
                          rows={1}
                          className="flex-1 min-h-[32px] text-sm"
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>

      {packagingLines.some(l => l.delta > 0) && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 text-purple-700 rounded-lg">
          <Package className="h-5 w-5" />
          <span className="text-sm font-medium">
            {packagingLines.filter(l => l.delta > 0).reduce((s, l) => s + l.delta, 0).toLocaleString()} excess bottles will be added to bright stock
          </span>
        </div>
      )}
    </div>
  );
};

export type { PackagingLine };
