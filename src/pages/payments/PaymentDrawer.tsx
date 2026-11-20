import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Undo2 } from 'lucide-react';
import { paymentsApi } from '@/api/payments';
import { toApiError } from '@/api/errors';
import { fmtDateTime, fmtMoney, toMinor } from '@/lib/format';
import { newKey, titleCase } from '@/lib/helpers';
import type { AdminPayment, Refund } from '@/types/payments';
import { useAsync } from '@/hooks/useAsync';
import { useAction } from '@/hooks/useAction';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { toast } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Form';
import { Badge, ErrorNotice, ErrorState, LoadingBlock, Notice, StatusBadge } from '@/components/ui/Feedback';
import { ConfirmDialog, Drawer, Modal } from '@/components/ui/Overlay';
import { Money } from '@/components/ui/Data';

function RefundOutcome({ refund }: { refund: Refund }) {
  const pending = refund.status === 'submitting' || refund.status === 'processing';
  if (refund.status === 'succeeded') return <Notice tone="success" title="Refund succeeded"><Money minor={refund.amount_minor} currency={refund.currency} /> was refunded.</Notice>;
  if (refund.status === 'failed') return <Notice tone="danger" title="Refund failed">{refund.failure_code ?? 'The provider rejected the refund.'}</Notice>;
  if (refund.status === 'requires_reconciliation') return <Notice tone="warn" title="Needs manual reconciliation">The provider result was uncertain. Confirm it with the provider, then record it under Refund attempts. Don’t submit another refund.</Notice>;
  return <Notice tone={pending ? 'info' : 'warn'} title="Refund submitted, outcome pending">The provider hasn’t confirmed it yet, so it isn’t complete. Check Refund attempts for the final result.</Notice>;
}

/** Form, then a review step, then submit. The idempotency key only changes when the refund details change. */
function RefundModal({ payment, open, onClose, onDone }: { payment: AdminPayment; open: boolean; onClose: () => void; onDone: () => void }) {
  const refund = usePaymentsStore((s) => s.refund);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [result, setResult] = useState<Refund | null>(null);
  const keyRef = useRef<{ fp: string; key: string } | null>(null);
  const { run, busy, error, reset } = useAction();
  useEffect(() => { if (open) { setAmount(''); setReason(''); setStep('form'); setResult(null); keyRef.current = null; reset(); } }, [open, reset]);

  const minor = toMinor(amount, payment.currency);
  const valid = minor !== null && minor >= 1 && reason.trim().length >= 3;

  const submit = async () => {
    if (minor === null) return;
    const fp = `${minor}|${reason.trim()}`;
    if (!keyRef.current || keyRef.current.fp !== fp) keyRef.current = { fp, key: newKey() };
    const key = keyRef.current.key;
    const r = await run(async () => {
      try { return await refund(payment.id, { amount_minor: minor, reason: reason.trim(), idempotency_key: key }); }
      catch (e) {
        // A definite rejection can use a fresh key next time; an unknown outcome must retry with the same one.
        if (!toApiError(e).outcomeUnknown) keyRef.current = null;
        throw e;
      }
    });
    if (r.ok) { setResult(r.value ?? null); onDone(); }
  };

  if (result) {
    return (
      <Modal open={open} onClose={onClose} title="Refund request sent" size="sm" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <RefundOutcome refund={result} />
      </Modal>
    );
  }

  const unknown = error?.outcomeUnknown;
  return (
    <Modal open={open} onClose={onClose} title="Refund payment" size="sm" dismissible={!busy}
      description={`Captured ${fmtMoney(payment.amount_minor, payment.currency)}. Already refunded ${fmtMoney(payment.amount_refunded_minor, payment.currency)}. Refund pending ${fmtMoney(payment.amount_refund_pending_minor, payment.currency)}.`}
      footer={step === 'form' ? (
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={() => setStep('review')}>Review refund</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" disabled={busy} onClick={() => setStep('form')}>Back</Button>
          <Button variant="dangerSolid" loading={busy} onClick={submit}>{unknown ? 'Retry refund' : 'Submit refund'}</Button>
        </>
      )}>
      {step === 'form' ? (
        <div className="space-y-3">
          <Field label={`Amount (${payment.currency})`} required hint="Full or partial. The server rejects amounts above what can still be refunded."
            error={amount && minor === null ? `Enter a positive amount with at most ${payment.currency === 'JPY' ? 0 : 2} decimals.` : undefined}>
            <Input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Reason" required hint="3 to 500 characters. Recorded with the refund."><Textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <Notice tone="warn" title="Check before you submit">This sends money back to the customer through {titleCase(payment.provider)}. It can’t be undone.</Notice>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5">
            <dt className="text-ink-muted">Refund</dt><dd className="font-semibold">{fmtMoney(minor, payment.currency)}</dd>
            <dt className="text-ink-muted">Booking</dt><dd>{payment.booking_reference ?? payment.booking_id}</dd>
            <dt className="text-ink-muted">Reason</dt><dd className="whitespace-pre-wrap break-words">{reason.trim()}</dd>
          </dl>
          {unknown && <Notice tone="warn" title="We couldn’t confirm the result">The refund may or may not have been created. Check Refund attempts first. Retrying here reuses the same request key, so it can’t create a duplicate.</Notice>}
          <ErrorNotice error={error} />
        </div>
      )}
    </Modal>
  );
}

