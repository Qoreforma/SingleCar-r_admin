import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { CircleDot, MapPin, UserRound } from 'lucide-react';
import { fmtDateTime } from '@/lib/format';
import { can, PERM } from '@/lib/permissions';
import { useAuthStore } from '@/stores/authStore';
import { useBookingsStore } from '@/stores/bookingsStore';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingBlock, StatusBadge } from '@/components/ui/Feedback';
import { PageHeader, Panel, Tabs } from '@/components/ui/Common';
import { KeyValueList } from '@/components/ui/Data';
import { DriverDialog, LocationDialog, StatusDialog } from './BookingDialogs';
import { ActivityTab, DocumentsTab, NotesTab, PaymentsTab } from './BookingTabs';
import { bookingCar, bookingCustomer, bookingCustomerEmail, bookingDriverName, bookingDropoffAt, bookingPaymentStatus, bookingPickupAt, bookingRef, bookingStatus, dropoffPlace, isClosedBooking, pickupPlace } from './bookingHelpers';

type Tab = 'documents' | 'activity' | 'notes' | 'payments';
type Dialog = 'status' | 'driver' | 'pickup' | 'dropoff' | null;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? '—'}</dd>
    </div>
  );
}

export default function BookingDetail() {
  const { bookingId = '' } = useParams();
  const user = useAuthStore((s) => s.user);
  const { detail, detailId, detailLoading, detailError, loadDetail } = useBookingsStore();
  const [tab, setTab] = useState<Tab>('documents');
  const [dialog, setDialog] = useState<Dialog>(null);
  useEffect(() => { void loadDetail(bookingId); }, [bookingId, loadDetail]);

  // Guard against showing the previous booking while the next one loads.
  const b = detailId === bookingId ? detail : null;
  if (detailError && !b) return <ErrorState error={detailError} onRetry={() => void loadDetail(bookingId)} />;
  if (!b || detailLoading) return <LoadingBlock label="Loading booking…" />;

  const canManage = can(user, PERM.bookingsManage);
  const canNotes = can(user, PERM.bookingsNotes);
  const canLocations = can(user, PERM.bookingsLocations);
  const canReview = can(user, PERM.documentsReview);
  const closed = isClosedBooking(b);
  const driver = bookingDriverName(b);

  return (
    <>
      <PageHeader back={{ to: '/bookings', label: 'All bookings' }} title={`Booking ${bookingRef(b)}`}
        description={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={bookingStatus(b)} />{bookingPaymentStatus(b) && <span className="inline-flex items-center gap-1 text-[13px]">Payment <StatusBadge status={bookingPaymentStatus(b)} /></span>}</span>} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Overview">
            <dl className="divide-y divide-line/70">
              <Row label="Customer">{bookingCustomer(b) ?? '—'}{bookingCustomerEmail(b) && <span className="block text-[13px] text-ink-muted">{bookingCustomerEmail(b)}</span>}</Row>
              <Row label="Vehicle">{bookingCar(b) ?? '—'}</Row>
              <Row label="Pickup">{fmtDateTime(bookingPickupAt(b))}{pickupPlace(b) && <span className="block text-[13px] text-ink-muted">{pickupPlace(b)}</span>}</Row>
              <Row label="Drop-off">{fmtDateTime(bookingDropoffAt(b))}{dropoffPlace(b) && <span className="block text-[13px] text-ink-muted">{dropoffPlace(b)}</span>}</Row>
              <Row label="Driver">{driver ?? <span className="text-ink-faint">Not assigned</span>}</Row>
            </dl>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-[13px] font-medium text-primary">All booking fields</summary>
              <div className="mt-3"><KeyValueList data={b} /></div>
            </details>
          </Panel>

          <Panel padded={false}>
            <div className="px-4 pt-3">
              <Tabs value={tab} onChange={setTab} tabs={[
                { id: 'documents', label: 'Documents' }, { id: 'activity', label: 'Activity' },
                { id: 'notes', label: 'Internal notes' }, { id: 'payments', label: 'Payments' },
              ]} />
            </div>
            <div className="px-4 pb-4">
              {tab === 'documents' && <DocumentsTab bookingId={bookingId} canReview={canReview} />}
              {tab === 'activity' && <ActivityTab bookingId={bookingId} />}
              {tab === 'notes' && <NotesTab bookingId={bookingId} canAdd={canNotes} />}
              {tab === 'payments' && <PaymentsTab bookingId={bookingId} />}
            </div>
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel title="Actions">
            <div className="flex flex-col gap-2">
              {canManage && <Button variant="primary" icon={<CircleDot className="h-4 w-4" />} onClick={() => setDialog('status')}>Update status</Button>}
              {canManage && <Button icon={<UserRound className="h-4 w-4" />} disabled={closed} onClick={() => setDialog('driver')}>{driver ? 'Change driver' : 'Assign driver'}</Button>}
              {canLocations && <Button icon={<MapPin className="h-4 w-4" />} onClick={() => setDialog('pickup')}>Change pickup location</Button>}
              {canLocations && <Button icon={<MapPin className="h-4 w-4" />} onClick={() => setDialog('dropoff')}>Change drop-off location</Button>}
              {!canManage && !canLocations && <p className="text-sm text-ink-muted">Your role can view this booking but not change it.</p>}
            </div>
            <p className="mt-3 text-xs text-ink-muted">The server decides which changes are allowed. If the booking changed while you were working, you’ll be asked to reload.</p>
          </Panel>
        </aside>
      </div>

      <StatusDialog open={dialog === 'status'} onClose={() => setDialog(null)} booking={b} />
      <DriverDialog open={dialog === 'driver'} onClose={() => setDialog(null)} booking={b} />
      <LocationDialog open={dialog === 'pickup'} onClose={() => setDialog(null)} booking={b} leg="pickup" />
      <LocationDialog open={dialog === 'dropoff'} onClose={() => setDialog(null)} booking={b} leg="dropoff" />
    </>
  );
}
