import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Package, Truck, Edit, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PurchaseOrder } from "@/hooks/usePurchaseOrders";
import { formatET } from "@/utils/dateUtils";

interface DayPurchaseOrdersModalProps {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  orders: PurchaseOrder[];
  onMarkAsReceived: (orderId: string) => Promise<void>;
  onEdit: (order: PurchaseOrder) => void;
  onReceiveIntoInventory: (order: PurchaseOrder) => void;
  onOrderClick: (order: PurchaseOrder) => void;
}

export function DayPurchaseOrdersModal({
  open,
  onClose,
  date,
  orders,
  onMarkAsReceived,
  onEdit,
  onReceiveIntoInventory,
  onOrderClick
}: DayPurchaseOrdersModalProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ordered':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Ordered</Badge>;
      case 'received':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Received</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!date) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Purchase Orders - {format(date, 'MMMM d, yyyy')}
            <Badge variant="outline" className="ml-2">
              {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onOrderClick(order)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{order.po_number}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Vendor:</span>
                        <div className="font-medium">{order.vendor_name}</div>
                      </div>
                      
                      <div>
                        <span className="text-muted-foreground">Ingredients:</span>
                        <div className="space-y-1 mt-1">
                          {order.items && order.items.length > 0 ? (
                            order.items.map((item, index) => (
                              <div key={index} className="font-medium text-sm">
                                {item.ingredient_name}: {item.quantity} {item.uom || 'kg'}
                              </div>
                            ))
                          ) : (
                            <div className="font-medium text-sm">No ingredients</div>
                          )}
                        </div>
                      </div>
                      
                      {order.invoice_total && order.can_view_financial_data && (
                        <div>
                          <span className="text-muted-foreground">Invoice Total:</span>
                          <div className="font-medium">${order.invoice_total}</div>
                        </div>
                      )}
                      
                      <div>
                        <span className="text-muted-foreground">Ordered:</span>
                        <div className="font-medium">
                          {order.ordered_date ? formatET(order.ordered_date, 'MMM d, yyyy') : 'N/A'}
                        </div>
                      </div>

                      {order.terms && (
                        <div>
                          <span className="text-muted-foreground">Terms:</span>
                          <div className="font-medium">{order.terms}</div>
                        </div>
                      )}

                      {order.tracking_number && (
                        <div>
                          <span className="text-muted-foreground">Tracking:</span>
                          <div className="font-medium">{order.tracking_number}</div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(order);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    
                    {order.status !== 'received' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReceiveIntoInventory(order);
                        }}
                      >
                        <ArrowDown className="h-4 w-4 mr-2" />
                        Receive
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}