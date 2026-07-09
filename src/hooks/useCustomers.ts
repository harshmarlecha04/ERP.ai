import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Customer {
  id: string;
  company_name: string;
  company_code: string;
  contact_person: string | null;
  contact_title: string | null;
  email: string | null;
  phone: string | null;
  is_rd_customer: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useCustomers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('company_name');
      
      if (error) throw error;
      return data as Customer[];
    },
  });

  const createCustomer = useMutation({
    mutationFn: async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('customers')
        .insert(customer)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer created successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create customer', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer updated successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update customer', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      // Check if customer has any orders
      const { data: orders, error: checkError } = await supabase
        .from('order_headers')
        .select('id')
        .eq('customer_id', id)
        .limit(1);
      
      if (checkError) throw checkError;
      
      if (orders && orders.length > 0) {
        throw new Error('Cannot delete customer with existing orders. Please archive the customer instead.');
      }
      
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-order-stats'] });
      toast({ title: 'Customer deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Cannot delete customer', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  return {
    customers,
    isLoading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  };
};
