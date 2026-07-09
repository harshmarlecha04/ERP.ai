import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InquiryMessage {
  id: string;
  inquiry_id: string;
  message: string;
  sender_type: 'customer' | 'staff';
  sender_id?: string;
  sender_name: string;
  sender_email?: string;
  attachments?: any[];
  is_internal_note: boolean;
  created_at: string;
}

export interface CreateMessageData {
  inquiry_id: string;
  message: string;
  sender_type: 'customer' | 'staff';
  sender_name: string;
  sender_email?: string;
  is_internal_note?: boolean;
}

export const useInquiryMessages = (inquiryId: string) => {
  return useQuery({
    queryKey: ["inquiry-messages", inquiryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiry_messages")
        .select("*")
        .eq("inquiry_id", inquiryId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as InquiryMessage[];
    },
    enabled: !!inquiryId,
  });
};

export const useCreateInquiryMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMessageData) => {
      const { data: message, error } = await supabase
        .from("inquiry_messages")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return message;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inquiry-messages", data.inquiry_id] });
      queryClient.invalidateQueries({ queryKey: ["inquiry", data.inquiry_id] });
      toast.success("Response sent successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to send response: ${error.message}`);
    },
  });
};
