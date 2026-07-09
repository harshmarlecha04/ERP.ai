import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface SparklineDataPoint {
  value: number;
  label?: string;
}

interface SparklineMetricCardProps {
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
  sparklineData?: SparklineDataPoint[];
  loading?: boolean;
}

export function SparklineMetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'primary',
  className,
  onClick,
  trend,
  sparklineData = [],
  loading = false
}: SparklineMetricCardProps) {
  const colorConfig = {
    primary: {
      border: 'border-l-primary',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      sparkline: 'hsl(var(--primary))',
    },
    success: {
      border: 'border-l-success',
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
      sparkline: 'hsl(var(--success))',
    },
    warning: {
      border: 'border-l-warning',
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
      sparkline: 'hsl(var(--warning))',
    },
    destructive: {
      border: 'border-l-destructive',
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
      sparkline: 'hsl(var(--destructive))',
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

  const config = colorConfig[color];

  return (
    <Card 
      className={cn(
        'border-l-4 transition-all duration-300 overflow-hidden',
        'shadow-sm hover:shadow-lg',
        'bg-card/80 backdrop-blur-sm',
        config.border,
        onClick && 'cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.99]',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className={cn(
            "p-2 rounded-lg transition-colors",
            config.iconBg,
            config.iconColor
          )}>
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent className="pb-3">
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            <div className="h-10 w-full bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold tracking-tight">{value}</span>
              {trend && (
                <span className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  getTrendColor()
                )}>
                  {getTrendIcon()}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            
            {/* Sparkline */}
            {sparklineData.length > 0 && (
              <div className="h-10 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-md border bg-background px-2 py-1 text-xs shadow-sm">
                              {payload[0].value?.toLocaleString()}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={config.sparkline}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, fill: config.sparkline }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {subtitle}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
