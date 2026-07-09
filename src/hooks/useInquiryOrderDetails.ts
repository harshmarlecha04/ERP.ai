import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InquiryProduct {
  id: string;
  product_name: string;
  formula_code?: string;
  bottles_quantity: number;
  count_per_bottle: number;
  expected_delivery_date?: string;
}

export interface InquiryOrderDetail {
  id: string;
  inquiry_id: string;
  po_number?: string;
  products?: InquiryProduct[];
  product_name?: string;
  formula_code?: string;
  quantity?: number;
  bottle_size?: number;
  preferred_delivery_date?: string;
  special_requirements?: string;
  order_type?: 'production' | 'rd_sample' | 'rd_development';
  created_at: string;
}

export interface CreateInquiryOrderDetailData {
  inquiry_id: string;
  po_number?: string;
  products?: InquiryProduct[];
  product_name?: string;
  formula_code?: string;
  quantity?: number;
  bottle_size?: number;
  preferred_delivery_date?: string;
  special_requirements?: string;
  order_type?: 'production' | 'rd_sample' | 'rd_development';
}

export const useInquiryOrderDetails = (inquiryId: string) => {
  return useQuery({
    queryKey: ["inquiry-order-details", inquiryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiry_order_details")
        .select("*")
        .eq("inquiry_id", inquiryId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        products: data.products ? (data.products as unknown as InquiryProduct[]) : undefined,
      } as InquiryOrderDetail;
    },
    enabled: !!inquiryId,
  });
};

export const useCreateInquiryOrderDetail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInquiryOrderDetailData) => {
      const { data: detail, error } = await supabase
        .from("inquiry_order_details")
        .insert({
          inquiry_id: data.inquiry_id,
          po_number: data.po_number,
          products: data.products as any,
          product_name: data.product_name,
          formula_code: data.formula_code,
          quantity: data.quantity,
          bottle_size: data.bottle_size,
          preferred_delivery_date: data.preferred_delivery_date,
          special_requirements: data.special_requirements,
          order_type: data.order_type,
        })
        .select()
        .single();

      if (error) throw error;
      return detail;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inquiry-order-details", data.inquiry_id] });
      toast.success("Order details saved successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save order details: ${error.message}`);
    },
  });
};
