import type { Rec } from '@/types/common';

export const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Read a dotted path from an object: get(o, 'pickup.dateTime'). */
export function get(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (!isRec(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** First defined, non-null value among several candidate paths. Response shapes for many records are loosely typed. */
export function pick(obj: unknown, ...paths: string[]): unknown {
  for (const p of paths) {
    const v = get(obj, p);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}
export const pickStr = (obj: unknown, ...paths: string[]): string | undefined => {
  const v = pick(obj, ...paths);
  return v === undefined ? undefined : String(v);
};
export const pickNum = (obj: unknown, ...paths: string[]): number | undefined => {
  const v = pick(obj, ...paths);
  const x = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(x) ? x : undefined;
};

export const getId = (o: unknown): string => String(pick(o, 'id', '_id') ?? '');
/** Optimistic-concurrency version used for expected_version. */
export const getVersion = (o: unknown): number => pickNum(o, 'version') ?? 0;

/** Find the first array of records inside a loosely-typed payload. */
export function extractList(data: unknown): Rec[] {
  if (Array.isArray(data)) return data.filter(isRec);
  if (isRec(data)) {
    for (const key of ['items', 'data', 'results', 'blocks', 'events', 'history', 'snapshots', 'prices']) {
      if (Array.isArray(data[key])) return (data[key] as unknown[]).filter(isRec);
    }
  }
  return [];
}

export const SECRET_KEY = /(secret|token|password|passwd|private|api[_-]?key|signing|webhook[_-]?key)/i;

/** Strip anything that looks like a credential before it can reach browser state. */
export function redactSecrets<T>(value: T): { clean: T; hidden: number } {
  let hidden = 0;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (isRec(v)) {
      const out: Rec = {};
      for (const [k, val] of Object.entries(v)) {
        if (SECRET_KEY.test(k) && typeof val !== 'boolean' && typeof val !== 'number') { hidden++; continue; }
        out[k] = walk(val);
      }
      return out;
    }
    return v;
  };
  return { clean: walk(value) as T, hidden };
}

export const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function titleCase(s: string): string {
  const t = s.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function shortId(id: string, len = 8): string {
  return id.length > len + 2 ? `${id.slice(0, len)}…` : id;
}

export function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
