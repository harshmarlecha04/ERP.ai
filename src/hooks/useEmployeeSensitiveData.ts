import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface EmployeeSensitiveData {
  id: string;
  employee_id: string | null;
  department: string | null;
  manager_id: string | null;
  hire_date: string | null;
  security_clearance: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  data_classification: string | null;
  created_at: string;
  updated_at: string;
}

interface EmployeeCriticalData {
  id: string;
  employee_id: string;
  social_security_partial: string | null;
  salary_band: string | null;
  home_address: string | null;
  created_at: string;
  updated_at: string;
}

interface EmployeeBasicInfo {
  id: string;
  employee_id: string | null;
  department: string | null;
  hire_date: string | null;
  security_clearance: string | null;
  data_classification: string | null;
}

export const useEmployeeSensitiveData = (employeeId?: string) => {
  const [employeeData, setEmployeeData] = useState<EmployeeSensitiveData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { canAccessHRData } = useAuth();

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user has HR permission - this is now required for ALL sensitive data
      if (!canAccessHRData()) {
        setError('Access denied: HR manager permissions required to view sensitive employee data');
        setEmployeeData([]);
        return;
      }

      // Use the new secure function that requires approval workflows for HR
      const { data, error: rpcError } = await supabase
        .rpc('get_employee_sensitive_data_secure', { 
          _employee_id: employeeId || null 
        });

      if (rpcError) {
        console.error('Error fetching employee data:', rpcError);
        // Specific error handling for access denied cases
        if (rpcError.message.includes('requires prior approval')) {
          setError('HR access to sensitive employee data requires admin approval. Please submit an access request.');
        } else {
          setError(rpcError.message);
        }
        return;
      }

      setEmployeeData(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Failed to fetch employee data');
    } finally {
      setLoading(false);
    }
  };

  const updateEmployeeData = async (
    employeeId: string, 
    employeeData: Partial<EmployeeSensitiveData>
  ) => {
    try {
      if (!canAccessHRData()) {
        return { 
          success: false, 
          error: 'Access denied: HR manager permissions required to update employee data' 
        };
      }

      // Note: Critical data (SSN, salary, home address) is now handled separately
      // This function only updates non-critical sensitive data with approval workflow
      const { data, error: rpcError } = await supabase
        .rpc('update_employee_data_with_approval', {
          _employee_id: employeeId,
          _employee_data: employeeData
        });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update employee data');
      }

      // Refresh data after successful update
      await fetchEmployeeData();
      
      return { success: true, message: result.message };
    } catch (err) {
      console.error('Error updating employee data:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to update employee data' 
      };
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, [employeeId]);

  return {
    employeeData,
    loading,
    error,
    refetch: fetchEmployeeData,
    updateEmployeeData
  };
};

// Hook for accessing basic employee info (non-sensitive data)
// This can be used by managers to get basic info about their reports
export const useEmployeeBasicInfo = (employeeId?: string) => {
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeBasicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBasicInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase
        .rpc('get_employee_basic_info', { 
          _employee_id: employeeId || null 
        });

      if (rpcError) {
        console.error('Error fetching basic employee info:', rpcError);
        setError(rpcError.message);
        return;
      }

      setEmployeeInfo(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Failed to fetch employee information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBasicInfo();
  }, [employeeId]);

  return {
    employeeInfo,
    loading,
    error,
    refetch: fetchBasicInfo
  };
};

// Hook for accessing critical employee data (admin-only)
// This provides access to the most sensitive data with enhanced security
export const useEmployeeCriticalData = (employeeId?: string) => {
  const [criticalData, setCriticalData] = useState<EmployeeCriticalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = useAuth();

  const fetchCriticalData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Only admins can access critical data
      if (!hasPermission('admin')) {
        setError('Access denied: Administrator permissions required to view critical employee data');
        setCriticalData([]);
        return;
      }

      // Use the secure function that handles access control and audit logging
      const { data, error: rpcError } = await supabase
        .rpc('get_employee_critical_data', { 
          _employee_id: employeeId || null 
        });

      if (rpcError) {
        console.error('Error fetching critical employee data:', rpcError);
        setError(rpcError.message);
        return;
      }

      setCriticalData(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Failed to fetch critical employee data');
    } finally {
      setLoading(false);
    }
  };

  const updateCriticalData = async (
    employeeId: string, 
    criticalData: Partial<EmployeeCriticalData>,
    accessReason: string = 'Data update'
  ) => {
    try {
      if (!hasPermission('admin')) {
        return { 
          success: false, 
          error: 'Access denied: Administrator permissions required to update critical employee data' 
        };
      }

      const { data, error: rpcError } = await supabase
        .rpc('update_employee_critical_data', {
          _employee_id: employeeId,
          _critical_data: criticalData,
          _access_reason: accessReason
        });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update critical employee data');
      }

      // Refresh data after successful update
      await fetchCriticalData();
      
      return { success: true, message: result.message };
    } catch (err) {
      console.error('Error updating critical employee data:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to update critical employee data' 
      };
    }
  };

  useEffect(() => {
    fetchCriticalData();
  }, [employeeId]);

  return {
    criticalData,
    loading,
    error,
    refetch: fetchCriticalData,
    updateCriticalData
  };
};

// DEPRECATED: This hook no longer works due to stricter security controls
// Only HR personnel can access employee sensitive data now
export const useMyEmployeeData = () => {
  const { user, canAccessHRData } = useAuth();
  
  if (!canAccessHRData()) {
    return {
      employeeData: [],
      loading: false,
      error: 'Access denied: Employee self-service access to sensitive data has been restricted. Contact HR for assistance.',
      refetch: () => {},
      updateEmployeeData: () => Promise.resolve({ 
        success: false, 
        error: 'Self-service updates no longer available. Contact HR to update your information.' 
      })
    };
  }
  
  return useEmployeeSensitiveData(user?.id);
};