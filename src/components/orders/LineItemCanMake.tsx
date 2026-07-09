import { useComprehensiveMaterialCheck } from '@/hooks/useComprehensiveMaterialCheck';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LineItemCanMakeProps {
  lineItem: {
    id: string;
    formula_id: string;
    bottles_ordered: number;
    bottle_size: number;
    selected_bottle_id?: string | null;
    selected_cap_id?: string | null;
    selected_label_id?: string | null;
    formula?: {
      id: string;
      code: string;
      name: string;
      gummies_per_batch?: number;
      default_batch_size_kg?: number;
    } | null;
  };
}

export const LineItemCanMake = ({ lineItem }: LineItemCanMakeProps) => {
  // Calculate batches needed using the same 43,000 divisor
  const bottleSize = lineItem.bottle_size;
  const totalGummiesNeeded = lineItem.bottles_ordered * bottleSize;
  const batchesNeeded = Math.ceil(totalGummiesNeeded / 43000);

  // Check material availability
  const materialStatus = useComprehensiveMaterialCheck(
    lineItem.formula_id,
    lineItem.bottles_ordered,
    lineItem.bottle_size,
    batchesNeeded
  );

  // Show loading state
  if (materialStatus.overallStatus === 'checking' || materialStatus.overallStatus === 'pending') {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  // Get max batches from ingredients (limiting factor)
  const maxBatches = materialStatus.ingredients?.maxBatches || 0;
  
  // Calculate how many bottles can be made
  // Formula: (maxBatches * 43000) / bottle_size
  const canMakeBottles = Math.floor((maxBatches * 43000) / bottleSize);

  // Determine color based on capacity
  const getColorClass = () => {
    if (canMakeBottles >= lineItem.bottles_ordered) {
      return 'text-green-600 font-medium'; // Can make full order
    } else if (canMakeBottles > 0) {
      return 'text-yellow-600 font-medium'; // Can make partial
    } else {
      return 'text-red-600 font-medium'; // Cannot make any
    }
  };

  return (
    <div className={cn('text-right', getColorClass())}>
      {canMakeBottles.toLocaleString()}
      {canMakeBottles < lineItem.bottles_ordered && (
        <div className="text-xs text-muted-foreground font-normal">
          of {lineItem.bottles_ordered.toLocaleString()}
        </div>
      )}
    </div>
  );
};