export function PaymentDrawer({ paymentId, onClose }: { paymentId: string | null; onClose: () => void }) {
  const detail = useAsync(() => paymentsApi.get(paymentId!), [paymentId], !!paymentId);
  const refunds = useAsync(() => paymentsApi.refunds({ page: 1, limit: 20, payment_id: paymentId! }), [paymentId], !!paymentId);
  const reconcile = usePaymentsStore((s) => s.reconcile);
  const [refunding, setRefunding] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const p = detail.data?.data;
  const refresh = () => { void detail.reload(); void refunds.reload(); };

  return (
    <>
      <Drawer open={!!paymentId} onClose={onClose} title="Payment" description={p && <span className="inline-flex items-center gap-2"><StatusBadge status={p.status} />{p.reconciliation_required && <Badge tone="warn">Reconciliation required</Badge>}</span>}
        actions={p && <>
          <Button size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => setReconciling(true)}>Reconcile</Button>
          <Button size="sm" variant="danger" icon={<Undo2 className="h-3.5 w-3.5" />} onClick={() => setRefunding(true)}>Refund</Button>
        </>}>
        {detail.loading && !p && <LoadingBlock />}
        {detail.error && <ErrorState error={detail.error} onRetry={() => void detail.reload()} />}
        {p && (
          <div className="space-y-6">
            <dl className="grid grid-cols-[11rem_1fr] gap-y-2 text-sm">
              <dt className="text-ink-muted">Booking</dt><dd><Link className="text-primary underline" to={`/bookings/${p.booking_id}`}>{p.booking_reference ?? p.booking_id}</Link>{p.booking_status && <span className="ml-2"><StatusBadge status={p.booking_status} /></span>}</dd>
              <dt className="text-ink-muted">Booking payment state</dt><dd><StatusBadge status={p.booking_payment_status} /></dd>
              <dt className="text-ink-muted">Provider</dt><dd>{titleCase(p.provider)}</dd>
              <dt className="text-ink-muted">Payment type</dt><dd>{titleCase(p.payment_option)}</dd>
              <dt className="text-ink-muted">Amount</dt><dd className="font-semibold"><Money minor={p.amount_minor} currency={p.currency} /></dd>
              <dt className="text-ink-muted">Refunded</dt><dd><Money minor={p.amount_refunded_minor} currency={p.currency} /></dd>
              <dt className="text-ink-muted">Refund pending</dt><dd><Money minor={p.amount_refund_pending_minor} currency={p.currency} /></dd>
              <dt className="text-ink-muted">Created</dt><dd>{fmtDateTime(p.created_at)}</dd>
              <dt className="text-ink-muted">Paid</dt><dd>{fmtDateTime(p.paid_at)}</dd>
              <dt className="text-ink-muted">Provider reference</dt><dd className="break-all">{p.provider_reference ?? '—'}</dd>
              <dt className="text-ink-muted">Provider transaction</dt><dd className="break-all">{p.provider_transaction_reference ?? '—'}</dd>
              <dt className="text-ink-muted">Failure code</dt><dd>{p.failure_code ?? '—'}</dd>
              <dt className="text-ink-muted">Payment ID</dt><dd className="break-all">{p.id}</dd>
            </dl>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Refund attempts</h3>
              {refunds.loading && !refunds.data ? <LoadingBlock /> : refunds.error ? <ErrorNotice error={refunds.error} /> : refunds.data && refunds.data.items.length ? (
                <ul className="divide-y divide-line rounded-md border border-line text-sm">
                  {refunds.data.items.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <div><Money minor={r.amount_minor} currency={r.currency} className="font-medium" /><p className="text-[13px] text-ink-muted">{r.reason}, {fmtDateTime(r.created_at)}</p></div>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-ink-faint">No refunds on this payment.</p>}
            </section>
          </div>
        )}
      </Drawer>

      {p && <RefundModal payment={p} open={refunding} onClose={() => setRefunding(false)} onDone={refresh} />}
      <ConfirmDialog open={reconciling} onClose={() => setReconciling(false)} confirmLabel="Reconcile now"
        title="Reconcile with the provider?" description="Asks the provider for the payment’s current state and updates ours to match. Use it when a payment looks stuck or out of sync."
        onConfirm={async () => { await reconcile(paymentId!); toast.success('Reconciliation requested'); refresh(); }} />
    </>
  );
}
