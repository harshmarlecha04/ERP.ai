import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Download, Search } from "lucide-react";
import { usePackagingBalances, usePackagingStats, PackagingFilters } from "@/hooks/usePackagingInventory";
import { PackagingTable } from "./PackagingTable";
import { PackagingMovementForm } from "./PackagingMovementForm";
import { exportPackagingToCSV } from "@/utils/packagingCsvExport";
import { BottleEntryForm } from "./BottleEntryForm";
import { EditPackagingItemModal } from "./EditPackagingItemModal";
import { CapEntryForm } from "./CapEntryForm";

interface PackagingCategoryViewProps {
  category: 'BOTTLES' | 'CAPS' | 'POUCHES' | 'CORRUGATED';
  onItemClick: (itemId: string) => void;
}

export const PackagingCategoryView: React.FC<PackagingCategoryViewProps> = ({ 
  category, 
  onItemClick 
}) => {
  const [filters, setFilters] = useState<PackagingFilters>({ category: [category] });
  const [movementFormOpen, setMovementFormOpen] = useState(false);
  const [movementType, setMovementType] = useState<'RECEIPT' | 'USAGE' | 'ADJUSTMENT'>('RECEIPT');
  const [bottleEntryOpen, setBottleEntryOpen] = useState(false);
  const [capEntryOpen, setCapEntryOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { data: balances = [], isLoading } = usePackagingBalances(filters);
  const { data: stats } = usePackagingStats(category);

  const handleSearch = (value: string) => {
    setFilters(prev => ({
      ...prev,
      item_name: value || undefined,
    }));
  };

  const handleExport = () => {
    exportPackagingToCSV(balances, `packaging_inventory_${category.toLowerCase()}`);
  };

  const openMovementForm = (type: 'RECEIPT' | 'USAGE' | 'ADJUSTMENT') => {
    setMovementType(type);
    setMovementFormOpen(true);
  };

  const handleEdit = (itemId: string) => {
    setSelectedItemId(itemId);
    setEditModalOpen(true);
  };

  const getCategoryTitle = () => {
    switch (category) {
      case 'BOTTLES': return 'Bottles';
      case 'CAPS': return 'Caps';
      case 'POUCHES': return 'Pouches';
      case 'CORRUGATED': return 'Corrugated';
      default: return category;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{getCategoryTitle()}</h2>
        <p className="text-muted-foreground">
          Manage {category.toLowerCase()} inventory
        </p>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total SKUs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSkus || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">On-Hand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOnHand || 0} ea</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.lowStockCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="search">Quick Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search items..."
              className="pl-9"
              value={filters.item_name || ""}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {category === 'BOTTLES' ? (
            <Button onClick={() => setBottleEntryOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Receive
            </Button>
          ) : category === 'CAPS' ? (
            <Button onClick={() => setCapEntryOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Receive
            </Button>
          ) : (
            <Button onClick={() => openMovementForm('RECEIPT')}>
              <Plus className="h-4 w-4 mr-2" />
              Receive
            </Button>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <PackagingTable 
        data={balances} 
        isLoading={isLoading} 
        onItemClick={onItemClick}
        onEdit={handleEdit}
      />

      {/* Movement Form */}
      <PackagingMovementForm
        open={movementFormOpen}
        onOpenChange={setMovementFormOpen}
        movementType={movementType}
        preselectedCategory={category}
      />

      {/* Bottle Entry Form */}
      <BottleEntryForm
        open={bottleEntryOpen}
        onOpenChange={setBottleEntryOpen}
      />

      {/* Cap Entry Form */}
      <CapEntryForm
        open={capEntryOpen}
        onOpenChange={setCapEntryOpen}
      />

      {/* Edit Packaging Item Modal */}
      <EditPackagingItemModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        itemId={selectedItemId}
      />
    </div>
  );
};