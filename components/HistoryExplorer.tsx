'use client';

import { useMemo, useState } from 'react';
import { Search, Filter, Calendar, Clock, AlertTriangle, ChevronDown, Download } from 'lucide-react';
import { STATUS_CLASS, STATUS_LABEL } from '@/lib/constants';

type Asset = { id: string; tag: string; fleet?: { name: string } };
type System = { id: string; name: string };
type WO = {
  id: string;
  om_number: string;
  status: string;
  shift: string | null;
  opened_at: string;
  closed_at: string | null;
  mttr_minutes: number | null;
  asset?: { id: string; tag: string; fleet?: { name: string; code?: string } };
  failure_events?: Array<{
    symptom: string;
    presumed_cause: string;
    intervention_type: string;
    severity: string | null;
    system?: { name: string };
    subsystem?: { name: string };
  }>;
  maintenance_actions?: Array<{ description: string; performed_by: string[] | null }>;
  observations?: Array<{ type: string; target: string; priority: string; description: string }>;
};

type Props = { wos: WO[]; assets: Asset[]; systems: System[] };

const SEVERITY_CLASS: Record<string, string> = {
  Critico: 'bg-red-100 text-red-800 border-red-300',
  Degradado: 'bg-amber-100 text-amber-800 border-amber-300',
  Incipiente: 'bg-blue-100 text-blue-800 border-blue-300',
};

