import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Filter, RefreshCw } from 'lucide-react';

interface ActivityFiltersProps {
  onFilterChange: (filters: {
    search: string;
    activityType: string;
    operation: string;
    riskLevel: string;
    dateRange: string;
  }) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export const ActivityFilters = ({ onFilterChange, onRefresh, loading }: ActivityFiltersProps) => {
  const [search, setSearch] = useState('');
  const [activityType, setActivityType] = useState('all');
  const [operation, setOperation] = useState('all');
  const [riskLevel, setRiskLevel] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  const handleFilterChange = () => {
    onFilterChange({
      search,
      activityType: activityType === 'all' ? '' : activityType,
      operation: operation === 'all' ? '' : operation,
      riskLevel: riskLevel === 'all' ? '' : riskLevel,
      dateRange: dateRange === 'all' ? '' : dateRange
    });
  };

  const clearFilters = () => {
    setSearch('');
    setActivityType('all');
    setOperation('all');
    setRiskLevel('all');
    setDateRange('all');
    onFilterChange({
      search: '',
      activityType: '',
      operation: '',
      riskLevel: '',
      dateRange: ''
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Activity Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users, activities..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handleFilterChange();
              }}
              className="pl-10"
            />
          </div>

          <Select value={activityType} onValueChange={(value) => {
            setActivityType(value);
            const filterValue = value === 'all' ? '' : value;
            onFilterChange({
              search,
              activityType: filterValue,
              operation: operation === 'all' ? '' : operation,
              riskLevel: riskLevel === 'all' ? '' : riskLevel,
              dateRange: dateRange === 'all' ? '' : dateRange
            });
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Activity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="inventory_management">Inventory Management</SelectItem>
              <SelectItem value="lot_management">Lot Management</SelectItem>
              <SelectItem value="procurement">Procurement</SelectItem>
              <SelectItem value="production_planning">Production Planning</SelectItem>
              <SelectItem value="user_management">User Management</SelectItem>
              <SelectItem value="formula_access">Formula Access</SelectItem>
              <SelectItem value="profile_access">Profile Access</SelectItem>
              <SelectItem value="employee_data_access">Employee Data Access</SelectItem>
              <SelectItem value="supplier_access">Supplier Access</SelectItem>
            </SelectContent>
          </Select>

          <Select value={operation} onValueChange={(value) => {
            setOperation(value);
            const filterValue = value === 'all' ? '' : value;
            onFilterChange({
              search,
              activityType: activityType === 'all' ? '' : activityType,
              operation: filterValue,
              riskLevel: riskLevel === 'all' ? '' : riskLevel,
              dateRange: dateRange === 'all' ? '' : dateRange
            });
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Operation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Operations</SelectItem>
              <SelectItem value="INSERT">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
              <SelectItem value="SELECT">View</SelectItem>
            </SelectContent>
          </Select>

          <Select value={riskLevel} onValueChange={(value) => {
            setRiskLevel(value);
            const filterValue = value === 'all' ? '' : value;
            onFilterChange({
              search,
              activityType: activityType === 'all' ? '' : activityType,
              operation: operation === 'all' ? '' : operation,
              riskLevel: filterValue,
              dateRange: dateRange === 'all' ? '' : dateRange
            });
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk Levels</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={(value) => {
            setDateRange(value);
            const filterValue = value === 'all' ? '' : value;
            onFilterChange({
              search,
              activityType: activityType === 'all' ? '' : activityType,
              operation: operation === 'all' ? '' : operation,
              riskLevel: riskLevel === 'all' ? '' : riskLevel,
              dateRange: filterValue
            });
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
          <Button 
            variant="outline" 
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};