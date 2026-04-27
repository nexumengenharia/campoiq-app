import { createClient } from '@/lib/supabase/server';
import { ShiftReport } from '@/components/ShiftReport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RelatorioPage({
  searchParams,
}: { searchParams: { shift?: string; date?: string } }) {
  const supabase = createClient();

  const shift = (searchParams.shift || currentShift()) as 'A' | 'B' | 'C';
  const date = searchParams.date || new Date().toISOString().slice(0, 10);

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 36 * 60 * 60 * 1000);

  const { data: shiftWOs } = await supabase
    .from('work_orders')
    .select(`
      *,
      asset:assets(tag, description),
      failure_events(*, system:systems(name), subsystem:subsystems(name)),
      maintenance_actions(description, performed_by),
      observations(*),
      photos(id, storage_path),
      parts_used(part_name, quantity, unit)
    `)
    .eq('shift', shift)
    .gte('opened_at', startOfDay.toISOString())
    .lt('opened_at', endOfDay.toISOString())
    .order('opened_at');

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
      activities={shiftWOs || []}
      pending={pendingNext || []}
    />
  );
}

function currentShift(): 'A' | 'B' | 'C' {
  const h = new Date().getHours();
  if (h >= 7 && h < 15) return 'A';
  if (h >= 15 && h < 23) return 'B';
  return 'C';
}
