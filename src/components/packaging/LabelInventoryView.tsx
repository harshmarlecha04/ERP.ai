import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useLabelInventory,
  useLabelInventorySummary,
  useCustomerProducts,
  useDeleteLabelInventoryRecord,
  LabelInventoryFilters,
  LabelInventoryRecord,
} from "@/hooks/useLabelInventory";
import { LabelInventoryTable } from "./LabelInventoryTable";
import { LabelInventoryFiltersComponent } from "./LabelInventoryFilters";
import { LabelInventorySummaryComponent } from "./LabelInventorySummary";
import { ReceiveLabelsForm } from "./ReceiveLabelsForm";
import { LabelInventoryImportModal } from "./LabelInventoryImportModal";
import { EditLabelInventoryModal } from "./EditLabelInventoryModal";
import { exportLabelInventoryToCSV } from "@/utils/csvExport";

export const LabelInventoryView: React.FC = () => {
  const { toast } = useToast();
  const [filters, setFilters] = useState<LabelInventoryFilters>({});
  const [receiveFormOpen, setReceiveFormOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<LabelInventoryRecord | null>(null);

  // Data hooks - fetch with customer filter
  const { data: allLabelInventory = [], isLoading: isLoadingInventory } = useLabelInventory({
    date_from: filters.date_from,
    date_to: filters.date_to,
    customer_id: filters.customer_id,
  });
  const { data: summary = { total_received: 0, total_used: 0, current_on_hand: 0 }, isLoading: isLoadingSummary } = useLabelInventorySummary({
    date_from: filters.date_from,
    date_to: filters.date_to,
    customer_id: filters.customer_id,
  });
  const { data: customerProducts = [] } = useCustomerProducts();
  const deleteRecord = useDeleteLabelInventoryRecord();

  // Filter data based on search term (frontend filtering)
  const filteredLabelInventory = React.useMemo(() => {
    if (!filters.search) return allLabelInventory;
    
    const searchTerm = filters.search.toLowerCase();
    return allLabelInventory.filter(record => 
      record.product_name?.toLowerCase().includes(searchTerm) ||
      record.customer_product?.toLowerCase().includes(searchTerm)
    );
  }, [allLabelInventory, filters.search]);

  const handleEdit = (record: LabelInventoryRecord) => {
    setRecordToEdit(record);
    setEditModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this record?")) {
      try {
        await deleteRecord.mutateAsync(id);
        toast({
          title: "Record Deleted",
          description: "Label inventory record has been deleted successfully.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete record. Please try again.",
        });
      }
    }
  };

  const handleFiltersChange = (newFilters: LabelInventoryFilters) => {
    setFilters(newFilters);
  };

  const handleExport = () => {
    exportLabelInventoryToCSV(allLabelInventory);
    toast({
      title: "Export Complete",
      description: "Label inventory data has been exported to CSV.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Label Inventory</h2>
        <p className="text-muted-foreground">
          Track label receipts, usage, and on-hand quantities
        </p>
      </div>

      {/* Summary Cards */}
      <LabelInventorySummaryComponent
        summary={summary}
        isLoading={isLoadingSummary}
      />

      {/* Filters */}
      <LabelInventoryFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
        customerProducts={customerProducts}
        isLoading={isLoadingInventory}
      />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button onClick={() => setReceiveFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Receive Labels
        </Button>
        <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import from Excel
        </Button>
      </div>

      {/* Table */}
      <LabelInventoryTable
        data={filteredLabelInventory}
        isLoading={isLoadingInventory}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onExport={handleExport}
      />

      {/* Forms */}
      <ReceiveLabelsForm
        open={receiveFormOpen}
        onOpenChange={setReceiveFormOpen}
      />

      <LabelInventoryImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />

      <EditLabelInventoryModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        record={recordToEdit}
      />
    </div>
  );
};