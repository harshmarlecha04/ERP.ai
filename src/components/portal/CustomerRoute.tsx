import { Navigate, useLocation } from 'react-router-dom';
import { useCustomerStatus } from '@/hooks/useIsCustomer';
import { isCustomerPortalHost } from '@/lib/portalHost';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ONBOARDING_ALLOWED_PATHS = [
  '/portal/onboarding',
  '/portal/settings',
  '/app/onboarding',
  '/app/settings',
];

export const CustomerRoute = ({ children }: { children: React.ReactNode }) => {
  const { loading, isAuthed, isCustomer, customerId, onboardingApproved } = useCustomerStatus();
  const location = useLocation();
  const onCustomerHost = isCustomerPortalHost();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthed) {
    const to = onCustomerHost ? '/' : '/portal/auth';
    return <Navigate to={to} state={{ from: location }} replace />;
  }

  // Staff hitting a portal route — bounce immediately, no spinner.
  if (!isCustomer) {
    if (onCustomerHost) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold">Access denied</h1>
            <p className="text-muted-foreground">
              This account is not linked to a customer organization. If you are a staff
              member, please sign in on the company app instead.
            </p>
            <Button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = '/';
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      );
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Customer role but not linked to a customer row — surface clearly.
  if (!customerId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Account not fully linked</h1>
          <p className="text-muted-foreground">
            Your customer account isn't connected to an organization yet. Please contact
            your account manager so we can finish provisioning your portal access.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = onCustomerHost ? '/' : '/portal/auth';
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (
    !onboardingApproved &&
    !ONBOARDING_ALLOWED_PATHS.some((p) => location.pathname.startsWith(p))
  ) {
    const onboardingPath = onCustomerHost ? '/app/onboarding' : '/portal/onboarding';
    return <Navigate to={onboardingPath} replace />;
  }

  return <>{children}</>;
};
