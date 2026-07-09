import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  scrollbars?: "vertical" | "horizontal" | "both" | "none";
  alwaysVisible?: boolean;
  viewportClassName?: string;
}

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, children, scrollbars = "vertical", alwaysVisible = false, viewportClassName, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className={cn("h-full w-full rounded-[inherit]", viewportClassName)}>
      {children}
    </ScrollAreaPrimitive.Viewport>
    {(scrollbars === "vertical" || scrollbars === "both") && (
      <ScrollBar orientation="vertical" alwaysVisible={alwaysVisible} />
    )}
    {(scrollbars === "horizontal" || scrollbars === "both") && (
      <ScrollBar orientation="horizontal" alwaysVisible={alwaysVisible} />
    )}
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

interface ScrollBarProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> {
  alwaysVisible?: boolean;
}

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  ScrollBarProps
>(({ className, orientation = "vertical", alwaysVisible = false, ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    forceMount={alwaysVisible ? true : undefined}
    className={cn(
      "flex touch-none select-none transition-colors",
      alwaysVisible && "opacity-100 pointer-events-auto data-[state=hidden]:opacity-100 data-[state=hidden]:pointer-events-auto",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "w-full h-4 flex-col border-t border-t-transparent p-[2px] bg-muted/30",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb 
      className={cn(
        "relative flex-1 rounded-full cursor-grab active:cursor-grabbing",
        orientation === "horizontal" && "min-w-12",
        orientation === "vertical" && "min-h-12",
        alwaysVisible 
          ? "bg-muted-foreground/50 hover:bg-muted-foreground/70" 
          : "bg-border"
      )} 
    />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
