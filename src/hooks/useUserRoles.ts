import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user' | 'rd_manager' | 'production_manager' | 'quality_manager' | 'hr_manager';
  department_role?: 'admin' | 'finance' | 'procurement' | 'production' | 'rd' | 'quality' | 'basic';
  granted_at: string;
  granted_by?: string;
}

// Cache for user roles to avoid repeated database calls
const userRolesCache = new Map<string, { roles: UserRole | null; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for financial access check - enforced server-side via has_financial_access()
const financialAccessCache = new Map<string, { hasAccess: boolean; timestamp: number }>();

export const useUserRoles = () => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [currentUserRoles, setCurrentUserRoles] = useState<UserRole | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasFinancialAccessState, setHasFinancialAccessState] = useState<boolean | null>(null);
  const { toast } = useToast();

  const fetchCurrentUserRoles = async (forceRefresh: boolean = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Store user email for financial access check
      setCurrentUserEmail(user.email || null);

      // Check cache first (unless force refresh) — skip the loading flicker on cache hit
      if (!forceRefresh) {
        const cached = userRolesCache.get(user.id);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          setCurrentUserRoles(cached.roles);
          setLoading(false);
          return;
        }
      } else {
        // Clear cache on force refresh
        userRolesCache.clear();
      }

      // Only flip loading when we actually need to hit the network
      setLoading(true);

      const { data, error } = await supabase.rpc('get_current_user_roles');

      if (error) {
        throw error;
      }

      let mappedRole: UserRole | null = null;
      if (data && data.length > 0) {
        const firstRole = data[0];
        mappedRole = {
          id: crypto.randomUUID(),
          user_id: firstRole.user_id,
          role: firstRole.role as UserRole['role'],
          granted_at: firstRole.granted_at,
          department_role: firstRole.role === 'admin' ? 'admin' : 'basic'
        };
      }

      const now = Date.now();
      userRolesCache.set(user.id, { roles: mappedRole, timestamp: now });

      setCurrentUserRoles(mappedRole);
    } catch (error) {
      // Error fetching current user roles - logged server-side
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (requiredRole: 'admin' | 'finance' | 'procurement' | 'production' | 'rd' | 'quality') => {
    if (!currentUserRoles) return false;
    
    // SECURITY FIX: Remove business hours exception for formula access
    // Formulas now have their own strict access controls in the database
    
    // Allow admin access to everything
    if (currentUserRoles.role === 'admin') return true;
    
    // Map specific roles to access permissions
    const roleMap: Record<string, string[]> = {
      'finance': ['admin'],
      'procurement': ['admin', 'production_manager'],
      'production': ['admin', 'production_manager'],
      'rd': ['admin', 'rd_manager'],
      'quality': ['admin', 'quality_manager']
    };
    
    const allowedRoles = roleMap[requiredRole] || [];
    return allowedRoles.includes(currentUserRoles.role);
  };

  const hasBusinessHoursAccess = () => {
    // SECURITY: Client-side check for UI only - actual enforcement is server-side via RLS
    // This is just for better UX, not for security
    const now = new Date();
    const easternTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: 'numeric',
      hour12: false
    }).formatToParts(now);
    
    const weekday = easternTime.find(part => part.type === 'weekday')?.value;
    const hour = parseInt(easternTime.find(part => part.type === 'hour')?.value || '0');
    
    const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday || '');
    const isBusinessHour = hour >= 7 && hour <= 18;
    
    // Note: Server-side validation via is_business_hours() function enforces this in RLS
    return isWeekday && isBusinessHour && currentUserRoles !== null;
  };

  const canAccessHRData = () => {
    if (!currentUserRoles) return false;
    // During business hours, all users can access HR data
    if (hasBusinessHoursAccess()) return true;
    // Outside business hours, restrict to admin and HR managers
    return currentUserRoles.role === 'admin' || 
           currentUserRoles.role === 'hr_manager';
  };

  const canAccessSuppliers = () => {
    if (!currentUserRoles) return false;
    // During business hours, all users can access supplier data
    if (hasBusinessHoursAccess()) return true;
    // Outside business hours, restrict to specific roles
    return currentUserRoles.role === 'admin' || 
           currentUserRoles.role === 'production_manager' || 
           currentUserRoles.role === 'hr_manager';
  };
  
  const canAccessCosts = () => true; // All authenticated users have access
  const canAccessProduction = () => true; // All authenticated users have access
  const canAccessFormulas = () => {
    // SECURITY NOTE: Formula access is now controlled strictly by database-level security
    // The database functions handle all access control including business hours policies
    // Frontend only checks if user is authenticated
    return currentUserRoles !== null;
  };
  const canAccessQuality = () => true; // All authenticated users have access
  
  // Check financial access from server (cached)
  const checkFinancialAccess = async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      // Check cache first
      const cached = financialAccessCache.get(user.id);
      const now = Date.now();
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        return cached.hasAccess;
      }
      
      // Call server-side function to check access using raw SQL query
      // This is a security definer function that checks the financial_access_users table
      const { data, error } = await supabase.rpc('has_financial_access' as any);
      
      if (error) {
        console.error('Error checking financial access:', error);
        return false;
      }
      
      // Cache the result
      financialAccessCache.set(user.id, { hasAccess: !!data, timestamp: now });
      setHasFinancialAccessState(!!data);
      return !!data;
    } catch (error) {
      return false;
    }
  };
  
  // Synchronous check for UI (uses cached value)
  const canAccessFinancialData = () => {
    // ADMIN BYPASS: Admin role always has full access - no server check needed
    if (currentUserRoles?.role === 'admin') {
      return true;
    }
    
    // If we have a cached state, use it
    if (hasFinancialAccessState !== null) {
      return hasFinancialAccessState;
    }
    // Trigger async check if not cached
    checkFinancialAccess();
    return false; // Default to false until check completes
  };

  const logDataAccess = async (table: string, action: string, details?: any) => {
    try {
      // Insert into user_activity_audit table (now has proper RLS policy)
      await supabase.from('user_activity_audit').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        activity_type: 'data_access',
        table_name: table,
        operation: action,
        details: details || {}
      });
    } catch (error) {
      // Audit logging failed - error logged server-side
    }
  };

  useEffect(() => {
    // Only react to events that actually change identity. TOKEN_REFRESHED and
    // INITIAL_SESSION fire frequently and do not change roles — reacting to them
    // caused a cascading re-render loop across every consumer of this hook.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        fetchCurrentUserRoles(true);
      } else if (event === 'SIGNED_OUT') {
        userRolesCache.clear();
        financialAccessCache.clear();
        setCurrentUserRoles(null);
        setHasFinancialAccessState(null);
        setLoading(false);
      }
    });

    // Initial fetch (will use cache if available)
    fetchCurrentUserRoles();

    return () => subscription.unsubscribe();
  }, []);

  return {
    userRoles,
    currentUserRoles,
    loading,
    hasPermission,
    hasBusinessHoursAccess,
    canAccessHRData,
    canAccessSuppliers,
    canAccessCosts,
    canAccessProduction,
    canAccessFormulas,
    canAccessQuality,
    canAccessFinancialData,
    logDataAccess,
    refetch: fetchCurrentUserRoles,
    forceRefresh: () => fetchCurrentUserRoles(true),
  };
};