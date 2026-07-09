import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface DraftData {
  order_data: Record<string, any>;
  updated_at: string;
}

export function useOrderDraftAutoSave(formData: Record<string, any> | null) {
  const [existingDraft, setExistingDraft] = useState<DraftData | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { toast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Check for existing draft on mount
  useEffect(() => {
    const checkDraft = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setDraftLoaded(true); return; }

      const { data } = await supabase
        .from('order_drafts')
        .select('order_data, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setExistingDraft({
          order_data: data.order_data as Record<string, any>,
          updated_at: data.updated_at,
        });
      }
      setDraftLoaded(true);
    };
    checkDraft();
  }, []);

  // Auto-save every 30s
  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      const data = formDataRef.current;
      if (!data || !data.poNumber) return; // Don't save empty forms

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('order_drafts')
        .upsert({
          user_id: user.id,
          order_data: data as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (!error) {
        setLastSaved(new Date());
      }
    }, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const clearDraft = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('order_drafts').delete().eq('user_id', user.id);
    setExistingDraft(null);
    setLastSaved(null);
  }, []);

  const discardDraft = useCallback(async () => {
    await clearDraft();
    toast({ title: 'Draft discarded' });
  }, [clearDraft, toast]);

  const lastSavedText = lastSaved ? `Draft saved at ${format(lastSaved, 'h:mm a')}` : null;

  return {
    existingDraft,
    draftLoaded,
    lastSavedText,
    clearDraft,
    discardDraft,
  };
}
