import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { usePackagingRequirements } from "@/hooks/usePackagingRequirements";
import { Package, Search, Download, X, CircleDot, Tag, Box, AlertTriangle, Archive } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PackagingMaterialsCheckProps {
  startDate?: string;
  endDate?: string;
}

type StatusFilter = 'all' | 'shortages' | 'order_now' | 'covered';
type SortOption = 'shortage' | 'name' | 'category' | 'required' | 'available';

export function PackagingMaterialsCheck({ startDate: propStartDate, endDate: propEndDate }: PackagingMaterialsCheckProps) {
  // Default to current month if no dates provided
  const defaultStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const defaultEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  
  const [startDate, setStartDate] = useState(propStartDate || defaultStart);
  const [endDate, setEndDate] = useState(propEndDate || defaultEnd);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('shortage');

  useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
    if (propEndDate) setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  const { data, isLoading } = usePackagingRequirements(startDate, endDate);
  const requirements = data?.requirements || [];
  const summary = data?.summary;

  // Filter and sort requirements
  const filteredRequirements = useMemo(() => {
    let filtered = [...requirements];

    // Apply status filter
    if (statusFilter === 'shortages') {
      filtered = filtered.filter(r => r.shortage > 0);
    } else if (statusFilter === 'order_now') {
      filtered = filtered.filter(r => r.shortage > 0 && r.required > 0);
    } else if (statusFilter === 'covered') {
      filtered = filtered.filter(r => r.required > 0 && r.shortage === 0);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.item_name?.toLowerCase().includes(query) ||
        r.category?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.item_name || '').localeCompare(b.item_name || '');
        case 'category':
          return a.category.localeCompare(b.category);
        case 'shortage':
          // Sort by shortage: biggest shortage first
          return b.shortage - a.shortage;
        case 'required':
          return b.required - a.required;
        case 'available':
          return b.on_hand - a.on_hand;
        default:
          return 0;
      }
    });

    return filtered;
  }, [requirements, statusFilter, searchQuery, sortBy]);

  const hasActiveFilters = statusFilter !== 'all' || searchQuery.trim() !== '';

  const clearFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
  };

  const exportToCSV = () => {
    const headers = [
      'Category',
      'Item Name',
      'Scheduled Packaging',
      'Required',
      'Available',
      'Shortage',
      'Status'
    ];

    const rows = filteredRequirements.map(req => [
      req.category,
      req.item_name,
      req.used_by.join('; ') || 'None',
      req.required.toString(),
      req.on_hand.toString(),
      req.shortage.toString(),
      req.shortage > 0 ? 'Shortage' : 'OK'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `packaging-requirements-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('Packaging requirements exported to CSV');
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'BOTTLES':
        return <Package className="h-4 w-4" />;
      case 'CAPS':
        return <CircleDot className="h-4 w-4" />;
      case 'LABELS':
        return <Tag className="h-4 w-4" />;
      case 'CORRUGATED':
        return <Box className="h-4 w-4" />;
      case 'POUCHES':
        return <Archive className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      'BOTTLES': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'CAPS': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'LABELS': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      'CORRUGATED': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'POUCHES': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    };
    return (
      <Badge variant="secondary" className={`gap-1 ${colors[category] || ''}`}>
        {getCategoryIcon(category)}
        {category.charAt(0) + category.slice(1).toLowerCase()}
      </Badge>
    );
  };

  const formatSummaryCard = (cat: { required: number; onHand: number; shortage: number }) => {
    if (cat.required === 0) {
      return `${cat.onHand.toLocaleString()} on hand`;
    }
    return `${cat.required.toLocaleString()} req • ${cat.onHand.toLocaleString()} on hand`;
  };

  const totalRequirements = requirements.length;
  const shortageCount = requirements.filter(r => r.shortage > 0).length;

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="pkg-start-date">Start Date</Label>
              <Input
                id="pkg-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="pkg-end-date">End Date</Label>
              <Input
                id="pkg-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1.5"
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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Bottles"
          value={summary?.bottles.shortage ? `-${summary.bottles.shortage.toLocaleString()}` : summary?.bottles.onHand.toLocaleString() || '0'}
          subtitle={formatSummaryCard(summary?.bottles || { required: 0, onHand: 0, shortage: 0 })}
          icon={<Package className="h-4 w-4" />}
          color={summary?.bottles.shortage ? "destructive" : "primary"}
        />
        <MetricCard
          title="Caps"
          value={summary?.caps.shortage ? `-${summary.caps.shortage.toLocaleString()}` : summary?.caps.onHand.toLocaleString() || '0'}
          subtitle={formatSummaryCard(summary?.caps || { required: 0, onHand: 0, shortage: 0 })}
          icon={<CircleDot className="h-4 w-4" />}
          color={summary?.caps.shortage ? "destructive" : "primary"}
        />
        <MetricCard
          title="Labels"
          value={summary?.labels.shortage ? `-${summary.labels.shortage.toLocaleString()}` : summary?.labels.onHand.toLocaleString() || '0'}
          subtitle={formatSummaryCard(summary?.labels || { required: 0, onHand: 0, shortage: 0 })}
          icon={<Tag className="h-4 w-4" />}
          color={summary?.labels.shortage ? "destructive" : "primary"}
        />
        <MetricCard
          title="Corrugated"
          value={summary?.corrugated.shortage ? `-${summary.corrugated.shortage.toLocaleString()}` : summary?.corrugated.onHand.toLocaleString() || '0'}
          subtitle={formatSummaryCard(summary?.corrugated || { required: 0, onHand: 0, shortage: 0 })}
          icon={<Box className="h-4 w-4" />}
          color={summary?.corrugated.shortage ? "destructive" : "primary"}
        />
        <MetricCard
          title="Pouches"
          value={summary?.pouches.shortage ? `-${summary.pouches.shortage.toLocaleString()}` : summary?.pouches.onHand.toLocaleString() || '0'}
          subtitle={formatSummaryCard(summary?.pouches || { required: 0, onHand: 0, shortage: 0 })}
          icon={<Archive className="h-4 w-4" />}
          color={summary?.pouches.shortage ? "destructive" : "primary"}
        />
        <MetricCard
          title="Shortages"
          value={summary?.shortageCount || 0}
          subtitle="Items need ordering"
          icon={<AlertTriangle className="h-4 w-4" />}
          color="destructive"
        />
      </div>

      {/* Requirements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Packaging Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4 items-end border-b pb-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search-packaging">Search</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-packaging"
                  placeholder="Search by item name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="min-w-[180px]">
              <Label htmlFor="status-filter">Status Filter</Label>
              <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                <SelectTrigger id="status-filter" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Scheduled Items</SelectItem>
                  <SelectItem value="shortages">Shortages Only</SelectItem>
                  <SelectItem value="order_now">Order Now</SelectItem>
                  <SelectItem value="covered">Fully Covered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[180px]">
              <Label htmlFor="sort-by">Sort By</Label>
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger id="sort-by" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shortage">Shortage Amount</SelectItem>
                  <SelectItem value="name">Item Name</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="required">Required Quantity</SelectItem>
                  <SelectItem value="available">Available Quantity</SelectItem>
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
            Showing <span className="font-medium">{filteredRequirements.length}</span> of <span className="font-medium">{totalRequirements}</span> items
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading packaging requirements...
            </div>
          ) : filteredRequirements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {requirements.length === 0 
                ? "No packaging scheduled in this date range"
                : "No items match the current filters"}
            </div>
          ) : (
            (() => {
              const categoryOrder = ['BOTTLES', 'CAPS', 'LABELS', 'CORRUGATED', 'POUCHES'];
              const grouped = filteredRequirements.reduce((acc, req) => {
                (acc[req.category] = acc[req.category] || []).push(req);
                return acc;
              }, {} as Record<string, typeof filteredRequirements>);
              const orderedCategories = [
                ...categoryOrder.filter(c => grouped[c]?.length),
                ...Object.keys(grouped).filter(c => !categoryOrder.includes(c)),
              ];

              return (
                <div className="space-y-6">
                  {orderedCategories.map((category) => {
                    const items = grouped[category];
                    const catRequired = items.reduce((s, r) => s + r.required, 0);
                    const catOnHand = items.reduce((s, r) => s + r.on_hand, 0);
                    const catShortage = items.reduce((s, r) => s + r.shortage, 0);

                    return (
                      <div key={category} className="border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between bg-muted/60 px-4 py-2 border-b">
                          <div className="flex items-center gap-2">
                            {getCategoryBadge(category)}
                            <span className="text-sm text-muted-foreground">
                              {items.length} item{items.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">
                              Req: <span className="font-semibold text-foreground">{catRequired.toLocaleString()}</span>
                            </span>
                            <span className="text-muted-foreground">
                              On hand: <span className="font-semibold text-foreground">{catOnHand.toLocaleString()}</span>
                            </span>
                            {catShortage > 0 && (
                              <span className="text-destructive font-semibold">
                                Short: {catShortage.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/30">
                                <th className="text-left p-2 pl-4 w-[38%]">Item Name</th>
                                <th className="text-center p-2">Scheduled Packaging</th>
                                <th className="text-right p-2">Required</th>
                                <th className="text-right p-2">Available</th>
                                <th className="text-right p-2 pr-4">Still Needed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((req) => {
                                const hasShortage = req.shortage > 0;
                                return (
                                  <tr
                                    key={req.id}
                                    className={`border-b last:border-0 hover:bg-muted/40 ${hasShortage ? 'bg-destructive/5' : ''}`}
                                  >
                                    <td className="p-2 pl-4 font-medium">{req.item_name}</td>
                                    <td className="p-2 text-center">
                                      {req.used_by.length > 0 ? (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-auto py-1 px-2">
                                              <Badge variant="secondary" className="cursor-pointer">
                                                {req.used_by.length} schedule{req.used_by.length !== 1 ? 's' : ''}
                                              </Badge>
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-56 p-2">
                                            <div className="space-y-1">
                                              <p className="text-xs font-medium text-muted-foreground mb-2">Scheduled Packaging:</p>
                                              {req.used_by.map((order, idx) => (
                                                <div key={idx} className="text-sm">{order}</div>
                                              ))}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="p-2 text-right tabular-nums">
                                      {req.required > 0 ? req.required.toLocaleString() : '—'}
                                    </td>
                                    <td className="p-2 text-right tabular-nums font-semibold">
                                      {req.on_hand.toLocaleString()}
                                    </td>
                                    <td className="p-2 pr-4 text-right tabular-nums font-semibold">
                                      {hasShortage ? (
                                        <span className="text-destructive">{req.shortage.toLocaleString()}</span>
                                      ) : req.required > 0 ? (
                                        <span className="text-green-600 text-lg">✓</span>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>
    </div>
  );
}
