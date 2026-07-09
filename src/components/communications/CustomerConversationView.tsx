import { useInquiry, useUpdateInquiry } from "@/hooks/useInquiries";
import { useInquiryMessages } from "@/hooks/useInquiryMessages";
import { useInquiryOrderDetails } from "@/hooks/useInquiryOrderDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InquiryConversation } from "@/components/inquiries/InquiryConversation";
import { InquiryResponseForm } from "@/components/inquiries/InquiryResponseForm";
import { QuickResponseTemplates } from "./QuickResponseTemplates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, Building2, Package, Calendar, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { formatET } from "@/utils/dateUtils";

interface CustomerConversationViewProps {
  inquiryId: string;
}

export function CustomerConversationView({ inquiryId }: CustomerConversationViewProps) {
  const { data: inquiry, isLoading: inquiryLoading } = useInquiry(inquiryId);
  const { data: messages, isLoading: messagesLoading } = useInquiryMessages(inquiryId);
  const { data: orderDetails } = useInquiryOrderDetails(inquiryId);
  const updateInquiry = useUpdateInquiry();

  const handleStatusChange = (newStatus: string) => {
    updateInquiry.mutate({
      id: inquiryId,
      status: newStatus as 'new' | 'in_review' | 'responded' | 'converted_to_order' | 'closed',
    });
  };

  if (inquiryLoading || messagesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Inquiry not found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{inquiry.customer_name}</span>
          </div>
          {inquiry.company_name && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{inquiry.company_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <a href={`mailto:${inquiry.customer_email}`} className="text-primary hover:underline">
              {inquiry.customer_email}
            </a>
          </div>
          {inquiry.customer_phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${inquiry.customer_phone}`} className="text-primary hover:underline">
                {inquiry.customer_phone}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inquiry Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Inquiry Details</CardTitle>
            <Select value={inquiry.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
                <SelectItem value="converted_to_order">Converted to Order</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Type & Urgency</div>
            <div className="flex gap-2">
              <Badge variant="outline">{inquiry.inquiry_type?.replace('_', ' ')}</Badge>
              <Badge
                variant={inquiry.urgency === 'urgent' ? 'destructive' : 'secondary'}
              >
                {inquiry.urgency}
              </Badge>
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Subject</div>
            <div className="font-medium">{inquiry.subject}</div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Message</div>
            <div className="text-sm">{inquiry.message}</div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Submitted</div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-3 w-3" />
              {formatET(inquiry.created_at, 'PPP p')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Details (if applicable) */}
      {inquiry.inquiry_type === 'new_order' && orderDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-4 w-4" />
              Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {orderDetails.po_number && (
              <div>
                <span className="text-sm text-muted-foreground">PO Number: </span>
                <span className="font-medium">{orderDetails.po_number}</span>
              </div>
            )}
            {orderDetails.product_name && (
              <div>
                <span className="text-sm text-muted-foreground">Product: </span>
                <span>{orderDetails.product_name}</span>
              </div>
            )}
            {orderDetails.quantity && (
              <div>
                <span className="text-sm text-muted-foreground">Quantity: </span>
                <span>{orderDetails.quantity} bottles</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Conversation & Response */}
      <Tabs defaultValue="conversation" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="conversation" className="flex-1">
            Conversation ({messages?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="respond" className="flex-1">
            Respond
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex-1">
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversation" className="mt-4">
          <InquiryConversation messages={messages || []} />
        </TabsContent>

        <TabsContent value="respond" className="mt-4">
          <InquiryResponseForm
            inquiryId={inquiryId}
            onSuccess={() => {
              // Optionally switch to conversation tab after sending
            }}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <QuickResponseTemplates inquiryId={inquiryId} inquiry={inquiry} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