export function HistoryExplorer({ wos, assets, systems }: Props) {
  const [search, setSearch] = useState('');
  const [filterAsset, setFilterAsset] = useState('');
  const [filterSystem, setFilterSystem] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'7' | '30' | '90'>('90');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const days = parseInt(filterPeriod);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const q = search.toLowerCase().trim();

    return wos.filter((w) => {
      if (new Date(w.opened_at) < since) return false;
      if (filterAsset && w.asset?.tag !== filterAsset) return false;
      const fe = w.failure_events?.[0];
      if (filterSystem && fe?.system?.name !== filterSystem) return false;
      if (filterSeverity && fe?.severity !== filterSeverity) return false;
      if (q) {
        const hay = `${w.om_number} ${w.asset?.tag} ${fe?.symptom} ${fe?.presumed_cause} ${
          fe?.system?.name
        } ${fe?.subsystem?.name} ${w.maintenance_actions?.[0]?.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [wos, search, filterAsset, filterSystem, filterSeverity, filterPeriod]);

  // Agrupar por dia para timeline
  const grouped = useMemo(() => {
    const map = new Map<string, WO[]>();
    filtered.forEach((w) => {
      const day = new Date(w.opened_at).toLocaleDateString('pt-BR');
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(w);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // Estatisticas rapidas
  const stats = useMemo(() => {
    const concluidas = filtered.filter((w) => w.status === 'CONCLUIDO');
    const totalMin = concluidas.reduce((s, w) => s + (w.mttr_minutes || 0), 0);
    const avgMin = concluidas.length > 0 ? Math.round(totalMin / concluidas.length) : 0;
    const criticas = filtered.filter((w) => w.failure_events?.[0]?.severity === 'Critico').length;
    return {
      total: filtered.length,
      concluidas: concluidas.length,
      avgMin,
      totalHr: (totalMin / 60).toFixed(1),
      criticas,
    };
  }, [filtered]);

  function toggleExpand(id: string) {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  }

  function exportCSV() {
    const headers = [
      'OM', 'Tag', 'Frota', 'Status', 'Turno', 'Aberta em', 'Fechada em',
      'MTTR (min)', 'Sistema', 'Subsistema', 'Sintoma', 'Causa', 'Intervencao',
      'Severidade', 'Descricao', 'Executantes',
    ];
    const rows = filtered.map((w) => {
      const fe = w.failure_events?.[0];
      const ma = w.maintenance_actions?.[0];
      return [
        w.om_number,
        w.asset?.tag || '',
        w.asset?.fleet?.name || '',
        STATUS_LABEL[w.status as keyof typeof STATUS_LABEL] || w.status,
        w.shift || '',
        new Date(w.opened_at).toLocaleString('pt-BR'),
        w.closed_at ? new Date(w.closed_at).toLocaleString('pt-BR') : '',
        w.mttr_minutes ?? '',
        fe?.system?.name || '',
        fe?.subsystem?.name || '',
        fe?.symptom || '',
        fe?.presumed_cause || '',
        fe?.intervention_type || '',
        fe?.severity || '',
        (ma?.description || '').replace(/\n/g, ' '),
        (ma?.performed_by || []).join('; '),
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `historico-corretivas-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Filtros */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4 sticky top-[88px] z-30">
        <div className="flex flex-wrap gap-2 mb-2">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por tag, OM, sintoma, sistema..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-300 rounded"
            />
          </div>
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 inline-flex items-center gap-1"
          >
            <Download size={12} /> CSV ({filtered.length})
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value as any)}
            className="px-2 py-1 border border-slate-300 rounded bg-white"
          >
            <option value="7">Ultimos 7 dias</option>
            <option value="30">Ultimos 30 dias</option>
            <option value="90">Ultimos 90 dias</option>
          </select>
          <select
            value={filterAsset}
            onChange={(e) => setFilterAsset(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded bg-white"
          >
            <option value="">Todos os equipamentos</option>
            {assets.map((a) => (
              <option key={a.id} value={a.tag}>
                {a.tag} ({a.fleet?.name})
              </option>
            ))}
          </select>
          <select
            value={filterSystem}
            onChange={(e) => setFilterSystem(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded bg-white"
          >
            <option value="">Todos os sistemas</option>
            {systems.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded bg-white"
          >
            <option value="">Toda severidade</option>
            <option value="Critico">Critico</option>
            <option value="Degradado">Degradado</option>
            <option value="Incipiente">Incipiente</option>
          </select>
          {(filterAsset || filterSystem || filterSeverity || search) && (
            <button
              onClick={() => {
                setFilterAsset('');
                setFilterSystem('');
                setFilterSeverity('');
                setSearch('');
              }}
              className="px-2 py-1 text-slate-500 hover:text-slate-900"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <KPI label="OMs encontradas" value={stats.total} />
        <KPI label="Concluidas" value={stats.concluidas} />
        <KPI label="MTTR medio" value={stats.avgMin > 0 ? `${stats.avgMin}min` : '-'} />
        <KPI label="Severidade critica" value={stats.criticas} highlight={stats.criticas > 0} />
      </div>

      {/* Timeline agrupada por dia */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
          Nenhuma corretiva encontrada com os filtros atuais.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, dayWos]) => (
            <section key={day}>
              <h3 className="text-xs font-bold text-slate-700 mb-2 sticky top-[180px] z-20 bg-slate-50 py-1">
                <Calendar size={12} className="inline mr-1" /> {day}
                <span className="ml-2 text-slate-400 font-normal">({dayWos.length} OMs)</span>
              </h3>
              <div className="space-y-2 ml-4 border-l-2 border-slate-200 pl-4 relative">
                {dayWos.map((w) => {
                  const fe = w.failure_events?.[0];
                  const ma = w.maintenance_actions?.[0];
                  const isOpen = expanded.has(w.id);
                  const isCritico = fe?.severity === 'Critico';
                  return (
                    <div key={w.id} className="relative">
                      <span
                        className={`absolute left-[-22px] top-3 w-3 h-3 rounded-full border-2 border-white ${
                          isCritico ? 'bg-red-500' : w.status === 'CONCLUIDO' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <button
                        onClick={() => toggleExpand(w.id)}
                        className={`w-full text-left bg-white border rounded-lg p-3 hover:shadow-md transition ${
                          isCritico ? 'border-red-200' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-bold text-base text-slate-900">{w.asset?.tag}</span>
                              <span className="text-[10px] font-mono text-slate-500">OM {w.om_number}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  STATUS_CLASS[w.status as keyof typeof STATUS_CLASS]
                                }`}
                              >
                                {STATUS_LABEL[w.status as keyof typeof STATUS_LABEL]}
                              </span>
                              {w.shift && (
                                <span className="text-[10px] text-slate-500">Turno {w.shift}</span>
                              )}
                              {fe?.severity && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                    SEVERITY_CLASS[fe.severity] || ''
                                  } inline-flex items-center gap-1`}
                                >
                                  {fe.severity === 'Critico' && <AlertTriangle size={10} />}
                                  {fe.severity}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-700 font-medium">
                              {fe?.system?.name} <span className="text-slate-400">/</span>{' '}
                              {fe?.subsystem?.name}
                              <span className="text-slate-500"> · {fe?.symptom}</span>
                            </div>
                          </div>
                          <div className="text-right text-[10px] flex-shrink-0">
                            <div className="text-slate-500">{formatTime(w.opened_at)}</div>
                            {w.mttr_minutes && (
                              <div className="font-semibold text-slate-700 inline-flex items-center gap-1">
                                <Clock size={10} />
                                {w.mttr_minutes < 60
                                  ? `${w.mttr_minutes}min`
                                  : `${(w.mttr_minutes / 60).toFixed(1)}h`}
                              </div>
                            )}
                            <ChevronDown
                              size={14}
                              className={`text-slate-400 mt-1 transition-transform ${
                                isOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </div>
                        </div>

                        {isOpen && (
                          <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-1">
                            {fe && (
                              <>
                                <div>
                                  <span className="text-slate-500">Causa presumida:</span>{' '}
                                  {fe.presumed_cause}
                                </div>
                                <div>
                                  <span className="text-slate-500">Intervencao:</span>{' '}
                                  {fe.intervention_type}
                                </div>
                              </>
                            )}
                            {ma?.description && (
                              <div className="pt-1">
                                <span className="text-slate-500">Descricao:</span>
                                <p className="italic text-slate-700">"{ma.description}"</p>
                              </div>
                            )}
                            {ma?.performed_by && ma.performed_by.length > 0 && (
                              <div>
                                <span className="text-slate-500">Executantes:</span>{' '}
                                {ma.performed_by.join(', ')}
                              </div>
                            )}
                            {w.observations && w.observations.length > 0 && (
                              <div className="mt-2">
                                <div className="text-slate-500 mb-1">Observacoes / Pendencias:</div>
                                {w.observations.map((o, i) => (
                                  <div
                                    key={i}
                                    className="p-1.5 bg-amber-50 border-l-2 border-amber-400 rounded mb-1"
                                  >
                                    <strong className="text-amber-900">{o.type}</strong>
                                    <span className="text-slate-500"> ({o.target})</span>
                                    <div className="text-slate-700">{o.description}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function KPI({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg p-3 border ${
        highlight ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
      }`}
    >
      <div className={`text-xl font-bold ${highlight ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
