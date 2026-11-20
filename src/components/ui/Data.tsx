import { useEffect, useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { fmtDateTime, fmtMoney } from '@/lib/format';
import { SECRET_KEY, isRec, titleCase } from '@/lib/helpers';
import type { Rec } from '@/types/common';
import { Button } from './Button';
import { Checkbox, Input, Select, inputCls } from './Form';
import { Textarea } from './Form';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function Money({ minor, currency, className }: { minor?: number | null; currency?: string | null; className?: string }) {
  return <span className={clsx('tabular-nums', className)}>{fmtMoney(minor ?? null, currency)}</span>;
}

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  return <pre className={clsx('max-h-72 overflow-auto rounded-md bg-paper p-3 text-xs leading-relaxed', className)}>{JSON.stringify(value, null, 2)}</pre>;
}

function Scalar({ k, v, currency }: { k: string; v: unknown; currency?: string }): ReactNode {
  if (v === null || v === undefined || v === '') return <span className="text-ink-faint">—</span>;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return k.endsWith('_minor') && currency ? fmtMoney(v, currency) : v.toLocaleString();
  if (typeof v === 'string') return ISO.test(v) ? fmtDateTime(v) : <span className="break-words">{v}</span>;
  return String(v);
}

/** Renders any record readably. Used wherever the API reference types a payload as a free-form object. */
export function KeyValueList({ data, omit = [], currency, className }: { data: Rec; omit?: string[]; currency?: string; className?: string }) {
  const cur = typeof data.currency === 'string' ? data.currency : currency;
  const entries = Object.entries(data).filter(([k]) => !omit.includes(k) && !SECRET_KEY.test(k));
  if (!entries.length) return <p className="text-sm text-ink-faint">No details.</p>;
  return (
    <dl className={clsx('grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)]', className)}>
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-muted sm:pt-px">{titleCase(k)}</dt>
          <dd className="min-w-0">
            {isRec(v) ? (
              <KeyValueList data={v} currency={cur} className="rounded-md border-l-2 border-line pl-3" />
            ) : Array.isArray(v) ? (
              v.length === 0 ? <span className="text-ink-faint">—</span>
              : v.every((x) => !isRec(x) && !Array.isArray(x)) ? <span className="break-words">{v.map(String).join(', ')}</span>
              : <div className="space-y-2">{v.map((x, i) => (isRec(x) ? <KeyValueList key={i} data={x} currency={cur} className="rounded-md border-l-2 border-line pl-3" /> : <span key={i}>{String(x)}</span>))}</div>
            ) : (
              <Scalar k={k} v={v} currency={cur} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Free-form object editing ---------- */

function NumberCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { if (Number(text) !== value) setText(String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Input inputMode="decimal" value={text} onChange={(e) => {
      setText(e.target.value);
      const n = Number(e.target.value);
      if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(n);
    }} />
  );
}

export function JsonCell({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <div>
      <Textarea className={clsx('font-mono text-xs', bad && 'border-bad')} value={text} rows={Math.min(8, text.split('\n').length + 1)}
        onChange={(e) => {
          setText(e.target.value);
          try { onChange(JSON.parse(e.target.value)); setBad(false); } catch { setBad(true); }
        }} />
      {bad && <p className="mt-1 text-xs text-bad">Not valid JSON yet. Changes apply once it parses.</p>}
    </div>
  );
}

function ValueEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  if (typeof value === 'boolean') return <Checkbox className="pt-2" label={value ? 'Enabled' : 'Disabled'} checked={value} onChange={(e) => onChange(e.target.checked)} />;
  if (typeof value === 'number') return <NumberCell value={value} onChange={onChange} />;
  if (typeof value === 'string' || value === null || value === undefined) return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  return <JsonCell value={value} onChange={onChange} />;
}

type NewKind = 'text' | 'number' | 'boolean' | 'json';
const initialFor: Record<NewKind, unknown> = { text: '', number: 0, boolean: false, json: {} };

export function ObjectEditor({ value, onChange, keySuggestions, listId, addLabel = 'Add field', numbersOnly }: {
  value: Rec;
  onChange: (v: Rec) => void;
  keySuggestions?: string[];
  listId: string;
  addLabel?: string;
  numbersOnly?: boolean;
}) {
  const [key, setKey] = useState('');
  const [kind, setKind] = useState<NewKind>(numbersOnly ? 'number' : 'text');
  const trimmed = key.trim();
  const exists = trimmed in value;
  return (
    <div className="space-y-2">
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-start gap-2">
          <div className="truncate pt-2 text-sm text-ink-muted" title={k}>{k}</div>
          <ValueEditor value={v} onChange={(nv) => onChange({ ...value, [k]: nv })} />
          <Button variant="ghost" size="sm" className="mt-0.5" aria-label={`Remove ${k}`} onClick={() => { const { [k]: _gone, ...rest } = value; onChange(rest); }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <input list={listId} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Field name" aria-label="New field name" className={clsx(inputCls, 'h-9 w-44')} />
        {keySuggestions && <datalist id={listId}>{keySuggestions.map((s) => <option key={s} value={s} />)}</datalist>}
        {!numbersOnly && (
          <Select aria-label="Field type" className="w-28" value={kind} onChange={(e) => setKind(e.target.value as NewKind)}>
            <option value="text">Text</option><option value="number">Number</option><option value="boolean">Yes / No</option><option value="json">JSON</option>
          </Select>
        )}
        <Button size="sm" icon={<Plus className="h-4 w-4" />} disabled={!trimmed || exists} onClick={() => { onChange({ ...value, [trimmed]: initialFor[kind] }); setKey(''); }}>{addLabel}</Button>
        {exists && <span className="text-xs text-bad">Already exists</span>}
      </div>
    </div>
  );
}
