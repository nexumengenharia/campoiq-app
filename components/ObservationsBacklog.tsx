'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, Clock, AlertOctagon } from 'lucide-react';
import {
  OBSERVATION_TYPE_LABEL,
  OBSERVATION_TARGET_LABEL,
  OBSERVATION_PRIORITY_LABEL,
  OBSERVATION_PRIORITY_CLASS,
} from '@/lib/constants';
import type { ObservationTarget, ObservationPriority } from '@/lib/types';

const TARGETS: (ObservationTarget | 'TODOS')[] = [
  'TODOS', 'PCM', 'INSPECAO', 'ENGENHARIA', 'MANUTENCAO', 'OPERACAO', 'SUPRIMENTOS',
];

export function ObservationsBacklog({ observations: initial }: { observations: any[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<ObservationTarget | 'TODOS'>('TODOS');

  const filtered = useMemo(
    () => (filter === 'TODOS' ? items : items.filter((o) => o.target === filter)),
    [filter, items]
  );

  const stats = useMemo(() => {
    const s: Record<string, number> = { TODOS: items.length };
    TARGETS.filter((t) => t !== 'TODOS').forEach((t) => {
      s[t] = items.filter((o) => o.target === t).length;
    });
    return s;
  }, [items]);

  async function resolve(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('observations')
      .update({ status: 'RESOLVIDA', resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setItems((prev) => prev.filter((o) => o.id !== id));
    } else {
      alert('Erro ao resolver: ' + error.message);
    }
  }

  const priorityOrder: Record<ObservationPriority, number> = {
    CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3,
  };

  const sorted = [...filtered].sort(
    (a, b) => priorityOrder[a.priority as ObservationPriority] - priorityOrder[b.priority as ObservationPriority]
  );

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {TARGETS.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 text-xs rounded-full border ${
              filter === t
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            {t === 'TODOS' ? 'Todos' : OBSERVATION_TARGET_LABEL[t as ObservationTarget]}
            <span className="ml-1.5 opacity-70">({stats[t] || 0})</span>
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-500">
          <CheckCircle2 className="mx-auto mb-2 text-green-500" size={32} />
          Nenhuma observacao aberta{filter !== 'TODOS' ? ` para ${OBSERVATION_TARGET_LABEL[filter as ObservationTarget]}` : ''}.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((obs) => {
            const overdue = obs.suggested_deadline && new Date(obs.suggested_deadline) < new Date();
            return (
              <div
                key={obs.id}
                className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-base">{obs.asset?.tag}</span>
                      <span className="text-xs text-slate-500">{obs.asset?.description}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${OBSERVATION_PRIORITY_CLASS[obs.priority as ObservationPriority]}`}>
                        {OBSERVATION_PRIORITY_LABEL[obs.priority as ObservationPriority]}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {OBSERVATION_TYPE_LABEL[obs.type as keyof typeof OBSERVATION_TYPE_LABEL]}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">
                        -&gt; {OBSERVATION_TARGET_LABEL[obs.target as ObservationTarget]}
                      </span>
                      {overdue && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-800 font-semibold inline-flex items-center gap-1">
                          <AlertOctagon size={10} /> ATRASADA
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{obs.description}</p>
                    <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                      {obs.created_by && <span>Registrado por: <strong>{obs.created_by}</strong></span>}
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(obs.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      {obs.suggested_deadline && (
                        <span className={overdue ? 'text-red-700 font-semibold' : ''}>
                          Prazo: {new Date(obs.suggested_deadline).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => resolve(obs.id)}
                    className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded whitespace-nowrap inline-flex items-center gap-1"
                  >
                    <CheckCircle2 size={14} /> Resolver
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
