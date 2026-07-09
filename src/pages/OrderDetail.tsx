import { useParams, useNavigate } from 'react-router-dom';
import { parseDateString, formatET } from "@/utils/dateUtils";
import { useOrderDetail } from '@/hooks/useOrderDetail';
import { useOrderLineItems } from '@/hooks/useOrderLineItems';
import { useOrderEmailEvents } from '@/hooks/useOrderEmailEvents';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Calendar, Package, User, FileText, AlertCircle, Plus, Search, RefreshCw, Lock, Truck, Edit, Trash2, Upload, Eye, Mail, ClipboardCheck } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { OrderBatchesTable } from '@/components/orders/OrderBatchesTable';
import { ProductionTimeline } from '@/components/orders/ProductionTimeline';
import { MaterialReservationModal } from '@/components/orders/MaterialReservationModal';
import { RecordShipmentModal } from '@/components/orders/RecordShipmentModal';
import { ShipmentHistory } from '@/components/orders/ShipmentHistory';
import { DeliveryMilestones } from '@/components/orders/DeliveryMilestones';
import { EditLineItemModal } from '@/components/orders/EditLineItemModal';
import { POPDFViewerModal } from '@/components/orders/POPDFViewerModal';
import { POScanReviewModal } from '@/components/orders/POScanReviewModal';
import { Sparkles } from 'lucide-react';
import { FulfillmentReconciliation } from '@/components/orders/FulfillmentReconciliation';
import { FinishPOWizard } from '@/components/orders/FinishPOWizard';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { OrderLineItem } from '@/hooks/useOrderLineItems';
import { AuditTrailDrawer } from '@/components/audit/AuditTrailDrawer';
import { OrderApprovalBanner } from '@/components/orders/OrderApprovalBanner';

const getStatusBadge = (status: string) => {
  const variants = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    scheduled: 'bg-blue-100 text-blue-800 border-blue-300',
    in_production: 'bg-purple-100 text-purple-800 border-purple-300',
    completed: 'bg-green-100 text-green-800 border-green-300',
    on_hold: 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return (
    <Badge variant="outline" className={variants[status as keyof typeof variants] || ''}>
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  );
};

const getPriorityBadge = (priority: string) => {
  const variants = {
    urgent: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    normal: 'bg-blue-100 text-blue-800 border-blue-300',
    low: 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return (
    <Badge variant="outline" className={variants[priority as keyof typeof variants] || ''}>
      {priority.toUpperCase()}
    </Badge>
  );
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  PO_CREATED: 'PO Received',
  SCHEDULED: 'Scheduled',
  PRODUCTION_COMPLETE: 'Production Complete',
  READY_FOR_PICKUP: 'Ready for Pickup',
};

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-green-100 text-green-800 border-green-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
  skipped: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  pending: 'bg-blue-100 text-blue-800 border-blue-300',
};

