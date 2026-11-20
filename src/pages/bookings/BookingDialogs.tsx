import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getId, isRec, pick, pickNum, pickStr, titleCase } from '@/lib/helpers';
import { BOOKING_STATUSES, type BookingStatus } from '@/types/bookings';
import type { Rec } from '@/types/common';
import { useBookingsStore } from '@/stores/bookingsStore';
import { useDriversStore } from '@/stores/driversStore';
import { useAction } from '@/hooks/useAction';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { ErrorNotice, Notice, StatusBadge } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Overlay';
import { Money } from '@/components/ui/Data';
import { bookingDriverId, bookingStatus, dropoffPlace, pickupPlace, isClosedBooking } from './bookingHelpers';

interface DialogProps { open: boolean; onClose: () => void; booking: Rec }

/** Textarea used by every action that writes a reason into the booking history. */
function ReasonField({ value, onChange, label = 'Reason' }: { value: string; onChange: (v: string) => void; label?: string }) {
  return <Field label={label} required hint="Recorded in the booking history. Up to 2,000 characters."><Textarea maxLength={2000} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
}

export function StatusDialog({ open, onClose, booking }: DialogProps) {
  const setStatus = useBookingsStore((s) => s.setStatus);
  const reload = useBookingsStore((s) => s.loadDetail);
  const id = getId(booking);
  const current = bookingStatus(booking);
  const [status, setValue] = useState<BookingStatus | ''>('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<Rec | null>(null);
  const { run, busy, error, reset } = useAction();
  useEffect(() => { if (open) { setValue(''); setReason(''); setResult(null); reset(); } }, [open, reset]);

  const submit = async () => {
    const r = await run(() => setStatus(id, status as BookingStatus, reason.trim()), { success: 'Status updated' });
    if (!r.ok) return;
    const attempts = r.value ? pick(r.value, 'refund_attempts') : undefined;
    if (status === 'cancelled' && Array.isArray(attempts) && attempts.length) setResult(r.value!);
    else onClose();
  };

  if (result) {
    const attempts = (pick(result, 'refund_attempts') as unknown[]).filter(isRec);
    return (
      <Modal open={open} onClose={onClose} title="Booking cancelled" size="md" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <div className="space-y-3 text-sm">
          <p>Availability was released and refunds were reserved under the cancellation policy. The provider is contacted after the change is saved, so some outcomes are still pending.</p>
          <ul className="divide-y divide-line rounded-md border border-line">
            {attempts.map((a) => (
              <li key={getId(a)} className="flex items-center justify-between gap-3 px-3 py-2">
                <span><Money minor={pickNum(a, 'amount_minor')} currency={pickStr(a, 'currency')} /></span>
                <StatusBadge status={pickStr(a, 'status')} />
              </li>
            ))}
          </ul>
          {attempts.some((a) => pickStr(a, 'status') === 'requires_reconciliation') && (
            <Notice tone="warn" title="Needs manual reconciliation">The provider result was uncertain. Confirm it with the provider, then record the outcome under <Link className="underline" to="/payments?tab=refunds">Payments, refund attempts</Link>.</Notice>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Update booking status" size="sm" dismissible={!busy}
      description={`Currently ${titleCase(current ?? 'unknown')}. The server only allows valid transitions.`}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant={status === 'cancelled' ? 'dangerSolid' : 'primary'} loading={busy} disabled={!status || !reason.trim()} onClick={submit}>{status === 'cancelled' ? 'Cancel booking' : 'Update status'}</Button>
      </>}>
      <div className="space-y-3">
        <Field label="New status" required>
          <Select value={status} onChange={(e) => setValue(e.target.value as BookingStatus)}>
            <option value="">Choose a status</option>
            {BOOKING_STATUSES.filter((s) => s !== current).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
        </Field>
        {status === 'cancelled' && <Notice tone="warn" title="Cancelling releases the car and reserves refunds">Refunds follow the company cancellation policy. Provider results that come back uncertain need manual reconciliation in Payments.</Notice>}
        <ReasonField value={reason} onChange={setReason} />
        <ErrorNotice error={error} onReload={() => { void reload(id, { silent: true }); onClose(); }} />
      </div>
    </Modal>
  );
}

export function DriverDialog({ open, onClose, booking }: DialogProps) {
  const assign = useBookingsStore((s) => s.assignDriver);
  const reload = useBookingsStore((s) => s.loadDetail);
  const { options, loadOptions } = useDriversStore();
  const id = getId(booking);
  const currentId = bookingDriverId(booking);
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const { run, busy, error, reset } = useAction();
  useEffect(() => { if (open) { setChoice(''); setReason(''); reset(); void loadOptions(); } }, [open, reset, loadOptions]);

  const closed = isClosedBooking(booking);
  return (
    <Modal open={open} onClose={onClose} title="Assign driver" size="sm" dismissible={!busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" loading={busy} disabled={!choice || !reason.trim() || closed}
          onClick={async () => { const r = await run(() => assign(id, choice === '__none' ? null : choice, reason.trim()), { success: choice === '__none' ? 'Driver unassigned' : 'Driver assigned' }); if (r.ok) onClose(); }}>
          {choice === '__none' ? 'Unassign driver' : 'Assign driver'}
        </Button>
      </>}>
      <div className="space-y-3">
        {closed && <Notice tone="warn">Cancelled and completed bookings can’t be assigned a driver.</Notice>}
        <Field label="Driver" required>
          <Select value={choice} onChange={(e) => setChoice(e.target.value)} disabled={closed}>
            <option value="">Choose a driver</option>
            {currentId && <option value="__none">Unassign current driver</option>}
            {options.filter((d) => d.id !== currentId).map((d) => <option key={d.id} value={d.id}>{d.full_name} ({d.phone_e164})</option>)}
          </Select>
        </Field>
        <ReasonField value={reason} onChange={setReason} />
        <ErrorNotice error={error} onReload={() => { void reload(id, { silent: true }); onClose(); }} />
      </div>
    </Modal>
  );
}

export function LocationDialog({ open, onClose, booking, leg }: DialogProps & { leg: 'pickup' | 'dropoff' }) {
  const setLocation = useBookingsStore((s) => s.setLocation);
  const reload = useBookingsStore((s) => s.loadDetail);
  const id = getId(booking);
  const [f, setF] = useState({ name: '', locId: '', lat: '', lng: '', reason: '' });
  const { run, busy, error, reset } = useAction();
  useEffect(() => { if (open) { setF({ name: '', locId: '', lat: '', lng: '', reason: '' }); reset(); } }, [open, reset]);

  const lat = f.lat.trim() === '' ? undefined : Number(f.lat);
  const lng = f.lng.trim() === '' ? undefined : Number(f.lng);
  const coordsPartial = (lat === undefined) !== (lng === undefined);
  const coordsBad = (lat !== undefined && !(lat >= -90 && lat <= 90)) || (lng !== undefined && !(lng >= -180 && lng <= 180));
  const valid = (f.name.trim() || f.locId.trim()) && f.reason.trim() && !coordsPartial && !coordsBad;
  const label = leg === 'pickup' ? 'pickup' : 'drop-off';
  const here = leg === 'pickup' ? pickupPlace(booking) : dropoffPlace(booking);

  return (
    <Modal open={open} onClose={onClose} title={`Change ${label} location`} size="sm" dismissible={!busy}
      description={here ? `Currently ${here}. Dates and price stay as they are.` : 'Dates and price stay as they are.'}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" loading={busy} disabled={!valid}
          onClick={async () => {
            const location: { location_id?: string; location_name?: string; coordinates?: { lat: number; lng: number } } = {};
            if (f.locId.trim()) location.location_id = f.locId.trim();
            if (f.name.trim()) location.location_name = f.name.trim();
            if (lat !== undefined && lng !== undefined) location.coordinates = { lat, lng };
            const r = await run(() => setLocation(id, leg, location, f.reason.trim()), { success: `${label[0].toUpperCase()}${label.slice(1)} location updated` });
            if (r.ok) onClose();
          }}>
          Update location
        </Button>
      </>}>
      <div className="space-y-3">
        <Field label="Location name" hint="Shown to the customer and driver"><Input maxLength={240} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Location ID" hint="Optional. Use a company location ID when the place is one of your saved locations."><Input maxLength={120} value={f.locId} onChange={(e) => setF({ ...f, locId: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" hint="-90 to 90"><Input inputMode="decimal" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} /></Field>
          <Field label="Longitude" hint="-180 to 180"><Input inputMode="decimal" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} /></Field>
        </div>
        {(coordsPartial || coordsBad) && <p className="text-xs text-bad">{coordsPartial ? 'Enter both latitude and longitude, or leave both empty.' : 'Coordinates are out of range.'}</p>}
        <ReasonField value={f.reason} onChange={(v) => setF({ ...f, reason: v })} />
        <ErrorNotice error={error} onReload={() => { void reload(id, { silent: true }); onClose(); }} />
      </div>
    </Modal>
  );
}

export function DocumentReviewModal({ open, onClose, bookingId, doc }: { open: boolean; onClose: () => void; bookingId: string; doc: Rec | null }) {
  const review = useBookingsStore((s) => s.reviewDocument);
  const { run, busy, error, reset } = useAction();
  const [decision, setDecision] = useState<'approved' | 'rejected' | ''>('');
  const [notes, setNotes] = useState('');
  useEffect(() => { if (open) { setDecision(''); setNotes(''); reset(); } }, [open, reset]);
  if (!doc) return null;
  const code = pickStr(doc, 'code', 'document_code', 'type') ?? '';
  const mediaId = pickStr(doc, 'media_id', 'media.id', 'upload.media_id', 'latest_media_id');

  return (
    <Modal open={open} onClose={onClose} title={`Review ${pickStr(doc, 'label', 'name', 'title') ?? code}`} size="sm" dismissible={!busy}
      description="Your decision is added to the document’s review history and can’t be edited later."
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant={decision === 'rejected' ? 'dangerSolid' : 'primary'} loading={busy} disabled={!decision || !notes.trim() || !mediaId}
          onClick={async () => { const r = await run(() => review(bookingId, code, { media_id: mediaId!, decision: decision as 'approved' | 'rejected', notes: notes.trim() }), { success: decision === 'approved' ? 'Document approved' : 'Document rejected' }); if (r.ok) onClose(); }}>
          {decision === 'rejected' ? 'Reject document' : 'Approve document'}
        </Button>
      </>}>
      <div className="space-y-3">
        {!mediaId && <Notice tone="warn">There’s no uploaded file to review yet.</Notice>}
        {pickStr(doc, 'url', 'file_url', 'preview_url', 'media.url') && (
          <a className="text-sm text-primary underline" href={pickStr(doc, 'url', 'file_url', 'preview_url', 'media.url')} target="_blank" rel="noreferrer noopener">Open the uploaded file</a>
        )}
        <fieldset>
          <legend className="mb-1 text-[13px] font-medium">Decision <span className="text-bad" aria-hidden>*</span></legend>
          <div className="flex gap-2">
            {(['approved', 'rejected'] as const).map((d) => (
              <label key={d} className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm font-medium ${decision === d ? (d === 'approved' ? 'border-ok bg-ok-soft text-ok' : 'border-bad bg-bad-soft text-bad') : 'border-line-strong hover:bg-paper'}`}>
                <input type="radio" name="decision" className="sr-only" checked={decision === d} onChange={() => setDecision(d)} />
                {d === 'approved' ? 'Approve' : 'Reject'}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={decision === 'rejected' ? 'Reason for rejection' : 'Notes'} required hint="Up to 2,000 characters."><Textarea maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <ErrorNotice error={error} />
      </div>
    </Modal>
  );
}
