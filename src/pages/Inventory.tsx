import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Package, AlertTriangle, DollarSign, Truck, FileText, Plus, Filter, Upload, Trash2, Edit, Download, Archive, RotateCcw, Settings, Bell, ChevronDown, BarChart3 } from "lucide-react";
import { exportInventoryToExcel } from "@/utils/csvExport";
import { PDFViewerModal } from "@/components/inventory/PDFViewerModal";
import { useRawMaterialsOptimized } from "@/hooks/useRawMaterialsOptimized";
import { RawMaterialModal } from "@/components/inventory/RawMaterialModal";
import { RawMaterialViewer } from "@/components/inventory/RawMaterialViewer";
import { DeleteConfirmationModal } from "@/components/inventory/DeleteConfirmationModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArchiveConfirmationModal } from "@/components/inventory/ArchiveConfirmationModal";
import { PackagingQuickView } from "@/components/inventory/PackagingQuickView";
import { InventoryAlertsWidget } from "@/components/inventory/InventoryAlertsWidget";
import { useUnacknowledgedInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { useCreateInventoryThreshold, useInventoryThresholds, useDeleteInventoryThreshold } from "@/hooks/useInventoryThresholds";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import type { RawMaterial, RawMaterialForm } from "@/types/inventory";
import { useRawMaterialAnalytics } from "@/hooks/useRawMaterialAnalytics";
import { UsageTrendsChart } from "@/components/inventory/analytics/UsageTrendsChart";
import { MaterialCostAnalysis } from "@/components/inventory/analytics/MaterialCostAnalysis";
import { TopMaterialsWidget } from "@/components/inventory/analytics/TopMaterialsWidget";
import { SupplierPerformance } from "@/components/inventory/analytics/SupplierPerformance";
import { InventoryEfficiencyWidget } from "@/components/inventory/analytics/InventoryEfficiencyWidget";
import { todayET } from "@/utils/dateUtils";

export default function Inventory() {
  console.log('=== INVENTORY COMPONENT RENDER ===');
  const { toast } = useToast();
  const { canAccessCosts, hasPermission } = useUserRoles();
  const canManageInventory = () => true; // All authenticated users can manage inventory
  const [currentTab, setCurrentTab] = useState("active");
  const [analyticsPeriod, setAnalyticsPeriod] = useState<number>(30);
  
  // Get unacknowledged alerts for the dropdown badge
  const { data: unacknowledgedAlerts = [] } = useUnacknowledgedInventoryAlerts();
  
  // Hook for active materials
  const {
    materials: activeMaterials,
    isLoading: activeLoading,
    upsertMaterial,
    deleteMaterial,
    bulkDeleteMaterial,
    archiveMaterial,
    bulkArchiveMaterial,
    refetch: refetchActive
  } = useRawMaterialsOptimized({ isArchived: false });

  // Hook for archived materials
  const {
    materials: archivedMaterials,
    isLoading: archivedLoading,
    restoreMaterial,
    refetch: refetchArchived
  } = useRawMaterialsOptimized({ isArchived: true });

  // Usage stats for archived materials
  const { data: usageStats = [] } = useUsageStats();

  // Analytics data
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useRawMaterialAnalytics(analyticsPeriod);
  
  // Debug analytics state
  console.log('📊 [Inventory] Analytics state:', {
    isLoading: analyticsLoading,
    hasData: !!analyticsData,
    hasError: !!analyticsError,
    error: analyticsError
  });

  // Use active materials for the main view (backward compatibility)
  const rawMaterials = activeMaterials;
  
  // DEBUG: Log the actual data we're working with
  console.log('=== RAW MATERIALS DATA DEBUG ===');
  console.log('Raw materials count:', rawMaterials?.length || 0);
  if (rawMaterials && rawMaterials.length > 0) {
    console.log('First 3 materials:', rawMaterials.slice(0, 3).map(m => ({
      code: m.code,
      name: m.name,
      supplier: m.supplier
    })));
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedCoaUrl, setSelectedCoaUrl] = useState<string>("");
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"contains" | "word" | "starts" | "exact">("contains");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("updated_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = useState("overview");
  const [showExpiredOnly, setShowExpiredOnly] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingMaterialId, setViewingMaterialId] = useState<string | null>(null);
  
  // Simple threshold modal state
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [selectedMaterialForThreshold, setSelectedMaterialForThreshold] = useState<RawMaterial | null>(null);
  const [thresholdMinQuantity, setThresholdMinQuantity] = useState<string>("");
  const [thresholdReorderQuantity, setThresholdReorderQuantity] = useState<string>("");
  const [thresholdAlertsEnabled, setThresholdAlertsEnabled] = useState(true);
  
  // Use threshold hooks
  const createThreshold = useCreateInventoryThreshold();
  const deleteThreshold = useDeleteInventoryThreshold();
  
  // Get existing thresholds
  const { data: thresholds = [] } = useInventoryThresholds();
  const thresholdsByMaterial = useMemo(() => {
    const map = new Map();
    thresholds.forEach(threshold => {
      map.set(threshold.raw_material_id, threshold);
    });
    return map;
  }, [thresholds]);
  
  // Bulk selection state
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'archive' | 'delete' | null>(null);

  // Handle save material (create or update)
  const handleSaveMaterial = async (data: RawMaterialForm) => {
    console.log('handleSaveMaterial called with:', data);
    try {
      console.log('About to call upsertMaterial.mutateAsync');
      const result = await upsertMaterial.mutateAsync(data);
      console.log('upsertMaterial completed successfully:', result);
      console.log('Closing modal and clearing editing material');
      setModalOpen(false);
      setEditingMaterial(null);
      console.log('Modal should be closed now');
    } catch (error) {
      console.error('Save failed in handleSaveMaterial:', error);
      // Error handled by mutation's onError
    }
  };

  // Handle archive material
  const handleArchiveMaterial = async () => {
    if (!selectedMaterial) return;
    
    await archiveMaterial.mutateAsync(selectedMaterial.id);
    setArchiveModalOpen(false);
    setSelectedMaterial(null);
  };

  // Handle restore material
  const handleRestoreMaterial = async (material: RawMaterial) => {
    await restoreMaterial.mutateAsync(material.id);
  };

  // Handle delete material
  const handleDeleteMaterial = async () => {
    if (!selectedMaterial) return;
    
    await deleteMaterial.mutateAsync(selectedMaterial.id);
    setDeleteModalOpen(false);
    setSelectedMaterial(null);
  };

  // Bulk selection handlers
  const handleSelectMaterial = (materialId: string, checked: boolean) => {
    const newSelected = new Set(selectedMaterials);
    if (checked) {
      newSelected.add(materialId);
    } else {
      newSelected.delete(materialId);
    }
    setSelectedMaterials(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredAndSortedMaterials.map(m => m.id));
      setSelectedMaterials(allIds);
    } else {
      setSelectedMaterials(new Set());
    }
  };

  // Bulk actions
  const handleBulkArchive = async () => {
    if (selectedMaterials.size === 0) return;
    
    await bulkArchiveMaterial.mutateAsync(Array.from(selectedMaterials));
    setSelectedMaterials(new Set());
    setBulkAction(null);
    setArchiveModalOpen(false);
  };

  const handleBulkDelete = async () => {
    if (selectedMaterials.size === 0) return;
    
    await bulkDeleteMaterial.mutateAsync(Array.from(selectedMaterials));
    setSelectedMaterials(new Set());
    setBulkAction(null);
    setDeleteModalOpen(false);
  };

  const clearBulkSelection = () => {
    setSelectedMaterials(new Set());
    setBulkAction(null);
  };

  const loading = currentTab === "active" ? activeLoading : archivedLoading;

  // Prioritized search ranking system
  const filteredAndSortedMaterials = rawMaterials.map(material => {
    let searchPriority = 0;
    
    // If no search query, assign neutral priority
    if (!searchQuery.trim()) {
      searchPriority = 999; // Neutral priority for no search
    } else {
      const searchTerm = searchQuery.toLowerCase();
      const code = (material.code || '').toLowerCase();
      const name = (material.name || '').toLowerCase();  
      const supplier = (material.supplier || '').toLowerCase();
      
      const checkMatch = (text: string, term: string): boolean => {
        switch (searchMode) {
          case "contains":
            return text.includes(term);
          case "word":
            // Word boundary matching - matches whole words only
            const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            return regex.test(text);
          case "starts":
            return text.startsWith(term);
          case "exact":
            return text === term;
          default:
            return text.includes(term);
        }
      };
      
      const nameMatch = checkMatch(name, searchTerm);
      const supplierMatch = checkMatch(supplier, searchTerm);
      const codeMatch = checkMatch(code, searchTerm);
      
      // Priority ranking: 1 = name (highest), 2 = supplier, 3 = code (lowest)
      if (nameMatch) {
        searchPriority = 1;
      } else if (supplierMatch) {
        searchPriority = 2;
      } else if (codeMatch) {
        searchPriority = 3;
      } else {
        searchPriority = 0; // No match - will be filtered out
      }
    }
    
    return { ...material, searchPriority };
  }).filter(material => {
    // Filter out materials with no search matches (priority 0)
    return material.searchPriority > 0;
  }).filter(m => {
    // Apply status filter
    if (filterStatus === "all") return true;
    const totalQuantity = m.lots.reduce((sum, lot) => sum + lot.quantity, 0);
    if (filterStatus === "in_stock") return totalQuantity > 0;
    if (filterStatus === "out_of_stock") return totalQuantity === 0;
    if (filterStatus === "low_stock") return totalQuantity > 0 && totalQuantity < 100;
    return true;
  }).filter(m => {
    // Apply expired filter
    if (!showExpiredOnly) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return m.lots.some(lot => {
      if (!lot.expires_on) return false;
      const expireDate = new Date(lot.expires_on);
      return expireDate < today;
    });
  }).sort((a, b) => {
    // Sort by search priority first (1 = name matches first, 2 = supplier, 3 = code)
    if (a.searchPriority !== b.searchPriority) {
      return a.searchPriority - b.searchPriority;
    }
    
    // Then sort by user's selected criteria
    let comparison = 0;
    switch (sortBy) {
      case "code":
        comparison = a.code.localeCompare(b.code);
        break;
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "supplier":
        comparison = (a.supplier || "").localeCompare(b.supplier || "");
        break;
      case "total_quantity":
        const aQty = a.lots.reduce((sum, lot) => sum + lot.quantity, 0);
        const bQty = b.lots.reduce((sum, lot) => sum + lot.quantity, 0);
        comparison = aQty - bQty;
        break;
      case "total_cost":
        const aCost = a.lots.reduce((sum, lot) => sum + (lot.quantity * lot.cost), 0);
        const bCost = b.lots.reduce((sum, lot) => sum + (lot.quantity * lot.cost), 0);
        comparison = aCost - bCost;
        break;
      case "updated_at":
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        break;
      default:
        comparison = 0;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Calculate summary statistics
  const uniqueRMCodes = new Set(rawMaterials.map(m => m.code.toLowerCase())).size;
  const totalLots = rawMaterials.reduce((sum, m) => sum + m.lots.length, 0);
  const totalValue = canAccessCosts() ? rawMaterials.reduce((sum, m) => 
    sum + m.lots.reduce((lotSum, lot) => lotSum + (lot.quantity * lot.cost), 0), 0
  ) : 0;
  
  // Count materials with expired lots
  const expiredMaterialsCount = rawMaterials.filter(m => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return m.lots.some(lot => {
      if (!lot.expires_on) return false;
      const expireDate = new Date(lot.expires_on);
      return expireDate < today;
    });
  }).length;

  // Handle expired materials filter
  const handleExpiredFilterClick = () => {
    setShowExpiredOnly(!showExpiredOnly);
  };

  const clearExpiredFilter = () => {
    setShowExpiredOnly(false);
  };

  // Handle RM Code click to open viewer
  const handleRMCodeClick = (materialId: string) => {
    setViewingMaterialId(materialId);
    setViewerOpen(true);
  };

  // Handle threshold creation
  const handleCreateThreshold = async () => {
    if (!selectedMaterialForThreshold || !thresholdMinQuantity || !thresholdReorderQuantity) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const minQty = parseFloat(thresholdMinQuantity);
    const reorderQty = parseFloat(thresholdReorderQuantity);

    if (isNaN(minQty) || isNaN(reorderQty) || minQty <= 0 || reorderQty <= 0) {
      toast({
        title: "Validation Error", 
        description: "Please enter valid positive numbers for quantities",
        variant: "destructive",
      });
      return;
    }

    try {
      await createThreshold.mutateAsync({
        raw_material_id: selectedMaterialForThreshold.id,
        min_quantity_kg: minQty,
        reorder_quantity_kg: reorderQty,
        alert_enabled: thresholdAlertsEnabled,
      });
      
      setShowThresholdModal(false);
      setSelectedMaterialForThreshold(null);
    } catch (error) {
      // Error handled by mutation's onError
    }
  };

  const handleExportInventory = () => {
    try {
      console.log('Export - Materials data:', activeMaterials);
      console.log('Export - Materials count:', activeMaterials?.length || 0);
      if (activeMaterials && activeMaterials.length > 0) {
        console.log('Export - First material:', activeMaterials[0]);
        console.log('Export - First material lots:', activeMaterials[0]?.lots);
      }
      
      exportInventoryToExcel(activeMaterials || [], `raw_materials_inventory_${todayET()}.csv`);
      toast({
        title: "Export Successful",
        description: "Inventory data has been exported to Excel format.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting the inventory data.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Raw Materials Inventory</h1>
          <p className="text-muted-foreground">
            Manage your raw materials and track inventory levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Inventory Alerts Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 relative">
                <Bell className="h-4 w-4" />
                Alerts
                {unacknowledgedAlerts.length > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {unacknowledgedAlerts.length}
                  </Badge>
                )}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className="w-[400px] p-0 bg-background border shadow-lg z-50" 
              align="end"
              sideOffset={4}
            >
              <div className="max-h-[500px] overflow-y-auto">
                <InventoryAlertsWidget showAll={true} maxItems={10} />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant="outline"
            size="sm" 
            onClick={handleExportInventory}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
          <Button 
            size="sm" 
            onClick={() => {
              setEditingMaterial(null);
              setModalOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Material
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Total Materials</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueRMCodes}</div>
            <p className="text-xs text-muted-foreground">
              {totalLots} lot numbers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {canAccessCosts() ? `$${totalValue.toFixed(2)}` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">Inventory value</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${showExpiredOnly ? 'border-destructive' : ''}`}
          onClick={handleExpiredFilterClick}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Quarantined Materials</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredMaterialsCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Expired Filter Indicator */}
      {showExpiredOnly && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            Showing quarantined materials only
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearExpiredFilter}
            className="ml-auto text-destructive hover:text-destructive"
          >
            Clear Filter
          </Button>
        </div>
      )}

       {/* Tabs for Raw Materials vs Packaging */}
       <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
         <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-lg">
           <TabsTrigger 
             value="active" 
             className="data-[state=active]:bg-background data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:shadow-sm font-medium"
           >
             Raw Materials
           </TabsTrigger>
           <TabsTrigger 
             value="analytics" 
             className="data-[state=active]:bg-background data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:shadow-sm font-medium flex items-center gap-1"
           >
             <BarChart3 className="h-4 w-4" />
             Analytics
           </TabsTrigger>
           <TabsTrigger 
             value="packaging" 
             className="data-[state=active]:bg-background data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:shadow-sm font-medium"
           >
             Packaging
           </TabsTrigger>
         </TabsList>

        <TabsContent value="active" className="space-y-4">
          {/* Bulk Actions Bar */}
          {selectedMaterials.size > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {selectedMaterials.size} material{selectedMaterials.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center gap-2">
                    {canManageInventory() && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setBulkAction('archive');
                            setArchiveModalOpen(true);
                          }}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive Selected
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setBulkAction('delete');
                            setDeleteModalOpen(true);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Selected
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={clearBulkSelection}>
                      Clear Selection
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search and Filters - Only for active materials */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by RM code, name, or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={searchMode} onValueChange={(value) => setSearchMode(value as "contains" | "word" | "starts" | "exact")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Search Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="word">Whole Word</SelectItem>
                <SelectItem value="starts">Starts With</SelectItem>
                <SelectItem value="exact">Exact Match</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
              </SelectContent>
            </Select>

            <Select value={`${sortBy}_${sortOrder}`} onValueChange={(value) => {
              const lastUnderscoreIndex = value.lastIndexOf('_');
              const field = value.substring(0, lastUnderscoreIndex);
              const order = value.substring(lastUnderscoreIndex + 1);
              setSortBy(field);
              setSortOrder(order as "asc" | "desc");
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at_desc">Recently Updated</SelectItem>
                <SelectItem value="name_asc">A to Z (by name)</SelectItem>
                <SelectItem value="total_cost_desc">Total Cost: High to Low</SelectItem>
                <SelectItem value="total_cost_asc">Total Cost: Low to High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active Materials Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedMaterials.size === filteredAndSortedMaterials.length && filteredAndSortedMaterials.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all materials"
                        />
                      </TableHead>
                      <TableHead className="text-base font-semibold">RM Code</TableHead>
                      <TableHead className="text-base font-semibold">Material Name</TableHead>
                      <TableHead className="text-base font-semibold">Supplier</TableHead>
                      <TableHead className="text-center text-base font-semibold">UOM</TableHead>
                      <TableHead className="text-center text-base font-semibold">Total Qty</TableHead>
                      <TableHead className="text-center text-base font-semibold">Total Cost</TableHead>
                      <TableHead className="text-center text-base font-semibold">Status</TableHead>
                      <TableHead className="text-center text-base font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {loading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12">
                            <div className="flex items-center justify-center gap-2">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
                              Loading materials...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredAndSortedMaterials.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12">
                            <div className="text-muted-foreground">
                              No materials found matching your criteria.
                            </div>
                          </TableCell>
                        </TableRow>
                     ) : (
                      filteredAndSortedMaterials.map((material) => {
                        const totalQuantity = material.lots.reduce((sum, lot) => sum + lot.quantity, 0);
                        const totalCost = canAccessCosts() ? material.lots.reduce((sum, lot) => sum + (lot.quantity * lot.cost), 0) : 0;
                        
                         return (
                           <TableRow key={material.id} data-material-id={material.id} className="hover:bg-muted/20 transition-colors">
                             <TableCell>
                               <Checkbox
                                 checked={selectedMaterials.has(material.id)}
                                 onCheckedChange={(checked) => handleSelectMaterial(material.id, checked as boolean)}
                                 aria-label={`Select ${material.name}`}
                               />
                             </TableCell>
                             <TableCell>
                               <Button
                                 variant="link"
                                 onClick={() => handleRMCodeClick(material.id)}
                                 className="font-mono text-base font-semibold text-primary p-0 h-auto hover:underline"
                               >
                                 {material.code}
                               </Button>
                             </TableCell>
                            <TableCell className="font-medium text-base">{material.name}</TableCell>
                            <TableCell className="text-base">{material.supplier || "—"}</TableCell>
                            <TableCell className="text-center text-base">{material.uom}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-mono text-base">
                                {totalQuantity.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {canAccessCosts() ? (
                                <span className="font-mono text-base">${totalCost.toFixed(2)}</span>
                              ) : (
                                <span className="text-muted-foreground text-base">—</span>
                              )}
                            </TableCell>
                             <TableCell className="text-center">
                               <Badge 
                                 variant={totalQuantity > 0 ? "default" : "destructive"}
                                 className={cn(
                                   "text-sm font-medium",
                                   totalQuantity > 0 ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-300" : ""
                                 )}
                               >
                                 {totalQuantity > 0 ? "In Stock" : "Out of Stock"}
                               </Badge>
                             </TableCell>
                             <TableCell className="text-center">
                                 <div className="flex items-center justify-center gap-1">
                                   {/* Threshold button - Add or Remove based on existing threshold */}
                                   {thresholdsByMaterial.has(material.id) ? (
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={() => {
                                         const threshold = thresholdsByMaterial.get(material.id);
                                         if (threshold) {
                                           deleteThreshold.mutate(threshold.id);
                                         }
                                       }}
                                       disabled={deleteThreshold.isPending}
                                       className="h-8 w-8 p-0 hover:bg-red-100 text-red-600 hover:text-red-700 dark:hover:bg-red-900/20"
                                       title="Remove Threshold"
                                     >
                                       <Bell className="h-4 w-4" />
                                     </Button>
                                   ) : (
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={() => {
                                         setSelectedMaterialForThreshold(material);
                                         setThresholdMinQuantity("");
                                         setThresholdReorderQuantity("");
                                         setThresholdAlertsEnabled(true);
                                         setShowThresholdModal(true);
                                       }}
                                       className="h-8 w-8 p-0 hover:bg-blue-100 text-blue-600 hover:text-blue-700 dark:hover:bg-blue-900/20"
                                       title="Add Threshold"
                                     >
                                       <Bell className="h-4 w-4" />
                                     </Button>
                                   )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingMaterial(material);
                                      setModalOpen(true);
                                    }}
                                    className="h-8 w-8 p-0 hover:bg-primary/10"
                                    title="Edit Material"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {canManageInventory() && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedMaterial(material);
                                          setArchiveModalOpen(true);
                                        }}
                                        className="h-8 w-8 p-0 hover:bg-orange-100 text-orange-600 hover:text-orange-700 dark:hover:bg-orange-900/20"
                                        title="Archive Material"
                                      >
                                        <Archive className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedMaterial(material);
                                          setDeleteModalOpen(true);
                                        }}
                                        className="h-8 w-8 p-0 hover:bg-destructive/10 text-destructive hover:text-destructive"
                                        title="Delete Material"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                             </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Header with period selector */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Usage Analytics</h2>
              <p className="text-sm text-muted-foreground">Material consumption and efficiency insights</p>
            </div>
            <Select 
              value={analyticsPeriod.toString()} 
              onValueChange={(value) => setAnalyticsPeriod(Number(value))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
                <SelectItem value="-1">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground">Loading analytics...</p>
              </div>
            </div>
          ) : analyticsError ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Analytics</h3>
              <p className="text-sm text-muted-foreground max-w-md text-center mb-4">
                {analyticsError instanceof Error ? analyticsError.message : 'An unexpected error occurred'}
              </p>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : analyticsData ? (
            <>
              {/* Top KPIs Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Materials Used</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.totalMetrics.total_materials_used}
                    </div>
                    <p className="text-xs text-muted-foreground">Unique materials</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Batches</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.totalMetrics.total_batches}
                    </div>
                    <p className="text-xs text-muted-foreground">Completed batches</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {canAccessCosts() 
                        ? `$${analyticsData.totalMetrics.total_cost.toFixed(2)}`
                        : '—'
                      }
                    </div>
                    <p className="text-xs text-muted-foreground">Material spend</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Cost/Batch</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {canAccessCosts()
                        ? `$${analyticsData.totalMetrics.avg_cost_per_batch.toFixed(2)}`
                        : '—'
                      }
                    </div>
                    <p className="text-xs text-muted-foreground">Per batch average</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UsageTrendsChart data={analyticsData.usageTrends} />
                {canAccessCosts() && (
                  <MaterialCostAnalysis 
                    supplierData={analyticsData.supplierAnalysis} 
                    totalCost={analyticsData.totalMetrics.total_cost}
                  />
                )}
              </div>

              {/* Widgets Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <TopMaterialsWidget materials={analyticsData.topMaterials} />
                {canAccessCosts() && (
                  <SupplierPerformance suppliers={analyticsData.supplierAnalysis} />
                )}
                <InventoryEfficiencyWidget data={analyticsData.inventoryEfficiency} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                No usage data available for the selected period. Complete some batches to see analytics.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="packaging" className="space-y-4">
          <PackagingQuickView />
        </TabsContent>
      </Tabs>

      {/* Archive Confirmation Modal */}
      <ArchiveConfirmationModal
        isOpen={archiveModalOpen}
        onClose={() => {
          setArchiveModalOpen(false);
          setSelectedMaterial(null);
          setBulkAction(null);
        }}
        onConfirm={bulkAction === 'archive' ? handleBulkArchive : handleArchiveMaterial}
        materialName={bulkAction === 'archive' 
          ? `${selectedMaterials.size} selected materials`
          : selectedMaterial?.name || ""
        }
        materialCode={bulkAction === 'archive' 
          ? ""
          : selectedMaterial?.code || ""
        }
        isBulk={bulkAction === 'archive'}
      />

      {/* Delete Confirmation Modal */}
      <RawMaterialModal
        open={modalOpen}
        initial={editingMaterial}
        onClose={() => {
          setModalOpen(false);
          setEditingMaterial(null);
        }}
        onSave={handleSaveMaterial}
        saving={upsertMaterial.isPending}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedMaterial(null);
          setBulkAction(null);
        }}
        onConfirm={bulkAction === 'delete' ? handleBulkDelete : handleDeleteMaterial}
        title={bulkAction === 'delete' 
          ? `Delete ${selectedMaterials.size} Materials`
          : "Delete Material"
        }
        description={bulkAction === 'delete'
          ? `Are you sure you want to delete ${selectedMaterials.size} selected materials? This action cannot be undone.`
          : `Are you sure you want to delete "${selectedMaterial?.name}"? This action cannot be undone.`
        }
      />

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        isOpen={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
        materialName={selectedCoaUrl}
        pdfFile={null}
        onUpload={() => {}}
        onDelete={() => {}}
      />

      {/* Raw Material Viewer Modal */}
      <RawMaterialViewer
        open={viewerOpen}
        materialId={viewingMaterialId}
        onClose={() => {
          setViewerOpen(false);
          setViewingMaterialId(null);
        }}
      />

      {/* Simple Threshold Modal */}
      <Dialog open={showThresholdModal} onOpenChange={setShowThresholdModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Inventory Threshold</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Material</Label>
              <div className="mt-1 p-3 bg-muted rounded-md">
                <p className="font-medium">{selectedMaterialForThreshold?.name}</p>
                <p className="text-sm text-muted-foreground">Code: {selectedMaterialForThreshold?.code}</p>
              </div>
            </div>
            <div>
              <Label htmlFor="min-quantity">Minimum Quantity (kg) *</Label>
              <Input
                id="min-quantity"
                type="number"
                step="0.01"
                min="0"
                value={thresholdMinQuantity}
                onChange={(e) => setThresholdMinQuantity(e.target.value)}
                placeholder="Enter minimum quantity"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="reorder-quantity">Reorder Quantity (kg) *</Label>
              <Input
                id="reorder-quantity"
                type="number"
                step="0.01"
                min="0"
                value={thresholdReorderQuantity}
                onChange={(e) => setThresholdReorderQuantity(e.target.value)}
                placeholder="Enter reorder quantity"
                className="mt-1"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="alerts-enabled"
                checked={thresholdAlertsEnabled}
                onCheckedChange={setThresholdAlertsEnabled}
              />
              <Label htmlFor="alerts-enabled">Enable low inventory alerts</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowThresholdModal(false);
                setSelectedMaterialForThreshold(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateThreshold}
              disabled={createThreshold.isPending}
            >
              {createThreshold.isPending ? "Creating..." : "Create Threshold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}