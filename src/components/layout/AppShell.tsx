import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { CalendarCheck, CarFront, CreditCard, Inbox, LayoutDashboard, LogOut, Menu, ScrollText, Settings, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import clsx from 'clsx';
import { APP_NAME } from '@/lib/env';
import { useAuthStore } from '@/stores/authStore';
import { LoadingBlock } from '@/components/ui/Feedback';

type NavItem = { to: string; label: string; icon: typeof Menu; match?: (path: string) => boolean };
type NavGroup = { label: string; items: NavItem[] };

/**
 * Core-mode navigation only. Content, support/chat, leads and notification-delivery
 * management are not mounted in production core mode, so they have no entry here.
 */
const NAV: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/' },
      { to: '/bookings', label: 'Bookings', icon: CalendarCheck, match: (p) => p.startsWith('/bookings') && !p.startsWith('/bookings/change-requests') },
      { to: '/bookings/change-requests', label: 'Change requests', icon: Inbox },
      { to: '/drivers', label: 'Drivers', icon: UserRound },
    ],
  },
  {
    label: 'Fleet and customers',
    items: [
      { to: '/fleet', label: 'Fleet', icon: CarFront },
      { to: '/customers', label: 'Customers', icon: Users },
    ],
  },
  { label: 'Finance', items: [{ to: '/payments', label: 'Payments', icon: CreditCard }] },
  {
    label: 'Administration',
    items: [
      { to: '/staff', label: 'Staff', icon: ShieldCheck },
      { to: '/audit-log', label: 'Audit log', icon: ScrollText },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10" aria-hidden>
        <div className="lane-dash h-5 w-[3px]" />
      </div>
      <span className="text-[15px] font-semibold leading-tight text-white">{APP_NAME}</span>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuthStore();
  return (
    <div className="flex h-full flex-col bg-road text-white/75">
      <Brand />
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Main">
        {NAV.map((g) => (
          <div key={g.label}>
            <p className="mb-1 px-3 text-xs font-medium text-white/45">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = item.match ? item.match(pathname) : pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <li key={item.to}>
                    <NavLink to={item.to} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                      className={clsx('relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors', active ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-white')}>
                      {active && <span className="lane-dash absolute inset-y-1.5 left-0 w-[3px]" aria-hidden />}
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
          <p className="truncate text-xs text-white/55">{user?.role}</p>
        </div>
        <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block"><Sidebar /></aside>

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white px-4 py-2.5 lg:hidden">
        <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="rounded p-1.5 hover:bg-black/5"><Menu className="h-5 w-5" /></button>
        <span className="text-sm font-semibold">{APP_NAME}</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-road-700/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 shadow-pop">
            <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-2 top-3 z-10 rounded p-1.5 text-white/70 hover:bg-white/10"><X className="h-5 w-5" /></button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-8">
        <Suspense fallback={<LoadingBlock />}><Outlet /></Suspense>
      </main>
    </div>
  );
}
