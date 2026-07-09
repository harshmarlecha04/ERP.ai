import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { isPoApprover } from '@/lib/poApprovers';
import { Button } from '@/components/ui/button';

export function OrderApprovalBanner({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const { hasPermission } = useUserRoles();
  const canApprove = hasPermission('admin') || isPoApprover(user?.email);

  const { data } = useQuery({
    queryKey: ['order-approval-status', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_headers')
        .select('approval_status, rejection_reason')
        .eq('id', orderId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!data) return null;

  if (data.approval_status === 'pending') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span>This PO is awaiting approval.</span>
        </div>
        {canApprove && (
          <Button size="sm" asChild>
            <Link to={`/orders/${orderId}/approve`}>Review &amp; decide</Link>
          </Button>
        )}
      </div>
    );
  }

  if (data.approval_status === 'rejected') {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
        <span className="font-medium">PO rejected.</span>{' '}
        {data.rejection_reason || 'No reason provided.'}
      </div>
    );
  }

  return null;
}
