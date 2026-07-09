import { Button } from '@/components/ui/button';
import { CalendarPlus, Download, XCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { OrderWithLines } from '@/hooks/useOrderHeaders';
import { formatET, todayET } from "@/utils/dateUtils";

interface BatchActionToolbarProps {
  selectedOrders: Set<string>;
  orders: OrderWithLines[];
  onClearSelection: () => void;
  onScheduleSelected: () => void;
}

export function BatchActionToolbar({ selectedOrders, orders, onClearSelection, onScheduleSelected }: BatchActionToolbarProps) {
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const count = selectedOrders.size;
  const selectedOrdersList = orders.filter(o => selectedOrders.has(o.id));

  const handleExport = () => {
    const headers = ['PO Number', 'Customer', 'Status', 'Products', 'Total Bottles', 'Due Date', 'Created'];
    const rows = selectedOrdersList.map(o => [
      o.po_number || o.order_number,
      o.customer_name || '',
      o.header_status || 'pending',
      o.total_line_items || 0,
      o.total_bottles_ordered || 0,
      o.due_date || '',
      o.created_at ? formatET(o.created_at, "M/d/yyyy") : '',
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-export-${todayET()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${count} orders exported` });
  };

  const handleBulkClose = async () => {
    setIsClosing(true);
    try {
      const ids = Array.from(selectedOrders);
      const { error } = await supabase
        .from('order_headers')
        .update({ header_status: 'closed' })
        .in('id', ids);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      toast({ title: `${count} orders closed` });
      onClearSelection();
    } catch (err: any) {
      toast({ title: 'Error closing orders', description: err.message, variant: 'destructive' });
    } finally {
      setIsClosing(false);
      setShowCloseDialog(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
        <span className="text-sm font-medium">{count} order{count !== 1 ? 's' : ''} selected</span>
        <div className="h-4 w-px bg-border" />
        <Button variant="outline" size="sm" onClick={onScheduleSelected}>
          <CalendarPlus className="h-4 w-4 mr-1" /> Schedule Selected
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export Selected
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowCloseDialog(true)} className="text-destructive hover:text-destructive">
          <XCircle className="h-4 w-4 mr-1" /> Close Selected
        </Button>
        <Button variant="ghost" size="sm" onClick={onClearSelection} className="ml-auto">
          Clear
        </Button>
      </div>

      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {count} orders?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {count} order{count !== 1 ? 's' : ''} as closed. This action can be undone by editing each order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkClose} disabled={isClosing}>
              {isClosing ? 'Closing...' : 'Close Orders'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
