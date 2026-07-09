import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface HRAccessRequest {
  id: string;
  requester_id: string;
  employee_id: string;
  access_reason: string;
  access_type: 'view' | 'update';
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  denied_by?: string;
  denied_at?: string;
  denial_reason?: string;
  expires_at?: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  created_at: string;
  updated_at: string;
}

export const useHRAccessRequests = () => {
  const [requests, setRequests] = useState<HRAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = useAuth();

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('hr_data_access_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching HR access requests:', fetchError);
        setError(fetchError.message);
        return;
      }

      setRequests((data || []).map(req => ({
        ...req,
        access_type: req.access_type as 'view' | 'update',
        status: req.status as 'pending' | 'approved' | 'denied' | 'expired'
      })));
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Failed to fetch HR access requests');
    } finally {
      setLoading(false);
    }
  };

  const submitAccessRequest = async (
    employeeId: string,
    accessReason: string,
    accessType: 'view' | 'update' = 'view'
  ) => {
    try {
      const { data, error: submitError } = await supabase
        .from('hr_data_access_requests')
        .insert({
          requester_id: (await supabase.auth.getUser()).data.user?.id,
          employee_id: employeeId,
          access_reason: accessReason,
          access_type: accessType
        })
        .select()
        .single();

      if (submitError) {
        throw new Error(submitError.message);
      }

      // Refresh the requests list
      await fetchRequests();
      
      return { success: true, request: data };
    } catch (err) {
      console.error('Error submitting access request:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to submit access request'
      };
    }
  };

  const approveRequest = async (requestId: string, expiresInHours: number = 8) => {
    try {
      if (!hasPermission('admin')) {
        return {
          success: false,
          error: 'Only administrators can approve access requests'
        };
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);

      // Update the request status
      const { error: updateError } = await supabase
        .from('hr_data_access_requests')
        .update({
          status: 'approved',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        })
        .eq('id', requestId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Create an active session for the approved request
      const request = requests.find(r => r.id === requestId);
      if (request) {
        const { error: sessionError } = await supabase
          .from('hr_sensitive_data_sessions')
          .insert({
            request_id: requestId,
            user_id: request.requester_id,
            employee_id: request.employee_id,
            expires_at: expiresAt.toISOString()
          });

        if (sessionError) {
          console.error('Error creating session:', sessionError);
          // Don't fail the whole operation if session creation fails
        }
      }

      // Refresh the requests list
      await fetchRequests();
      
      return { success: true };
    } catch (err) {
      console.error('Error approving request:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to approve request'
      };
    }
  };

  const denyRequest = async (requestId: string, denialReason: string) => {
    try {
      if (!hasPermission('admin')) {
        return {
          success: false,
          error: 'Only administrators can deny access requests'
        };
      }

      const { error: updateError } = await supabase
        .from('hr_data_access_requests')
        .update({
          status: 'denied',
          denied_by: (await supabase.auth.getUser()).data.user?.id,
          denied_at: new Date().toISOString(),
          denial_reason: denialReason
        })
        .eq('id', requestId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Refresh the requests list
      await fetchRequests();
      
      return { success: true };
    } catch (err) {
      console.error('Error denying request:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to deny request'
      };
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return {
    requests,
    loading,
    error,
    refetch: fetchRequests,
    submitAccessRequest,
    approveRequest,
    denyRequest
  };
};