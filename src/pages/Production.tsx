import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Plus, Clock, Package, AlertCircle, List, Download, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScheduleNewBatchModal } from "@/components/production/ScheduleNewBatchModal";
import { ProductionCalendar } from "@/components/production/ProductionCalendar";
import { ProductionList } from "@/components/production/ProductionList";
import { CapacityCalendar } from "@/components/production/CapacityCalendar";
import { MaterialShortageAlerts } from "@/components/inventory/MaterialShortageAlerts";
import { exportProductionSchedule } from "@/utils/reportExports";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
interface ProductionMetrics {
  totalScheduled: number;
  materialsOk: number;
  scheduledDays: number;
  totalBatches: number;
}

export default function Production() {
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'capacity'>('list');
  const [metricsOpen, setMetricsOpen] = useState(true);

  const [scheduleItems, setScheduleItems] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<ProductionMetrics>({
    totalScheduled: 0,
    materialsOk: 0,
    scheduledDays: 0,
    totalBatches: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('production_schedule_items')
        .select(`
          id, 
          batches, 
          materials_ok, 
          total_required_kg,
          formula_code,
          current_stage,
          actual_yield_kg,
          bottles_packed,
          yield_variance_percent,
          production_schedules!inner(schedule_date)
        `);

      if (error) throw error;

      // Transform data to include schedule_date at top level
      const transformedData = data?.map(item => ({
        ...item,
        schedule_date: (item as any).production_schedules?.schedule_date,
      })) || [];

      setScheduleItems(transformedData);

      const totalScheduled = data?.length || 0;
      const materialsOk = data?.filter(item => item.materials_ok).length || 0;
      const totalBatches = data?.reduce((sum, item) => sum + (item.batches || 0), 0) || 0;

      // Count unique production days (today and future only)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const uniqueDays = new Set<string>();
      transformedData.forEach(item => {
        if (item.schedule_date) {
          const scheduleDate = new Date(item.schedule_date + 'T00:00:00');
          if (scheduleDate >= today) {
            uniqueDays.add(item.schedule_date);
          }
        }
      });
      const scheduledDays = uniqueDays.size;

      setMetrics({
        totalScheduled,
        materialsOk,
        scheduledDays,
        totalBatches
      });
    } catch (error: any) {
      toast({
        title: "Error loading metrics",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleExport = () => {
    exportProductionSchedule(scheduleItems);
    toast({
      title: 'Export Complete',
      description: `Exported ${scheduleItems.length} production schedule items to CSV`,
    });
  };

  const handleScheduleUpdate = () => {
    loadMetrics();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Production Schedule</h1>
          <p className="text-muted-foreground">
            Manage batch production and track progress
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button className="gap-2" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Schedule New Batch
          </Button>
        </div>
      </div>

      {/* Production Metrics */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMetricsOpen(!metricsOpen)}
          className="h-7 px-2 text-xs text-muted-foreground gap-1"
        >
          {metricsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {metricsOpen ? 'Hide metrics' : 'Show metrics'}
        </Button>
        {metricsOpen && (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Scheduled
            </CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalScheduled}</div>
            <p className="text-xs text-muted-foreground mt-1">Schedule items</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Materials OK
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.materialsOk}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to produce</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Batches
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalBatches}</div>
            <p className="text-xs text-muted-foreground mt-1">Individual batches</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Production Days
            </CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.scheduledDays}</div>
            <p className="text-xs text-muted-foreground mt-1">Days scheduled</p>
          </CardContent>
        </Card>
      </div>
        )}
      </div>


      {/* Material Shortages Alert */}
      <MaterialShortageAlerts />

      {/* View Toggle and Schedule Button */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'calendar' | 'list' | 'capacity')} className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="calendar">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="capacity">
              <Clock className="h-4 w-4 mr-2" />
              Capacity
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="h-4 w-4 mr-2" />
              List
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="calendar">
          <ProductionCalendar onScheduleUpdate={handleScheduleUpdate} />
        </TabsContent>
        
        <TabsContent value="capacity">
          <CapacityCalendar />
        </TabsContent>
        
        <TabsContent value="list">
          <ProductionList onScheduleUpdate={handleScheduleUpdate} />
        </TabsContent>
      </Tabs>

      {/* Schedule New Batch Modal */}
      <ScheduleNewBatchModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleScheduleUpdate}
      />
    </div>
  );
}