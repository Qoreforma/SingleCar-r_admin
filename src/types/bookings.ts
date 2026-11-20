export interface DriverProfile {
  id: string;
  full_name: string;
  email: string;
  phone_e164: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'accepted_by_driver' | 'on_going' | 'completed' | 'cancelled';
export const BOOKING_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'accepted_by_driver', 'on_going', 'completed', 'cancelled'];

export interface ModificationOffer {
  pickup: { dateTime: string; coordinates?: { lat?: number; lng?: number }; locationId?: string | null; locationName?: string | null };
  dropoff: { dateTime: string; coordinates?: { lat?: number; lng?: number }; locationId?: string | null; locationName?: string | null };
  pickup_type: 'delivery' | 'self_pickup';
  dropoff_type: 'delivery' | 'self_pickup';
  dropoff_same: boolean;
  price_breakdown: Record<string, unknown>;
  /** Positive: more upfront payment due. Negative: an eligible captured balance is refunded. */
  payment_delta_minor: number;
  expires_at: string;
}

export interface RefundAttemptSummary {
  id: string;
  payment_id: string;
  amount_minor: number;
  currency: string;
  reason: string;
  status: 'submitting' | 'processing' | 'succeeded' | 'failed' | 'requires_reconciliation';
  provider_refund_reference?: string;
  failure_code?: string;
  reconciled_at?: string;
  created_at: string;
}

export interface ChangeRequestDetail {
  offer?: ModificationOffer;
  confirmed_at?: string | null;
  confirmation_failure_code?: string;
  cancellation_policy?: {
    calculated_at: string;
    hours_until_pickup: number;
    refund_percent: number;
    currency: string;
    estimated_refund_minor: number;
    payment_estimates: { payment_id: string; estimated_refund_minor: number }[];
  };
  refund_attempts?: RefundAttemptSummary[];
  [k: string]: unknown;
}
