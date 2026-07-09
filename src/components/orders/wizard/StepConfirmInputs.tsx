import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { FulfillmentLineMetrics } from '@/hooks/useOrderFulfillment';

interface StepConfirmInputsProps {
  orderNumber: string;
  customerName: string;
  dueDate: string;
  lines: FulfillmentLineMetrics[];
  lineItems: Array<{
    id: string;
    line_number: string;
    formula_id: string;
    formula_code: string;
    formula_name: string;
    bottle_size: number;
    bottles_ordered: number;
    selected_bottle_id?: string | null;
    selected_cap_id?: string | null;
    selected_label_id?: string | null;
  }>;
}

export const StepConfirmInputs = ({ orderNumber, customerName, dueDate, lines, lineItems }: StepConfirmInputsProps) => {
  const allValid = lineItems.every(li => li.formula_id);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">PO Number</p>
          <p className="font-semibold">{orderNumber}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Customer</p>
          <p className="font-semibold">{customerName}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Due Date</p>
          <p className="font-semibold">{dueDate}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Line</TableHead>
            <TableHead>Formula</TableHead>
            <TableHead>Bottle Size</TableHead>
            <TableHead className="text-right">Qty Requested</TableHead>
            <TableHead>Packaging</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.map((li) => {
            const hasFormula = !!li.formula_id;
            const hasPackaging = !!(li.selected_bottle_id || li.selected_cap_id);
            const isValid = hasFormula;

            return (
              <TableRow key={li.id}>
                <TableCell className="font-medium">{li.line_number}</TableCell>
                <TableCell>
                  <span className="font-medium">{li.formula_code}</span>
                  <span className="text-xs text-muted-foreground ml-1">{li.formula_name}</span>
                </TableCell>
                <TableCell>{li.bottle_size} ct</TableCell>
                <TableCell className="text-right font-semibold">{li.bottles_ordered.toLocaleString()}</TableCell>
                <TableCell>
                  {hasPackaging ? (
                    <Badge className="bg-green-100 text-green-800 border-green-300">Configured</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Not set</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {isValid ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm">Valid</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-yellow-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">Missing formula</span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {allValid && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium">All inputs validated — ready to proceed</span>
        </div>
      )}
    </div>
  );
};
