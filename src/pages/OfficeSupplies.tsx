import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquarePlus, BarChart3 } from "lucide-react";
import { OfficeSupplyInventoryTable } from "@/components/office-supplies/OfficeSupplyInventoryTable";
import { OfficeSupplyRequestsTable } from "@/components/office-supplies/OfficeSupplyRequestsTable";
import { AddOfficeSupplyModal } from "@/components/office-supplies/AddOfficeSupplyModal";
import { EditOfficeSupplyModal } from "@/components/office-supplies/EditOfficeSupplyModal";
import { RequestItemModal } from "@/components/office-supplies/RequestItemModal";
import { OfficeSupply, useOfficeSupplies } from "@/hooks/useOfficeSupplies";
import { useOfficeSupplyRequests } from "@/hooks/useOfficeSupplyRequests";
import { useOfficeSupplyPurchases } from "@/hooks/useOfficeSupplyPurchases";
import { OfficeSupplyStats } from "@/components/office-supplies/OfficeSupplyStats";
import { useOfficeSupplyAnalytics } from "@/hooks/useOfficeSupplyAnalytics";
import { UsageTrendsChart } from "@/components/office-supplies/analytics/UsageTrendsChart";
import { CostAnalysis } from "@/components/office-supplies/analytics/CostAnalysis";
import { PopularItemsWidget } from "@/components/office-supplies/analytics/PopularItemsWidget";
import { CategoryBreakdown } from "@/components/office-supplies/analytics/CategoryBreakdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OfficeSupplies = () => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<OfficeSupply | null>(null);
  const [activeTab, setActiveTab] = useState("inventory");
  const [analyticsPeriod, setAnalyticsPeriod] = useState<number>(30);
  
  const { data: supplies = [] } = useOfficeSupplies();
  const { data: requests = [] } = useOfficeSupplyRequests();
  const { data: purchases = [] } = useOfficeSupplyPurchases();
  const { data: analytics, isLoading: analyticsLoading } = useOfficeSupplyAnalytics(analyticsPeriod);
  
  const pendingCount = requests.filter(req => req.status === "pending").length;
  const totalItems = supplies.length;
  const totalPurchaseCost = purchases.reduce((sum, p) => sum + p.total_cost, 0);

  const handleEdit = (supply: OfficeSupply) => {
    setSelectedSupply(supply);
    setEditModalOpen(true);
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Office Supplies & Miscellaneous</h1>
          <p className="text-muted-foreground mt-1">
            Manage office supplies, facility items, and submit requests
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setRequestModalOpen(true)} variant="outline">
            <MessageSquarePlus className="h-4 w-4 mr-2" />
            Request Item
          </Button>
          {activeTab === "inventory" && (
            <Button onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          )}
        </div>
      </div>

      <OfficeSupplyStats 
        totalItems={totalItems}
        totalPurchaseCost={totalPurchaseCost}
        openRequests={pendingCount}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="requests">
            <span className="flex items-center gap-2">
              Requests
              {pendingCount > 0 && (
                <Badge variant="destructive" className="rounded-full min-w-5 h-5 flex items-center justify-center px-1.5">
                  {pendingCount}
                </Badge>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-6">
          <OfficeSupplyInventoryTable onEdit={handleEdit} />
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <OfficeSupplyRequestsTable />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Usage Analytics</h2>
              <p className="text-muted-foreground">Insights into supply usage patterns and costs</p>
            </div>
            <Select
              value={analyticsPeriod.toString()}
              onValueChange={(value) => setAnalyticsPeriod(parseInt(value))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {analyticsLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading analytics...
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <UsageTrendsChart data={analytics.usageTrends} />
                <CostAnalysis data={analytics.costByCategory} />
              </div>
              
              <PopularItemsWidget data={analytics.popularItems} />
              
              <CategoryBreakdown data={analytics.categoryStats} />
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No analytics data available
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddOfficeSupplyModal open={addModalOpen} onOpenChange={setAddModalOpen} />
      <EditOfficeSupplyModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        supply={selectedSupply}
      />
      <RequestItemModal open={requestModalOpen} onOpenChange={setRequestModalOpen} />
    </div>
  );
};

export default OfficeSupplies;
