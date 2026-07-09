import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AuditTrailDrawer } from "@/components/audit/AuditTrailDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CheckCircle } from "lucide-react";
import { FinancialAccessDenied } from "@/components/access-control/FinancialAccessDenied";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useUserRoles } from "@/hooks/useUserRoles";

interface PurchaseOrderItem {
  id: string;
  ingredient_id?: string;
  ingredient_name: string;
  quantity: number;
  uom: string;
  unit_cost?: number | null;
  total_cost?: number | null;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_name: string;
  ordered_date: string;
  expected_delivery?: string;
  received_date?: string;
  invoice_total: number | null; // Can be null for restricted access
  status: string;
  tracking_number?: string;
  terms?: string;
  created_at: string;
  updated_at: string;
  can_view_financial_data?: boolean;
  items: PurchaseOrderItem[];
}

interface PurchaseOrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  onEdit: (order: PurchaseOrder) => void;
  onDelete: (orderId: string) => void;
  onMarkAsReceived: (orderId: string) => void;
}

export function PurchaseOrderDetailModal({
  isOpen,
  onClose,
  order,
  onEdit,
  onDelete,
  onMarkAsReceived,
}: PurchaseOrderDetailModalProps) {
  const { canAccessFinancialData } = useUserRoles();
  
  if (!order) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
      ordered: { color: "bg-blue-100 text-blue-800", label: "Ordered" },
      shipped: { color: "bg-purple-100 text-purple-800", label: "Shipped" },
      delivered: { color: "bg-green-100 text-green-800", label: "Delivered" },
      received: { color: "bg-emerald-100 text-emerald-800", label: "Received" },
      cancelled: { color: "bg-red-100 text-red-800", label: "Cancelled" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Badge className={cn("text-xs", config.color)}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:42rem]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="text-xl">Purchase Order Details</DialogTitle>
            <AuditTrailDrawer entityType="purchase_orders" entityId={order.id} />
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">PO Number</h3>
              <p className="text-lg font-medium">{order.po_number}</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Status</h3>
              {getStatusBadge(order.status)}
            </div>
          </div>

          {/* Vendor Information */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">Vendor</h3>
            <p className="text-sm">{order.vendor_name}</p>
          </div>

          {/* Items Information */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">Items</h3>
            <div className="space-y-2">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span className="font-medium text-sm">{item.ingredient_name}</span>
                    <div className="text-sm text-muted-foreground">
                      {item.quantity} {item.uom || 'kg'}
                      {canAccessFinancialData() && item.unit_cost && (
                        <span className="ml-2">@ {formatCurrency(item.unit_cost)}/{item.uom}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No items specified</p>
              )}
            </div>
          </div>

          {/* Financial and Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Invoice Total</h3>
              {canAccessFinancialData() && order.invoice_total !== null ? (
                <p className="text-sm font-medium">{formatCurrency(order.invoice_total)}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Restricted</p>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Terms</h3>
              <p className="text-sm">{order.terms || '-'}</p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Ordered Date</h3>
              <p className="text-sm">{formatDate(order.ordered_date)}</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Expected Delivery</h3>
              <p className="text-sm">{order.expected_delivery ? formatDate(order.expected_delivery) : '-'}</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Received Date</h3>
              <p className="text-sm">{order.received_date ? formatDate(order.received_date) : '-'}</p>
            </div>
          </div>

          {/* Tracking Information */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">Tracking Number</h3>
            <p className="text-sm">{order.tracking_number || '-'}</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {order.status === 'delivered' && (
              <Button
                variant="outline"
                onClick={() => onMarkAsReceived(order.id)}
                className="text-green-600 hover:text-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Received
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => onEdit(order)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => onDelete(order.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}