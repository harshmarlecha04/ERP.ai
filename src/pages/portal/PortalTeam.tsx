import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerStatus } from '@/hooks/useIsCustomer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, UserPlus, Copy, Check, Crown, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getCustomerPortalOrigin } from '@/lib/portalHost';
import { formatET } from "@/utils/dateUtils";

interface Member {
  id: string;
  user_id: string;
  role_at_company: string;
  is_primary: boolean;
  accepted_at: string | null;
  invited_at: string;
}

interface Pending {
  id: string;
  email: string;
  short_code: string;
  expires_at: string;
  accepted_at: string | null;
}

const PortalTeam = () => {
  const { user } = useAuth();
  const { customerId } = useCustomerStatus();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Pending | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: myRow } = useQuery({
    queryKey: ['portal-team-myrow', user?.id, customerId],
    enabled: !!user?.id && !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_users')
        .select('id, role_at_company, is_primary')
        .eq('user_id', user!.id)
        .eq('customer_id', customerId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isOwner = myRow?.role_at_company === 'owner';

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['portal-team-members', customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('customer_users')
        .select('id, user_id, role_at_company, is_primary, accepted_at, invited_at')
        .eq('customer_id', customerId!)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return (data as Member[]) || [];
    },
  });

  const { data: pending } = useQuery({
    queryKey: ['portal-team-pending', customerId],
    enabled: !!customerId && isOwner,
    queryFn: async (): Promise<Pending[]> => {
      const { data, error } = await supabase
        .from('customer_invitations')
        .select('id, email, short_code, expires_at, accepted_at')
        .eq('customer_id', customerId!)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('invited_at', { ascending: false });
      if (error) throw error;
      return (data as Pending[]) || [];
    },
  });

  const createInvite = async () => {
    if (!inviteEmail.trim() || !customerId) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('customer_invitations')
        .insert({
          customer_id: customerId,
          email: inviteEmail.trim().toLowerCase(),
          role_at_company: 'member',
          invited_by: user?.id,
        })
        .select('id, email, short_code, expires_at, accepted_at')
        .single();
      if (error) throw error;
      setCreated(data as Pending);
      setInviteEmail('');
      qc.invalidateQueries({ queryKey: ['portal-team-pending', customerId] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const inviteUrl = created
    ? `${getCustomerPortalOrigin()}/portal/auth?invite=${created.short_code}`
    : '';

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setCreated(null);
    setInviteEmail('');
    setCopied(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            People with access to your company's portal.
          </p>
        </div>
        {isOwner && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite teammate
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{created ? 'Invitation ready' : 'Invite a teammate'}</DialogTitle>
              </DialogHeader>
              {!created ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Teammate email</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@company.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      They'll be added as a member. They need to sign up with this exact email.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button onClick={createInvite} disabled={creating || !inviteEmail.trim()}>
                      {creating ? 'Creating…' : 'Create invite'}
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    Send this link to <strong>{created.email}</strong>:
                  </div>
                  <div className="flex items-stretch gap-2">
                    <Input readOnly value={inviteUrl} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copy(inviteUrl)}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Expires {formatET(created.expires_at, 'MMM d, yyyy')}.
                  </p>
                  <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={reset}>Invite another</Button>
                    <Button onClick={() => setOpen(false)}>Done</Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            {isOwner ? 'You are the owner of this account.' : 'Only the account owner can invite new teammates.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !members?.length ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <div className="divide-y">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {m.role_at_company === 'owner' ? (
                      <Crown className="h-4 w-4 text-amber-500" />
                    ) : (
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {m.user_id === user?.id ? 'You' : m.user_id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Joined {m.accepted_at ? formatET(m.accepted_at, 'MMM d, yyyy') : '—'}
                      </div>
                    </div>
                  </div>
                  <Badge variant={m.role_at_company === 'owner' ? 'default' : 'secondary'}>
                    {m.role_at_company === 'owner' ? 'Owner' : 'Member'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isOwner && !!pending?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {pending.map((p) => {
                const url = `${getCustomerPortalOrigin()}/portal/auth?invite=${p.short_code}`;
                return (
                  <div key={p.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Expires {formatET(p.expires_at, 'MMM d, yyyy')}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copy(url)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy link
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PortalTeam;
