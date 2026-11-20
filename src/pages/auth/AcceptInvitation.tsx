import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useAction } from '@/hooks/useAction';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { ErrorNotice, Notice } from '@/components/ui/Feedback';
import { AuthLayout } from './AuthLayout';

export default function AcceptInvitation() {
  const [params, setParams] = useSearchParams();
  // Capture the one-time token, then remove it from the address bar and history.
  const [token, setToken] = useState(params.get('token') ?? '');
  useEffect(() => { if (params.has('token')) setParams({}, { replace: true }); }, [params, setParams]);

  const { run, busy, error } = useAction();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const ok = token.trim().length >= 32 && password.length >= 12 && password.length <= 72 && password === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => authApi.acceptInvitation({ token: token.trim(), password }));
    if (r.ok) { setDone(true); setPassword(''); setConfirm(''); setToken(''); }
  };

  if (done) {
    return (
      <AuthLayout title="Your account is ready" description="Sign in with your new password. You’ll set up an authenticator app on first sign-in.">
        <Link to="/login"><Button variant="primary" className="w-full">Go to sign in</Button></Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Accept your invitation" description="Choose a password to activate your staff account.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {!token && <Field label="Invitation token" required hint="Paste the token from your invitation email."><Input value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" /></Field>}
        <Field label="Password" required hint="12 to 72 characters."><Input type="password" autoComplete="new-password" autoFocus maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Confirm password" required error={mismatch ? 'The passwords don’t match.' : undefined}><Input type="password" autoComplete="new-password" maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <ErrorNotice error={error} />
        {error?.status === 404 && <Notice tone="warn">This invitation link isn’t valid anymore. Ask an owner to send a new one.</Notice>}
        <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!ok}>Activate account</Button>
      </form>
    </AuthLayout>
  );
}
