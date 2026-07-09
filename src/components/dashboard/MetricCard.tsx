import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'destructive';
  className?: string;
  onClick?: () => void;
  trend?: {
    value: number;
    label?: string;
  };
  loading?: boolean;
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'primary',
  className,
  onClick,
  trend,
  loading = false
}: MetricCardProps) {
  const colorConfig = {
    primary: {
      border: 'border-l-primary',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    success: {
      border: 'border-l-success',
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
    },
    warning: {
      border: 'border-l-warning',
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
    },
    destructive: {
      border: 'border-l-destructive',
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="h-3 w-3" />;
    if (trend.value < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value > 0) return 'text-success';
    if (trend.value < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  return (
    <Card 
      className={cn(
        'border-l-4 transition-all duration-300',
        'shadow-sm hover:shadow-lg',
        'bg-card/80 backdrop-blur-sm',
        colorConfig[color].border,
        onClick && 'cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.99]',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className={cn(
            "p-2 rounded-lg transition-colors",
            colorConfig[color].iconBg,
            colorConfig[color].iconColor
          )}>
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            <div className="h-3 w-32 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{value}</span>
              {trend && (
                <span className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  getTrendColor()
                )}>
                  {getTrendIcon()}
                  {Math.abs(trend.value)}%
                  {trend.label && <span className="text-muted-foreground ml-1">{trend.label}</span>}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
                {subtitle}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
