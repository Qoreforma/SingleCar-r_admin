import type { Rec } from './common';

export interface AdminProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  permissions: string[];
  is_active?: boolean;
  last_login_at?: string | null;
  created_at?: string;
}

export interface AdminSessionResult {
  accessToken: string;
  refreshToken: string;
  user: AdminProfile;
  /** Present only once, right after first-time MFA enrollment. */
  recoveryCodes?: string[];
}
export interface AdminMfaChallengeResult { mfaRequired: true; mfaToken: string }
export interface AdminMfaSetupResult { mfaSetupRequired: true; mfaToken: string; secret: string; otpAuthUrl: string }
export type LoginData = AdminSessionResult | AdminMfaChallengeResult | AdminMfaSetupResult;

export interface StaffItem { id: string; full_name: string; email: string; role: string; is_active: boolean }

export interface AuditLogItem {
  id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  actor_name?: string;
  created_at: string;
  metadata?: Rec;
}

export interface RevenueBreakdown {
  payment_count: number;
  gross_amount_minor: number;
  refunded_amount_minor: number;
  net_amount_minor: number;
}
export interface DashboardResult {
  period?: { from: string; to: string; timezone: 'UTC'; basis: 'booking_created_at' };
  revenue?: {
    basis: 'payment_created_at';
    payment_count: number;
    successful_payment_count: number;
    gross_amount_minor: number;
    refunded_amount_minor: number;
    net_amount_minor: number;
    by_currency: Record<string, RevenueBreakdown>;
    by_provider: Record<string, RevenueBreakdown>;
  };
  bookings?: Rec;
  fleet?: Rec;
  review_queues?: Rec;
  definitions?: Record<string, string>;
}

export interface CompanySettings {
  id: string;
  name: string;
  timezone: string;
  locale: string;
  booking_add_ons?: Record<string, unknown>;
  booking_policies: { delivery_fee_per_leg?: number; [k: string]: unknown };
  payment_settings: Rec;
  enabled_features?: Rec;
  document_requirements?: Rec[];
  app_versions?: Rec;
}
export type CompanySettingsUpdate = Partial<Omit<CompanySettings, 'id'>>;
