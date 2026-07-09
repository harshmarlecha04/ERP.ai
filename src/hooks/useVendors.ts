import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRoles } from './useUserRoles';

export interface ContactItem {
  id: string;
  value: string;
  type: string;
  label?: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact_info: string | null;
  emails: ContactItem[];
  phone_numbers: ContactItem[];
  notes: string | null;
  vetting_link: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVendorData {
  name: string;
  contact_info?: string;
  emails?: ContactItem[];
  phone_numbers?: ContactItem[];
  notes?: string;
  vetting_link?: string;
  address?: string;
}

// Helper functions to convert between JSON and ContactItem arrays
const parseContactItems = (jsonData: any): ContactItem[] => {
  if (!jsonData || !Array.isArray(jsonData)) return [];
  return jsonData.map(item => ({
    id: item.id || crypto.randomUUID(),
    value: item.value || '',
    type: item.type || 'other',
    label: item.label
  }));
};

const convertVendorFromDb = (dbVendor: any): Vendor => ({
  ...dbVendor,
  emails: parseContactItems(dbVendor.emails),
  phone_numbers: parseContactItems(dbVendor.phone_numbers)
});

export function useVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { logDataAccess } = useUserRoles();

  const fetchVendors = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setVendors([]);
        setLoading(false);
        return;
      }

      // Use the secure function to get accessible suppliers only
      const { data, error } = await supabase.rpc('get_accessible_suppliers', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error fetching accessible suppliers:', error);
        throw error;
      }

      setVendors((data || []).map(convertVendorFromDb));
      
      // Log access for audit purposes
      if (data && data.length > 0) {
        logDataAccess('suppliers', 'list_view', { count: data.length });
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({
        title: "Error",
        description: "Failed to fetch suppliers. You may not have sufficient permissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createVendor = async (vendorData: CreateVendorData) => {
    try {
      console.log('Creating vendor with data:', vendorData);

      // Validate required fields
      if (!vendorData.name || vendorData.name.trim() === '') {
        throw new Error('Vendor name is required');
      }

      const insertData = {
        name: vendorData.name,
        contact_info: vendorData.contact_info || null,
        emails: (vendorData.emails || []) as any,
        phone_numbers: (vendorData.phone_numbers || []) as any,
        notes: vendorData.notes || null,
        vetting_link: vendorData.vetting_link || null,
        address: vendorData.address || null,
      };

      console.log('Inserting data into database:', insertData);

      const { data, error } = await supabase
        .from('suppliers')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Database error during vendor creation:', error);
        throw new Error(`Database error: ${error.message} (Code: ${error.code})`);
      }

      if (!data) {
        throw new Error('No data returned from database insert');
      }

      console.log('Vendor created successfully:', data);
      
      const convertedVendor = convertVendorFromDb(data);
      setVendors(prev => [convertedVendor, ...prev]);
      
      toast({
        title: "Success",
        description: "Vendor added successfully",
      });
      
      return data;
    } catch (error) {
      console.error('Error creating vendor:', error);
      
      let errorMessage = 'Failed to add vendor';
      if (error instanceof Error) {
        errorMessage = `Failed to add vendor: ${error.message}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateVendor = async (id: string, vendorData: Partial<CreateVendorData>) => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .update({
          ...vendorData,
          contact_info: vendorData.contact_info || null,
          emails: (vendorData.emails || []) as any,
          phone_numbers: (vendorData.phone_numbers || []) as any,
          notes: vendorData.notes || null,
          vetting_link: vendorData.vetting_link || null,
          address: vendorData.address || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const convertedVendor = convertVendorFromDb(data);
      setVendors(prev => prev.map(vendor => 
        vendor.id === id ? convertedVendor : vendor
      ));
      
      toast({
        title: "Success",
        description: "Vendor updated successfully",
      });
      
      return data;
    } catch (error) {
      console.error('Error updating vendor:', error);
      toast({
        title: "Error",
        description: "Failed to update vendor",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteVendor = async (id: string) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setVendors(prev => prev.filter(vendor => vendor.id !== id));
      toast({
        title: "Success",
        description: "Vendor deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast({
        title: "Error",
        description: "Failed to delete vendor",
        variant: "destructive",
      });
      throw error;
    }
  };

  const syncSuppliersFromInventory = async () => {
    try {
      const { data, error } = await supabase.rpc('sync_suppliers_from_inventory');

      if (error) throw error;
      
      const result = data as any; // Cast to any since RPC returns Json type
      if (result?.success) {
        await fetchVendors(); // Refresh the vendor list
        toast({
          title: "Sync Complete",
          description: result.message,
        });
        return result;
      } else {
        throw new Error(result?.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error syncing suppliers:', error);
      toast({
        title: "Error",
        description: "Failed to sync suppliers from inventory",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  return {
    vendors,
    loading,
    createVendor,
    updateVendor,
    deleteVendor,
    syncSuppliersFromInventory,
    refetch: fetchVendors,
  };
}