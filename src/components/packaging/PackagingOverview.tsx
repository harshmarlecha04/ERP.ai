import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Search, Filter } from "lucide-react";
import { usePackagingBalances, usePackagingSummary, useDeletePackagingItem, PackagingFilters } from "@/hooks/usePackagingInventory";
import { PackagingTable } from "./PackagingTable";
import { PackagingMovementForm } from "./PackagingMovementForm";
import { EditPackagingItemModal } from "./EditPackagingItemModal";
import { exportPackagingToCSV } from "@/utils/packagingCsvExport";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PackagingOverviewProps {
  onItemClick: (itemId: string) => void;
}

export const PackagingOverview: React.FC<PackagingOverviewProps> = ({ onItemClick }) => {
  const [filters, setFilters] = useState<PackagingFilters>({});
  const [movementFormOpen, setMovementFormOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { data: balances = [], isLoading } = usePackagingBalances(filters);
  const { data: summary } = usePackagingSummary(filters);
  const deleteItem = useDeletePackagingItem();

  const handleEdit = (itemId: string) => {
    setSelectedItemId(itemId);
    setEditModalOpen(true);
  };

  const handleDelete = (itemId: string) => {
    deleteItem.mutate(itemId);
  };

  const handleFilterChange = (key: keyof PackagingFilters, value: string | string[]) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "all" ? undefined : value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const handleExport = () => {
    exportPackagingToCSV(balances, "packaging_inventory_overview");
  };

  return (
    <div className="space-y-6">
      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total SKUs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalSkus || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total On-Hand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalOnHand || 0} ea</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary?.lowStockCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <div className="space-y-2">
              <Label htmlFor="item_name">Item Name</Label>
              <Input
                id="item_name"
                placeholder="Search items..."
                value={filters.item_name || ""}
                onChange={(e) => handleFilterChange("item_name", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setMovementFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Receive
        </Button>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export Balances (CSV)
        </Button>
      </div>

      {/* Table */}
      <PackagingTable 
        data={balances} 
        isLoading={isLoading} 
        onItemClick={onItemClick}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Forms */}
      <PackagingMovementForm
        open={movementFormOpen}
        onOpenChange={setMovementFormOpen}
        movementType="RECEIPT"
      />

      <EditPackagingItemModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        itemId={selectedItemId}
      />
    </div>
  );
};