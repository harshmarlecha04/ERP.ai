import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQualityData } from "@/hooks/useQualityData";
import { useCompletedBatches } from "@/hooks/useCompletedBatches";
import { Calendar, AlertTriangle, Package, ArrowUpDown } from 'lucide-react';
import { ProductionWorkflowModal } from "@/components/quality/ProductionWorkflowModal";
import { AutoPopulateIngredientsModal } from "@/components/quality/AutoPopulateIngredientsModal";
import { CompletedBatchesTab } from "@/components/quality/CompletedBatchesTab";
import { StageTrackingModal } from "@/components/quality/StageTrackingModal";
import { WeighUpModal } from "@/components/quality/WeighUpModal";
import { DeductInventoryModal } from "@/components/quality/DeductInventoryModal";
import { YieldAnalytics } from "@/components/quality/YieldAnalytics";
import { QualityBatchTable } from "@/components/quality/QualityBatchTable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useScrollMemory } from "@/hooks/useScrollMemory";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
interface QualityRecord {
  id: string;
  batchId: string;
  lotNumber: string;
  product: string;
  qcDate: string;
  inspector: string;
  status: 'pending' | 'approved' | 'rejected' | 'in-review';
  testResults: {
    microbiological: 'pass' | 'fail' | 'pending';
    chemical: 'pass' | 'fail' | 'pending';
    physical: 'pass' | 'fail' | 'pending';
  };
}
interface GMPTraining {
  id: string;
  employeeName: string;
  module: string;
  completionDate: string;
  status: 'current' | 'expiring-soon' | 'expired';
}

type SortOption = 'newest-first' | 'oldest-first';