function EmailTimelineCard({ orderId }: { orderId: string }) {
  const { data: emailEvents, isLoading } = useOrderEmailEvents(orderId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !emailEvents || emailEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No email notifications sent yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">
                    {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                  </TableCell>
                  <TableCell>{event.recipient_email}</TableCell>
                  <TableCell>
                    {event.sent_at ? formatET(event.sent_at, 'MMM d, yyyy h:mm a') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[event.status] || ''}>
                      {event.status}
                    </Badge>
                    {event.error_message && (
                      <span className="ml-2 text-xs text-muted-foreground" title={event.error_message}>
                        ⚠
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: order, isLoading } = useOrderDetail(id!);
  const { lineItems } = useOrderLineItems(id);
  const { deleteLineItem } = useOrderLineItems();
  const { toast } = useToast();
  const [isCheckingMaterials, setIsCheckingMaterials] = useState(false);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<OrderLineItem | null>(null);
  const [deletingLineItem, setDeletingLineItem] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanPdfPath, setScanPdfPath] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const handlePdfChange = () => {
    queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
  };

  const handleCheckMaterials = async () => {
    if (!order) return;
    setIsCheckingMaterials(true);
    try {
      // Check materials for first line item (simplified check)
      if (order.line_items.length === 0) {
        toast({
          title: "No products",
          description: "This order has no product lines to check",
          variant: "destructive",
        });
        return;
      }

      const firstLine = order.line_items[0];
      const { data, error } = await supabase.rpc("calculate_max_batches", {
        p_formula_id: firstLine.formula_id,
      } as any);

      if (error) throw error;
      
      toast({
        title: "Material Check Complete",
        description: `Checked materials for ${firstLine.formula_code}`,
      });
    } catch (error: any) {
      toast({
        title: "Error checking materials",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingMaterials(false);
    }
  };

  const handleDeleteLineItem = async () => {
    if (deletingLineItem) {
      await deleteLineItem.mutateAsync(deletingLineItem);
      setDeletingLineItem(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Order Not Found</h3>
              <p className="text-muted-foreground mb-4">The order you're looking for doesn't exist.</p>
              <Button onClick={() => navigate('/orders')}>Back to Orders</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{order.order_number}</h1>
            <p className="text-muted-foreground">Customer Order Details</p>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <AuditTrailDrawer entityType="orders" entityId={order.id} />
          <Button onClick={() => setWizardOpen(true)} className="bg-green-600 hover:bg-green-700">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            {order.fulfillment_status === 'open' || !order.fulfillment_status ? 'Finish this PO' : 'Resume Wizard'}
          </Button>
          {order.fulfillment_status && order.fulfillment_status !== 'open' && (
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
              {order.fulfillment_status.replace('_', ' ').toUpperCase()}
            </Badge>
          )}
          {getStatusBadge(order.status)}
          {getPriorityBadge(order.priority)}
        </div>
      </div>

      <OrderApprovalBanner orderId={order.id} />



      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle>Order Fulfillment Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Ordered</p>
              <p className="text-2xl font-bold">{order.total_bottles_ordered.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Packed</p>
              <p className="text-2xl font-bold text-blue-600">{order.total_bottles_packed.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Shipped</p>
              <p className="text-2xl font-bold text-green-600">{order.total_bottles_shipped.toLocaleString()}</p>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Production Progress</span>
              <span className="font-semibold">{order.progress_percent}%</span>
            </div>
            <Progress value={order.progress_percent} className="h-3" />
          </div>

          {order.total_bottles_shipped > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Fulfillment Progress</span>
                  <span className="font-semibold">
                    {Math.round((order.total_bottles_shipped / order.total_bottles_ordered) * 100)}%
                  </span>
                </div>
                <Progress 
                  value={(order.total_bottles_shipped / order.total_bottles_ordered) * 100} 
                  className="h-3" 
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {(order.total_bottles_ordered - order.total_bottles_shipped).toLocaleString()} bottles remaining to ship
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button 
            variant="outline" 
            onClick={handleCheckMaterials}
            disabled={isCheckingMaterials}
          >
            {isCheckingMaterials ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Re-check Materials
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate("/production")}
          >
            <Calendar className="mr-2 h-4 w-4" />
            View Production Calendar
          </Button>
          <Button onClick={() => navigate(`/production?scheduleFor=${id}`)}>
            <Plus className="mr-2 h-4 w-4" />
            Add More Batches
          </Button>
          {order.status === 'scheduled' && order.production_batches.length > 0 && (
            <Button 
              onClick={() => setReservationModalOpen(true)}
              variant="default"
            >
              <Lock className="mr-2 h-4 w-4" />
              Reserve Materials
            </Button>
          )}
          {order.line_items.length > 0 && (
            <Button 
              onClick={() => setShipmentModalOpen(true)}
              variant="default"
            >
              <Truck className="mr-2 h-4 w-4" />
              Record Shipment
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Production Timeline */}
      {order.production_batches.length > 0 && (
        <ProductionTimeline
          orderCreated={new Date(order.created_at)}
          productionStart={parseDateString(order.production_batches[0].schedule_date)}
          productionEnd={parseDateString(order.production_batches[order.production_batches.length - 1].schedule_date)}
          packagingReady={subDays(parseDateString(order.due_date), 2)}
          targetShipDate={parseDateString(order.due_date)}
          currentStatus={order.status}
          batchBreakdown={order.production_batches.reduce((acc: any[], batch) => {
            const existing = acc.find(b => b.date.getTime() === parseDateString(batch.schedule_date).getTime());
            if (existing) {
              existing.batches += 1;
              existing.bottles += batch.estimated_bottles;
            } else {
              acc.push({
                date: parseDateString(batch.schedule_date),
                batches: 1,
                bottles: batch.estimated_bottles,
              });
            }
            return acc;
          }, [])}
        />
      )}

      {/* Order Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer & Product Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer & Product
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{order.customer_name}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Products</p>
              <p className="font-medium">{order.line_items.length} product line(s)</p>
              {order.line_items.slice(0, 2).map((line) => (
                <code key={line.id} className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block mr-2">
                  {line.formula_code}
                </code>
              ))}
              {order.line_items.length > 2 && (
                <span className="text-xs text-muted-foreground">+{order.line_items.length - 2} more</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Specifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Specifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Total Bottles Ordered</p>
              <p className="font-medium text-2xl">{order.total_bottles_ordered.toLocaleString()}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Product Lines</p>
              <p className="font-medium">{order.line_items.length}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Bottles Shipped</p>
              <p className="font-medium">{order.total_bottles_shipped.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Order Created</p>
              <p className="font-medium">{formatET(order.created_at, 'MMM dd, yyyy')}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">{formatET(order.due_date, 'MMM dd, yyyy')}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Days Until Due</p>
              <p className="font-medium">
                {Math.ceil((new Date(order.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
              </p>
            </div>
            {order.received_via && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Received Via</p>
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <p className="font-medium text-sm">
                      {order.received_via === 'forwarded_by_boss' ? 'Forwarded by Boss' : 'Direct from Customer'}
                    </p>
                  </div>
                  {order.received_from_email && (
                    <p className="text-xs text-muted-foreground">{order.received_from_email}</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes & Instructions */}
      {(order.notes || order.special_instructions) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes & Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.special_instructions && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Special Instructions</p>
                <p className="text-sm bg-yellow-50 border border-yellow-200 rounded p-3">
                  {order.special_instructions}
                </p>
              </div>
            )}
            {order.notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PO Document */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PO Document
            {order.po_number && (
              <Badge variant="outline" className="ml-2">{order.po_number}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {order.pdf_url ? (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-medium">PO Document Uploaded</p>
                  <p className="text-sm text-muted-foreground">Click to view or manage the PDF</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setScanPdfPath(order.pdf_url); setScanModalOpen(true); }}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Scan with AI
                </Button>
                <Button onClick={() => setPdfModalOpen(true)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View PDF
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 border-2 border-dashed rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">No PO Document</p>
                  <p className="text-sm text-muted-foreground">Upload a PDF of the Purchase Order</p>
                </div>
              </div>
              <Button onClick={() => setPdfModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload PDF
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Lines Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Product Lines ({lineItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {lineItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No product lines yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line #</TableHead>
                  <TableHead>Formula</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Shipped</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">{line.line_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{line.formula_code}</p>
                        <p className="text-sm text-muted-foreground">{line.formula_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>{line.bottle_size} ct</TableCell>
                    <TableCell className="text-right">{line.bottles_ordered.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{line.bottles_shipped.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{line.bottles_remaining.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {line.production_status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingLineItem(line)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingLineItem(line.id)}
                          disabled={line.bottles_shipped > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fulfillment Reconciliation */}
      <FulfillmentReconciliation orderId={order.id} />

      {/* Production Batches */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Production Batches ({order.production_batches.length})</CardTitle>
            <Button onClick={() => navigate(`/production?order=${order.id}`)}>
              Schedule More Batches
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <OrderBatchesTable batches={order.production_batches} />
        </CardContent>
      </Card>

      {/* Delivery Milestones */}
      <DeliveryMilestones
        orderId={order.id}
        orderDueDate={order.due_date}
        totalBottles={order.total_bottles_ordered}
        lineItems={lineItems}
      />

      {/* Shipment History */}
      <ShipmentHistory 
        orderId={order.id}
        bottlesOrdered={order.total_bottles_ordered}
      />

      {/* Email Notifications Timeline */}
      <EmailTimelineCard orderId={order.id} />

      {/* Material Reservation Modal */}
      <MaterialReservationModal
        open={reservationModalOpen}
        onOpenChange={setReservationModalOpen}
        orderId={order.id}
        orderNumber={order.order_number}
        scheduleItemIds={order.production_batches.map(b => b.production_schedule_item_id)}
      />

      {/* Record Shipment Modal */}
      <RecordShipmentModal
        open={shipmentModalOpen}
        onOpenChange={setShipmentModalOpen}
        orderId={order.id}
        lineItems={order.line_items.map(li => ({
          id: li.id,
          line_number: li.line_number,
          formula_code: li.formula_code,
          formula_name: li.formula_name,
          bottles_ordered: li.bottles_ordered,
          bottles_shipped: li.bottles_shipped,
          bottles_remaining: li.bottles_remaining,
        }))}
      />

      {/* Edit Line Item Modal */}
      <EditLineItemModal
        open={!!editingLineItem}
        onOpenChange={(open) => !open && setEditingLineItem(null)}
        lineItem={editingLineItem}
      />

      {/* Delete Line Item Confirmation */}
      <AlertDialog
        open={!!deletingLineItem}
        onOpenChange={(open) => !open && setDeletingLineItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product Line</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product line? This action cannot be undone and will also delete any associated milestones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLineItem}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PO PDF Viewer Modal */}
      <POPDFViewerModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        orderId={order.id}
        poNumber={order.po_number}
        pdfUrl={order.pdf_url}
        onPdfChange={handlePdfChange}
        onUploadSuccess={(path) => {
          setPdfModalOpen(false);
          setScanPdfPath(path);
          setScanModalOpen(true);
        }}
      />

      {/* AI PO Scan Review Modal */}
      {scanModalOpen && scanPdfPath && (
        <POScanReviewModal
          isOpen={scanModalOpen}
          onClose={() => setScanModalOpen(false)}
          orderId={order.id}
          pdfPath={scanPdfPath}
          poNumber={order.po_number}
          onApplied={() => {
            queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
          }}
        />
      )}

      {/* Finish PO Wizard */}
      <FinishPOWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        orderId={order.id}
        orderNumber={order.order_number}
        customerName={order.customer_name}
        dueDate={order.due_date}
        lineItems={order.line_items.map(li => ({
          id: li.id,
          line_number: li.line_number,
          formula_id: li.formula_id,
          formula_code: li.formula_code,
          formula_name: li.formula_name,
          bottles_ordered: li.bottles_ordered,
          bottle_size: li.bottle_size,
        }))}
        productionBatches={order.production_batches.map(b => ({
          production_schedule_item_id: b.production_schedule_item_id,
          formula_code: b.formula_code,
          estimated_bottles: b.estimated_bottles,
        }))}
      />
    </div>
  );
}
