import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Formula {
  id: string;
  code: string;
  name: string;
  product_code_line?: string;
  default_batch_size_kg: number;
  average_piece_weight?: number;
  total_pieces?: number;
  gummies_per_batch?: number;
  procedure_text?: string;
  active_ingredients_json: any;
  recipe_json: any;
  version?: string;
  yield_uom?: string;
  notes?: string;
  status?: string;
  security_level?: string;
  classification_level?: string;
  requires_session?: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  customer_id: string | null;
}

export interface FormulaInput {
  productCode: string;
  lineNumber: string;
  productNameFlavor: string;
  batchSize: number;
  averagePieceWeight: number;
  totalPieces: number;
  activeIngredients: any[];
  ingredients: any[];
  procedureText: string;
  customerId?: string | null;
}

export const useFormulas = () => {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchFormulas = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 fetchFormulas: Starting...');
      
      // Check if user is authenticated first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('❌ fetchFormulas: Auth error:', authError);
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!user) {
        console.error('❌ fetchFormulas: No user found');
        throw new Error('Please log in to access formulas');
      }
      
      console.log('✅ fetchFormulas: User authenticated, fetching accessible formulas...');
      
      // Use the secure function to get accessible formulas only
      const { data, error: fetchError } = await supabase.rpc('get_accessible_formulas');

      if (fetchError) {
        console.error('❌ fetchFormulas: Database error:', fetchError);
        
        // Enhanced security error handling
        let securityErrorMessage = 'Access denied to formula data';
        if (fetchError.message?.includes('permission') || fetchError.message?.includes('policy')) {
          securityErrorMessage = 'You do not have permission to access formulas. Contact your administrator.';
        } else if (fetchError.message?.includes('business hours')) {
          securityErrorMessage = 'Access to confidential formulas is restricted outside business hours (Mon-Fri, 6 AM - 10 PM).';
        } else if (fetchError.message?.includes('trade secret')) {
          securityErrorMessage = 'Trade secret formulas require special approval. Please request access from an administrator.';
        } else if (fetchError.message?.includes('session')) {
          securityErrorMessage = 'Your access session has expired. Please request access again.';
        }
        
        throw new Error(securityErrorMessage);
      }

      console.log('✅ fetchFormulas: Success! Found', data?.length, 'accessible formulas');
      
      // Log security access for audit
      if (data && data.length > 0) {
        const tradeSecretCount = data.filter(f => f.security_level === 'trade_secret' || f.classification_level === 'trade_secret').length;
        const confidentialCount = data.filter(f => f.security_level === 'confidential' || f.classification_level === 'confidential').length;
        
        console.log(`🔒 Security Audit: User ${user.id} accessed ${data.length} formulas (${tradeSecretCount} trade secret, ${confidentialCount} confidential)`);
      }

      // Filter for active and draft formulas and preserve existing data
      const filteredFormulas = (data || [])
        .filter((item: any) => ['active', 'draft'].includes(item.status))
        .map((item: any) => ({
          ...item,
          // Only provide defaults for fields that are actually missing
          default_batch_size_kg: item.default_batch_size_kg || 0,
          is_deleted: item.is_deleted || false,
          product_code_line: item.product_code_line || '',
          average_piece_weight: item.average_piece_weight || 0,
          total_pieces: item.total_pieces || 0,
          procedure_text: item.procedure_text || '',
          // Preserve existing ingredient data, only default if null/undefined
          active_ingredients_json: item.active_ingredients_json || [],
          recipe_json: item.recipe_json || [],
          yield_uom: item.yield_uom || 'kg',
          notes: item.notes || ''
        }));

      setFormulas(filteredFormulas);
    } catch (err) {
      console.error('❌ fetchFormulas: Error occurred:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch formulas';
      setError(errorMessage);
      toast({
        title: "Error",
        description: "Failed to load accessible formulas: " + errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveFormula = async (formulaInput: FormulaInput, editingId?: string, status: string = 'active') => {
    try {
      console.log('saveFormula called with:', { formulaInput, editingId, status });
      
      // Transform the input to match database structure
      const formulaData = {
        code: formulaInput.productCode,
        name: formulaInput.productNameFlavor,
        product_code_line: formulaInput.lineNumber,
        default_batch_size_kg: formulaInput.batchSize,
        average_piece_weight: formulaInput.averagePieceWeight,
        total_pieces: formulaInput.totalPieces,
        procedure_text: formulaInput.procedureText,
        active_ingredients_json: formulaInput.activeIngredients,
        recipe_json: formulaInput.ingredients.map((ingredient, index) => {
          console.log('🔄 saveFormula: Processing ingredient for save:', ingredient);
          const weightKg =
            ingredient.weightKg !== undefined && ingredient.weightKg !== null
              ? Number(ingredient.weightKg)
              : ingredient.weightG !== undefined && ingredient.weightG !== null
              ? Number(ingredient.weightG) / 1000
              : 0;
          const weightG =
            ingredient.weightG !== undefined && ingredient.weightG !== null
              ? Number(ingredient.weightG)
              : weightKg * 1000;
          const savedIngredient = {
            name: ingredient.name || '',
            materialName: ingredient.materialName || ingredient.name || '',
            supplier: ingredient.vendor || '',
            lotNumber: ingredient.lotNumber || '',
            weightKg,
            weightG,
            qty_per_batch_kg: weightKg,
            order: index,
            weightUnit: ingredient.weightUnit || 'g',
          };
          console.log('🔄 saveFormula: Mapped ingredient for DB:', savedIngredient);
          return savedIngredient;
        }),
        version: '1.0',
        yield_uom: 'kg',
        status: status,
        is_deleted: false,
        customer_id: formulaInput.customerId === '__none__' ? null : (formulaInput.customerId || null),
      };

      console.log('Transformed formulaData (with customer_id):', formulaData);

      // Use the save_formula RPC function
      const { data, error } = await supabase
        .rpc('save_formula', {
          p_formula_data: formulaData,
          p_formula_id: editingId || null
        });

      if (error) {
        console.error('❌ Save formula RPC error:', error);
        toast({
          title: "Save Failed",
          description: error.message || "Failed to save formula to database",
          variant: "destructive",
        });
        throw error;
      }
      
      // Type assertion for the response
      const response = data as { success: boolean; error?: string; formula_id?: string } | null;
      
      if (response && !response.success) {
        throw new Error(response.error || 'Failed to save formula');
      }

      console.log('Save successful via RPC:', response);
      
      // Refresh the formulas list
      await fetchFormulas();
      
      toast({
        title: "Success",
        description: editingId ? "Formula updated successfully" : 
                    status === 'draft' ? "Formula draft saved successfully" : "Formula created successfully",
      });
      
      return data;
    } catch (err) {
      console.error('Error saving formula:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save formula';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  };

  const deleteFormula = async (id: string) => {
    try {
      console.log('🗑️ deleteFormula: Starting delete for formula ID:', id);
      
      // Use the secure RPC function to delete
      const { data, error } = await supabase.rpc('delete_formula_secure', {
        p_formula_id: id
      });

      if (error) {
        console.error('❌ deleteFormula: RPC error:', error);
        throw error;
      }
      
      // Type assertion for the response
      const response = data as { success: boolean; error?: string; message?: string } | null;
      
      if (response && !response.success) {
        throw new Error(response.error || 'Failed to delete formula');
      }

      console.log('✅ deleteFormula: Formula deleted via RPC');

      toast({
        title: "Success",
        description: response?.message || "Formula deleted successfully",
      });

      // Refresh the formulas list
      console.log('🔄 deleteFormula: Refreshing formulas list...');
      await fetchFormulas();
      console.log('✅ deleteFormula: Complete');
    } catch (err) {
      console.error('❌ deleteFormula: Error occurred:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete formula';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Transform database formula to match the component interface
  const transformFormulaForEdit = (formula: Formula) => {
    console.log('🔄 transformFormulaForEdit called with:', formula);
    console.log('🔄 Raw recipe_json:', formula.recipe_json);
    
    const transformed = {
      id: formula.id,
      productCode: formula.code,
      lineNumber: formula.product_code_line || '',
      productNameFlavor: formula.name,
      batchSize: formula.default_batch_size_kg,
      averagePieceWeight: formula.average_piece_weight || 0,
      totalPieces: formula.total_pieces || 0,
      activeIngredients: formula.active_ingredients_json || [],
      ingredients: (formula.recipe_json || []).map((item: any) => {
        console.log('🔄 Processing ingredient item:', item);
        const weightKg =
          item.weightKg ??
          (typeof item.qty_per_batch_kg === 'number' ? item.qty_per_batch_kg : undefined) ??
          (typeof item.weightG === 'number' ? item.weightG / 1000 : 0);
        const weightG =
          item.weightG ??
          (typeof item.weightKg === 'number' ? item.weightKg * 1000 : undefined) ??
          (typeof item.qty_per_batch_kg === 'number' ? item.qty_per_batch_kg * 1000 : 0);
        // Use saved unit preference if available
        let weightUnit: 'kg' | 'g' = 'g';
        if (item.weightUnit && (item.weightUnit === 'kg' || item.weightUnit === 'g')) {
          weightUnit = item.weightUnit;
        } else if (Number(weightKg) >= 1) {
          weightUnit = 'kg';
        }
        
        const mappedItem = {
          name: item.name || '',
          materialName: item.materialName || '',
          vendor: item.vendor || item.supplier || '',
          lotNumber: item.lotNumber || '',
          weightKg: Number(weightKg) || 0,
          weightG: Number(weightG) || 0,
          weightUnit,
          vessel: item.vessel || null,
        };
        console.log('🔄 Mapped ingredient:', mappedItem);
        return mappedItem;
      }),
      procedureText: formula.procedure_text || '',
      customerId: formula.customer_id || null,
      status: formula.status || 'active', // Include original status
    };
    console.log('✅ transformFormulaForEdit result:', transformed);
    return transformed;
  };

  useEffect(() => {
    // Only fetch if we have a user session
    const checkAndFetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        fetchFormulas();
      } else {
        setLoading(false);
      }
    };

    checkAndFetch();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        fetchFormulas();
      } else if (event === 'SIGNED_OUT') {
        setFormulas([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    formulas,
    loading,
    error,
    saveFormula,
    deleteFormula,
    refreshFormulas: fetchFormulas,
    transformFormulaForEdit,
  };
};