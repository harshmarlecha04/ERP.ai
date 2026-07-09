import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Filter } from "lucide-react";
import { usePackagingHistory, PackagingFilters } from "@/hooks/usePackagingInventory";
import { exportPackagingHistoryToCSV } from "@/utils/packagingCsvExport";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const PackagingDeliveries: React.FC = () => {
  const [filters, setFilters] = useState<PackagingFilters>({ move_type: 'RECEIPT' });

  const { data: deliveries = [], isLoading } = usePackagingHistory(filters);

  const handleFilterChange = (key: keyof PackagingFilters, value: string | string[]) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "all" ? undefined : value,
    }));
  };

  const clearFilters = () => {
    setFilters({ move_type: 'RECEIPT' });
  };

  const handleExport = () => {
    exportPackagingHistoryToCSV(deliveries, "packaging_deliveries");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">All Deliveries</h2>
        <p className="text-muted-foreground">
          Track all packaging material deliveries and receipts
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={filters.date_from || ""}
                onChange={(e) => handleFilterChange("date_from", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={filters.date_to || ""}
                onChange={(e) => handleFilterChange("date_to", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={filters.category?.[0] || "all"}
                onValueChange={(value) => handleFilterChange("category", value === "all" ? [] : [value])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="BOTTLES">Bottles</SelectItem>
                  <SelectItem value="CAPS">Caps</SelectItem>
                  <SelectItem value="POUCHES">Pouches</SelectItem>
                  <SelectItem value="CORRUGATED">Corrugated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input
                placeholder="Search vendors..."
                value={filters.vendor || ""}
                onChange={(e) => handleFilterChange("vendor", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={clearFilters} className="flex-1">
                  Clear
                </Button>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>PO</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(8)].map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : deliveries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No deliveries found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>{delivery.move_date}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={delivery.category === 'BOTTLES' ? 'default' : 
                               delivery.category === 'CAPS' ? 'secondary' : 
                               delivery.category === 'POUCHES' ? 'outline' : 'destructive'}
                    >
                      {delivery.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{delivery.item_name}</TableCell>
                  <TableCell>{delivery.qty}</TableCell>
                  <TableCell>{delivery.vendor || '-'}</TableCell>
                  <TableCell>{delivery.po || '-'}</TableCell>
                  <TableCell>{delivery.location || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate" title={delivery.notes || ''}>
                    {delivery.notes || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};