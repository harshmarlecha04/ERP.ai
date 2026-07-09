import React, { useState, useMemo } from "react";
import { Package, Search, RotateCcw, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchivedMaterialsTable } from "@/components/inventory/ArchivedMaterialsTable";
import { RawMaterialViewer } from "@/components/inventory/RawMaterialViewer";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ArchivedMaterials() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingMaterialId, setViewingMaterialId] = useState<string | null>(null);

  const { rawMaterials = [], refetch } = useRawMaterials();
  const { data: usageStats = [] } = useUsageStats();

  const canManageInventory = () => {
    return hasPermission('admin') || hasPermission('production');
  };

  // Filter archived materials
  const archivedMaterials = useMemo(() => {
    return rawMaterials.filter(material => (material as any).is_archived === true);
  }, [rawMaterials]);

  // Filter based on search query
  const filteredArchivedMaterials = useMemo(() => {
    if (!searchQuery.trim()) return archivedMaterials;

    const query = searchQuery.toLowerCase().trim();
    return archivedMaterials.filter(material =>
      material.code?.toLowerCase().includes(query) ||
      material.name?.toLowerCase().includes(query) ||
      material.supplier?.toLowerCase().includes(query)
    );
  }, [archivedMaterials, searchQuery]);

  const handleRestoreMaterial = async (material: any) => {
    try {
      const { error } = await supabase
        .from('raw_materials')
        .update({ 
          is_archived: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', material.id);

      if (error) throw error;

      toast({
        title: "Material Restored",
        description: `${material.name} has been restored to active inventory.`,
      });

      refetch();
    } catch (error) {
      console.error('Error restoring material:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to restore material. Please try again.",
      });
    }
  };

  const handleViewDetails = (material: any) => {
    setViewingMaterialId(material.id);
    setViewerOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-100 rounded-lg">
          <Package className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Archived Materials</h1>
          <p className="text-muted-foreground">
            Manage and restore archived raw materials
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Archive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Archived</p>
              <p className="text-2xl font-bold">{archivedMaterials.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Filtered Results</p>
              <p className="text-2xl font-bold">{filteredArchivedMaterials.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Management</p>
              <p className="text-sm font-medium">
                {canManageInventory() ? "Full Access" : "View Only"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search archived materials by code, name, or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => setSearchQuery("")}
                className="gap-2"
              >
                Clear Search
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Archived Materials Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Archived Materials</CardTitle>
        </CardHeader>
        <CardContent>
          <ArchivedMaterialsTable
            archivedMaterials={filteredArchivedMaterials as any}
            usageStats={usageStats}
            onRestore={handleRestoreMaterial}
            onViewDetails={handleViewDetails}
            canManage={canManageInventory()}
          />
        </CardContent>
      </Card>

      {/* Raw Material Viewer Modal */}
      <RawMaterialViewer
        open={viewerOpen}
        materialId={viewingMaterialId}
        onClose={() => {
          setViewerOpen(false);
          setViewingMaterialId(null);
        }}
      />
    </div>
  );
}