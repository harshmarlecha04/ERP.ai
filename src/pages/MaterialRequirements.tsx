import { useState, useMemo, useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMaterialRequirements } from "@/hooks/useMaterialRequirements";
import { useUserRoles } from "@/hooks/useUserRoles";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Package, AlertTriangle, ShoppingCart, Download, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaterialAlternatives } from "@/components/material-requirements/MaterialAlternatives";
import { UsedInCell } from "@/components/material-requirements/UsedInCell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackagingMaterialsCheck } from "@/components/material-requirements/PackagingMaterialsCheck";
import { formatET } from "@/utils/dateUtils";

const STORAGE_KEY = 'material-requirements-date-range';

const getStoredDateRange = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { startDate, endDate } = JSON.parse(stored);
      return { startDate, endDate };
    }
  } catch {
    // Ignore parse errors
  }
  return null;
};

export default function MaterialRequirements() {
  const today = formatET(new Date(), 'yyyy-MM-dd');
  const endOfYear = formatET(new Date(new Date().getFullYear(), 11, 31), 'yyyy-MM-dd');
  
  const storedRange = getStoredDateRange();
  const [startDate, setStartDate] = useState(storedRange?.startDate || today);
  const [endDate, setEndDate] = useState(storedRange?.endDate || endOfYear);
  
  // Persist date range to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ startDate, endDate }));
  }, [startDate, endDate]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'shortages' | 'order_now' | 'partial' | 'covered'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'shortage' | 'code' | 'name' | 'required' | 'supplier'>('shortage');
  
  const { data: requirements = [], isLoading } = useMaterialRequirements(startDate, endDate);
  const { canAccessFinancialData } = useUserRoles();
  
  const hasFinancialAccess = canAccessFinancialData();

  // Debug logging
  console.log('Material Requirements Data:', {
    count: requirements.length,
    dateRange: { startDate, endDate },
    requirements: requirements.map(r => ({
      code: r.material_code,
      name: r.material_name,
      shortage: r.net_after_orders_kg,
      formulas: r.formulas_using.map(f => f.formula_code)
    }))
  });

  // Filter and sort requirements
  const filteredRequirements = useMemo(() => {
    let filtered = [...requirements];
    
    console.log('Before filtering - total requirements:', filtered.length);
    console.log('Watermelon in raw data?', filtered.find(r => r.material_name?.toLowerCase().includes('watermelon')));

    // Apply status filter (negative = shortage, positive = surplus)
    if (statusFilter === 'shortages') {
      filtered = filtered.filter(r => r.net_after_orders_kg < 0);
    } else if (statusFilter === 'order_now') {
      filtered = filtered.filter(r => r.net_after_orders_kg < 0 && r.on_order_kg === 0);
    } else if (statusFilter === 'partial') {
      filtered = filtered.filter(r => r.on_order_kg > 0 && r.net_after_orders_kg < 0);
    } else if (statusFilter === 'covered') {
      filtered = filtered.filter(r => r.net_after_orders_kg >= 0);
    }
    
    console.log('After status filter:', filtered.length);
    console.log('Watermelon after status filter?', filtered.find(r => r.material_name?.toLowerCase().includes('watermelon')));

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.material_code.toLowerCase().includes(query) ||
        r.material_name.toLowerCase().includes(query)
      );
    }
    
    console.log('After search filter:', filtered.length);
    console.log('Watermelon after search?', filtered.find(r => r.material_name?.toLowerCase().includes('watermelon')));

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'code':
          return a.material_code.localeCompare(b.material_code);
        case 'name':
          return a.material_name.localeCompare(b.material_name);
        case 'shortage':
          // Sort by shortage: most negative (biggest shortage) first
          return a.net_after_orders_kg - b.net_after_orders_kg;
        case 'required':
          return b.total_required_kg - a.total_required_kg;
        case 'supplier':
          return (a.supplier || '').localeCompare(b.supplier || '');
        default:
          return 0;
      }
    });
    
    console.log('Final filtered array:', filtered.length);
    console.log('First 3 materials:', filtered.slice(0, 3).map(r => ({ code: r.material_code, name: r.material_name })));
    console.log('Watermelon in final?', filtered.find(r => r.material_name?.toLowerCase().includes('watermelon')));

    return filtered;
  }, [requirements, statusFilter, searchQuery, sortBy]);

  const totalRequirements = requirements.length;
  const shortageCount = requirements.filter(r => r.net_after_orders_kg < 0).length;
  const totalOnOrder = requirements.reduce((sum, r) => sum + r.on_order_kg, 0);
  const totalShortageValue = requirements.reduce((sum, r) => sum + r.net_after_orders_kg, 0);

  const hasActiveFilters = statusFilter !== 'all' || searchQuery.trim() !== '';

  const clearFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
  };

  const exportToCSV = () => {
    const headers = [
      'Material Code',
      'Material Name',
      'Supplier',
      'UOM',
      'Total Required',
      'Current Inventory',
      'Reserved',
      'Available',
      'On Order',
      'Pending POs',
      'True Shortage',
      'Alternatives Available',
      'Formulas Using',
      'Schedule Dates'
    ];

    const rows = filteredRequirements.map(req => [
      req.material_code,
      req.material_name,
      req.supplier || 'N/A',
      req.uom,
      req.total_required_kg.toFixed(2),
      req.current_inventory_kg.toFixed(2),
      req.reserved_kg.toFixed(2),
      req.available_kg.toFixed(2),
      req.on_order_kg.toFixed(2),
      req.pending_po_details.map(po => `${po.po_number} (${formatET(po.expected_delivery, 'MMM dd, yyyy')})`).join('; ') || 'None',
      req.net_after_orders_kg.toFixed(2),
      'See details in UI', // Alternatives column
      req.formulas_using.map(f => `${f.formula_code}: ${f.formula_name} (${f.batches}x)`).join('; '),
      req.schedule_dates.join('; ')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `material-requirements-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('Requirements exported to CSV');
  };

  return (
    <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">Material Requirements Planning</h1>
          <p className="text-muted-foreground mt-2">
            View purchasing needs for scheduled production including pending purchase orders
          </p>
        </div>

        <Tabs defaultValue="raw-materials" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="raw-materials">Raw Materials</TabsTrigger>
            <TabsTrigger value="packaging">Packaging Materials</TabsTrigger>
          </TabsList>

          <TabsContent value="raw-materials" className="space-y-6 mt-6">
            {/* Date Range Selector */}
            <Card>
          <CardHeader>
            <CardTitle>Date Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={exportToCSV} disabled={requirements.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export to CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Total Materials"
            value={totalRequirements}
            subtitle="Ingredients needed"
            icon={<Package className="h-4 w-4" />}
            color="primary"
          />
          <MetricCard 
            title="Total Materials with Shortages" 
            value={shortageCount} 
            subtitle="Items need ordering" 
            icon={<AlertTriangle className="h-4 w-4" />}
            color="destructive"
          />
        </div>

        {/* Requirements Table */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filter Controls */}
            <div className="flex flex-wrap gap-4 items-end border-b pb-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="search-material">Search Material</Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-material"
                    placeholder="Search by code or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="min-w-[180px]">
                <Label htmlFor="status-filter">Status Filter</Label>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger id="status-filter" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Materials</SelectItem>
                    <SelectItem value="shortages">Shortages Only</SelectItem>
                    <SelectItem value="order_now">Order Now</SelectItem>
                    <SelectItem value="partial">Partial Coverage</SelectItem>
                    <SelectItem value="covered">Fully Covered</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[180px]">
                <Label htmlFor="sort-by">Sort By</Label>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger id="sort-by" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shortage">Shortage Amount</SelectItem>
                    <SelectItem value="code">Material Code</SelectItem>
                    <SelectItem value="name">Material Name</SelectItem>
                    <SelectItem value="required">Required Quantity</SelectItem>
                    <SelectItem value="supplier">Supplier Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearFilters}
                  className="mt-7"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Results Count */}
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{filteredRequirements.length}</span> of <span className="font-medium">{totalRequirements}</span> materials
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading requirements...
              </div>
            ) : filteredRequirements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {requirements.length === 0 
                  ? "No production scheduled in this date range"
                  : "No materials match the current filters"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Code</th>
                      <th className="text-left p-2">Material Name</th>
                      <th className="text-left p-2">Supplier</th>
                      <th className="text-center p-2">Used In</th>
                      <th className="text-center p-2">Required</th>
                      <th className="text-center p-2">Available</th>
                      <th className="text-center p-2">On Order</th>
                      <th className="text-center p-2">Still Needed</th>
                      <th className="text-center p-2">Alternatives</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequirements.map((req) => {
                      const hasOnOrder = req.on_order_kg > 0;
                      const fullyMet = req.net_after_orders_kg <= 0;
                      const partiallyCovered = hasOnOrder && req.net_after_orders_kg > 0;
                      
                      return (
                        <tr key={req.raw_material_id} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-mono text-sm">{req.material_code}</td>
                          <td className="p-2 font-medium">{req.material_name}</td>
                          <td className="p-2 text-sm text-muted-foreground">
                            {req.supplier || 'No supplier'}
                          </td>
                          <td className="p-2">
                            <UsedInCell formulas={req.formulas_using} />
                          </td>
                          <td className="p-2 text-center">
                            {req.total_required_kg.toFixed(2)} {req.uom}
                          </td>
                          <td className="p-2 text-center">
                            {req.available_kg.toFixed(2)} {req.uom}
                          </td>
                          <td className="p-2 text-center">
                            {hasOnOrder ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-medium text-blue-600">
                                  {req.on_order_kg.toFixed(2)} {req.uom}
                                </span>
                                {req.pending_po_details.slice(0, 2).map((po, idx) => (
                                  <span key={idx} className="text-xs text-muted-foreground">
                                    {po.po_number}: {formatET(po.expected_delivery, 'MMM dd, yyyy')}
                                  </span>
                                ))}
                                {req.pending_po_details.length > 2 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{req.pending_po_details.length - 2} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-2 text-center font-semibold">
                            {req.net_after_orders_kg < 0 ? (
                              <span className="text-destructive">
                                {Math.abs(req.net_after_orders_kg).toFixed(2)} {req.uom}
                              </span>
                            ) : req.net_after_orders_kg === 0 ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              (() => {
                                const surplusPercentage = (req.net_after_orders_kg / req.total_required_kg) * 100;
                                if (surplusPercentage > 10) {
                                  return <span className="text-green-600 text-xl">✓</span>;
                                } else {
                                  return <span className="text-yellow-600 text-xl">✓</span>;
                                }
                              })()
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <MaterialAlternatives 
                              materialId={req.raw_material_id} 
                              shortageKg={req.net_shortage_kg} 
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="packaging" className="mt-6">
            <PackagingMaterialsCheck startDate={startDate} endDate={endDate} />
          </TabsContent>
        </Tabs>
    </div>
  );
}
