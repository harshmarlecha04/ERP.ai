'use client';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRoles } from './useUserRoles';
import type { RawMaterial, RawMaterialForm } from '@/types/inventory';

const LIST_KEY = (filters?: Record<string, unknown>) =>
  ['raw-materials-optimized', JSON.stringify(filters ?? {})] as const;

async function fetchMaterials(filters?: { isArchived?: boolean }): Promise<RawMaterial[]> {
  let query = supabase
    .from('raw_materials')
    .select('*')
    .eq('is_archived', filters?.isArchived || false)
    .order('code', { ascending: true });

  const { data: materials, error: mErr } = await query;

  if (mErr) throw mErr;

  const { data: lots, error: lErr } = await supabase
    .from('raw_material_lots')
    .select('*')
    .order('lot_number');

  if (lErr) throw lErr;

  // Compose materials with their lots
  const byId = new Map<string, RawMaterial>();
  (materials ?? []).forEach((m: any) =>
    byId.set(m.id, { ...m, lots: [] })
  );

  (lots ?? []).forEach((l: any) => {
    const rm = byId.get(l.raw_material_id);
    if (rm) rm.lots.push(l);
  });

  return Array.from(byId.values());
}

export function useRawMaterialsOptimized(filters?: { isArchived?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { canAccessCosts } = useUserRoles();

  const query = useQuery({
    queryKey: LIST_KEY(filters),
    queryFn: () => fetchMaterials(filters),
    staleTime: 15_000,
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Optimized realtime subscription with debouncing and self-originated event filtering
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    const lastSavedIds = new Set<string>();

    const debouncedInvalidate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: LIST_KEY(filters) });
      }, 300); // 300ms debounce to batch rapid changes
    };

    const handleRealtimeEvent = (payload: any) => {
      const rowId = payload.new?.id || payload.old?.id;
      
      // Skip invalidation if this is our own recently saved record
      if (rowId && lastSavedIds.has(rowId)) {
        lastSavedIds.delete(rowId); // Clean up after use
        return;
      }
      
      debouncedInvalidate();
    };

    const channel = supabase
      .channel('rm-realtime-optimized')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raw_materials' }, handleRealtimeEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raw_material_lots' }, handleRealtimeEvent)
      .subscribe();

    // Store reference to track our own saves
    (window as any).__rmLastSavedIds = lastSavedIds;

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
      delete (window as any).__rmLastSavedIds;
    };
  }, [qc, filters]);

  // Atomic upsert with optimistic updates
  const upsertMaterial = useMutation({
    mutationFn: async (payload: RawMaterialForm): Promise<RawMaterial> => {
      // Transform form data ensuring proper types
      const materialPayload = {
        id: payload.id || null,
        code: payload.code.trim(),
        name: payload.name.trim(),
        uom: payload.uom.trim(),
        supplier: payload.supplier?.trim() || null,
        lots: payload.lots.map(lot => ({
          id: lot.id || null,
          lot_number: lot.lot_number?.trim() || null,
          quantity: typeof lot.quantity === 'number' ? lot.quantity : Number(lot.quantity) || 0,
          cost: typeof lot.cost === 'number' ? lot.cost : Number(lot.cost) || 0,
          receiving_date: lot.receiving_date?.trim() || null,
          expires_on: lot.expires_on?.trim() || null,
        }))
      };

      console.log('Material payload being sent:', materialPayload);
      console.log('Update mode:', !!payload.id);

      const { data, error } = await supabase.rpc(
        'upsert_raw_material_with_lots',
        { p_material: materialPayload }
      );
      
      console.log('RPC Response:', { data, error });
      
      if (error) {
        console.error('RPC Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(error.message || 'Failed to save material');
      }
      
      // Check for structured error response
      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        const errorMsg = typeof data.message === 'string' ? data.message : 'Failed to save material';
        throw new Error(errorMsg);
      }
      
      if (!data) throw new Error('No data returned from save operation');
      
      return data as RawMaterial;
    },
    // Optimistic update - UI updates immediately
    onMutate: async (payload) => {
      const key = LIST_KEY(filters);
      const prev = qc.getQueryData<RawMaterial[]>(key);
      await qc.cancelQueries({ queryKey: key });

      // Generate valid UUID for temporary IDs (only for UI optimistic updates)
      const tempMaterialId = payload.id || crypto.randomUUID();
      
      // Create optimistic material object
      const optimisticMaterial: RawMaterial = {
        id: tempMaterialId,
        code: payload.code,
        name: payload.name,
        uom: payload.uom,
        unit_of_measure: payload.uom,
        supplier: payload.supplier || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        lots: payload.lots.map((lot, index) => ({
          id: lot.id || crypto.randomUUID(),
          raw_material_id: tempMaterialId,
          lot_number: lot.lot_number || null,
          quantity: Number(lot.quantity) || 0,
          cost: canAccessCosts() ? Number(lot.cost) || 0 : 0,
          receiving_date: lot.receiving_date || null,
          expires_on: lot.expires_on || null,
          coa_link: lot.coa_link || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      };

      const next = (() => {
        const list = prev ? [...prev] : [];
        const idx = list.findIndex((x) => 
          x.code.toLowerCase() === payload.code.toLowerCase() || x.id === payload.id
        );
        
        if (idx >= 0) {
          // Update existing
          list[idx] = optimisticMaterial;
        } else {
          // Add new
          list.unshift(optimisticMaterial);
        }
        return list;
      })();

      qc.setQueryData(key, next);
      return { prev };
    },
    // Rollback on error
    onError: (err, _payload, ctx) => {
      console.error('Material upsert error:', err);
      console.error('Error details:', {
        message: err.message,
        payload: _payload,
        error: err
      });
      
      if (ctx?.prev) qc.setQueryData(LIST_KEY(filters), ctx.prev);
      
      // Show specific database error instead of generic message
      const errorMessage = err.message.includes('already exists') || err.message.includes('duplicate key')
        ? `Material code "${_payload.code}" already exists. Please use a different code.`
        : err.message || "Unknown error occurred";
      
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
    // Replace with server result on success (no refetch needed)
    onSuccess: (data) => {
      const key = LIST_KEY(filters);
      
      // Track this save to prevent realtime duplicate
      const lastSavedIds = (window as any).__rmLastSavedIds as Set<string>;
      if (lastSavedIds) {
        lastSavedIds.add(data.id);
        // Auto-cleanup after 2 seconds
        setTimeout(() => lastSavedIds.delete(data.id), 2000);
      }

      // Update cache with authoritative server response
      qc.setQueryData<RawMaterial[]>(key, (curr) => {
        if (!curr) return [data];
        const idx = curr.findIndex((x) => 
          x.id === data.id || x.code.toLowerCase() === data.code.toLowerCase()
        );
        if (idx >= 0) {
          const clone = [...curr];
          clone[idx] = data;
          return clone;
        }
        return [data, ...curr];
      });

      toast({
        title: "Success",
        description: "Material saved successfully",
      });
    },
  });

  // Archive material mutation
  const archiveMaterial = useMutation({
    mutationFn: async (materialId: string) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('raw_materials')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.user?.id
        })
        .eq('id', materialId);
      
      if (error) throw error;
      return materialId;
    },
    onMutate: async (materialId) => {
      const key = LIST_KEY(filters);
      const prev = qc.getQueryData<RawMaterial[]>(key);
      await qc.cancelQueries({ queryKey: key });

      qc.setQueryData<RawMaterial[]>(key, (curr) => 
        curr?.filter(m => m.id !== materialId) ?? []
      );

      return { prev };
    },
    onError: (err, _materialId, ctx) => {
      console.error('Material archive error:', err);
      if (ctx?.prev) qc.setQueryData(LIST_KEY(filters), ctx.prev);
      
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to archive material",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Invalidate both active and archived queries for immediate update
      qc.invalidateQueries({ queryKey: LIST_KEY({ isArchived: false }) }); // Active materials
      qc.invalidateQueries({ queryKey: LIST_KEY({ isArchived: true }) });  // Archived materials
      qc.invalidateQueries({ queryKey: ['raw-material-usage-stats'] });
      
      toast({
        title: "Success",
        description: "Material archived successfully",
      });
    },
  });

  // Restore material mutation
  const restoreMaterial = useMutation({
    mutationFn: async (materialId: string) => {
      const { error } = await supabase
        .from('raw_materials')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null
        })
        .eq('id', materialId);
      
      if (error) throw error;
      return materialId;
    },
    onMutate: async (materialId) => {
      const key = LIST_KEY(filters);
      const prev = qc.getQueryData<RawMaterial[]>(key);
      await qc.cancelQueries({ queryKey: key });

      qc.setQueryData<RawMaterial[]>(key, (curr) => 
        curr?.filter(m => m.id !== materialId) ?? []
      );

      return { prev };
    },
    onError: (err, _materialId, ctx) => {
      console.error('Material restore error:', err);
      if (ctx?.prev) qc.setQueryData(LIST_KEY(filters), ctx.prev);
      
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to restore material",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Invalidate both active and archived queries for immediate update
      qc.invalidateQueries({ queryKey: LIST_KEY({ isArchived: false }) }); // Active materials
      qc.invalidateQueries({ queryKey: LIST_KEY({ isArchived: true }) });  // Archived materials
      qc.invalidateQueries({ queryKey: ['raw-material-usage-stats'] });
      
      toast({
        title: "Success",
        description: "Material restored successfully",
      });
    },
  });

  // Delete mutation (permanent delete)
  const deleteMaterial = useMutation({
    mutationFn: async (materialId: string) => {
      const { error } = await supabase
        .from('raw_materials')
        .delete()
        .eq('id', materialId);
      
      if (error) throw error;
      return materialId;
    },
    onMutate: async (materialId) => {
      const key = LIST_KEY(filters);
      const prev = qc.getQueryData<RawMaterial[]>(key);
      await qc.cancelQueries({ queryKey: key });

      qc.setQueryData<RawMaterial[]>(key, (curr) => 
        curr?.filter(m => m.id !== materialId) ?? []
      );

      return { prev };
    },
    onError: (err, _materialId, ctx) => {
      console.error('Material delete error:', err);
      if (ctx?.prev) qc.setQueryData(LIST_KEY(filters), ctx.prev);
      
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete material",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Invalidate both active and archived queries for immediate update
      qc.invalidateQueries({ queryKey: LIST_KEY({ isArchived: false }) }); // Active materials
      qc.invalidateQueries({ queryKey: LIST_KEY({ isArchived: true }) });  // Archived materials
      qc.invalidateQueries({ queryKey: ['raw-material-usage-stats'] });
      
      toast({
        title: "Success",
        description: "Material deleted successfully",
      });
    },
  });

  // Bulk archive materials mutation
  const bulkArchiveMaterial = useMutation({
    mutationFn: async (materialIds: string[]) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('raw_materials')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.user?.id
        })
        .in('id', materialIds);
      
      if (error) throw error;
      return materialIds;
    },
    onMutate: async (materialIds) => {
      const key = LIST_KEY(filters);
      const prev = qc.getQueryData<RawMaterial[]>(key);
      await qc.cancelQueries({ queryKey: key });

      qc.setQueryData<RawMaterial[]>(key, (curr) => 
        curr?.filter(m => !materialIds.includes(m.id)) ?? []
      );

      return { prev };
    },
    onError: (err, _materialIds, ctx) => {
      console.error('Bulk material archive error:', err);
      if (ctx?.prev) qc.setQueryData(LIST_KEY(filters), ctx.prev);
      
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to archive materials",
        variant: "destructive",
      });
    },
    onSuccess: (materialIds) => {
      // Invalidate both active and archived queries for immediate update
      qc.invalidateQueries({ queryKey: LIST_KEY({ isArchived: false }) }); // Active materials
      qc.invalidateQueries({ queryKey: LIST_KEY({ isArchived: true }) });  // Archived materials
      qc.invalidateQueries({ queryKey: ['raw-material-usage-stats'] });
      
      toast({
        title: "Success",
        description: `${materialIds.length} materials archived successfully`,
      });
    },
  });

  // Bulk delete mutation (permanent delete)
  const bulkDeleteMaterial = useMutation({
    mutationFn: async (materialIds: string[]) => {
      const { error } = await supabase
        .from('raw_materials')
        .delete()
        .in('id', materialIds);
      
      if (error) throw error;
      return materialIds;
    },
    onMutate: async (materialIds) => {
      const key = LIST_KEY(filters);
      const prev = qc.getQueryData<RawMaterial[]>(key);
      await qc.cancelQueries({ queryKey: key });

      qc.setQueryData<RawMaterial[]>(key, (curr) => 
        curr?.filter(m => !materialIds.includes(m.id)) ?? []
      );

      return { prev };
    },
    onError: (err, _materialIds, ctx) => {
      console.error('Bulk material delete error:', err);
      if (ctx?.prev) qc.setQueryData(LIST_KEY(filters), ctx.prev);
      
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete materials",
        variant: "destructive",
      });
    },
    onSuccess: (materialIds) => {
      // Invalidate both active and archived queries for immediate update
      qc.invalidateQueries({ queryKey: LIST_KEY({ isArchived: false }) }); // Active materials
      qc.invalidateQueries({ queryKey: LIST_KEY({ isArchived: true }) });  // Archived materials
      qc.invalidateQueries({ queryKey: ['raw-material-usage-stats'] });
      
      toast({
        title: "Success",
        description: `${materialIds.length} materials deleted successfully`,
      });
    },
  });

  return {
    materials: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    upsertMaterial,
    archiveMaterial,
    bulkArchiveMaterial,
    restoreMaterial,
    deleteMaterial,
    bulkDeleteMaterial,
  };
}