import { createClient } from '@/lib/supabase/server';
import { ActivityForm } from '@/components/ActivityForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NovaPage() {
  const supabase = createClient();

  const [assetsRes, systemsRes, subsystemsRes] = await Promise.all([
    supabase.from('assets').select('id, tag, description, fleet:fleets(code, name)').eq('active', true).order('tag'),
    supabase.from('systems').select('*').order('sort_order'),
    supabase.from('subsystems').select('*'),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-1">Registro de Atividade</h2>
      <p className="text-sm text-slate-500 mb-4">
        Preencha ao longo da execucao — sem esperar o fim do turno.
      </p>
      <ActivityForm
        assets={assetsRes.data || []}
        systems={systemsRes.data || []}
        subsystems={subsystemsRes.data || []}
      />
    </div>
  );
}
