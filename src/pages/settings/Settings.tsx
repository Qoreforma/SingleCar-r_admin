import { useEffect, useMemo, useState } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { sameJson, newKey } from '@/lib/helpers';
import type { Rec } from '@/types/common';
import type { CompanySettings, CompanySettingsUpdate } from '@/types/identity';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAction } from '@/hooks/useAction';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { ErrorNotice, ErrorState, LoadingBlock, Notice } from '@/components/ui/Feedback';
import { PageHeader, Panel } from '@/components/ui/Common';
import { JsonCell, ObjectEditor } from '@/components/ui/Data';

type Draft = {
  name: string; timezone: string; locale: string;
  booking_add_ons: Rec; booking_policies: Rec; payment_settings: Rec; enabled_features: Rec;
  document_requirements: Rec[]; app_versions: Rec;
};
const toDraft = (s: CompanySettings): Draft => ({
  name: s.name, timezone: s.timezone, locale: s.locale,
  booking_add_ons: s.booking_add_ons ?? {}, booking_policies: s.booking_policies ?? {}, payment_settings: s.payment_settings ?? {},
  enabled_features: s.enabled_features ?? {}, document_requirements: s.document_requirements ?? [], app_versions: s.app_versions ?? {},
});

function timeZones(): string[] {
  try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone'); } catch { return []; }
}

function SettingsForm({ settings, hiddenSecrets }: { settings: CompanySettings; hiddenSecrets: number }) {
  const save = useSettingsStore((s) => s.save);
  const reload = useSettingsStore((s) => s.load);
  const original = useMemo(() => toDraft(settings), [settings]);
  const [draft, setDraft] = useState<Draft>(original);
  const { run, busy, error } = useAction();
  const zones = useMemo(timeZones, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const changed = (Object.keys(draft) as (keyof Draft)[]).filter((k) => !sameJson(draft[k], original[k]));
  const dirty = changed.length > 0;

  const submit = async () => {
    // Only sections that actually changed are sent; the server validates payment policy, booking rules and documents.
    const patch: CompanySettingsUpdate = {};
    for (const k of changed) (patch as Record<string, unknown>)[k] = draft[k];
    await run(() => save(patch), { success: 'Settings saved' });
  };

  return (
    <div className="space-y-5 pb-24">
      {hiddenSecrets > 0 && <Notice tone="info">{hiddenSecrets} credential {hiddenSecrets === 1 ? 'field is' : 'fields are'} hidden. Provider secrets are never shown here or kept in the browser.</Notice>}

      <Panel title="Company" description="Used across the customer apps and in reports.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Company name" required><Input value={draft.name} maxLength={160} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Time zone" hint="IANA name, for example Africa/Lagos"><Input list="tz-list" value={draft.timezone} maxLength={100} onChange={(e) => set('timezone', e.target.value)} /></Field>
          <Field label="Locale" hint="For example en-NG"><Input value={draft.locale} maxLength={35} onChange={(e) => set('locale', e.target.value)} /></Field>
        </div>
        <datalist id="tz-list">{zones.map((z) => <option key={z} value={z} />)}</datalist>
      </Panel>

      <Panel title="Booking policies" description="Rules the booking flow applies. Delivery fee per leg is a flat amount added for each pickup or drop-off that uses delivery.">
        <ObjectEditor listId="policy-keys" keySuggestions={['delivery_fee_per_leg']} value={draft.booking_policies} onChange={(v) => set('booking_policies', v)} />
      </Panel>

      <Panel title="Booking add-ons" description="Optional extras offered at checkout, with their price.">
        <ObjectEditor listId="addon-keys" numbersOnly addLabel="Add extra" value={draft.booking_add_ons} onChange={(v) => set('booking_add_ons', v)} />
      </Panel>

      <Panel title="Payments" description="The server checks provider configuration when you save. If it rejects the change, nothing is applied.">
        <ObjectEditor listId="payment-keys" value={draft.payment_settings} onChange={(v) => set('payment_settings', v)} />
      </Panel>

      <Panel title="Enabled features">
        <ObjectEditor listId="feature-keys" value={draft.enabled_features} onChange={(v) => set('enabled_features', v)} />
      </Panel>

      <Panel title="Document requirements" description="Documents customers must upload for a booking. Edited as JSON because each entry has its own fields.">
        <JsonCell value={draft.document_requirements} onChange={(v) => Array.isArray(v) && set('document_requirements', v as Rec[])} />
      </Panel>

      <Panel title="App versions" description="Minimum and current versions for the mobile apps.">
        <ObjectEditor listId="version-keys" keySuggestions={['android', 'ios']} value={draft.app_versions} onChange={(v) => set('app_versions', v)} />
      </Panel>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-3 sm:px-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Unsaved changes in {changed.length} {changed.length === 1 ? 'section' : 'sections'}</p>
              {error && <div className="mt-2"><ErrorNotice error={error} onReload={() => void reload()} /></div>}
            </div>
            <Button variant="ghost" icon={<Undo2 className="h-4 w-4" />} disabled={busy} onClick={() => setDraft(original)}>Discard</Button>
            <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={busy} onClick={submit}>Save changes</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { settings, hiddenSecrets, loading, error, load } = useSettingsStore();
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Re-mount the form with fresh state whenever the server returns new settings.
  const formKey = useMemo(() => newKey(), [settings]);

  return (
    <>
      <PageHeader title="Settings" description="Company details, booking rules, payments and document requirements. Changes affect the customer flow straight away." />
      {error && !settings && <ErrorState error={error} onRetry={() => void load()} />}
      {!settings && !error && <LoadingBlock />}
      {settings && <SettingsForm key={formKey} settings={settings} hiddenSecrets={hiddenSecrets} />}
    </>
  );
}
