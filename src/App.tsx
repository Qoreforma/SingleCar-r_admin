import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoadingBlock, Toaster } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';

const Login = lazy(() => import('@/pages/auth/Login'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const AcceptInvitation = lazy(() => import('@/pages/auth/AcceptInvitation'));
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'));
const Bookings = lazy(() => import('@/pages/bookings/Bookings'));
const BookingDetail = lazy(() => import('@/pages/bookings/BookingDetail'));
const ChangeRequests = lazy(() => import('@/pages/bookings/ChangeRequests'));
const Drivers = lazy(() => import('@/pages/drivers/Drivers'));
const Fleet = lazy(() => import('@/pages/fleet/Fleet'));
const Customers = lazy(() => import('@/pages/customers/Customers'));
const Payments = lazy(() => import('@/pages/payments/Payments'));
const Staff = lazy(() => import('@/pages/staff/Staff'));
const AuditLog = lazy(() => import('@/pages/staff/AuditLog'));
const Settings = lazy(() => import('@/pages/settings/Settings'));

function NotFound() {
  return (
    <div className="mx-auto max-w-sm py-24 text-center">
      <div className="lane-dash mx-auto mb-5 h-12 w-[3px]" aria-hidden />
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="mt-1 text-sm text-ink-muted">That address doesn’t match anything in the admin.</p>
      <Link to="/" className="mt-4 inline-block"><Button variant="primary">Go to dashboard</Button></Link>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-sm py-24 text-center">
        <h1 className="text-lg font-semibold">The screen hit an unexpected error</h1>
        <p className="mt-1 text-sm text-ink-muted">Reload to continue. Nothing was changed by this error.</p>
        <Button className="mt-4" variant="primary" onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }
}

export function App() {
  useEffect(() => { void useAuthStore.getState().bootstrap(); }, []);
  return (
    <Boundary>
      <Suspense fallback={<LoadingBlock />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/accept-invitation" element={<AcceptInvitation />} />
          <Route element={<ProtectedRoute />}>
            <Route index element={<Dashboard />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="bookings/change-requests" element={<ChangeRequests />} />
            <Route path="bookings/:bookingId" element={<BookingDetail />} />
            <Route path="drivers" element={<Drivers />} />
            <Route path="fleet" element={<Fleet />} />
            <Route path="customers" element={<Customers />} />
            <Route path="payments" element={<Payments />} />
            <Route path="staff" element={<Staff />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster />
    </Boundary>
  );
}
