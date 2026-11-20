import { useEffect, useState } from 'react';
import { FileDown, RefreshCw } from 'lucide-react';
import { dashboardApi } from '@/api/dashboard';
import { fmtDateTime, fmtMoney, dayStartUtc, nextDayUtc } from '@/lib/format';
import { titleCase } from '@/lib/helpers';
import { PAYMENT_PROVIDERS } from '@/types/payments';
import { useDashboardStore } from '@/stores/dashboardStore';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Form';
import { ErrorNotice, ErrorState, LoadingBlock, Notice } from '@/components/ui/Feedback';
import { ExportDialog, FilterBar, PageHeader, Panel } from '@/components/ui/Common';
import { KeyValueList } from '@/components/ui/Data';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export default function Dashboard() {
  const { filters, data, loading, error, load, setFilters } = useDashboardStore();
  const [report, setReport] = useState<'cancellations' | 'utilization' | null>(null);
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rev = data?.revenue;
  const currencyFilter = filters.currency.trim().toUpperCase();
  const currencyRows = rev ? Object.entries(rev.by_currency ?? {}) : [];
  const providerRows = rev ? Object.entries(rev.by_provider ?? {}) : [];

  return (
    <>
      <PageHeader title="Dashboard" description="A snapshot of bookings, revenue and fleet for the period you choose."
        actions={
          <>
            <Button icon={<FileDown className="h-4 w-4" />} onClick={() => setReport('cancellations')}>Cancellations report</Button>
            <Button icon={<FileDown className="h-4 w-4" />} onClick={() => setReport('utilization')}>Fleet utilization report</Button>
          </>
        } />

      <FilterBar>
        <Field label="From"><Input type="date" value={filters.from} max={filters.to} onChange={(e) => setFilters({ from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={filters.to} min={filters.from} onChange={(e) => setFilters({ to: e.target.value })} /></Field>
        <Field label="Currency" hint="Revenue only"><Input className="w-24 uppercase" maxLength={3} placeholder="All" value={filters.currency} onChange={(e) => setFilters({ currency: e.target.value })} /></Field>
        <Field label="Provider" hint="Revenue only">
          <Select value={filters.provider} onChange={(e) => setFilters({ provider: e.target.value })}>
            <option value="">All providers</option>
            {PAYMENT_PROVIDERS.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
          </Select>
        </Field>
        <Button variant="primary" loading={loading} icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Apply</Button>
      </FilterBar>

      {error && !data && <ErrorState error={error} onRetry={() => void load()} />}
      {error && data && <ErrorNotice error={error} className="mb-4" />}
      {!data && !error && <LoadingBlock />}

      {data && (
        <div className={loading ? 'space-y-5 opacity-60 transition-opacity' : 'space-y-5'}>
          {data.period && (
            <p className="text-[13px] text-ink-muted">
              {fmtDateTime(data.period.from, true)} to {fmtDateTime(data.period.to, true)}. Bookings are counted by creation time; revenue by payment creation time.
            </p>
          )}

          {rev && (
            <Panel title="Revenue" description="Payment records created in the period. Amounts are shown in each payment’s own currency.">
              <dl className="mb-5 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
                <Stat label="Payments" value={rev.payment_count.toLocaleString()} />
                <Stat label="Successful" value={rev.successful_payment_count.toLocaleString()} />
                {currencyFilter.length === 3 && (
                  <>
                    <Stat label={`Gross (${currencyFilter})`} value={fmtMoney(rev.gross_amount_minor, currencyFilter)} />
                    <Stat label="Refunded" value={fmtMoney(rev.refunded_amount_minor, currencyFilter)} />
                    <Stat label="Net" value={fmtMoney(rev.net_amount_minor, currencyFilter)} />
                  </>
                )}
              </dl>
              {currencyFilter.length !== 3 && <Notice tone="info" className="mb-4">Totals are split by currency below. Filter by one currency to see combined gross, refunded and net figures.</Notice>}

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-[13px] font-semibold">By currency</h3>
                  {currencyRows.length === 0 ? <p className="text-sm text-ink-faint">No payments in this period.</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm tabular-nums">
                        <thead><tr className="border-b border-line text-left text-[13px] text-ink-muted"><th className="py-1.5 pr-3 font-medium">Currency</th><th className="px-3 text-right font-medium">Payments</th><th className="px-3 text-right font-medium">Gross</th><th className="px-3 text-right font-medium">Refunded</th><th className="pl-3 text-right font-medium">Net</th></tr></thead>
                        <tbody>
                          {currencyRows.map(([cur, r]) => (
                            <tr key={cur} className="border-b border-line/60 last:border-0">
                              <td className="py-2 pr-3 font-medium">{cur}</td>
                              <td className="px-3 text-right">{r.payment_count.toLocaleString()}</td>
                              <td className="px-3 text-right">{fmtMoney(r.gross_amount_minor, cur)}</td>
                              <td className="px-3 text-right">{fmtMoney(r.refunded_amount_minor, cur)}</td>
                              <td className="pl-3 text-right font-medium">{fmtMoney(r.net_amount_minor, cur)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-[13px] font-semibold">By provider</h3>
                  {providerRows.length === 0 ? <p className="text-sm text-ink-faint">No payments in this period.</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm tabular-nums">
                        <thead><tr className="border-b border-line text-left text-[13px] text-ink-muted"><th className="py-1.5 pr-3 font-medium">Provider</th><th className="px-3 text-right font-medium">Payments</th>{currencyFilter.length === 3 && <><th className="px-3 text-right font-medium">Gross</th><th className="pl-3 text-right font-medium">Net</th></>}</tr></thead>
                        <tbody>
                          {providerRows.map(([p, r]) => (
                            <tr key={p} className="border-b border-line/60 last:border-0">
                              <td className="py-2 pr-3 font-medium">{titleCase(p)}</td>
                              <td className="px-3 text-right">{r.payment_count.toLocaleString()}</td>
                              {currencyFilter.length === 3 && <><td className="px-3 text-right">{fmtMoney(r.gross_amount_minor, currencyFilter)}</td><td className="pl-3 text-right font-medium">{fmtMoney(r.net_amount_minor, currencyFilter)}</td></>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {currencyFilter.length !== 3 && providerRows.length > 0 && <p className="mt-2 text-xs text-ink-muted">Provider amounts can span currencies, so they appear once you filter by currency.</p>}
                </div>
              </div>
            </Panel>
          )}

          <div className="grid gap-5 lg:grid-cols-3">
            {data.bookings && <Panel title="Bookings"><KeyValueList data={data.bookings} /></Panel>}
            {data.fleet && <Panel title="Fleet"><KeyValueList data={data.fleet} /></Panel>}
            {data.review_queues && <Panel title="Waiting for review"><KeyValueList data={data.review_queues} /></Panel>}
          </div>

          {data.definitions && Object.keys(data.definitions).length > 0 && (
            <details className="rounded-panel border border-line bg-white px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium">How these figures are defined</summary>
              <dl className="mt-3 space-y-2">
                {Object.entries(data.definitions).map(([k, v]) => (
                  <div key={k}><dt className="font-medium">{titleCase(k)}</dt><dd className="text-ink-muted">{v}</dd></div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-ink-muted">The dashboard is a summary, not a ledger. Use the payment views for reconciliation.</p>
            </details>
          )}
        </div>
      )}

      <ExportDialog open={report === 'cancellations'} onClose={() => setReport(null)} title="Cancellations report" maxDays={366}
        description="Booking cancellation events as CSV. Customer contact details are left out."
        onExport={({ from, to }) => dashboardApi.cancellationsCsv({ from: dayStartUtc(from), to: nextDayUtc(to) })} />
      <ExportDialog open={report === 'utilization'} onClose={() => setReport(null)} title="Fleet utilization report" maxDays={366}
        description="Booked hours against available hours for each active car, as CSV."
        onExport={({ from, to }) => dashboardApi.fleetUtilizationCsv({ from: dayStartUtc(from), to: nextDayUtc(to) })} />
    </>
  );
}
