import { createClient } from '@/lib/supabase/server';
import { FleetMap } from '@/components/FleetMap';
import type { Asset, Fleet, WorkOrder } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MapaPage() {
  const supabase = createClient();

  const { data: assets } = await supabase
    .from('assets')
    .select('*, fleet:fleets(*)')
    .eq('active', true)
    .order('tag');

  const { data: activeWOs } = await supabase
    .from('work_orders')
    .select('id, asset_id, status, om_number')
    .in('status', ['PENDENTE', 'EM_EXECUCAO', 'AGUARDANDO_PECA']);

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Frota — Status Operacional em Tempo Real</h2>
      <p className="text-xs text-slate-500 mb-4">Clique em um equipamento para ver o historico de corretivas dos ultimos 60 dias.</p>

      <FleetMap
        assets={(assets || []) as (Asset & { fleet: Fleet })[]}
        activeWOs={(activeWOs || []) as Pick<WorkOrder, 'id' | 'asset_id' | 'status' | 'om_number'>[]}
      />
    </>
  );
}
