import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Undo2, ChevronDown, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { UpdateSession } from "@/hooks/useInventoryUpdateSessions";
import { useState } from "react";
import { formatET, formatDistanceET } from "@/utils/dateUtils";

interface UpdateHistorySectionProps {
  sessions: UpdateSession[];
  onUndoSession: (sessionId: string) => void;
  isLoading?: boolean;
}

export const UpdateHistorySection = ({
  sessions,
  onUndoSession,
  isLoading
}: UpdateHistorySectionProps) => {
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Update History</CardTitle>
          <CardDescription>Loading history...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Update History</CardTitle>
          <CardDescription>No recent updates found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Updates</CardTitle>
        <CardDescription className="text-xs">
          View and undo recent updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
        {sessions.map((session) => (
          <div key={session.id} className="border rounded-lg p-2.5 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium">
                    {formatET(session.session_date, "PP")}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {session.item_count}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceET(session.created_at, {
                    addSuffix: true
                  })}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUndoSession(session.id)}
                className="gap-1.5 h-8 px-2"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="text-xs">Undo</span>
              </Button>
            </div>

            {session.items && session.items.length > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSession(session.id)}
                  className="text-xs gap-1 h-7 px-2"
                >
                  {expandedSessions.has(session.id) ? (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-3 w-3" />
                      View {session.items.length}
                    </>
                  )}
                </Button>

                {expandedSessions.has(session.id) && (
                  <div className="mt-1.5 space-y-1 pl-3 text-xs">
                    {session.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {item.item_type}
                        </Badge>
                        <span className="truncate">{item.item_name}</span>
                        <span className="font-medium text-destructive whitespace-nowrap">
                          -{item.quantity_deducted}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
