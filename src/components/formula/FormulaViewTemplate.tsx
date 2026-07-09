import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Scale, Users, FileText, Clock, Beaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SecurityNotice } from "@/components/formula/SecurityNotice";

interface Formula {
  id: string;
  code: string;
  name: string;
  status: string;
  version: string;
  product_code_line: string;
  default_batch_size_kg: number;
  total_pieces: number;
  average_piece_weight: number;
  yield_uom: string;
  notes: string;
  procedure_text: string;
  classification_level: string;
  security_level: string;
  recipe_json: any;
  active_ingredients_json: any;
  created_at: string;
  updated_at: string;
}

const FormulaViewTemplate = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formula, setFormula] = useState<Formula | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchFormula();
    }
  }, [id]);

  const fetchFormula = async () => {
    try {
      setLoading(true);
      
      // First check if user can access this formula
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to view formula details",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      // Fetch accessible formulas via secure RPC and find this one
      const { data: list, error: listError } = await supabase.rpc('get_accessible_formulas');

      if (listError) {
        console.error('Accessible formulas fetch error:', listError);
        toast({
          title: "Access Error",
          description: "Failed to load formula access. You may not have sufficient privileges.",
          variant: "destructive",
        });
        navigate('/formula');
        return;
      }

      const found = (list || []).find((f: any) => f.id === id);
      if (!found) {
        toast({
          title: "Formula not available",
          description: "You may not have access to this formula or it does not exist.",
          variant: "destructive",
        });
        navigate('/formula');
        return;
      }

      // Use the found accessible formula row as our base data
      const data = found as any;

      // Fetch formula ingredients from the formula_ingredients table
      const { data: formulaIngredients, error: ingredientsError } = await supabase
        .from('formula_ingredients')
        .select(`
          id,
          percentage,
          raw_materials (
            id,
            code,
            name
          )
        `)
        .eq('formula_id', id);

      let enrichedRecipeJson = [];
      let enrichedActiveIngredients = [];

      // Use formula_ingredients data if available
      if (!ingredientsError && formulaIngredients && formulaIngredients.length > 0) {
        enrichedRecipeJson = formulaIngredients.map((ingredient: any) => ({
          raw_material_id: ingredient.raw_materials?.id,
          percentage: ingredient.percentage,
          ingredient_name: ingredient.raw_materials ? 
            `${ingredient.raw_materials.code} - ${ingredient.raw_materials.name}` : 
            'Unknown Ingredient',
          ingredient_code: ingredient.raw_materials?.code || 'N/A',
          ingredient_full_name: ingredient.raw_materials?.name || 'Unknown'
        }));
      } else {
        // Fallback to JSON data processing if formula_ingredients table is empty
        console.log('Recipe JSON:', data.recipe_json);
        console.log('Active Ingredients JSON:', data.active_ingredients_json);
        
        // Process recipe ingredients from JSON
        if (data.recipe_json && Array.isArray(data.recipe_json) && data.recipe_json.length > 0) {
          const totalWeight = data.default_batch_size_kg;
          
          enrichedRecipeJson = data.recipe_json.map((item: any, index: number) => {
            const percentage = totalWeight > 0 ? ((item.weightKg || 0) / totalWeight * 100) : 0;
            
            return {
              ...item,
              percentage: parseFloat(percentage.toFixed(3)),
              ingredient_name: item.materialName || item.name || `Ingredient ${index + 1}`,
              ingredient_code: item.code || 'N/A',
              ingredient_full_name: item.materialName || item.name || 'Unknown'
            };
          });
        }

        // Process active ingredients from JSON
        if (data.active_ingredients_json && Array.isArray(data.active_ingredients_json) && data.active_ingredients_json.length > 0) {
          // Helper function to check if a string is a compound UUID (materialId-lotId)
          const isCompoundUUID = (str: string) => {
            // Match format: {uuid}-{uuid}
            const compoundUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return compoundUuidRegex.test(str);
          };

          // Helper function to extract material ID from compound UUID
          const extractMaterialId = (compoundUuid: string): string => {
            // Split on the 37th character (after first UUID which is 36 chars)
            return compoundUuid.substring(0, 36);
          };

          // Collect all material IDs from active ingredients that need to be resolved
          const materialIdsToResolve = data.active_ingredients_json
            .map((item: any) => item.name)
            .filter((name: string) => name && isCompoundUUID(name))
            .map((name: string) => extractMaterialId(name));

          // Fetch raw material names for material IDs
          let materialNamesMap: { [key: string]: string } = {};
          if (materialIdsToResolve.length > 0) {
            const { data: rawMaterialsData } = await supabase
              .from('raw_materials')
              .select('id, name')
              .in('id', materialIdsToResolve);

            if (rawMaterialsData) {
              rawMaterialsData.forEach((material: any) => {
                // Use the name directly as it already includes vendor info
                materialNamesMap[material.id] = material.name;
              });
            }
          }

          // Create a mapping from recipe ingredients to find material names
          const recipeNameMap: { [key: string]: string } = {};
          if (data.recipe_json && Array.isArray(data.recipe_json)) {
            data.recipe_json.forEach((recipeItem: any) => {
              if (recipeItem.name && recipeItem.materialName) {
                recipeNameMap[recipeItem.name] = recipeItem.materialName;
              }
            });
          }
          
          enrichedActiveIngredients = data.active_ingredients_json.map((item: any, index: number) => {
            // Resolve the ingredient name from various sources
            let ingredientName = item.materialName || item.name || `Active Ingredient ${index + 1}`;
            
            // If the name is a compound UUID, extract material ID and resolve it
            if (item.name && isCompoundUUID(item.name)) {
              const materialId = extractMaterialId(item.name);
              ingredientName = materialNamesMap[materialId] || recipeNameMap[item.name] || ingredientName;
            } else if (recipeNameMap[item.name]) {
              ingredientName = recipeNameMap[item.name];
            }

            return {
              ...item,
              ingredient_name: ingredientName,
              ingredient_code: item.code || 'N/A',
              ingredient_full_name: ingredientName,
              concentration: item.quantityMg ? `${item.quantityMg} mg/gummy` : item.concentration || 'N/A'
            };
          });
        }
      }

      setFormula({
        ...data,
        recipe_json: enrichedRecipeJson,
        active_ingredients_json: enrichedActiveIngredients
      });
    } catch (error) {
      console.error('Error fetching formula:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load formula details",
        variant: "destructive",
      });
      navigate('/formula');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'archived':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getClassificationColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'confidential':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'restricted':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'internal':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Smart percentage formatting - shows significant digits for micro amounts
  const formatPercentage = (percentage: number | undefined | null): string => {
    if (percentage === 0 || percentage === undefined || percentage === null) return '0%';
    if (percentage >= 0.01) return `${percentage.toFixed(2).replace(/\.?0+$/, '')}%`;
    if (percentage >= 0.001) return `${percentage.toFixed(3).replace(/\.?0+$/, '')}%`;
    if (percentage >= 0.0001) return `${percentage.toFixed(4).replace(/\.?0+$/, '')}%`;
    if (percentage >= 0.00001) return `${percentage.toFixed(5).replace(/\.?0+$/, '')}%`;
    return `${percentage.toFixed(6).replace(/\.?0+$/, '')}%`;
  };

  // Smart quantity formatting - converts to g for amounts under 1 kg (no mg)
  const formatQuantity = (kg: number | undefined | null): string => {
    if (kg === 0 || kg === undefined || kg === null) return '0 g';
    if (kg >= 1) return `${kg.toFixed(2).replace(/\.?0+$/, '')} kg`;
    // Everything under 1 kg displays in grams (up to 4 decimals for precision)
    return `${(kg * 1000).toFixed(4).replace(/\.?0+$/, '')} g`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <div className="flex items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-lg text-muted-foreground">Loading formula details...</p>
        </div>
      </div>
    );
  }

  if (!formula) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-8">
            <p className="text-lg text-muted-foreground mb-4">Formula not found</p>
            <Button onClick={() => navigate('/formula')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Formulas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b border-border/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="outline"
                onClick={() => navigate('/formula')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Formulas
              </Button>
            </div>
            
            <div className="flex items-start justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold text-2xl">F</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        {formula.code}
                      </h1>
                      <Badge variant={getStatusBadgeVariant(formula.status)} className="text-sm">
                        {formula.status.toUpperCase()}
                      </Badge>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getClassificationColor(formula.classification_level)}`}>
                        {formula.classification_level.toUpperCase()}
                      </div>
                    </div>
                    <p className="text-xl text-muted-foreground">{formula.name}</p>
                    <p className="text-sm text-muted-foreground">Version {formula.version} • Line {formula.product_code_line}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Security Notice */}
        <SecurityNotice securityLevel={formula.security_level} />
        
        {/* Formula Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-card via-card to-muted/20 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Scale className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Batch Size</p>
              </div>
              <p className="text-2xl font-bold">{formula.default_batch_size_kg} kg</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card via-card to-muted/20 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Package className="h-5 w-5 text-blue-500" />
                <p className="text-sm font-medium text-muted-foreground">Total Pieces</p>
              </div>
              <p className="text-2xl font-bold">{(formula.total_pieces || 0).toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card via-card to-muted/20 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Scale className="h-5 w-5 text-green-500" />
                <p className="text-sm font-medium text-muted-foreground">Avg Piece Weight</p>
              </div>
              <p className="text-2xl font-bold">{formula.average_piece_weight || 0}g</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card via-card to-muted/20 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Beaker className="h-5 w-5 text-purple-500" />
                <p className="text-sm font-medium text-muted-foreground">Ingredients</p>
              </div>
              <p className="text-2xl font-bold">{(formula.recipe_json || []).length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Ingredients */}
        {formula.active_ingredients_json && formula.active_ingredients_json.length > 0 && (
          <Card className="bg-gradient-to-br from-card via-card to-muted/20 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Active Ingredients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                  <TableHeader>
                   <TableRow>
                     <TableHead>Active Ingredient</TableHead>
                     <TableHead>Concentration</TableHead>
                   </TableRow>
                 </TableHeader>
                <TableBody>
                  {formula.active_ingredients_json.map((ingredient: any, index: number) => (
                     <TableRow key={index}>
                       <TableCell className="font-medium">
                         {ingredient.ingredient_name || ingredient.name || 'Unknown Ingredient'}
                       </TableCell>
                       <TableCell>{ingredient.concentration || 'N/A'}</TableCell>
                     </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Recipe Ingredients */}
        <Card className="bg-gradient-to-br from-card via-card to-muted/20 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5" />
              Recipe Ingredients
            </CardTitle>
            {/* Vessel Legend */}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                <span className="w-4 h-4 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-semibold">C</span>
                Cooker
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                <span className="w-4 h-4 rounded-full bg-yellow-500 text-black text-xs flex items-center justify-center font-semibold">H</span>
                Holding
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {formula.recipe_json && formula.recipe_json.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Quantity per Batch</TableHead>
                    <TableHead className="text-center">Vessel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formula.recipe_json.map((ingredient: any, index: number) => {
                    const vesselValue = ingredient.vessel;
                    const rowClass = vesselValue === 'cooker' 
                      ? 'bg-green-50 border-l-4 border-l-green-500' 
                      : vesselValue === 'holding' 
                      ? 'bg-yellow-50 border-l-4 border-l-yellow-500' 
                      : '';
                    
                    return (
                      <TableRow key={index} className={rowClass}>
                        <TableCell className="font-medium">
                          {ingredient.ingredient_name || ingredient.name || 'Unknown Ingredient'}
                        </TableCell>
                        <TableCell>{formatPercentage(ingredient.percentage)}</TableCell>
                        <TableCell>
                          {formatQuantity(
                            ingredient.weightKg ?? 
                            (ingredient.percentage ? (formula.default_batch_size_kg * ingredient.percentage) / 100 : 0)
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {vesselValue === 'cooker' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                              <span className="w-4 h-4 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-semibold">C</span>
                              Cooker
                            </span>
                          )}
                          {vesselValue === 'holding' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                              <span className="w-4 h-4 rounded-full bg-yellow-500 text-black text-xs flex items-center justify-center font-semibold">H</span>
                              Holding
                            </span>
                          )}
                          {!vesselValue && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">No ingredients defined</p>
            )}
          </CardContent>
        </Card>

        {/* Manufacturing Procedure */}
        {formula.procedure_text && (
          <Card className="bg-gradient-to-br from-card via-card to-muted/20 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Manufacturing Procedure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-slate max-w-none">
                <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg border">
                  {formula.procedure_text}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {formula.notes && (
          <Card className="bg-gradient-to-br from-card via-card to-muted/20 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{formula.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Formula Metadata */}
        <Card className="bg-gradient-to-br from-card via-card to-muted/20 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Formula Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Created</p>
                  <p className="text-sm">{formatDate(formula.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Last Updated</p>
                  <p className="text-sm">{formatDate(formula.updated_at)}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Security Level</p>
                  <Badge variant="outline">{formula.security_level}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Yield Unit</p>
                  <p className="text-sm">{formula.yield_uom}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FormulaViewTemplate;