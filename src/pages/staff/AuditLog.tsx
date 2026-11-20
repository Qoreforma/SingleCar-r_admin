import { useEffect, useState } from 'react';
import { fmtDateTime } from '@/lib/format';
import { shortId } from '@/lib/helpers';
import type { AuditLogItem } from '@/types/identity';
import { useAuditStore } from '@/stores/staffStore';
import { Field, Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { PagedTable, type Column } from '@/components/ui/Table';
import { Drawer } from '@/components/ui/Overlay';
import { FilterBar, PageHeader } from '@/components/ui/Common';
import { JsonBlock } from '@/components/ui/Data';
import { EmptyState } from '@/components/ui/Feedback';

export default function AuditLog() {
  const state = useAuditStore();
  const [selected, setSelected] = useState<AuditLogItem | null>(null);
  const { filters, setFilters, resetFilters, load } = state;
  useEffect(() => { void load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<AuditLogItem>[] = [
    { key: 'time', header: 'When', cell: (e) => <span className="whitespace-nowrap">{fmtDateTime(e.created_at)}</span> },
    { key: 'actor', header: 'Who', cell: (e) => e.actor_name ?? <span className="text-ink-faint">System</span> },
    { key: 'action', header: 'Action', cell: (e) => <span className="font-medium">{e.action}</span> },
    { key: 'target', header: 'Target', cell: (e) => (e.resource_type ? <span>{e.resource_type}{e.resource_id && <span className="ml-1.5 text-ink-muted">{shortId(e.resource_id)}</span>}</span> : <span className="text-ink-faint">—</span>) },
  ];

  return (
    <>
      <PageHeader title="Audit log" description="Sensitive actions across the company: who did what, and to which record." />
      <FilterBar>
        <Field label="From"><Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilters({ from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ to: e.target.value })} /></Field>
        <Field label="Action"><Input placeholder="For example booking.status_updated" value={filters.action} onChange={(e) => setFilters({ action: e.target.value })} className="w-64" /></Field>
        <Button variant="ghost" onClick={resetFilters}>Clear filters</Button>
      </FilterBar>

      <PagedTable state={state} columns={columns} rowKey={(e) => e.id} onRowClick={setSelected}
        empty={<EmptyState title="No audit events match" description="Try a wider date range or clear the action filter." />} />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.action ?? ''} description={selected ? fmtDateTime(selected.created_at) : undefined}>
        {selected && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
              <dt className="text-ink-muted">Who</dt><dd>{selected.actor_name ?? 'System'}</dd>
              <dt className="text-ink-muted">Target type</dt><dd>{selected.resource_type ?? '—'}</dd>
              <dt className="text-ink-muted">Target ID</dt><dd className="break-all">{selected.resource_id ?? '—'}</dd>
              <dt className="text-ink-muted">Event ID</dt><dd className="break-all">{selected.id}</dd>
            </dl>
            <div>
              <h3 className="mb-1.5 text-[13px] font-semibold">Context</h3>
              {selected.metadata && Object.keys(selected.metadata).length ? <JsonBlock value={selected.metadata} /> : <p className="text-ink-faint">No extra context recorded.</p>}
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
