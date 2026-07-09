import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { UserActivity } from '@/hooks/useUserActivity';
import { Database, Clock, MapPin, FileText } from 'lucide-react';
import { formatET } from "@/utils/dateUtils";

interface ActivityDetailsProps {
  activity: UserActivity;
}

export const ActivityDetails = ({ activity }: ActivityDetailsProps) => {
  const formatJsonData = (data: any) => {
    if (!data || typeof data !== 'object') return 'N/A';
    return JSON.stringify(data, null, 2);
  };

  const getDetailValue = (key: string, value: any) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="bg-muted/30 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Basic Information */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Record Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Record ID:</span>
              <Badge variant="outline" className="font-mono text-xs">
                {activity.record_id || 'N/A'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">User ID:</span>
              <Badge variant="outline" className="font-mono text-xs">
                {activity.user_id}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Table:</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {activity.table_name}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Session Information */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Session Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">IP Address:</span>
              <Badge variant="outline" className="font-mono text-xs">
                {activity.ip_address || 'N/A'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Risk Level:</span>
              <Badge 
                variant={activity.risk_level === 'critical' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {activity.risk_level.toUpperCase()}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Timestamp:</span>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {formatET(activity.created_at, "MMM d, yyyy h:mm a")}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Details */}
      {activity.details && Object.keys(activity.details).length > 0 && (
        <>
          <Separator className="my-4" />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Activity Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(activity.details).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground capitalize">
                      {key.replace(/_/g, ' ')}:
                    </span>
                    <div className="text-sm font-mono bg-muted px-2 py-1 rounded max-w-md overflow-auto">
                      {getDetailValue(key, value)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};