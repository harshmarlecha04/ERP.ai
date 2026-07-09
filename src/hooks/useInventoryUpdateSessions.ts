import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UpdateSession {
  id: string;
  session_date: string;
  created_by: string;
  created_at: string;
  item_count: number;
  total_deductions: number;
  notes?: string;
  user_email?: string;
  items?: SessionItem[];
}

export interface SessionItem {
  id: string;
  session_id: string;
  movement_id?: string;
  label_inventory_id?: string;
  item_type: 'PACKAGING' | 'LABEL';
  item_name: string;
  quantity_deducted: number;
  created_at: string;
}

export const useRecentSessions = (limit: number = 10) => {
  return useQuery({
    queryKey: ['inventory-update-sessions', limit],
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from('inventory_update_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Fetch items and user info for each session
      const sessionsWithItems = await Promise.all(
        sessions.map(async (session) => {
          const { data: items } = await supabase
            .from('inventory_update_session_items')
            .select('*')
            .eq('session_id', session.id);

          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', session.created_by)
            .single();

          return {
            ...session,
            user_email: profile?.email || 'Unknown',
            items: items || []
          };
        })
      );

      return sessionsWithItems as UpdateSession[];
    }
  });
};

export const useLastSession = () => {
  return useQuery({
    queryKey: ['last-inventory-update-session'],
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from('inventory_update_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!sessions || sessions.length === 0) return null;

      const session = sessions[0];

      // Fetch items for this session
      const { data: items } = await supabase
        .from('inventory_update_session_items')
        .select('*')
        .eq('session_id', session.id);

      // Fetch user info
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', session.created_by)
        .single();

      return {
        ...session,
        user_email: profile?.email || 'Unknown',
        items: items || []
      } as UpdateSession;
    }
  });
};

export const useCreateUpdateSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      session_date: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: session, error } = await supabase
        .from('inventory_update_sessions')
        .insert({
          session_date: data.session_date,
          created_by: user.id,
          notes: data.notes
        })
        .select()
        .single();

      if (error) throw error;
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-update-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['last-inventory-update-session'] });
    },
  });
};

export const useCreateSessionItem = () => {
  return useMutation({
    mutationFn: async (data: {
      session_id: string;
      movement_id?: string;
      label_inventory_id?: string;
      item_type: 'PACKAGING' | 'LABEL';
      item_name: string;
      quantity_deducted: number;
    }) => {
      const { data: item, error } = await supabase
        .from('inventory_update_session_items')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return item;
    },
  });
};

export const useUpdateSessionTotals = () => {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      // Get all items for this session
      const { data: items, error: itemsError } = await supabase
        .from('inventory_update_session_items')
        .select('quantity_deducted')
        .eq('session_id', sessionId);

      if (itemsError) throw itemsError;

      const itemCount = items?.length || 0;
      const totalDeductions = items?.reduce((sum, item) => sum + Number(item.quantity_deducted), 0) || 0;

      // Update session totals
      const { error: updateError } = await supabase
        .from('inventory_update_sessions')
        .update({
          item_count: itemCount,
          total_deductions: totalDeductions
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;
    },
  });
};

export const useDeleteUpdateSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      console.log("🗑️ Deleting session:", sessionId);
      
      // Deleting the session will trigger the database function
      // that automatically deletes associated packaging_movement and label_inventory records
      const { error, data } = await supabase
        .from('inventory_update_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        console.error("❌ Database error during deletion:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      console.log("✅ Delete operation completed");
      return data;
    },
    onSuccess: () => {
      console.log("✅ Invalidating queries after successful deletion");
      queryClient.invalidateQueries({ queryKey: ['inventory-update-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['last-inventory-update-session'] });
      queryClient.invalidateQueries({ queryKey: ['packaging-balances'] });
      queryClient.invalidateQueries({ queryKey: ['label-inventory'] });
    },
    onError: (error: any) => {
      console.error("❌ Mutation error:", error);
    }
  });
};
