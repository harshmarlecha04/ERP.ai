import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, CalendarDays, Tag, FolderOpen, Users, Settings, LogOut, ArrowLeftRight } from 'lucide-react';
import { useIsEmployee } from '@/hooks/useIsEmployee';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCustomer } from '@/hooks/useCurrentCustomer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { goToCustomerLogin, goToEmployeeLogin } from '@/lib/portalHost';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const navItems = [
  { to: '/portal/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
  { to: '/portal/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/portal/label-inventory', label: 'Label Inventory', icon: Tag },
  { to: '/portal/documentation', label: 'Documentation', icon: FolderOpen },
  { to: '/portal/team', label: 'Team', icon: Users },
];

export const CustomerPortalLayout = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: customer } = useCurrentCustomer();
  const { isEmployee } = useIsEmployee();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await signOut();
    goToCustomerLogin();
  };

  return (
    <div className="min-h-screen flex w-full bg-muted/30">
      <aside className="w-64 shrink-0 bg-card border-r flex flex-col">
        <div className="p-6 border-b">
          <div className="font-bold text-lg">Customer Portal</div>
          {customer && (
            <div className="text-sm text-muted-foreground mt-1 truncate">{customer.company_name}</div>
          )}
        </div>

        {isEmployee && (
          <div className="p-3 border-b">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              title="You'll be signed out of the customer portal."
              onClick={async () => {
                try {
                  await supabase.auth.signOut({ scope: 'global' });
                } catch {
                  await supabase.auth.signOut();
                }
                try { queryClient.clear(); } catch {}
                window.location.replace('/auth?fresh=1');
              }}
            >
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Login to Employee Portal
            </Button>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1">

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t space-y-1">
          <NavLink
            to="/portal/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
              )
            }
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </NavLink>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default CustomerPortalLayout;
