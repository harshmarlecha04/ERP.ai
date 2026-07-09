import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useUserActivity } from '@/hooks/useUserActivity';
import { ActivityFilters } from '@/components/activity/ActivityFilters';
import { ActivityTable } from '@/components/activity/ActivityTable';
import { Activity, ShieldAlert, Users, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const ActivityTracker = () => {
  const { user } = useAuth();
  const { activities, loading, error, refetch } = useUserActivity();
  const [filters, setFilters] = useState({
    search: '',
    activityType: '',
    operation: '',
    riskLevel: '',
    dateRange: ''
  });

  // Filter activities based on current filters
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!activity.user_display_name.toLowerCase().includes(searchLower) &&
            !activity.user_email.toLowerCase().includes(searchLower) &&
            !activity.activity_type.toLowerCase().includes(searchLower) &&
            !activity.table_name.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Activity type filter
      if (filters.activityType && activity.activity_type !== filters.activityType) {
        return false;
      }

      // Operation filter
      if (filters.operation && activity.operation !== filters.operation) {
        return false;
      }

      // Risk level filter
      if (filters.riskLevel && activity.risk_level !== filters.riskLevel) {
        return false;
      }

      // Date range filter
      if (filters.dateRange) {
        const activityDate = new Date(activity.created_at);
        const now = new Date();
        
        switch (filters.dateRange) {
          case 'today':
            if (activityDate.toDateString() !== now.toDateString()) return false;
            break;
          case 'week':
            if (now.getTime() - activityDate.getTime() > 7 * 24 * 60 * 60 * 1000) return false;
            break;
          case 'month':
            if (now.getTime() - activityDate.getTime() > 30 * 24 * 60 * 60 * 1000) return false;
            break;
          case 'quarter':
            if (now.getTime() - activityDate.getTime() > 90 * 24 * 60 * 60 * 1000) return false;
            break;
        }
      }

      return true;
    });
  }, [activities, filters]);

  // Calculate statistics
  const stats = useMemo(() => {
    const uniqueUsers = new Set(filteredActivities.map(a => a.user_id)).size;
    const highRiskCount = filteredActivities.filter(a => ['high', 'critical'].includes(a.risk_level)).length;
    const recentCount = filteredActivities.filter(a => {
      const activityDate = new Date(a.created_at);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return activityDate > oneDayAgo;
    }).length;

    return {
      totalActivities: filteredActivities.length,
      uniqueUsers,
      highRiskActivities: highRiskCount,
      recentActivities: recentCount
    };
  }, [filteredActivities]);

  // Check access - temporarily allow all authenticated users to see the system working
  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Please log in to view activity tracking data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Tracker</h1>
          <p className="text-muted-foreground">
            Comprehensive user activity monitoring and audit trail ({activities.length} activities tracked)
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Live Monitoring
        </Badge>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActivities}</div>
            <p className="text-xs text-muted-foreground">
              Across all tracked operations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">
              Users with recorded activity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Activities</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.highRiskActivities}</div>
            <p className="text-xs text-muted-foreground">
              High/Critical risk level
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentActivities}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <ActivityFilters 
        onFilterChange={setFilters}
        onRefresh={refetch}
        loading={loading}
      />

      {/* Activity Table */}
      <ActivityTable 
        activities={filteredActivities}
        loading={loading}
      />
    </div>
  );
};

export default ActivityTracker;