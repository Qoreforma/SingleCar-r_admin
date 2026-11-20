import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, History, Lock } from 'lucide-react';
import { bookingsApi } from '@/api/bookings';
import { paymentsApi } from '@/api/payments';
import { toPaged } from '@/api/pagination';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { extractList, getId, isRec, pick, pickStr, titleCase } from '@/lib/helpers';
import type { Rec } from '@/types/common';
import type { AdminPayment } from '@/types/payments';
import { useAsync } from '@/hooks/useAsync';
import { useAction } from '@/hooks/useAction';
import { useBookingsStore } from '@/stores/bookingsStore';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Form';
import { EmptyState, ErrorNotice, ErrorState, LoadingBlock, Notice, StatusBadge } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Overlay';
import { DataTable, Pager, type Column } from '@/components/ui/Table';
import { AutoTable } from '@/components/ui/AutoTable';
import { KeyValueList, Money } from '@/components/ui/Data';
import { DocumentReviewModal } from './BookingDialogs';

/* ---------------- Documents ---------------- */

function ReviewHistory({ bookingId, doc, onClose }: { bookingId: string; doc: Rec | null; onClose: () => void }) {
  const code = doc ? pickStr(doc, 'code', 'document_code', 'type') ?? '' : '';
  const history = useAsync(() => bookingsApi.documentReviews(bookingId, code), [bookingId, code], !!doc);
  return (
    <Modal open={!!doc} onClose={onClose} size="lg" title="Review history" description="Every decision, oldest to newest. Entries are append-only.">
      {history.loading && <LoadingBlock />}
      {history.error && <ErrorState error={history.error} onRetry={() => void history.reload()} />}
      {history.data && (history.data.data.length ? <AutoTable rows={history.data.data.filter(isRec)} /> : <p className="py-6 text-center text-sm text-ink-faint">No reviews yet.</p>)}
    </Modal>
  );
}

export function DocumentsTab({ bookingId, canReview }: { bookingId: string; canReview: boolean }) {
  const revision = useBookingsStore((s) => s.revision);
  const docs = useAsync(() => bookingsApi.documents(bookingId), [bookingId, revision]);
  const [reviewing, setReviewing] = useState<Rec | null>(null);
  const [history, setHistory] = useState<Rec | null>(null);

  if (docs.loading && !docs.data) return <LoadingBlock />;
  if (docs.error) return <ErrorState error={docs.error} onRetry={() => void docs.reload()} />;
  const rows = (docs.data?.data ?? []).filter(isRec);
  if (!rows.length) return <EmptyState title="No documents required" description="This booking has no documents waiting for review." />;

  return (
    <>
      <ul className="divide-y divide-line rounded-md border border-line">
        {rows.map((d) => {
          const code = pickStr(d, 'code', 'document_code', 'type') ?? getId(d);
          return (
            <li key={code} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{pickStr(d, 'label', 'name', 'title') ?? titleCase(code)} <StatusBadge status={pickStr(d, 'status', 'review_status')} /></p>
                <p className="text-[13px] text-ink-muted">
                  {pick(d, 'uploaded_at', 'created_at') ? `Uploaded ${fmtDateTime(pick(d, 'uploaded_at', 'created_at'))}` : 'Not uploaded yet'}
                  {pickStr(d, 'notes', 'review_notes') && <span className="block">Last note: {pickStr(d, 'notes', 'review_notes')}</span>}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" icon={<History className="h-3.5 w-3.5" />} onClick={() => setHistory(d)}>History</Button>
                {canReview && <Button size="sm" variant="primary" icon={<ClipboardCheck className="h-3.5 w-3.5" />} onClick={() => setReviewing(d)}>Review</Button>}
              </div>
            </li>
          );
        })}
      </ul>
      <DocumentReviewModal open={!!reviewing} onClose={() => setReviewing(null)} bookingId={bookingId} doc={reviewing} />
      <ReviewHistory bookingId={bookingId} doc={history} onClose={() => setHistory(null)} />
    </>
  );
}

/* ---------------- Activity ---------------- */

function eventRow(e: Rec): { title: string; when?: unknown; who?: string; text?: string; extra: Rec } {
  const title = titleCase(pickStr(e, 'action', 'event_type', 'type', 'event', 'status') ?? 'Event');
  const from = pickStr(e, 'from_status', 'before.status', 'previous_status');
  const to = pickStr(e, 'to_status', 'after.status', 'new_status');
  const text = pickStr(e, 'reason', 'notes', 'note', 'message', 'summary', 'description') ?? (from && to ? `${titleCase(from)} to ${titleCase(to)}` : undefined);
  return { title, when: pick(e, 'created_at', 'at', 'timestamp', 'occurred_at'), who: pickStr(e, 'actor_name', 'actor.full_name', 'actor.name', 'created_by_name', 'by'), text, extra: e };
}

function Timeline({ items, empty }: { items: Rec[]; empty: ReactNode }) {
  if (!items.length) return <>{empty}</>;
  return (
    <ol className="relative ml-2 space-y-4 border-l-2 border-line pl-5">
      {items.map((e, i) => {
        const r = eventRow(e);
        return (
          <li key={getId(e) || i} className="relative">
            <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" aria-hidden />
            <p className="text-sm font-medium">{r.title}</p>
            <p className="text-[13px] text-ink-muted">{[r.who, fmtDateTime(r.when)].filter(Boolean).join(', ')}</p>
            {r.text && <p className="mt-1 text-sm">{r.text}</p>}
            <details className="mt-1 text-[13px] text-ink-muted"><summary className="cursor-pointer">Details</summary><div className="mt-2"><KeyValueList data={r.extra} /></div></details>
          </li>
        );
      })}
    </ol>
  );
}

