'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Printer, Send, Camera, Undo2 } from 'lucide-react';
import {
  STATUS_CLASS, STATUS_LABEL,
  OBSERVATION_PRIORITY_CLASS, OBSERVATION_PRIORITY_LABEL,
  OBSERVATION_TARGET_LABEL, OBSERVATION_TYPE_LABEL,
  SHIFTS, SHIFT_LABEL, MAINT_TYPE_LABEL, MAINT_TYPE_CLASS,
} from '@/lib/constants';
import type { Shift, MaintenanceType } from '@/lib/types';

type Props = {
  shift: Shift;
  date: string;
  maintenanceTypeFilter?: '' | MaintenanceType;
  activities: any[];
  pending: any[];
};

export function ShiftReport({ shift, date, activities, pending, maintenanceTypeFilter = '' }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const concluidas = activities.filter((a) => a.status === 'CONCLUIDO');
  const emExec = activities.filter((a) => a.status === 'EM_EXECUCAO');
  const aguardando = activities.filter((a) => a.status === 'AGUARDANDO_PECA');
  const totalPhotos = activities.reduce((s, a) => s + (a.photos?.length || 0), 0);

  function changeShift(s: string) {
    const u = new URLSearchParams(params);
    u.set('shift', s);
    router.push(`/relatorio?${u.toString()}`);
  }

  function changeDate(d: string) {
    const u = new URLSearchParams(params);
    u.set('date', d);
    router.push(`/relatorio?${u.toString()}`);
  }

  function changeType(t: string) {
    const u = new URLSearchParams(params);
    if (t) u.set('type', t);
    else   u.delete('type');
    router.push(`/relatorio?${u.toString()}`);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 no-print">
        <div>
          <h2 className="text-xl font-bold">Relatorio de Passagem de Turno</h2>
          <p className="text-sm text-slate-500">
            Gerado a partir das atividades registradas no turno e data selecionados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <span className="font-semibold">Data:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => changeDate(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <span className="font-semibold">Turno:</span>
            <select
              value={shift}
              onChange={(e) => changeShift(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-sm"
            >
              {SHIFTS.map((s) => (
                <option key={s} value={s}>{SHIFT_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <span className="font-semibold">Tipo:</span>
            <select
              value={maintenanceTypeFilter}
              onChange={(e) => changeType(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-sm"
            >
              <option value="">Todos</option>
              <option value="CORRETIVA">Corretiva</option>
              <option value="PREVENTIVA">Preventiva</option>
            </select>
          </label>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 text-sm bg-slate-800 text-white rounded hover:bg-slate-900 inline-flex items-center gap-1"
          >
            <Printer size={14} /> Exportar PDF
          </button>
          <button
            onClick={() => alert('Em producao: envia via WhatsApp/e-mail para supervisao e proximo turno.')}
            className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 inline-flex items-center gap-1"
          >
            <Send size={14} /> Enviar
          </button>
        </div>
      </div>

      <article className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 print-area">
        <header className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Relatorio de Passagem de Turno</h1>
              <div className="text-sm text-slate-600">
                Turno {shift} - {new Date(date).toLocaleDateString('pt-BR')}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              Gerado automaticamente pelo CampoIQ<br />
              <span className="font-mono">#RPT-{shift}-{date.replace(/-/g, '')}</span>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-3 mb-6">
          <KPICard n={concluidas.length} label="Concluidas" color="indigo" />
          <KPICard n={emExec.length} label="Em execucao" color="amber" />
          <KPICard n={aguardando.length} label="Aguardando peca" color="orange" />
          <KPICard n={totalPhotos} label="Fotos capturadas" color="blue" />
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Atividades Executadas no Turno</h2>
          {activities.length === 0 ? (
            <div className="text-sm text-slate-500">Nenhuma atividade registrada neste turno.</div>
          ) : (
            activities.map((a) => {
              const fe = a.failure_events?.[0];
              const ma = a.maintenance_actions?.[0];
              return (
                <div key={a.id} className="border border-slate-200 rounded-lg p-4 mb-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base">{a.asset?.tag}</span>
                        <span className="text-xs text-slate-500">OM {a.om_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_CLASS[a.status as keyof typeof STATUS_CLASS]}`}>
                          {STATUS_LABEL[a.status as keyof typeof STATUS_LABEL]}
                        </span>
                        {a.maintenance_type && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${MAINT_TYPE_CLASS[a.maintenance_type as MaintenanceType] || ''}`}>
                            {MAINT_TYPE_LABEL[a.maintenance_type as MaintenanceType]}
                          </span>
                        )}
                        {a._origin === 'worked' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300 inline-flex items-center gap-1">
                            <Undo2 size={10} /> Aberta no turno {a.shift}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Abertura: {formatDateTime(a.opened_at)}
                        {a.closed_at ? ` -> Fechada: ${formatDateTime(a.closed_at)}` : ' (em andamento)'}
                      </div>
                    </div>
                    {a.photos?.length > 0 && (
                      <div className="flex gap-1">
                        {a.photos.slice(0, 4).map((p: any) => (
                          <div key={p.id} className="w-10 h-10 bg-slate-200 rounded border border-slate-300 flex items-center justify-center text-slate-400">
                            <Camera size={14} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {fe && (
                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                      <div><span className="text-slate-500">Sistema:</span> <strong>{fe.system?.name}</strong></div>
                      <div><span className="text-slate-500">Subsistema:</span> <strong>{fe.subsystem?.name}</strong></div>
                      <div><span className="text-slate-500">Intervencao:</span> <strong>{fe.intervention_type}</strong></div>
                      <div><span className="text-slate-500">Sintoma:</span> <strong>{fe.symptom}</strong></div>
                      <div><span className="text-slate-500">Causa:</span> <strong>{fe.presumed_cause}</strong></div>
                      <div><span className="text-slate-500">Pecas:</span> <strong>{
                        (a.parts_used || []).map((p: any) => `${p.part_name} x${p.quantity}`).join('; ') || '-'
                      }</strong></div>
                    </div>
                  )}

                  {ma?.description && <p className="text-sm text-slate-700 mb-2">{ma.description}</p>}

                  {a.observations?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <div className="text-xs font-semibold text-slate-600 mb-1">Observacoes / Pendencias Tecnicas:</div>
                      <div className="space-y-1">
                        {a.observations.map((o: any) => (
                          <div key={o.id} className="text-xs p-2 bg-amber-50 border-l-2 border-amber-400 rounded">
                            <div className="flex gap-2 mb-0.5 flex-wrap">
                              <span className="font-semibold text-amber-900">
                                {OBSERVATION_TYPE_LABEL[o.type as keyof typeof OBSERVATION_TYPE_LABEL]}
                              </span>
                              <span className="text-slate-500">-&gt; {OBSERVATION_TARGET_LABEL[o.target as keyof typeof OBSERVATION_TARGET_LABEL]}</span>
                              <span className={`px-1.5 rounded ${OBSERVATION_PRIORITY_CLASS[o.priority as keyof typeof OBSERVATION_PRIORITY_CLASS]}`}>
                                {OBSERVATION_PRIORITY_LABEL[o.priority as keyof typeof OBSERVATION_PRIORITY_LABEL]}
                              </span>
                              {o.suggested_deadline && (
                                <span className="text-slate-500">Prazo: {new Date(o.suggested_deadline).toLocaleDateString('pt-BR')}</span>
                              )}
                            </div>
                            <div className="text-slate-700">{o.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                    <strong>Executantes:</strong> {(ma?.performed_by || []).join(', ') || '-'}
                  </div>
                </div>
              );
            })
          )}
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Pendencias para o Proximo Turno</h2>
          {pending.length === 0 ? (
            <div className="text-sm text-green-700">Sem pendencias. Todos os equipamentos liberados.</div>
          ) : (
            <div className="space-y-2">
              {pending.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-start gap-3 p-3 bg-slate-50 border-l-4 rounded ${
                    a.status === 'AGUARDANDO_PECA' ? 'border-orange-500' :
                    a.status === 'EM_EXECUCAO' ? 'border-amber-500' : 'border-blue-500'
                  }`}
                >
                  <div className="flex-shrink-0 font-bold text-base">{a.asset?.tag}</div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">
                      {STATUS_LABEL[a.status as keyof typeof STATUS_LABEL]} -{' '}
                      {a.failure_events?.[0]?.system?.name} / {a.failure_events?.[0]?.subsystem?.name}
                    </div>
                    <div className="text-slate-600">{a.maintenance_actions?.[0]?.description}</div>
                    {a.carry_note && (
                      <div className="text-xs text-slate-500 italic mt-1">Nota: {a.carry_note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-slate-200 pt-4 grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="border-b border-slate-400 pb-8 mb-1" />
            <div className="font-semibold">Fred Jozair</div>
            <div className="text-slate-500">Gerente Tecnico da Frota</div>
          </div>
          <div>
            <div className="border-b border-slate-400 pb-8 mb-1" />
            <div className="font-semibold">Nilton Ribeiro</div>
            <div className="text-slate-500">Engenheiro da Frota</div>
          </div>
        </footer>
      </article>
    </>
  );
}

function KPICard({ n, label, color }: { n: number; label: string; color: string }) {
  const cls = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
  }[color] || '';
  return (
    <div className={`border rounded p-3 text-center ${cls}`}>
      <div className="text-2xl font-bold">{n}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}
