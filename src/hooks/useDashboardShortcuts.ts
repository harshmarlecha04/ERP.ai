import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_SHORTCUTS, DashboardShortcutConfig, getShortcutConfig } from '@/config/dashboardShortcuts';
import { toast } from 'sonner';

export interface UserShortcut {
  id?: string;
  key: string;
  position: number;
  isVisible: boolean;
  config: DashboardShortcutConfig;
}

export function useDashboardShortcuts() {
  const { user } = useAuth();
  const [shortcuts, setShortcuts] = useState<UserShortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const originalShortcutsRef = useRef<UserShortcut[]>([]);

  // Load shortcuts from database
  const loadShortcuts = useCallback(async () => {
    if (!user) {
      setShortcuts([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('dashboard_shortcuts')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // User has saved shortcuts - merge with defaults to handle new shortcuts
        const savedKeys = new Set(data.map(s => s.shortcut_key));
        const merged: UserShortcut[] = [];

        // Add saved shortcuts in their order
        for (const saved of data) {
          const config = getShortcutConfig(saved.shortcut_key);
          if (config) {
            merged.push({
              id: saved.id,
              key: saved.shortcut_key,
              position: saved.position,
              isVisible: saved.is_visible,
              config,
            });
          }
        }

        // Append any new shortcuts from defaults that user doesn't have
        let maxPosition = Math.max(...merged.map(s => s.position), 0);
        for (const defaultShortcut of DEFAULT_SHORTCUTS) {
          if (!savedKeys.has(defaultShortcut.key)) {
            maxPosition++;
            merged.push({
              key: defaultShortcut.key,
              position: maxPosition,
              isVisible: true,
              config: defaultShortcut,
            });
          }
        }

        setShortcuts(merged.sort((a, b) => a.position - b.position));
      } else {
        // New user - create defaults
        const defaults = DEFAULT_SHORTCUTS.map((config, index) => ({
          key: config.key,
          position: index + 1,
          isVisible: true,
          config,
        }));
        setShortcuts(defaults);
        
        // Save defaults to database
        await saveShortcutsToDb(defaults);
      }
    } catch (error) {
      console.error('Error loading shortcuts:', error);
      toast.error('Failed to load dashboard shortcuts');
      // Fallback to defaults
      setShortcuts(DEFAULT_SHORTCUTS.map((config, index) => ({
        key: config.key,
        position: index + 1,
        isVisible: true,
        config,
      })));
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Save shortcuts to database
  const saveShortcutsToDb = async (shortcutsToSave: UserShortcut[]) => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Delete existing shortcuts for this user
      await supabase
        .from('dashboard_shortcuts')
        .delete()
        .eq('user_id', user.id);

      // Insert new shortcuts
      const { error } = await supabase
        .from('dashboard_shortcuts')
        .insert(
          shortcutsToSave.map(s => ({
            user_id: user.id,
            shortcut_key: s.key,
            position: s.position,
            is_visible: s.isVisible,
          }))
        );

      if (error) throw error;
    } catch (error) {
      console.error('Error saving shortcuts:', error);
      toast.error('Failed to save dashboard layout');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced save
  const debouncedSave = useCallback((shortcutsToSave: UserShortcut[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveShortcutsToDb(shortcutsToSave);
    }, 300);
  }, [user]);

  // Reorder shortcuts after drag
  const reorderShortcuts = useCallback((activeKey: string, overKey: string) => {
    setShortcuts(current => {
      const oldIndex = current.findIndex(s => s.key === activeKey);
      const newIndex = current.findIndex(s => s.key === overKey);
      
      if (oldIndex === -1 || newIndex === -1) return current;

      const newShortcuts = [...current];
      const [removed] = newShortcuts.splice(oldIndex, 1);
      newShortcuts.splice(newIndex, 0, removed);

      // Update positions
      const updated = newShortcuts.map((s, i) => ({ ...s, position: i + 1 }));
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  // Toggle visibility
  const toggleVisibility = useCallback((shortcutKey: string) => {
    setShortcuts(current => {
      const updated = current.map(s => 
        s.key === shortcutKey ? { ...s, isVisible: !s.isVisible } : s
      );
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    if (!user) return;

    try {
      setIsSaving(true);
      
      // Delete all user shortcuts
      await supabase
        .from('dashboard_shortcuts')
        .delete()
        .eq('user_id', user.id);

      // Create defaults
      const defaults = DEFAULT_SHORTCUTS.map((config, index) => ({
        key: config.key,
        position: index + 1,
        isVisible: true,
        config,
      }));

      await saveShortcutsToDb(defaults);
      setShortcuts(defaults);
      setIsCustomizing(false);
      toast.success('Dashboard reset to default layout');
    } catch (error) {
      console.error('Error resetting shortcuts:', error);
      toast.error('Failed to reset dashboard');
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  // Enter customize mode
  const startCustomizing = useCallback(() => {
    originalShortcutsRef.current = [...shortcuts];
    setIsCustomizing(true);
  }, [shortcuts]);

  // Cancel customization
  const cancelCustomizing = useCallback(() => {
    setShortcuts(originalShortcutsRef.current);
    setIsCustomizing(false);
  }, []);

  // Save and exit customize mode
  const saveAndExit = useCallback(async () => {
    try {
      await saveShortcutsToDb(shortcuts);
      setIsCustomizing(false);
      toast.success('Dashboard layout saved');
    } catch {
      // Error already handled in saveShortcutsToDb
    }
  }, [shortcuts]);

  // Load on mount and user change
  useEffect(() => {
    loadShortcuts();
  }, [loadShortcuts]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Get visible shortcuts (or all when customizing)
  const visibleShortcuts = isCustomizing 
    ? shortcuts 
    : shortcuts.filter(s => s.isVisible);

  return {
    shortcuts: visibleShortcuts,
    allShortcuts: shortcuts,
    loading,
    isCustomizing,
    isSaving,
    startCustomizing,
    cancelCustomizing,
    saveAndExit,
    reorderShortcuts,
    toggleVisibility,
    resetToDefaults,
  };
}
