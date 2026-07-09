import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays } from 'date-fns';

export interface OrderMilestone {
  id: string;
  order_id: string;
  line_item_id: string | null;
  milestone_number: number;
  target_bottles: number;
  shipped_bottles: number;
  target_date: string;
  status: 'pending' | 'on_track' | 'at_risk' | 'delayed' | 'completed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMilestoneData {
  order_id: string;
  line_item_id?: string | null;
  milestone_number: number;
  target_bottles: number;
  target_date: string;
  notes?: string;
}

export const calculateMilestoneStatus = (
  targetDate: string,
  targetBottles: number,
  shippedBottles: number
): OrderMilestone['status'] => {
  const daysUntilDue = differenceInDays(new Date(targetDate), new Date());
  const progressPercent = (shippedBottles / targetBottles) * 100;

  if (progressPercent >= 100) return 'completed';
  if (daysUntilDue < 0) return 'delayed';
  if (daysUntilDue <= 3 && progressPercent < 80) return 'at_risk';
  return 'on_track';
};

export const useOrderMilestones = (orderId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch milestones for an order
  const { data: milestones = [], isLoading, error } = useQuery({
    queryKey: ['order-milestones', orderId],
    queryFn: async () => {
      if (!orderId) return [];

      const { data, error } = await supabase
        .from('order_delivery_milestones')
        .select('*')
        .eq('order_id', orderId)
        .order('milestone_number', { ascending: true });

      if (error) throw error;

      // Calculate status for each milestone
      return (data || []).map(milestone => ({
        ...milestone,
        status: calculateMilestoneStatus(
          milestone.target_date,
          milestone.target_bottles,
          milestone.shipped_bottles
        ),
      })) as OrderMilestone[];
    },
    enabled: !!orderId,
  });

  // Create milestone
  const createMilestone = useMutation({
    mutationFn: async (data: CreateMilestoneData) => {
      const status = calculateMilestoneStatus(data.target_date, data.target_bottles, 0);
      
      const { error } = await supabase
        .from('order_delivery_milestones')
        .insert({
          ...data,
          status,
          shipped_bottles: 0,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      toast({ title: 'Milestone created successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create milestone',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update milestone
  const updateMilestone = useMutation({
    mutationFn: async ({ 
      milestoneId, 
      updates 
    }: { 
      milestoneId: string; 
      updates: Partial<OrderMilestone> 
    }) => {
      // Recalculate status if relevant fields changed
      let finalUpdates = { ...updates };
      if (updates.target_date || updates.target_bottles !== undefined || updates.shipped_bottles !== undefined) {
        const milestone = milestones.find(m => m.id === milestoneId);
        if (milestone) {
          const newStatus = calculateMilestoneStatus(
            updates.target_date || milestone.target_date,
            updates.target_bottles ?? milestone.target_bottles,
            updates.shipped_bottles ?? milestone.shipped_bottles
          );
          finalUpdates.status = newStatus;
        }
      }

      const { error } = await supabase
        .from('order_delivery_milestones')
        .update(finalUpdates)
        .eq('id', milestoneId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      toast({ title: 'Milestone updated successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update milestone',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete milestone
  const deleteMilestone = useMutation({
    mutationFn: async (milestoneId: string) => {
      const { error } = await supabase
        .from('order_delivery_milestones')
        .delete()
        .eq('id', milestoneId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      toast({ title: 'Milestone deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete milestone',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Apply shipment to milestones (auto-assign)
  const applyShipmentToMilestones = useMutation({
    mutationFn: async ({ 
      orderId, 
      quantity 
    }: { 
      orderId: string; 
      quantity: number 
    }) => {
      // Get all incomplete milestones
      const incompleteMilestones = milestones
        .filter(m => m.shipped_bottles < m.target_bottles)
        .sort((a, b) => a.milestone_number - b.milestone_number);

      let remainingQuantity = quantity;

      for (const milestone of incompleteMilestones) {
        if (remainingQuantity <= 0) break;

        const neededForMilestone = milestone.target_bottles - milestone.shipped_bottles;
        const toApply = Math.min(remainingQuantity, neededForMilestone);

        const newShippedBottles = milestone.shipped_bottles + toApply;
        const newStatus = calculateMilestoneStatus(
          milestone.target_date,
          milestone.target_bottles,
          newShippedBottles
        );

        await supabase
          .from('order_delivery_milestones')
          .update({
            shipped_bottles: newShippedBottles,
            status: newStatus,
          })
          .eq('id', milestone.id);

        remainingQuantity -= toApply;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-milestones'] });
    },
  });

  const nextMilestone = milestones.find(m => m.status !== 'completed' && m.status !== 'delayed');
  const atRiskCount = milestones.filter(m => m.status === 'at_risk').length;

  return {
    milestones,
    isLoading,
    error,
    nextMilestone,
    atRiskCount,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    applyShipmentToMilestones,
  };
};
