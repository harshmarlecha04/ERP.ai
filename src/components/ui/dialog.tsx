import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 grid place-items-center overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  preventClose?: boolean;
}

// Helper to check if an event target is inside a Radix portal (Popover, Select, DropdownMenu, etc.)
const isInsideRadixPortal = (target: EventTarget | null): boolean => {
  if (target instanceof Element) {
    return !!(
      target.closest('[data-radix-popper-content-wrapper]') ||
      target.closest('[data-radix-portal]')
    );
  }
  return false;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, preventClose, onInteractOutside, onPointerDownOutside, onFocusOutside, onEscapeKeyDown, ...props }, ref) => {
  // Handlers that ignore interactions inside Radix portals (so Popovers/Selects inside dialogs work)
  const handleInteractOutside: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>['onInteractOutside'] = (e) => {
    if (preventClose) {
      e.preventDefault();
      return;
    }
    if (isInsideRadixPortal(e.target)) {
      e.preventDefault();
      return;
    }
    onInteractOutside?.(e);
  };

  const handlePointerDownOutside: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>['onPointerDownOutside'] = (e) => {
    if (preventClose) {
      e.preventDefault();
      return;
    }
    if (isInsideRadixPortal(e.target)) {
      e.preventDefault();
      return;
    }
    onPointerDownOutside?.(e);
  };

  // Unconditionally prevent dialog from stealing focus back — this is safe because
  // Tab-trapping, overlay blocking, and dismiss-on-click are all separate mechanisms.
  const handleFocusOutside: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>['onFocusOutside'] = (e) => {
    e.preventDefault();
  };

  return (
    <DialogPortal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-50 bg-black/80 grid justify-center items-start sm:items-center overflow-y-auto py-8 px-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      >
        <DialogPrimitive.Content
          ref={ref}
          onInteractOutside={handleInteractOutside}
          onPointerDownOutside={handlePointerDownOutside}
          onFocusOutside={handleFocusOutside}
          onEscapeKeyDown={preventClose ? (e) => e.preventDefault() : onEscapeKeyDown}
          className={cn(
            "relative z-50 grid w-full min-w-0 overflow-x-hidden gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
            className
          )}
          style={{ maxWidth: 'min(var(--dialog-max-width, 32rem), calc(100vw - 2rem))', ...props.style }}
          {...props}
        >
          {children}
          {!preventClose && (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
