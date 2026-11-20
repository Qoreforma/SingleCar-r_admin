import { api, download } from './client';
import type { DashboardResult } from '@/types/identity';

export interface DashboardQuery { from?: string; to?: string; currency?: string; provider?: string }

export const dashboardApi = {
  get: (q: DashboardQuery) => api.get<DashboardResult>('/admin/dashboard', { ...q }),
  /** CSV, half-open UTC interval [from, to). */
  cancellationsCsv: (q: { from: string; to: string }) => download('/admin/dashboard/cancellations', q, 'cancellations.csv'),
  fleetUtilizationCsv: (q: { from: string; to: string }) => download('/admin/dashboard/fleet-utilization', q, 'fleet-utilization.csv'),
};
