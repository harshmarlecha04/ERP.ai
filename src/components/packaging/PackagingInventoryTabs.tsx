import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Bot, Clock, Archive, FileText, RefreshCw, CalendarDays } from "lucide-react";
import { PackagingCategoryView } from "./PackagingCategoryView";
import { PackagingItemDetail } from "./PackagingItemDetail";
import { LabelInventoryView } from "./LabelInventoryView";
import { BrightStockViewer } from "./BrightStockViewer";
import { UpdateInventoryView } from "./UpdateInventoryView";
import { PackagingScheduleView } from "./PackagingScheduleView";

interface PackagingInventoryTabsProps {
  className?: string;
}

export const PackagingInventoryTabs: React.FC<PackagingInventoryTabsProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState("schedule");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  if (selectedItemId) {
    return (
      <PackagingItemDetail 
        itemId={selectedItemId} 
        onBack={() => setSelectedItemId(null)} 
      />
    );
  }

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="bottles" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Bottles
          </TabsTrigger>
          <TabsTrigger value="caps" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Caps
          </TabsTrigger>
          <TabsTrigger value="pouches" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Pouches
          </TabsTrigger>
          <TabsTrigger value="corrugated" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Corrugated
          </TabsTrigger>
          <TabsTrigger value="labels" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Labels
          </TabsTrigger>
          <TabsTrigger value="update-inventory" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Update
          </TabsTrigger>
          <TabsTrigger value="bright-stock" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Bright Stock
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-6">
          <PackagingScheduleView />
        </TabsContent>

        <TabsContent value="bottles" className="mt-6">
          <PackagingCategoryView 
            category="BOTTLES" 
            onItemClick={setSelectedItemId}
          />
        </TabsContent>

        <TabsContent value="caps" className="mt-6">
          <PackagingCategoryView 
            category="CAPS" 
            onItemClick={setSelectedItemId}
          />
        </TabsContent>

        <TabsContent value="pouches" className="mt-6">
          <PackagingCategoryView 
            category="POUCHES" 
            onItemClick={setSelectedItemId}
          />
        </TabsContent>

        <TabsContent value="corrugated" className="mt-6">
          <PackagingCategoryView 
            category="CORRUGATED" 
            onItemClick={setSelectedItemId}
          />
        </TabsContent>

        <TabsContent value="labels" className="mt-6">
          <LabelInventoryView />
        </TabsContent>

        <TabsContent value="update-inventory" className="mt-6">
          <UpdateInventoryView />
        </TabsContent>


        <TabsContent value="bright-stock" className="mt-6">
          <BrightStockViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
};