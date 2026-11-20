import { useState, type ReactNode } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { DownloadResult } from '@/api/client';
import { daysBetween, todayIso, daysAgoIso } from '@/lib/format';
import { useAction } from '@/hooks/useAction';
import { Button } from './Button';
import { ErrorNotice, Notice } from './Feedback';
import { Field, Input } from './Form';
import { Modal } from './Overlay';

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <header className="mb-5">
      {back && (
        <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({ title, description, actions, children, padded = true, className }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; padded?: boolean; className?: string }) {
  return (
    <section className={clsx('rounded-panel border border-line bg-white', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? 'p-4' : undefined}>{children}</div>
    </section>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-3">{children}</div>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={clsx('-mb-px whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition-colors',
            value === t.id ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Date-ranged CSV/JSON export. Reports are downloads, not JSON objects, so the response is saved straight to a file.
 * `maxDays` mirrors the API's 366-day limit so people get the message before the request.
 */
export function ExportDialog({ open, onClose, title, description, maxDays, defaultDays = 30, children, onExport }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  maxDays?: number;
  defaultDays?: number;
  children?: ReactNode;
  onExport: (range: { from: string; to: string }) => Promise<DownloadResult>;
}) {
  const [from, setFrom] = useState(daysAgoIso(defaultDays));
  const [to, setTo] = useState(todayIso());
  const [done, setDone] = useState<DownloadResult | null>(null);
  const { run, busy, error } = useAction();
  const span = from && to ? daysBetween(from, to) : NaN;
  const problem = !from || !to ? 'Choose both dates.' : span < 0 ? 'The start date must be on or before the end date.' : maxDays && span > maxDays ? `The range can’t be longer than ${maxDays} days.` : null;

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm" dismissible={!busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
        <Button variant="primary" icon={<Download className="h-4 w-4" />} loading={busy} disabled={!!problem}
          onClick={async () => { setDone(null); const r = await run(() => onExport({ from, to })); if (r.ok && r.value) setDone(r.value); }}>
          Download
        </Button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To (inclusive)"><Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        {children}
        {problem && <p className="text-xs text-bad">{problem}</p>}
        <ErrorNotice error={error} />
        {done && <Notice tone="success" title="Download started">{done.filename}{done.rowCount ? ` with ${done.rowCount} rows` : ''}. Treat the file as confidential.</Notice>}
      </div>
    </Modal>
  );
}
