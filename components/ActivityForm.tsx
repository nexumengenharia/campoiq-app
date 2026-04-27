'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Camera, Plus, Trash2, Save } from 'lucide-react';
import {
  SYMPTOMS,
  CAUSES,
  INTERVENTIONS,
  OBSERVATION_TYPE_LABEL,
  OBSERVATION_TARGET_LABEL,
  OBSERVATION_PRIORITY_LABEL,
} from '@/lib/constants';
import type {
  ObservationType,
  ObservationTarget,
  ObservationPriority,
  WoStatus,
} from '@/lib/types';

type Props = {
  assets: any[];
  systems: any[];
  subsystems: any[];
};

type ObsDraft = {
  type: ObservationType;
  target: ObservationTarget;
  priority: ObservationPriority;
  description: string;
  suggested_deadline: string;
};

const NEW_OBS: ObsDraft = {
  type: 'OBSERVACAO_GERAL',
  target: 'MANUTENCAO',
  priority: 'MEDIA',
  description: '',
  suggested_deadline: '',
};

export function ActivityForm({ assets, systems, subsystems }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tag, setTag] = useState('');
  const [om, setOm] = useState('');
  const [systemId, setSystemId] = useState('');
  const [subsystemId, setSubsystemId] = useState('');
  const [symptom, setSymptom] = useState('');
  const [cause, setCause] = useState('');
  const [intervention, setIntervention] = useState('');
  const [description, setDescription] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [status, setStatus] = useState<WoStatus>('EM_EXECUCAO');
  const [partsText, setPartsText] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [observations, setObservations] = useState<ObsDraft[]>([]);

  const subOptions = useMemo(
    () => subsystems.filter((s) => s.system_id === systemId),
    [systemId, subsystems]
  );

  function addObservation() {
    setObservations((prev) => [...prev, { ...NEW_OBS }]);
  }
  function updateObs(i: number, patch: Partial<ObsDraft>) {
    setObservations((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  function removeObs(i: number) {
    setObservations((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const supabase = createClient();

      const asset = assets.find((a) => a.tag === tag.trim());
      if (!asset) throw new Error(`Ativo com tag "${tag}" nao encontrado.`);

      const currentShift = inferShift(new Date());

      // 1) Cria WO
      const { data: wo, error: woErr } = await supabase
        .from('work_orders')
        .insert({
          om_number: om.trim(),
          asset_id: asset.id,
          status,
          shift: currentShift,
        })
        .select()
        .single();
      if (woErr) throw woErr;

      // 2) Cria failure_event
      if (systemId && subsystemId) {
        await supabase.from('failure_events').insert({
          work_order_id: wo.id,
          system_id: systemId,
          subsystem_id: subsystemId,
          symptom,
          presumed_cause: cause,
          intervention_type: intervention,
        });
      }

      // 3) Cria maintenance_action
      if (description.trim()) {
        await supabase.from('maintenance_actions').insert({
          work_order_id: wo.id,
          description,
          performed_by: performedBy.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
        });
      }

      // 4) Pecas utilizadas (opcional)
      if (partsText.trim()) {
        const parts = partsText.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          const match = p.match(/(.+?)\s*x\s*(\d+)/i);
          await supabase.from('parts_used').insert({
            work_order_id: wo.id,
            part_name: match ? match[1].trim() : p,
            quantity: match ? Number(match[2]) : 1,
          });
        }
      }

      // 5) Observacoes estruturadas
      for (const obs of observations) {
        if (!obs.description.trim()) continue;
        await supabase.from('observations').insert({
          work_order_id: wo.id,
          asset_id: asset.id,
          type: obs.type,
          target: obs.target,
          priority: obs.priority,
          description: obs.description,
          suggested_deadline: obs.suggested_deadline || null,
          created_by: performedBy.split(/[,;]/)[0]?.trim() || null,
        });
      }

      // 6) Upload de fotos para Storage (bucket 'photos')
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const path = `wo-${wo.id}/img-${i + 1}-${Date.now()}.${file.name.split('.').pop()}`;
        const { error: upErr } = await supabase.storage.from('photos').upload(path, file);
        if (!upErr) {
          await supabase.from('photos').insert({
            work_order_id: wo.id,
            storage_path: path,
            uploaded_by: performedBy.split(/[,;]/)[0]?.trim() || null,
          });
        }
      }

      router.push('/kanban');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar.');
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-2 rounded">{error}</div>
      )}

      {/* Identificacao */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Tag do Ativo *</label>
          <input
            list="asset-tags"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Ex: 9403"
            required
            className="w-full px-3 py-2 border border-slate-300 rounded text-base"
          />
          <datalist id="asset-tags">
            {assets.map((a) => (
              <option key={a.id} value={a.tag}>{a.description}</option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">OM *</label>
          <input
            value={om}
            onChange={(e) => setOm(e.target.value)}
            placeholder="Ex: 4.972.221"
            required
            className="w-full px-3 py-2 border border-slate-300 rounded text-base"
          />
        </div>
      </div>

      {/* Sistema / Subsistema */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Sistema *</label>
          <select
            value={systemId}
            onChange={(e) => { setSystemId(e.target.value); setSubsystemId(''); }}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded text-base bg-white"
          >
            <option value="">Selecione...</option>
            {systems.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Subsistema *</label>
          <select
            value={subsystemId}
            onChange={(e) => setSubsystemId(e.target.value)}
            required
            disabled={!systemId}
            className="w-full px-3 py-2 border border-slate-300 rounded text-base bg-white disabled:bg-slate-100"
          >
            <option value="">{systemId ? 'Selecione...' : 'Selecione o sistema primeiro'}</option>
            {subOptions.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
      </div>

      {/* Sintoma / Causa / Intervencao */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SelectField label="Sintoma *" value={symptom} onChange={setSymptom} options={SYMPTOMS} required />
        <SelectField label="Causa *"   value={cause}   onChange={setCause}   options={CAUSES}   required />
        <SelectField label="Intervencao *" value={intervention} onChange={setIntervention} options={INTERVENTIONS} required />
      </div>

      {/* Descricao livre */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Descricao da atividade</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
          placeholder="Ex: Identificamos que o sensor do filtro de combustivel nao estava plugado..."
        />
      </div>

      {/* Executantes */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Executantes (separe por virgula)</label>
        <input
          value={performedBy}
          onChange={(e) => setPerformedBy(e.target.value)}
          placeholder="Ex: Andre Neto, Joelson Ferreira"
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
        />
      </div>

      {/* OBSERVACOES / PENDENCIAS TECNICAS (substituiu pecas utilizadas) */}
      <div className="bg-amber-50 border border-amber-200 rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-bold text-amber-900">
            Observacoes / Pendencias Tecnicas
          </label>
          <button
            type="button"
            onClick={addObservation}
            className="text-xs bg-amber-600 text-white px-2 py-1 rounded inline-flex items-center gap-1"
          >
            <Plus size={12} /> Adicionar
          </button>
        </div>
        <p className="text-xs text-amber-800 mb-3">
          Registre informacoes acionaveis para PCM, Inspecao ou Engenharia — ex.: "foi feito arranjo
          temporario, precisa resolver com chegada das pecas", "mangueira xxx proxima de romper",
          "sera necessario trocar o alternador".
        </p>

        {observations.length === 0 && (
          <div className="text-xs text-amber-700 italic">
            Nenhuma observacao registrada. Clique em "Adicionar" se houver pendencia tecnica.
          </div>
        )}

        <div className="space-y-3">
          {observations.map((obs, i) => (
            <div key={i} className="bg-white rounded border border-amber-200 p-3 space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-500">Observacao #{i + 1}</span>
                <button type="button" onClick={() => removeObs(i)} className="text-red-500 hover:text-red-700">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <LabeledSelect
                  label="Tipo"
                  value={obs.type}
                  onChange={(v) => updateObs(i, { type: v as ObservationType })}
                  options={Object.entries(OBSERVATION_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
                />
                <LabeledSelect
                  label="Destinatario"
                  value={obs.target}
                  onChange={(v) => updateObs(i, { target: v as ObservationTarget })}
                  options={Object.entries(OBSERVATION_TARGET_LABEL).map(([k, v]) => ({ value: k, label: v }))}
                />
                <LabeledSelect
                  label="Prioridade"
                  value={obs.priority}
                  onChange={(v) => updateObs(i, { priority: v as ObservationPriority })}
                  options={Object.entries(OBSERVATION_PRIORITY_LABEL).map(([k, v]) => ({ value: k, label: v }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descricao detalhada</label>
                <textarea
                  rows={3}
                  value={obs.description}
                  onChange={(e) => updateObs(i, { description: e.target.value })}
                  placeholder="Descreva precisamente o que precisa de acao e por que..."
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prazo sugerido (opcional)</label>
                <input
                  type="date"
                  value={obs.suggested_deadline}
                  onChange={(e) => updateObs(i, { suggested_deadline: e.target.value })}
                  className="px-2 py-1.5 border border-slate-300 rounded text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pecas utilizadas - opcional, mais discreto */}
      <details className="text-sm">
        <summary className="cursor-pointer text-slate-600 font-medium">
          Pecas utilizadas (opcional)
        </summary>
        <div className="mt-2">
          <input
            value={partsText}
            onChange={(e) => setPartsText(e.target.value)}
            placeholder="Ex: Filtro de combustivel x1; Oleo hidraulico x2"
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">Separe por ponto-e-virgula. Formato: "nome x quantidade".</p>
        </div>
      </details>

      {/* Fotos */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Fotos da atividade</label>
        <div className="flex items-center gap-2">
          <label className="px-4 py-2 bg-slate-100 border border-slate-300 rounded text-sm font-medium hover:bg-slate-200 flex items-center gap-2 cursor-pointer">
            <Camera size={16} /> Capturar / anexar
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => setPhotos((prev) => [...prev, ...Array.from(e.target.files || [])])}
            />
          </label>
          <span className="text-xs text-slate-500">{photos.length} foto{photos.length !== 1 ? 's' : ''}</span>
        </div>
        {photos.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {photos.map((f, i) => (
              <div key={i} className="w-16 h-16 rounded border border-slate-300 bg-gradient-to-br from-slate-200 to-slate-400 flex items-center justify-center text-white font-bold text-[10px] text-center px-1">
                {f.name.slice(0, 8)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Status *</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['EM_EXECUCAO', 'CONCLUIDO', 'AGUARDANDO_PECA', 'PENDENTE'] as WoStatus[]).map((s) => (
            <label key={s} className={`flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50 ${status === s ? 'border-orange-500 bg-orange-50' : 'border-slate-300'}`}>
              <input
                type="radio"
                name="status"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
                required
              />
              <span className="text-sm">
                {s === 'EM_EXECUCAO' ? 'Em Execucao' :
                 s === 'CONCLUIDO'   ? 'Concluido'  :
                 s === 'AGUARDANDO_PECA' ? 'Aguardando Peca' :
                 'Pendente'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded text-base flex items-center justify-center gap-2"
      >
        <Save size={18} /> {saving ? 'Salvando...' : 'Registrar atividade'}
      </button>
    </form>
  );
}

function SelectField({
  label, value, onChange, options, required,
}: { label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean; }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
      >
        <option value="">Selecione...</option>
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
    </div>
  );
}

function LabeledSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
      >
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
}

function inferShift(d: Date): 'A' | 'B' | 'C' {
  const h = d.getHours();
  if (h >= 7 && h < 15) return 'A';
  if (h >= 15 && h < 23) return 'B';
  return 'C';
}
