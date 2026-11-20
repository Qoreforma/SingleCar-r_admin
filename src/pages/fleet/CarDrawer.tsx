import { useState } from 'react';
import { Ban, Pencil } from 'lucide-react';
import { fleetApi } from '@/api/fleet';
import { toPaged } from '@/api/pagination';
import { extractList, getId, getVersion } from '@/lib/helpers';
import type { Rec } from '@/types/common';
import { useAsync } from '@/hooks/useAsync';
import { useFleetStore } from '@/stores/fleetStore';
import { Button } from '@/components/ui/Button';
import { Badge, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { ConfirmDialog, Drawer } from '@/components/ui/Overlay';
import { Tabs } from '@/components/ui/Common';
import { KeyValueList } from '@/components/ui/Data';
import { AutoTable } from '@/components/ui/AutoTable';
import { Pager } from '@/components/ui/Table';
import { AvailabilityTab } from './Availability';
import { carActive, carSubtitle, carTitle } from './carHelpers';

function PriceHistory({ carId }: { carId: string }) {
  const [page, setPage] = useState(1);
  const history = useAsync(async () => {
    const env = await fleetApi.priceHistory(carId, { page, limit: 10 });
    const paged = toPaged<Rec>(env, { page, limit: 10 });
    return paged.items.length ? paged : { ...paged, items: extractList(env.data) };
  }, [carId, page]);
  if (history.loading && !history.data) return <LoadingBlock />;
  if (history.error) return <ErrorState error={history.error} onRetry={() => void history.reload()} />;
  const d = history.data!;
  return (
    <div>
      <AutoTable rows={d.items} maxCols={7} />
      <Pager page={d.page} totalPages={d.totalPages} total={d.total} hasNext={d.hasNext} hasPrev={d.hasPrev} loading={history.loading} onPage={setPage} />
    </div>
  );
}

export function CarDrawer({ car, onClose, onEdit }: { car: Rec | null; onClose: () => void; onEdit: (car: Rec) => void }) {
  const [tab, setTab] = useState<'details' | 'pricing' | 'availability'>('details');
  const [deactivating, setDeactivating] = useState(false);
  const deactivate = useFleetStore((s) => s.deactivate);
  const id = car ? getId(car) : '';

  return (
    <>
      <Drawer open={!!car} onClose={onClose} wide title={car ? carTitle(car) : ''}
        description={car && <span className="inline-flex items-center gap-2">{carSubtitle(car)} <Badge tone={carActive(car) ? 'success' : 'neutral'}>{carActive(car) ? 'Active' : 'Inactive'}</Badge></span>}
        actions={car && <>
          <Button size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEdit(car)}>Edit</Button>
          {carActive(car) && <Button size="sm" variant="danger" icon={<Ban className="h-3.5 w-3.5" />} onClick={() => setDeactivating(true)}>Deactivate</Button>}
        </>}>
        {car && (
          <>
            <Tabs value={tab} onChange={setTab} tabs={[{ id: 'details', label: 'Details' }, { id: 'pricing', label: 'Price history' }, { id: 'availability', label: 'Availability' }]} />
            {tab === 'details' && <KeyValueList data={car} />}
            {tab === 'pricing' && <PriceHistory carId={id} />}
            {tab === 'availability' && <AvailabilityTab carId={id} />}
          </>
        )}
      </Drawer>
      <ConfirmDialog open={deactivating} onClose={() => setDeactivating(false)} tone="danger" confirmLabel="Deactivate vehicle"
        title={`Deactivate ${car ? carTitle(car) : 'vehicle'}?`}
        description="Customers will stop seeing this car. If live bookings depend on it, the server refuses and the reason appears here."
        onConfirm={async () => { await deactivate(id, getVersion(car)); onClose(); }} />
    </>
  );
}
