import { useMemo, type ReactNode } from 'react';
import { fmtDateTime, fmtMoney } from '@/lib/format';
import { SECRET_KEY, isRec, shortId, titleCase } from '@/lib/helpers';
import type { Rec } from '@/types/common';
import { KeyValueList } from './Data';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** One level of flattening so nested objects (e.g. pickup.dateTime) become readable columns. */
function flatten(rec: Rec): Rec {
  const out: Rec = {};
  for (const [k, v] of Object.entries(rec)) {
    if (SECRET_KEY.test(k)) continue;
    if (isRec(v)) for (const [k2, v2] of Object.entries(v)) { if (!isRec(v2) && !Array.isArray(v2) && !SECRET_KEY.test(k2)) out[`${k}.${k2}`] = v2; }
    else if (Array.isArray(v)) { if (v.every((x) => !isRec(x) && !Array.isArray(x))) out[k] = v.join(', '); }
    else out[k] = v;
  }
  return out;
}

function cell(key: string, v: unknown, currency?: string): ReactNode {
  if (v === null || v === undefined || v === '') return <span className="text-ink-faint">—</span>;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return key.endsWith('_minor') && currency ? fmtMoney(v, currency) : v.toLocaleString();
  const s = String(v);
  if (ISO.test(s)) return <span className="whitespace-nowrap">{fmtDateTime(s)}</span>;
  if (/^[0-9a-f]{24}$/i.test(s)) return <span className="text-ink-muted" title={s}>{shortId(s)}</span>;
  return s.length > 60 ? <span title={s}>{s.slice(0, 58)}…</span> : s;
}

/** Table for payloads the API reference types as free-form records: columns are inferred from the data. */
export function AutoTable({ rows, maxCols = 6, currency }: { rows: Rec[]; maxCols?: number; currency?: string }) {
  const flat = useMemo(() => rows.map(flatten), [rows]);
  const columns = useMemo(() => {
    const freq = new Map<string, number>();
    flat.slice(0, 30).forEach((r) => Object.keys(r).forEach((k) => freq.set(k, (freq.get(k) ?? 0) + 1)));
    const skip = (k: string) => /(^|\.)(_?id|__v|version|company_id)$/i.test(k) && freq.size > maxCols;
    return [...freq.entries()].filter(([k]) => !skip(k)).sort((a, b) => b[1] - a[1]).slice(0, maxCols).map(([k]) => k);
  }, [flat, maxCols]);

  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-faint">Nothing to show.</p>;
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[480px] border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b border-line bg-paper/60 text-left text-[13px] text-ink-muted">
            {columns.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{titleCase(c.replace('.', ' '))}</th>)}
          </tr>
        </thead>
        <tbody>
          {flat.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {columns.map((c) => <td key={c} className="px-3 py-2 align-top">{cell(c, r[c], typeof r.currency === 'string' ? r.currency : currency)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renders an unknown-shaped object: each array of records becomes a table, everything else a key/value list. */
export function AutoSections({ data, currency }: { data: unknown; currency?: string }) {
  if (Array.isArray(data)) return <AutoTable rows={data.filter(isRec)} currency={currency} />;
  if (!isRec(data)) return <p className="text-sm text-ink-faint">No data.</p>;
  const tables = Object.entries(data).filter(([, v]) => Array.isArray(v) && v.some(isRec));
  const rest: Rec = Object.fromEntries(Object.entries(data).filter(([k]) => !tables.some(([t]) => t === k)));
  return (
    <div className="space-y-5">
      {Object.keys(rest).length > 0 && <KeyValueList data={rest} currency={currency} />}
      {tables.map(([k, v]) => (
        <div key={k}>
          <h4 className="mb-1.5 text-[13px] font-semibold">{titleCase(k)}</h4>
          <AutoTable rows={(v as unknown[]).filter(isRec)} currency={currency} />
        </div>
      ))}
    </div>
  );
}
