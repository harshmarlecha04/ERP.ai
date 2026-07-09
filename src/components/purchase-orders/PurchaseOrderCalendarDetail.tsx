import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Package, Truck, Edit, CheckCircle, Calendar, Building, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { PurchaseOrder } from "@/hooks/usePurchaseOrders";
import { Label } from "@/components/ui/label";

interface PurchaseOrderCalendarDetailProps {
  order: PurchaseOrder;
  open: boolean;
  onClose: () => void;
  onMarkAsReceived: (orderId: string) => Promise<void>;
  onEdit: (order: PurchaseOrder) => void;
  onReceiveIntoInventory: (order: PurchaseOrder) => void;
}

export function PurchaseOrderCalendarDetail({
  order,
  open,
  onClose,
  onMarkAsReceived,
  onEdit,
  onReceiveIntoInventory
}: PurchaseOrderCalendarDetailProps) {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ordered: { color: "bg-blue-100 text-blue-800", label: "Ordered" },
      received: { color: "bg-emerald-100 text-emerald-800", label: "Received" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.ordered;
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'PPP');
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:42rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Purchase Order Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold">{order.po_number}</h3>
              <p className="text-muted-foreground">{order.vendor_name}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(order.status)}
              <div className="text-sm text-muted-foreground">
                Ordered: {formatDate(order.ordered_date)}
              </div>
            </div>
          </div>

          <Separator />

          {/* Main Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-4 w-4" />
                  Order Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Ingredients</Label>
                <div className="mt-2 space-y-2">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                        <span className="font-medium">{item.ingredient_name}</span>
                        <span className="text-sm text-muted-foreground">
                          {item.quantity} {item.uom || 'kg'}
                          {order.can_view_financial_data && item.unit_cost && (
                            <span className="ml-2">@ ${item.unit_cost.toFixed(2)}/{item.uom}</span>
                          )}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No ingredients specified</p>
                  )}
                </div>
              </div>
                {order.invoice_total && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Invoice Total</label>
                    <p className="font-medium">
                      ${order.invoice_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-4 w-4" />
                  Delivery Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Expected Delivery</label>
                  <p className="font-medium">
                    {order.expected_delivery ? formatDate(order.expected_delivery) : 'Not specified'}
                  </p>
                </div>
                {order.tracking_number && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tracking Number</label>
                    <p className="font-medium">{order.tracking_number}</p>
                  </div>
                )}
                {order.terms && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Terms</label>
                    <p className="font-medium">{order.terms}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={() => {
                onEdit(order);
                onClose();
              }}
              variant="outline"
              className="flex-1"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Order
            </Button>
            
            {order.status !== 'received' && (
              <Button 
                onClick={() => {
                  onReceiveIntoInventory(order);
                  onClose();
                }}
                className="flex-1"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Receive into Inventory
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}