import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface StageTrackingRecord {
  id: string;
  production_schedule_item_id: string;
  stage: string;
  entered_at: string;
  exited_at: string | null;
  stage_duration_hours: number | null;
  performed_by: string | null;
  corn_starch_used_kg: number | null;
  quality_check_passed: boolean;
  sticking_issue: boolean;
  notes: string | null;
}

export const useBatchStageTracking = (scheduleItemId: string | null) => {
  const [stageRecords, setStageRecords] = useState<StageTrackingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchStageRecords = async () => {
    if (!scheduleItemId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('batch_stage_tracking')
        .select('*')
        .eq('production_schedule_item_id', scheduleItemId)
        .order('entered_at', { ascending: true });

      if (error) throw error;
      setStageRecords(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading stage records',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const enterStage = async (stage: string, notes?: string) => {
    if (!scheduleItemId) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('batch_stage_tracking')
        .insert({
          production_schedule_item_id: scheduleItemId,
          stage,
          entered_at: new Date().toISOString(),
          performed_by: userData.user?.id,
          notes,
          quality_check_passed: true,
          sticking_issue: false,
        });

      if (error) throw error;

      toast({
        title: 'Stage started',
        description: `Batch entered ${stage} stage`,
      });

      await fetchStageRecords();
      return { success: true };
    } catch (error: any) {
      toast({
        title: 'Error starting stage',
        description: error.message,
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  const exitStage = async (
    stageId: string,
    cornStarchUsedKg?: number,
    qualityCheckPassed?: boolean,
    stickingIssue?: boolean,
    notes?: string
  ) => {
    try {
      const stageRecord = stageRecords.find(r => r.id === stageId);
      if (!stageRecord) throw new Error('Stage record not found');

      const exitedAt = new Date();
      const enteredAt = new Date(stageRecord.entered_at);
      const durationHours = (exitedAt.getTime() - enteredAt.getTime()) / (1000 * 60 * 60);

      const { error } = await supabase
        .from('batch_stage_tracking')
        .update({
          exited_at: exitedAt.toISOString(),
          stage_duration_hours: durationHours,
          corn_starch_used_kg: cornStarchUsedKg || null,
          quality_check_passed: qualityCheckPassed ?? true,
          sticking_issue: stickingIssue ?? false,
          notes: notes || stageRecord.notes,
        })
        .eq('id', stageId);

      if (error) throw error;

      toast({
        title: 'Stage completed',
        description: `${stageRecord.stage} stage completed (${durationHours.toFixed(1)}h)`,
      });

      await fetchStageRecords();
      return { success: true };
    } catch (error: any) {
      toast({
        title: 'Error completing stage',
        description: error.message,
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  useEffect(() => {
    if (scheduleItemId) {
      fetchStageRecords();

      // Subscribe to changes
      const channel = supabase
        .channel(`stage_tracking_${scheduleItemId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'batch_stage_tracking',
            filter: `production_schedule_item_id=eq.${scheduleItemId}`,
          },
          () => {
            fetchStageRecords();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [scheduleItemId]);

  return {
    stageRecords,
    loading,
    enterStage,
    exitStage,
    refetch: fetchStageRecords,
  };
};
