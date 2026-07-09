import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Filter, CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface OrderFilters {
  status: string;
  dueDateRange: string;
  createdFrom: Date | undefined;
  createdTo: Date | undefined;
  customers: string[];
}

export const defaultFilters: OrderFilters = {
  status: 'all',
  dueDateRange: 'all',
  createdFrom: undefined,
  createdTo: undefined,
  customers: [],
};

interface AdvancedOrderFiltersProps {
  filters: OrderFilters;
  onChange: (filters: OrderFilters) => void;
  customerOptions: { id: string; name: string }[];
}

export function AdvancedOrderFilters({ filters, onChange, customerOptions }: AdvancedOrderFiltersProps) {
  const [open, setOpen] = useState(false);

  const activeCount = [
    filters.status !== 'all',
    filters.dueDateRange !== 'all',
    !!filters.createdFrom || !!filters.createdTo,
    filters.customers.length > 0,
  ].filter(Boolean).length;

  const update = (patch: Partial<OrderFilters>) => onChange({ ...filters, ...patch });

  const clearAll = () => onChange({ ...defaultFilters });

  const toggleCustomer = (id: string) => {
    const next = filters.customers.includes(id)
      ? filters.customers.filter(c => c !== id)
      : [...filters.customers, id];
    update({ customers: next });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <Badge variant="default" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
              {activeCount}
            </Badge>
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/30 p-4">
          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={filters.status} onValueChange={v => update({ status: v })}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due Date Range */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
            <Select value={filters.dueDateRange} onValueChange={v => update({ dueDateRange: v })}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="this_week">Due This Week</SelectItem>
                <SelectItem value="this_month">Due This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Created From */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Created From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal h-9", !filters.createdFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {filters.createdFrom ? format(filters.createdFrom, 'MMM dd') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filters.createdFrom} onSelect={d => update({ createdFrom: d })} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Created To */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Created To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal h-9", !filters.createdTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {filters.createdTo ? format(filters.createdTo, 'MMM dd') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filters.createdTo} onSelect={d => update({ createdTo: d })} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Customer multi-select as badges */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Customer</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 min-w-[140px] justify-start">
                  {filters.customers.length > 0 ? `${filters.customers.length} selected` : 'All'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 max-h-60 overflow-y-auto" align="start">
                {customerOptions.map(c => (
                  <button
                    key={c.id}
                    onClick={() => toggleCustomer(c.id)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent",
                      filters.customers.includes(c.id) && "bg-accent font-medium"
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Clear All */}
          {activeCount > 0 && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-muted-foreground">
                <X className="h-3.5 w-3.5 mr-1" /> Clear All
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
