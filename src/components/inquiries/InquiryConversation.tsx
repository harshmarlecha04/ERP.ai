import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InquiryMessage } from "@/hooks/useInquiryMessages";
import { format } from "date-fns";
import { User, UserCog } from "lucide-react";
import { formatET } from "@/utils/dateUtils";

interface InquiryConversationProps {
  messages: InquiryMessage[];
}

export function InquiryConversation({ messages }: InquiryConversationProps) {
  if (!messages || messages.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No messages yet
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <Card key={message.id} className={message.is_internal_note ? 'border-amber-500/50 bg-amber-500/5' : ''}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${message.sender_type === 'staff' ? 'bg-primary/10' : 'bg-secondary/10'}`}>
                {message.sender_type === 'staff' ? (
                  <UserCog className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{message.sender_name}</span>
                    <Badge variant={message.sender_type === 'staff' ? 'default' : 'secondary'}>
                      {message.sender_type}
                    </Badge>
                    {message.is_internal_note && (
                      <Badge variant="outline" className="border-amber-500 text-amber-500">
                        Internal Note
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatET(message.created_at, 'PPP p')}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                {message.sender_email && (
                  <p className="text-xs text-muted-foreground">{message.sender_email}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
