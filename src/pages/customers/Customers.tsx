import { useEffect, useMemo, useState } from 'react';
import { Download, UserCheck, UserX } from 'lucide-react';
import { customersApi } from '@/api/customers';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { getId, pick, pickStr } from '@/lib/helpers';
import type { Rec } from '@/types/common';
import { useCustomersStore } from '@/stores/customersStore';
import { useAsync } from '@/hooks/useAsync';
import { useAction } from '@/hooks/useAction';
import { toast } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, SearchBox, Select } from '@/components/ui/Form';
import { Badge, EmptyState, ErrorNotice, ErrorState, LoadingBlock, Notice } from '@/components/ui/Feedback';
import { PagedTable, type Column } from '@/components/ui/Table';
import { ConfirmDialog, Drawer } from '@/components/ui/Overlay';
import { FilterBar, PageHeader, Tabs } from '@/components/ui/Common';
import { KeyValueList } from '@/components/ui/Data';

const name = (c: Rec) => pickStr(c, 'full_name', 'name') ?? ([pickStr(c, 'first_name'), pickStr(c, 'last_name')].filter(Boolean).join(' ') || 'Unnamed customer');
const isActive = (c: Rec) => pick(c, 'is_active') !== false;

function Sessions({ customerId }: { customerId: string }) {
  const sessions = useAsync(() => customersApi.sessions(customerId), [customerId]);
  const [revoking, setRevoking] = useState<Rec | null>(null);
  if (sessions.loading && !sessions.data) return <LoadingBlock />;
  if (sessions.error) return <ErrorState error={sessions.error} onRetry={() => void sessions.reload()} />;
  const rows = sessions.data?.data ?? [];
  return (
    <>
      {rows.length === 0 ? <p className="py-6 text-center text-sm text-ink-faint">No active sessions.</p> : (
        <ul className="divide-y divide-line rounded-md border border-line text-sm">
          {rows.map((s) => (
            <li key={getId(s)} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-medium">{pickStr(s, 'device', 'user_agent', 'client', 'platform') ?? 'Session'}</p>
                <p className="text-[13px] text-ink-muted">{[pickStr(s, 'ip', 'ip_address'), fmtDateTime(pick(s, 'last_used_at', 'last_active_at', 'created_at'))].filter(Boolean).join(', ')}</p>
              </div>
              <Button size="sm" variant="danger" onClick={() => setRevoking(s)}>Revoke</Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!revoking} onClose={() => setRevoking(null)} tone="danger" confirmLabel="Revoke session"
        title="Revoke this session?" description="The customer is signed out of that device immediately."
        reason={{ min: 3, max: 1000, placeholder: 'Why is this session being revoked?' }}
        onConfirm={async (reason) => { if (revoking) { await customersApi.revokeSession(customerId, getId(revoking), reason); toast.success('Session revoked'); void sessions.reload(); } }} />
    </>
  );
}

function CustomerDrawer({ summary, onClose }: { summary: Rec | null; onClose: () => void }) {
  const id = summary ? getId(summary) : '';
  const detail = useAsync(() => customersApi.get(id), [id], !!summary);
  const setStatus = useCustomersStore((s) => s.setStatus);
  const [tab, setTab] = useState<'profile' | 'sessions'>('profile');
  const [statusOpen, setStatusOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const exporter = useAction();
  useEffect(() => { setTab('profile'); }, [id]);
  useEffect(() => { if (exportOpen) { setAck(false); exporter.reset(); } }, [exportOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = detail.data?.data ?? summary;
  const active = c ? isActive(c) : true;

  return (
    <>
      <Drawer open={!!summary} onClose={onClose} title={c ? name(c) : ''} description={c && pickStr(c, 'email')}
        actions={c && <>
          <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => setExportOpen(true)}>Export data</Button>
          <Button size="sm" variant={active ? 'danger' : 'primary'} icon={active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />} onClick={() => setStatusOpen(true)}>{active ? 'Suspend' : 'Reactivate'}</Button>
        </>}>
        {detail.error && <ErrorNotice error={detail.error} onReload={() => void detail.reload()} className="mb-4" />}
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'profile', label: 'Profile' }, { id: 'sessions', label: 'Sessions' }]} />
        {tab === 'profile' && (detail.loading && !detail.data ? <LoadingBlock /> : c && <KeyValueList data={c} />)}
        {tab === 'sessions' && id && <Sessions customerId={id} />}
      </Drawer>

      <ConfirmDialog open={statusOpen} onClose={() => setStatusOpen(false)} tone={active ? 'danger' : 'primary'}
        title={active ? 'Suspend this customer?' : 'Reactivate this customer?'}
        description={active ? 'They’re signed out everywhere straight away and can’t book until reactivated.' : 'They’ll be able to sign in and book again.'}
        confirmLabel={active ? 'Suspend customer' : 'Reactivate customer'} reason={{ min: 3, max: 1000, placeholder: 'Recorded in the audit log' }}
        onConfirm={async (reason) => { await setStatus(id, !active, reason); toast.success(active ? 'Customer suspended' : 'Customer reactivated'); void detail.reload(); }} />

      <ConfirmDialog open={exportOpen} onClose={() => setExportOpen(false)} confirmLabel="Download export" disabled={!ack}
        title="Export this customer’s data?" description="The file holds the customer’s personal data held by the company. Secrets and private media identifiers are left out."
        onConfirm={async () => { await customersApi.exportData(id); toast.success('Export downloaded'); }}>
        <Notice tone="warn">Export only for a valid operational reason, such as a privacy request. Keep the file out of chat, tickets and shared drives.</Notice>
        <Checkbox label="I have a valid reason to export this data" checked={ack} onChange={(e) => setAck(e.target.checked)} />
      </ConfirmDialog>
    </>
  );
}

export default function Customers() {
  const state = useCustomersStore();
  const { filters, setFilters, resetFilters, load, items } = state;
  const [selected, setSelected] = useState<Rec | null>(null);
  useEffect(() => { void load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const current = useMemo(() => (selected ? items.find((c) => getId(c) === getId(selected)) ?? selected : null), [selected, items]);

  const columns: Column<Rec>[] = [
    { key: 'name', header: 'Customer', cell: (c) => <div><p className="font-medium">{name(c)}</p><p className="text-[13px] text-ink-muted">{pickStr(c, 'email')}</p></div> },
    { key: 'phone', header: 'Phone', cell: (c) => pickStr(c, 'phone', 'phone_e164', 'phone_number') ?? <span className="text-ink-faint">—</span> },
    { key: 'verified', header: 'Email', cell: (c) => <Badge tone={pick(c, 'email_verified', 'is_email_verified') ? 'success' : 'warn'}>{pick(c, 'email_verified', 'is_email_verified') ? 'Verified' : 'Unverified'}</Badge> },
    { key: 'status', header: 'Account', cell: (c) => <Badge tone={isActive(c) ? 'success' : 'danger'}>{isActive(c) ? 'Active' : 'Suspended'}</Badge> },
    { key: 'joined', header: 'Joined', cell: (c) => fmtDate(pick(c, 'created_at')) },
  ];

  return (
    <>
      <PageHeader title="Customers" description="Find a customer to review their account, sessions and data requests." />
      <FilterBar>
        <Field label="Search"><SearchBox value={filters.search} onCommit={(v) => setFilters({ search: v })} placeholder="Name, email or phone" /></Field>
        <Field label="Account"><Select value={filters.is_active} onChange={(e) => setFilters({ is_active: e.target.value })}><option value="">All accounts</option><option value="true">Active</option><option value="false">Suspended</option></Select></Field>
        <Field label="Email"><Select value={filters.email_verified} onChange={(e) => setFilters({ email_verified: e.target.value })}><option value="">Any</option><option value="true">Verified</option><option value="false">Unverified</option></Select></Field>
        <Button variant="ghost" onClick={resetFilters}>Clear filters</Button>
      </FilterBar>
      <PagedTable state={state} columns={columns} rowKey={getId} onRowClick={setSelected} empty={<EmptyState title="No customers match" description="Try a different search or clear the filters." />} />
      <CustomerDrawer summary={current} onClose={() => setSelected(null)} />
    </>
  );
}
