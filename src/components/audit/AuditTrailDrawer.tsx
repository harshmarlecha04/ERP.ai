import { useState } from 'react';
import { History } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuditTrail } from '@/hooks/useAuditTrail';
import { formatET } from "@/utils/dateUtils";

interface Props {
  entityType: string;
  entityId: string;
  triggerLabel?: string;
}

function jsonDiff(before: any, after: any): { key: string; from: any; to: any }[] {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: { key: string; from: any; to: any }[] = [];
  keys.forEach((k) => {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      diffs.push({ key: k, from: before[k], to: after[k] });
    }
  });
  return diffs.slice(0, 20);
}

export function AuditTrailDrawer({ entityType, entityId, triggerLabel = 'History' }: Props) {
  const [open, setOpen] = useState(false);
  const { data: events = [], isLoading } = useAuditTrail(entityType, entityId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Audit Trail</SheetTitle>
          <SheetDescription>
            {entityType} · {entityId.slice(0, 8)}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : events.length === 0 ? (
            <div className="text-sm text-muted-foreground">No history yet.</div>
          ) : (
            <div className="space-y-3">
              {events.map((e) => {
                const diffs = jsonDiff(e.before, e.after);
                return (
                  <div key={e.id} className="border rounded-lg p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <Badge
                        variant={
                          e.action === 'create'
                            ? 'default'
                            : e.action === 'delete'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {e.action}
                      </Badge>
                      <span className="text-muted-foreground">
                        {formatET(e.created_at, 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    <div className="text-muted-foreground mb-2">{e.actor_email || 'system'}</div>
                    {e.action === 'update' && diffs.length > 0 && (
                      <div className="space-y-1">
                        {diffs.map((d) => (
                          <div key={d.key} className="grid grid-cols-[100px_1fr] gap-2">
                            <div className="font-medium truncate">{d.key}</div>
                            <div className="text-muted-foreground">
                              <span className="line-through">
                                {JSON.stringify(d.from)?.slice(0, 60) ?? '—'}
                              </span>
                              {' → '}
                              <span className="text-foreground">
                                {JSON.stringify(d.to)?.slice(0, 60) ?? '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
