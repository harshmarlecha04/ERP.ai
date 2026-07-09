import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Boxes, Circle, Square, FileText, Plus, Trash2, Eye, Edit } from "lucide-react";
import { usePackagingStats } from "@/hooks/usePackagingInventory";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useCorrugatedShippers, useCreateCorrugatedShipper, useDeleteCorrugatedShipper, useUpdateCorrugatedShipper } from "@/hooks/useCorrugatedShippers";
import { formatET } from "@/utils/dateUtils";

const packagingCategories = [
  {
    id: "corrugated",
    title: "Corrugated",
    icon: Boxes,
    description: "Cardboard boxes and packaging",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  },
  {
    id: "bottles",
    title: "Bottles",
    icon: Circle,
    description: "Glass and plastic bottles",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  },
  {
    id: "caps",
    title: "Caps",
    icon: Circle,
    description: "Bottle caps and closures",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  },
  {
    id: "pouches",
    title: "Pouches",
    icon: Square,
    description: "Flexible packaging pouches",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  },
  {
    id: "labels",
    title: "Labels",
    icon: FileText,
    description: "Product labels and stickers",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  },
];

export const PackagingQuickView: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Modal and view state
  const [isCorrugatedModalOpen, setIsCorrugatedModalOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedShipper, setSelectedShipper] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    bottlesPerBox: "",
    totalBottles: 0
  });

  // Database hooks
  const { data: shippers = [], isLoading } = useCorrugatedShippers();
  const createShipper = useCreateCorrugatedShipper();
  const updateShipper = useUpdateCorrugatedShipper();
  const deleteShipper = useDeleteCorrugatedShipper();

  // Get stats for each category
  const corrugatedStats = usePackagingStats("CORRUGATED");
  const bottlesStats = usePackagingStats("BOTTLES");
  const capsStats = usePackagingStats("CAPS");
  const pouchesStats = usePackagingStats("POUCHES");
  
  // Load saved bottles per box value
  useEffect(() => {
    const savedBottlesPerBox = localStorage.getItem('bottlesPerBox');
    if (savedBottlesPerBox) {
      setFormData(prev => ({ ...prev, bottlesPerBox: savedBottlesPerBox }));
    }
  }, []);

  // Calculate total bottles when quantity or bottlesPerBox changes
  useEffect(() => {
    const quantity = parseFloat(formData.quantity) || 0;
    const bottlesPerBox = parseFloat(formData.bottlesPerBox) || 0;
    const total = quantity * bottlesPerBox;
    setFormData(prev => ({ ...prev, totalBottles: total }));
  }, [formData.quantity, formData.bottlesPerBox]);

  const handleCorrugatedClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCorrugatedModalOpen(true);
    setShowAddForm(false); // Show list view by default
  };

  const handleAddNewShipper = () => {
    setSelectedShipper(null);
    setIsEditing(false);
    setShowAddForm(true);
    setFormData({ name: "", quantity: "", bottlesPerBox: formData.bottlesPerBox, totalBottles: 0 });
  };

  const handleViewShipper = (shipper: any) => {
    setSelectedShipper(shipper);
    setIsEditing(false);
  };

  const handleEditShipper = (shipper: any) => {
    setSelectedShipper(shipper);
    setIsEditing(true);
    setShowAddForm(true);
    setFormData({
      name: shipper.name,
      quantity: shipper.quantity.toString(),
      bottlesPerBox: shipper.bottles_per_box.toString(),
      totalBottles: shipper.total_bottles,
    });
  };

  const handleBackToList = () => {
    setShowAddForm(false);
    setSelectedShipper(null);
    setIsEditing(false);
    setFormData({ name: "", quantity: "", bottlesPerBox: formData.bottlesPerBox, totalBottles: 0 });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.quantity || !formData.bottlesPerBox) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Save bottles per box for future use
    localStorage.setItem('bottlesPerBox', formData.bottlesPerBox);
    
    try {
      if (isEditing && selectedShipper) {
        await updateShipper.mutateAsync({
          id: selectedShipper.id,
          name: formData.name,
          quantity: parseFloat(formData.quantity),
          bottles_per_box: parseFloat(formData.bottlesPerBox),
          total_bottles: formData.totalBottles,
        });
      } else {
        await createShipper.mutateAsync({
          name: formData.name,
          quantity: parseFloat(formData.quantity),
          bottles_per_box: parseFloat(formData.bottlesPerBox),
          total_bottles: formData.totalBottles,
        });
      }
      
      // Reset form and go back to list
      setFormData({ name: "", quantity: "", bottlesPerBox: formData.bottlesPerBox, totalBottles: 0 });
      setShowAddForm(false);
      setSelectedShipper(null);
      setIsEditing(false);
    } catch {
      // Error is handled by the mutation hook
    }
  };

  const handleDeleteShipper = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this shipper?')) {
      try {
        await deleteShipper.mutateAsync(id);
      } catch {
        // Error is handled by the mutation hook
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const getStatsForCategory = (categoryId: string) => {
    switch (categoryId.toUpperCase()) {
      case "CORRUGATED":
        return corrugatedStats.data || { totalSkus: 0, totalOnHand: 0, lowStockCount: 0 };
      case "BOTTLES":
        return bottlesStats.data || { totalSkus: 0, totalOnHand: 0, lowStockCount: 0 };
      case "CAPS":
        return capsStats.data || { totalSkus: 0, totalOnHand: 0, lowStockCount: 0 };
      case "POUCHES":
        return pouchesStats.data || { totalSkus: 0, totalOnHand: 0, lowStockCount: 0 };
      default:
        return { totalSkus: 0, totalOnHand: 0, lowStockCount: 0 };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Packaging Overview</h3>
          <p className="text-sm text-muted-foreground">
            Quick access to packaging inventory categories
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/packaging")}
          className="gap-2"
        >
          <Package className="h-4 w-4" />
          View Full Packaging
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packagingCategories.map((category) => {
          const IconComponent = category.icon;
          const stats = getStatsForCategory(category.id);
          
          return (
            <Card 
              key={category.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={category.id === "corrugated" ? handleCorrugatedClick : () => navigate(`/packaging?tab=${category.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${category.color}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">{category.title}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {stats.totalSkus} SKUs
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {category.description}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">On Hand</p>
                    <p className="text-lg font-bold">{stats.totalOnHand}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Low Stock</p>
                    <p className={`text-lg font-bold ${
                      stats.lowStockCount > 0 ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {stats.lowStockCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Corrugated Shipper Modal */}
      <Dialog open={isCorrugatedModalOpen} onOpenChange={setIsCorrugatedModalOpen}>
        <DialogContent className="[--dialog-max-width:42rem]">
          <DialogHeader>
            <DialogTitle>
              {showAddForm ? "Add New Shipper" : "Corrugated Shipper Inventory"}
            </DialogTitle>
          </DialogHeader>
          
          {!showAddForm && (
            <div className="flex justify-end mb-4">
              <Button onClick={handleAddNewShipper} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add New Shipper
              </Button>
            </div>
          )}
          
          {showAddForm ? (
            // Add Shipper Form
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter shipper name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="Enter quantity"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', e.target.value)}
                  min="0"
                  step="1"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bottlesPerBox">Number of Bottles per Box *</Label>
                <Input
                  id="bottlesPerBox"
                  type="number"
                  placeholder="Enter bottles per box"
                  value={formData.bottlesPerBox}
                  onChange={(e) => handleInputChange('bottlesPerBox', e.target.value)}
                  min="0"
                  step="1"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This value will be saved for future entries
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="totalBottles">Total Bottles</Label>
                <Input
                  id="totalBottles"
                  type="number"
                  value={formData.totalBottles}
                  readOnly
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Calculated automatically: {formData.quantity} × {formData.bottlesPerBox}
                </p>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToList}
                >
                  Back to List
                </Button>
                <Button type="submit" disabled={createShipper.isPending || updateShipper.isPending}>
                  {isEditing 
                    ? (updateShipper.isPending ? "Updating..." : "Update Shipper")
                    : (createShipper.isPending ? "Adding..." : "Add Shipper")
                  }
                </Button>
              </div>
            </form>
          ) : (
            // Shipper List View
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">Loading shippers...</div>
              ) : shippers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No shippers added yet.</p>
                  <Button onClick={handleAddNewShipper} className="mt-2 gap-2">
                    <Plus className="h-4 w-4" />
                    Add First Shipper
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {shippers.map((shipper) => (
                    <Card key={shipper.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{shipper.name}</h4>
                          <div className="grid grid-cols-3 gap-4 mt-2 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Quantity:</span> {shipper.quantity}
                            </div>
                            <div>
                              <span className="font-medium">Bottles/Box:</span> {shipper.bottles_per_box}
                            </div>
                            <div>
                              <span className="font-medium">Total Bottles:</span> {shipper.total_bottles}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Created: {formatET(shipper.created_at, "M/d/yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewShipper(shipper)}
                            className="text-muted-foreground hover:text-foreground"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditShipper(shipper)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Edit Shipper"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteShipper(shipper.id)}
                            disabled={deleteShipper.isPending}
                            className="text-destructive hover:text-destructive"
                            title="Delete Shipper"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};