import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { isCustomerPortalHost, getCustomerPortalOrigin, getCompanyPortalOrigin } from '@/lib/portalHost';

const onCustomerHost = isCustomerPortalHost();
const PORTAL_BASE = onCustomerHost ? '/app' : '/portal';
const RESET_PATH = onCustomerHost ? '/reset-password' : '/portal/reset-password';
const AUTH_PATH = onCustomerHost ? '/' : '/portal/auth';

type PasswordInputProps = {
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
  autoFocus?: boolean;
  id?: string;
};

const PasswordInput = ({ value, onChange, minLength, autoFocus, id }: PasswordInputProps) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        required
        minLength={minLength}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

const PENDING_KEY = 'portal.pendingSignin';

type PendingSignin = { email: string; password: string; ts: number };

const readPending = (): PendingSignin | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignin;
    if (!parsed?.email || !parsed?.password || Date.now() - parsed.ts > 30 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const PortalAuth = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get('invite');
  const companyCode = params.get('company');
  const emailParam = params.get('email');
  const confirmed = params.get('confirmed') === '1';
  const { user } = useAuth();

  const pending = useRef<PendingSignin | null>(readPending());

  const initialPassword =
    confirmed && pending.current && (!emailParam || pending.current.email === emailParam)
      ? pending.current.password
      : '';

  const [inviteAlreadyAccepted, setInviteAlreadyAccepted] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyInvalid, setCompanyInvalid] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>(
    confirmed ? 'signin' : (inviteToken || companyCode) ? 'signup' : 'signin'
  );
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState(emailParam || pending.current?.email || '');
  const [password, setPassword] = useState(initialPassword);
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmedToastShown = useRef(false);
  const autoSignInAttempted = useRef(false);
  const claimAttempted = useRef(false);

  useEffect(() => {
    if (confirmed && !confirmedToastShown.current) {
      confirmedToastShown.current = true;
      toast.success('Email confirmed — signing you in…');
    }
  }, [confirmed]);

  // Auto sign-in after email confirmation using cached credentials
  useEffect(() => {
    if (!confirmed || autoSignInAttempted.current) return;
    if (!email || !password) return;
    autoSignInAttempted.current = true;
    (async () => {
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      sessionStorage.removeItem(PENDING_KEY);
      if (!inviteToken && !companyCode) nav(PORTAL_BASE);
    })();
  }, [confirmed, email, password, inviteToken, companyCode, nav]);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error('Enter your email first.');
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getCustomerPortalOrigin()}${RESET_PATH}`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Check your email for a password reset link.');
    setForgot(false);
  };

  // If we have a company code, fetch the company name to display
  useEffect(() => {
    if (!companyCode) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('get_customer_by_signup_code', {
        _short_code: companyCode,
      });
      // Fallback: try direct (anon read won't work, but signed-in users may)
      let name: string | null = null;
      if (data && typeof data === 'object' && 'company_name' in (data as any)) {
        name = (data as any).company_name;
      }
      if (!cancelled) {
        if (name) setCompanyName(name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyCode]);

  // If logged in and we have a token, accept it
  useEffect(() => {
    const acceptIfPossible = async () => {
      if (!user || !inviteToken) return;
      const { data, error } = await supabase.rpc('accept_customer_invitation', { _token: inviteToken });
      if (error) {
        // Stale session for a deleted user → sign out and reload
        const msg = error.message || '';
        if (msg.includes('customer_users_user_id_fkey') || msg.includes('foreign key')) {
          await supabase.auth.signOut();
          window.location.reload();
          return;
        }
        toast.error(msg);
        return;
      }
      const result = data as { ok?: boolean; error?: string };
      if (result?.ok) {
        toast.success('Invitation accepted');
        nav(PORTAL_BASE);
      } else if (result?.error === 'already_accepted') {
        nav(PORTAL_BASE);
      } else if (result?.error) {
        toast.error(`Invitation: ${result.error}`);
      }
    };
    acceptIfPossible();
  }, [user, inviteToken, nav]);

  // If logged in and we have a company signup code, claim it
  useEffect(() => {
    if (!user || !companyCode || claimAttempted.current) return;
    claimAttempted.current = true;
    (async () => {
      const { data, error } = await supabase.rpc('claim_customer_signup', {
        _short_code: companyCode,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      const result = data as { ok?: boolean; error?: string; role?: string };
      if (result?.ok) {
        if (result.role === 'owner') toast.success('Welcome — you are the account owner.');
        else if (result.role === 'member') toast.success('Joined company portal.');
        // Hard reload to ensure useCustomerStatus picks up the new link
        window.location.assign(PORTAL_BASE);
      } else if (result?.error === 'invalid_code') {
        setCompanyInvalid(true);
        toast.error('Invalid signup link.');
      } else if (result?.error) {
        toast.error(`Signup: ${result.error}`);
      }
    })();
  }, [user, companyCode, nav]);

  // If invite link is reopened but invitation was already accepted, switch to sign-in tab
  useEffect(() => {
    if (!inviteToken || user || confirmed) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('customer_invitations')
        .select('email, accepted_at')
        .eq('token', inviteToken)
        .maybeSingle();
      if (cancelled || !data) return;
      if (data.accepted_at) {
        setInviteAlreadyAccepted(true);
        setMode('signin');
        if (data.email && !email) setEmail(data.email);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken, user, confirmed, email]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!inviteToken && !companyCode) nav(PORTAL_BASE);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const portalOrigin = getCustomerPortalOrigin();
    const redirectParams = new URLSearchParams({ confirmed: '1', email });
    if (inviteToken) redirectParams.set('invite', inviteToken);
    if (companyCode) redirectParams.set('company', companyCode);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${portalOrigin}${AUTH_PATH}?${redirectParams.toString()}`,
        data: { full_name: fullName, display_name: fullName },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    try {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ email, password, ts: Date.now() } satisfies PendingSignin)
      );
    } catch {
      /* ignore storage errors */
    }
    toast.success('Check your email to confirm your account.');
  };


  const hideSignupTab = confirmed || inviteAlreadyAccepted;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Customer Portal</CardTitle>
          <CardDescription>
            {companyCode
              ? companyInvalid
                ? 'This signup link is invalid.'
                : companyName
                  ? `Sign up to access ${companyName}'s portal`
                  : 'Sign up to access your company portal'
              : inviteToken
                ? 'Accept your invitation to continue'
                : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirmed && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200">
              Your email is confirmed. {password ? 'Signing you in…' : 'Enter your password to sign in.'}
            </div>
          )}
          {inviteAlreadyAccepted && !confirmed && (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
              This invitation was already accepted. Please sign in.
            </div>
          )}
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className={`grid w-full ${hideSignupTab ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              {!hideSignupTab && (
                <TabsTrigger value="signup">
                  {inviteToken ? 'Accept invite' : 'Sign up'}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="signin">
              {forgot ? (
                <form onSubmit={handleForgot} className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Enter your email and we'll send you a link to reset your password.
                  </p>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? 'Sending…' : 'Send reset link'}
                  </Button>
                  <button
                    type="button"
                    className="block w-full text-center text-xs text-muted-foreground underline"
                    onClick={() => setForgot(false)}
                  >
                    Back to sign in
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <PasswordInput
                      value={password}
                      onChange={setPassword}
                      autoFocus={confirmed && !!email}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? 'Signing in…' : 'Sign in'}
                  </Button>
                  <button
                    type="button"
                    className="block w-full text-center text-xs text-muted-foreground underline"
                    onClick={() => setForgot(true)}
                  >
                    Forgot password?
                  </button>
                </form>
              )}
            </TabsContent>


            <TabsContent value="signup">
              {!inviteToken && !companyCode ? (
                <p className="text-sm text-muted-foreground mt-4">
                  Self-signup is invitation-only. Please contact your account manager for access.
                </p>
              ) : companyCode && companyInvalid ? (
                <p className="text-sm text-destructive mt-4">
                  This signup link is invalid or expired. Please contact your account manager.
                </p>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                  <div>
                    <Label>Full name</Label>
                    <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <PasswordInput value={password} onChange={setPassword} minLength={8} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? 'Creating account…' : 'Create account'}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            Staff member?{' '}
            <a href="/auth" className="underline">
              Sign in to the Employee Portal →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalAuth;
