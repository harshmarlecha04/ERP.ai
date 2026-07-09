import { format, isPast, isToday } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil } from 'lucide-react';
import { Task, useTasks } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { useProfiles } from '@/hooks/useProfiles';

interface Props {
  tasks: Task[];
  onEdit?: (t: Task) => void;
  emptyLabel?: string;
}

const priorityColor: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-600 border-red-200',
  high: 'bg-amber-500/10 text-amber-600 border-amber-200',
  normal: 'bg-blue-500/10 text-blue-600 border-blue-200',
  low: 'bg-muted text-muted-foreground',
};

export function TaskList({ tasks, onEdit, emptyLabel = 'No tasks' }: Props) {
  const { update, remove } = useTasks();
  const { data: profiles = [] } = useProfiles();
  const profileMap = new Map(profiles.map((p) => [p.id, p.display_name || p.full_name || p.email]));

  if (!tasks.length) {
    return <div className="text-sm text-muted-foreground py-6 text-center">{emptyLabel}</div>;
  }

  return (
    <div className="divide-y border rounded-lg">
      {tasks.map((t) => {
        const due = t.due_at ? new Date(t.due_at) : null;
        const overdue = due && isPast(due) && t.status !== 'done';
        const dueToday = due && isToday(due);
        return (
          <div key={t.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-accent/30 group">
            <Checkbox
              checked={t.status === 'done'}
              onCheckedChange={(v) =>
                update.mutate({ id: t.id, patch: { status: v ? 'done' : 'open' } })
              }
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  'text-sm font-medium',
                  t.status === 'done' && 'line-through text-muted-foreground'
                )}
              >
                {t.title}
              </div>
              {t.description && (
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {t.description}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge variant="outline" className={cn('text-[10px]', priorityColor[t.priority])}>
                  {t.priority}
                </Badge>
                {t.assignee_id && (
                  <span className="text-[11px] text-muted-foreground">
                    {profileMap.get(t.assignee_id) || 'Unknown'}
                  </span>
                )}
                {due && (
                  <span
                    className={cn(
                      'text-[11px]',
                      overdue ? 'text-red-600 font-medium' : dueToday ? 'text-amber-600' : 'text-muted-foreground'
                    )}
                  >
                    {format(due, 'MMM d, h:mm a')}
                    {overdue && ' · overdue'}
                  </span>
                )}
                {t.related_entity_type && (
                  <Badge variant="secondary" className="text-[10px]">
                    {t.related_entity_type}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
              {onEdit && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => remove.mutate(t.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
