import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateInquiryMessage } from "@/hooks/useInquiryMessages";
import { useUpdateInquiry } from "@/hooks/useInquiries";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { CheckCircle2, MessageSquare, Package, Clock } from "lucide-react";

interface QuickResponseTemplatesProps {
  inquiryId: string;
  inquiry: any;
}

const templates = [
  {
    id: "order_received",
    title: "Order Received",
    icon: CheckCircle2,
    message: (inquiry: any, companyName: string) => `Hi ${inquiry.customer_name},

Thank you for your order inquiry! We have received your request and are currently reviewing the details.

Our team will get back to you within 24 hours with:
- Production timeline
- Pricing confirmation
- Any additional questions

If you have any urgent questions, please don't hesitate to reach out.

Best regards,
${companyName} Team`,
    updateStatus: "in_review",
  },
  {
    id: "order_confirmed",
    title: "Order Confirmed",
    icon: Package,
    message: (inquiry: any, companyName: string) => `Hi ${inquiry.customer_name},

Great news! We're pleased to confirm your order.

Order Details:
- PO Number: [TO BE FILLED]
- Expected Production Date: [TO BE FILLED]
- Estimated Ship Date: [TO BE FILLED]

We'll keep you updated on the progress and notify you when your order ships.

Thank you for your business!

Best regards,
${companyName} Team`,
    updateStatus: "responded",
  },
  {
    id: "in_production",
    title: "In Production",
    icon: Clock,
    message: (inquiry: any, companyName: string) => `Hi ${inquiry.customer_name},

We wanted to update you that your order is now in production!

Current Status:
- Production started: [DATE]
- Expected completion: [DATE]
- Quality testing scheduled

We'll notify you as soon as production is complete and ready for shipment.

Best regards,
${companyName} Team`,
    updateStatus: "responded",
  },
  {
    id: "general_response",
    title: "General Response",
    icon: MessageSquare,
    message: (inquiry: any, companyName: string) => `Hi ${inquiry.customer_name},

Thank you for reaching out! We have received your inquiry regarding: "${inquiry.subject}"

[YOUR RESPONSE HERE]

Please let us know if you have any additional questions.

Best regards,
${companyName} Team`,
    updateStatus: "responded",
  },
];

export function QuickResponseTemplates({ inquiryId, inquiry }: QuickResponseTemplatesProps) {
  const { settings } = useCompanySettings();
  const companyName = settings?.company_name || "Our";
  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null);
  const createMessage = useCreateInquiryMessage();
  const updateInquiry = useUpdateInquiry();
  const { toast } = useToast();

  const handleSendTemplate = async (template: typeof templates[0]) => {
    setSendingTemplate(template.id);

    try {
      // Get current user's display name
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user?.id)
        .single();

      const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Staff';

      // Send the message
      await createMessage.mutateAsync({
        inquiry_id: inquiryId,
        message: template.message(inquiry, companyName),
        sender_type: 'staff',
        sender_name: displayName,
        is_internal_note: false,
      });

      // Update inquiry status if specified
      if (template.updateStatus) {
        await updateInquiry.mutateAsync({
          id: inquiryId,
          status: template.updateStatus as 'new' | 'in_review' | 'responded' | 'converted_to_order' | 'closed',
        });
      }

      toast({
        title: "Template sent!",
        description: `${template.title} template has been sent to the customer.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send template message.",
      });
    } finally {
      setSendingTemplate(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium mb-2">Quick Response Templates</h3>
        <p className="text-sm text-muted-foreground">
          Select a template to quickly respond to this inquiry
        </p>
      </div>

      <div className="grid gap-4">
        {templates.map((template) => {
          const Icon = template.icon;
          return (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {template.title}
                </CardTitle>
                <CardDescription className="text-xs">
                  Will update status to: {template.updateStatus?.replace('_', ' ')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-muted rounded-lg">
                  <pre className="text-sm whitespace-pre-wrap font-sans">
                    {template.message(inquiry, companyName)}
                  </pre>
                </div>
                <Button
                  onClick={() => handleSendTemplate(template)}
                  disabled={sendingTemplate === template.id}
                  className="w-full"
                >
                  {sendingTemplate === template.id ? "Sending..." : "Send This Template"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
