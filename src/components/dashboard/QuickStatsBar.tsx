import React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock, Package, TrendingUp } from "lucide-react";

interface QuickStat {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: 'success' | 'warning' | 'destructive' | 'primary' | 'muted';
  progress?: number;
}

interface QuickStatsBarProps {
  stats?: QuickStat[];
  className?: string;
}

const defaultStats: QuickStat[] = [
  { label: 'Active Orders', value: '—', icon: Package, color: 'primary' },
  { label: 'On Schedule', value: '—', icon: CheckCircle2, color: 'success' },
  { label: 'Pending Review', value: '—', icon: Clock, color: 'warning' },
  { label: 'Critical Alerts', value: '—', icon: AlertTriangle, color: 'destructive' },
];

export function QuickStatsBar({ stats = defaultStats, className }: QuickStatsBarProps) {
  const colorConfig = {
    success: {
      bg: 'bg-success/10',
      text: 'text-success',
      progressBg: 'bg-success',
    },
    warning: {
      bg: 'bg-warning/10',
      text: 'text-warning',
      progressBg: 'bg-warning',
    },
    destructive: {
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      progressBg: 'bg-destructive',
    },
    primary: {
      bg: 'bg-primary/10',
      text: 'text-primary',
      progressBg: 'bg-primary',
    },
    muted: {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      progressBg: 'bg-muted-foreground',
    },
  };

  return (
    <div className={cn(
      "grid grid-cols-2 sm:grid-cols-4 gap-3",
      className
    )}>
      {stats.map((stat, index) => {
        const config = colorConfig[stat.color];
        const Icon = stat.icon;
        
        return (
          <div 
            key={index}
            className={cn(
              "relative overflow-hidden rounded-lg border p-3",
              "bg-card/50 backdrop-blur-sm",
              "transition-all duration-200 hover:shadow-sm hover:border-border/80"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                config.bg
              )}>
                <Icon className={cn("h-4 w-4", config.text)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold truncate">{stat.value}</p>
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
              </div>
            </div>
            
            {stat.progress !== undefined && (
              <div className="mt-2">
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-500", config.progressBg)}
                    style={{ width: `${Math.min(100, Math.max(0, stat.progress))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
