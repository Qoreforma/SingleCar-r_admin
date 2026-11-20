import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { fmtDateTime } from '@/lib/format';
import type { DriverProfile } from '@/types/bookings';
import { useDriversStore } from '@/stores/driversStore';
import { useAction } from '@/hooks/useAction';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, SearchBox, Select } from '@/components/ui/Form';
import { Badge, EmptyState, ErrorNotice, Notice } from '@/components/ui/Feedback';
import { PagedTable, type Column } from '@/components/ui/Table';
import { ConfirmDialog, Modal } from '@/components/ui/Overlay';
import { FilterBar, PageHeader } from '@/components/ui/Common';

const E164 = /^\+[1-9]\d{7,14}$/;

function DriverModal({ driver, open, onClose }: { driver: DriverProfile | null; open: boolean; onClose: () => void }) {
  const { create, update, load } = useDriversStore();
  const { run, busy, error, reset } = useAction();
  const [form, setForm] = useState({ full_name: '', email: '', phone_e164: '', is_active: true });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (open) { setForm({ full_name: driver?.full_name ?? '', email: driver?.email ?? '', phone_e164: driver?.phone_e164 ?? '', is_active: driver?.is_active ?? true }); reset(); }
  }, [open, driver, reset]);

  const editing = !!driver;
  const phoneBad = form.phone_e164.length > 0 && !E164.test(form.phone_e164);
  const valid = form.full_name.trim() && form.email.includes('@') && E164.test(form.phone_e164);
  const deactivating = editing && driver!.is_active && !form.is_active;

  const save = async () => {
    const body = { full_name: form.full_name.trim(), email: form.email.trim(), phone_e164: form.phone_e164.trim() };
    const r = await run(() => (editing ? update(driver!.id, { ...diff(driver!, body, form.is_active), expected_version: driver!.version }) : create(body)), { success: editing ? 'Driver updated' : 'Driver added' });
    if (r.ok) onClose();
    return r.ok;
  };

  /** ConfirmDialog shows API errors itself, so call the store directly and let failures propagate. */
  const saveOrThrow = async () => {
    await update(driver!.id, { ...diff(driver!, { full_name: form.full_name.trim(), email: form.email.trim(), phone_e164: form.phone_e164.trim() }, form.is_active), expected_version: driver!.version });
    onClose();
  };

  return (
    <>
      <Modal open={open} onClose={onClose} size="sm" dismissible={!busy} title={editing ? 'Edit driver' : 'Add driver'}
        description="A driver profile is contact details for assignments. It doesn’t create a login."
        footer={<>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!valid} onClick={() => (deactivating ? setConfirm(true) : void save())}>{editing ? 'Save changes' : 'Add driver'}</Button>
        </>}>
        <div className="space-y-3">
          <Field label="Full name" required><Input autoFocus maxLength={120} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Email" required><Input type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone" required hint="International format, for example +2348012345678" error={phoneBad ? 'Use + then the country code and number, 8 to 15 digits.' : undefined}>
            <Input inputMode="tel" value={form.phone_e164} onChange={(e) => setForm({ ...form, phone_e164: e.target.value.replace(/[^\d+]/g, '') })} />
          </Field>
          {editing && <Checkbox label="Active" hint="Inactive drivers can’t be assigned to bookings." checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />}
          <ErrorNotice error={error} onReload={() => { void load(); onClose(); }} />
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} tone="danger" confirmLabel="Deactivate driver" title={`Deactivate ${driver?.full_name ?? 'driver'}?`}
        description="The server refuses if this driver still has live bookings. You’ll see why here."
        onConfirm={saveOrThrow} />
    </>
  );
}

function diff(d: DriverProfile, body: { full_name: string; email: string; phone_e164: string }, isActive: boolean) {
  const out: { full_name?: string; email?: string; phone_e164?: string; is_active?: boolean } = {};
  if (body.full_name !== d.full_name) out.full_name = body.full_name;
  if (body.email !== d.email) out.email = body.email;
  if (body.phone_e164 !== d.phone_e164) out.phone_e164 = body.phone_e164;
  if (isActive !== d.is_active) out.is_active = isActive;
  return out;
}

export default function Drivers() {
  const state = useDriversStore();
  const { filters, setFilters, resetFilters, load } = state;
  const [editing, setEditing] = useState<{ driver: DriverProfile | null } | null>(null);
  useEffect(() => { void load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<DriverProfile>[] = [
    { key: 'name', header: 'Driver', cell: (d) => <span className="font-medium">{d.full_name}</span> },
    { key: 'email', header: 'Email', cell: (d) => d.email },
    { key: 'phone', header: 'Phone', cell: (d) => d.phone_e164 },
    { key: 'status', header: 'Status', cell: (d) => <Badge tone={d.is_active ? 'success' : 'neutral'}>{d.is_active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'updated', header: 'Updated', cell: (d) => fmtDateTime(d.updated_at) },
  ];

  return (
    <>
      <PageHeader title="Drivers" description="Contact profiles you can assign to bookings."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ driver: null })}>Add driver</Button>} />
      <FilterBar>
        <Field label="Search"><SearchBox value={filters.search} onCommit={(v) => setFilters({ search: v })} placeholder="Name, email or phone" /></Field>
        <Field label="Status"><Select value={filters.is_active} onChange={(e) => setFilters({ is_active: e.target.value })}><option value="">All drivers</option><option value="true">Active</option><option value="false">Inactive</option></Select></Field>
        <Button variant="ghost" onClick={resetFilters}>Clear filters</Button>
      </FilterBar>
      <Notice tone="info" className="mb-4">Assignment conflicts are checked by the server when you assign a driver from a booking.</Notice>
      <PagedTable state={state} columns={columns} rowKey={(d) => d.id} onRowClick={(d) => setEditing({ driver: d })}
        empty={<EmptyState title="No drivers yet" description="Add a driver profile to start assigning bookings." action={<Button variant="primary" onClick={() => setEditing({ driver: null })}>Add driver</Button>} />} />
      <DriverModal open={!!editing} driver={editing?.driver ?? null} onClose={() => setEditing(null)} />
    </>
  );
}
