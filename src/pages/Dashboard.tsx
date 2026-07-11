import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core';
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  rectSortingStrategy 
} from '@dnd-kit/sortable';
import { DraggableShortcutCard } from "@/components/dashboard/DraggableShortcutCard";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { WeeklyScheduleWidget } from "@/components/dashboard/WeeklyScheduleWidget";
import { TodayTasksWidget } from "@/components/tasks/TodayTasksWidget";
import { AIInsightsWidget } from "@/components/dashboard/AIInsightsWidget";
import { QuickStatsBar } from "@/components/dashboard/QuickStatsBar";
import { SparklineMetricCard } from "@/components/dashboard/SparklineMetricCard";
import { ProductionTrendChart } from "@/components/dashboard/ProductionTrendChart";
import { InventoryBreakdownChart } from "@/components/dashboard/InventoryBreakdownChart";
import { ProgressRingWidget } from "@/components/dashboard/ProgressRingWidget";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  DollarSign, 
  Beaker, 
  Package2, 
  Settings2, 
  RotateCcw, 
  X, 
  Save, 
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  Info
} from "lucide-react";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useDashboardShortcuts } from "@/hooks/useDashboardShortcuts";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { 
    totalInventoryCost, 
    weeklyBatches, 
    weeklyBottlesPacked,
    productionSchedule,
    activeOrders,
    pendingReview,
    onScheduleCount,
    criticalAlerts,
    productionTrendData,
    inventoryBreakdownData,
    sparklineInventory,
    sparklineBatches,
    sparklineBottles,
    isLoading: metricsLoading
  } = useDashboardMetrics();
  const navigate = useNavigate();
  const {
    shortcuts,
    loading,
    isCustomizing,
    isSaving,
    startCustomizing,
    cancelCustomizing,
    saveAndExit,
    reorderShortcuts,
    toggleVisibility,
    resetToDefaults,
  } = useDashboardShortcuts();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderShortcuts(active.id as string, over.id as string);
  };

  const handleBatchesClick = () => {
    navigate('/production');
  };

  // Quick stats from real data
  const quickStats = [
    { label: 'Active Orders', value: String(activeOrders), icon: Package, color: 'primary' as const },
    { label: 'On Schedule', value: String(onScheduleCount), icon: CheckCircle2, color: 'success' as const },
    { label: 'Pending Review', value: String(pendingReview), icon: Clock, color: 'warning' as const },
    { label: 'Critical Alerts', value: String(criticalAlerts), icon: AlertTriangle, color: 'destructive' as const },
  ];

  // Weekly target progress
  const weeklyBatchTarget = 50;
  const currentBatches = weeklyBatches || 0;

  return (
    <TooltipProvider>
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Welcome Header */}
        <WelcomeHeader />

        {/* Quick Stats Bar */}
        <QuickStatsBar stats={quickStats} />

        {/* Key Metrics with Sparklines */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Key Metrics</h2>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Real-time data with 14-day trend indicators</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <SparklineMetricCard
              title="Total Inventory Cost"
              value={`$${totalInventoryCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              subtitle="Live updating • All in-stock materials"
              icon={<DollarSign className="h-4 w-4" />}
              color="primary"
              loading={metricsLoading}
              sparklineData={sparklineInventory}
              trend={{ value: 0, label: 'current snapshot' }}
            />
            
            <SparklineMetricCard
              title="Weekly Batches"
              value={weeklyBatches !== null ? weeklyBatches : "—"}
              subtitle="Scheduled this week • Mon–Fri"
              icon={<Beaker className="h-4 w-4" />}
              color="warning"
              onClick={handleBatchesClick}
              loading={metricsLoading}
              sparklineData={sparklineBatches}
            />
            
            <SparklineMetricCard
              title="Bottles Packed This Week"
              value={weeklyBottlesPacked !== null ? weeklyBottlesPacked.toLocaleString() : "—"}
              subtitle="Monday to now • This week"
              icon={<Package2 className="h-4 w-4" />}
              color="success"
              loading={metricsLoading}
              sparklineData={sparklineBottles}
            />
          </div>
        </section>

        {/* Charts Row */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Analytics Overview</h2>
            <p className="text-sm text-muted-foreground">Performance trends and breakdowns</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Production Trend Chart - Takes 2 columns */}
            <div className="lg:col-span-2">
              <ProductionTrendChart 
                data={productionTrendData}
                loading={metricsLoading}
              />
            </div>
            
            {/* Progress Ring Widget */}
            <ProgressRingWidget
              title="Weekly Target"
              description="Batch production goal"
              current={currentBatches}
              target={weeklyBatchTarget}
              color="primary"
              loading={metricsLoading}
            />
          </div>
        </section>

        {/* Inventory Breakdown */}
        <section className="grid gap-6 lg:grid-cols-2">
          <InventoryBreakdownChart
            data={inventoryBreakdownData}
            title="Inventory by Supplier"
            description="Value distribution across suppliers"
            variant="pie"
            loading={metricsLoading}
          />
          
          <InventoryBreakdownChart
            data={inventoryBreakdownData}
            title="Category Comparison"
            description="Horizontal value comparison"
            variant="bar"
            loading={metricsLoading}
          />
        </section>

        {/* Weekly Production Schedule + Today's Tasks */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <WeeklyScheduleWidget 
              schedule={productionSchedule} 
              loading={metricsLoading}
            />
          </div>
          <TodayTasksWidget />
        </section>{/* AI Operational Insights */}
        <section>
          <AIInsightsWidget />
        </section>


        {/* Quick Access Shortcuts */}

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Quick Access</h2>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click tiles to navigate. Customize to reorder or hide.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            {/* Customize Controls */}
            {isCustomizing ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelCustomizing}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveAndExit}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={startCustomizing}
                className="text-muted-foreground hover:text-foreground gap-1.5"
              >
                <Settings2 className="h-4 w-4" />
                Customize
              </Button>
            )}
          </div>

          {/* Customize Mode Hint */}
          {isCustomizing && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-primary">
                <strong>Customizing:</strong> Drag to reorder • Click the eye icon to show/hide shortcuts
              </p>
            </div>
          )}

          {/* Shortcuts Grid */}
          {loading ? (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[76px] rounded-lg" />
              ))}
            </div>
          ) : shortcuts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <p className="text-muted-foreground mb-3">No shortcuts visible</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to Defaults
                </Button>
              </CardContent>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={shortcuts.map(s => s.key)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {shortcuts.map((shortcut) => (
                    <DraggableShortcutCard
                      key={shortcut.key}
                      shortcut={shortcut.config}
                      isCustomizing={isCustomizing}
                      isVisible={shortcut.isVisible}
                      onToggleVisibility={() => toggleVisibility(shortcut.key)}
                      onClick={() => navigate(shortcut.config.path)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </section>

        
      </div>
    </TooltipProvider>
  );
}
