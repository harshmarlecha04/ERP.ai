import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PouchInventoryItem {
  id: string;
  name: string;
  quantity_on_hand: number;
  unit: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const usePouchInventory = () => {
  return useQuery({
    queryKey: ['pouch-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pouch_inventory')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as PouchInventoryItem[];
    },
  });
};

export const useCreatePouch = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { name: string; quantity_on_hand?: number; notes?: string | null }) => {
      const { data, error } = await supabase
        .from('pouch_inventory')
        .insert({
          name: input.name,
          quantity_on_hand: input.quantity_on_hand ?? 0,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as PouchInventoryItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pouch-inventory'] });
      toast({ title: 'Pouch added' });
    },
    onError: (e: any) => toast({ title: 'Failed to add pouch', description: e.message, variant: 'destructive' }),
  });
};

export const useDeductPouches = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pouchId, qty }: { pouchId: string; qty: number }) => {
      const { data: cur, error: e1 } = await supabase
        .from('pouch_inventory')
        .select('quantity_on_hand')
        .eq('id', pouchId)
        .single();
      if (e1) throw e1;
      const next = Math.max(0, (cur?.quantity_on_hand ?? 0) - qty);
      const { error: e2 } = await supabase
        .from('pouch_inventory')
        .update({ quantity_on_hand: next })
        .eq('id', pouchId);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pouch-inventory'] }),
  });
};
