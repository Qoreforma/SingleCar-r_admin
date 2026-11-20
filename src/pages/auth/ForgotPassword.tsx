import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useAction } from '@/hooks/useAction';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { ErrorNotice, Notice } from '@/components/ui/Feedback';
import { AuthLayout } from './AuthLayout';

type Step = 'email' | 'code' | 'password';

export default function ForgotPassword() {
  const nav = useNavigate();
  const { run, busy, error, reset } = useAction();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    // The API answers identically whether or not the email matches an active admin.
    const r = await run(() => authApi.forgotPassword(email.trim()));
    if (r.ok) setStep('code');
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => authApi.verifyResetOtp({ email: email.trim(), otp: otp.trim() }));
    if (r.ok && r.value) { setResetToken(r.value.data.resetToken); setStep('password'); }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => authApi.resetPassword({ token: resetToken, password }));
    if (r.ok) {
      useAuthStore.setState({ notice: 'Password updated. Every active session was signed out, so sign in with the new password.' });
      nav('/login', { replace: true });
    }
  };

  const mismatch = confirm.length > 0 && password !== confirm;
  const passwordOk = password.length >= 8 && password.length <= 72 && password === confirm;

  return (
    <AuthLayout
      title="Reset your password"
      description={step === 'email' ? 'Enter your work email and we’ll send a 6-digit code if it matches an active staff account.' : step === 'code' ? 'Enter the code from the email. It expires shortly.' : 'Choose a new password.'}
      footer={<Link to="/login" className="text-primary hover:underline">Back to sign in</Link>}>
      {step === 'email' && (
        <form onSubmit={sendCode} className="space-y-4" noValidate>
          <Field label="Work email" required><Input type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <ErrorNotice error={error} />
          <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!email.includes('@')}>Send code</Button>
        </form>
      )}
      {step === 'code' && (
        <form onSubmit={verify} className="space-y-4" noValidate>
          <Notice tone="info">If that email belongs to an active staff account, a code is on its way.</Notice>
          <Field label="6-digit code" required><Input inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} className="tracking-[0.3em]" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} /></Field>
          <ErrorNotice error={error} />
          <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={otp.length !== 6}>Verify code</Button>
          <p className="text-center text-sm"><button type="button" className="text-primary hover:underline" onClick={() => { reset(); setOtp(''); setStep('email'); }}>Use a different email</button></p>
        </form>
      )}
      {step === 'password' && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="New password" required hint="At least 8 characters. Longer is better; 12 or more is recommended."><Input type="password" autoComplete="new-password" autoFocus maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label="Confirm new password" required error={mismatch ? 'The passwords don’t match.' : undefined}><Input type="password" autoComplete="new-password" maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          <ErrorNotice error={error} />
          <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!passwordOk}>Update password</Button>
        </form>
      )}
    </AuthLayout>
  );
}
