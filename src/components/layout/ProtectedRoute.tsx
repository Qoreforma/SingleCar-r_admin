import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoadingBlock } from '@/components/ui/Feedback';
import { AppShell } from './AppShell';

export function ProtectedRoute() {
  const { phase, recoveryCodes } = useAuthStore();
  const location = useLocation();
  if (phase === 'booting') return <div className="min-h-screen"><LoadingBlock label="Restoring your session…" /></div>;
  // Recovery codes are shown once; the app stays locked until the operator confirms they saved them.
  if (phase !== 'authenticated' || recoveryCodes) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <AppShell />;
}
