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
      <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mb-6 text-sm text-blue-900">
        <strong>Integracao externa:</strong> os dados capturados aqui serao cruzados com o sistema de tempos
        de parada/liberacao para compor o <strong>perfil de perdas</strong> — com tendencias, padroes de falha
        e relatorios de "bad actors" alimentados automaticamente por este app.
      </div>

      <h2 className="text-xl font-bold mb-4">Frota — Status Operacional em Tempo Real</h2>

      <FleetMap
        assets={(assets || []) as (Asset & { fleet: Fleet })[]}
        activeWOs={(activeWOs || []) as Pick<WorkOrder, 'id' | 'asset_id' | 'status' | 'om_number'>[]}
      />
    </>
  );
}
