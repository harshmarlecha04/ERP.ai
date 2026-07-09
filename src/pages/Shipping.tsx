import React from "react";
import { Truck } from "lucide-react";
import { ShippingView } from "@/components/packaging/ShippingView";

export default function Shipping() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Truck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Shipping</h1>
          <p className="text-muted-foreground">
            Mark completed packaging as ready to ship and bundle into invoices
          </p>
        </div>
      </div>

      <ShippingView />
    </div>
  );
}
