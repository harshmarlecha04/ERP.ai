import { useState } from 'react';
import { CheckSquare, Plus } from 'lucide-react';
import { isToday, isPast } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTasks } from '@/hooks/useTasks';
import { TaskList } from './TaskList';
import { TaskDialog } from './TaskDialog';

export function TodayTasksWidget() {
  const { data: tasks = [], isLoading } = useTasks({ mine: true, status: 'open' });
  const [dialogOpen, setDialogOpen] = useState(false);

  const today = tasks.filter((t) => {
    const due = t.due_at ? new Date(t.due_at) : null;
    return !due || isToday(due) || isPast(due);
  });
  const overdueCount = tasks.filter(
    (t) => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at))
  ).length;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            My Tasks
            {overdueCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px]">
                {overdueCount} overdue
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <TaskList tasks={today.slice(0, 6)} emptyLabel="Nothing on your plate today." />
          )}
        </CardContent>
      </Card>
      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
