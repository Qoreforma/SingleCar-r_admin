import { create } from 'zustand';
import { paymentsApi } from '@/api/payments';
import type { AdminPayment, ReconciliationJob, Refund, WebhookEvent } from '@/types/payments';
import { pagedSlice, type PagedState } from './createPagedStore';

/* ---------- Payments ---------- */
interface PaymentFilters { status: string; provider: string; booking_id: string; reconciliation_required: string }
interface PaymentsState extends PagedState<AdminPayment, PaymentFilters> {
  reconcile: (id: string) => Promise<void>;
  refund: (id: string, body: { amount_minor: number; reason: string; idempotency_key: string }) => Promise<Refund | undefined>;
}

export const usePaymentsStore = create<PaymentsState>()((set, get) => ({
  ...pagedSlice<AdminPayment, PaymentFilters, PaymentsState>({
    initialFilters: { status: '', provider: '', booking_id: '', reconciliation_required: '' },
    fetcher: (q) => paymentsApi.list(q),
  })(set, get),

  async reconcile(id) {
    await paymentsApi.reconcile(id);
    await get().load();
    if (useJobsStore.getState().loaded) void useJobsStore.getState().load();
  },
  /** 202 Accepted: the provider outcome may still be pending, so callers must refetch rather than assume success. */
  async refund(id, body) {
    const { data } = await paymentsApi.refund(id, body);
    await get().load();
    if (useRefundsStore.getState().loaded) void useRefundsStore.getState().load();
    return data;
  },
}));

/* ---------- Refund attempts ---------- */
interface RefundFilters { payment_id: string; status: string }
interface RefundsState extends PagedState<Refund, RefundFilters> {
  reconcile: (id: string, body: { outcome: 'succeeded' | 'failed'; reason: string; provider_refund_reference?: string }) => Promise<void>;
}
export const useRefundsStore = create<RefundsState>()((set, get) => ({
  ...pagedSlice<Refund, RefundFilters, RefundsState>({
    initialFilters: { payment_id: '', status: '' },
    fetcher: (q) => paymentsApi.refunds(q),
  })(set, get),
  async reconcile(id, body) {
    await paymentsApi.reconcileRefund(id, body);
    await get().load();
    if (usePaymentsStore.getState().loaded) void usePaymentsStore.getState().load();
  },
}));

/* ---------- Reconciliation jobs ---------- */
interface JobFilters { status: string }
interface JobsState extends PagedState<ReconciliationJob, JobFilters> {
  retry: (id: string) => Promise<void>;
}
export const useJobsStore = create<JobsState>()((set, get) => ({
  ...pagedSlice<ReconciliationJob, JobFilters, JobsState>({
    initialFilters: { status: '' },
    fetcher: (q) => paymentsApi.jobs(q),
  })(set, get),
  async retry(id) {
    await paymentsApi.retryJob(id);
    await get().load();
  },
}));

/* ---------- Webhook events (read-only inspection; webhooks themselves are server-to-server) ---------- */
interface WebhookFilters { status: string; provider: string }
export const useWebhooksStore = create<PagedState<WebhookEvent, WebhookFilters>>()((set, get) =>
  pagedSlice<WebhookEvent, WebhookFilters>({
    initialFilters: { status: '', provider: '' },
    fetcher: (q) => paymentsApi.webhooks(q),
  })(set, get),
);
