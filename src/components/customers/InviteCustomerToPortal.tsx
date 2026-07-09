import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  UserPlus,
  Copy,
  Check,
  Mail,
  ExternalLink,
  Sparkles,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { formatET, formatDistanceET } from "@/utils/dateUtils";

interface Props {
  customerId: string;
  customerName?: string;
  defaultEmail?: string;
}

interface CreatedInvite {
  id: string;
  email: string;
  role_at_company: 'owner' | 'member';
  short_code: string;
  expires_at: string;
}

export const InviteCustomerToPortal = ({ customerId, customerName, defaultEmail }: Props) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail || '');
  const [role, setRole] = useState<'owner' | 'member'>('owner');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const inviteUrl = created
    ? `${window.location.origin}/portal/auth?invite=${created.short_code}`
    : '';

  const createInvite = async () => {
    if (!email.trim()) return toast.error('Email required');
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('customer_invitations')
        .insert({
          customer_id: customerId,
          email: email.trim().toLowerCase(),
          role_at_company: role,
          invited_by: u.user?.id,
        })
        .select('id, email, role_at_company, short_code, expires_at')
        .single();
      if (error) throw error;
      setCreated(data as CreatedInvite);
      qc.invalidateQueries({ queryKey: ['pending-invitations', customerId] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to create invitation');
    } finally {
      setLoading(false);
    }
  };

  const copyValue = async (value: string, kind: 'code' | 'link') => {
    await navigator.clipboard.writeText(value);
    if (kind === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const sendEmail = async () => {
    if (!created) return;
    setEmailing(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', u.user?.id || '')
        .maybeSingle();

      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'customer-portal-invite',
          recipientEmail: created.email,
          idempotencyKey: `portal-invite-${created.id}`,
          templateData: {
            companyName: customerName || 'your company',
            inviterName: senderProfile?.display_name || senderProfile?.email || 'Your account team',
            inviteCode: created.short_code,
            inviteUrl: `${window.location.origin}/portal/auth?invite=${created.short_code}`,
            expiresAt: formatET(created.expires_at, 'MMMM d, yyyy'),
            roleLabel: created.role_at_company === 'owner' ? 'Owner' : 'Member',
          },
        },
      });
      if (error) throw error;
      setEmailSent(true);
      toast.success('Invitation email sent');
      setTimeout(() => setEmailSent(false), 4000);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('Function not found') || msg.includes('not found')) {
        toast.error('Email sending is not set up yet. Use Copy Link to share manually.');
      } else {
        toast.error(`Could not send email: ${msg || 'unknown error'}`);
      }
    } finally {
      setEmailing(false);
    }
  };

  const reset = () => {
    setCreated(null);
    setEmail(defaultEmail || '');
    setRole('owner');
    setEmailSent(false);
    setCopiedCode(false);
    setCopiedLink(false);
  };

  const expiresInLabel = created
    ? formatDistanceET(created.expires_at, { addSuffix: false })
    : '';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite to Portal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {created ? (
              <>
                <Sparkles className="h-5 w-5 text-primary" />
                Invitation ready
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                Invite to Customer Portal
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {!created ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@company.com"
              />
              <p className="text-xs text-muted-foreground">
                They must sign up with this exact email.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Role at Company</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner (full access)</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Owner: primary contact, signs agreements. Member: regular teammate.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={createInvite} disabled={loading}>
                {loading ? 'Creating…' : 'Create Invitation'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Recipient summary */}
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground w-16 shrink-0">For</span>
                <span className="font-medium truncate">{created.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground w-16 shrink-0">Role</span>
                <Badge variant="secondary" className="font-normal">
                  {created.role_at_company === 'owner' ? 'Owner' : 'Member'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground w-16 shrink-0">Expires</span>
                <span>
                  in {expiresInLabel}{' '}
                  <span className="text-muted-foreground">
                    ({formatET(created.expires_at, 'MMM d, yyyy')})
                  </span>
                </span>
              </div>
            </div>

            {/* Big invite code */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Invite code
              </Label>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 rounded-md border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 font-mono text-2xl font-bold tracking-[0.2em] text-center text-foreground">
                  {created.short_code}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-auto w-12"
                  onClick={() => copyValue(created.short_code, 'code')}
                  title="Copy code"
                >
                  {copiedCode ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Easy to read aloud. Recipient enters it at the portal sign-in page.
              </p>
            </div>

            {/* Or share link */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Or share this link
              </Label>
              <div className="flex items-stretch gap-2">
                <Input readOnly value={inviteUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyValue(inviteUrl, 'link')}
                  title="Copy link"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(inviteUrl, '_blank', 'noopener')}
                  title="Open link"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
              <Button variant="ghost" onClick={reset}>
                Create another
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={sendEmail}
                  disabled={emailing}
                  className="gap-2"
                >
                  {emailSent ? (
                    <>
                      <Check className="h-4 w-4" />
                      Sent
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      {emailing ? 'Sending…' : 'Send invite email'}
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
