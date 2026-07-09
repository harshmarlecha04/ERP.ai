import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
  minWidth?: string;
  maxHeight?: string;
}

/**
 * A responsive table wrapper that provides horizontal scrolling on mobile
 * and smaller screens while maintaining full functionality on larger screens.
 */
export function ResponsiveTable({ 
  children, 
  className,
  minWidth = "600px",
  maxHeight
}: ResponsiveTableProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <ScrollArea 
        className={cn("w-full rounded-md border", maxHeight && `max-h-[${maxHeight}]`)} 
        scrollbars="horizontal" 
        alwaysVisible
      >
        <Table className={cn(`min-w-[${minWidth}]`, className)}>
          {children}
        </Table>
      </ScrollArea>
    );
  }

  return (
    <div className={cn("rounded-md border overflow-auto", maxHeight && `max-h-[${maxHeight}]`)}>
      <Table className={className}>
        {children}
      </Table>
    </div>
  );
}

interface ResponsiveTableContainerProps {
  children: React.ReactNode;
  className?: string;
  scrollbars?: "horizontal" | "vertical" | "both";
  alwaysVisible?: boolean;
  maxHeight?: string;
}

/**
 * A container for tables that need scroll functionality regardless of screen size.
 * Useful for tables with many columns that always need horizontal scroll.
 */
export function ResponsiveTableContainer({
  children,
  className,
  scrollbars = "both",
  alwaysVisible = true,
  maxHeight = "calc(100vh - 300px)"
}: ResponsiveTableContainerProps) {
  return (
    <ScrollArea 
      className={cn("rounded-md border", className)}
      style={{ maxHeight }}
      scrollbars={scrollbars}
      alwaysVisible={alwaysVisible}
    >
      {children}
    </ScrollArea>
  );
}

export default ResponsiveTable;
