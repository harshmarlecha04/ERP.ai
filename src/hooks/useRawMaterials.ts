import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRoles } from './useUserRoles';

export interface RawMaterialLot {
  id: string;
  raw_material_id: string;
  lot_number: string | null;
  quantity: number;
  cost: number;
  receiving_date?: string;
  expiry_date?: string;
  coa_link?: string;
  created_at: string;
  updated_at: string;
}

export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  supplier: string | null;
  unit_of_measure: string;
  lots: RawMaterialLot[];
  created_at: string;
  updated_at: string;
}

export function useRawMaterials() {
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedRows, setHighlightedRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { canAccessCosts, logDataAccess } = useUserRoles();
  const realtimeChannelRef = useRef<any>(null);

  // Helper function to highlight a row temporarily
  const highlightRow = useCallback((materialId: string) => {
    setHighlightedRows(prev => new Set(prev).add(materialId));
    setTimeout(() => {
      setHighlightedRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(materialId);
        return newSet;
      });
    }, 3000); // Highlight for 3 seconds
  }, []);

  // Scroll row into view
  const scrollToRow = useCallback((materialId: string) => {
    setTimeout(() => {
      const rowElement = document.querySelector(`[data-material-id="${materialId}"]`);
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, []);

  // Fetch raw materials with their lots
  const fetchRawMaterials = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      // Check if user is authenticated first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Auth error:', authError);
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        console.error('No user found');
        throw new Error('Please log in to access raw materials');
      }
      
      await logDataAccess('raw_materials', 'view');
      
      const { data: materialsData, error: materialsError } = await supabase
        .from('raw_materials')
        .select('*')
        .order('updated_at', { ascending: false });

      if (materialsError) {
        console.error('Materials fetch error:', materialsError);
        throw new Error(`Failed to load raw materials: ${materialsError.message}`);
      }

      // Get lots data, filtering cost information if user doesn't have access
      const { data: lotsData, error: lotsError } = await supabase
        .from('raw_material_lots')
        .select('*')
        .order('created_at', { ascending: false });

      if (lotsError) {
        console.error('Lots fetch error:', lotsError);
        throw new Error(`Failed to load material lots: ${lotsError.message}`);
      }

      // Group lots by raw material and filter cost data if needed
      const materialsWithLots = materialsData.map(material => ({
        ...material,
        unit_of_measure: material.uom || (material as any).unit_of_measure || 'kg',
        lots: lotsData.filter(lot => lot.raw_material_id === material.id).map(lot => ({
          ...lot,
          expiry_date: lot.expires_on || (lot as any).expiry_date || null,
          receiving_date: lot.receiving_date || null,
          cost: canAccessCosts() ? lot.cost : 0 // Hide cost if user doesn't have access
        }))
      }));

      setRawMaterials(materialsWithLots);
      return materialsWithLots;
    } catch (error) {
      console.error('Error fetching raw materials:', error);
      if (!silent) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load raw materials';
        toast({
          title: "Error Loading Materials",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [logDataAccess]); // Add logDataAccess as dependency

  // Create new raw material with optimistic updates, idempotency, and fast timeout
  const createRawMaterial = async (
    material: {
      code: string;
      name: string;
      supplier: string | null;
      unit_of_measure: string;
      lots: {
        lot_number: string | null;
        quantity: number;
        cost: number;
        receiving_date?: string | null;
        expiry_date?: string | null;
        coa_link?: string | null;
      }[];
    },
    idempotencyKey?: string
  ) => {
    // Generate idempotency key if not provided (for retry support)
    const finalIdempotencyKey = idempotencyKey || crypto.randomUUID();
    
    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();
    
    // Create optimistic material object
    const optimisticMaterial: RawMaterial = {
      id: tempId,
      code: material.code,
      name: material.name,
      supplier: material.supplier,
      unit_of_measure: material.unit_of_measure,
      created_at: now,
      updated_at: now,
      lots: material.lots.map((lot, index) => ({
        id: `temp-lot-${Date.now()}-${index}`,
        raw_material_id: tempId,
        lot_number: lot.lot_number,
        quantity: lot.quantity,
        cost: canAccessCosts() ? lot.cost : 0,
        receiving_date: lot.receiving_date || '',
        expiry_date: lot.expiry_date || '',
        coa_link: lot.coa_link || '',
        created_at: now,
        updated_at: now,
      }))
    };

    // Optimistic update - add to state immediately
    setRawMaterials(prev => [optimisticMaterial, ...prev]);

    // Immediately highlight and scroll to the optimistic item
    highlightRow(tempId);
    scrollToRow(tempId);

    // Set up abortable request
    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout;

    try {
      // Reduced timeout to 8 seconds for better UX
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort();
          reject(new Error('TIMEOUT'));
        }, 8000);
      });

      // Use optimized RPC function with idempotency
      const rpcPromise = supabase.rpc('create_raw_material_with_lots_v2', {
        p_code: material.code,
        p_name: material.name,
        p_supplier: material.supplier,
        p_unit_of_measure: material.unit_of_measure,
        p_lots: material.lots.map(lot => ({
          lot_number: lot.lot_number,
          quantity: lot.quantity,
          cost: lot.cost,
          receiving_date: lot.receiving_date,
          expiry_date: lot.expiry_date,
          coa_link: lot.coa_link,
        })),
        p_idempotency_key: finalIdempotencyKey
      });

      const { data: result, error: rpcError } = await Promise.race([rpcPromise, timeoutPromise]) as any;

      // Clear timeout
      clearTimeout(timeoutId);

      if (rpcError) {
        console.error('RPC error:', rpcError);
        throw new Error(`DATABASE_ERROR: ${rpcError.message}`);
      }

      if (!result || !result.success) {
        if (result?.error === 'DUPLICATE_CODE') {
          throw new Error(`DUPLICATE_CODE: ${result.message}`);
        }
        throw new Error(`DATABASE_ERROR: ${result?.message || 'Failed to create raw material'}`);
      }

      // Extract material and lots from RPC result
      const materialData = result.material;
      const lotsData = result.lots || [];

      // Create real material object with actual IDs
      const realMaterial: RawMaterial = {
        ...materialData,
        lots: lotsData.map(lot => ({
          ...lot,
          cost: canAccessCosts() ? lot.cost : 0
        }))
      };

      // Replace optimistic item with real data immediately
      setRawMaterials(prev => prev.map(m => 
        m.id === tempId ? realMaterial : m
      ));

      // Re-highlight with the real ID
      highlightRow(materialData.id);
      scrollToRow(materialData.id);

      toast({
        title: "Success",
        description: `Raw material "${material.name}" created successfully`,
      });

      return { material: realMaterial, idempotencyKey: finalIdempotencyKey };
    } catch (error) {
      console.error('Error creating raw material:', error);
      
      // Clear timeout if still running
      if (timeoutId) clearTimeout(timeoutId);
      
      // Revert optimistic update on error
      setRawMaterials(prev => prev.filter(m => m.id !== tempId));
      
      // Map errors to user-friendly messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let userMessage = '';
      let shouldRetry = false;

      if (errorMessage.includes('TIMEOUT')) {
        userMessage = "Save didn't finish. Check connection and try again.";
        shouldRetry = true;
      } else if (errorMessage.includes('DUPLICATE_CODE')) {
        userMessage = errorMessage.replace('DUPLICATE_CODE: ', '');
      } else if (errorMessage.includes('DATABASE_ERROR')) {
        userMessage = "Database error occurred. Please try again.";
        shouldRetry = true;
      } else {
        userMessage = "Failed to create raw material. Please try again.";
        shouldRetry = true;
      }

      toast({
        title: "Creation Failed",
        description: userMessage,
        variant: "destructive",
      });

      // Throw error with retry info
      const enhancedError = new Error(userMessage);
      (enhancedError as any).shouldRetry = shouldRetry;
      (enhancedError as any).idempotencyKey = finalIdempotencyKey;
      throw enhancedError;
    }
  };

  // Update raw material with optimistic updates
  const updateRawMaterial = async (
    materialId: string,
    updates: {
      code?: string;
      name?: string;
      supplier?: string | null;
      unit_of_measure?: string;
      lots?: {
        id?: string;
        lot_number: string | null;
        quantity: number;
        cost: number;
        receiving_date?: string | null;
        expiry_date?: string | null;
        coa_link?: string | null;
      }[];
    }
  ) => {
    // Store the original material for rollback
    const originalMaterial = rawMaterials.find(m => m.id === materialId);
    if (!originalMaterial) {
      throw new Error('Material not found');
    }

    // Create optimistic updated material
    const optimisticMaterial: RawMaterial = {
      ...originalMaterial,
      ...updates,
      updated_at: new Date().toISOString(),
      lots: updates.lots ? updates.lots.map((lot, index) => ({
        id: lot.id || `temp-lot-${Date.now()}-${index}`,
        raw_material_id: materialId,
        lot_number: lot.lot_number,
        quantity: lot.quantity,
        cost: lot.cost,
        receiving_date: lot.receiving_date || '',
        expiry_date: lot.expiry_date || '',
        coa_link: lot.coa_link || '',
        created_at: originalMaterial.lots[index]?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })) : originalMaterial.lots
    };

    // Optimistic update - update state immediately
    setRawMaterials(prev => prev.map(m => 
      m.id === materialId ? optimisticMaterial : m
    ));

    try {
      console.log('updateRawMaterial called with:', { materialId, updates });
      
      // Prepare update data, only including defined fields
      const updateData: Record<string, any> = {};
      if (updates.code !== undefined) updateData.code = updates.code;
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.supplier !== undefined) updateData.supplier = updates.supplier;
      if (updates.unit_of_measure !== undefined) updateData.uom = updates.unit_of_measure;

      console.log('Updating raw material with data:', updateData);

      // Update raw material
      const { error: materialError } = await supabase
        .from('raw_materials')
        .update(updateData as any)
        .eq('id', materialId);

      if (materialError) {
        console.error('Error updating material:', materialError);
        throw materialError;
      }

      // Handle lots updates if provided
      if (updates.lots !== undefined) {
        console.log('Updating lots:', updates.lots);
        
        // Delete existing lots
        const { error: deleteError } = await supabase
          .from('raw_material_lots')
          .delete()
          .eq('raw_material_id', materialId);

        if (deleteError) {
          console.error('Error deleting existing lots:', deleteError);
          throw deleteError;
        }

        // Insert new lots
        if (updates.lots.length > 0) {
          const lotsToInsert = updates.lots.map(lot => ({
            raw_material_id: materialId,
            lot_number: lot.lot_number,
            quantity: lot.quantity,
            cost: lot.cost,
            receiving_date: lot.receiving_date,
            expires_on: lot.expiry_date,
            coa_link: lot.coa_link,
          }));

          console.log('Inserting new lots:', lotsToInsert);

          const { error: lotsError } = await supabase
            .from('raw_material_lots')
            .insert(lotsToInsert);

          if (lotsError) {
            console.error('Error inserting new lots:', lotsError);
            throw lotsError;
          }
        }
      }

      console.log('Material update completed successfully');
      
      // Don't refetch - real-time updates will handle the sync
      // The optimistic update is already in place
      
      // Highlight and scroll to the updated item
      highlightRow(materialId);
      scrollToRow(materialId);
      
      toast({
        title: "Success",
        description: "Raw material updated successfully",
      });
    } catch (error) {
      console.error('Error updating raw material:', error);
      
      // Revert optimistic update on error
      setRawMaterials(prev => prev.map(m => 
        m.id === materialId ? originalMaterial : m
      ));
      
      toast({
        title: "Error",
        description: `Failed to update raw material: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Delete raw material with optimistic updates and fast timeout
  const deleteRawMaterial = async (materialId: string) => {
    // Store the original material for rollback
    const originalMaterial = rawMaterials.find(m => m.id === materialId);
    if (!originalMaterial) {
      throw new Error('Material not found');
    }

    // Optimistic update - remove from state immediately
    setRawMaterials(prev => prev.filter(m => m.id !== materialId));

    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout;

    try {
      // Reduced timeout to 8 seconds for better UX
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort();
          reject(new Error('TIMEOUT'));
        }, 8000);
      });

      const deletePromise = supabase
        .from('raw_materials')
        .delete()
        .eq('id', materialId);

      const { error } = await Promise.race([deletePromise, timeoutPromise]) as any;

      // Clear timeout
      clearTimeout(timeoutId);

      if (error) {
        console.error('Delete error:', error);
        throw new Error(`DATABASE_ERROR: ${error.message}`);
      }

      toast({
        title: "Success",
        description: "Raw material deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting raw material:', error);
      
      // Clear timeout if still running
      if (timeoutId) clearTimeout(timeoutId);
      
      // Revert optimistic update on error
      setRawMaterials(prev => [...prev, originalMaterial].sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ));
      
      // Map errors to user-friendly messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let userMessage = '';

      if (errorMessage.includes('TIMEOUT')) {
        userMessage = "Delete didn't finish. Check connection and try again.";
      } else if (errorMessage.includes('DATABASE_ERROR')) {
        userMessage = "Database error occurred. Please try again.";
      } else {
        userMessage = "Failed to delete raw material. Please try again.";
      }

      toast({
        title: "Delete Failed",
        description: userMessage,
        variant: "destructive",
      });
      throw error;
    }
  };


  // Set up real-time subscriptions with authentication check
  useEffect(() => {
    console.log('🔄 useRawMaterials: Effect triggered');
    
    // Only fetch if we have a user session
    const checkAndFetch = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('✅ useRawMaterials: User found, fetching...');
          await fetchRawMaterials();
        } else {
          console.log('❌ useRawMaterials: No user, skipping fetch');
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ useRawMaterials: Error in checkAndFetch:', error);
        setLoading(false);
      }
    };

    checkAndFetch();

    let debounceTimer: NodeJS.Timeout;
    const debouncedUpdate = (callback: () => void) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(callback, 100); // Reduced to 100ms for better responsiveness
    };

    // Subscribe to raw materials changes
    const materialsChannel = supabase
      .channel('raw-materials-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'raw_materials'
        },
        (payload) => {
          console.log('Real-time material change:', payload);
          
          debouncedUpdate(() => {
            if (payload.eventType === 'INSERT') {
              setRawMaterials(prev => {
                // Improved deduplication - check if real item already exists by ID
                const realExists = prev.some(m => m.id === payload.new.id);
                if (realExists) return prev;
                
                // Check if this is a replacement for an optimistic update by code and ID pattern
                const optimisticIndex = prev.findIndex(m => 
                  m.id.startsWith('temp-') && 
                  m.code === payload.new.code
                );
                
                // If we have an optimistic item for this, replace it
                if (optimisticIndex >= 0) {
                  const newMaterial: RawMaterial = {
                    ...payload.new as any,
                    lots: prev[optimisticIndex].lots // Preserve optimistic lots temporarily
                  };
                  return prev.map((m, index) => index === optimisticIndex ? newMaterial : m);
                }
                
                // Otherwise, this is a new item from another user, add only if not duplicate
                const duplicateExists = prev.some(m => m.code === payload.new.code);
                if (!duplicateExists) {
                  const newMaterial: RawMaterial = {
                    ...payload.new as any,
                    lots: []
                  };
                  return [newMaterial, ...prev];
                }
                
                return prev;
              });
            } else if (payload.eventType === 'UPDATE') {
              setRawMaterials(prev => prev.map(m => 
                m.id === payload.new.id 
                  ? { ...m, ...payload.new as any }
                  : m
              ));
            } else if (payload.eventType === 'DELETE') {
              // Prevent deleted items from being re-added by real-time
              setRawMaterials(prev => prev.filter(m => m.id !== payload.old.id));
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'raw_material_lots'
        },
        (payload) => {
          console.log('Real-time lot change:', payload);
          
          debouncedUpdate(() => {
            if (payload.eventType === 'INSERT') {
              setRawMaterials(prev => prev.map(material => {
                if (material.id === payload.new.raw_material_id) {
                  // Check if lot already exists to avoid duplicates
                  const lotExists = material.lots.some(lot => lot.id === payload.new.id);
                  if (lotExists) return material;
                  
                  return {
                    ...material,
                    lots: [...material.lots, {
                      ...payload.new,
                      cost: canAccessCosts() ? payload.new.cost : 0
                    } as RawMaterialLot]
                  };
                }
                return material;
              }));
            } else if (payload.eventType === 'UPDATE') {
              setRawMaterials(prev => prev.map(material => ({
                ...material,
                lots: material.lots.map(lot => 
                  lot.id === payload.new.id 
                    ? { ...lot, ...payload.new, cost: canAccessCosts() ? payload.new.cost : 0 }
                    : lot
                )
              })));
            } else if (payload.eventType === 'DELETE') {
              setRawMaterials(prev => prev.map(material => ({
                ...material,
                lots: material.lots.filter(lot => lot.id !== payload.old.id)
              })));
            }
          });
        }
      )
      .subscribe();

    realtimeChannelRef.current = materialsChannel;

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        fetchRawMaterials();
      } else if (event === 'SIGNED_OUT') {
        setRawMaterials([]);
        setLoading(false);
        // Clean up real-time subscriptions on sign out
        if (realtimeChannelRef.current) {
          supabase.removeChannel(realtimeChannelRef.current);
          realtimeChannelRef.current = null;
        }
      }
    });

    // Cleanup function
    return () => {
      clearTimeout(debounceTimer);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      subscription.unsubscribe();
    };
  }, []); // Remove canAccessCosts dependency to prevent infinite loops

  return {
    rawMaterials,
    loading,
    highlightedRows,
    createRawMaterial,
    updateRawMaterial,
    deleteRawMaterial,
    refetch: fetchRawMaterials,
    highlightRow,
    scrollToRow,
  };
}