'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Camera, Undo2, AlertTriangle, X, CheckCircle2, Clock, PackageX, AlertCircle, Save, Loader2 } from 'lucide-react';
import type { WoStatus } from '@/lib/types';

type WO = any;

type Props = { initialWOs: WO[] };

export function KanbanBoard({ initialWOs }: Props) {
  const [wos, setWos] = useState<WO[]>(initialWOs);
  const [editing, setEditing] = useState<WO | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('kanban-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, async () => {
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
      <div className="text-xs text-slate-500 mb-3">
        Clique em um card para alterar o status, adicionar nota de continuidade ou registrar fechamento.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Column title="Pendente" subtitle="vindos de turnos anteriores" color="blue" items={grouped.PENDENTE} onClick={setEditing} />
        <Column title="Em Execucao" color="amber" items={grouped.EM_EXECUCAO} onClick={setEditing} />
        <Column title="Concluido" subtitle="neste turno" color="indigo" items={grouped.CONCLUIDO} onClick={setEditing} />
      </div>

      <div className="mt-6">
        <h3 className="font-bold text-orange-900 flex items-center gap-2 mb-2">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          Aguardando Peca{' '}
          <span className="text-xs font-normal text-slate-500">
            (fora do fluxo produtivo - status separado)
          </span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {grouped.AGUARDANDO_PECA.length === 0 ? (
            <div className="text-xs text-slate-400 italic p-2 col-span-2">
              Nenhum equipamento aguardando peca.
            </div>
          ) : (
            grouped.AGUARDANDO_PECA.map((wo) => <Card key={wo.id} wo={wo} onClick={setEditing} />)
          )}
        </div>
      </div>

      {editing && <StatusEditor wo={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Column({
  title, subtitle, color, items, onClick,
}: {
  title: string;
  subtitle?: string;
  color: 'blue' | 'amber' | 'indigo';
  items: WO[];
  onClick: (w: WO) => void;
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
          items.map((wo) => <Card key={wo.id} wo={wo} onClick={onClick} />)
        )}
      </div>
    </div>
  );
}

function Card({ wo, onClick }: { wo: WO; onClick: (w: WO) => void }) {
  const fe = wo.failure_events?.[0];
  const ma = wo.maintenance_actions?.[0];
  const executantes = (ma?.performed_by || []).slice(0, 2);
  const extra = (ma?.performed_by?.length || 0) > 2 ? '...' : '';
  const photos = wo.photos?.length || 0;

  const horaInicio = new Date(wo.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const horaFim = wo.closed_at ? new Date(wo.closed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const timeInfo = horaFim ? `${horaInicio} -> ${horaFim}` : `iniciada ${horaInicio}`;

  return (
    <button
      onClick={() => onClick(wo)}
      className="w-full text-left bg-white rounded border border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-orange-300 transition-all"
    >
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
    </button>
  );
}

// =============================================================================
// Editor de status (modal que abre ao clicar no card)
// =============================================================================
const STATUS_OPTIONS: { value: WoStatus; label: string; Icon: any; color: string }[] = [
  { value: 'PENDENTE',        label: 'Pendente',        Icon: AlertCircle, color: 'bg-blue-50 border-blue-300 text-blue-900' },
  { value: 'EM_EXECUCAO',     label: 'Em Execucao',     Icon: Clock,       color: 'bg-amber-50 border-amber-300 text-amber-900' },
  { value: 'AGUARDANDO_PECA', label: 'Aguardando Peca', Icon: PackageX,    color: 'bg-orange-50 border-orange-300 text-orange-900' },
  { value: 'CONCLUIDO',       label: 'Concluido',       Icon: CheckCircle2, color: 'bg-indigo-50 border-indigo-300 text-indigo-900' },
];

function StatusEditor({ wo, onClose }: { wo: WO; onClose: () => void }) {
  const [status, setStatus] = useState<WoStatus>(wo.status);
  const [carryNote, setCarryNote] = useState<string>(wo.carry_note || '');
  const [extraDesc, setExtraDesc] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const update: any = {
        status,
        carry_note: carryNote || null,
      };
      // Se mudou pra CONCLUIDO e ainda nao tinha closed_at, marca agora
      if (status === 'CONCLUIDO' && !wo.closed_at) {
        update.closed_at = new Date().toISOString();
      }
      // Se voltou pra outro status, limpa closed_at (caso reabra OM)
      if (status !== 'CONCLUIDO' && wo.closed_at) {
        update.closed_at = null;
      }
      const { error } = await supabase.from('work_orders').update(update).eq('id', wo.id);
      if (error) throw error;

      // Anexa nota adicional como nova maintenance_action (audit trail)
      if (extraDesc.trim()) {
        await supabase.from('maintenance_actions').insert({
          work_order_id: wo.id,
          description: `[atualizacao de status -> ${status}] ${extraDesc.trim()}`,
        });
      }
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bg-slate-900 text-white p-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{wo.asset?.tag}</span>
              <span className="text-xs text-slate-400 font-mono">OM {wo.om_number}</span>
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              {wo.failure_events?.[0]?.system?.name} / {wo.failure_events?.[0]?.subsystem?.name}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1">
            <X size={20} />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Mudar status para:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const Icon = opt.Icon;
                const isActive = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`flex items-center gap-2 p-2.5 border-2 rounded text-sm font-medium ${
                      isActive ? opt.color + ' ring-2 ring-offset-1 ring-slate-400' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nota de continuidade (opcional)
            </label>
            <textarea
              rows={2}
              value={carryNote}
              onChange={(e) => setCarryNote(e.target.value)}
              placeholder="Ex: Aguardando chegada de cilindro - pego pelo proximo turno"
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">
              Aparece destacada no card quando a OM atravessa turnos.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Comentario adicional (opcional)
            </label>
            <textarea
              rows={2}
              value={extraDesc}
              onChange={(e) => setExtraDesc(e.target.value)}
              placeholder="Ex: Iniciando a desmontagem do conjunto X"
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">
              Vira historico anexado a OM - util pra rastreabilidade.
            </p>
          </div>

          {err && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-2 rounded">
              {err}
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-slate-200 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 px-3 py-2 bg-orange-600 text-white rounded text-sm font-semibold disabled:bg-slate-400 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            Salvar
          </button>
        </footer>
      </div>
    </div>
  );
}
