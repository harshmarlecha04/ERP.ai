import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TableLoadingSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableLoadingSkeleton({ 
  rows = 5, 
  cols = 4,
  className 
}: TableLoadingSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Header row */}
      <div className="flex gap-4 pb-2 border-b">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={`header-${j}`} className="h-8 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`row-${i}`} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={`cell-${i}-${j}`} className="h-12 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface CardLoadingSkeletonProps {
  showDescription?: boolean;
  className?: string;
}

export function CardLoadingSkeleton({ 
  showDescription = true,
  className 
}: CardLoadingSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-1/3" />
        {showDescription && <Skeleton className="h-4 w-2/3 mt-1" />}
      </CardHeader>
      <CardContent>
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

interface DashboardLoadingSkeletonProps {
  cards?: number;
  className?: string;
}

export function DashboardLoadingSkeleton({ 
  cards = 4,
  className 
}: DashboardLoadingSkeletonProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: cards }).map((_, i) => (
        <CardLoadingSkeleton key={i} />
      ))}
    </div>
  );
}

interface PageLoadingSkeletonProps {
  showHeader?: boolean;
  showFilters?: boolean;
  tableRows?: number;
  tableCols?: number;
  className?: string;
}

export function PageLoadingSkeleton({
  showHeader = true,
  showFilters = true,
  tableRows = 8,
  tableCols = 5,
  className
}: PageLoadingSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      )}
      
      {showFilters && (
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
      )}
      
      <Card>
        <CardContent className="pt-6">
          <TableLoadingSkeleton rows={tableRows} cols={tableCols} />
        </CardContent>
      </Card>
    </div>
  );
}

interface FormLoadingSkeletonProps {
  fields?: number;
  className?: string;
}

export function FormLoadingSkeleton({
  fields = 4,
  className
}: FormLoadingSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex gap-2 pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

interface MetricCardLoadingSkeletonProps {
  className?: string;
}

export function MetricCardLoadingSkeleton({ className }: MetricCardLoadingSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}
