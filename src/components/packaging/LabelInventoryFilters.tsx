import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { LabelInventoryFilters } from "@/hooks/useLabelInventory";
import { useCustomers } from "@/hooks/useCustomers";

interface LabelInventoryFiltersProps {
  filters: LabelInventoryFilters;
  onFiltersChange: (filters: LabelInventoryFilters) => void;
  customerProducts: string[];
  isLoading?: boolean;
}

export const LabelInventoryFiltersComponent: React.FC<LabelInventoryFiltersProps> = ({
  filters,
  onFiltersChange,
  customerProducts,
  isLoading,
}) => {
  const { customers } = useCustomers();

  const handleFilterChange = (key: keyof LabelInventoryFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value === "all" ? undefined : value,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search Labels</Label>
            <Input
              id="search"
              type="text"
              placeholder="Search by product name or customer..."
              value={(filters as any).search || ""}
              onChange={(e) => handleFilterChange("search" as any, e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer">Filter by Customer</Label>
            <Select 
              value={filters.customer_id || "all"} 
              onValueChange={(value) => handleFilterChange("customer_id", value)}
            >
              <SelectTrigger id="customer">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};