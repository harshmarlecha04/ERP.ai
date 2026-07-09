import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Inquiry {
  id: string;
  inquiry_number: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  company_name?: string;
  inquiry_type: 'new_order' | 'order_status' | 'product_question' | 'pricing' | 'general';
  related_order_id?: string;
  subject: string;
  message: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  status: 'new' | 'in_review' | 'responded' | 'converted_to_order' | 'closed';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface CreateInquiryData {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  company_name?: string;
  inquiry_type: string;
  subject: string;
  message: string;
  urgency?: string;
  customer_id?: string;
  related_order_id?: string;
}

export const useInquiries = (filters?: {
  status?: string;
  type?: string;
  urgency?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ["inquiries", filters],
    queryFn: async () => {
      let query = supabase
        .from("customer_inquiries")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq("status", filters.status);
      }
      if (filters?.type && filters.type !== 'all') {
        query = query.eq("inquiry_type", filters.type);
      }
      if (filters?.urgency && filters.urgency !== 'all') {
        query = query.eq("urgency", filters.urgency);
      }
      if (filters?.search) {
        query = query.or(`inquiry_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Inquiry[];
    },
  });
};

export const useInquiry = (inquiryId: string) => {
  return useQuery({
    queryKey: ["inquiry", inquiryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_inquiries")
        .select("*")
        .eq("id", inquiryId)
        .single();

      if (error) throw error;
      return data as Inquiry;
    },
    enabled: !!inquiryId,
  });
};

export const useCreateInquiry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInquiryData) => {
      const { data: inquiry, error } = await supabase
        .from("customer_inquiries")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return inquiry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toast.success("Inquiry submitted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit inquiry: ${error.message}`);
    },
  });
};

export const useUpdateInquiry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Inquiry> & { id: string }) => {
      const { data: inquiry, error } = await supabase
        .from("customer_inquiries")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return inquiry;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["inquiry", data.id] });
      toast.success("Inquiry updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update inquiry: ${error.message}`);
    },
  });
};

export const useInquiryStats = () => {
  return useQuery({
    queryKey: ["inquiry-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_inquiries")
        .select("status, urgency");

      if (error) throw error;

      const stats = {
        new: data.filter(i => i.status === 'new').length,
        in_review: data.filter(i => i.status === 'in_review').length,
        responded: data.filter(i => i.status === 'responded').length,
        closed: data.filter(i => i.status === 'closed').length,
        urgent: data.filter(i => i.urgency === 'urgent' && i.status !== 'closed').length,
      };

      return stats;
    },
  });
};
