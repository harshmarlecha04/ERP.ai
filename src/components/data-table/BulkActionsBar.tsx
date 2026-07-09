import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionsBarProps {
  count: number;
  onClear: () => void;
  children: ReactNode;
  itemNoun?: string;
  className?: string;
}

/**
 * Sticky bottom toolbar shown when ≥1 row is selected in a list.
 * Provide action Buttons as children (use variant="destructive" for delete).
 */
export function BulkActionsBar({
  count,
  onClear,
  children,
  itemNoun = "item",
  className,
}: BulkActionsBarProps) {
  if (count <= 0) return null;
  const noun = count === 1 ? itemNoun : `${itemNoun}s`;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cn(
        "fixed bottom-4 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-full border bg-popover px-4 py-2 shadow-lg",
        "animate-in fade-in slide-in-from-bottom-2",
        className
      )}
    >
      <span className="text-sm font-medium text-foreground">
        {count} {noun} selected
      </span>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-2">{children}</div>
      <div className="h-4 w-px bg-border" />
      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        aria-label="Clear selection"
        className="h-7 w-7 p-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
