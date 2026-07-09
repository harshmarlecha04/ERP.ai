import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Target, CheckCircle2 } from "lucide-react";

interface ProgressRingWidgetProps {
  title: string;
  description?: string;
  current: number;
  target: number;
  unit?: string;
  color?: 'primary' | 'success' | 'warning' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function ProgressRingWidget({
  title,
  description,
  current,
  target,
  unit = '',
  color = 'primary',
  size = 'md',
  loading = false
}: ProgressRingWidgetProps) {
  const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const isComplete = percentage >= 100;
  
  const sizeConfig = {
    sm: { ring: 80, stroke: 6, text: 'text-lg', subtext: 'text-xs' },
    md: { ring: 120, stroke: 8, text: 'text-2xl', subtext: 'text-sm' },
    lg: { ring: 160, stroke: 10, text: 'text-3xl', subtext: 'text-base' },
  };

  const colorConfig = {
    primary: {
      stroke: 'stroke-primary',
      bg: 'stroke-primary/20',
      text: 'text-primary',
    },
    success: {
      stroke: 'stroke-success',
      bg: 'stroke-success/20',
      text: 'text-success',
    },
    warning: {
      stroke: 'stroke-warning',
      bg: 'stroke-warning/20',
      text: 'text-warning',
    },
    destructive: {
      stroke: 'stroke-destructive',
      bg: 'stroke-destructive/20',
      text: 'text-destructive',
    },
  };

  const config = sizeConfig[size];
  const colors = colorConfig[isComplete ? 'success' : color];
  const radius = (config.ring - config.stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex justify-center">
          <div 
            className="rounded-full bg-muted animate-pulse"
            style={{ width: config.ring, height: config.ring }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {isComplete && (
            <CheckCircle2 className="h-5 w-5 text-success" />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative" style={{ width: config.ring, height: config.ring }}>
          <svg
            width={config.ring}
            height={config.ring}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={config.ring / 2}
              cy={config.ring / 2}
              r={radius}
              fill="none"
              strokeWidth={config.stroke}
              className={colors.bg}
            />
            {/* Progress circle */}
            <circle
              cx={config.ring / 2}
              cy={config.ring / 2}
              r={radius}
              fill="none"
              strokeWidth={config.stroke}
              strokeLinecap="round"
              className={cn(colors.stroke, "transition-all duration-700 ease-out")}
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: strokeDashoffset,
              }}
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-bold", config.text, colors.text)}>
              {percentage.toFixed(0)}%
            </span>
            <span className={cn("text-muted-foreground", config.subtext)}>
              {current.toLocaleString()}{unit} / {target.toLocaleString()}{unit}
            </span>
          </div>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-full", `bg-${color}`)} style={{ backgroundColor: `hsl(var(--${color}))` }} />
            <span className="text-muted-foreground">Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Target: {target.toLocaleString()}{unit}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
