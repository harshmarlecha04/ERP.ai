import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ScheduleItem {
  id: string;
  product: string;
  batches: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'delayed';
}

interface ScheduleCardProps {
  title: string;
  schedule: Record<string, ScheduleItem[]>;
}

export function ScheduleCard({ title, schedule }: ScheduleCardProps) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'in-progress': return 'bg-primary text-primary-foreground';
      case 'delayed': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {days.map((day) => (
            <div key={day} className="border-l-2 border-muted pl-4">
              <h4 className="font-medium text-sm mb-2">{day}</h4>
              <div className="space-y-2">
                {schedule[day]?.length > 0 ? (
                  schedule[day].map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.product}</p>
                        <p className="text-xs text-muted-foreground">{item.batches} batches</p>
                      </div>
                      <Badge className={getStatusColor(item.status)}>
                        {item.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic">No items scheduled</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}