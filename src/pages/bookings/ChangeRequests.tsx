import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingsApi } from '@/api/bookings';
import { fmtDateTime } from '@/lib/format';
import { getId, isRec, pick, pickNum, pickStr, titleCase } from '@/lib/helpers';
import type { ChangeRequestDetail, ModificationOffer } from '@/types/bookings';
import type { Rec } from '@/types/common';
import { useChangeRequestsStore } from '@/stores/bookingsStore';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Form';
import { Badge, EmptyState, ErrorNotice, ErrorState, LoadingBlock, Notice, StatusBadge } from '@/components/ui/Feedback';
import { PagedTable, type Column } from '@/components/ui/Table';
import { ConfirmDialog, Drawer } from '@/components/ui/Overlay';
import { FilterBar, PageHeader, Panel } from '@/components/ui/Common';
import { AutoTable } from '@/components/ui/AutoTable';
import { KeyValueList, Money } from '@/components/ui/Data';

const crBookingRef = (r: Rec) => pickStr(r, 'booking.reference', 'booking_reference', 'booking.booking_reference') ?? pickStr(r, 'booking_id', 'booking.id') ?? '—';
const crBookingId = (r: Rec) => pickStr(r, 'booking_id', 'booking.id', 'booking._id');

function OfferPanel({ offer }: { offer: ModificationOffer }) {
  const currency = pickStr(offer.price_breakdown, 'currency');
  const expired = Date.parse(offer.expires_at) < Date.now();
  const delta = offer.payment_delta_minor;
  return (
    <Panel title="Offer sent to the customer" description="Calculated by the server. Applying it needs the customer’s confirmation.">
      <div className="space-y-3 text-sm">
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5">
          <dt className="text-ink-muted">Pickup</dt><dd>{fmtDateTime(offer.pickup.dateTime)}{offer.pickup.locationName && <span className="block text-[13px] text-ink-muted">{offer.pickup.locationName} ({titleCase(offer.pickup_type)})</span>}</dd>
          <dt className="text-ink-muted">Drop-off</dt><dd>{fmtDateTime(offer.dropoff.dateTime)}{offer.dropoff.locationName && <span className="block text-[13px] text-ink-muted">{offer.dropoff.locationName} ({titleCase(offer.dropoff_type)})</span>}</dd>
          <dt className="text-ink-muted">Offer expires</dt><dd>{fmtDateTime(offer.expires_at)} {expired && <Badge tone="danger">Expired</Badge>}</dd>
          <dt className="text-ink-muted">{delta > 0 ? 'Extra payment due' : delta < 0 ? 'Refund to customer' : 'Price change'}</dt>
          <dd className="font-medium">{delta === 0 ? 'No change' : <Money minor={Math.abs(delta)} currency={currency} />}</dd>
        </dl>
        <details><summary className="cursor-pointer text-[13px] font-medium text-primary">Price breakdown</summary><div className="mt-2"><KeyValueList data={offer.price_breakdown} currency={currency} /></div></details>
      </div>
    </Panel>
  );
}

