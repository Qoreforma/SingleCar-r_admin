import { api, download, enc } from './client';
import { toPaged } from './pagination';
import type { AdminPayment, ReconciliationJob, Refund, WebhookEvent } from '@/types/payments';

type PageQ = { page: number; limit: number };
export interface PaymentQuery extends PageQ { status?: string; provider?: string; booking_id?: string; reconciliation_required?: string }
export interface RefundQuery extends PageQ { payment_id?: string; status?: string }
export interface JobQuery extends PageQ { status?: string }
export interface WebhookQuery extends PageQ { status?: string; provider?: string }

export const paymentsApi = {
  list: async (q: PaymentQuery) => toPaged<AdminPayment>(await api.get('/admin/payments', { ...q }), q),
  get: (id: string) => api.get<AdminPayment>(`/admin/payments/${enc(id)}`),
  reconcile: (id: string) => api.post(`/admin/payments/${enc(id)}/reconcile`),
  /** Amount is integer minor units. The idempotency key must be reused when retrying the same refund. */
  refund: (id: string, body: { amount_minor: number; reason: string; idempotency_key: string }) => api.post<Refund>(`/admin/payments/${enc(id)}/refunds`, body),
  exportCsv: (q: { from: string; to: string; currency?: string; provider?: string; status?: string }) => download('/admin/payments/export', { ...q }, 'payments.csv'),

  jobs: async (q: JobQuery) => toPaged<ReconciliationJob>(await api.get('/admin/payments/reconciliation-jobs', { ...q }), q),
  retryJob: (id: string) => api.post<ReconciliationJob>(`/admin/payments/reconciliation-jobs/${enc(id)}/retry`),

  refunds: async (q: RefundQuery) => toPaged<Refund>(await api.get('/admin/payments/refund-attempts', { ...q }), q),
  reconcileRefund: (id: string, body: { outcome: 'succeeded' | 'failed'; reason: string; provider_refund_reference?: string }) =>
    api.post<Refund>(`/admin/payments/refund-attempts/${enc(id)}/reconcile`, body),

  webhooks: async (q: WebhookQuery) => toPaged<WebhookEvent>(await api.get('/admin/payments/webhook-events', { ...q }), q),
};
