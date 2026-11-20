import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { paymentsApi } from '@/api/payments';
import { dayEndUtc, dayStartUtc, fmtDateTime } from '@/lib/format';
import { shortId, titleCase } from '@/lib/helpers';
import { PAYMENT_PROVIDERS, PAYMENT_STATUSES, REFUND_STATUSES, type AdminPayment, type ReconciliationJob, type Refund, type WebhookEvent } from '@/types/payments';
import { useJobsStore, usePaymentsStore, useRefundsStore, useWebhooksStore } from '@/stores/paymentsStore';
import { useAction } from '@/hooks/useAction';
import { toast } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';
import { Field, Input, SearchBox, Select, Textarea } from '@/components/ui/Form';
import { Badge, EmptyState, ErrorNotice, Notice, StatusBadge } from '@/components/ui/Feedback';
import { PagedTable, type Column } from '@/components/ui/Table';
import { ConfirmDialog, Modal } from '@/components/ui/Overlay';
import { ExportDialog, FilterBar, PageHeader, Tabs } from '@/components/ui/Common';
import { Money } from '@/components/ui/Data';
import { PaymentDrawer } from './PaymentDrawer';

type TabId = 'payments' | 'refunds' | 'jobs' | 'webhooks';

const PaymentLink = ({ id, onOpen }: { id?: string; onOpen: (id: string) => void }) =>
  id ? <button type="button" className="text-primary hover:underline" onClick={(e) => { e.stopPropagation(); onOpen(id); }}>{shortId(id)}</button> : <span className="text-ink-faint">—</span>;

/* ---------------- Payments ---------------- */
function PaymentsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const state = usePaymentsStore();
  const { filters, setFilters, resetFilters, load } = state;
  useEffect(() => { void load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<AdminPayment>[] = [
    { key: 'created', header: 'Created', cell: (p) => <span className="whitespace-nowrap">{fmtDateTime(p.created_at)}</span> },
    { key: 'booking', header: 'Booking', cell: (p) => <span className="font-medium">{p.booking_reference ?? shortId(p.booking_id)}</span> },
    { key: 'provider', header: 'Provider', cell: (p) => titleCase(p.provider) },
    { key: 'type', header: 'Type', cell: (p) => titleCase(p.payment_option) },
    { key: 'amount', header: 'Amount', right: true, cell: (p) => <Money minor={p.amount_minor} currency={p.currency} className="font-medium" /> },
    { key: 'refunded', header: 'Refunded', right: true, cell: (p) => <Money minor={p.amount_refunded_minor} currency={p.currency} /> },
    { key: 'status', header: 'Status', cell: (p) => <span className="inline-flex flex-wrap gap-1"><StatusBadge status={p.status} />{p.reconciliation_required && <Badge tone="warn">Reconcile</Badge>}{p.amount_refund_pending_minor > 0 && <Badge tone="info">Refund pending</Badge>}</span> },
  ];

  return (
    <>
      <FilterBar>
        <Field label="Status"><Select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}><option value="">All statuses</option>{PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></Field>
        <Field label="Provider"><Select value={filters.provider} onChange={(e) => setFilters({ provider: e.target.value })}><option value="">All providers</option>{PAYMENT_PROVIDERS.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></Field>
        <Field label="Reconciliation"><Select value={filters.reconciliation_required} onChange={(e) => setFilters({ reconciliation_required: e.target.value })}><option value="">Any</option><option value="true">Needs reconciliation</option><option value="false">In sync</option></Select></Field>
        <Field label="Booking ID"><SearchBox value={filters.booking_id} onCommit={(v) => setFilters({ booking_id: v })} placeholder="Booking ID" className="sm:w-56" /></Field>
        <Button variant="ghost" onClick={resetFilters}>Clear filters</Button>
      </FilterBar>
      <PagedTable state={state} columns={columns} rowKey={(p) => p.id} onRowClick={(p) => onOpen(p.id)} empty={<EmptyState title="No payments match" description="Try clearing the filters." />} />
    </>
  );
}

/* ---------------- Refund attempts ---------------- */
function ReconcileRefundModal({ refund, onClose }: { refund: Refund | null; onClose: () => void }) {
  const reconcile = useRefundsStore((s) => s.reconcile);
  const { run, busy, error, reset } = useAction();
  const [outcome, setOutcome] = useState<'succeeded' | 'failed' | ''>('');
  const [reason, setReason] = useState('');
  const [ref, setRef] = useState('');
  useEffect(() => { if (refund) { setOutcome(''); setReason(''); setRef(''); reset(); } }, [refund, reset]);
  if (!refund) return null;
  return (
    <Modal open onClose={onClose} title="Record the provider’s result" size="sm" dismissible={!busy}
      description="Only record what you’ve verified with the provider. This is audited and can’t be undone."
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" loading={busy} disabled={!outcome || reason.trim().length < 10}
          onClick={async () => { const r = await run(() => reconcile(refund.id, { outcome: outcome as 'succeeded' | 'failed', reason: reason.trim(), provider_refund_reference: ref.trim() || undefined }), { success: 'Refund result recorded' }); if (r.ok) onClose(); }}>
          Record result
        </Button>
      </>}>
      <div className="space-y-3">
        <p className="text-sm">Refund of <Money minor={refund.amount_minor} currency={refund.currency} className="font-semibold" />, created {fmtDateTime(refund.created_at)}.</p>
        <Field label="What did the provider report?" required>
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as 'succeeded' | 'failed')}><option value="">Choose an outcome</option><option value="succeeded">The refund succeeded</option><option value="failed">The refund failed</option></Select>
        </Field>
        {outcome === 'succeeded' && <Field label="Provider refund reference" hint="Optional, up to 200 characters"><Input maxLength={200} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>}
        <Field label="Evidence and reason" required hint="At least 10 characters. For example where you checked and what you saw."><Textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <ErrorNotice error={error} />
      </div>
    </Modal>
  );
}

function RefundsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const state = useRefundsStore();
  const { filters, setFilters, resetFilters, load } = state;
  const [target, setTarget] = useState<Refund | null>(null);
  useEffect(() => { void load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<Refund>[] = [
    { key: 'created', header: 'Created', cell: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.created_at)}</span> },
    { key: 'payment', header: 'Payment', cell: (r) => <PaymentLink id={r.payment_id} onOpen={onOpen} /> },
    { key: 'amount', header: 'Amount', right: true, cell: (r) => <Money minor={r.amount_minor} currency={r.currency} className="font-medium" /> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'reason', header: 'Reason', cell: (r) => <span className="line-clamp-2 max-w-xs">{r.reason}</span> },
    { key: 'detail', header: 'Provider detail', cell: (r) => r.failure_code ?? r.provider_refund_reference ?? <span className="text-ink-faint">—</span> },
    { key: 'act', header: <span className="sr-only">Actions</span>, right: true, cell: (r) => r.status === 'requires_reconciliation' ? <Button size="sm" variant="primary" onClick={() => setTarget(r)}>Record result</Button> : null },
  ];

  return (
    <>
      <FilterBar>
        <Field label="Status"><Select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}><option value="">All statuses</option>{REFUND_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></Field>
        <Field label="Payment ID"><SearchBox value={filters.payment_id} onCommit={(v) => setFilters({ payment_id: v })} placeholder="Payment ID" className="sm:w-56" /></Field>
        <Button variant="ghost" onClick={resetFilters}>Clear filters</Button>
      </FilterBar>
      <Notice tone="info" className="mb-4">Processing and submitting refunds are still pending, not complete. Only “requires reconciliation” needs a person to record the provider’s result.</Notice>
      <PagedTable state={state} columns={columns} rowKey={(r) => r.id} empty={<EmptyState title="No refund attempts" />} />
      <ReconcileRefundModal refund={target} onClose={() => setTarget(null)} />
    </>
  );
}

/* ---------------- Reconciliation jobs ---------------- */
function JobsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const state = useJobsStore();
  const { filters, setFilters, load, retry } = state;
  const [target, setTarget] = useState<ReconciliationJob | null>(null);
  useEffect(() => { void load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<ReconciliationJob>[] = [
    { key: 'job', header: 'Job', cell: (j) => <span className="text-ink-muted">{shortId(j.id)}</span> },
    { key: 'payment', header: 'Payment', cell: (j) => <PaymentLink id={j.payment_id} onOpen={onOpen} /> },
    { key: 'status', header: 'Status', cell: (j) => <StatusBadge status={j.status} /> },
    { key: 'attempts', header: 'Attempts', right: true, cell: (j) => j.attempts },
    { key: 'error', header: 'Last error', cell: (j) => j.last_error_code ?? <span className="text-ink-faint">—</span> },
    { key: 'last', header: 'Last attempt', cell: (j) => <span className="whitespace-nowrap">{fmtDateTime(j.last_attempt_at)}</span> },
    { key: 'act', header: <span className="sr-only">Actions</span>, right: true, cell: (j) => j.status === 'dead_letter' ? <Button size="sm" onClick={() => setTarget(j)}>Retry</Button> : null },
  ];

  return (
    <>
      <FilterBar>
        <Field label="Status"><Select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}><option value="">All jobs</option><option value="queued">Queued</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="dead_letter">Dead letter</option></Select></Field>
      </FilterBar>
      <Notice tone="info" className="mb-4">These jobs re-check payments with the provider in the background. Only dead-lettered jobs can be retried by hand.</Notice>
      <PagedTable state={state} columns={columns} rowKey={(j) => j.id} empty={<EmptyState title="No reconciliation jobs" />} />
      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} confirmLabel="Retry job" title="Retry this dead-lettered job?"
        description="The job goes back in the queue and the retry is audited."
        onConfirm={async () => { if (target) { await retry(target.id); toast.success('Job returned to the queue'); } }} />
    </>
  );
}

