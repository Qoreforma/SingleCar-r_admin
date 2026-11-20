import { create } from 'zustand';
import { bookingsApi, type LocationBody } from '@/api/bookings';
import { toApiError, type ApiError } from '@/api/errors';
import { getVersion } from '@/lib/helpers';
import type { Rec } from '@/types/common';
import type { BookingStatus } from '@/types/bookings';
import { pagedSlice, type PagedState } from './createPagedStore';

interface BookingFilters { search: string; status: string; pickup_from: string; pickup_to: string }

interface BookingsState extends PagedState<Rec, BookingFilters> {
  detail: Rec | null;
  detailId: string | null;
  detailLoading: boolean;
  detailError: ApiError | null;
  /** Bumped after every mutation so tabs (documents, activity, notes) refetch. */
  revision: number;
  loadDetail: (id: string, opts?: { silent?: boolean }) => Promise<void>;
  setStatus: (id: string, status: BookingStatus, reason: string) => Promise<Rec>;
  assignDriver: (id: string, driverId: string | null, reason: string) => Promise<void>;
  setLocation: (id: string, leg: 'pickup' | 'dropoff', location: LocationBody['location'], reason: string) => Promise<void>;
  addNote: (id: string, note: string) => Promise<void>;
  reviewDocument: (id: string, code: string, body: { media_id: string; decision: 'approved' | 'rejected'; notes: string }) => Promise<void>;
}

export const useBookingsStore = create<BookingsState>()((set, get) => {
  /** Server owns state transitions: re-read the booking (and its version) after every write. */
  const refresh = async (id: string) => {
    await get().loadDetail(id, { silent: true });
    set((s) => ({ revision: s.revision + 1 }));
    if (get().loaded) void get().load();
  };
  const version = () => getVersion(get().detail);

  return {
    ...pagedSlice<Rec, BookingFilters, BookingsState>({
      initialFilters: { search: '', status: '', pickup_from: '', pickup_to: '' },
      fetcher: (q) => bookingsApi.list(q),
    })(set, get),

    detail: null, detailId: null, detailLoading: false, detailError: null, revision: 0,

    async loadDetail(id, opts) {
      if (!opts?.silent) set({ detail: null, detailLoading: true });
      set({ detailId: id, detailError: null });
      try {
        const { data } = await bookingsApi.get(id);
        if (get().detailId === id) set({ detail: data, detailLoading: false });
      } catch (e) {
        if (get().detailId === id) set({ detailError: toApiError(e), detailLoading: false });
      }
    },

    /** Returns the server response; a cancellation includes the refund attempts it created. */
    async setStatus(id, status, reason) {
      const { data } = await bookingsApi.setStatus(id, { status, reason, expected_version: version() });
      await refresh(id);
      return data;
    },
    async assignDriver(id, driverId, reason) {
      await bookingsApi.assignDriver(id, { driver_id: driverId, reason, expected_version: version() });
      await refresh(id);
    },
    async setLocation(id, leg, location, reason) {
      const body = { location, reason, expected_version: version() };
      await (leg === 'pickup' ? bookingsApi.setPickup(id, body) : bookingsApi.setDropoff(id, body));
      await refresh(id);
    },
    async addNote(id, note) {
      await bookingsApi.addNote(id, { note, expected_version: version() });
      await refresh(id);
    },
    async reviewDocument(id, code, body) {
      await bookingsApi.reviewDocument(id, code, body);
      await refresh(id);
    },
  };
});

/* ---------- Customer change requests (cancellation / modification) ---------- */
interface CrFilters { status: string; type: string }
interface ChangeRequestsState extends PagedState<Rec, CrFilters> {
  review: (id: string, decision: 'approved' | 'rejected', notes: string) => Promise<Rec>;
}

export const useChangeRequestsStore = create<ChangeRequestsState>()((set, get) => ({
  ...pagedSlice<Rec, CrFilters, ChangeRequestsState>({
    initialFilters: { status: 'pending', type: '' },
    fetcher: (q) => bookingsApi.changeRequests(q),
  })(set, get),
  async review(id, decision, notes) {
    const { data } = await bookingsApi.reviewChangeRequest(id, { decision, notes });
    await get().load();
    return data;
  },
}));
