import { useEffect, useMemo, useState } from 'react';
import { getVersion, isRec, pick, sameJson } from '@/lib/helpers';
import type { Rec } from '@/types/common';
import type { ReferenceData } from '@/api/fleet';
import { useFleetStore } from '@/stores/fleetStore';
import { useAction } from '@/hooks/useAction';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, TagInput } from '@/components/ui/Form';
import { ErrorNotice } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Overlay';
import { ObjectEditor } from '@/components/ui/Data';

const KNOWN = new Set(['title', 'brand', 'model', 'year', 'pricing', 'locations', 'rental_policy', 'is_active']);
const SYSTEM = new Set(['id', '_id', 'version', '__v', 'created_at', 'updated_at', 'company_id', 'deleted_at']);
const SPEC_HINTS = ['series', 'class', 'body_type', 'transmission', 'fuel_policy', 'color'];

interface Form {
  title: string; brand: string; model: string; year: string;
  locations: string[]; is_active: boolean;
  pricing: Rec; extras: Rec;
  minimum_age: string; minimum_driving_experience_months: string; minimum_rental_days: string;
  payment_on_pickup: string[]; required_documents: string[]; car_rental_terms_url: string;
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

function toForm(car?: Rec): Form {
  const rp = isRec(car?.rental_policy) ? (car!.rental_policy as Rec) : {};
  const extras: Rec = {};
  if (car) for (const [k, v] of Object.entries(car)) if (!KNOWN.has(k) && !SYSTEM.has(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) extras[k] = v;
  const strings = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return {
    title: str(car?.title), brand: str(car?.brand), model: str(car?.model), year: str(car?.year),
    locations: Array.isArray(car?.locations) ? (car!.locations as unknown[]).map((x) => (typeof x === 'string' ? x : str(pick(x, 'name', 'location_name', 'id')))).filter(Boolean) : [],
    is_active: car ? pick(car, 'is_active') !== false : true,
    pricing: isRec(car?.pricing) ? (car!.pricing as Rec) : {}, extras,
    minimum_age: str(rp.minimum_age), minimum_driving_experience_months: str(rp.minimum_driving_experience_months), minimum_rental_days: str(rp.minimum_rental_days),
    payment_on_pickup: strings(rp.payment_on_pickup), required_documents: strings(rp.required_documents), car_rental_terms_url: str(rp.car_rental_terms_url),
  };
}

function rentalPolicy(f: Form): Rec {
  const out: Rec = {};
  const n = (s: string) => (s.trim() === '' ? undefined : Number(s));
  const set = (k: string, v: unknown) => { if (v !== undefined && !(typeof v === 'number' && Number.isNaN(v))) out[k] = v; };
  set('minimum_age', n(f.minimum_age));
  set('minimum_driving_experience_months', n(f.minimum_driving_experience_months));
  set('minimum_rental_days', n(f.minimum_rental_days));
  if (f.payment_on_pickup.length) out.payment_on_pickup = f.payment_on_pickup;
  if (f.required_documents.length) out.required_documents = f.required_documents;
  if (f.car_rental_terms_url.trim()) out.car_rental_terms_url = f.car_rental_terms_url.trim();
  return out;
}

export function CarFormModal({ open, car, reference, pricingHints, onClose, onSaved }: {
  open: boolean; car?: Rec | null; reference: ReferenceData | null; pricingHints: string[]; onClose: () => void; onSaved?: (car: Rec) => void;
}) {
  const { create, update, load } = useFleetStore();
  const { run, busy, error, reset } = useAction();
  const original = useMemo(() => toForm(car ?? undefined), [car, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState<Form>(original);
  useEffect(() => { if (open) { setF(original); reset(); } }, [open, original, reset]);
  const editing = !!car;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const year = Number(f.year);
  const valid = f.title.trim().length >= 2 && f.brand.trim() && f.model.trim() && Number.isInteger(year) && year >= 1886 && (editing || Object.keys(f.pricing).length > 0);

  const submit = async () => {
    const policy = rentalPolicy(f);
    if (!editing) {
      const body: Rec = { title: f.title.trim(), brand: f.brand.trim(), model: f.model.trim(), year, pricing: f.pricing, locations: f.locations, is_active: f.is_active, ...f.extras };
      if (Object.keys(policy).length) body.rental_policy = policy;
      const r = await run(() => create(body), { success: 'Vehicle added' });
      if (r.ok && r.value) { onSaved?.(r.value); onClose(); }
      return;
    }
    // Updates send only what changed, plus the version the operator was looking at.
    const body: Rec & { expected_version: number } = { expected_version: getVersion(car) };
    if (f.title.trim() !== original.title) body.title = f.title.trim();
    if (f.brand.trim() !== original.brand) body.brand = f.brand.trim();
    if (f.model.trim() !== original.model) body.model = f.model.trim();
    if (f.year !== original.year) body.year = year;
    if (!sameJson(f.pricing, original.pricing)) body.pricing = f.pricing;
    if (!sameJson(f.locations, original.locations)) body.locations = f.locations;
    if (f.is_active !== original.is_active) body.is_active = f.is_active;
    if (!sameJson(policy, rentalPolicy(original))) body.rental_policy = policy;
    for (const [k, v] of Object.entries(f.extras)) if (!sameJson(v, original.extras[k])) body[k] = v;
    if (Object.keys(body).length === 1) return onClose();
    const r = await run(() => update(String(pick(car, 'id', '_id')), body), { success: 'Vehicle updated' });
    if (r.ok && r.value) { onSaved?.(r.value); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" dismissible={!busy} title={editing ? 'Edit vehicle' : 'Add vehicle'}
      description={editing ? 'Only the fields you change are sent. Pricing changes are recorded in price history.' : 'New vehicles appear to customers when active.'}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" loading={busy} disabled={!valid} onClick={submit}>{editing ? 'Save changes' : 'Add vehicle'}</Button>
      </>}>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Listing title" required className="sm:col-span-2"><Input autoFocus maxLength={160} value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Brand" required><Input list="car-brands" maxLength={80} value={f.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
          <Field label="Model" required><Input list="car-models" maxLength={120} value={f.model} onChange={(e) => set('model', e.target.value)} /></Field>
          <Field label="Year" required error={f.year && !(year >= 1886) ? 'Enter a valid year.' : undefined}><Input inputMode="numeric" maxLength={4} value={f.year} onChange={(e) => set('year', e.target.value.replace(/\D/g, ''))} /></Field>
          <div className="flex items-end pb-2"><Checkbox label="Active (visible to customers)" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /></div>
        </div>
        <datalist id="car-brands">{reference?.brands?.map((b) => <option key={b} value={b} />)}</datalist>
        <datalist id="car-models">{reference?.models?.map((m) => <option key={m} value={m} />)}</datalist>

        <Field label="Pickup and drop-off locations"><TagInput listId="car-locations" suggestions={reference?.locations} value={f.locations} onChange={(v) => set('locations', v)} placeholder="Type a location and press Enter" /></Field>

        <fieldset>
          <legend className="mb-1 text-[13px] font-medium">Pricing{!editing && <span className="text-bad" aria-hidden> *</span>}</legend>
          <p className="mb-2 text-xs text-ink-muted">Use the same field names your existing vehicles use{pricingHints.length ? ` (${pricingHints.slice(0, 4).join(', ')}…)` : ''}.</p>
          <ObjectEditor listId="pricing-keys" keySuggestions={pricingHints} value={f.pricing} onChange={(v) => set('pricing', v)} />
        </fieldset>

        <fieldset className="rounded-md border border-line p-3">
          <legend className="px-1 text-[13px] font-medium">Rental policy</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Minimum age" hint="16 to 100"><Input inputMode="numeric" value={f.minimum_age} onChange={(e) => set('minimum_age', e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Driving experience (months)" hint="0 to 1200"><Input inputMode="numeric" value={f.minimum_driving_experience_months} onChange={(e) => set('minimum_driving_experience_months', e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Minimum rental days" hint="1 to 60"><Input inputMode="numeric" value={f.minimum_rental_days} onChange={(e) => set('minimum_rental_days', e.target.value.replace(/\D/g, ''))} /></Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Payable at pickup"><TagInput listId="pay-pickup" value={f.payment_on_pickup} onChange={(v) => set('payment_on_pickup', v)} placeholder="For example cash" /></Field>
            <Field label="Required documents"><TagInput listId="req-docs" value={f.required_documents} onChange={(v) => set('required_documents', v)} placeholder="Document codes" /></Field>
            <Field label="Rental terms link" className="sm:col-span-2"><Input type="url" placeholder="https://" value={f.car_rental_terms_url} onChange={(e) => set('car_rental_terms_url', e.target.value)} /></Field>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-[13px] font-medium">Other details</legend>
          <p className="mb-2 text-xs text-ink-muted">Specs such as {SPEC_HINTS.join(', ')}. {editing && 'Removing a field here doesn’t delete it on the server.'}</p>
          <ObjectEditor listId="extra-keys" keySuggestions={SPEC_HINTS} value={f.extras} onChange={(v) => set('extras', v)} />
        </fieldset>

        <ErrorNotice error={error} onReload={() => { void load(); onClose(); }} />
      </div>
    </Modal>
  );
}
