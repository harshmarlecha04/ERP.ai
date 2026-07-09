import { useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight, Eye, AlertTriangle, Shield, Zap } from 'lucide-react';
import { UserActivity } from '@/hooks/useUserActivity';
import { ActivityDetails } from './ActivityDetails';
import { formatET } from "@/utils/dateUtils";

interface ActivityTableProps {
  activities: UserActivity[];
  loading?: boolean;
}

export const ActivityTable = ({ activities, loading }: ActivityTableProps) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getRiskLevelIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'high':
        return <Shield className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Zap className="h-4 w-4 text-yellow-500" />;
      default:
        return <Eye className="h-4 w-4 text-green-500" />;
    }
  };

  const getRiskLevelVariant = (level: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (level) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getActivityTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'inventory_management': 'bg-blue-100 text-blue-800',
      'lot_management': 'bg-green-100 text-green-800',
      'procurement': 'bg-purple-100 text-purple-800',
      'production_planning': 'bg-orange-100 text-orange-800',
      'user_management': 'bg-red-100 text-red-800',
      'formula_access': 'bg-yellow-100 text-yellow-800',
      'profile_access': 'bg-pink-100 text-pink-800',
      'employee_data_access': 'bg-indigo-100 text-indigo-800',
      'supplier_access': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatActivityType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const toggleRowExpansion = (activityId: string) => {
    setExpandedRow(expandedRow === activityId ? null : activityId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>User Activity Log</span>
          <Badge variant="outline">{activities.length} activities</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>User</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No activities found
                  </TableCell>
                </TableRow>
              ) : (
                activities.map((activity) => (
                  <>
                    <TableRow 
                      key={activity.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRowExpansion(activity.id)}
                    >
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          {expandedRow === activity.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{activity.user_display_name}</span>
                          <span className="text-sm text-muted-foreground">{activity.user_email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={getActivityTypeColor(activity.activity_type)}
                        >
                          {formatActivityType(activity.activity_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {activity.operation}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {activity.table_name}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getRiskLevelVariant(activity.risk_level)}
                          className="flex items-center gap-1 w-fit"
                        >
                          {getRiskLevelIcon(activity.risk_level)}
                          {activity.risk_level.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {activity.ip_address || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {formatET(activity.created_at, 'MMM dd, yyyy HH:mm:ss')}
                      </TableCell>
                    </TableRow>
                    {expandedRow === activity.id && (
                      <TableRow>
                        <TableCell colSpan={8} className="p-0">
                          <ActivityDetails activity={activity} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};