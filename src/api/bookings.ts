import { api, download, enc } from './client';
import { toPaged } from './pagination';
import type { Rec } from '@/types/common';
import type { BookingStatus } from '@/types/bookings';

export interface BookingQuery { page: number; limit: number; search?: string; status?: string; pickup_from?: string; pickup_to?: string }
export interface ChangeRequestQuery { page: number; limit: number; status?: string; type?: string }

const b = (id: string) => `/admin/bookings/${enc(id)}`;

export const bookingsApi = {
  list: async (q: BookingQuery) => toPaged<Rec>(await api.get('/admin/bookings', { ...q }), q),
  get: (id: string) => api.get<Rec>(b(id)),
  activity: (id: string, q: { page: number; limit: number }) => api.get(`${b(id)}/activity`, { ...q }),
  documents: (id: string) => api.get<Rec[]>(`${b(id)}/documents`),
  reviewDocument: (id: string, code: string, body: { media_id: string; decision: 'approved' | 'rejected'; notes: string }) =>
    api.patch<Rec>(`${b(id)}/documents/${enc(code)}/review`, body),
  documentReviews: (id: string, code: string) => api.get<Rec[]>(`${b(id)}/documents/${enc(code)}/reviews`),
  assignDriver: (id: string, body: { driver_id: string | null; expected_version: number; reason: string }) => api.patch<Rec>(`${b(id)}/driver`, body),
  setPickup: (id: string, body: LocationBody) => api.patch<Rec>(`${b(id)}/pickup-location`, body),
  setDropoff: (id: string, body: LocationBody) => api.patch<Rec>(`${b(id)}/dropoff-location`, body),
  internalEvents: (id: string) => api.get<Rec[]>(`${b(id)}/internal-events`),
  addNote: (id: string, body: { note: string; expected_version: number }) => api.post<Rec>(`${b(id)}/internal-events`, body),
  setStatus: (id: string, body: { status: BookingStatus; expected_version: number; reason: string }) => api.patch<Rec>(`${b(id)}/status`, body),
  exportCsv: (q: { pickup_from: string; pickup_to: string; search?: string; status?: string }) => download('/admin/bookings/export', { ...q }, 'bookings.csv'),

  changeRequests: async (q: ChangeRequestQuery) => toPaged<Rec>(await api.get('/admin/bookings/change-requests', { ...q }), q),
  changeRequest: (id: string) => api.get<Rec>(`/admin/bookings/change-requests/${enc(id)}`),
  reviewChangeRequest: (id: string, body: { decision: 'approved' | 'rejected'; notes: string }) =>
    api.patch<Rec>(`/admin/bookings/change-requests/${enc(id)}/review`, body),
  changeRequestReviews: (id: string) => api.get<Rec[]>(`/admin/bookings/change-requests/${enc(id)}/reviews`),
};

export interface LocationBody {
  location: { location_id?: string; location_name?: string; coordinates?: { lat: number; lng: number } };
  reason: string;
  expected_version: number;
}
