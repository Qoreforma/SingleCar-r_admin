import { useEffect, useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { pickStr, getId, isRec } from '@/lib/helpers';
import type { Rec } from '@/types/common';
import { useFleetStore } from '@/stores/fleetStore';
import { useAction } from '@/hooks/useAction';
import { Button } from '@/components/ui/Button';
import { Field, SearchBox, Select } from '@/components/ui/Form';
import { Badge, EmptyState, ErrorNotice } from '@/components/ui/Feedback';
import { PagedTable, type Column } from '@/components/ui/Table';
import { FilterBar, PageHeader } from '@/components/ui/Common';
import { CarDrawer } from './CarDrawer';
import { CarFormModal } from './CarFormModal';
import { carActive, carLocations, carSubtitle, carTitle } from './carHelpers';
import { toast } from '@/stores/uiStore';

export default function Fleet() {
  const state = useFleetStore();
  const { filters, setFilters, resetFilters, load, reference, loadReference, exportInventory, items } = state;
  const [selected, setSelected] = useState<Rec | null>(null);
  const [form, setForm] = useState<{ car: Rec | null } | null>(null);
  const exporter = useAction();

  useEffect(() => { void load(1); void loadReference(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the open drawer in sync with the latest list data after edits and reloads.
  const current = useMemo(() => (selected ? items.find((c) => getId(c) === getId(selected)) ?? selected : null), [selected, items]);
  const pricingHints = useMemo(() => { const p = items.find((c) => isRec(c.pricing))?.pricing; return isRec(p) ? Object.keys(p) : []; }, [items]);

  const columns: Column<Rec>[] = [
    { key: 'car', header: 'Vehicle', cell: (c) => <div><p className="font-medium">{carTitle(c)}</p><p className="text-[13px] text-ink-muted">{carSubtitle(c)}</p></div> },
    { key: 'loc', header: 'Locations', cell: (c) => { const l = carLocations(c); return l.length ? <span>{l.slice(0, 2).join(', ')}{l.length > 2 && <span className="text-ink-muted"> +{l.length - 2}</span>}</span> : <span className="text-ink-faint">—</span>; } },
    { key: 'extra', header: 'Class', cell: (c) => pickStr(c, 'class', 'body_type', 'category') ?? <span className="text-ink-faint">—</span> },
    { key: 'status', header: 'Status', cell: (c) => <Badge tone={carActive(c) ? 'success' : 'neutral'}>{carActive(c) ? 'Active' : 'Inactive'}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Fleet" description="Vehicles, pricing and availability customers see."
        actions={<>
          <Button icon={<Download className="h-4 w-4" />} loading={exporter.busy} onClick={async () => { const r = await exporter.run(() => exportInventory()); if (r.ok) toast.success('Fleet export downloaded'); }}>Export</Button>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ car: null })}>Add vehicle</Button>
        </>} />
      <ErrorNotice error={exporter.error} className="mb-4" />

      <FilterBar>
        <Field label="Search"><SearchBox value={filters.search} onCommit={(v) => setFilters({ search: v })} placeholder="Title, brand or model" /></Field>
        <Field label="Status">
          <Select value={filters.is_active} onChange={(e) => setFilters({ is_active: e.target.value })}>
            <option value="">All vehicles</option><option value="true">Active</option><option value="false">Inactive</option>
          </Select>
        </Field>
        <Field label="Brand"><Select value={filters.brand} onChange={(e) => setFilters({ brand: e.target.value })}><option value="">All brands</option>{reference?.brands?.map((b) => <option key={b}>{b}</option>)}</Select></Field>
        <Field label="Location"><Select value={filters.location} onChange={(e) => setFilters({ location: e.target.value })}><option value="">All locations</option>{reference?.locations?.map((l) => <option key={l}>{l}</option>)}</Select></Field>
        <Button variant="ghost" onClick={resetFilters}>Clear filters</Button>
      </FilterBar>

      <PagedTable state={state} columns={columns} rowKey={getId} onRowClick={setSelected}
        empty={<EmptyState title="No vehicles match" description="Clear the filters, or add the first vehicle." action={<Button variant="primary" onClick={() => setForm({ car: null })}>Add vehicle</Button>} />} />

      <CarDrawer car={current} onClose={() => setSelected(null)} onEdit={(car) => setForm({ car })} />
      <CarFormModal open={!!form} car={form?.car} reference={reference} pricingHints={pricingHints} onClose={() => setForm(null)} onSaved={(c) => { if (form?.car) setSelected(c); }} />
    </>
  );
}
