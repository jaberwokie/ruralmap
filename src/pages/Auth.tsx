/**
 * Staff sign-in / sign-up page.
 *
 * - Email + password only (Lovable Cloud managed).
 * - On successful auth, redirects to `/`.
 * - Sign-up uses `emailRedirectTo: window.location.origin` so the confirmation
 *   link returns the user to the app.
 * - This page is public; the rest of the app stays read-only by default until
 *   role is resolved by `AuthProvider`.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/contexts/AuthContext';

type Mode = 'signin' | 'signup' | 'forgot';

const Auth = () => {
  const navigate = useNavigate();
  const { isAuthenticated, ready } = usePermissions();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (ready && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [ready, isAuthenticated, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email) {
      setErrorMsg('Email is required.');
      return;
    }
    if (mode !== 'forgot' && !password) {
      setErrorMsg('Password is required.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setErrorMsg(error.message);
        } else {
          navigate('/', { replace: true });
        }
      } else if (mode === 'signup') {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) {
          setErrorMsg(error.message);
        } else {
          setInfoMsg('Account created. If email confirmation is required, check your inbox to finish signing in.');
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          setErrorMsg(error.message);
        } else {
          setInfoMsg('If an account exists for that email, a password reset link has been sent. Check your inbox.');
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Nevada Behavioral Health
          </div>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {mode === 'forgot' ? 'Reset your password' : 'Staff Sign In'}
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground leading-snug">
            {mode === 'forgot'
              ? 'Enter the email associated with your account. We will send you a link to set a new password.'
              : 'The Rural Access Operations environment is read-only for the public. Sign in with an authorized staff account to access write controls.'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-foreground mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-foreground">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setErrorMsg(null); setInfoMsg(null); }}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
                minLength={6}
              />
            </div>
          )}

          {errorMsg && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div className="rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-[11px] text-foreground">
              {infoMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting
              ? 'Working…'
              : mode === 'signin'
                ? 'Sign In'
                : mode === 'signup'
                  ? 'Create Account'
                  : 'Send reset link'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => { setMode('signin'); setErrorMsg(null); setInfoMsg(null); }}
              className="hover:text-foreground underline decoration-dotted underline-offset-2"
            >
              Back to sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErrorMsg(null); setInfoMsg(null); }}
              className="hover:text-foreground underline decoration-dotted underline-offset-2"
            >
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          )}
          <Link to="/" className="hover:text-foreground underline decoration-dotted underline-offset-2">
            Back to map
          </Link>
        </div>
      </div>
    </div>
  );
};
      </div>
    </div>
  );
};

export default Auth;
