import { format, parseISO, isPast } from "date-fns";
import { Calendar, Paperclip, MessageSquare, MoreHorizontal, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { LaunchTask, LaunchStatus, ChecklistItem } from "@/hooks/launch/useLaunch";
import { cn } from "@/lib/utils";

export interface StatusTheme {
  surface: string;       // card background
  accentText: string;    // colored title
  progressDot: string;   // filled dot color
  progressEmpty: string; // empty dot color
  tag: string;           // pill background
  tagText: string;
}

export const STATUS_THEME: Record<LaunchStatus, StatusTheme> = {
  todo: {
    surface: "bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900/40",
    accentText: "text-orange-600 dark:text-orange-400",
    progressDot: "bg-orange-500",
    progressEmpty: "bg-orange-200/70 dark:bg-orange-900/40",
    tag: "bg-orange-100/80 dark:bg-orange-900/40",
    tagText: "text-orange-700 dark:text-orange-300",
  },
  in_progress: {
    surface: "bg-sky-50 dark:bg-sky-950/30 border-sky-100 dark:border-sky-900/40",
    accentText: "text-sky-600 dark:text-sky-400",
    progressDot: "bg-sky-500",
    progressEmpty: "bg-sky-200/70 dark:bg-sky-900/40",
    tag: "bg-sky-100/80 dark:bg-sky-900/40",
    tagText: "text-sky-700 dark:text-sky-300",
  },
  done: {
    surface: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40",
    accentText: "text-emerald-600 dark:text-emerald-400",
    progressDot: "bg-emerald-500",
    progressEmpty: "bg-emerald-200/70 dark:bg-emerald-900/40",
    tag: "bg-emerald-100/80 dark:bg-emerald-900/40",
    tagText: "text-emerald-700 dark:text-emerald-300",
  },
  review: {
    surface: "bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/40",
    accentText: "text-violet-600 dark:text-violet-400",
    progressDot: "bg-violet-500",
    progressEmpty: "bg-violet-200/70 dark:bg-violet-900/40",
    tag: "bg-violet-100/80 dark:bg-violet-900/40",
    tagText: "text-violet-700 dark:text-violet-300",
  },
};

interface Props {
  task: LaunchTask;
  assignees: { id: string; name: string }[];
  attachmentCount?: number;
  commentCount?: number;
  onClick: () => void;
  onDragStart?: () => void;
}

function statusProgress(task: LaunchTask) {
  const list = (task.checklist || []) as ChecklistItem[];
  if (list.length > 0) {
    const done = list.filter((c) => c.done).length;
    return Math.round((done / list.length) * 100);
  }
  switch (task.status) {
    case "todo": return 0;
    case "in_progress": return 50;
    case "review": return 80;
    case "done": return 100;
  }
}

export function ProjectBoardCard({ task, assignees, attachmentCount = 0, commentCount = 0, onClick, onDragStart }: Props) {
  const theme = STATUS_THEME[task.status];
  const tags = task.tags || [];
  const checklist = (task.checklist || []) as ChecklistItem[];
  const percent = statusProgress(task);
  const overdue = task.due_date && task.status !== "done" && isPast(parseISO(task.due_date));

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-3.5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5",
        theme.surface
      )}
    >
      {/* tags + menu */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-md font-medium",
                theme.tag, theme.tagText
              )}
            >
              #{t}
            </span>
          ))}
          {tags.length === 0 && (
            <Badge variant="secondary" className="text-[10px] font-normal h-5 px-1.5">
              {task.phase}
            </Badge>
          )}
        </div>
        <button onClick={(e) => e.stopPropagation()} className="text-muted-foreground/60 hover:text-foreground p-1">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* title */}
      <div className={cn("font-semibold text-[15px] leading-snug mb-2", theme.accentText)}>
        {task.title}
      </div>

      {/* checklist preview */}
      {checklist.length > 0 && (
        <div className="space-y-1 mb-3">
          {checklist.slice(0, 4).map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-xs">
              <Checkbox checked={item.done} disabled className="h-3.5 w-3.5 mt-0.5" />
              <span className={cn("leading-tight", item.done && "line-through text-muted-foreground")}>
                {item.label}
              </span>
            </div>
          ))}
          {checklist.length > 4 && (
            <div className="text-[11px] text-muted-foreground pl-5">
              +{checklist.length - 4} more
            </div>
          )}
        </div>
      )}

      {/* description fallback */}
      {checklist.length === 0 && task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>
      )}

      {/* due date */}
      {task.due_date && (
        <div className={cn(
          "inline-flex items-center gap-1.5 text-[11px] mb-2 px-2 py-0.5 rounded-md bg-background/70",
          overdue ? "text-red-600 font-medium" : "text-muted-foreground"
        )}>
          <Calendar className="h-3 w-3" />
          {format(parseISO(task.due_date), "MMM d")}
        </div>
      )}

      {/* progress */}
      <div className="space-y-1 mb-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Progress</span>
          <span className={cn("font-semibold tabular-nums", theme.accentText)}>{percent}%</span>
        </div>
        <DotProgress percent={percent} theme={theme} />
      </div>

      {/* footer */}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {assignees.slice(0, 3).map((a) => (
            <AvatarBadge key={a.id} name={a.name} />
          ))}
          {assignees.length === 0 && (
            <span className="text-[10px] text-muted-foreground italic">Unassigned</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {checklist.length > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <CheckSquare className="h-3 w-3" />
              {checklist.filter((c) => c.done).length}/{checklist.length}
            </span>
          )}
          <span className="inline-flex items-center gap-0.5">
            <Paperclip className="h-3 w-3" />
            {attachmentCount}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <MessageSquare className="h-3 w-3" />
            {commentCount}
          </span>
        </div>
      </div>
    </div>
  );
}

function DotProgress({ percent, theme }: { percent: number; theme: StatusTheme }) {
  const dots = 14;
  const filled = Math.round((percent / 100) * dots);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: dots }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-sm transition-colors",
            i < filled ? theme.progressDot : theme.progressEmpty
          )}
        />
      ))}
    </div>
  );
}

function AvatarBadge({ name }: { name: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-background">
      {initials}
    </span>
  );
}
