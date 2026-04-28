'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { STATUS_CLASS, STATUS_LABEL } from '@/lib/constants';
import type { Asset, Fleet } from '@/lib/types';
import { X, AlertCircle, CheckCircle2, Clock, PackageX, TrendingUp, Calendar } from 'lucide-react';

type Props = {
  asset: (Asset & { fleet?: Fleet }) | null;
  currentStatus: string;
  onClose: () => void;
};

type WO = {
  id: string;
  om_number: string;
  status: 'PENDENTE' | 'EM_EXECUCAO' | 'CONCLUIDO' | 'AGUARDANDO_PECA';
  shift: string | null;
  opened_at: string;
  closed_at: string | null;
  mttr_minutes: number | null;
  failure_events?: Array<{
    symptom: string;
    presumed_cause: string;
    intervention_type: string;
    severity: string | null;
    system?: { name: string };
    subsystem?: { name: string };
  }>;
  maintenance_actions?: Array<{
    description: string;
    performed_by: string[] | null;
  }>;
  observations?: Array<{
    type: string;
    target: string;
    priority: string;
    description: string;
  }>;
};

const STATUS_ICON: Record<string, any> = {
  CONCLUIDO: CheckCircle2,
  EM_EXECUCAO: Clock,
  PENDENTE: AlertCircle,
  AGUARDANDO_PECA: PackageX,
};

