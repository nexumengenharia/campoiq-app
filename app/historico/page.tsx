import { createClient } from '@/lib/supabase/server';
import { HistoryExplorer } from '@/components/HistoryExplorer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HistoricoPage() {
  const supabase = createClient();

  const since = new Date();
  since.setDate(since.getDate() - 90);

  const [{ data: wos }, { data: assets }, { data: systems }] = await Promise.all([
    supabase
      .from('work_orders')
      .select(
        `id, om_number, status, shift, opened_at, closed_at, mttr_minutes,
         asset:assets(id, tag, fleet:fleets(name, code)),
         failure_events(symptom, presumed_cause, intervention_type, severity,
           system:systems(name), subsystem:subsystems(name)),
         maintenance_actions(description, performed_by),
         observations(type, target, priority, description)`
      )
      .gte('opened_at', since.toISOString())
      .order('opened_at', { ascending: false }),
    supabase.from('assets').select('id, tag, fleet:fleets(name)').eq('active', true).order('tag'),
    supabase.from('systems').select('id, name').order('sort_order'),
  ]);

  return (
    <>
      <h2 className="text-xl font-bold mb-1">Historico de Corretivas</h2>
      <p className="text-xs text-slate-500 mb-4">
        Ultimos 90 dias. Filtre por equipamento, sistema, severidade ou periodo.
      </p>
      <HistoryExplorer wos={(wos as any) || []} assets={(assets as any) || []} systems={(systems as any) || []} />
    </>
  );
}
