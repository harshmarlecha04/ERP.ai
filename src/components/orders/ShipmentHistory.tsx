import { useState } from 'react';
import { format } from 'date-fns';
import { Package, Truck, Calendar, Hash, FileText, Trash2, Check, CheckCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOrderShipments } from '@/hooks/useOrderShipments';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { formatET } from "@/utils/dateUtils";

interface ShipmentHistoryProps {
  orderId: string;
  bottlesOrdered: number;
}

interface ShipmentLineData {
  id: string;
  order_line_id: string;
  qty_shipped: number;
  qty_accepted: number | null;
  acceptance_status: string;
}

export const ShipmentHistory = ({ orderId, bottlesOrdered }: ShipmentHistoryProps) => {
  const { shipments, isLoading, totalShipped, deleteShipment } = useOrderShipments(orderId, 'order');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedShipment, setExpandedShipment] = useState<string | null>(null);
  const [shipmentLines, setShipmentLines] = useState<Record<string, ShipmentLineData[]>>({});

  const loadShipmentLines = async (shipmentId: string) => {
    if (shipmentLines[shipmentId]) {
      setExpandedShipment(expandedShipment === shipmentId ? null : shipmentId);
      return;
    }

    const { data, error } = await supabase
      .from('order_shipment_lines')
      .select('*')
      .eq('shipment_id', shipmentId);

    if (!error && data) {
      setShipmentLines(prev => ({ ...prev, [shipmentId]: data as ShipmentLineData[] }));
    }
    setExpandedShipment(shipmentId);
  };

  const markAllAccepted = async (shipmentId: string) => {
    const lines = shipmentLines[shipmentId];
    if (!lines) return;

    try {
      for (const line of lines) {
        await supabase
          .from('order_shipment_lines')
          .update({
            qty_accepted: line.qty_shipped,
            acceptance_status: 'ACCEPTED',
          })
          .eq('id', line.id);

        // Update qty_accepted_total and invoiceable_qty on line item
        const { data: lineItem } = await supabase
          .from('order_line_items')
          .select('qty_accepted_total, qty_shipped_total')
          .eq('id', line.order_line_id)
          .single();

        if (lineItem) {
          const newAccepted = (lineItem.qty_accepted_total || 0) + line.qty_shipped;
          await supabase
            .from('order_line_items')
            .update({
              qty_accepted_total: newAccepted,
              invoiceable_qty: newAccepted,
            } as any)
            .eq('id', line.order_line_id);
        }
      }

      // Refresh lines
      const { data } = await supabase
        .from('order_shipment_lines')
        .select('*')
        .eq('shipment_id', shipmentId);

      if (data) {
        setShipmentLines(prev => ({ ...prev, [shipmentId]: data as ShipmentLineData[] }));
      }

      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['order-fulfillment-lines'] });
      toast({ title: 'All lines marked as accepted' });
    } catch (error: any) {
      toast({ title: 'Failed to update acceptance', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading shipments...</div>;
  }

  if (!shipments || shipments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Shipment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No shipments recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  const fulfillmentPercent = Math.round((totalShipped / bottlesOrdered) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Shipment History
          <Badge variant="outline" className="ml-auto">
            {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total Shipped:</span>
            <span className="text-lg font-bold">{totalShipped.toLocaleString()} bottles</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Remaining:</span>
            <span className="text-lg font-bold">{(bottlesOrdered - totalShipped).toLocaleString()} bottles</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Fulfillment:</span>
            <span className="text-lg font-bold">{fulfillmentPercent}%</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {shipments.map((shipment) => (
            <div key={shipment.id} className="relative pl-8 pb-4 border-l-2 border-muted last:border-0">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-background" />
              
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-lg">
                      {shipment.shipped_quantity.toLocaleString()} bottles
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatET(shipment.shipment_date, 'MMM dd, yyyy')}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadShipmentLines(shipment.id)}
                    >
                      {expandedShipment === shipment.id ? 'Hide Lines' : 'View Lines'}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Shipment</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this shipment record? This will adjust the order's fulfillment status.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteShipment.mutate(shipment.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {shipment.carrier && (
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-3 w-3 text-muted-foreground" />
                    <span>{shipment.carrier}</span>
                  </div>
                )}

                {shipment.tracking_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono">{shipment.tracking_number}</span>
                  </div>
                )}

                {shipment.notes && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <FileText className="h-3 w-3 mt-0.5" />
                    <span>{shipment.notes}</span>
                  </div>
                )}

                {/* Expanded shipment lines with acceptance */}
                {expandedShipment === shipment.id && shipmentLines[shipment.id] && (
                  <div className="mt-3 border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Line</TableHead>
                          <TableHead className="text-right">Shipped</TableHead>
                          <TableHead className="text-right">Accepted</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shipmentLines[shipment.id].map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-mono text-sm">{line.order_line_id.slice(0, 8)}</TableCell>
                            <TableCell className="text-right">{line.qty_shipped.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              {line.qty_accepted !== null ? line.qty_accepted.toLocaleString() : '—'}
                            </TableCell>
                            <TableCell>
                              {line.acceptance_status === 'ACCEPTED' ? (
                                <Badge className="bg-green-100 text-green-800 border-green-300">
                                  <Check className="h-3 w-3 mr-1" />
                                  Accepted
                                </Badge>
                              ) : (
                                <Badge variant="outline">Pending</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {shipmentLines[shipment.id].some(l => l.acceptance_status !== 'ACCEPTED') && (
                      <div className="p-2 border-t bg-muted/30">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markAllAccepted(shipment.id)}
                          className="w-full"
                        >
                          <CheckCheck className="h-4 w-4 mr-2" />
                          Mark All Accepted
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {expandedShipment === shipment.id && !shipmentLines[shipment.id] && (
                  <p className="text-xs text-muted-foreground">No shipment line details available.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