function RequestDrawer({ summary, onClose }: { summary: Rec | null; onClose: () => void }) {
  const id = summary ? getId(summary) : '';
  const review = useChangeRequestsStore((s) => s.review);
  const detail = useAsync(() => bookingsApi.changeRequest(id), [id], !!summary);
  const history = useAsync(() => bookingsApi.changeRequestReviews(id), [id], !!summary);
  const [deciding, setDeciding] = useState<'approved' | 'rejected' | null>(null);
  const [outcome, setOutcome] = useState<Rec | null>(null);
  useEffect(() => { setOutcome(null); }, [id]);

  const d = (detail.data?.data ?? {}) as ChangeRequestDetail;
  const merged: Rec = { ...(summary ?? {}), ...d };
  const status = pickStr(merged, 'status');
  const type = pickStr(merged, 'type', 'request_type');
  const pending = status === 'pending';
  const bookingId = summary ? crBookingId(summary) ?? crBookingId(merged) : undefined;
  const policy = d.cancellation_policy;
  const attempts = (d.refund_attempts ?? (outcome ? (pick(outcome, 'refund_attempts') as unknown[] | undefined)?.filter(isRec) : undefined) ?? []) as Rec[];

  return (
    <>
      <Drawer open={!!summary} onClose={onClose} wide title={summary ? `${titleCase(type ?? 'Change')} request` : ''}
        description={summary && <span className="inline-flex items-center gap-2">Booking {bookingId ? <Link className="text-primary underline" to={`/bookings/${bookingId}`}>{crBookingRef(summary)}</Link> : crBookingRef(summary)} <StatusBadge status={status} /></span>}
        actions={pending && <>
          <Button size="sm" variant="danger" onClick={() => setDeciding('rejected')}>Reject</Button>
          <Button size="sm" variant="primary" onClick={() => setDeciding('approved')}>Approve</Button>
        </>}>
        {detail.loading && !detail.data && <LoadingBlock />}
        {detail.error && <ErrorState error={detail.error} onRetry={() => void detail.reload()} />}
        {detail.data && (
          <div className="space-y-5">
            {outcome && (
              <Notice tone="success" title={`Request ${pickStr(outcome, 'status') ?? 'reviewed'}`}>
                {type === 'modification' && pickStr(outcome, 'status') === 'approved' ? 'The customer has been notified that an offer is ready. Nothing changes on the booking until they confirm.' : 'The customer has been notified.'}
              </Notice>
            )}
            {d.confirmation_failure_code && <Notice tone="warn" title="Customer confirmation failed">{d.confirmation_failure_code}</Notice>}
            {d.confirmed_at && <Notice tone="success">Customer confirmed on {fmtDateTime(d.confirmed_at)}.</Notice>}

            <Panel title="Request"><KeyValueList data={merged} omit={['offer', 'cancellation_policy', 'refund_attempts', 'booking', 'customer']} /></Panel>

            {d.offer && <OfferPanel offer={d.offer} />}

            {policy && (
              <Panel title="Refund estimate" description="An estimate from current policy and captured payments. It doesn’t start or guarantee a refund.">
                <dl className="grid grid-cols-[10rem_1fr] gap-y-1.5 text-sm">
                  <dt className="text-ink-muted">Hours until pickup</dt><dd>{policy.hours_until_pickup.toLocaleString()}</dd>
                  <dt className="text-ink-muted">Refund percent</dt><dd>{policy.refund_percent}%</dd>
                  <dt className="text-ink-muted">Estimated refund</dt><dd className="font-medium"><Money minor={policy.estimated_refund_minor} currency={policy.currency} /></dd>
                  <dt className="text-ink-muted">Calculated</dt><dd>{fmtDateTime(policy.calculated_at)}</dd>
                </dl>
              </Panel>
            )}

            {attempts.length > 0 && (
              <Panel title="Refund attempts" description="Created by an approved cancellation. Pending outcomes aren’t complete.">
                <ul className="divide-y divide-line text-sm">
                  {attempts.map((a) => (
                    <li key={getId(a)} className="flex items-center justify-between gap-3 py-2">
                      <Money minor={pickNum(a, 'amount_minor')} currency={pickStr(a, 'currency')} />
                      <StatusBadge status={pickStr(a, 'status')} />
                    </li>
                  ))}
                </ul>
                {attempts.some((a) => pickStr(a, 'status') === 'requires_reconciliation') && <Notice tone="warn" className="mt-3">A provider result was uncertain. Reconcile it in <Link className="underline" to="/payments?tab=refunds">Payments</Link>.</Notice>}
              </Panel>
            )}

            <Panel title="Review history" padded={false}>
              <div className="p-3">{history.loading ? <LoadingBlock /> : history.error ? <ErrorNotice error={history.error} /> : history.data && history.data.data.length ? <AutoTable rows={history.data.data.filter(isRec)} /> : <p className="py-4 text-center text-sm text-ink-faint">Not reviewed yet.</p>}</div>
            </Panel>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={!!deciding} onClose={() => setDeciding(null)} tone={deciding === 'rejected' ? 'danger' : 'primary'}
        confirmLabel={deciding === 'approved' ? 'Approve request' : 'Reject request'}
        title={`${deciding === 'approved' ? 'Approve' : 'Reject'} this ${type ?? 'change'} request?`}
        description={deciding === 'approved'
          ? type === 'cancellation' ? 'The booking is cancelled, availability is released and policy-eligible refunds are reserved. The provider is contacted after saving.' : 'The server prepares a new priced offer for the customer. The booking only changes after they confirm.'
          : 'The customer is told the request was declined. The booking stays as it is.'}
        reason={{ label: 'Decision notes', min: 1, max: 2000, placeholder: 'Shared in the review history' }}
        onConfirm={async (notes) => {
          const res = await review(id, deciding!, notes);
          setOutcome(res);
          toast.success(deciding === 'approved' ? 'Request approved' : 'Request rejected');
          void detail.reload(); void history.reload();
        }} />
    </>
  );
}

export default function ChangeRequests() {
  const state = useChangeRequestsStore();
  const { filters, setFilters, load, items } = state;
  const [selected, setSelected] = useState<Rec | null>(null);
  useEffect(() => { void load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const current = selected ? items.find((r) => getId(r) === getId(selected)) ?? selected : null;

  const columns: Column<Rec>[] = [
    { key: 'booking', header: 'Booking', cell: (r) => <span className="font-medium">{crBookingRef(r)}</span> },
    { key: 'type', header: 'Request', cell: (r) => <StatusBadge status={pickStr(r, 'type', 'request_type')} /> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={pickStr(r, 'status')} /> },
    { key: 'customer', header: 'Customer', cell: (r) => pickStr(r, 'customer.full_name', 'customer.name', 'customer_name') ?? <span className="text-ink-faint">—</span> },
    { key: 'created', header: 'Requested', cell: (r) => <span className="whitespace-nowrap">{fmtDateTime(pick(r, 'created_at', 'requested_at'))}</span> },
  ];

  return (
    <>
      <PageHeader title="Change requests" description="Cancellation and modification requests from customers, waiting for a decision." />
      <FilterBar>
        <Field label="Status"><Select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}><option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></Select></Field>
        <Field label="Type"><Select value={filters.type} onChange={(e) => setFilters({ type: e.target.value })}><option value="">All types</option><option value="cancellation">Cancellation</option><option value="modification">Modification</option></Select></Field>
      </FilterBar>
      <PagedTable state={state} columns={columns} rowKey={getId} onRowClick={setSelected}
        empty={<EmptyState title={filters.status === 'pending' ? 'Nothing waiting for review' : 'No requests match'} description="New customer requests show up here as they arrive." />} />
      <RequestDrawer summary={current} onClose={() => setSelected(null)} />
    </>
  );
}
