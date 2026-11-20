import { api } from './client';
import type { AdminProfile, AdminSessionResult, LoginData } from '@/types/identity';

export const authApi = {
  /** POST /admin/auth/login: session | MFA challenge | first-time MFA enrollment. */
  login: (body: { email: string; password: string }) => api.post<LoginData>('/admin/auth/login', body),
  /** POST /admin/auth/verify-mfa: six-digit TOTP or 16-hex recovery code. */
  verifyMfa: (body: { mfaToken: string; code: string }) => api.post<AdminSessionResult>('/admin/auth/verify-mfa', body),
  logout: () => api.post('/admin/auth/logout'),
  me: () => api.get<AdminProfile>('/admin/auth/me'),
  forgotPassword: (email: string) => api.post('/admin/auth/forgot-password-otp', { email }),
  verifyResetOtp: (body: { email: string; otp: string }) => api.post<{ resetToken: string }>('/admin/auth/verify-reset-otp', body),
  resetPassword: (body: { token: string; password: string }) => api.post('/admin/auth/reset-password', body),
  acceptInvitation: (body: { token: string; password: string }) => api.post<AdminProfile>('/admin/auth/accept-invitation', body),
};
