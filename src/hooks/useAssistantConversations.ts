import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantConversation {
  id: string;
  user_id: string;
  title: string;
  messages: AssistantMessage[];
  created_at: string;
  updated_at: string;
}

export const useAssistantConversations = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch all conversations
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['assistant-conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('assistant_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(conv => ({
        ...conv,
        messages: (conv.messages as unknown as AssistantMessage[]) || []
      })) as AssistantConversation[];
    },
    enabled: !!user?.id,
  });

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: async (title?: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('assistant_conversations')
        .insert({
          user_id: user.id,
          title: title || 'New Conversation',
          messages: []
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        messages: []
      } as AssistantConversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] });
    },
  });

  // Update conversation (add messages, update title)
  const updateConversation = useMutation({
    mutationFn: async ({ 
      id, 
      messages, 
      title 
    }: { 
      id: string; 
      messages?: AssistantMessage[]; 
      title?: string;
    }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (messages !== undefined) updates.messages = messages;
      if (title !== undefined) updates.title = title;

      const { data, error } = await supabase
        .from('assistant_conversations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        messages: (data.messages as unknown as AssistantMessage[]) || []
      } as AssistantConversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] });
    },
  });

  // Delete conversation
  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('assistant_conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] });
    },
  });

  // Generate title from first message
  const generateTitle = (message: string): string => {
    const maxLength = 40;
    const cleaned = message.replace(/[^\w\s]/g, '').trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength).trim() + '...';
  };

  return {
    conversations: conversations || [],
    isLoading,
    createConversation: createConversation.mutateAsync,
    updateConversation: updateConversation.mutateAsync,
    deleteConversation: deleteConversation.mutateAsync,
    isCreating: createConversation.isPending,
    isUpdating: updateConversation.isPending,
    isDeleting: deleteConversation.isPending,
    generateTitle,
  };
};