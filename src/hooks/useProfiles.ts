import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Public profile information (safe to display)
interface PublicProfile {
  id: string;
  display_name: string | null;
  job_title: string | null;
  department: string | null;
  data_classification: string | null;
  privacy_consent_given: boolean | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

// Full profile with sensitive data (requires HR access)
interface UserProfile extends PublicProfile {
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
}

interface UserDisplayInfo {
  id: string;
  display_name: string | null;
  job_title: string | null;
  department: string | null;
}

interface TeamMemberInfo extends UserDisplayInfo {
  // TeamMemberInfo inherits basic display fields from UserDisplayInfo
  // Email is intentionally excluded for security reasons
}

// Hook for accessing your own profile (always allowed)
export const useMyProfile = () => {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchMyProfile = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Users can always access their own public profile information
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const updateMyProfile = async (updates: Partial<Omit<PublicProfile, 'id' | 'created_at' | 'updated_at' | 'data_classification'>>) => {
    if (!user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      await fetchMyProfile();
      return { success: true };
    } catch (err) {
      console.error('Error updating profile:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to update profile' 
      };
    }
  };

  useEffect(() => {
    fetchMyProfile();
  }, [user?.id]);

  return {
    profile,
    loading,
    error,
    refetch: fetchMyProfile,
    updateProfile: updateMyProfile
  };
};

// Hook for getting user display information (names, titles) - secure function
export const useUserDisplayInfo = (userIds?: string[]) => {
  const [displayInfo, setDisplayInfo] = useState<UserDisplayInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDisplayInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the secure function that handles access control
      const { data, error: rpcError } = await supabase
        .rpc('get_user_display_info', { 
          _user_ids: userIds || null 
        });

      if (rpcError) {
        throw rpcError;
      }

      // Map the RPC response fields to match the interface
      const mappedData: UserDisplayInfo[] = (data || []).map((item: any) => ({
        id: item.user_id,
        display_name: item.display_name,
        job_title: item.job_title,
        department: item.department
      }));

      setDisplayInfo(mappedData);
    } catch (err) {
      console.error('Error fetching display info:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user display information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisplayInfo();
  }, [userIds?.join(',')]);

  return {
    displayInfo,
    loading,
    error,
    refetch: fetchDisplayInfo
  };
};

// Hook for managers to get basic team member info
export const useTeamMemberInfo = (managerId?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the secure function for team member access
      const { data, error: rpcError } = await supabase
        .rpc('get_team_member_info', { 
          _manager_id: managerId || null 
        });

      if (rpcError) {
        throw rpcError;
      }

      // Map the RPC response fields to match the interface
      const mappedData: TeamMemberInfo[] = (data || []).map((item: any) => ({
        id: item.user_id,
        display_name: item.display_name,
        job_title: item.job_title,
        department: item.department
      }));

      setTeamMembers(mappedData);
    } catch (err) {
      console.error('Error fetching team member info:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch team member information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, [managerId]);

  return {
    teamMembers,
    loading,
    error,
    refetch: fetchTeamMembers
  };
};

// Hook for HR to access all profiles (HR-only functionality)
export const useHRProfiles = (profileId?: string) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = useAuth();

  const fetchHRProfiles = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user has admin permissions (required for HR profile access)
      if (!hasPermission('admin')) {
        setError('Access denied: Administrator permissions required to view all profiles');
        setProfiles([]);
        return;
      }

      // Use the secure HR function with enhanced access controls
      const { data, error: rpcError } = await supabase
        .rpc('get_profiles_hr_access', { 
          _profile_id: profileId || null 
        });

      if (rpcError) {
        throw rpcError;
      }

      // Map the returned data to UserProfile array format
      const profilesData = Array.isArray(data) ? data : [data];
      const completeProfiles: UserProfile[] = profilesData.map(profileData => ({
        id: profileData.id,
        display_name: profileData.display_name,
        job_title: profileData.job_title,
        department: profileData.department,
        data_classification: profileData.data_classification || 'public',
        created_at: profileData.created_at,
        updated_at: profileData.updated_at,
        // Add missing fields with safe defaults
        privacy_consent_given: null,
        avatar_url: null,
        bio: null,
        // Sensitive fields from employee data
        email: profileData.email || null,
        full_name: profileData.full_name || null,
        phone_number: profileData.phone_number || null,
      }));

      setProfiles(completeProfiles);
    } catch (err) {
      console.error('Error fetching HR profiles:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profile information';
      
      // Handle specific access denied errors
      if (errorMessage.includes('No active session')) {
        setError('Access denied: HR data access session required. Please request access to sensitive employee data first.');
      } else if (errorMessage.includes('Administrator permissions required')) {
        setError('Access denied: Administrator permissions required for HR profile access');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHRProfiles();
  }, [profileId, hasPermission]);

  return {
    profiles,
    loading,
    error,
    refetch: fetchHRProfiles
  };
};

// Simple hook to get all profiles for dropdowns (uses react-query)
export interface SimpleProfile {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, email, avatar_url, job_title')
        .order('display_name', { ascending: true });

      if (error) throw error;
      return data as SimpleProfile[];
    },
  });
}