import { createClient } from '@/lib/supabase/server';
import { ObservationsBacklog } from '@/components/ObservationsBacklog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ObservacoesPage() {
  const supabase = createClient();

  const { data: observations } = await supabase
    .from('observations')
    .select(`
      *,
      asset:assets(tag, description, fleet:fleets(name))
    `)
    .in('status', ['ABERTA', 'EM_ANALISE'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  return (
    <>
      <h2 className="text-xl font-bold mb-1">Backlog de Observacoes / Pendencias Tecnicas</h2>
      <p className="text-sm text-slate-500 mb-4">
        Acoes geradas pelos mecanicos durante as intervencoes — filtre por destinatario para priorizar.
      </p>
      <ObservationsBacklog observations={observations || []} />
    </>
  );
}
