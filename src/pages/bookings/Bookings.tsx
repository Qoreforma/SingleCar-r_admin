import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { bookingsApi } from '@/api/bookings';
import { dayEndUtc, dayStartUtc, fmtDateTime } from '@/lib/format';
import { getId } from '@/lib/helpers';
import { BOOKING_STATUSES } from '@/types/bookings';
import type { Rec } from '@/types/common';
import { useBookingsStore } from '@/stores/bookingsStore';
import { Button } from '@/components/ui/Button';
import { Field, Input, SearchBox, Select } from '@/components/ui/Form';
import { EmptyState, StatusBadge } from '@/components/ui/Feedback';
import { PagedTable, type Column } from '@/components/ui/Table';
import { ExportDialog, FilterBar, PageHeader } from '@/components/ui/Common';
import { titleCase } from '@/lib/helpers';
import { bookingCar, bookingCustomer, bookingCustomerEmail, bookingDropoffAt, bookingPaymentStatus, bookingPickupAt, bookingRef, bookingStatus } from './bookingHelpers';

export default function Bookings() {
  const nav = useNavigate();
  const state = useBookingsStore();
  const { filters, setFilters, resetFilters, load } = state;
  const [exporting, setExporting] = useState(false);
  useEffect(() => { void load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<Rec>[] = [
    { key: 'ref', header: 'Reference', cell: (b) => <span className="font-medium">{bookingRef(b)}</span> },
    { key: 'customer', header: 'Customer', cell: (b) => <div><p>{bookingCustomer(b) ?? '—'}</p>{bookingCustomerEmail(b) && <p className="text-[13px] text-ink-muted">{bookingCustomerEmail(b)}</p>}</div> },
    { key: 'car', header: 'Vehicle', cell: (b) => bookingCar(b) ?? <span className="text-ink-faint">—</span> },
    { key: 'pickup', header: 'Pickup', cell: (b) => <span className="whitespace-nowrap">{fmtDateTime(bookingPickupAt(b))}</span> },
    { key: 'dropoff', header: 'Drop-off', cell: (b) => <span className="whitespace-nowrap">{fmtDateTime(bookingDropoffAt(b))}</span> },
    { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={bookingStatus(b)} /> },
    { key: 'pay', header: 'Payment', cell: (b) => <StatusBadge status={bookingPaymentStatus(b)} /> },
  ];

  return (
    <>
      <PageHeader title="Bookings" description="Every rental for the company. Open one to review documents, assign a driver or change its status."
        actions={<Button icon={<Download className="h-4 w-4" />} onClick={() => setExporting(true)}>Export report</Button>} />
      <FilterBar>
        <Field label="Search"><SearchBox value={filters.search} onCommit={(v) => setFilters({ search: v })} placeholder="Reference, customer or vehicle" /></Field>
        <Field label="Status">
          <Select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}>
            <option value="">All statuses</option>
            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
        </Field>
        <Field label="Pickup from"><Input type="date" value={filters.pickup_from.slice(0, 10)} max={filters.pickup_to.slice(0, 10) || undefined} onChange={(e) => setFilters({ pickup_from: e.target.value ? dayStartUtc(e.target.value) : '' })} /></Field>
        <Field label="Pickup to"><Input type="date" value={filters.pickup_to.slice(0, 10)} min={filters.pickup_from.slice(0, 10) || undefined} onChange={(e) => setFilters({ pickup_to: e.target.value ? dayEndUtc(e.target.value) : '' })} /></Field>
        <Button variant="ghost" onClick={resetFilters}>Clear filters</Button>
      </FilterBar>

      <PagedTable state={state} columns={columns} rowKey={getId} onRowClick={(b) => nav(`/bookings/${getId(b)}`)}
        empty={<EmptyState title="No bookings match" description="Try a different search, status or pickup range." />} />

      <ExportDialog open={exporting} onClose={() => setExporting(false)} title="Export bookings" maxDays={366}
        description="Schedule, quote and payment summary as CSV for a pickup-date range (up to 366 days, 10,000 rows). Customer contact details are left out."
        onExport={({ from, to }) => bookingsApi.exportCsv({ pickup_from: dayStartUtc(from), pickup_to: dayEndUtc(to), search: filters.search, status: filters.status })}>
        {(filters.search || filters.status) && <p className="text-xs text-ink-muted">Your current search and status filters are applied.</p>}
      </ExportDialog>
    </>
  );
}
