import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardShortcutConfig } from '@/config/dashboardShortcuts';

interface DraggableShortcutCardProps {
  shortcut: DashboardShortcutConfig;
  isCustomizing: boolean;
  isVisible: boolean;
  onToggleVisibility: () => void;
  onClick: () => void;
}

export function DraggableShortcutCard({
  shortcut,
  isCustomizing,
  isVisible,
  onToggleVisibility,
  onClick,
}: DraggableShortcutCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shortcut.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = shortcut.icon;

  const handleClick = () => {
    if (!isCustomizing && !isDragging) {
      onClick();
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleVisibility();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "z-50",
        "transition-transform duration-200"
      )}
    >
      <Card
        onClick={handleClick}
        className={cn(
          "transition-all duration-300 ease-out",
          "bg-card/80 backdrop-blur-sm",
          "shadow-sm hover:shadow-lg",
          !isCustomizing && "cursor-pointer hover:scale-[1.03] hover:-translate-y-1 active:scale-[0.98]",
          isCustomizing && "border-dashed border-2 border-primary/30 cursor-default",
          isDragging && "shadow-2xl scale-105 opacity-95 rotate-1",
          !isVisible && isCustomizing && "opacity-40 grayscale"
        )}
      >
        <CardContent className="p-4 flex items-center gap-3">
          {/* Drag Handle - only visible when customizing */}
          {isCustomizing && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <GripVertical className="h-5 w-5" />
            </div>
          )}

          {/* Icon */}
          <div className={cn(
            "p-2.5 rounded-xl text-white shadow-sm",
            "transition-transform duration-300 group-hover:scale-110",
            shortcut.color
          )}>
            <Icon className="h-5 w-5" />
          </div>

          {/* Label */}
          <span className={cn(
            "font-medium text-sm",
            !isVisible && isCustomizing && "line-through text-muted-foreground"
          )}>
            {shortcut.label}
          </span>

          {/* Visibility Toggle - only when customizing */}
          {isCustomizing && (
            <button
              onClick={handleToggleClick}
              className={cn(
                "ml-auto p-1.5 rounded-md transition-colors",
                isVisible 
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted" 
                  : "text-destructive hover:bg-destructive/10"
              )}
              title={isVisible ? "Hide shortcut" : "Show shortcut"}
            >
              {isVisible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
          )}
        </CardContent>
      </Card>

      {/* Hidden badge */}
      {!isVisible && isCustomizing && (
        <div className="absolute -top-2 -right-2 bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full border">
          Hidden
        </div>
      )}
    </div>
  );
}
