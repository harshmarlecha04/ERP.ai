import { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useComprehensiveMaterialCheck } from '@/hooks/useComprehensiveMaterialCheck';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MaterialStatusCard } from '@/components/orders/MaterialStatusCard';

interface LineItemMaterialStatusProps {
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

export const LineItemMaterialStatus = ({ lineItem }: LineItemMaterialStatusProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  // Calculate batches needed using the same 43,000 divisor as the display column
  const bottleSize = lineItem.bottle_size;
  const totalGummiesNeeded = lineItem.bottles_ordered * bottleSize;
  const batchesNeeded = Math.ceil(totalGummiesNeeded / 43000);

  // Check material availability
  const materialStatus = useComprehensiveMaterialCheck(
    lineItem.formula_id,
    lineItem.bottles_ordered,
    lineItem.bottle_size,
    batchesNeeded,
    undefined,
    lineItem.selected_bottle_id || undefined,
    lineItem.selected_cap_id || undefined,
    lineItem.selected_label_id || undefined
  );

  // Status icon helper
  const getStatusIcon = () => {
    switch (materialStatus.overallStatus) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'checking':
        return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
      default:
        return null;
    }
  };

  // Status badge helper
  const getStatusBadge = () => {
    switch (materialStatus.overallStatus) {
      case 'available':
        return <Badge variant="default" className="bg-green-500">All Available</Badge>;
      case 'partial':
        return <Badge variant="default" className="bg-yellow-500">Partial</Badge>;
      case 'critical':
        return <Badge variant="destructive">Shortages</Badge>;
      case 'checking':
        return <Badge variant="secondary">Checking...</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (materialStatus.overallStatus === 'pending' || materialStatus.overallStatus === 'checking') {
    return (
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        {getStatusBadge()}
      </div>
    );
  }

  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 cursor-pointer hover:bg-accent">
            {getStatusBadge()}
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent className="[--dialog-max-width:48rem]">
        <DialogHeader>
          <DialogTitle>
            Material Availability - {lineItem.formula?.code || lineItem.formula?.name || 'Formula'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <div className="mb-4 text-sm text-muted-foreground">
            <p>Order: {lineItem.bottles_ordered.toLocaleString()} bottles × {lineItem.bottle_size}ct</p>
            <p>Batches needed: {batchesNeeded}</p>
          </div>
          
          <MaterialStatusCard materialStatus={materialStatus} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
