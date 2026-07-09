import React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Breadcrumbs } from "./Breadcrumbs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ChangelogDrawer } from "@/components/changelog/ChangelogDrawer";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { CommandPalette } from "@/components/command/CommandPalette";
import { KeyboardShortcutsDialog } from "@/components/help/KeyboardShortcutsDialog";
import { OnboardingTour, EMPLOYEE_TOUR_STEPS } from "@/components/onboarding/OnboardingTour";
import { ScanFab } from "./ScanFab";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useRecentRouteTracker } from "@/hooks/useRecentItems";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  useRecentRouteTracker();
  useGlobalShortcuts();

  return (
    <SidebarProvider>
      <CommandPalette />
      <OnboardingTour storageKey="pharmvista:tour:employee" version="2026-05-24" steps={EMPLOYEE_TOUR_STEPS} />
      <div className="h-screen flex w-full overflow-hidden">
        <AppSidebar />

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header with toggle button - always visible */}
          <header className="h-12 flex items-center justify-between border-b px-4 shrink-0 bg-background no-print">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 text-muted-foreground hidden sm:flex"
                onClick={() => {
                  const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true });
                  document.dispatchEvent(evt);
                }}
                aria-label="Open command palette"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-xs">Search</span>
                <kbd className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
              </Button>
              <NotificationBell />
              <ChangelogDrawer />
              <KeyboardShortcutsDialog />
              <ThemeToggle />
            </div>
          </header>

          <Breadcrumbs />

          {/* Main content area */}
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
        <ScanFab />
      </div>
    </SidebarProvider>
  );
}
