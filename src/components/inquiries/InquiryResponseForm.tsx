import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useCreateInquiryMessage } from "@/hooks/useInquiryMessages";
import { useUpdateInquiry } from "@/hooks/useInquiries";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const responseSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(5000),
  is_internal_note: z.boolean(),
  update_status: z.boolean(),
});

type ResponseFormData = z.infer<typeof responseSchema>;

interface InquiryResponseFormProps {
  inquiryId: string;
  onSuccess?: () => void;
}

export function InquiryResponseForm({ inquiryId, onSuccess }: InquiryResponseFormProps) {
  const { user } = useAuth();
  const [userName, setUserName] = useState('Staff Member');
  const createMessage = useCreateInquiryMessage();
  const updateInquiry = useUpdateInquiry();

  useEffect(() => {
    if (user?.id) {
      supabase
        .from('profiles')
        .select('display_name, full_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserName(data.display_name || data.full_name || 'Staff Member');
          }
        });
    }
  }, [user?.id]);

  const form = useForm<ResponseFormData>({
    resolver: zodResolver(responseSchema),
    defaultValues: {
      message: '',
      is_internal_note: false,
      update_status: true,
    },
  });

  const isInternalNote = form.watch('is_internal_note');

  const onSubmit = async (data: ResponseFormData) => {
    try {
      // Create the message
      await createMessage.mutateAsync({
        inquiry_id: inquiryId,
        message: data.message,
        sender_type: 'staff',
        sender_name: userName,
        sender_email: user?.email,
        is_internal_note: data.is_internal_note,
      });

      // Update inquiry status if not an internal note and update_status is checked
      if (!data.is_internal_note && data.update_status) {
        await updateInquiry.mutateAsync({
          id: inquiryId,
          status: 'responded',
        });
      }

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting response:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {isInternalNote ? 'Internal Note' : 'Response to Customer'}
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder={isInternalNote ? "Add an internal note (not visible to customer)..." : "Type your response to the customer..."}
                  rows={8}
                  className={isInternalNote ? 'border-amber-500/50 bg-amber-500/5' : ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-between space-x-4">
          <FormField
            control={form.control}
            name="is_internal_note"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="!mt-0 cursor-pointer">
                  Internal Note (staff only)
                </FormLabel>
              </FormItem>
            )}
          />

          {!isInternalNote && (
            <FormField
              control={form.control}
              name="update_status"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0 cursor-pointer">
                    Mark as Responded
                  </FormLabel>
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
          >
            Clear
          </Button>
          <Button
            type="submit"
            disabled={createMessage.isPending}
          >
            {createMessage.isPending ? "Sending..." : isInternalNote ? "Add Note" : "Send Response"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
