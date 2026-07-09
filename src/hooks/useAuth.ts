import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useUserRoles } from './useUserRoles';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { currentUserRoles, hasPermission, canAccessHRData, canAccessSuppliers, canAccessCosts, canAccessProduction, canAccessFormulas, canAccessQuality, forceRefresh, loading: rolesLoading } = useUserRoles();

  // Note: useUserRoles already performs an initial fetch and listens for SIGNED_IN
  // / SIGNED_OUT / USER_UPDATED. We intentionally do NOT call forceRefresh() on
  // every mount — that caused a re-render cascade across all useAuth consumers.

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error };

    // Server-side belt: only @pharmvista.com may use the employee portal.
    // Customers (non-pharmvista) must sign in at /portal/auth.
    try {
      const signedInEmail = data.user?.email?.toLowerCase() ?? '';
      const isPharmvista = signedInEmail.endsWith('@pharmvista.com');
      const onEmployeeRoute =
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/portal');

      if (!isPharmvista && onEmployeeRoute) {
        await supabase.auth.signOut();
        return {
          error: {
            name: 'AuthApiError',
            message:
              'This account is not authorized for the employee portal. Please use the Customer Portal login.',
          } as any,
        };
      }
    } catch {
      // fall through
    }
    return { error: null as any };
  };

  const signUp = async (email: string, password: string, fullName?: string, jobTitle?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          display_name: fullName,
          job_title: jobTitle,
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    session,
    loading,
    rolesLoading,
    signIn,
    signUp,
    signOut,
    userRoles: currentUserRoles,
    hasPermission,
    canAccessHRData,
    canAccessSuppliers,
    canAccessCosts,
    canAccessProduction,
    canAccessFormulas,
    canAccessQuality,
  };
};