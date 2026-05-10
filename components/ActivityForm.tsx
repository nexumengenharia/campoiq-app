'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Camera, Plus, Trash2, Save, RotateCcw } from 'lucide-react';

const DRAFT_KEY = 'campoiq:nova:draft';
import {
  SYMPTOMS,
  CAUSES,
  INTERVENTIONS,
  OBSERVATION_TYPE_LABEL,
  OBSERVATION_TARGET_LABEL,
  OBSERVATION_PRIORITY_LABEL,
  SHIFTS,
  SHIFT_LABEL,
  MAINT_TYPE_LABEL,
  inferShift,
} from '@/lib/constants';
import type {
  ObservationType,
  ObservationTarget,
  ObservationPriority,
  WoStatus,
  Shift,
  MaintenanceType,
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

const OTHER = '__OUTRO__';

function localISO(d: Date) {
  // YYYY-MM-DDTHH:MM em fuso local, formato aceito por <input type="datetime-local">
  const tzOffset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function ActivityForm({ assets, systems, subsystems }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const [tag, setTag] = useState('');
  const [om, setOm] = useState('');
  const [openedAt, setOpenedAt] = useState<string>(localISO(new Date()));
  const [shift, setShift] = useState<Shift>(inferShift(new Date()));
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>('CORRETIVA');

  // Sistema / Subsistema com opção "Outro"
  const [systemId, setSystemId] = useState('');
  const [systemOther, setSystemOther] = useState('');
  const [subsystemId, setSubsystemId] = useState('');
  const [subsystemOther, setSubsystemOther] = useState('');

  // Sintoma / Causa / Intervenção com "Outro"
  const [symptom, setSymptom] = useState('');
  const [symptomOther, setSymptomOther] = useState('');
  const [cause, setCause] = useState('');
  const [causeOther, setCauseOther] = useState('');
  const [intervention, setIntervention] = useState('');
  const [interventionOther, setInterventionOther] = useState('');

  const [description, setDescription] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [status, setStatus] = useState<WoStatus>('EM_EXECUCAO');
  const [partsText, setPartsText] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [observations, setObservations] = useState<ObsDraft[]>([]);

  // Carrega rascunho salvo após hidratação (evita mismatch SSR)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.tag)              setTag(d.tag);
      if (d.om)               setOm(d.om);
      if (d.openedAt)         setOpenedAt(d.openedAt);
      if (d.shift)            setShift(d.shift);
      if (d.maintenanceType)  setMaintenanceType(d.maintenanceType);
      if (d.systemId)         setSystemId(d.systemId);
      if (d.systemOther)      setSystemOther(d.systemOther);
      if (d.subsystemId)      setSubsystemId(d.subsystemId);
      if (d.subsystemOther)   setSubsystemOther(d.subsystemOther);
      if (d.symptom)          setSymptom(d.symptom);
      if (d.symptomOther)     setSymptomOther(d.symptomOther);
      if (d.cause)            setCause(d.cause);
      if (d.causeOther)       setCauseOther(d.causeOther);
      if (d.intervention)     setIntervention(d.intervention);
      if (d.interventionOther) setInterventionOther(d.interventionOther);
      if (d.description)      setDescription(d.description);
      if (d.performedBy)      setPerformedBy(d.performedBy);
      if (d.status)           setStatus(d.status);
      if (d.partsText)        setPartsText(d.partsText);
      if (d.observations?.length) setObservations(d.observations);
      if (d.tag || d.om || d.description) setDraftRestored(true);
    } catch {
      // localStorage corrompido — ignora
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Salva rascunho a cada mudança
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        tag, om, openedAt, shift, maintenanceType,
        systemId, systemOther, subsystemId, subsystemOther,
        symptom, symptomOther, cause, causeOther, intervention, interventionOther,
        description, performedBy, status, partsText, observations,
      }));
    } catch { /* storage cheio ou privado */ }
  }, [tag, om, openedAt, shift, maintenanceType,
      systemId, systemOther, subsystemId, subsystemOther,
      symptom, symptomOther, cause, causeOther, intervention, interventionOther,
      description, performedBy, status, partsText, observations]);

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setTag(''); setOm(''); setOpenedAt(localISO(new Date())); setShift(inferShift(new Date()));
    setMaintenanceType('CORRETIVA'); setSystemId(''); setSystemOther('');
    setSubsystemId(''); setSubsystemOther(''); setSymptom(''); setSymptomOther('');
    setCause(''); setCauseOther(''); setIntervention(''); setInterventionOther('');
    setDescription(''); setPerformedBy(''); setStatus('EM_EXECUCAO');
    setPartsText(''); setPhotos([]); setObservations([]); setDraftRestored(false);
  }

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

  async function ensureSystem(supabase: any): Promise<string | null> {
    if (systemId && systemId !== OTHER) return systemId;
    const name = systemOther.trim();
    if (!name) return null;
    // Procura por nome (case-insensitive)
    const { data: existing } = await supabase
      .from('systems')
      .select('id')
      .ilike('name', name)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const { data: ins, error } = await supabase
      .from('systems')
      .insert({ name })
      .select('id')
      .single();
    if (error) throw error;
    return ins.id;
  }

  async function ensureSubsystem(supabase: any, sysId: string): Promise<string | null> {
    if (subsystemId && subsystemId !== OTHER) return subsystemId;
    const name = subsystemOther.trim();
    if (!name) return null;
    const { data: existing } = await supabase
      .from('subsystems')
      .select('id')
      .eq('system_id', sysId)
      .ilike('name', name)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const { data: ins, error } = await supabase
      .from('subsystems')
      .insert({ system_id: sysId, name })
      .select('id')
      .single();
    if (error) throw error;
    return ins.id;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const supabase = createClient();

      const asset = assets.find((a) => a.tag === tag.trim());
      if (!asset) throw new Error(`Ativo com tag "${tag}" nao encontrado.`);

      const opened = new Date(openedAt);
      const openedDateISO = opened.toISOString().slice(0, 10);

      // 1) Cria WO com data/hora informada
      const { data: wo, error: woErr } = await supabase
        .from('work_orders')
        .insert({
          om_number: om.trim(),
          asset_id: asset.id,
          status,
          shift,
          maintenance_type: maintenanceType,
          opened_at: opened.toISOString(),
          closed_at: status === 'CONCLUIDO' ? opened.toISOString() : null,
          worked_in_shifts: [shift],
          worked_in_dates: [openedDateISO],
          last_action_shift: shift,
          last_action_date: openedDateISO,
        })
        .select()
        .single();
      if (woErr) throw woErr;

      // 2) Resolve Sistema/Subsistema (cria se "Outro")
      const sysId = await ensureSystem(supabase);
      const subId = sysId ? await ensureSubsystem(supabase, sysId) : null;

      // 3) Resolve Sintoma / Causa / Intervencao (sem tabela - texto direto)
      const finalSymptom = symptom === OTHER ? symptomOther.trim() : symptom;
      const finalCause = cause === OTHER ? causeOther.trim() : cause;
      const finalIntervention = intervention === OTHER ? interventionOther.trim() : intervention;

      // 4) Cria failure_event
      if (sysId && subId && finalSymptom && finalCause && finalIntervention) {
        await supabase.from('failure_events').insert({
          work_order_id: wo.id,
          system_id: sysId,
          subsystem_id: subId,
          symptom: finalSymptom,
          presumed_cause: finalCause,
          intervention_type: finalIntervention,
        });
      }

      // 5) Cria maintenance_action
      if (description.trim()) {
        await supabase.from('maintenance_actions').insert({
          work_order_id: wo.id,
          description,
          performed_by: performedBy.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
        });
      }

      // 6) Pecas utilizadas (opcional)
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

      // 7) Observacoes estruturadas
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

      // 8) Upload de fotos para Storage (bucket 'photos')
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

      localStorage.removeItem(DRAFT_KEY);
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
      {draftRestored && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm p-2 rounded flex items-center justify-between">
          <span>📋 Rascunho restaurado — seus dados anteriores foram recuperados.</span>
          <button
            type="button"
            onClick={clearDraft}
            className="ml-3 text-xs text-blue-600 underline whitespace-nowrap flex items-center gap-1"
          >
            <RotateCcw size={12} /> Limpar rascunho
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-2 rounded">{error}</div>
      )}

      {/* Identificacao */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Data e hora de abertura *</label>
          <input
            type="datetime-local"
            value={openedAt}
            onChange={(e) => setOpenedAt(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded text-base"
          />
        </div>
      </div>

      {/* Turno + Tipo de Manutencao */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Turno *</label>
          <div className="grid grid-cols-4 gap-1">
            {SHIFTS.map((s) => (
              <label
                key={s}
                className={`flex items-center justify-center gap-1 p-2 border rounded cursor-pointer text-sm font-medium ${
                  shift === s ? 'border-orange-500 bg-orange-50 text-orange-900' : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="shift"
                  value={s}
                  checked={shift === s}
                  onChange={() => setShift(s)}
                  className="sr-only"
                />
                {s}
              </label>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Atual: {SHIFT_LABEL[shift]}
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de manutencao *</label>
          <div className="grid grid-cols-2 gap-1">
            {(['CORRETIVA', 'PREVENTIVA'] as MaintenanceType[]).map((t) => (
              <label
                key={t}
                className={`flex items-center justify-center gap-2 p-2 border rounded cursor-pointer text-sm font-medium ${
                  maintenanceType === t
                    ? t === 'CORRETIVA'
                      ? 'border-red-500 bg-red-50 text-red-900'
                      : 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="maintenance-type"
                  value={t}
                  checked={maintenanceType === t}
                  onChange={() => setMaintenanceType(t)}
                  className="sr-only"
                />
                {MAINT_TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Sistema / Subsistema (com Outro) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <option value={OTHER}>Outro (digitar)</option>
          </select>
          {systemId === OTHER && (
            <input
              value={systemOther}
              onChange={(e) => setSystemOther(e.target.value)}
              placeholder="Ex: Sistema AdBlue"
              required
              className="w-full mt-2 px-3 py-2 border border-amber-400 rounded text-base bg-amber-50"
            />
          )}
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
            {systemId && <option value={OTHER}>Outro (digitar)</option>}
          </select>
          {subsystemId === OTHER && (
            <input
              value={subsystemOther}
              onChange={(e) => setSubsystemOther(e.target.value)}
              placeholder="Ex: Tanque ARLA 32"
              required
              className="w-full mt-2 px-3 py-2 border border-amber-400 rounded text-base bg-amber-50"
            />
          )}
        </div>
      </div>

      {/* Sintoma / Causa / Intervencao (com Outro) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SelectFieldOther
          label="Sintoma *"
          value={symptom}
          other={symptomOther}
          onChange={setSymptom}
          onChangeOther={setSymptomOther}
          options={SYMPTOMS}
          required
        />
        <SelectFieldOther
          label="Causa *"
          value={cause}
          other={causeOther}
          onChange={setCause}
          onChangeOther={setCauseOther}
          options={CAUSES}
          required
        />
        <SelectFieldOther
          label="Intervencao *"
          value={intervention}
          other={interventionOther}
          onChange={setIntervention}
          onChangeOther={setInterventionOther}
          options={INTERVENTIONS}
          required
        />
      </div>

      {/* Descricao livre */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Descricao da atividade</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
          placeholder="Descreva o que foi feito - o que verificou, o que substituiu, o que ajustou..."
        />
      </div>

      {/* Executantes */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Executantes (separe por virgula)</label>
        <input
          value={performedBy}
          onChange={(e) => setPerformedBy(e.target.value)}
          placeholder="Nome do(s) executante(s)"
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
        />
      </div>

      {/* OBSERVACOES / PENDENCIAS TECNICAS */}
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
          Registre informacoes acionaveis para PCM, Inspecao ou Engenharia - ex.: "foi feito arranjo
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

      {/* Pecas utilizadas - opcional */}
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

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded text-base flex items-center justify-center gap-2"
        >
          <Save size={18} /> {saving ? 'Salvando...' : 'Registrar atividade'}
        </button>
        <button
          type="button"
          onClick={clearDraft}
          disabled={saving}
          title="Limpar formulário e rascunho salvo"
          className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-slate-300 flex items-center gap-1 text-sm"
        >
          <RotateCcw size={16} /> Limpar
        </button>
      </div>
    </form>
  );
}

function SelectFieldOther({
  label, value, other, onChange, onChangeOther, options, required,
}: {
  label: string;
  value: string;
  other: string;
  onChange: (v: string) => void;
  onChangeOther: (v: string) => void;
  options: string[];
  required?: boolean;
}) {
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
        <option value={OTHER}>Outro (digitar)</option>
      </select>
      {value === OTHER && (
        <input
          value={other}
          onChange={(e) => onChangeOther(e.target.value)}
          placeholder="Digite a opcao..."
          required
          className="w-full mt-2 px-3 py-2 border border-amber-400 rounded text-sm bg-amber-50"
        />
      )}
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

