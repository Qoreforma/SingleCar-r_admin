import { api, download, enc } from './client';
import { toPaged } from './pagination';
import type { Rec } from '@/types/common';

export interface FleetQuery { page: number; limit: number; search?: string; is_active?: string; brand?: string; location?: string }

export interface ReferenceData {
  brands?: string[]; series?: string[]; models?: string[]; classes?: string[]; body_types?: string[];
  transmissions?: string[]; fuel_policies?: string[]; colors?: string[]; locations?: string[];
}

export interface BlockConflicts {
  car_id?: string; starts_at?: string; ends_at?: string;
  conflicting_bookings?: { id?: string; reference?: string; status?: string; pickup_at?: string; dropoff_at?: string }[];
  conflicting_blocks?: { id?: string; reason?: string; status?: string; starts_at?: string; ends_at?: string }[];
}

const base = (carId: string) => `/admin/cars/${enc(carId)}`;

export const fleetApi = {
  list: async (q: FleetQuery) => toPaged<Rec>(await api.get('/admin/cars', { ...q }), q),
  referenceData: () => api.get<ReferenceData>('/admin/cars/reference-data'),
  create: (body: Rec) => api.post<Rec>('/admin/cars', body),
  update: (carId: string, body: Rec & { expected_version: number }) => api.patch<Rec>(base(carId), body),
  /** DELETE with a body: soft-deactivation, version checked. */
  deactivate: (carId: string, expected_version: number) => api.del<Rec>(base(carId), { expected_version }),
  priceHistory: (carId: string, q: { page: number; limit: number }) => api.get(`${base(carId)}/price-history`, { ...q }),
  calendar: (carId: string, q: { from: string; to: string; page?: number; limit?: number }) => api.get(`${base(carId)}/availability-calendar`, { ...q }),
  blocks: (carId: string, q: { page: number; limit: number; status?: string }) => api.get(`${base(carId)}/availability-blocks`, { ...q }),
  conflicts: (carId: string, q: { starts_at: string; ends_at: string }) => api.get<BlockConflicts>(`${base(carId)}/availability-blocks/conflicts`, { ...q }),
  createBlock: (carId: string, body: { starts_at: string; ends_at: string; reason: string }) => api.post<Rec>(`${base(carId)}/availability-blocks`, body),
  releaseBlock: (carId: string, blockId: string) => api.del(`${base(carId)}/availability-blocks/${enc(blockId)}`),
  rescheduleBooking: (carId: string, blockId: string, body: { booking_id: string; expected_version: number; pickup_at: string; dropoff_at: string }) =>
    api.post<Rec>(`${base(carId)}/availability-blocks/${enc(blockId)}/reschedule`, body),
  exportInventory: (q: Omit<FleetQuery, 'page' | 'limit'>) => download('/admin/cars/export', { ...q }, 'fleet-inventory'),
};
