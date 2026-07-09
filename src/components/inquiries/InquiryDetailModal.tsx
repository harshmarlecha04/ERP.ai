import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInquiry, useUpdateInquiry } from "@/hooks/useInquiries";
import { useInquiryMessages } from "@/hooks/useInquiryMessages";
import { useInquiryOrderDetails } from "@/hooks/useInquiryOrderDetails";
import { InquiryConversation } from "./InquiryConversation";
import { InquiryResponseForm } from "./InquiryResponseForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Mail, Phone, Building, Calendar, Package, AlertCircle } from "lucide-react";
import { formatET } from "@/utils/dateUtils";

interface InquiryDetailModalProps {
  inquiryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InquiryDetailModal({ inquiryId, open, onOpenChange }: InquiryDetailModalProps) {
  const { data: inquiry, isLoading } = useInquiry(inquiryId);
  const { data: messages } = useInquiryMessages(inquiryId);
  const { data: orderDetails } = useInquiryOrderDetails(inquiryId);
  const updateInquiry = useUpdateInquiry();
  const [isResponding, setIsResponding] = useState(false);

  if (isLoading || !inquiry) {
    return null;
  }

  const handleStatusChange = (status: string) => {
    updateInquiry.mutate({ id: inquiryId, status: status as any });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      new_order: 'New Order',
      order_status: 'Order Status',
      product_question: 'Product Question',
      pricing: 'Pricing',
      general: 'General',
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">
              Inquiry {inquiry.inquiry_number}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Select value={inquiry.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[180px]">
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
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">Name:</span>
                    <span>{inquiry.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{inquiry.customer_email}</span>
                  </div>
                  {inquiry.customer_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{inquiry.customer_phone}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {inquiry.company_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{inquiry.company_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatET(inquiry.created_at, 'PPP')}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inquiry Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Inquiry Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge>{getTypeLabel(inquiry.inquiry_type)}</Badge>
                <Badge variant={inquiry.urgency === 'urgent' ? 'destructive' : 'secondary'}>
                  {inquiry.urgency}
                </Badge>
              </div>
              <div>
                <p className="font-semibold mb-2">Subject:</p>
                <p>{inquiry.subject}</p>
              </div>
              <Separator />
              <div>
                <p className="font-semibold mb-2">Message:</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {inquiry.message}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Order Details if applicable */}
          {inquiry.inquiry_type === 'new_order' && orderDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {orderDetails.product_name && (
                    <div>
                      <span className="font-semibold">Product:</span> {orderDetails.product_name}
                    </div>
                  )}
                  {orderDetails.formula_code && (
                    <div>
                      <span className="font-semibold">Formula Code:</span> {orderDetails.formula_code}
                    </div>
                  )}
                  {orderDetails.quantity && (
                    <div>
                      <span className="font-semibold">Quantity:</span> {orderDetails.quantity} bottles
                    </div>
                  )}
                  {orderDetails.bottle_size && (
                    <div>
                      <span className="font-semibold">Bottle Size:</span> {orderDetails.bottle_size} count
                    </div>
                  )}
                  {orderDetails.order_type && (
                    <div>
                      <span className="font-semibold">Type:</span> {orderDetails.order_type}
                    </div>
                  )}
                  {orderDetails.preferred_delivery_date && (
                    <div>
                      <span className="font-semibold">Preferred Delivery:</span>{' '}
                      {formatET(orderDetails.preferred_delivery_date, 'PPP')}
                    </div>
                  )}
                  {orderDetails.special_requirements && (
                    <div className="col-span-2">
                      <span className="font-semibold">Special Requirements:</span>
                      <p className="mt-1 text-muted-foreground">{orderDetails.special_requirements}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conversation & Response */}
          <Tabs defaultValue="conversation" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="conversation">Conversation</TabsTrigger>
              <TabsTrigger value="respond">Respond</TabsTrigger>
            </TabsList>
            
            <TabsContent value="conversation" className="mt-4">
              <InquiryConversation messages={messages || []} />
            </TabsContent>
            
            <TabsContent value="respond" className="mt-4">
              <InquiryResponseForm 
                inquiryId={inquiryId}
                onSuccess={() => {
                  setIsResponding(false);
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