const Quality = () => {
  const [activeTab, setActiveTab] = useState("batch-quality");
  const [sortOption, setSortOption] = useState<SortOption>('newest-first');
  const [workflowModal, setWorkflowModal] = useState<{
    isOpen: boolean;
    scheduleItem: any | null;
    initialStep: 1 | 2;
  }>({ isOpen: false, scheduleItem: null, initialStep: 1 });
  const [isStageTrackingModalOpen, setIsStageTrackingModalOpen] = useState(false);
  const [isWeighUpModalOpen, setIsWeighUpModalOpen] = useState(false);
  const [isDeductInventoryModalOpen, setIsDeductInventoryModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<{
    id: string;
    formulaId: string;
    formulaCode: string;
    formulaName: string;
    batches: number;
    scheduleDate: string;
    totalRequiredKg: number;
    actual_yield_kg?: number | null;
    avg_wet_piece_weight_g?: number | null;
    number_of_towers?: number | null;
    weighed_at?: string | null;
  } | null>(null);
  const [isAutoPopulateModalOpen, setIsAutoPopulateModalOpen] = useState(false);
  const [deductedBatches, setDeductedBatches] = useState<Set<string>>(new Set());
  const {
    scheduleItems,
    loading,
    completeSchedule,
    refetch
  } = useQualityData();
  const {
    deductInventoryForBatch,
    completedBatches
  } = useCompletedBatches();
  const {
    toast
  } = useToast();

  // Scroll memory hook
  const { saveScrollPosition, restoreScrollPosition } = useScrollMemory({
    restoreDelay: 350
  });

  // Wrap refetch to support scroll restoration
  const refetchWithScrollRestore = async () => {
    await refetch();
    restoreScrollPosition();
  };

  // Sort scheduleItems based on selected sort option
  const sortedScheduleItems = useMemo(() => {
    return [...scheduleItems].sort((a, b) => {
      const dateA = a.schedule_date ? new Date(a.schedule_date) : new Date(0);
      const dateB = b.schedule_date ? new Date(b.schedule_date) : new Date(0);
      
      if (sortOption === 'newest-first') {
        return dateB.getTime() - dateA.getTime();
      } else {
        return dateA.getTime() - dateB.getTime();
      }
    });
  }, [scheduleItems, sortOption]);

  // Sample GMP training data
  const gmpTrainingData: GMPTraining[] = [{
    id: '1',
    employeeName: 'Sarah Johnson',
    module: 'Basic GMP Principles',
    completionDate: '2024-01-15',
    status: 'current'
  }, {
    id: '2',
    employeeName: 'Michael Chen',
    module: 'Quality Control Procedures',
    completionDate: '2023-12-10',
    status: 'expiring-soon'
  }, {
    id: '3',
    employeeName: 'Lisa Rodriguez',
    module: 'Documentation Standards',
    completionDate: '2023-01-20',
    status: 'expired'
  }];
  
  const getTrainingStatusColor = (status: string) => {
    switch (status) {
      case 'current':
        return 'bg-success text-success-foreground';
      case 'expiring-soon':
        return 'bg-warning text-warning-foreground';
      case 'expired':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };
  
  const handleProcessBatch = (item: any) => {
    saveScrollPosition();
    setWorkflowModal({
      isOpen: true,
      scheduleItem: item,
      initialStep: 1
    });
  };

  const handleStageTrackingClick = (item: any) => {
    saveScrollPosition();
    setSelectedBatch({
      id: item.id,
      formulaId: item.formula_id,
      formulaCode: item.formula_code,
      formulaName: item.formula_name,
      batches: item.batches,
      scheduleDate: item.schedule_date,
      totalRequiredKg: item.total_required_kg
    });
    setIsStageTrackingModalOpen(true);
  };

  const handleDeductInventoryClick = (item: any) => {
    saveScrollPosition();
    setSelectedBatch({
      id: item.id,
      formulaId: item.formula_id,
      formulaCode: item.formula_code,
      formulaName: item.formula_name,
      batches: item.batches,
      scheduleDate: item.schedule_date,
      totalRequiredKg: item.total_required_kg
    });
    setIsDeductInventoryModalOpen(true);
  };

  const handleDeductConfirm = async () => {
    if (!selectedBatch) return;

    try {
      await deductInventoryForBatch(
        selectedBatch.id,
        selectedBatch.formulaCode,
        selectedBatch.formulaName,
        selectedBatch.batches,
        selectedBatch.totalRequiredKg
      );
      
      toast({
        title: "Success",
        description: "Inventory deducted successfully",
      });
      
      setIsDeductInventoryModalOpen(false);
      setSelectedBatch(null);
      await refetchWithScrollRestore();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to deduct inventory",
        variant: "destructive",
      });
    }
  };

  const handleWorkflowSuccess = async () => {
    setWorkflowModal({ isOpen: false, scheduleItem: null, initialStep: 1 });
    await refetch();
    restoreScrollPosition();
  };

  // Check if a batch has been deducted
  const isBatchDeducted = (scheduleItemId: string) => {
    // Rely solely on server state so undo actions reflect immediately
    return completedBatches.some(batch => batch.schedule_item_id === scheduleItemId && batch.status === 'deducted');
  };

  // Calculate metrics from real data
  const pendingBatches = sortedScheduleItems.filter(item => !isBatchDeducted(item.id)).length;
  const materialShortages = sortedScheduleItems.filter(item => !item.materials_ok && !isBatchDeducted(item.id)).length;
  return <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Quality Control</h1>
          <p className="text-muted-foreground">
            Manage batch quality, compliance, and inventory deductions
          </p>
        </div>
        <Button>
          Create Batch Record
        </Button>
      </div>

      {/* Quality Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Batches</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBatches}</div>
            <p className="text-xs text-muted-foreground">Awaiting production</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Batches</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedBatches.length}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Material Shortages</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{materialShortages}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Quality Control Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="batch-quality">Batch Quality</TabsTrigger>
          <TabsTrigger value="completed-batches">Completed Batches</TabsTrigger>
          <TabsTrigger value="batch-records">Batch Records</TabsTrigger>
          <TabsTrigger value="gmp-training">GMP Training</TabsTrigger>
          <TabsTrigger value="external-lab">External Lab</TabsTrigger>
          <TabsTrigger value="yield-analytics">Yield Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="batch-quality" className="mt-6">
          <div className="space-y-4">
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    Sort: {sortOption === 'newest-first' ? 'Newest First' : 'Oldest First'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background border z-50">
                  <DropdownMenuItem 
                    onClick={() => setSortOption('newest-first')}
                    className={sortOption === 'newest-first' ? 'bg-muted' : ''}
                  >
                    Scheduled Date Latest to Old (Default)
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setSortOption('oldest-first')}
                    className={sortOption === 'oldest-first' ? 'bg-muted' : ''}
                  >
                    Scheduled Date Old to Latest
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <QualityBatchTable
              items={sortedScheduleItems}
              loading={loading}
              onWeighUp={(item) => {
                saveScrollPosition();
                setSelectedBatch({
                  id: item.id,
                  formulaId: item.formula_id,
                  formulaCode: item.formula_code,
                  formulaName: item.formula_name,
                  batches: item.batches,
                  scheduleDate: item.schedule_date,
                  totalRequiredKg: item.total_required_kg,
                  actual_yield_kg: item.actual_yield_kg,
                  avg_wet_piece_weight_g: item.avg_wet_piece_weight_g,
                  number_of_towers: item.number_of_towers,
                  weighed_at: item.weighed_at
                });
                setIsWeighUpModalOpen(true);
              }}
              onStageTracking={handleStageTrackingClick}
              onProcessBatch={handleProcessBatch}
              onDeductInventory={handleDeductInventoryClick}
              isBatchDeducted={isBatchDeducted}
            />
          </div>
        </TabsContent>

        <TabsContent value="completed-batches" className="mt-6">
          <CompletedBatchesTab />
        </TabsContent>

        <TabsContent value="batch-records" className="mt-6">
          <div className="text-center py-8 text-muted-foreground">
            <p>Batch Records functionality coming soon...</p>
          </div>
        </TabsContent>

        <TabsContent value="gmp-training" className="mt-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GMP Training Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {gmpTrainingData.map(training => <div key={training.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{training.employeeName}</h4>
                        <p className="text-sm text-muted-foreground">{training.module}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm">{training.completionDate}</span>
                        <Badge className={getTrainingStatusColor(training.status)}>
                          {training.status}
                        </Badge>
                      </div>
                    </div>)}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="external-lab" className="mt-6">
          <div className="text-center py-8 text-muted-foreground">
            <p>External Lab functionality coming soon...</p>
          </div>
        </TabsContent>

        <TabsContent value="yield-analytics" className="mt-6">
          <YieldAnalytics />
        </TabsContent>
      </Tabs>

      {/* Production Workflow Modal */}
      <ProductionWorkflowModal
        isOpen={workflowModal.isOpen}
        onClose={() => setWorkflowModal({ isOpen: false, scheduleItem: null, initialStep: 1 })}
        scheduleItem={workflowModal.scheduleItem ? {
          id: workflowModal.scheduleItem.id,
          formula_id: workflowModal.scheduleItem.formula_id,
          formula_code: workflowModal.scheduleItem.formula_code,
          formula_name: workflowModal.scheduleItem.formula_name,
          batches: workflowModal.scheduleItem.batches,
          schedule_date: workflowModal.scheduleItem.schedule_date,
          total_required_kg: workflowModal.scheduleItem.total_required_kg || 0
        } : null}
        onSuccess={handleWorkflowSuccess}
        onDeductInventory={deductInventoryForBatch}
        initialStep={workflowModal.initialStep}
      />


      {selectedBatch && (
        <StageTrackingModal
          isOpen={isStageTrackingModalOpen}
          onClose={() => {
            setIsStageTrackingModalOpen(false);
            setSelectedBatch(null);
            refetchWithScrollRestore();
          }}
          scheduleItemId={selectedBatch.id}
          formulaCode={selectedBatch.formulaCode}
          formulaName={selectedBatch.formulaName}
        />
      )}

      <WeighUpModal
        isOpen={isWeighUpModalOpen}
        onClose={() => {
          setIsWeighUpModalOpen(false);
          setSelectedBatch(null);
        }}
        scheduleItem={selectedBatch ? {
          id: selectedBatch.id,
          formulaCode: selectedBatch.formulaCode,
          formulaName: selectedBatch.formulaName,
          batches: selectedBatch.batches,
          actual_yield_kg: selectedBatch.actual_yield_kg,
          avg_wet_piece_weight_g: selectedBatch.avg_wet_piece_weight_g,
          number_of_towers: selectedBatch.number_of_towers,
          weighed_at: selectedBatch.weighed_at
        } : { id: '', formulaCode: '', formulaName: '', batches: 0 }}
        onSuccess={() => {
          refetchWithScrollRestore();
          setIsWeighUpModalOpen(false);
          setSelectedBatch(null);
        }}
      />

      {selectedBatch && (
        <DeductInventoryModal
          isOpen={isDeductInventoryModalOpen}
          onClose={() => {
            setIsDeductInventoryModalOpen(false);
            setSelectedBatch(null);
          }}
          onConfirm={handleDeductConfirm}
          batchInfo={{
            id: selectedBatch.id,
            formulaCode: selectedBatch.formulaCode,
            formulaName: selectedBatch.formulaName,
            batches: selectedBatch.batches,
            scheduleDate: selectedBatch.scheduleDate,
          }}
        />
      )}
    </div>;
};
export default Quality;