import React, { useState } from 'react';
import { Package, AlertTriangle, CheckCircle, MousePointer } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useBatchCalculation } from '@/hooks/useBatchCalculation';
import { BatchInventoryModal } from './BatchInventoryModal';

interface BatchCalculationDisplayProps {
  formulaId: string;
  formulaName: string;
  variant?: 'card' | 'inline';
}

export const BatchCalculationDisplay: React.FC<BatchCalculationDisplayProps> = ({
  formulaId,
  formulaName,
  variant = 'card'
}) => {
  const { data: batchData, isLoading, error } = useBatchCalculation(formulaId);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getBatchCountColor = (maxBatches: number) => {
    if (maxBatches === 0) return 'text-muted-foreground';
    if (maxBatches < 5) return 'text-red-500';
    if (maxBatches < 10) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getBatchCountBgColor = (maxBatches: number) => {
    if (maxBatches === 0) return 'bg-muted/30';
    if (maxBatches < 5) return 'bg-red-50 border-red-200';
    if (maxBatches < 10) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  const getStatusIcon = (maxBatches: number) => {
    if (maxBatches === 0) return <AlertTriangle className="h-3 w-3 text-muted-foreground" />;
    if (maxBatches < 5) return <AlertTriangle className="h-3 w-3 text-red-500" />;
    if (maxBatches < 10) return <AlertTriangle className="h-3 w-3 text-yellow-600" />;
    return <CheckCircle className="h-3 w-3 text-green-600" />;
  };

  const maxBatches = batchData?.max_batches || 0;

  // Inline variant for table cells
  if (variant === 'inline') {
    if (isLoading) {
      return (
        <div className="inline-flex items-center justify-center">
          <Skeleton className="h-5 w-8" />
        </div>
      );
    }

    if (error) {
      return (
        <span className="text-destructive cursor-help" title="Error loading batch data">
          ?
        </span>
      );
    }

    return (
      <>
        <div 
          className="cursor-pointer hover:underline inline-flex items-center justify-center gap-1 transition-opacity hover:opacity-80"
          onClick={() => setIsModalOpen(true)}
        >
          <span className={`text-lg font-bold ${getBatchCountColor(maxBatches)}`}>
            {maxBatches}
          </span>
        </div>

        <BatchInventoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          formulaName={formulaName}
          batchData={batchData}
        />
      </>
    );
  }

  // Card variant (default)
  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl p-4 border border-border/30">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">Can Make</p>
          <Skeleton className="w-3 h-3 rounded-full" />
        </div>
        <Skeleton className="h-8 w-20 mb-1" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl p-4 border border-border/30">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">Can Make</p>
          <AlertTriangle className="h-3 w-3 text-red-500" />
        </div>
        <p className="text-sm text-red-500">Error loading</p>
      </div>
    );
  }

  return (
    <>
      <div 
        className={`bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl p-4 border border-border/30 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all duration-200 ${getBatchCountBgColor(maxBatches)}`}
        onClick={() => setIsModalOpen(true)}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">Can Make</p>
          <div className="flex items-center gap-1">
            {getStatusIcon(maxBatches)}
            <MousePointer className="h-3 w-3 text-muted-foreground/50" />
          </div>
        </div>
        <p className={`text-2xl font-bold ${getBatchCountColor(maxBatches)}`}>
          {maxBatches}
        </p>
        <p className="text-xs text-muted-foreground">
          {maxBatches === 1 ? 'batch' : 'batches'} • click for details
        </p>
      </div>

      <BatchInventoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formulaName={formulaName}
        batchData={batchData}
      />
    </>
  );
};