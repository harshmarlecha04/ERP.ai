import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TeamMember {
  id: string;
  email: string;
  display_name: string;
  job_title: string;
  avatar_url?: string;
}

export const useTeamMembers = () => {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, display_name, job_title, avatar_url')
          .order('display_name'),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      const staffIds = new Set(
        (rolesRes.data || [])
          .filter((r: any) => r.role && r.role !== 'customer')
          .map((r: any) => r.user_id)
      );
      return ((profilesRes.data || []) as TeamMember[]).filter((p) => staffIds.has(p.id));
    },
  });
};
