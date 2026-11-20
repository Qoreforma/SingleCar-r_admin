const dtCache = new Map<string, Intl.DateTimeFormat>();
function dtf(opts: Intl.DateTimeFormatOptions, key: string) {
  let f = dtCache.get(key);
  if (!f) { f = new Intl.DateTimeFormat(undefined, opts); dtCache.set(key, f); }
  return f;
}

export function fmtDateTime(iso?: unknown, utc = false): string {
  if (!iso || typeof iso !== 'string') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return utc
    ? `${dtf({ dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }, 'utc').format(d)} UTC`
    : dtf({ dateStyle: 'medium', timeStyle: 'short' }, 'local').format(d);
}
export function fmtDate(iso?: unknown): string {
  if (!iso || typeof iso !== 'string') return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : dtf({ dateStyle: 'medium' }, 'date').format(d);
}

/* ---------- Money: amounts are integer minor units; the currency always comes from the API ---------- */

export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch { return 2; }
}

export function fmtMoney(minor: number | null | undefined, currency?: string | null): string {
  if (minor == null || !Number.isFinite(minor)) return '—';
  if (!currency) return `${minor.toLocaleString()} (minor units)`;
  try {
    const digits = currencyDigits(currency);
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 10 ** digits);
  } catch {
    return `${minor.toLocaleString()} ${currency} (minor units)`;
  }
}

/** Parse "1,250.50" into integer minor units without floating-point drift. Returns null if invalid. */
export function toMinor(input: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  const clean = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  if (frac.length > digits) return null;
  const minor = Number(whole + frac.padEnd(digits, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

/* ---------- Date inputs <-> API date-time strings ---------- */

export const todayIso = () => new Date().toISOString().slice(0, 10);
export function daysAgoIso(days: number) {
  const d = new Date(); d.setUTCDate(d.getUTCDate() - days); return d.toISOString().slice(0, 10);
}
/** YYYY-MM-DD → UTC start of day. */
export const dayStartUtc = (d: string) => `${d}T00:00:00.000Z`;
/** YYYY-MM-DD → UTC end of day (inclusive end date). */
export const dayEndUtc = (d: string) => `${d}T23:59:59.999Z`;
/** YYYY-MM-DD → start of the following UTC day, for half-open [from, to) endpoints. */
export function nextDayUtc(d: string) {
  const x = new Date(`${d}T00:00:00.000Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString();
}
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** <input type="datetime-local"> value (browser local time) → ISO string. */
export function localInputToIso(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
/** ISO string → <input type="datetime-local"> value. */
export function isoToLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
