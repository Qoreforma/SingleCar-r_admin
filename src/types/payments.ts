export type PaymentProvider = 'paystack' | 'stripe';
export type PaymentOption = 'full_at_booking' | 'deposit_at_booking' | 'modification_balance';
export type PaymentStatus = 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'cancelled' | 'partially_refunded' | 'refunded';
export type RefundStatus = 'submitting' | 'processing' | 'succeeded' | 'failed' | 'requires_reconciliation';

export const PAYMENT_PROVIDERS: PaymentProvider[] = ['paystack', 'stripe'];
export const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'requires_action', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded'];
export const REFUND_STATUSES: RefundStatus[] = ['submitting', 'processing', 'succeeded', 'failed', 'requires_reconciliation'];

export interface AdminPayment {
  id: string;
  booking_id: string;
  provider: PaymentProvider;
  payment_option: PaymentOption;
  status: PaymentStatus;
  amount_minor: number;
  amount_refunded_minor: number;
  currency: string;
  checkout_url?: string | null;
  reconciliation_required: boolean;
  created_at: string;
  paid_at?: string | null;
  booking_reference?: string | null;
  customer_id: string;
  amount_refund_pending_minor: number;
  provider_reference?: string | null;
  provider_transaction_reference?: string | null;
  failure_code?: string | null;
  booking_status?: string | null;
  booking_payment_status?: string | null;
}

export interface Refund {
  id: string;
  payment_id: string;
  amount_minor: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  provider_refund_reference?: string | null;
  failure_code?: string | null;
  reconciled_at?: string | null;
  created_at: string;
}

export interface ReconciliationJob {
  id: string;
  payment_id: string;
  status: 'queued' | 'processing' | 'completed' | 'dead_letter';
  attempts: number;
  available_at?: string;
  last_attempt_at?: string;
  completed_at?: string;
  last_error_code?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  provider: PaymentProvider;
  provider_event_id: string;
  event_type: string;
  payment_id?: string;
  status: 'received' | 'processed' | 'failed';
  failure_code?: string;
  received_at: string;
  processed_at?: string;
}
