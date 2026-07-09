import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface SavedView<TConfig = Record<string, unknown>> {
  id: string;
  page_key: string;
  name: string;
  config: TConfig;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Hook for DB-backed per-user saved table views.
 * `pageKey` is a stable identifier per list page (e.g. "orders", "purchase-orders").
 */
export function useSavedViews<TConfig = Record<string, unknown>>(pageKey: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [views, setViews] = useState<SavedView<TConfig>[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const fetchViews = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("user_table_views")
      .select("*")
      .eq("user_id", user.id)
      .eq("page_key", pageKey)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    setLoading(false);
    if (error) {
      console.error("Failed to load saved views", error);
      return;
    }
    const list = (data ?? []) as unknown as SavedView<TConfig>[];
    setViews(list);
    // Auto-select default on first load
    if (activeViewId === null) {
      const def = list.find((v) => v.is_default);
      if (def) setActiveViewId(def.id);
    }
  }, [user?.id, pageKey, activeViewId]);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  const activeView = views.find((v) => v.id === activeViewId) ?? null;

  const saveView = async (name: string, config: TConfig, makeDefault = false): Promise<SavedView<TConfig> | null> => {
    if (!user?.id) return null;
    if (makeDefault) {
      // Clear existing default first
      await supabase
        .from("user_table_views")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("page_key", pageKey)
        .eq("is_default", true);
    }
    const { data, error } = await supabase
      .from("user_table_views")
      .insert({
        user_id: user.id,
        page_key: pageKey,
        name,
        config: config as any,
        is_default: makeDefault,
      })
      .select()
      .single();
    if (error) {
      toast({ variant: "destructive", title: "Couldn't save view", description: error.message });
      return null;
    }
    toast({ title: "View saved", description: name });
    await fetchViews();
    return data as unknown as SavedView<TConfig>;
  };

  const deleteView = async (id: string) => {
    const { error } = await supabase.from("user_table_views").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Couldn't delete", description: error.message });
      return;
    }
    if (activeViewId === id) setActiveViewId(null);
    await fetchViews();
  };

  const setDefaultView = async (id: string) => {
    if (!user?.id) return;
    await supabase
      .from("user_table_views")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("page_key", pageKey)
      .eq("is_default", true);
    const { error } = await supabase
      .from("user_table_views")
      .update({ is_default: true })
      .eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Couldn't set default", description: error.message });
      return;
    }
    await fetchViews();
  };

  return {
    views,
    activeView,
    activeViewId,
    setActiveViewId,
    loading,
    saveView,
    deleteView,
    setDefaultView,
    refetch: fetchViews,
  };
}
