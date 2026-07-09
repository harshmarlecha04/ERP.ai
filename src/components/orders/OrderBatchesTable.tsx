import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { formatET } from "@/utils/dateUtils";

export interface OrderDetailBatch {
  id: string;
  production_schedule_item_id: string;
  estimated_bottles: number;
  actual_bottles_packed: number | null;
  batch_sequence: number;
  schedule_date: string;
  batches: number;
  current_stage: string;
  materials_ok: boolean;
  formula_code: string;
  yield_variance_percent: number | null;
}

interface OrderBatchesTableProps {
  batches: OrderDetailBatch[];
}

const getStageInfo = (stage: string) => {
  const stages = {
    scheduled: { label: 'Scheduled', color: 'bg-blue-500', icon: Clock },
    production: { label: 'Production', color: 'bg-yellow-500', icon: Clock },
    drying: { label: 'Drying', color: 'bg-orange-500', icon: Clock },
    coating: { label: 'Coating', color: 'bg-purple-500', icon: Clock },
    packaging: { label: 'Packaging', color: 'bg-indigo-500', icon: Clock },
    completed: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle },
  };
  return stages[stage as keyof typeof stages] || { label: stage, color: 'bg-gray-500', icon: AlertCircle };
};

export function OrderBatchesTable({ batches }: OrderBatchesTableProps) {
  if (batches.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No production batches scheduled yet
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch #</TableHead>
            <TableHead>Schedule Date</TableHead>
            <TableHead>Formula Code</TableHead>
            <TableHead>Batches</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Estimated Bottles</TableHead>
            <TableHead>Packed</TableHead>
            <TableHead>Yield %</TableHead>
            <TableHead>Materials</TableHead>
            <TableHead>Reserved</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => {
            const stageInfo = getStageInfo(batch.current_stage);
            const StageIcon = stageInfo.icon;

            return (
              <TableRow key={batch.id}>
                <TableCell className="font-medium">#{batch.batch_sequence}</TableCell>
                <TableCell>{formatET(batch.schedule_date, 'MMM dd, yyyy')}</TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{batch.formula_code}</code>
                </TableCell>
                <TableCell>{batch.batches}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1">
                    <StageIcon className="h-3 w-3" />
                    {stageInfo.label}
                  </Badge>
                </TableCell>
                <TableCell>{batch.estimated_bottles}</TableCell>
                <TableCell>
                  {batch.actual_bottles_packed ? (
                    <span className="text-green-600 font-medium">
                      {batch.actual_bottles_packed}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {batch.yield_variance_percent !== null && batch.yield_variance_percent !== undefined ? (
                    <Badge variant={Math.abs(batch.yield_variance_percent) > 5 ? "destructive" : "default"}>
                      {batch.yield_variance_percent > 0 ? '+' : ''}{batch.yield_variance_percent.toFixed(1)}%
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {batch.materials_ok ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      OK
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      Shortage
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1">
                    🔓 No
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
