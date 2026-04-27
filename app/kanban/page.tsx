import { createClient } from '@/lib/supabase/server';
import { KanbanBoard } from '@/components/KanbanBoard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function KanbanPage() {
  const supabase = createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoStart = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: wos } = await supabase
    .from('work_orders')
    .select(`
      *,
      asset:assets(tag, description, fleet:fleets(name, code)),
      failure_events(symptom, system:systems(name), subsystem:subsystems(name)),
      maintenance_actions(description, performed_by),
      photos(id)
    `)
    .gte('opened_at', isoStart)
    .order('opened_at', { ascending: false });

  return (
    <>
      <h2 className="text-xl font-bold mb-1">Kanban de Atividades</h2>
      <p className="text-xs text-slate-500 mb-4">
        Cards atualizados em tempo real conforme os tecnicos registram no app.
      </p>
      <KanbanBoard initialWOs={wos || []} />
    </>
  );
}
