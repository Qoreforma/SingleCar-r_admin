import { useState } from 'react';
import { CalendarPlus, LockOpen, Shuffle } from 'lucide-react';
import { fleetApi } from '@/api/fleet';
import { bookingsApi } from '@/api/bookings';
import { toPaged } from '@/api/pagination';
import { dayEndUtc, dayStartUtc, daysBetween, fmtDateTime, localInputToIso, todayIso } from '@/lib/format';
import { extractList, getId, getVersion, pickStr } from '@/lib/helpers';
import type { Rec } from '@/types/common';
import { useAsync } from '@/hooks/useAsync';
import { useAction } from '@/hooks/useAction';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Form';
import { ErrorNotice, ErrorState, LoadingBlock, Notice, StatusBadge } from '@/components/ui/Feedback';
import { ConfirmDialog, Modal } from '@/components/ui/Overlay';
import { Pager } from '@/components/ui/Table';
import { AutoSections } from '@/components/ui/AutoTable';

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const MAX_BLOCK_DAYS = 90;

type Conflicts = Awaited<ReturnType<typeof fleetApi.conflicts>>['data'];

function ConflictList({ data }: { data: Conflicts }) {
  const bookings = data.conflicting_bookings ?? [];
  const blocks = data.conflicting_blocks ?? [];
  if (!bookings.length && !blocks.length) return <Notice tone="success">No bookings or other blocks overlap this window.</Notice>;
  return (
    <div className="space-y-3 text-sm">
      {bookings.length > 0 && (
        <Notice tone="warn" title={`${bookings.length} ${bookings.length === 1 ? 'booking overlaps' : 'bookings overlap'} this window`}>
          <ul className="mt-1 space-y-1">
            {bookings.map((b, i) => <li key={b.id ?? i}>{b.reference ?? b.id} <StatusBadge status={b.status} /> {fmtDateTime(b.pickup_at)} to {fmtDateTime(b.dropoff_at)}</li>)}
          </ul>
        </Notice>
      )}
      {blocks.length > 0 && (
        <Notice tone="warn" title={`${blocks.length} other ${blocks.length === 1 ? 'block overlaps' : 'blocks overlap'}`}>
          <ul className="mt-1 space-y-1">{blocks.map((b, i) => <li key={b.id ?? i}>{b.reason ?? 'Maintenance'} {fmtDateTime(b.starts_at)} to {fmtDateTime(b.ends_at)}</li>)}</ul>
        </Notice>
      )}
    </div>
  );
}

