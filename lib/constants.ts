import type { WoStatus, ObservationType, ObservationTarget, ObservationPriority } from './types';

export const STATUS_LABEL: Record<WoStatus, string> = {
  PENDENTE: 'Pendente',
  EM_EXECUCAO: 'Em Execucao',
  CONCLUIDO: 'Concluido',
  AGUARDANDO_PECA: 'Aguardando Peca',
};

export const STATUS_CLASS: Record<WoStatus, string> = {
  PENDENTE: 'bg-blue-100 text-blue-900 border-blue-300',
  EM_EXECUCAO: 'bg-amber-100 text-amber-900 border-amber-300',
  CONCLUIDO: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  AGUARDANDO_PECA: 'bg-orange-100 text-orange-900 border-orange-300',
};

export const STATUS_DOT: Record<WoStatus, string> = {
  PENDENTE: 'bg-blue-500',
  EM_EXECUCAO: 'bg-amber-500',
  CONCLUIDO: 'bg-indigo-500',
  AGUARDANDO_PECA: 'bg-orange-500',
};

export const OBSERVATION_TYPE_LABEL: Record<ObservationType, string> = {
  ARRANJO_TEMPORARIO: 'Arranjo Temporario',
  COMPONENTE_EM_RISCO: 'Componente em Risco',
  RECOMENDACAO_TROCA: 'Recomendacao de Troca',
  PENDENCIA_PCM: 'Pendencia PCM',
  PENDENCIA_INSPECAO: 'Pendencia Inspecao',
  PENDENCIA_ENGENHARIA: 'Pendencia Engenharia',
  OBSERVACAO_GERAL: 'Observacao Geral',
};

export const OBSERVATION_TARGET_LABEL: Record<ObservationTarget, string> = {
  PCM: 'PCM',
  INSPECAO: 'Inspecao',
  ENGENHARIA: 'Engenharia',
  MANUTENCAO: 'Manutencao',
  OPERACAO: 'Operacao',
  SUPRIMENTOS: 'Suprimentos',
};

export const OBSERVATION_PRIORITY_LABEL: Record<ObservationPriority, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Critica',
};

export const OBSERVATION_PRIORITY_CLASS: Record<ObservationPriority, string> = {
  BAIXA: 'bg-slate-100 text-slate-700',
  MEDIA: 'bg-yellow-100 text-yellow-800',
  ALTA: 'bg-orange-100 text-orange-800',
  CRITICA: 'bg-red-100 text-red-800',
};

export const SYMPTOMS = [
  'Vazamento externo',
  'Vazamento interno',
  'Perda de potencia',
  'Ruido anormal',
  'Vibracao excessiva',
  'Superaquecimento',
  'Folga mecanica',
  'Falha de partida',
  'Parada espuria',
  'Erro de instrumentacao',
];

export const CAUSES = [
  'Falha de montagem/instalacao',
  'Desgaste por uso',
  'Fadiga do material',
  'Corrosao',
  'Contaminacao do fluido',
  'Torque inadequado / folga',
  'Sobrecarga operacional',
  'Falha de lubrificacao',
  'Defeito de fabricacao',
  'Causa indeterminada',
];

export const INTERVENTIONS = [
  'Substituicao (Replace)',
  'Reparo (Repair)',
  'Ajuste / Reaperto (Adjust)',
  'Inspecao (Inspect)',
  'Lubrificacao (Service)',
  'Teste funcional (Test)',
  'Limpeza (Clean)',
  'Modificacao (Modify)',
];

// SVGs dos icones de frota (estilo tecnico simples)
export const FLEET_ICONS: Record<string, string> = {
  caminhao_fe: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><path d="M4 28 L4 20 L18 14 L42 14 L48 20 L58 20 L60 28 Z"/><circle cx="14" cy="32" r="5" fill="#1f2937"/><circle cx="14" cy="32" r="2" fill="currentColor"/><circle cx="48" cy="32" r="5" fill="#1f2937"/><circle cx="48" cy="32" r="2" fill="currentColor"/><rect x="20" y="8" width="20" height="8" fill="#475569" opacity="0.3"/></g></svg>`,
  escavadeira: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="8" y="28" width="44" height="6" rx="2"/><circle cx="14" cy="31" r="3" fill="#1f2937"/><circle cx="30" cy="31" r="3" fill="#1f2937"/><circle cx="46" cy="31" r="3" fill="#1f2937"/><rect x="18" y="18" width="20" height="10" rx="2"/><path d="M38 20 L52 10 L58 16 L54 22 Z"/><path d="M54 22 L60 28 L52 30 Z"/></g></svg>`,
  trator_esteira: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="4" y="24" width="52" height="10" rx="5"/><circle cx="12" cy="29" r="3" fill="#1f2937"/><circle cx="30" cy="29" r="3" fill="#1f2937"/><circle cx="48" cy="29" r="3" fill="#1f2937"/><rect x="14" y="12" width="24" height="12" rx="2"/><path d="M38 16 L56 16 L58 24 L38 24 Z"/><path d="M2 22 L8 18 L8 28 L2 28 Z"/></g></svg>`,
  pa_carregadeira: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="14" y="20" width="30" height="10" rx="2"/><circle cx="20" cy="32" r="5" fill="#1f2937"/><circle cx="20" cy="32" r="2" fill="currentColor"/><circle cx="40" cy="32" r="5" fill="#1f2937"/><circle cx="40" cy="32" r="2" fill="currentColor"/><rect x="20" y="10" width="18" height="10" rx="2"/><path d="M44 18 L58 22 L58 30 L50 28 Z"/><path d="M58 22 L62 24 L62 30 L58 30 Z"/></g></svg>`,
  perfuratriz: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="8" y="28" width="40" height="6" rx="2"/><circle cx="16" cy="31" r="3" fill="#1f2937"/><circle cx="40" cy="31" r="3" fill="#1f2937"/><rect x="18" y="18" width="16" height="10" rx="2"/><rect x="34" y="2" width="4" height="26"/><rect x="32" y="2" width="8" height="4"/></g></svg>`,
};