export function AssetHistoryModal({ asset, currentStatus, onClose }: Props) {
  const [wos, setWos] = useState<WO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!asset) return;
    setLoading(true);
    const supabase = createClient();
    const since = new Date();
    since.setDate(since.getDate() - 60);

    supabase
      .from('work_orders')
      .select(
        `id, om_number, status, shift, opened_at, closed_at, mttr_minutes,
         failure_events(symptom, presumed_cause, intervention_type, severity,
           system:systems(name), subsystem:subsystems(name)),
         maintenance_actions(description, performed_by),
         observations(type, target, priority, description)`
      )
      .eq('asset_id', asset.id)
      .gte('opened_at', since.toISOString())
      .order('opened_at', { ascending: false })
      .then(({ data }) => {
        setWos((data as any) || []);
        setLoading(false);
      });
  }, [asset]);

  if (!asset) return null;

  const concluidas = wos.filter((w) => w.status === 'CONCLUIDO');
  const totalDowntimeMin = concluidas.reduce((s, w) => s + (w.mttr_minutes || 0), 0);
  const avgMttrMin = concluidas.length > 0 ? Math.round(totalDowntimeMin / concluidas.length) : 0;

  // Falhas por sistema (Pareto rapido)
  const bySystem: Record<string, number> = {};
  wos.forEach((w) => {
    const sys = w.failure_events?.[0]?.system?.name || 'Outros';
    bySystem[sys] = (bySystem[sys] || 0) + 1;
  });
  const paretoSystems = Object.entries(bySystem).sort((a, b) => b[1] - a[1]);
  const maxCount = paretoSystems[0]?.[1] || 1;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header sticky */}
        <header className="bg-slate-900 text-white p-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-bold">{asset.tag}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded border ${
                  STATUS_CLASS[currentStatus as keyof typeof STATUS_CLASS] ||
                  'bg-green-50 text-green-900 border-green-300'
                }`}
              >
                {STATUS_LABEL[currentStatus as keyof typeof STATUS_LABEL] || 'Operando'}
              </span>
            </div>
            <div className="text-xs text-slate-300">{asset.description || asset.fleet?.name}</div>
            <div className="text-xs text-slate-400">
              Frota: {asset.fleet?.name || '-'} · Criticidade: {asset.criticality}/5
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1"
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Carregando historico...</div>
          ) : (
            <>
              {/* KPIs do periodo */}
              <section className="grid grid-cols-3 gap-2 p-4 bg-slate-50 border-b border-slate-200">
                <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                  <div className="text-2xl font-bold text-slate-900">{wos.length}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">OMs (60d)</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                  <div className="text-2xl font-bold text-slate-900">
                    {avgMttrMin > 0 ? `${avgMttrMin}min` : '-'}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">MTTR medio</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                  <div className="text-2xl font-bold text-slate-900">
                    {totalDowntimeMin > 0 ? `${(totalDowntimeMin / 60).toFixed(1)}h` : '-'}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">Downtime total</div>
                </div>
              </section>

              {/* Pareto de sistemas (mini) */}
              {paretoSystems.length > 0 && (
                <section className="p-4 border-b border-slate-200">
                  <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <TrendingUp size={12} /> Falhas por sistema (60 dias)
                  </h3>
                  <div className="space-y-1">
                    {paretoSystems.map(([sys, count]) => (
                      <div key={sys} className="flex items-center gap-2 text-xs">
                        <div className="w-32 truncate text-slate-600">{sys}</div>
                        <div className="flex-1 bg-slate-100 rounded h-4 relative">
                          <div
                            className="bg-orange-400 h-4 rounded"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                        <div className="w-6 text-right font-semibold">{count}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Timeline de OMs */}
              <section className="p-4">
                <h3 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1">
                  <Calendar size={12} /> Historico de corretivas (mais recentes primeiro)
                </h3>
                {wos.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">
                    Nenhuma corretiva registrada nos ultimos 60 dias para este equipamento.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wos.map((wo) => {
                      const fe = wo.failure_events?.[0];
                      const ma = wo.maintenance_actions?.[0];
                      const Icon = STATUS_ICON[wo.status] || Clock;
                      const isClosed = wo.status === 'CONCLUIDO';
                      return (
                        <div
                          key={wo.id}
                          className={`relative pl-6 pb-3 border-l-2 ${
                            isClosed ? 'border-emerald-300' : 'border-amber-300'
                          }`}
                        >
                          <div
                            className={`absolute left-[-7px] top-0 w-3 h-3 rounded-full ${
                              isClosed ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                            <div className="flex items-start justify-between mb-2 gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs text-slate-500">
                                    OM {wo.om_number}
                                  </span>
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${
                                      STATUS_CLASS[wo.status as keyof typeof STATUS_CLASS]
                                    }`}
                                  >
                                    <Icon size={10} />
                                    {STATUS_LABEL[wo.status as keyof typeof STATUS_LABEL]}
                                  </span>
                                  {wo.shift && (
                                    <span className="text-[10px] text-slate-500">
                                      Turno {wo.shift}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-700 font-medium mt-1">
                                  {fe?.system?.name} <span className="text-slate-400">/</span>{' '}
                                  {fe?.subsystem?.name}
                                </div>
                              </div>
                              <div className="text-right text-[10px] text-slate-500 flex-shrink-0">
                                <div>{formatDate(wo.opened_at)}</div>
                                {wo.mttr_minutes && (
                                  <div className="font-semibold text-slate-700">
                                    {wo.mttr_minutes < 60
                                      ? `${wo.mttr_minutes}min`
                                      : `${(wo.mttr_minutes / 60).toFixed(1)}h`}
                                  </div>
                                )}
                              </div>
                            </div>

                            {fe && (
                              <div className="text-xs text-slate-600 space-y-0.5 mb-1">
                                <div>
                                  <span className="text-slate-400">Sintoma:</span> {fe.symptom}
                                </div>
                                <div>
                                  <span className="text-slate-400">Causa:</span> {fe.presumed_cause}
                                </div>
                                <div>
                                  <span className="text-slate-400">Intervencao:</span>{' '}
                                  {fe.intervention_type}
                                  {fe.severity && (
                                    <span
                                      className={`ml-2 px-1.5 rounded text-[10px] ${
                                        fe.severity === 'Critico'
                                          ? 'bg-red-100 text-red-800'
                                          : fe.severity === 'Degradado'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-blue-100 text-blue-800'
                                      }`}
                                    >
                                      {fe.severity}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {ma?.description && (
                              <p className="text-xs text-slate-700 mt-1 italic">
                                "{ma.description}"
                              </p>
                            )}

                            {wo.observations && wo.observations.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-100">
                                {wo.observations.map((o, i) => (
                                  <div
                                    key={i}
                                    className="text-[11px] p-1.5 bg-amber-50 border-l-2 border-amber-400 rounded mb-1"
                                  >
                                    <strong className="text-amber-900">{o.type}</strong>
                                    <span className="text-slate-500"> ({o.target})</span>
                                    <div className="text-slate-700">{o.description}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
