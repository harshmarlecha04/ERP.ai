import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Eye, Edit, CalendarX, Trash2 } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from "date-fns";
import { cn } from "@/lib/utils";
import { parseDateString } from "@/utils/dateUtils";
import { useRescheduleRDVersion } from "@/hooks/useRDProjects";

interface RDProjectsCalendarProps {
  projects: any[];
  onProjectClick: (projectId: string) => void;
  onEdit?: (project: any) => void;
  onDelete?: (project: any) => void;
}

const STATUS_COLORS: Record<string, string> = {
  in_development: "bg-blue-500 text-white",
  pending_approval: "bg-amber-500 text-white",
  approved: "bg-emerald-500 text-white",
  rejected: "bg-rose-500 text-white",
  converted_to_production: "bg-violet-500 text-white",
};

function getStatusColor(status?: string) {
  return STATUS_COLORS[status || ""] || "bg-slate-500 text-white";
}

export function RDProjectsCalendar({ projects, onProjectClick, onEdit, onDelete }: RDProjectsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);
  const [draggedProject, setDraggedProject] = useState<any>(null);
  const reschedule = useRescheduleRDVersion();

  const getProjectsForDate = (date: Date) => {
    const rows: Array<{ project: any; version: any }> = [];
    projects.forEach((p) => {
      const versions: any[] = Array.isArray(p.versions) && p.versions.length > 0
        ? p.versions
        : (p.current_version ? [p.current_version] : []);
      versions.forEach((v) => {
        if (v?.scheduled_date && isSameDay(parseDateString(v.scheduled_date), date)) {
          rows.push({ project: p, version: v });
        }
      });
    });
    return rows;
  };

  const handleDragStart = (e: React.DragEvent, row: { project: any; version: any }) => {
    if (!row.version?.id) return;
    setDraggedProject(row);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    if (!draggedProject) return;
    const versionId = draggedProject.version?.id;
    if (!versionId) {
      setDraggedProject(null);
      return;
    }
    const newDateStr = format(targetDate, "yyyy-MM-dd");
    const currentDateStr = draggedProject.version?.scheduled_date;
    if (newDateStr === currentDateStr) {
      setDraggedProject(null);
      return;
    }
    reschedule.mutate({ versionId, scheduledDate: newDateStr });
    setDraggedProject(null);
  };

  const getDaysForView = () => {
    if (viewMode === "week") {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      });
    }
    const days = eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    });
    const startDay = startOfMonth(currentDate).getDay();
    const padded: Date[] = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(startOfMonth(currentDate));
      d.setDate(d.getDate() - (i + 1));
      padded.push(d);
    }
    padded.push(...days);
    const remaining = 42 - padded.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(endOfMonth(currentDate));
      d.setDate(d.getDate() + i);
      padded.push(d);
    }
    return padded;
  };

  const renderTile = (row: { project: any; version: any }, compact = false) => {
    const project = row.project;
    const v = row.version;
    const label = project.project_name || "Untitled";
    const flavor = v?.flavor;
    const canDrag = !!v?.id;

    return (
      <ContextMenu key={`${project.id}-${v?.id || "none"}`}>
        <ContextMenuTrigger asChild>
          <div
            draggable={canDrag}
            onDragStart={(e) => handleDragStart(e, row)}
            onClick={(e) => {
              e.stopPropagation();
              onProjectClick(project.id);
            }}
            className={cn(
              "p-1.5 rounded text-xs hover:opacity-80 transition-opacity",
              canDrag ? "cursor-move" : "cursor-pointer",
              getStatusColor(v?.status)
            )}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <div className="font-medium line-clamp-1">
                      {label}
                      {v?.version_number ? ` · ${v.version_number}` : ""}
                    </div>
                    <div className="text-[10px] opacity-75 line-clamp-1">{project.customer_name || "—"}</div>
                    {!compact && flavor && (
                      <div className="opacity-90 line-clamp-1">{flavor}</div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm space-y-0.5">
                    <div className="font-medium">{label}</div>
                    <div>#: {project.project_number}</div>
                    <div>Customer: {project.customer_name}</div>
                    {v?.version_number && <div>Version: {v.version_number}</div>}
                    {flavor && <div>Flavor: {flavor}</div>}
                    <div>Status: {v?.status || "—"}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onProjectClick(project.id)}>
            <Eye className="h-4 w-4 mr-2" /> View details
          </ContextMenuItem>
          {onEdit && (
            <ContextMenuItem onClick={() => onEdit(project)}>
              <Edit className="h-4 w-4 mr-2" /> Edit project
            </ContextMenuItem>
          )}
          {v?.id && (
            <ContextMenuItem
              onClick={() => reschedule.mutate({ versionId: v.id, scheduledDate: null })}
            >
              <CalendarX className="h-4 w-4 mr-2" /> Clear scheduled date
            </ContextMenuItem>
          )}
          {onDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => onDelete(project)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete project
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderMonthDay = (date: Date) => {
    const dayProjects = getProjectsForDate(date);
    const isCurrentMonth = isSameMonth(date, currentDate);
    const isToday = isSameDay(date, new Date());

    return (
      <div
        key={date.toISOString()}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, date)}
        className={cn(
          "min-h-[100px] border border-border p-2 flex flex-col",
          dayProjects.length > 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30",
          !isCurrentMonth && "bg-muted/40 text-muted-foreground",
          isToday && "ring-2 ring-primary"
        )}
      >
        <div className="text-sm font-medium mb-2">{format(date, "d")}</div>
        <div className="space-y-1 flex-1">
          {dayProjects.map((p) => renderTile(p, true))}
        </div>
      </div>
    );
  };

  const renderWeekDay = (date: Date) => {
    const dayProjects = getProjectsForDate(date);
    const isToday = isSameDay(date, new Date());

    return (
      <div
        key={date.toISOString()}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, date)}
        className={cn(
          "min-h-[140px] border border-border p-3",
          dayProjects.length > 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30",
          isToday && "ring-2 ring-primary"
        )}
      >
        <div className="mb-3">
          <div className="text-sm text-muted-foreground">{format(date, "EEE")}</div>
          <div className="text-lg font-medium">{format(date, "d")}</div>
        </div>
        <div className="space-y-1">
          {dayProjects.map((p) => renderTile(p))}
        </div>
      </div>
    );
  };

  const days = getDaysForView();

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              R&D Schedule
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  className="rounded-r-none"
                >
                  Month
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  className="rounded-l-none"
                >
                  Week
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentDate(viewMode === "week" ? subWeeks(currentDate, 1) : subMonths(currentDate, 1))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentDate(viewMode === "week" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-2xl font-bold">
            {viewMode === "week"
              ? `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d")} - ${format(
                  endOfWeek(currentDate, { weekStartsOn: 0 }),
                  "MMM d, yyyy"
                )}`
              : format(currentDate, "MMMM yyyy")}
          </div>
          <div className="flex gap-3 text-xs flex-wrap">
            {Object.entries(STATUS_COLORS).map(([k, c]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className={cn("w-3 h-3 rounded", c)} />
                <span className="capitalize">{k.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Drag a project tile to a different day to reschedule. Right-click for more actions.
          </p>
        </CardHeader>
        <CardContent>
          {viewMode === "week" ? (
            <div className="grid grid-cols-1 gap-px bg-border rounded-md overflow-hidden">
              {days.map(renderWeekDay)}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-7 gap-px mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="p-2 text-center font-medium text-sm text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
                {days.map(renderMonthDay)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dayModalDate} onOpenChange={(o) => !o && setDayModalDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dayModalDate ? format(dayModalDate, "EEEE, MMMM d, yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {dayModalDate &&
              getProjectsForDate(dayModalDate).map((p) => renderTile(p))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
