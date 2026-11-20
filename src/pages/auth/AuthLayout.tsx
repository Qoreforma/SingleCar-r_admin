import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/env';

export function AuthLayout({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-road text-white lg:block" aria-hidden>
        <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 lane-dash opacity-90" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />
        <div className="relative z-10 p-10">
          <p className="text-lg font-semibold">{APP_NAME}</p>
          <p className="mt-2 max-w-[16rem] text-sm text-white/60">Bookings, fleet, documents and payments for the whole company in one place.</p>
        </div>
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <p className="mb-6 text-sm font-semibold text-primary lg:hidden">{APP_NAME}</p>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-ink-muted">{description}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-sm text-ink-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
