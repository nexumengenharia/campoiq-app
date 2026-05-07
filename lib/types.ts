// Tipos do dominio CampoIQ - refletem o schema Supabase

export type WoStatus = 'PENDENTE' | 'EM_EXECUCAO' | 'CONCLUIDO' | 'AGUARDANDO_PECA';
export type Shift = 'A' | 'B' | 'C' | 'D';
export type MaintenanceType = 'CORRETIVA' | 'PREVENTIVA';

export type ObservationType =
  | 'ARRANJO_TEMPORARIO'
  | 'COMPONENTE_EM_RISCO'
  | 'RECOMENDACAO_TROCA'
  | 'PENDENCIA_PCM'
  | 'PENDENCIA_INSPECAO'
  | 'PENDENCIA_ENGENHARIA'
  | 'OBSERVACAO_GERAL';

export type ObservationTarget = 'PCM' | 'INSPECAO' | 'ENGENHARIA' | 'MANUTENCAO' | 'OPERACAO' | 'SUPRIMENTOS';
export type ObservationPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type ObservationStatus = 'ABERTA' | 'EM_ANALISE' | 'RESOLVIDA' | 'CANCELADA';

export interface Fleet {
  id: string;
  code: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  icon_key: string | null;
  tag_range: string | null;
}

export interface Asset {
  id: string;
  tag: string;
  fleet_id: string | null;
  description: string | null;
  criticality: number;
  active: boolean;
  fleet?: Fleet;
}

export interface System {
  id: string;
  name: string;
  sort_order: number;
}

export interface Subsystem {
  id: string;
  system_id: string;
  name: string;
}

export interface WorkOrder {
  id: string;
  om_number: string;
  asset_id: string;
  status: WoStatus;
  shift: Shift | null;
  maintenance_type: MaintenanceType;
  opened_at: string;
  closed_at: string | null;
  carried_from_shift: Shift | null;
  carried_from_date: string | null;
  carry_note: string | null;
  mttr_minutes: number | null;
  worked_in_shifts: Shift[] | null;
  worked_in_dates: string[] | null;
  last_action_shift: Shift | null;
  last_action_date: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  asset?: Asset;
  failure_events?: FailureEvent[];
  maintenance_actions?: MaintenanceAction[];
  observations?: Observation[];
  photos?: Photo[];
  parts_used?: PartUsed[];
}

export interface FailureEvent {
  id: string;
  work_order_id: string;
  system_id: string | null;
  subsystem_id: string | null;
  symptom: string;
  presumed_cause: string;
  intervention_type: string;
  severity: 'Incipiente' | 'Degradado' | 'Critico' | null;
  detection_method: string | null;
  root_cause_notes: string | null;
  system?: System;
  subsystem?: Subsystem;
}

export interface MaintenanceAction {
  id: string;
  work_order_id: string;
  description: string;
  performed_by: string[];
  performed_at: string;
}

export interface Observation {
  id: string;
  work_order_id: string | null;
  asset_id: string;
  type: ObservationType;
  target: ObservationTarget;
  priority: ObservationPriority;
  status: ObservationStatus;
  description: string;
  suggested_deadline: string | null;
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

export interface PartUsed {
  id: string;
  work_order_id: string;
  part_code: string | null;
  part_name: string;
  quantity: number;
  unit: string;
}

export interface Photo {
  id: string;
  work_order_id: string;
  storage_path: string;
  caption: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}
