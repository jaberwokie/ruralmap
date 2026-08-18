/**
 * Password reset landing page.
 *
 * Users arrive here via the password recovery email link. Supabase places
 * a `type=recovery` token in the URL hash and establishes a temporary
 * session. We then let the user set a new password via `updateUser`.
 *
 * Public route — must NOT be gated by auth.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Supabase recovery links arrive in one of three shapes depending on the
    // project's flow type:
    //   1. ?code=...                       (PKCE)
    //   2. ?token_hash=...&type=recovery   (token hash / email OTP)
    //   3. #access_token=...&type=recovery (implicit; SDK parses the hash)
    // Handle all three, and also allow an already-signed-in user to change
    // their password here.
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (cancelled) return;
        setRecovery(true);
        setReady(true);
      }
    });

    const stripTokensFromUrl = () => {
      const clean = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, '', clean);
    };

    const resolve = async () => {
      const url = new URL(window.location.href);
      const query = url.searchParams;
      const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));

      const code = query.get('code');
      const tokenHash = query.get('token_hash') ?? query.get('token');
      const type = query.get('type') ?? hash.get('type');
      const errorDescription =
        query.get('error_description') ?? hash.get('error_description');

      // 1. PKCE code exchange
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (!error) {
          stripTokensFromUrl();
          setRecovery(true);
          setReady(true);
          return;
        }
        setErrorMsg(error.message);
      }

      // 2. Token hash verification
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        });
        if (cancelled) return;
        if (!error) {
          stripTokensFromUrl();
          setRecovery(true);
          setReady(true);
          return;
        }
        setErrorMsg(error.message);
      }

      // 3. Implicit hash flow — the SDK sets the session from the hash itself.
      if (hash.get('access_token') || type === 'recovery') {
        // Give the SDK a moment to parse the hash and emit PASSWORD_RECOVERY.
        await new Promise((r) => setTimeout(r, 600));
        if (cancelled) return;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          stripTokensFromUrl();
          setRecovery(true);
          setReady(true);
          return;
        }
      }

      // 4. Already authenticated — allow an in-place password change.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setRecovery(true);
        setReady(true);
        return;
      }

      if (errorDescription) setErrorMsg(errorDescription);
      setReady(true);
    };

    resolve();

    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, []);


  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setInfoMsg('Password updated. Redirecting to sign in…');
        await supabase.auth.signOut();
        setTimeout(() => navigate('/auth', { replace: true }), 1200);
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
            Set a new password
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground leading-snug">
            Enter and confirm a new password for your account.
          </p>
        </div>

        {ready && !recovery ? (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
              {errorMsg
                ? `${errorMsg} Request a new reset link from the sign-in page.`
                : 'This reset link is invalid or has expired. Request a new one from the sign-in page.'}
            </div>
            <Link
              to="/auth"
              className="block text-center w-full rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-foreground mb-1">New password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-foreground mb-1">Confirm new password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
                minLength={6}
              />
            </div>

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
              {submitting ? 'Working…' : 'Update password'}
            </button>
          </form>
        )}

        <div className="mt-4 text-[11px] text-muted-foreground">
          <Link to="/auth" className="hover:text-foreground underline decoration-dotted underline-offset-2">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
