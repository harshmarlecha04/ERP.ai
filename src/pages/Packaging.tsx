import React from "react";
import { Package } from "lucide-react";
import { PackagingInventoryTabs } from "@/components/packaging/PackagingInventoryTabs";

export default function Packaging() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Package className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Packaging Inventory</h1>
          <p className="text-muted-foreground">
            Comprehensive packaging material management system
          </p>
        </div>
      </div>

      {/* Tabbed Interface */}
      <PackagingInventoryTabs />
    </div>
  );
}