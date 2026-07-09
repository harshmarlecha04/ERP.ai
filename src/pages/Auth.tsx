import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCustomerPortalOrigin } from '@/lib/portalHost';

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [isForceChange, setIsForceChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [editingResetEmail, setEditingResetEmail] = useState(false);
  
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already authenticated (but not during password reset / forced change)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const isReset = searchParams.get('reset') === 'true';
    const isForce = searchParams.get('force-change') === 'true';
    const mustChange = Boolean((user?.user_metadata as any)?.must_change_password);
    const rawNext = searchParams.get('next');
    // Only accept same-origin relative paths for `next`.
    const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;

    if (user && !loading && !isReset && !isForce && !mustChange) {
      navigate(next ?? '/dashboard');
    }
  }, [user, loading, navigate]);

  // Detect password reset / forced change flow
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('reset') === 'true') setIsPasswordReset(true);
    if (searchParams.get('force-change') === 'true') setIsForceChange(true);
  }, []);

  // Defensive: when arriving from the Customer Portal "Login to Employee Portal"
  // button, ensure no stale session leaks in.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('fresh') === '1') {
      supabase.auth.signOut().catch(() => {});
      window.history.replaceState({}, document.title, '/auth');
    }
  }, []);

  // If signed-in user has the must_change_password flag, force them into change mode
  useEffect(() => {
    if (user && (user.user_metadata as any)?.must_change_password) {
      setIsForceChange(true);
    }
  }, [user]);

  // Reset forgot password state when switching modes
  useEffect(() => {
    if (isSignUp || isPasswordReset) {
      setIsForgotPassword(false);
      setResetEmailSent(false);
      setResetEmail('');
    }
  }, [isSignUp, isPasswordReset]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@pharmvista\.com$/i;
    return emailRegex.test(email);
  };

  const handleEmailBlur = () => {
    if (email && !validateEmail(email)) {
      setEmailError('Only pharmvista.com email addresses are allowed.');
    } else {
      setEmailError('');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setEmailError('');

    if (!validateEmail(email)) {
      setEmailError('Only pharmvista.com email addresses are allowed for the employee portal.');
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error.message);
    } else {
      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
      });
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setEmailError('');

    // Validate email domain
    if (!validateEmail(email)) {
      setEmailError('Only pharmvista.com email addresses are allowed.');
      setIsLoading(false);
      return;
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password, fullName, jobTitle);
    
    if (error) {
      setError(error.message);
    } else {
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
    }
    
    setIsLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate password confirmation
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      setIsLoading(false);
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const recoveredEmail = userData?.user?.email ?? '';

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          must_change_password: false,
          temp_password_issued_at: null,
        },
      });
      
      if (error) throw error;
      
      // Sign out so the next sign-in uses the new password (not the recovery session)
      await supabase.auth.signOut();

      toast({
        title: "Password updated!",
        description: "Your password has been successfully reset. Please sign in with your new password.",
      });
      
      // Clear the reset state and redirect to sign in with email prefilled
      setIsPasswordReset(false);
      setIsForceChange(false);
      setIsSignUp(false);
      setNewPassword('');
      setConfirmNewPassword('');
      if (recoveredEmail) setEmail(recoveredEmail);

      // Clear URL parameters
      window.history.replaceState({}, document.title, "/auth");
      
    } catch (error: any) {
      setError(error.message || "Failed to reset password");
    }
    
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });
      
      if (error) throw error;
      
      setResetEmailSent(true);
      toast({
        title: "Password reset email sent",
        description: `Check your email at ${resetEmail} for the password reset link.`,
      });
    } catch (error: any) {
      setError(error.message || "Failed to send reset email");
    }
    
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isSignUp) {
        handleSignUp(e as any);
      } else {
        handleSignIn(e as any);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center p-4 relative">
      <a
        href="/portal/auth"
        className="absolute top-4 right-4 text-sm text-gray-600 hover:text-black underline underline-offset-4"
      >
        Customer Portal Login →
      </a>
      <div className="w-full max-w-[420px] p-7 bg-white rounded-2xl shadow-[0_6px_24px_rgba(0,0,0,0.08)]">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">ERP</span>
            </div>
            <h1 className="text-xl font-bold">ERP.ai</h1>
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {isForceChange
              ? 'Set a New Password'
              : isPasswordReset
                ? 'Reset Password'
                : isForgotPassword
                  ? 'Reset Password'
                  : isSignUp
                    ? 'Create Account'
                    : 'Sign In'
            }
          </h2>
          <p className="text-gray-600 text-sm">
            {isForceChange
              ? 'You signed in with a temporary password. Choose a new permanent password to continue.'
              : isForgotPassword
                ? 'Enter your email to receive a reset link'
                : isSignUp
                  ? 'Join the production management system'
                  : 'Access your production dashboard'
            }
          </p>
        </div>

        {/* Toggle (hidden during reset / forced change) */}
        {!isPasswordReset && !isForceChange && !isForgotPassword && (
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                !isSignUp
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                isSignUp
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={
          isPasswordReset || isForceChange
            ? handlePasswordReset
            : isForgotPassword
              ? handleForgotPassword
              : isSignUp
                ? handleSignUp
                : handleSignIn
        } onKeyPress={handleKeyPress}>
          
          {/* Forgot Password Form */}
          {isForgotPassword ? (
            <>
              <div className="mb-6">
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-blue-900">
                    {resetEmailSent 
                      ? "Check your email for the password reset link. It may take a few minutes to arrive."
                      : "Enter your email address and we'll send you a link to reset your password."
                    }
                  </AlertDescription>
                </Alert>
              </div>

              {!resetEmailSent && (
                <div className="mb-4">
                  <Label htmlFor="resetEmail" className="text-sm font-medium text-black mb-2 block">
                    Email Address *
                  </Label>
                  {resetEmail && !editingResetEmail ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                      <span className="text-sm text-black truncate">{resetEmail}</span>
                      <button
                        type="button"
                        onClick={() => setEditingResetEmail(true)}
                        className="text-xs text-gray-600 hover:text-black underline shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <Input
                      id="resetEmail"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      placeholder="Enter your email"
                      className="bg-white border-gray-300 focus:border-black focus:ring-black"
                    />
                  )}
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {!resetEmailSent && (
                <Button
                  type="submit"
                  className="w-full h-12 bg-black text-white hover:bg-gray-800 font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Reset Link...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              )}

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetEmailSent(false);
                    setResetEmail('');
                    setEditingResetEmail(false);
                    setError('');
                  }}
                  className="text-sm text-gray-600 hover:text-black"
                >
                  Back to Sign In
                </button>
              </div>
            </>
          ) : isPasswordReset || isForceChange ? (
            <>
              <div className="mb-6">
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-blue-900">
                    {isForceChange
                      ? 'For security, you must replace your temporary password before continuing.'
                      : 'Please enter your new password below.'}
                  </AlertDescription>
                </Alert>
              </div>

              <div className="mb-4">
                <Label htmlFor="newPassword" className="text-sm font-medium text-black mb-2 block">
                  New Password *
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Enter your new password"
                    minLength={8}
                    className="bg-white border-gray-300 focus:border-black focus:ring-black pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <Label htmlFor="confirmNewPassword" className="text-sm font-medium text-black mb-2 block">
                  Confirm New Password *
                </Label>
                <div className="relative">
                  <Input
                    id="confirmNewPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    placeholder="Confirm your new password"
                    minLength={8}
                    className="bg-white border-gray-300 focus:border-black focus:ring-black pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-black text-white hover:bg-gray-800 font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  isForceChange ? 'Set New Password' : 'Reset Password'
                )}
              </Button>

              {!isForceChange && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordReset(false);
                      window.history.replaceState({}, document.title, "/auth");
                    }}
                    className="text-sm text-gray-600 hover:text-black"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {isSignUp && (
            <>
              <div className="mb-4">
                <Label htmlFor="fullName" className="text-sm font-medium text-black mb-2 block">
                  Full Name *
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Enter your full name"
                  className="bg-white border-gray-300 focus:border-black focus:ring-black"
                />
              </div>

              <div className="mb-4">
                <Label htmlFor="jobTitle" className="text-sm font-medium text-black mb-2 block">
                  Job Title
                </Label>
                <Input
                  id="jobTitle"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Enter your job title"
                  className="bg-white border-gray-300 focus:border-black focus:ring-black"
                />
              </div>
            </>
          )}

          <div className="mb-4">
            <Label htmlFor="email" className="text-sm font-medium text-black mb-2 block">
              {isSignUp ? 'Company Email *' : 'Email *'}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleEmailBlur}
              required
              placeholder={isSignUp ? "name@pharmvista.com" : "Enter your email"}
              className="bg-white border-gray-300 focus:border-black focus:ring-black"
            />
            {emailError && (
              <p className="text-red-600 text-xs mt-1">{emailError}</p>
            )}
          </div>

          <div className="mb-4">
            <Label htmlFor="password" className="text-sm font-medium text-black mb-2 block">
              Password *
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                minLength={6}
                className="bg-white border-gray-300 focus:border-black focus:ring-black pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div className="mb-4">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-black mb-2 block">
                Confirm Password *
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  minLength={6}
                  className="bg-white border-gray-300 focus:border-black focus:ring-black pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {!isSignUp && (
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="rememberMe" className="text-sm text-gray-600">
                  Remember me
                </Label>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setResetEmail(email);
                  setEditingResetEmail(!email);
                  setError('');
                }}
                className="text-sm text-gray-600 hover:text-black"
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full h-12 bg-black text-white hover:bg-gray-800 font-semibold"
            disabled={isLoading || (isSignUp && emailError !== '')}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isSignUp ? 'Creating Account...' : 'Signing In...'}
              </>
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </Button>
            </>
          )}
        </form>
        <div className="mt-6 pt-6 border-t text-center text-sm">
          <span className="text-muted-foreground">Are you a customer? </span>
          <a href={`${getCustomerPortalOrigin()}/`} className="font-medium underline underline-offset-4">
            Sign in to the Customer Portal →
          </a>
        </div>
      </div>
    </div>
  );
};

export default Auth;