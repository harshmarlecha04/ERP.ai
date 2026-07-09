import { useCurrentCustomer } from '@/hooks/useCurrentCustomer';
import { useCustomerOnboarding } from '@/hooks/useCustomerOnboarding';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ClipboardList, Package, MessageSquare } from 'lucide-react';
import { OnboardingTour, PORTAL_TOUR_STEPS } from '@/components/onboarding/OnboardingTour';

const PortalHome = () => {
  const { data: customer } = useCurrentCustomer();
  const { data: onboarding } = useCustomerOnboarding();
  const { data: orders } = useCustomerOrders();

  const activeOrders = (orders || []).filter((o: any) => !['closed', 'completed', 'cancelled'].includes((o.status || '').toLowerCase())).length;

  return (
    <div className="space-y-6">
      <OnboardingTour storageKey="pharmvista:tour:portal" version="2026-05-24" steps={PORTAL_TOUR_STEPS} />
      <div>
        <h1 className="text-3xl font-bold">Welcome{customer ? `, ${customer.company_name}` : ''}</h1>
        <p className="text-muted-foreground mt-1">Here's a quick overview of your account.</p>
      </div>

      {onboarding?.status !== 'approved' && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5" />
              {onboarding?.status === 'pending_review' ? 'Onboarding submitted — awaiting review' : 'Complete your onboarding'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {onboarding?.status === 'pending_review'
                ? 'Our team is reviewing your submitted information. You will be notified once approved.'
                : 'Finish the onboarding wizard to unlock the full portal experience.'}
            </p>
            {onboarding?.status !== 'pending_review' && (
              <Button asChild>
                <Link to="/portal/onboarding">Continue onboarding</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" /> Active orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeOrders}</div>
            <Button variant="link" asChild className="px-0"><Link to="/portal/orders">View orders</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">—</div>
            <Button variant="link" asChild className="px-0"><Link to="/portal/messages">Open messages</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{orders?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PortalHome;
