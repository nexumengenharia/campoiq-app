'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Camera, Undo2, AlertTriangle } from 'lucide-react';

type WO = any;

type Props = { initialWOs: WO[] };

export function KanbanBoard({ initialWOs }: Props) {
  const [wos, setWos] = useState<WO[]>(initialWOs);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('kanban-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, async () => {
        // Recarrega a lista inteira quando qualquer WO muda (simples e efetivo)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isoStart = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
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
        if (data) setWos(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const grouped = useMemo(() => {
    return {
      PENDENTE:        wos.filter((w) => w.status === 'PENDENTE'),
      EM_EXECUCAO:     wos.filter((w) => w.status === 'EM_EXECUCAO'),
      CONCLUIDO:       wos.filter((w) => w.status === 'CONCLUIDO'),
      AGUARDANDO_PECA: wos.filter((w) => w.status === 'AGUARDANDO_PECA'),
    };
  }, [wos]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Column
          title="Pendente"
          subtitle="vindos de turnos anteriores"
          color="blue"
          items={grouped.PENDENTE}
        />
        <Column
          title="Em Execucao"
          color="amber"
          items={grouped.EM_EXECUCAO}
        />
        <Column
          title="Concluido"
          subtitle="neste turno"
          color="indigo"
          items={grouped.CONCLUIDO}
        />
      </div>

      <div className="mt-6">
        <h3 className="font-bold text-orange-900 flex items-center gap-2 mb-2">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          Aguardando Peca{' '}
          <span className="text-xs font-normal text-slate-500">
            (fora do fluxo produtivo — status separado)
          </span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {grouped.AGUARDANDO_PECA.length === 0 ? (
            <div className="text-xs text-slate-400 italic p-2 col-span-2">
              Nenhum equipamento aguardando peca.
            </div>
          ) : (
            grouped.AGUARDANDO_PECA.map((wo) => <Card key={wo.id} wo={wo} />)
          )}
        </div>
      </div>
    </>
  );
}

function Column({
  title,
  subtitle,
  color,
  items,
}: {
  title: string;
  subtitle?: string;
  color: 'blue' | 'amber' | 'indigo';
  items: WO[];
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    amber: 'bg-amber-50 border-amber-200',
    indigo: 'bg-indigo-50 border-indigo-200',
  }[color];

  const dot = { blue: 'bg-blue-500', amber: 'bg-amber-500', indigo: 'bg-indigo-500' }[color];
  const text = { blue: 'text-blue-900', amber: 'text-amber-900', indigo: 'text-indigo-900' }[color];
  const pill = { blue: 'bg-blue-200 text-blue-900', amber: 'bg-amber-200 text-amber-900', indigo: 'bg-indigo-200 text-indigo-900' }[color];

  return (
    <div className={`border-2 rounded-lg p-3 min-h-[400px] ${colorClasses}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-bold flex items-center gap-2 ${text}`}>
          <span className={`w-3 h-3 rounded-full ${dot}`} />
          {title}
          {subtitle && <span className="text-xs font-normal">({subtitle})</span>}
        </h3>
        <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${pill}`}>{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-xs text-slate-400 italic p-2">Sem atividades.</div>
        ) : (
          items.map((wo) => <Card key={wo.id} wo={wo} />)
        )}
      </div>
    </div>
  );
}

function Card({ wo }: { wo: WO }) {
  const fe = wo.failure_events?.[0];
  const ma = wo.maintenance_actions?.[0];
  const executantes = (ma?.performed_by || []).slice(0, 2);
  const extra = (ma?.performed_by?.length || 0) > 2 ? '...' : '';
  const photos = wo.photos?.length || 0;

  const horaInicio = new Date(wo.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const horaFim = wo.closed_at ? new Date(wo.closed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const timeInfo = horaFim ? `${horaInicio} -> ${horaFim}` : `iniciada ${horaInicio}`;

  return (
    <div className="bg-white rounded border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-base">{wo.asset?.tag}</span>
        <div className="flex items-center gap-1">
          {wo.carried_from_shift && (
            <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-0.5">
              <Undo2 size={10} /> Turno {wo.carried_from_shift}
            </span>
          )}
          {wo.status === 'AGUARDANDO_PECA' && (
            <span className="text-[10px] bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-0.5">
              <AlertTriangle size={10} /> AGUARDANDO PECA
            </span>
          )}
        </div>
      </div>
      <div className="text-xs text-slate-500 mb-2">OM {wo.om_number} - {timeInfo}</div>
      {fe && (
        <div className="text-xs mb-2">
          <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded mr-1">{fe.system?.name}</span>
          <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded">{fe.subsystem?.name}</span>
        </div>
      )}
      {ma?.description && <div className="text-sm text-slate-700 mb-2 line-clamp-2">{ma.description}</div>}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span>{executantes.join(', ')}{extra}</span>
        {photos > 0 && (
          <span className="inline-flex items-center gap-1">
            <Camera size={12} /> {photos}
          </span>
        )}
      </div>
    </div>
  );
}
