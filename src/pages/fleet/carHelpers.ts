import { pick, pickStr } from '@/lib/helpers';
import type { Rec } from '@/types/common';

export const carTitle = (c: Rec) => pickStr(c, 'title', 'name') ?? ([pickStr(c, 'brand'), pickStr(c, 'model'), pickStr(c, 'year')].filter(Boolean).join(' ') || 'Untitled vehicle');
export const carSubtitle = (c: Rec) => [pickStr(c, 'brand'), pickStr(c, 'model'), pickStr(c, 'year')].filter(Boolean).join(' ');
export const carActive = (c: Rec) => pick(c, 'is_active', 'active') !== false;
export const carLocations = (c: Rec): string[] => {
  const v = pick(c, 'locations');
  return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : String(pick(x, 'name', 'location_name', 'id') ?? ''))).filter(Boolean) : [];
};
