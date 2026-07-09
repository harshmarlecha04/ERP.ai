import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { formatDistanceET } from "@/utils/dateUtils";

interface ConversationInboxProps {
  inquiries: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationInbox({ inquiries, selectedId, onSelect }: ConversationInboxProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
      case 'in_review':
        return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20';
      case 'responded':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
      case 'closed':
        return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20';
      case 'normal':
        return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
      case 'low':
        return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
    }
  };

  if (inquiries.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No conversations found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {inquiries.map((inquiry) => (
        <div
          key={inquiry.id}
          onClick={() => onSelect(inquiry.id)}
          className={cn(
            "p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md",
            selectedId === inquiry.id ? "border-primary bg-accent" : "hover:bg-accent/50"
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{inquiry.subject}</div>
              <div className="text-sm text-muted-foreground truncate">
                {inquiry.customer_name || inquiry.company_name}
              </div>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceET(inquiry.created_at, { addSuffix: true })}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={getStatusColor(inquiry.status)}>
              {inquiry.status?.replace('_', ' ')}
            </Badge>
            <Badge variant="secondary" className={getUrgencyColor(inquiry.urgency)}>
              {inquiry.urgency}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {inquiry.inquiry_type?.replace('_', ' ')}
            </Badge>
          </div>

          <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {inquiry.message}
          </div>
        </div>
      ))}
    </div>
  );
}
