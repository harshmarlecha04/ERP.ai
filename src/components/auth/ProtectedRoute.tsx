import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerStatus } from '@/hooks/useIsCustomer';
import { useIsEmployee } from '@/hooks/useIsEmployee';
import { Loader2 } from 'lucide-react';
import { getCustomerPortalOrigin, isCustomerPortalHost } from '@/lib/portalHost';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { loading: statusLoading, isCustomer } = useCustomerStatus();
  const { loading: employeeLoading, isEmployee } = useIsEmployee();
  const location = useLocation();

  // Only block on the auth bootstrap itself. Once we know there's a user,
  // we can defer the role-resolution flicker — worst case the user briefly
  // sees their authorized page before being redirected.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const mustChange = Boolean((user.user_metadata as any)?.must_change_password);
  if (mustChange && location.pathname !== '/auth') {
    return <Navigate to="/auth?force-change=true" replace />;
  }

  // Customers never see company UI. Wait for the role check before deciding
  // so we don't render dashboard contents for a customer for a frame.
  if (statusLoading || employeeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (isCustomer && !isEmployee && !location.pathname.startsWith('/portal')) {
    // Customer-only users belong on the customer portal host.
    if (!isCustomerPortalHost()) {
      window.location.replace(`${getCustomerPortalOrigin()}/`);
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
};
