import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { ApiError } from '@/api/errors';
import type { PagedState } from '@/stores/createPagedStore';
import { Button } from './Button';
import { EmptyState, ErrorState } from './Feedback';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  right?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  error?: ApiError | null;
  onRetry?: () => void;
  empty?: ReactNode;
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, error, onRetry, empty }: TableProps<T>) {
  if (error && rows.length === 0) return <ErrorState error={error} onRetry={onRetry} />;
  if (!loading && rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;

  return (
    <div className={clsx('overflow-x-auto transition-opacity', loading && rows.length > 0 && 'opacity-60')}>
      <table className="w-full min-w-[640px] border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b border-line text-left text-[13px] text-ink-muted">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={clsx('whitespace-nowrap px-4 py-2.5 font-medium', c.right && 'text-right', c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-line/70">
                  {columns.map((c) => <td key={c.key} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-black/5" /></td>)}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row); } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={clsx('border-b border-line/70 last:border-0', onRowClick && 'cursor-pointer hover:bg-primary-soft/50 focus-visible:bg-primary-soft/50')}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={clsx('px-4 py-2.5 align-middle', c.right && 'text-right', c.className)}>{c.cell(row)}</td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

interface PagerProps {
  page: number;
  totalPages: number | null;
  total: number | null;
  hasNext: boolean;
  hasPrev: boolean;
  loading?: boolean;
  onPage: (p: number) => void;
}

export function Pager({ page, totalPages, total, hasNext, hasPrev, loading, onPage }: PagerProps) {
  if (!hasNext && !hasPrev && (totalPages ?? 1) <= 1) {
    return total != null ? <div className="border-t border-line px-4 py-2.5 text-[13px] text-ink-muted">{total.toLocaleString()} {total === 1 ? 'result' : 'results'}</div> : null;
  }
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[13px] text-ink-muted">
      <span>
        Page {page}{totalPages ? ` of ${totalPages}` : ''}
        {total != null && <span className="ml-3">{total.toLocaleString()} results</span>}
      </span>
      <div className="flex gap-1.5">
        <Button size="sm" disabled={!hasPrev || loading} onClick={() => onPage(page - 1)} icon={<ChevronLeft className="h-4 w-4" />} aria-label="Previous page">Previous</Button>
        <Button size="sm" disabled={!hasNext || loading} onClick={() => onPage(page + 1)} aria-label="Next page">Next<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/** A store-backed table: rows, loading/error and paging all come from a pagedSlice. */
export function PagedTable<T, F>({ state, columns, rowKey, onRowClick, empty }: {
  state: PagedState<T, F>;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}) {
  return (
    <div className="rounded-panel border border-line bg-white">
      <DataTable
        columns={columns} rows={state.items} rowKey={rowKey} onRowClick={onRowClick}
        loading={state.loading || !state.loaded} error={state.error} onRetry={() => state.load()} empty={empty}
      />
      <Pager page={state.page} totalPages={state.totalPages} total={state.total} hasNext={state.hasNext} hasPrev={state.hasPrev} loading={state.loading} onPage={(p) => state.load(p)} />
    </div>
  );
}