/* ---------------- Webhook events ---------------- */
function WebhooksTab({ onOpen }: { onOpen: (id: string) => void }) {
  const state = useWebhooksStore();
  const { filters, setFilters, load } = state;
  useEffect(() => { void load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<WebhookEvent>[] = [
    { key: 'received', header: 'Received', cell: (w) => <span className="whitespace-nowrap">{fmtDateTime(w.received_at)}</span> },
    { key: 'provider', header: 'Provider', cell: (w) => titleCase(w.provider) },
    { key: 'type', header: 'Event', cell: (w) => <span className="font-medium">{w.event_type}</span> },
    { key: 'id', header: 'Provider event ID', cell: (w) => <span className="text-ink-muted" title={w.provider_event_id}>{shortId(w.provider_event_id, 12)}</span> },
    { key: 'status', header: 'Status', cell: (w) => <StatusBadge status={w.status} /> },
    { key: 'fail', header: 'Failure', cell: (w) => w.failure_code ?? <span className="text-ink-faint">—</span> },
    { key: 'payment', header: 'Payment', cell: (w) => <PaymentLink id={w.payment_id} onOpen={onOpen} /> },
  ];

  return (
    <>
      <FilterBar>
        <Field label="Status"><Select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}><option value="">All statuses</option><option value="received">Received</option><option value="processed">Processed</option><option value="failed">Failed</option></Select></Field>
        <Field label="Provider"><Select value={filters.provider} onChange={(e) => setFilters({ provider: e.target.value })}><option value="">All providers</option>{PAYMENT_PROVIDERS.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></Field>
      </FilterBar>
      <Notice tone="info" className="mb-4">Read-only. Providers send webhooks straight to the server; this app never calls them. A webhook’s status isn’t the customer’s payment status.</Notice>
      <PagedTable state={state} columns={columns} rowKey={(w) => w.id} empty={<EmptyState title="No webhook events" />} />
    </>
  );
}

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const tab = (['payments', 'refunds', 'jobs', 'webhooks'].includes(params.get('tab') ?? '') ? params.get('tab') : 'payments') as TabId;
  const paymentId = params.get('payment');
  const [exporting, setExporting] = useState(false);
  const [exportFilters, setExportFilters] = useState({ currency: '', provider: '', status: '' });

  const setTab = (t: TabId) => setParams({ tab: t });
  const open = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('payment', id); return n; });
  const close = () => setParams((p) => { const n = new URLSearchParams(p); n.delete('payment'); return n; }, { replace: true });

  return (
    <>
      <PageHeader title="Payments" description="Inspect payments, settle exceptions and manage refunds."
        actions={<Button icon={<Download className="h-4 w-4" />} onClick={() => setExporting(true)}>Export report</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'payments', label: 'Payments' }, { id: 'refunds', label: 'Refund attempts' },
        { id: 'jobs', label: 'Reconciliation jobs' }, { id: 'webhooks', label: 'Webhook events' },
      ]} />
      {tab === 'payments' && <PaymentsTab onOpen={open} />}
      {tab === 'refunds' && <RefundsTab onOpen={open} />}
      {tab === 'jobs' && <JobsTab onOpen={open} />}
      {tab === 'webhooks' && <WebhooksTab onOpen={open} />}

      <PaymentDrawer paymentId={paymentId} onClose={close} />

      <ExportDialog open={exporting} onClose={() => setExporting(false)} title="Export payments" maxDays={366}
        description="Payment records created in the range, as CSV (up to 366 days, 10,000 rows). Net amounts count succeeded payments only, and it isn’t a settlement ledger."
        onExport={({ from, to }) => paymentsApi.exportCsv({ from: dayStartUtc(from), to: dayEndUtc(to), currency: exportFilters.currency.trim().toUpperCase() || undefined, provider: exportFilters.provider || undefined, status: exportFilters.status || undefined })}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Currency"><Input maxLength={3} className="uppercase" placeholder="All" value={exportFilters.currency} onChange={(e) => setExportFilters({ ...exportFilters, currency: e.target.value })} /></Field>
          <Field label="Provider"><Select value={exportFilters.provider} onChange={(e) => setExportFilters({ ...exportFilters, provider: e.target.value })}><option value="">All</option>{PAYMENT_PROVIDERS.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></Field>
          <Field label="Status"><Select value={exportFilters.status} onChange={(e) => setExportFilters({ ...exportFilters, status: e.target.value })}><option value="">All</option>{PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></Field>
        </div>
      </ExportDialog>
    </>
  );
}

