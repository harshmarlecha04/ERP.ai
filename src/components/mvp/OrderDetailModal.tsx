import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2, ExternalLink, Pencil, Trash2, Plus, CheckCircle, FileText, ChevronRight } from 'lucide-react';
import { POPDFViewerModal } from '@/components/orders/POPDFViewerModal';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { EditLineItemModal } from '@/components/orders/EditLineItemModal';
import { AddProductToOrderModal } from '@/components/orders/AddProductToOrderModal';
import { useOrderLineItems, OrderLineItem } from '@/hooks/useOrderLineItems';
import { useFormulas } from '@/hooks/useFormulas';
import { LineItemMaterialStatus } from '@/components/orders/LineItemMaterialStatus';
import { LineItemCanMake } from '@/components/orders/LineItemCanMake';
import { EditOrderModal } from './EditOrderModal';
import { CloseOrderDialog } from './CloseOrderDialog';
import { useOrderEmailEvents } from '@/hooks/useOrderEmailEvents';
import { Mail, CalendarPlus } from 'lucide-react';
import { ScheduleNewBatchModal } from '@/components/production/ScheduleNewBatchModal';
import { formatET } from "@/utils/dateUtils";

interface OrderDetailModalProps {
  orderId: string | null;
  onClose: () => void;
}

interface OrderDetail {
  id: string;
  order_number: string;
  po_number: string;
  header_status: string;
  due_date: string | null;
  priority: string;
  notes: string | null;
  created_at: string;
  customer_id: string;
  pdf_url: string | null;
  received_via: string | null;
  received_from_email: string | null;
  received_date: string | null;
  customer: {
    company_name: string;
  };
  line_items: Array<{
    id: string;
    line_number: string;
    bottles_ordered: number;
    bottles_shipped: number;
    bottles_remaining: number;
    bottle_size: number;
    production_status: string;
    scheduled_production_date: string | null;
    selected_bottle_id?: string | null;
    selected_cap_id?: string | null;
    selected_label_id?: string | null;
    price_per_unit: number | null;
    line_total: number | null;
    formula: {
      id: string;
      code: string;
      name: string;
      gummies_per_batch?: number;
      default_batch_size_kg?: number;
    };
  }>;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export function OrderDetailModal({ orderId, onClose }: OrderDetailModalProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { data: emailEvents } = useOrderEmailEvents(orderId || '');
  const [editingLineItem, setEditingLineItem] = useState<OrderLineItem | null>(null);
  const [deletingLineItemId, setDeletingLineItemId] = useState<string | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isClosingOrder, setIsClosingOrder] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [schedulingItem, setSchedulingItem] = useState<OrderDetail['line_items'][number] | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { deleteLineItem } = useOrderLineItems();
  const { formulas } = useFormulas();

