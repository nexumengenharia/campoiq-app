import { createClient } from '@/lib/supabase/server';
import { ShiftReport } from '@/components/ShiftReport';
import { inferShift } from '@/lib/constants';
import type { Shift, MaintenanceType } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RelatorioPage({
  searchParams,
}: { searchParams: { shift?: string; date?: string; type?: string } }) {
  const supabase = createClient();

  const shift = (searchParams.shift || inferShift(new Date())) as Shift;
  const date = searchParams.date || new Date().toISOString().slice(0, 10);
  const maintenanceTypeFilter = (searchParams.type || '') as '' | MaintenanceType;

  const startOfDay = new Date(date + 'T00:00:00');
  const endOfDay = new Date(startOfDay.getTime() + 36 * 60 * 60 * 1000);

  // 1) OMs ABERTAS neste turno+data
  let qOpened = supabase
    .from('work_orders')
    .select(`
      *,
      asset:assets(tag, description),
      failure_events(*, system:systems(name), subsystem:subsystems(name)),
      maintenance_actions(description, performed_by, performed_at),
      observations(*),
      photos(id, storage_path),
      parts_used(part_name, quantity, unit)
    `)
    .eq('shift', shift)
    .gte('opened_at', startOfDay.toISOString())
    .lt('opened_at', endOfDay.toISOString());

  if (maintenanceTypeFilter) {
    qOpened = qOpened.eq('maintenance_type', maintenanceTypeFilter);
  }

  // 2) OMs TRABALHADAS neste turno+data (mesmo abertas em outro turno/dia)
  //    contains: array do banco contem todos os elementos passados
  let qWorked = supabase
    .from('work_orders')
    .select(`
      *,
      asset:assets(tag, description),
      failure_events(*, system:systems(name), subsystem:subsystems(name)),
      maintenance_actions(description, performed_by, performed_at),
      observations(*),
      photos(id, storage_path),
      parts_used(part_name, quantity, unit)
    `)
    .contains('worked_in_shifts', [shift])
    .contains('worked_in_dates', [date]);

  if (maintenanceTypeFilter) {
    qWorked = qWorked.eq('maintenance_type', maintenanceTypeFilter);
  }

  const [{ data: openedWOs }, { data: workedWOs }] = await Promise.all([qOpened, qWorked]);

  // Une os dois conjuntos sem duplicatas (por id)
  const map = new Map<string, any>();
  (openedWOs || []).forEach((w) => map.set(w.id, { ...w, _origin: 'opened' }));
  (workedWOs || []).forEach((w) => {
    if (map.has(w.id)) {
      map.set(w.id, { ...map.get(w.id), _origin: 'opened+worked' });
    } else {
      map.set(w.id, { ...w, _origin: 'worked' });
    }
  });
  const shiftWOs = Array.from(map.values()).sort(
    (a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
  );

  const { data: pendingNext } = await supabase
    .from('work_orders')
    .select(`
      *,
      asset:assets(tag),
      failure_events(system:systems(name), subsystem:subsystems(name)),
      maintenance_actions(description)
    `)
    .in('status', ['PENDENTE', 'EM_EXECUCAO', 'AGUARDANDO_PECA'])
    .order('opened_at');

  return (
    <ShiftReport
      shift={shift}
      date={date}
      maintenanceTypeFilter={maintenanceTypeFilter}
      activities={shiftWOs}
      pending={pendingNext || []}
    />
  );
}
