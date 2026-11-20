import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Pencil, UserPlus } from 'lucide-react';
import { isOwner } from '@/lib/permissions';
import { useAuthStore } from '@/stores/authStore';
import { useStaffStore } from '@/stores/staffStore';
import { useAction } from '@/hooks/useAction';
import type { StaffItem } from '@/types/identity';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input } from '@/components/ui/Form';
import { Badge, ErrorNotice, Notice } from '@/components/ui/Feedback';
import { DataTable, type Column } from '@/components/ui/Table';
import { ConfirmDialog, Modal } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/Common';

function InviteModal({ open, onClose, roles }: { open: boolean; onClose: () => void; roles: string[] }) {
  const invite = useStaffStore((s) => s.invite);
  const { run, busy, error, reset } = useAction();
  const [form, setForm] = useState({ full_name: '', email: '', role: '' });
  useEffect(() => { if (open) { setForm({ full_name: '', email: '', role: '' }); reset(); } }, [open, reset]);
  const ok = form.full_name.trim().length >= 2 && form.email.includes('@') && form.role.trim().length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Invite a staff member" size="sm" dismissible={!busy}
      description="They’ll get an email to set a password, then enrol an authenticator on first sign-in."
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" loading={busy} disabled={!ok} onClick={async () => { const r = await run(() => invite({ full_name: form.full_name.trim(), email: form.email.trim(), role: form.role.trim() }), { success: 'Invitation sent' }); if (r.ok) onClose(); }}>Send invitation</Button>
      </>}>
      <div className="space-y-3">
        <Field label="Full name" required><Input autoFocus maxLength={120} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
        <Field label="Work email" required><Input type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Role" required hint="Roles define what they can see and change. The server rejects a role it doesn’t recognise.">
          <Input list="role-options" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
        </Field>
        <datalist id="role-options">{roles.map((r) => <option key={r} value={r} />)}</datalist>
        <ErrorNotice error={error} />
      </div>
    </Modal>
  );
}

function EditModal({ member, onClose, roles }: { member: StaffItem | null; onClose: () => void; roles: string[] }) {
  const update = useStaffStore((s) => s.update);
  const reload = useStaffStore((s) => s.load);
  const { run, busy, error, reset } = useAction();
  const [form, setForm] = useState({ full_name: '', role: '', is_active: true });
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  useEffect(() => { if (member) { setForm({ full_name: member.full_name, role: member.role, is_active: member.is_active }); reset(); } }, [member, reset]);
  if (!member) return null;

  const patch: { full_name?: string; role?: string; is_active?: boolean } = {};
  if (form.full_name.trim() !== member.full_name) patch.full_name = form.full_name.trim();
  if (form.role.trim() !== member.role) patch.role = form.role.trim();
  if (form.is_active !== member.is_active) patch.is_active = form.is_active;
  const changed = Object.keys(patch).length > 0;
  const deactivating = patch.is_active === false;

  const apply = async () => { const r = await run(() => update(member.id, patch), { success: 'Staff member updated' }); if (r.ok) onClose(); };

  return (
    <>
      <Modal open onClose={onClose} title={`Edit ${member.full_name}`} size="sm" dismissible={!busy}
        footer={<>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!changed || form.full_name.trim().length < 2} onClick={() => (deactivating ? setConfirmDeactivate(true) : void apply())}>Save changes</Button>
        </>}>
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">{member.email}</p>
          <Field label="Full name" required><Input maxLength={120} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Role" required><Input list="role-options-edit" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
          <datalist id="role-options-edit">{roles.map((r) => <option key={r} value={r} />)}</datalist>
          <Checkbox label="Active" hint="Inactive staff can’t sign in." checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          <ErrorNotice error={error} onReload={() => { void reload(); onClose(); }} />
        </div>
      </Modal>
      <ConfirmDialog open={confirmDeactivate} onClose={() => setConfirmDeactivate(false)} tone="danger" title={`Deactivate ${member.full_name}?`}
        description="They’ll lose access to the admin. You can reactivate them later." confirmLabel="Deactivate" onConfirm={apply} />
    </>
  );
}

export default function Staff() {
  const me = useAuthStore((s) => s.user);
  const { items, loading, error, load, resetMfa } = useStaffStore();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<StaffItem | null>(null);
  const [resetting, setResetting] = useState<StaffItem | null>(null);
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const owner = isOwner(me);
  const roles = useMemo(() => Array.from(new Set(items.map((i) => i.role))).sort(), [items]);

  const columns: Column<StaffItem>[] = [
    { key: 'name', header: 'Name', cell: (m) => <div><p className="font-medium">{m.full_name}{m.id === me?.id && <span className="ml-2 text-xs text-ink-muted">You</span>}</p><p className="text-[13px] text-ink-muted">{m.email}</p></div> },
    { key: 'role', header: 'Role', cell: (m) => m.role },
    { key: 'status', header: 'Status', cell: (m) => <Badge tone={m.is_active ? 'success' : 'neutral'}>{m.is_active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, right: true,
      cell: (m) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(m)}>Edit</Button>
          {owner && m.id !== me?.id && m.role.toLowerCase() !== 'owner' && (
            <Button size="sm" variant="danger" icon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => setResetting(m)}>Reset MFA</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Staff" description="Who can sign in to the admin, and what role they hold."
        actions={<Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviting(true)}>Invite staff</Button>} />
      <Notice tone="info" className="mb-4">The staff list shows active or inactive only. Whether an invitation has been accepted isn’t reported by the API.</Notice>
      <div className="rounded-panel border border-line bg-white">
        <DataTable columns={columns} rows={items} rowKey={(m) => m.id} loading={loading && items.length === 0} error={error} onRetry={() => void load()} />
      </div>

      <InviteModal open={inviting} onClose={() => setInviting(false)} roles={roles} />
      <EditModal member={editing} onClose={() => setEditing(null)} roles={roles} />
      <ConfirmDialog open={!!resetting} onClose={() => setResetting(null)} tone="danger" confirmLabel="Reset MFA"
        title={`Reset MFA for ${resetting?.full_name ?? ''}?`}
        description="This clears their authenticator, signs them out everywhere and makes them enrol again at next sign-in. Owner MFA can’t be reset here."
        reason={{ label: 'Reason', min: 10, max: 500, placeholder: 'For example: lost phone, verified in person' }}
        onConfirm={async (reason) => { if (resetting) { await resetMfa(resetting.id, reason); } }} />
    </>
  );
}