  const fetchOrderDetails = async () => {
    if (!orderId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_headers')
        .select(`
          *,
          customer:customers!customer_id(company_name),
          line_items:order_line_items(*)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      
      const orderWithFormulas = {
        ...data,
        line_items: data.line_items.map((item: any) => {
          const formula = formulas.find(f => f.id === item.formula_id);
          return {
            ...item,
            formula: formula ? {
              id: formula.id,
              code: formula.code,
              name: formula.name,
              gummies_per_batch: formula.gummies_per_batch || 1000,
              default_batch_size_kg: formula.default_batch_size_kg
            } : null
          };
        })
      };
      
      setOrder(orderWithFormulas as OrderDetail);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId, formulas]);

  // Hide scroll hint when scrolled
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
      setShowScrollHint(!atEnd);
    };
    el.addEventListener('scroll', handleScroll);
    // Check on mount
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [order]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'shipped':
        return 'default';
      case 'in_production':
      case 'scheduled':
        return 'secondary';
      case 'pending':
        return 'outline';
      default:
        return 'outline';
    }
  };


  if (!orderId) return null;

  return (
    <Dialog open={!!orderId} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:min(96rem,98vw)] w-[98vw] max-h-[95vh] overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : order ? (
          <>
            <DialogHeader>
              <DialogDescription className="sr-only">
                Order details and line items
              </DialogDescription>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl">
                    PO #{order.po_number}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusBadgeVariant(order.header_status)}>
                    {order.header_status || 'Pending'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingOrder(true)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Order
                  </Button>
                  {order.header_status !== 'closed' && order.header_status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsClosingOrder(true)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Close PO
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Full Details
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Order Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">PO Number</p>
                      <p className="font-medium">{order.po_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Customer</p>
                      <p className="font-medium">{order.customer.company_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Due Date</p>
                      <p className="font-medium">
                        {order.due_date ? formatET(order.due_date, 'MMM dd, yyyy') : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Priority</p>
                      <p className="font-medium capitalize">{order.priority || 'Normal'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {formatET(order.created_at, 'MMM dd, yyyy')}
                      </p>
                    </div>
                    {order.received_via && (
                      <div>
                        <p className="text-sm text-muted-foreground">Received Via</p>
                        <p className="font-medium capitalize">{order.received_via.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                    {order.received_from_email && (
                      <div>
                        <p className="text-sm text-muted-foreground">Received From</p>
                        <p className="font-medium">{order.received_from_email}</p>
                      </div>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Bottles Ordered</p>
                      <p className="font-semibold text-lg">
                        {order.line_items.reduce((sum, item) => sum + item.bottles_ordered, 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Bottles Shipped</p>
                      <p className="font-semibold text-lg">
                        {order.line_items.reduce((sum, item) => sum + item.bottles_shipped, 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total PO Cost</p>
                      <p className="font-semibold text-lg">
                        {formatCurrency(order.line_items.reduce((sum, item) => sum + (item.line_total ?? (item.price_per_unit ?? 0) * item.bottles_ordered), 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Remaining Value</p>
                      <p className="font-semibold text-lg">
                        {formatCurrency(order.line_items.reduce((sum, item) => {
                          const lineTotal = item.line_total ?? (item.price_per_unit ?? 0) * item.bottles_ordered;
                          return sum + lineTotal * (item.bottles_remaining / Math.max(item.bottles_ordered, 1));
                        }, 0))}
                      </p>
                    </div>
                  </div>

                  {/* Fulfillment Progress */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Fulfillment Progress</p>
                      <p className="text-sm font-medium">
                        {order.line_items.reduce((sum, item) => sum + item.bottles_shipped, 0).toLocaleString()} / {' '}
                        {order.line_items.reduce((sum, item) => sum + item.bottles_ordered, 0).toLocaleString()} bottles
                      </p>
                    </div>
                    <Progress 
                      value={
                        (order.line_items.reduce((sum, item) => sum + item.bottles_shipped, 0) /
                        order.line_items.reduce((sum, item) => sum + item.bottles_ordered, 0)) * 100
                      }
                      className="h-2"
                    />
                  </div>

                  {order.notes && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground">Notes</p>
                      <p className="text-sm mt-1">{order.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-lg">Products ({order.line_items.length})</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPdfModal(true)}
                      className={order.pdf_url ? "text-green-600 border-green-600 hover:text-green-700 hover:border-green-700" : ""}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {order.pdf_url ? "View PO PDF" : "Upload PO PDF"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddingProduct(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative rounded-md border">
                    <div ref={scrollRef} className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {/* Priority columns first */}
                            <TableHead>Formula</TableHead>
                            <TableHead className="text-right">Ordered</TableHead>
                            <TableHead className="text-right">Remaining</TableHead>
                            <TableHead>Status</TableHead>
                            {/* Secondary columns */}
                            {!isMobile && (
                              <>
                                <TableHead>Materials</TableHead>
                                <TableHead>Bottle Size</TableHead>
                                <TableHead className="text-right">No. of Batches</TableHead>
                                <TableHead className="text-right">Can Make</TableHead>
                                <TableHead className="text-right">Shipped</TableHead>
                                <TableHead>Scheduled</TableHead>
                                <TableHead className="text-right">Price / Unit</TableHead>
                                <TableHead className="text-right">Total Value</TableHead>
                              </>
                            )}
                            {/* Sticky actions */}
                            <TableHead className="text-right sticky right-0 bg-background shadow-[-4px_0_6px_-4px_hsl(var(--border))]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.line_items.map((item) => {
                            const progress = (item.bottles_shipped / item.bottles_ordered) * 100;
                            
                            return (
                              <TableRow key={item.id}>
                                {/* Priority columns */}
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{item.formula?.code || 'N/A'}</p>
                                    <p className="text-sm text-muted-foreground">{item.formula?.name || 'Formula not found'}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{item.bottles_ordered.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{item.bottles_remaining.toLocaleString()}</TableCell>
                                <TableCell>
                                  <Badge variant={getStatusBadgeVariant(item.production_status)}>
                                    {item.production_status || 'pending'}
                                  </Badge>
                                </TableCell>
                                {/* Secondary columns — hidden on mobile */}
                                {!isMobile && (
                                  <>
                                    <TableCell>
                                      <LineItemMaterialStatus 
                                        lineItem={{
                                          id: item.id,
                                          formula_id: item.formula?.id || '',
                                          bottles_ordered: item.bottles_ordered,
                                          bottle_size: item.bottle_size,
                                          selected_bottle_id: item.selected_bottle_id,
                                          selected_cap_id: item.selected_cap_id,
                                          selected_label_id: item.selected_label_id,
                                          formula: item.formula
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>{item.bottle_size} ct</TableCell>
                                    <TableCell className="text-right font-medium">
                                      {Math.ceil((item.bottle_size * item.bottles_ordered) / 43000)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <LineItemCanMake 
                                        lineItem={{
                                          id: item.id,
                                          formula_id: item.formula?.id || '',
                                          bottles_ordered: item.bottles_ordered,
                                          bottle_size: item.bottle_size,
                                          selected_bottle_id: item.selected_bottle_id,
                                          selected_cap_id: item.selected_cap_id,
                                          selected_label_id: item.selected_label_id,
                                          formula: item.formula
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span className={cn(
                                        item.bottles_shipped > 0 ? 'text-success font-medium' : ''
                                      )}>
                                        {item.bottles_shipped.toLocaleString()}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant={item.scheduled_production_date ? 'outline' : 'secondary'}
                                        size="sm"
                                        className="h-8 gap-1.5"
                                        onClick={() => setSchedulingItem(item)}
                                      >
                                        <CalendarPlus className="h-3.5 w-3.5" />
                                        {item.scheduled_production_date
                                          ? formatET(item.scheduled_production_date, 'MMM dd, yyyy')
                                          : 'Schedule'}
                                      </Button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {item.price_per_unit != null ? formatCurrency(item.price_per_unit) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {formatCurrency(item.line_total ?? (item.price_per_unit != null ? item.price_per_unit * item.bottles_ordered : null))}
                                    </TableCell>
                                  </>
                                )}
                                {/* Sticky actions column */}
                                <TableCell className="text-right sticky right-0 bg-background shadow-[-4px_0_6px_-4px_hsl(var(--border))]">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingLineItem({
                                        id: item.id,
                                        order_id: order.id,
                                        line_number: item.line_number,
                                        formula_id: item.formula?.id || '',
                                        formula_name: item.formula?.name,
                                        formula_code: item.formula?.code,
                                        bottle_size: item.bottle_size as 60 | 70 | 90 | 120,
                                        bottles_ordered: item.bottles_ordered,
                                        bottles_shipped: item.bottles_shipped,
                                        bottles_remaining: item.bottles_remaining,
                                        production_status: item.production_status,
                                        scheduled_production_date: item.scheduled_production_date,
                                        suggested_start_date: null,
                                        notes: null,
                                        created_at: '',
                                        updated_at: '',
                                        order_type: 'production'
                                      })}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeletingLineItemId(item.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {/* Totals row */}
                          <TableRow className="border-t-2 font-semibold bg-muted/50">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">
                              {order.line_items.reduce((sum, item) => sum + item.bottles_ordered, 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {order.line_items.reduce((sum, item) => sum + item.bottles_remaining, 0).toLocaleString()}
                            </TableCell>
                            <TableCell>—</TableCell>
                            {!isMobile && (
                              <>
                                <TableCell />
                                <TableCell />
                                <TableCell className="text-right">
                                  {order.line_items.reduce((sum, item) => sum + Math.ceil((item.bottle_size * item.bottles_ordered) / 43000), 0).toLocaleString()}
                                </TableCell>
                                <TableCell />
                                <TableCell className="text-right">
                                  {order.line_items.reduce((sum, item) => sum + item.bottles_shipped, 0).toLocaleString()}
                                </TableCell>
                                <TableCell />
                                <TableCell />
                                <TableCell className="text-right">
                                  {formatCurrency(order.line_items.reduce((sum, item) => sum + (item.line_total ?? (item.price_per_unit ?? 0) * item.bottles_ordered), 0))}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="text-right sticky right-0 bg-muted/50 shadow-[-4px_0_6px_-4px_hsl(var(--border))]">
                              {formatCurrency(order.line_items.reduce((sum, item) => sum + (item.line_total ?? (item.price_per_unit ?? 0) * item.bottles_ordered), 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    {/* Scroll hint */}
                    {showScrollHint && !isMobile && order.line_items.length > 0 && (
                      <div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none bg-gradient-to-l from-background/80 to-transparent">
                        <ChevronRight className="h-4 w-4 text-muted-foreground animate-pulse" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Email Notifications */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Notifications
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) {
                          alert('You must be logged in to send a test email.');
                          return;
                        }
                        const res = await supabase.functions.invoke('send-order-email', {
                          body: { order_id: orderId, event_type: 'PO_CREATED' },
                        });
                        alert(JSON.stringify(res.data || res.error, null, 2));
                      } catch (err: any) {
                        alert('Error: ' + err.message);
                      }
                    }}
                  >
                    Send Test Email
                  </Button>
                </CardHeader>
                <CardContent>
                  {emailEvents && emailEvents.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Event</TableHead>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Sent At</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {emailEvents.map((evt) => (
                            <TableRow key={evt.id}>
                              <TableCell className="font-medium">{evt.event_type.replace(/_/g, ' ')}</TableCell>
                              <TableCell>{evt.recipient_email}</TableCell>
                              <TableCell>{evt.sent_at ? formatET(evt.sent_at, 'MMM dd, yyyy HH:mm') : '—'}</TableCell>
                              <TableCell>
                                <Badge variant={evt.status === 'sent' ? 'default' : evt.status === 'skipped' ? 'secondary' : 'destructive'}>
                                  {evt.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{evt.error_message || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No email notifications sent yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Order not found</p>
          </div>
        )}

        {/* Edit Line Item Modal */}
        <EditLineItemModal
          open={!!editingLineItem}
          onOpenChange={(open) => {
            if (!open) setEditingLineItem(null);
          }}
          lineItem={editingLineItem}
          onSuccess={fetchOrderDetails}
        />

        {/* Add Product Modal */}
        {order && (
          <AddProductToOrderModal
            open={isAddingProduct}
            onOpenChange={setIsAddingProduct}
            orderId={order.id}
            nextLineNumber={String(
              Math.max(...order.line_items.map(l => parseInt(l.line_number))) + 1
            ).padStart(3, '0')}
            onSuccess={fetchOrderDetails}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingLineItemId} onOpenChange={(open) => !open && setDeletingLineItemId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Product Line?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this product line from the order. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (deletingLineItemId) {
                    await deleteLineItem.mutateAsync(deletingLineItemId);
                    setDeletingLineItemId(null);
                    fetchOrderDetails();
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Order Modal */}
        {order && (
          <EditOrderModal
            open={isEditingOrder}
            onOpenChange={setIsEditingOrder}
            order={{
              id: order.id,
              po_number: order.po_number,
              due_date: order.due_date,
              priority: order.priority,
              notes: order.notes,
              customer_id: order.customer_id,
            }}
            onSuccess={fetchOrderDetails}
          />
        )}

        {/* Close Order Dialog */}
        {order && (
          <CloseOrderDialog
            open={isClosingOrder}
            onOpenChange={setIsClosingOrder}
            order={{
              id: order.id,
              po_number: order.po_number,
              total_bottles_ordered: order.line_items.reduce((sum, item) => sum + item.bottles_ordered, 0),
              total_bottles_shipped: order.line_items.reduce((sum, item) => sum + item.bottles_shipped, 0),
            }}
            onSuccess={() => {
              fetchOrderDetails();
              setIsClosingOrder(false);
            }}
          />
        )}

        {/* PO PDF Viewer Modal */}
        {order && (
          <POPDFViewerModal
            isOpen={showPdfModal}
            onClose={() => setShowPdfModal(false)}
            orderId={order.id}
            poNumber={order.po_number}
            pdfUrl={order.pdf_url}
            onPdfChange={fetchOrderDetails}
          />
        )}

        {/* Inline Schedule Production Modal */}
        {schedulingItem && (
          <ScheduleNewBatchModal
            open={!!schedulingItem}
            onOpenChange={(open) => { if (!open) setSchedulingItem(null); }}
            orderId={schedulingItem.id}
            duplicateData={schedulingItem.formula?.id ? {
              formula_id: schedulingItem.formula.id,
              formula_code: schedulingItem.formula.code,
              formula_name: schedulingItem.formula.name,
              batches: Math.max(1, Math.ceil((schedulingItem.bottle_size * schedulingItem.bottles_remaining) / 43000)),
              default_batch_size_kg: schedulingItem.formula.default_batch_size_kg || 0,
              bottle_size: schedulingItem.bottle_size,
              gummies_per_batch: schedulingItem.formula.gummies_per_batch || 43000,
            } : null}
            onSuccess={() => {
              fetchOrderDetails();
              setSchedulingItem(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
