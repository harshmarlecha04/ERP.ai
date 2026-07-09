import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, AlertTriangle, Scale, GitBranch, Zap, ExternalLink, MinusCircle } from "lucide-react";
import { QualityScheduleItem } from "@/hooks/useQualityData";

interface QualityBatchTableProps {
  items: QualityScheduleItem[];
  loading: boolean;
  onWeighUp: (item: QualityScheduleItem) => void;
  onStageTracking: (item: QualityScheduleItem) => void;
  onProcessBatch: (item: QualityScheduleItem) => void;
  onDeductInventory: (item: QualityScheduleItem) => void;
  isBatchDeducted: (scheduleItemId: string) => boolean;
}

export const QualityBatchTable: React.FC<QualityBatchTableProps> = ({
  items,
  loading,
  onWeighUp,
  onStageTracking,
  onProcessBatch,
  onDeductInventory,
  isBatchDeducted,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const formatted = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    return { formatted, dayName, date };
  };

  const isSchedulePastDue = (scheduleDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduled = new Date(scheduleDate + 'T00:00:00');
    return scheduled < today;
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading batches...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No scheduled batches for quality control</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Product Code</TableHead>
            <TableHead className="font-semibold">Customer Name</TableHead>
            <TableHead className="font-semibold">Product Name</TableHead>
            <TableHead className="font-semibold">Scheduled Date</TableHead>
            <TableHead className="font-semibold text-center">Batches</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isDeducted = isBatchDeducted(item.id);
            const isPastDue = isSchedulePastDue(item.schedule_date);
            const { formatted, dayName } = formatDate(item.schedule_date);
            
            return (
              <TableRow 
                key={item.id} 
                className="hover:bg-muted/30 transition-colors"
              >
                <TableCell className="font-mono font-medium">
                  {item.formula_code}
                </TableCell>
                
                <TableCell>
                  {item.customer_name ? (
                    <span className="font-medium">{item.customer_name}</span>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Internal/Generic
                    </Badge>
                  )}
                </TableCell>
                
                <TableCell className="font-medium">
                  {item.formula_name}
                </TableCell>
                
                <TableCell>
                  <div className="flex flex-col">
                    <span className={isPastDue ? "text-destructive font-medium" : ""}>
                      {formatted}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {dayName}
                    </span>
                  </div>
                </TableCell>
                
                <TableCell className="text-center">
                  <Badge variant="outline" className="font-semibold">
                    {item.batches}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {!item.materials_ok && (
                      <Badge variant="destructive" className="text-xs flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Shortage
                      </Badge>
                    )}
                    {isDeducted && (
                      <Badge className="bg-blue-500 text-white text-xs">
                        Deducted
                      </Badge>
                    )}
                    {item.weighed_at && (
                      <Badge className="bg-green-500 text-white text-xs">
                        Weighed
                      </Badge>
                    )}
                    {item.ingredient_assignments > 0 && !isDeducted && (
                      <Badge className="bg-purple-500 text-white text-xs">
                        Auto-Pop
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onWeighUp(item)}>
                        <Scale className="h-4 w-4 mr-2" />
                        Weigh Up
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStageTracking(item)}>
                        <GitBranch className="h-4 w-4 mr-2" />
                        Stage Tracking
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onProcessBatch(item)}>
                        <Zap className="h-4 w-4 mr-2" />
                        Process Batch
                      </DropdownMenuItem>
                      {item.ingredient_assignments > 0 && !isDeducted && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onDeductInventory(item)}>
                            <MinusCircle className="h-4 w-4 mr-2" />
                            Deduct Inventory
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
