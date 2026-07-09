import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AppRole = 'admin' | 'rd_manager' | 'production_manager' | 'quality_manager' | 'user' | 'hr_manager';

interface RoleUpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
  action?: string;
}

export const useRoleManagement = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateUserRole = async (email: string, role: AppRole, grant: boolean = true) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('update_user_role', {
        _user_email: email,
        _role: role,
        _grant: grant
      });

      if (error) throw error;

      const result = data as unknown as RoleUpdateResponse;

      if (result?.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        return { success: true };
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return { success: false };
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user role",
        variant: "destructive",
      });
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const getUserByEmail = async (email: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_by_email_admin', {
        _email: email
      });

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  };

  return {
    updateUserRole,
    getUserByEmail,
    loading
  };
};