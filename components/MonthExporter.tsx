'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Download, FileSpreadsheet, AlertCircle, CheckCircle2, Calendar, Loader2 } from 'lucide-react';
import { STATUS_LABEL } from '@/lib/constants';

const MONTHS_PT = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function MonthExporter() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const years = [today.getFullYear(), today.getFullYear() - 1, today.getFullYear() - 2];

  async function exportMonth(format: 'consolidado' | 'separado') {
    setBusy(true);
    setFeedback(null);

    try {
      const supabase = createClient();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 1);

      const { data: wos, error } = await supabase
        .from('work_orders')
        .select(
          `id, om_number, status, shift, opened_at, closed_at, mttr_minutes,
           carried_from_shift, carry_note,
           asset:assets(tag, criticality, fleet:fleets(name, code, manufacturer, model)),
           failure_events(symptom, presumed_cause, intervention_type, severity, detection_method,
             system:systems(name), subsystem:subsystems(name)),
           maintenance_actions(description, performed_by, performed_at),
           observations(type, target, priority, status, description, suggested_deadline, created_by, created_at, resolved_at, resolved_by, resolution_notes),
           parts_used(part_code, part_name, quantity, unit)`
        )
        .gte('opened_at', start.toISOString())
        .lt('opened_at', end.toISOString())
        .order('opened_at', { ascending: true });

      if (error) throw error;
      if (!wos || wos.length === 0) {
        setFeedback({ ok: false, msg: 'Nenhuma OM encontrada nesse mes.' });
        setBusy(false);
        return;
      }

      const monthLabel = `${String(month + 1).padStart(2, '0')}-${year}`;

      if (format === 'consolidado') {
        const rows: any[] = [];
        wos.forEach((w: any) => {
          const fe = w.failure_events?.[0];
          const ma = w.maintenance_actions?.[0];
          const obs = (w.observations || []).map((o: any) => `${o.type} | ${o.target} | ${o.priority} | ${o.description}`).join(' || ') || '';
          const parts = (w.parts_used || []).map((p: any) => `${p.part_name} x${p.quantity}${p.unit}`).join('; ') || '';
          rows.push({
            'OM': w.om_number,
            'Tag': w.asset?.tag || '',
            'Frota': w.asset?.fleet?.name || '',
            'Fabricante': w.asset?.fleet?.manufacturer || '',
            'Modelo': w.asset?.fleet?.model || '',
            'Criticidade': w.asset?.criticality ?? '',
            'Status': STATUS_LABEL[w.status as keyof typeof STATUS_LABEL] || w.status,
            'Turno': w.shift || '',
            'Vindo do turno': w.carried_from_shift || '',
            'Aberta em': formatDateTime(w.opened_at),
            'Fechada em': w.closed_at ? formatDateTime(w.closed_at) : '',
            'MTTR (min)': w.mttr_minutes ?? '',
            'MTTR (h)': w.mttr_minutes ? (w.mttr_minutes / 60).toFixed(2) : '',
            'Sistema': fe?.system?.name || '',
            'Subsistema': fe?.subsystem?.name || '',
            'Sintoma': fe?.symptom || '',
            'Causa presumida': fe?.presumed_cause || '',
            'Intervencao': fe?.intervention_type || '',
            'Severidade': fe?.severity || '',
            'Deteccao': fe?.detection_method || '',
            'Descricao': (ma?.description || '').replace(/\n/g, ' '),
            'Executantes': (ma?.performed_by || []).join('; '),
            'Pecas utilizadas': parts,
            'Observacoes / Pendencias': obs,
            'Nota de carry-over': w.carry_note || '',
          });
        });
        downloadCSV(rows, `campoiq-${monthLabel}-consolidado.csv`);
        setFeedback({ ok: true, msg: `Arquivo gerado com ${rows.length} OMs.` });
      } else {
        // Modo separado: 3 arquivos zipados? simples: 3 csvs sequenciais
        const woRows: any[] = [];
        const obsRows: any[] = [];
        const partsRows: any[] = [];
        wos.forEach((w: any) => {
          const fe = w.failure_events?.[0];
          const ma = w.maintenance_actions?.[0];
          woRows.push({
            'OM': w.om_number,
            'Tag': w.asset?.tag || '',
            'Frota': w.asset?.fleet?.name || '',
            'Status': STATUS_LABEL[w.status as keyof typeof STATUS_LABEL] || w.status,
            'Turno': w.shift || '',
            'Aberta em': formatDateTime(w.opened_at),
            'Fechada em': w.closed_at ? formatDateTime(w.closed_at) : '',
            'MTTR (min)': w.mttr_minutes ?? '',
            'Sistema': fe?.system?.name || '',
            'Subsistema': fe?.subsystem?.name || '',
            'Sintoma': fe?.symptom || '',
            'Causa': fe?.presumed_cause || '',
            'Intervencao': fe?.intervention_type || '',
            'Severidade': fe?.severity || '',
            'Descricao': (ma?.description || '').replace(/\n/g, ' '),
            'Executantes': (ma?.performed_by || []).join('; '),
          });
          (w.observations || []).forEach((o: any) => {
            obsRows.push({
              'OM origem': w.om_number,
              'Tag': w.asset?.tag || '',
              'Tipo': o.type,
              'Destinatario': o.target,
              'Prioridade': o.priority,
              'Status': o.status,
              'Descricao': o.description,
              'Prazo sugerido': o.suggested_deadline || '',
              'Criado por': o.created_by || '',
              'Criado em': formatDateTime(o.created_at),
              'Resolvido em': o.resolved_at ? formatDateTime(o.resolved_at) : '',
              'Resolvido por': o.resolved_by || '',
              'Notas de resolucao': o.resolution_notes || '',
            });
          });
          (w.parts_used || []).forEach((p: any) => {
            partsRows.push({
              'OM': w.om_number,
              'Tag': w.asset?.tag || '',
              'Codigo peca': p.part_code || '',
              'Nome peca': p.part_name,
              'Quantidade': p.quantity,
              'Unidade': p.unit,
            });
          });
        });
        downloadCSV(woRows, `campoiq-${monthLabel}-1-ordens.csv`);
        if (obsRows.length > 0) downloadCSV(obsRows, `campoiq-${monthLabel}-2-observacoes.csv`);
        if (partsRows.length > 0) downloadCSV(partsRows, `campoiq-${monthLabel}-3-pecas.csv`);
        setFeedback({
          ok: true,
          msg: `Gerados: ${woRows.length} OMs · ${obsRows.length} observacoes · ${partsRows.length} pecas.`,
        });
      }
    } catch (e: any) {
      setFeedback({ ok: false, msg: `Erro: ${e.message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <FileSpreadsheet className="text-emerald-600" size={20} />
        <h3 className="font-semibold text-slate-900">Exportacao mensal</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="text-sm">
          <span className="block text-slate-700 mb-1 flex items-center gap-1">
            <Calendar size={12} /> Mes
          </span>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
          >
            {MONTHS_PT.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-700 mb-1">Ano</span>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => exportMonth('consolidado')}
          disabled={busy}
          className="px-4 py-3 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 disabled:bg-slate-300 inline-flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          Baixar consolidado
        </button>
        <button
          onClick={() => exportMonth('separado')}
          disabled={busy}
          className="px-4 py-3 bg-slate-700 text-white rounded font-medium hover:bg-slate-800 disabled:bg-slate-300 inline-flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          Baixar separado (3 CSVs)
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded text-sm flex items-start gap-2 ${
            feedback.ok ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'
          }`}
        >
          {feedback.ok ? <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      <details className="mt-4 text-xs text-slate-600">
        <summary className="cursor-pointer font-medium">O que vem em cada formato?</summary>
        <div className="mt-2 space-y-2">
          <div>
            <strong>Consolidado</strong> — 1 arquivo CSV com 1 linha por OM, juntando dados de
            falha, intervencao, observacoes e pecas em colunas. Bom para visao geral.
          </div>
          <div>
            <strong>Separado</strong> — 3 arquivos CSV (Ordens, Observacoes, Pecas), cada um com
            granularidade propria. Bom para Power BI / analise estruturada.
          </div>
          <div className="text-slate-500">
            Os arquivos CSV abrem direto no Excel (UTF-8 com BOM, separador virgula).
          </div>
        </div>
      </details>
    </div>
  );
}

function formatDateTime(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR');
}

function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvRows = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const csv = csvRows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
