import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, Lock, RefreshCw, WifiOff, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { detailLines, type ApiError } from '@/api/errors';
import { titleCase } from '@/lib/helpers';
import { useUiStore } from '@/stores/uiStore';
import { Button } from './Button';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-4 w-4 animate-spin text-ink-muted', className)} aria-label="Loading" />;
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted" role="status">
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="lane-dash mb-4 h-10 w-[3px]" aria-hidden />
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const tones = {
  info: { box: 'border-info/25 bg-info-soft text-[#17487F]', Icon: Info },
  warn: { box: 'border-lane/50 bg-lane-soft text-lane-ink', Icon: AlertTriangle },
  success: { box: 'border-ok/25 bg-ok-soft text-[#165E3D]', Icon: CheckCircle2 },
  danger: { box: 'border-bad/25 bg-bad-soft text-[#8E1E18]', Icon: XCircle },
} as const;

export function Notice({ tone = 'info', title, children, className }: { tone?: keyof typeof tones; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { box, Icon } = tones[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={clsx('flex gap-2.5 rounded-md border px-3 py-2.5 text-sm', box, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={clsx(title && 'mt-0.5', 'break-words')}>{children}</div>}
      </div>
    </div>
  );
}

/** Turns any ApiError into guidance an operator can act on. */
export function ErrorNotice({ error, onReload, className }: { error: ApiError | null; onReload?: () => void; className?: string }) {
  if (!error) return null;
  const lines = detailLines(error.details);
  let title = 'Something went wrong';
  let hint: string | null = null;
  let Icon = XCircle;
  if (error.isNetwork) { title = 'Service unreachable'; Icon = WifiOff; }
  else if (error.isForbidden) { title = 'Permission denied'; Icon = Lock; hint = 'Your role doesn’t allow this. Ask an owner if you need access.'; }
  else if (error.isStale) { title = 'This record has changed'; hint = 'Someone or something updated it since you opened it. Reload to see the current state, then try again.'; }
  else if (error.isRateLimited) { title = 'Too many requests'; hint = error.retryAfterSeconds ? `Try again in ${error.retryAfterSeconds} seconds.` : 'Wait a moment, then try again.'; }
  else if (error.isServer) { title = 'The service is having trouble'; hint = 'Nothing was confirmed. Check the current state before retrying.'; }
  else if (error.isNotFound) { title = 'Not found'; }
  else if (error.status === 400) { title = 'Check the details and try again'; }
  return (
    <div role="alert" className={clsx('rounded-md border border-bad/25 bg-bad-soft px-3 py-2.5 text-sm text-[#8E1E18]', className)}>
      <div className="flex gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="break-words">{error.message}</p>
          {lines.length > 0 && <ul className="mt-1 list-disc pl-4">{lines.slice(0, 6).map((l, i) => <li key={i}>{l}</li>)}</ul>}
          {hint && <p className="mt-1 text-[#8E1E18]/90">{hint}</p>}
          {error.requestId && <p className="mt-1 text-xs opacity-70">Request ID: {error.requestId}</p>}
          {error.isStale && onReload && (
            <Button size="sm" className="mt-2" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onReload}>Reload latest</Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Full-panel load failure with retry. */
export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <ErrorNotice error={error} />
      {onRetry && <div className="mt-3 text-center"><Button onClick={onRetry} icon={<RefreshCw className="h-4 w-4" />}>Try again</Button></div>}
    </div>
  );
}

type BadgeTone = 'neutral' | 'success' | 'warn' | 'danger' | 'info';
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-black/5 text-ink-muted',
  success: 'bg-ok-soft text-ok',
  warn: 'bg-lane-soft text-lane-ink',
  danger: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium', badgeTones[tone], className)}>{children}</span>;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  succeeded: 'success', success: 'success', active: 'success', approved: 'success', processed: 'success', completed: 'success', confirmed: 'success', verified: 'success', released: 'neutral',
  pending: 'warn', requires_action: 'warn', processing: 'warn', submitting: 'warn', queued: 'warn', received: 'warn', partially_refunded: 'warn', requires_reconciliation: 'warn',
  failed: 'danger', cancelled: 'danger', rejected: 'danger', dead_letter: 'danger', suspended: 'danger', inactive: 'neutral',
  accepted_by_driver: 'info', on_going: 'info', refunded: 'info', modification: 'info', cancellation: 'warn',
};
/** Raw API status strings, shown as the API returned them (only title-cased). */
export function StatusBadge({ status }: { status?: unknown }) {
  if (status === undefined || status === null || status === '') return <span className="text-ink-faint">—</span>;
  const s = String(status);
  return <Badge tone={STATUS_TONE[s] ?? 'neutral'}>{titleCase(s)}</Badge>;
}

export function Toaster() {
  const { toasts, dismiss } = useUiStore();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role="status" className={clsx('pointer-events-auto flex animate-fade items-start gap-2 rounded-md px-3 py-2.5 text-sm shadow-pop', t.tone === 'error' ? 'bg-bad text-white' : 'bg-road text-white')}>
          <span className="min-w-0 flex-1 break-words">{t.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="rounded p-0.5 hover:bg-white/15"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}