export function ActivityTab({ bookingId }: { bookingId: string }) {
  const revision = useBookingsStore((s) => s.revision);
  const [page, setPage] = useState(1);
  const activity = useAsync(async () => {
    const env = await bookingsApi.activity(bookingId, { page, limit: 15 });
    const paged = toPaged<Rec>(env, { page, limit: 15 });
    return paged.items.length ? paged : { ...paged, items: extractList(env.data) };
  }, [bookingId, page, revision]);
  if (activity.loading && !activity.data) return <LoadingBlock />;
  if (activity.error) return <ErrorState error={activity.error} onRetry={() => void activity.reload()} />;
  const d = activity.data!;
  return (
    <div>
      <p className="mb-3 text-[13px] text-ink-muted">What you see depends on your permissions. Private notes, document reviews and location or driver changes only appear if you can access them.</p>
      <Timeline items={d.items} empty={<EmptyState title="No activity yet" />} />
      <div className="mt-3"><Pager page={d.page} totalPages={d.totalPages} total={d.total} hasNext={d.hasNext} hasPrev={d.hasPrev} loading={activity.loading} onPage={setPage} /></div>
    </div>
  );
}

/* ---------------- Internal notes ---------------- */

export function NotesTab({ bookingId, canAdd }: { bookingId: string; canAdd: boolean }) {
  const { revision, addNote } = useBookingsStore();
  const notes = useAsync(() => bookingsApi.internalEvents(bookingId), [bookingId, revision]);
  const [text, setText] = useState('');
  const { run, busy, error } = useAction();

  return (
    <div className="space-y-4">
      <Notice tone="info" title="Staff only">
        <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" aria-hidden /> These notes are never shown to the customer.</span>
      </Notice>
      {canAdd && (
        <div className="space-y-2">
          <Field label="Add a note"><Textarea maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Context for the next person who handles this booking" /></Field>
          <ErrorNotice error={error} onReload={() => void notes.reload()} />
          <Button variant="primary" loading={busy} disabled={!text.trim()} onClick={async () => { const r = await run(() => addNote(bookingId, text.trim()), { success: 'Note added' }); if (r.ok) setText(''); }}>Add note</Button>
        </div>
      )}
      {notes.loading && !notes.data && <LoadingBlock />}
      {notes.error && <ErrorState error={notes.error} onRetry={() => void notes.reload()} />}
      {notes.data && (
        <ul className="space-y-3">
          {notes.data.data.filter(isRec).map((n, i) => (
            <li key={getId(n) || i} className="rounded-md border border-line bg-paper/50 px-3 py-2.5 text-sm">
              <p className="whitespace-pre-wrap break-words">{pickStr(n, 'note', 'message', 'body', 'text', 'summary') ?? '—'}</p>
              <p className="mt-1 text-xs text-ink-muted">{[pickStr(n, 'actor_name', 'author_name', 'created_by_name', 'actor.full_name'), fmtDateTime(pick(n, 'created_at', 'at'))].filter(Boolean).join(', ')}</p>
            </li>
          ))}
          {notes.data.data.length === 0 && <li><EmptyState title="No internal notes yet" /></li>}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Payments for this booking ---------------- */

export function PaymentsTab({ bookingId }: { bookingId: string }) {
  const revision = useBookingsStore((s) => s.revision);
  const payments = useAsync(() => paymentsApi.list({ page: 1, limit: 20, booking_id: bookingId }), [bookingId, revision]);
  const columns: Column<AdminPayment>[] = [
    { key: 'amount', header: 'Amount', cell: (p) => <Money minor={p.amount_minor} currency={p.currency} className="font-medium" /> },
    { key: 'refunded', header: 'Refunded', cell: (p) => <Money minor={p.amount_refunded_minor} currency={p.currency} /> },
    { key: 'option', header: 'Type', cell: (p) => titleCase(p.payment_option) },
    { key: 'provider', header: 'Provider', cell: (p) => titleCase(p.provider) },
    { key: 'status', header: 'Status', cell: (p) => <span className="inline-flex gap-1.5"><StatusBadge status={p.status} />{p.reconciliation_required && <StatusBadge status="requires_reconciliation" />}</span> },
    { key: 'created', header: 'Created', cell: (p) => fmtDate(p.created_at) },
    { key: 'open', header: <span className="sr-only">Open</span>, right: true, cell: (p) => <Link className="text-sm text-primary hover:underline" to={`/payments?payment=${p.id}`}>Open</Link> },
  ];
  return (
    <div className="rounded-md border border-line">
      <DataTable columns={columns} rows={payments.data?.items ?? []} rowKey={(p) => p.id} loading={payments.loading && !payments.data} error={payments.error} onRetry={() => void payments.reload()}
        empty={<EmptyState title="No payments recorded" description="Payments appear here once the customer starts checkout." />} />
    </div>
  );
}
