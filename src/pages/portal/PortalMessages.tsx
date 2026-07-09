import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatET } from "@/utils/dateUtils";

interface Msg {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
}

export default function PortalMessages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeOther, setActiveOther] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['portal', 'messages', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Msg[]> => {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('id, sender_id, receiver_id, message, created_at')
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Realtime updates
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('portal-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () => {
        qc.invalidateQueries({ queryKey: ['portal', 'messages', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  const threads = useMemo(() => {
    const map = new Map<string, Msg[]>();
    (messages || []).forEach((m) => {
      const other = m.sender_id === user?.id ? m.receiver_id : m.sender_id;
      if (!map.has(other)) map.set(other, []);
      map.get(other)!.push(m);
    });
    return Array.from(map.entries()).map(([otherId, msgs]) => ({
      otherId,
      msgs,
      last: msgs[msgs.length - 1],
    })).sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  }, [messages, user?.id]);

  // Look up profile names for the "other" parties
  const otherIds = threads.map(t => t.otherId);
  const { data: profiles } = useQuery({
    queryKey: ['portal', 'message-profiles', otherIds],
    enabled: otherIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles')
        .select('id, display_name, email')
        .in('id', otherIds);
      if (error) throw error;
      return data || [];
    },
  });
  const nameOf = (id: string) => {
    const p = profiles?.find((x: any) => x.id === id);
    return p?.display_name || p?.email || 'Team member';
  };

  useEffect(() => {
    if (!activeOther && threads.length) setActiveOther(threads[0].otherId);
  }, [threads, activeOther]);

  const activeThread = threads.find(t => t.otherId === activeOther);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.msgs.length]);

  const sendReply = async () => {
    if (!draft.trim() || !user?.id || !activeOther) return;
    setSending(true);
    try {
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: user.id,
        receiver_id: activeOther,
        message: draft.trim(),
      });
      if (error) throw error;
      setDraft('');
      qc.invalidateQueries({ queryKey: ['portal', 'messages', user.id] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground">Direct conversations with your account team.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] h-[560px]">
          <div className="border-r bg-muted/30">
            <div className="p-3 border-b font-medium text-sm">Conversations</div>
            <ScrollArea className="h-[calc(560px-45px)]">
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              ) : !threads.length ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No messages yet. Your account team will reach out shortly.
                </div>
              ) : (
                threads.map(t => (
                  <button
                    key={t.otherId}
                    onClick={() => setActiveOther(t.otherId)}
                    className={cn(
                      'w-full text-left p-3 border-b hover:bg-muted/50 transition-colors',
                      activeOther === t.otherId && 'bg-muted'
                    )}
                  >
                    <div className="font-medium text-sm">{nameOf(t.otherId)}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.last.message}</div>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>

          <div className="flex flex-col">
            {!activeThread ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a conversation
              </div>
            ) : (
              <>
                <div className="p-3 border-b font-medium text-sm">{nameOf(activeThread.otherId)}</div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {activeThread.msgs.map(m => {
                      const mine = m.sender_id === user?.id;
                      return (
                        <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                          <div className={cn(
                            'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                            mine ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          )}>
                            <div>{m.message}</div>
                            <div className={cn('text-[10px] mt-1 opacity-70')}>
                              {formatET(m.created_at, 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={endRef} />
                  </div>
                </ScrollArea>
                <div className="border-t p-3 flex gap-2">
                  <Textarea
                    rows={2}
                    placeholder="Type your reply…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendReply(); }
                    }}
                  />
                  <Button onClick={sendReply} disabled={sending || !draft.trim()}>Send</Button>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
