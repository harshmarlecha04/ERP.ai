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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, job_title, avatar_url')
        .ilike('email', '%@pharmvista.com')
        .order('display_name');

      if (error) throw error;
      return data as TeamMember[];
    },
  });
};
