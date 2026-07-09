import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Copy, Check, Trash2, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { formatET, formatDistanceET } from "@/utils/dateUtils";

interface Props {
  customerId: string;
  customerName?: string;
}

interface InviteRow {
  id: string;
  email: string;
  short_code: string;
  role_at_company: 'owner' | 'member';
  expires_at: string;
  accepted_at: string | null;
}

export const PendingInvitations = ({ customerId, customerName }: Props) => {
  const qc = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: invites, isLoading } = useQuery({
    queryKey: ['pending-invitations', customerId],
    queryFn: async (): Promise<InviteRow[]> => {
      const { data, error } = await supabase
        .from('customer_invitations')
        .select('id, email, short_code, role_at_company, expires_at, accepted_at')
        .eq('customer_id', customerId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('invited_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InviteRow[];
    },
  });

  const copyLink = async (inv: InviteRow) => {
    const url = `${window.location.origin}/portal/auth?invite=${inv.short_code}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resend = async (inv: InviteRow) => {
    setSendingId(inv.id);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', u.user?.id || '')
        .maybeSingle();

      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'customer-portal-invite',
          recipientEmail: inv.email,
          idempotencyKey: `portal-invite-${inv.id}`,
          templateData: {
            companyName: customerName || 'your company',
            inviterName: profile?.display_name || profile?.email || 'Your account team',
            inviteCode: inv.short_code,
            inviteUrl: `${window.location.origin}/portal/auth?invite=${inv.short_code}`,
            expiresAt: formatET(inv.expires_at, 'MMMM d, yyyy'),
            roleLabel: inv.role_at_company === 'owner' ? 'Owner' : 'Member',
          },
        },
      });
      if (error) throw error;
      toast.success('Invitation email sent');
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('Function not found') || msg.includes('not found')) {
        toast.error('Email sending is not set up yet. Use Copy Link to share manually.');
      } else {
        toast.error(`Could not send: ${msg || 'unknown error'}`);
      }
    } finally {
      setSendingId(null);
    }
  };

  const revoke = async (inv: InviteRow) => {
    if (!confirm(`Revoke invitation to ${inv.email}? They won't be able to use this code anymore.`)) return;
    const { error } = await supabase
      .from('customer_invitations')
      .update({ expires_at: new Date().toISOString() })
      .eq('id', inv.id);
    if (error) return toast.error(error.message);
    toast.success('Invitation revoked');
    qc.invalidateQueries({ queryKey: ['pending-invitations', customerId] });
  };

  if (isLoading) return null;
  if (!invites?.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Pending Portal Invitations
          <Badge variant="secondary" className="ml-1 font-normal">
            {invites.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium truncate">{inv.email}</span>
                  <Badge variant="outline" className="font-normal text-xs">
                    {inv.role_at_company === 'owner' ? 'Owner' : 'Member'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <code className="font-mono font-semibold tracking-wider text-foreground">
                    {inv.short_code}
                  </code>
                  <span>·</span>
                  <span>
                    Expires in {formatDistanceET(inv.expires_at)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => copyLink(inv)}>
                  {copiedId === inv.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1 text-green-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy link
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resend(inv)}
                  disabled={sendingId === inv.id}
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  {sendingId === inv.id ? 'Sending…' : 'Email'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => revoke(inv)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
