import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Calendar, Package, Trash2, Edit } from 'lucide-react';
import { useOrderMilestones, OrderMilestone } from '@/hooks/useOrderMilestones';
import { AddMilestoneModal } from './AddMilestoneModal';
import { EditMilestoneModal } from './EditMilestoneModal';
import { format, differenceInDays } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { OrderLineItem } from '@/hooks/useOrderLineItems';
import { formatET } from "@/utils/dateUtils";

interface DeliveryMilestonesProps {
  orderId: string;
  orderDueDate: string;
  totalBottles: number;
  lineItems: OrderLineItem[];
}

const getStatusColor = (status: OrderMilestone['status']) => {
  switch (status) {
    case 'completed':
      return 'default';
    case 'on_track':
      return 'secondary';
    case 'at_risk':
      return 'outline';
    case 'delayed':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const getStatusLabel = (status: OrderMilestone['status']) => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'on_track':
      return 'On Track';
    case 'at_risk':
      return 'At Risk';
    case 'delayed':
      return 'Delayed';
    default:
      return 'Pending';
  }
};

export const DeliveryMilestones = ({
  orderId,
  orderDueDate,
  totalBottles,
  lineItems,
}: DeliveryMilestonesProps) => {
  const { milestones, isLoading, deleteMilestone } = useOrderMilestones(orderId);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<OrderMilestone | null>(null);
  const [deletingMilestone, setDeletingMilestone] = useState<string | null>(null);

  const existingMilestoneBottles = milestones.reduce(
    (sum, m) => sum + m.target_bottles,
    0
  );

  const handleDelete = async () => {
    if (deletingMilestone) {
      await deleteMilestone.mutateAsync(deletingMilestone);
      setDeletingMilestone(null);
    }
  };

  // Group milestones by line item
  const milestonesByLine = lineItems.map(lineItem => ({
    lineItem,
    milestones: milestones.filter(m => m.line_item_id === lineItem.id),
  }));

  const getLineItemAllocated = (lineItemId: string) => {
    return milestones
      .filter(m => m.line_item_id === lineItemId)
      .reduce((sum, m) => sum + m.target_bottles, 0);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delivery Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading milestones...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Delivery Milestones</CardTitle>
          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            disabled={existingMilestoneBottles >= totalBottles}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Milestone
          </Button>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No delivery milestones set. Add milestones to track multiple shipment deadlines for each product line.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {milestonesByLine.map(({ lineItem, milestones: lineMilestones }) => {
                if (lineMilestones.length === 0) return null;
                
                const allocated = getLineItemAllocated(lineItem.id);
                
                return (
                  <div key={lineItem.id} className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b">
                      <div>
                        <h4 className="font-medium">
                          {lineItem.formula_code} - {lineItem.formula_name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Line #{lineItem.line_number} • {lineItem.bottle_size}ct • {allocated.toLocaleString()} of {lineItem.bottles_ordered.toLocaleString()} bottles
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {lineMilestones.map((milestone) => {
                        const progressPercent =
                          (milestone.shipped_bottles / milestone.target_bottles) * 100;
                        const daysRemaining = differenceInDays(
                          new Date(milestone.target_date),
                          new Date()
                        );

                        return (
                          <div
                            key={milestone.id}
                            className="border rounded-lg p-4 space-y-3 ml-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-medium text-sm">
                                    Milestone {milestone.milestone_number}
                                  </h5>
                                  <Badge variant={getStatusColor(milestone.status)}>
                                    {getStatusLabel(milestone.status)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>
                                      {formatET(milestone.target_date, 'MMM d, yyyy')}
                                    </span>
                                    {milestone.status !== 'completed' && milestone.status !== 'delayed' && (
                                      <span className="text-xs">
                                        ({daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Package className="h-3.5 w-3.5" />
                                    <span>
                                      {milestone.shipped_bottles.toLocaleString()} of{' '}
                                      {milestone.target_bottles.toLocaleString()} bottles
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingMilestone(milestone)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingMilestone(milestone.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Progress</span>
                                <span>{progressPercent.toFixed(0)}%</span>
                              </div>
                              <Progress value={progressPercent} />
                            </div>

                            {milestone.notes && (
                              <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">
                                {milestone.notes}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {existingMilestoneBottles < totalBottles && (
            <div className="mt-4 p-3 bg-muted/50 rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>{(totalBottles - existingMilestoneBottles).toLocaleString()}</strong>{' '}
                bottles remaining to allocate to milestones across all product lines
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddMilestoneModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        orderId={orderId}
        orderDueDate={orderDueDate}
        totalBottles={totalBottles}
        currentMilestoneCount={milestones.length}
        existingMilestoneBottles={existingMilestoneBottles}
      />

      <EditMilestoneModal
        open={!!editingMilestone}
        onOpenChange={(open) => !open && setEditingMilestone(null)}
        milestone={editingMilestone}
        maxBottles={editingMilestone ? 
          lineItems.find(l => l.id === editingMilestone.line_item_id)?.bottles_ordered || 0 
          : 0
        }
      />

      <AlertDialog
        open={!!deletingMilestone}
        onOpenChange={(open) => !open && setDeletingMilestone(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this delivery milestone? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
