import { createClient } from '@/lib/supabase/server';
import { KanbanBoard } from '@/components/KanbanBoard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function KanbanPage() {
  const supabase = createClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: wos } = await supabase
    .from('work_orders')
    .select(`
      *,
      asset:assets(tag, description, fleet:fleets(name, code)),
      failure_events(symptom, system:systems(name), subsystem:subsystems(name)),
      maintenance_actions(description, performed_by),
      photos(id)
    `)
    // Bug 6: 7 dias de janela + sempre inclui ativos pendentes/em andamento independente da data
    .or(`opened_at.gte.${sevenDaysAgo},status.in.(PENDENTE,EM_EXECUCAO,AGUARDANDO_PECA)`)
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
