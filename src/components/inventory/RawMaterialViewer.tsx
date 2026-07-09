import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { X, Package, DollarSign, Truck, Calendar, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RawMaterial } from "@/types/inventory";

interface RawMaterialViewerProps {
  open: boolean;
  materialId: string | null;
  onClose: () => void;
}

export function RawMaterialViewer({ open, materialId, onClose }: RawMaterialViewerProps) {
  const [material, setMaterial] = useState<RawMaterial | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch fresh material data when modal opens
  useEffect(() => {
    if (open && materialId) {
      fetchMaterial();
    }
  }, [open, materialId]);

  const fetchMaterial = async () => {
    if (!materialId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select(`
          *,
          lots:raw_material_lots!raw_material_lots_raw_material_id_fkey(*)
        `)
        .eq('id', materialId)
        .single();

      if (error) throw error;
      
      // Transform the data to match RawMaterial type
      const materialData: RawMaterial = {
        ...data,
        unit_of_measure: data.uom, // Map uom to unit_of_measure for type compatibility
        lots: data.lots || []
      };
      
      setMaterial(materialData);
    } catch (error) {
      console.error('Error fetching material:', error);
      setMaterial(null);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit', 
      year: 'numeric'
    });
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(expiryDate) < today;
  };

  const getLotStatus = (lot: any) => {
    if (isExpired(lot.expires_on)) {
      return { label: "Expired", variant: "destructive" as const };
    }
    if (lot.quantity > 0) {
      return { label: "In Stock", variant: "default" as const };
    }
    return { label: "Empty", variant: "secondary" as const };
  };

  if (!open) return null;

  // Calculate totals
  const totalQuantity = material?.lots.reduce((sum, lot) => sum + lot.quantity, 0) || 0;
  const totalCost = material?.lots.reduce((sum, lot) => sum + (lot.quantity * lot.cost), 0) || 0;
  const numberOfLots = material?.lots.length || 0;
  const hasExpiredLots = material?.lots.some(lot => isExpired(lot.expires_on)) || false;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold">Raw Material Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
              Loading material details...
            </div>
          </div>
        ) : !material ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Material not found</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">RM Code</label>
                    <div className="font-mono text-lg font-bold text-primary">{material.code}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Material Name</label>
                    <div className="text-lg font-semibold">{material.name}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Supplier</label>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      {material.supplier || "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Unit of Measure</label>
                    <div className="font-medium">{material.uom}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Totals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Total Quantity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-right">{totalQuantity.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground text-right">{material.uom}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Total Cost
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-right">${totalCost.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground text-right">Inventory value</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Number of Lots</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-right">{numberOfLots}</div>
                  <div className="text-xs text-muted-foreground text-right">Active lots</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-end gap-1">
                    <Badge 
                      variant={totalQuantity > 0 ? "default" : "destructive"}
                      className={totalQuantity > 0 ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-300" : ""}
                    >
                      {totalQuantity > 0 ? "In Stock" : "Out of Stock"}
                    </Badge>
                    {hasExpiredLots && (
                      <Badge variant="destructive" className="text-xs">
                        Has Expired Lots
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lots Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Lot Details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {material.lots.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No lots available for this material
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-semibold">Lot Number</TableHead>
                          <TableHead className="text-right font-semibold">Quantity</TableHead>
                          <TableHead className="text-right font-semibold">Cost/Unit</TableHead>
                          <TableHead className="text-right font-semibold">Total Value</TableHead>
                          <TableHead className="text-center font-semibold">Receiving Date</TableHead>
                          <TableHead className="text-center font-semibold">Expiry Date</TableHead>
                          <TableHead className="text-center font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {material.lots.map((lot) => {
                          const status = getLotStatus(lot);
                          const lotValue = lot.quantity * lot.cost;
                          
                          return (
                            <TableRow key={lot.id} className="hover:bg-muted/20">
                              <TableCell className="font-mono font-medium">
                                {lot.lot_number || "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {lot.quantity.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ${lot.cost.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                ${lotValue.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  {formatDate(lot.receiving_date)}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {isExpired(lot.expires_on) ? (
                                    <AlertTriangle className="h-3 w-3 text-destructive" />
                                  ) : (
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  {formatDate(lot.expires_on)}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={status.variant} className="text-xs">
                                  {status.label}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Close Button */}
            <div className="flex justify-end pt-4">
              <Button onClick={onClose} className="min-w-24">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}