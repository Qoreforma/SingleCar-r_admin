import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Download } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useAction } from '@/hooks/useAction';
import { saveBlob } from '@/lib/download';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input } from '@/components/ui/Form';
import { ErrorNotice, LoadingBlock, Notice } from '@/components/ui/Feedback';
import { AuthLayout } from './AuthLayout';

function Credentials() {
  const { login, notice, clearNotice } = useAuthStore();
  const { run, busy, error } = useAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    clearNotice();
    await run(() => login(email.trim(), password));
  };

  return (
    <AuthLayout title="Sign in" description="Use your staff account. You’ll confirm with an authenticator code next.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {notice && <Notice tone="info">{notice}</Notice>}
        <Field label="Work email" required><Input type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" required><Input type="password" autoComplete="current-password" required maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <ErrorNotice error={error} />
        <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!email || !password}>Continue</Button>
        <p className="text-center text-sm"><Link to="/forgot-password" className="text-primary hover:underline">Forgot your password?</Link></p>
      </form>
    </AuthLayout>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }}>
      {copied ? 'Copied' : label}
    </Button>
  );
}

function Mfa() {
  const { phase, setup, verifyMfa, cancelMfa } = useAuthStore();
  const enrolling = phase === 'mfa_setup';
  const { run, busy, error } = useAction();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);

  const normalized = recovery ? code.replace(/[\s-]/g, '') : code.replace(/\s/g, '');
  const valid = recovery ? /^[A-Fa-f0-9]{16}$/.test(normalized) : /^\d{6}$/.test(normalized);

  const submit = async (e: FormEvent) => { e.preventDefault(); if (valid) await run(() => verifyMfa(normalized)); };
  const groupedSecret = setup?.secret.match(/.{1,4}/g)?.join(' ') ?? '';
  const expired = error && (error.status === 401 || error.status === 400) && /expire|token|challenge/i.test(error.message);

  return (
    <AuthLayout
      title={enrolling ? 'Set up two-step sign-in' : 'Enter your code'}
      description={enrolling ? 'Scan this with an authenticator app, then enter the 6-digit code it shows.' : recovery ? 'Enter one of your recovery codes. Each works once.' : 'Open your authenticator app and enter the current 6-digit code.'}
      footer={<button type="button" onClick={cancelMfa} className="text-primary hover:underline">Back to sign in</button>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {enrolling && setup && (
          <div className="space-y-3">
            <div className="inline-block rounded-md border border-line bg-white p-3"><QRCodeSVG value={setup.otpAuthUrl} size={164} level="M" /></div>
            <div>
              <p className="text-[13px] text-ink-muted">Can’t scan? Enter this key manually:</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-paper px-2 py-1 text-[13px] tracking-wide">{groupedSecret}</code>
                <CopyButton text={setup.secret} label="Copy" />
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">Anyone with this key can generate your codes. Don’t share it.</p>
            </div>
          </div>
        )}
        <Field label={recovery ? 'Recovery code' : 'Authenticator code'} required>
          <Input autoFocus inputMode={recovery ? 'text' : 'numeric'} autoComplete="one-time-code" maxLength={recovery ? 19 : 7}
            className="tracking-[0.2em]" value={code} onChange={(e) => setCode(e.target.value)} placeholder={recovery ? '16 characters' : '123456'} />
        </Field>
        <ErrorNotice error={error} />
        {expired && <Notice tone="warn">This sign-in attempt has expired. Go back and sign in again.</Notice>}
        <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!valid}>{enrolling ? 'Finish setup' : 'Verify and sign in'}</Button>
        {!enrolling && (
          <p className="text-center text-sm">
            <button type="button" className="text-primary hover:underline" onClick={() => { setRecovery(!recovery); setCode(''); }}>
              {recovery ? 'Use an authenticator code instead' : 'Use a recovery code instead'}
            </button>
          </p>
        )}
      </form>
    </AuthLayout>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const text = codes.join('\n');
  return (
    <AuthLayout title="Save your recovery codes" description="If you lose your authenticator, each code signs you in once. They’re shown only now and can’t be retrieved later.">
      <div className="space-y-4">
        <ul className="grid grid-cols-2 gap-2 rounded-md border border-line bg-white p-3 text-sm" aria-label="Recovery codes">
          {codes.map((c) => <li key={c}><code className="tracking-wide">{c}</code></li>)}
        </ul>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={text} label="Copy all" />
          <Button size="sm" icon={<Download className="h-4 w-4" />} onClick={() => saveBlob(new Blob([`${text}\n`], { type: 'text/plain' }), 'recovery-codes.txt')}>Download</Button>
        </div>
        <Notice tone="warn">Store them in a password manager. Don’t keep them in email or chat.</Notice>
        <Checkbox label="I’ve saved these recovery codes somewhere safe" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <Button variant="primary" className="w-full" disabled={!saved} onClick={onDone}>Continue to dashboard</Button>
      </div>
    </AuthLayout>
  );
}

export default function Login() {
  const { phase, recoveryCodes, acknowledgeRecoveryCodes } = useAuthStore();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (phase === 'booting') return <LoadingBlock />;
  if (phase === 'authenticated' && recoveryCodes) return <RecoveryCodes codes={recoveryCodes} onDone={acknowledgeRecoveryCodes} />;
  if (phase === 'authenticated') return <Navigate to={from} replace />;
  if (phase === 'mfa' || phase === 'mfa_setup') return <Mfa />;
  return <Credentials />;
}