/** Creating a block is a two-step flow: check what it would collide with, then confirm. */
function BlockModal({ carId, open, onClose, onChanged }: { carId: string; open: boolean; onClose: () => void; onChanged: () => void }) {
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState<{ key: string; data: Conflicts } | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const check = useAction();
  const create = useAction();

  const s = localInputToIso(starts), e = localInputToIso(ends);
  const key = `${s}|${e}`;
  const span = s && e ? (Date.parse(e) - Date.parse(s)) / 86_400_000 : 0;
  const problem = !s || !e ? null : Date.parse(e) <= Date.parse(s) ? 'The end must be after the start.' : Date.parse(s) < Date.now() ? 'Blocks must start in the future.' : span > MAX_BLOCK_DAYS ? `A block can’t be longer than ${MAX_BLOCK_DAYS} days.` : null;
  const current = checked?.key === key ? checked.data : null;
  const hasConflicts = !!current && ((current.conflicting_bookings?.length ?? 0) + (current.conflicting_blocks?.length ?? 0) > 0);
  const canCreate = !!current && !problem && reason.trim().length >= 3 && (!hasConflicts || reviewed);

  const reset = () => { setStarts(''); setEnds(''); setReason(''); setChecked(null); setReviewed(false); check.reset(); create.reset(); };
  const close = () => { reset(); onClose(); };

  return (
    <Modal open={open} onClose={close} title="Add maintenance block" size="md" dismissible={!create.busy}
      description="Takes this car out of availability for a future window (up to 90 days)."
      footer={<>
        <Button variant="ghost" onClick={close} disabled={create.busy}>Cancel</Button>
        <Button variant="primary" loading={create.busy} disabled={!canCreate}
          onClick={async () => { const r = await create.run(() => fleetApi.createBlock(carId, { starts_at: s!, ends_at: e!, reason: reason.trim() }), { success: 'Maintenance block added' }); if (r.ok) { onChanged(); close(); } }}>
          Add block
        </Button>
      </>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts" required hint="Your local time"><Input type="datetime-local" value={starts} onChange={(x) => { setStarts(x.target.value); setReviewed(false); }} /></Field>
          <Field label="Ends" required><Input type="datetime-local" value={ends} min={starts} onChange={(x) => { setEnds(x.target.value); setReviewed(false); }} /></Field>
        </div>
        {problem && <p className="text-xs text-bad">{problem}</p>}
        <Field label="Reason" required hint="3 to 500 characters"><Textarea maxLength={500} value={reason} onChange={(x) => setReason(x.target.value)} /></Field>

        <div className="rounded-md border border-line p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Check conflicts first</p>
            <Button size="sm" loading={check.busy} disabled={!s || !e || !!problem}
              onClick={async () => { const r = await check.run(() => fleetApi.conflicts(carId, { starts_at: s!, ends_at: e! })); if (r.ok && r.value) { setChecked({ key, data: r.value.data }); setReviewed(false); } }}>
              Check window
            </Button>
          </div>
          <div className="mt-2 space-y-2">
            <ErrorNotice error={check.error} />
            {current ? <ConflictList data={current} /> : <p className="text-[13px] text-ink-muted">{checked ? 'The dates changed. Check the window again.' : 'See which bookings and blocks overlap before you add this block.'}</p>}
            {hasConflicts && <Checkbox label="I’ve reviewed these conflicts" hint="Existing bookings must be rescheduled separately after the block exists." checked={reviewed} onChange={(x) => setReviewed(x.target.checked)} />}
          </div>
        </div>
        <ErrorNotice error={create.error} />
      </div>
    </Modal>
  );
}

/** Moves a booking out of a maintenance block. The new range keeps the original rental length. */
function RescheduleForm({ carId, blockId, booking, onDone }: { carId: string; blockId: string; booking: { id?: string; reference?: string; pickup_at?: string; dropoff_at?: string }; onDone: () => void }) {
  const detail = useAsync(() => bookingsApi.get(String(booking.id)), [booking.id]);
  const { run, busy, error } = useAction();
  const [pickup, setPickup] = useState('');
  const duration = Date.parse(booking.dropoff_at ?? '') - Date.parse(booking.pickup_at ?? '');
  const pickupIso = localInputToIso(pickup);
  const dropoffIso = pickupIso && Number.isFinite(duration) ? new Date(Date.parse(pickupIso) + duration).toISOString() : undefined;

  return (
    <div className="mt-3 rounded-md border border-primary/30 bg-primary-soft/40 p-3">
      <p className="mb-2 text-sm font-medium">Reschedule {booking.reference ?? booking.id}</p>
      {detail.loading && <LoadingBlock />}
      {detail.error && <ErrorNotice error={detail.error} />}
      {detail.data && (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-muted">Currently {fmtDateTime(booking.pickup_at)} to {fmtDateTime(booking.dropoff_at)}. The new range must keep the rental length and avoid this block and every other booking or block.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New pickup" required hint="Your local time"><Input type="datetime-local" value={pickup} onChange={(e) => setPickup(e.target.value)} /></Field>
            <Field label="New drop-off" hint="Calculated from the rental length"><Input readOnly value={dropoffIso ? fmtDateTime(dropoffIso) : ''} placeholder="—" /></Field>
          </div>
          <ErrorNotice error={error} onReload={() => void detail.reload()} />
          <Button variant="primary" loading={busy} disabled={!pickupIso || !dropoffIso}
            onClick={async () => {
              const r = await run(() => fleetApi.rescheduleBooking(carId, blockId, { booking_id: String(booking.id), expected_version: getVersion(detail.data?.data), pickup_at: pickupIso!, dropoff_at: dropoffIso! }), { success: 'Booking rescheduled. The customer was notified.' });
              if (r.ok) onDone();
            }}>
            Reschedule booking
          </Button>
        </div>
      )}
    </div>
  );
}

function ResolveModal({ carId, block, onClose, onChanged }: { carId: string; block: Rec | null; onClose: () => void; onChanged: () => void }) {
  const start = pickStr(block, 'starts_at') ?? '';
  const end = pickStr(block, 'ends_at') ?? '';
  const conflicts = useAsync(() => fleetApi.conflicts(carId, { starts_at: start, ends_at: end }), [carId, start, end], !!block);
  const [target, setTarget] = useState<NonNullable<Conflicts['conflicting_bookings']>[number] | null>(null);
  const bookings = conflicts.data?.data.conflicting_bookings ?? [];

  return (
    <Modal open={!!block} onClose={() => { setTarget(null); onClose(); }} size="lg" title="Bookings affected by this block"
      description={block ? `${fmtDateTime(start)} to ${fmtDateTime(end)}` : undefined}>
      {conflicts.loading && <LoadingBlock />}
      {conflicts.error && <ErrorState error={conflicts.error} onRetry={() => void conflicts.reload()} />}
      {conflicts.data && (bookings.length === 0 ? <Notice tone="success">No bookings overlap this block.</Notice> : (
        <ul className="divide-y divide-line rounded-md border border-line text-sm">
          {bookings.map((b, i) => (
            <li key={b.id ?? i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div>
                <p className="font-medium">{b.reference ?? b.id} <StatusBadge status={b.status} /></p>
                <p className="text-[13px] text-ink-muted">{fmtDateTime(b.pickup_at)} to {fmtDateTime(b.dropoff_at)}</p>
              </div>
              <Button size="sm" icon={<Shuffle className="h-3.5 w-3.5" />} onClick={() => setTarget(b)}>Reschedule</Button>
            </li>
          ))}
        </ul>
      ))}
      {target && block && <RescheduleForm key={target.id} carId={carId} blockId={getId(block)} booking={target} onDone={() => { setTarget(null); onChanged(); void conflicts.reload(); }} />}
    </Modal>
  );
}

export function AvailabilityTab({ carId }: { carId: string }) {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(addDays(todayIso(), 30));
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [releasing, setReleasing] = useState<Rec | null>(null);
  const [resolving, setResolving] = useState<Rec | null>(null);

  const rangeOk = from && to && daysBetween(from, to) >= 0 && daysBetween(from, to) <= 30;
  const calendar = useAsync(() => fleetApi.calendar(carId, { from: dayStartUtc(from), to: dayEndUtc(to) }), [carId, from, to], !!rangeOk);
  const blocks = useAsync(async () => {
    const env = await fleetApi.blocks(carId, { page, limit: 8, status: status || undefined });
    const paged = toPaged<Rec>(env, { page, limit: 8 });
    return paged.items.length ? paged : { ...paged, items: extractList(env.data) };
  }, [carId, status, page]);
  const refresh = () => { void calendar.reload(); void blocks.reload(); };

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-sm font-semibold">Schedule</h3>
          <div className="flex items-end gap-2">
            <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To" hint="Up to 31 days"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
        </div>
        {!rangeOk && <p className="text-xs text-bad">Choose a range of up to 31 days.</p>}
        {calendar.loading && <LoadingBlock />}
        {calendar.error && <ErrorState error={calendar.error} onRetry={() => void calendar.reload()} />}
        {calendar.data && <AutoSections data={calendar.data.data} />}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Maintenance blocks</h3>
          <div className="flex items-center gap-2">
            <Select aria-label="Block status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-32">
              <option value="active">Active</option><option value="released">Released</option><option value="">All</option>
            </Select>
            <Button variant="primary" size="sm" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add block</Button>
          </div>
        </div>
        {blocks.loading && !blocks.data && <LoadingBlock />}
        {blocks.error && <ErrorState error={blocks.error} onRetry={() => void blocks.reload()} />}
        {blocks.data && (blocks.data.items.length === 0 ? <p className="rounded-md border border-line py-6 text-center text-sm text-ink-faint">No {status || ''} blocks.</p> : (
          <div className="rounded-md border border-line">
            <ul className="divide-y divide-line text-sm">
              {blocks.data.items.map((b) => {
                const active = (pickStr(b, 'status') ?? 'active') === 'active';
                return (
                  <li key={getId(b)} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium">{pickStr(b, 'reason') ?? 'Maintenance'} <StatusBadge status={pickStr(b, 'status') ?? 'active'} /></p>
                      <p className="text-[13px] text-ink-muted">{fmtDateTime(pickStr(b, 'starts_at'))} to {fmtDateTime(pickStr(b, 'ends_at'))}</p>
                    </div>
                    {active && (
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => setResolving(b)}>Affected bookings</Button>
                        <Button size="sm" variant="danger" icon={<LockOpen className="h-3.5 w-3.5" />} onClick={() => setReleasing(b)}>Release</Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pager page={blocks.data.page} totalPages={blocks.data.totalPages} total={blocks.data.total} hasNext={blocks.data.hasNext} hasPrev={blocks.data.hasPrev} loading={blocks.loading} onPage={setPage} />
          </div>
        ))}
      </section>

      <BlockModal carId={carId} open={adding} onClose={() => setAdding(false)} onChanged={() => { setPage(1); refresh(); }} />
      <ResolveModal carId={carId} block={resolving} onClose={() => setResolving(null)} onChanged={refresh} />
      <ConfirmDialog open={!!releasing} onClose={() => setReleasing(null)} title="Release this maintenance block?" confirmLabel="Release block" tone="danger"
        description={releasing ? `The car becomes bookable again for ${fmtDateTime(pickStr(releasing, 'starts_at'))} to ${fmtDateTime(pickStr(releasing, 'ends_at'))}.` : undefined}
        onConfirm={async () => { if (releasing) { await fleetApi.releaseBlock(carId, getId(releasing)); refresh(); } }} />
    </div>
  );
}
