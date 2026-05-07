import type { WoStatus, ObservationType, ObservationTarget, ObservationPriority, Shift, MaintenanceType } from './types';

// =============================================================================
// Turnos (4 turnos: A, B, C, D)
// =============================================================================
export const SHIFTS: Shift[] = ['A', 'B', 'C', 'D'];

export const SHIFT_LABEL: Record<Shift, string> = {
  A: 'Turno A',
  B: 'Turno B',
  C: 'Turno C',
  D: 'Turno D',
};

// Janelas padrao de 6h por turno (ajuste se a operacao usar outro horario)
//   A: 06:00 - 12:00
//   B: 12:00 - 18:00
//   C: 18:00 - 00:00
//   D: 00:00 - 06:00
export function inferShift(d: Date = new Date()): Shift {
  const h = d.getHours();
  if (h >= 6  && h < 12) return 'A';
  if (h >= 12 && h < 18) return 'B';
  if (h >= 18 && h < 24) return 'C';
  return 'D'; // 00:00 - 06:00
}

// =============================================================================
// Tipo de manutencao
// =============================================================================
export const MAINT_TYPE_LABEL: Record<MaintenanceType, string> = {
  CORRETIVA:  'Corretiva',
  PREVENTIVA: 'Preventiva',
};

export const MAINT_TYPE_CLASS: Record<MaintenanceType, string> = {
  CORRETIVA:  'bg-red-100 text-red-900 border-red-300',
  PREVENTIVA: 'bg-blue-100 text-blue-900 border-blue-300',
};

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

// SVGs dos icones de frota (estilo tecnico simples - viewBox 64x40)
export const FLEET_ICONS: Record<string, string> = {
  // Caminhao Fora de Estrada (CAT 777) - cacamba alta + 4 rodas
  caminhao_fe: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><path d="M4 28 L4 20 L18 14 L42 14 L48 20 L58 20 L60 28 Z"/><circle cx="14" cy="32" r="5" fill="#1f2937"/><circle cx="14" cy="32" r="2" fill="currentColor"/><circle cx="48" cy="32" r="5" fill="#1f2937"/><circle cx="48" cy="32" r="2" fill="currentColor"/><rect x="20" y="8" width="20" height="8" fill="#475569" opacity="0.3"/></g></svg>`,

  // Carregadeira (Wheel Loader CAT 988) - 4 rodas grandes + caçamba frontal
  carregadeira: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="14" y="20" width="30" height="10" rx="2"/><circle cx="20" cy="32" r="5" fill="#1f2937"/><circle cx="20" cy="32" r="2" fill="currentColor"/><circle cx="40" cy="32" r="5" fill="#1f2937"/><circle cx="40" cy="32" r="2" fill="currentColor"/><rect x="20" y="10" width="18" height="10" rx="2"/><path d="M44 18 L58 22 L58 30 L50 28 Z"/><path d="M58 22 L62 24 L62 30 L58 30 Z"/></g></svg>`,

  // Escavadeira (CAT 395) - esteira + cabine + lança/concha
  escavadeira: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="8" y="28" width="44" height="6" rx="2"/><circle cx="14" cy="31" r="3" fill="#1f2937"/><circle cx="30" cy="31" r="3" fill="#1f2937"/><circle cx="46" cy="31" r="3" fill="#1f2937"/><rect x="18" y="18" width="20" height="10" rx="2"/><path d="M38 20 L52 10 L58 16 L54 22 Z"/><path d="M54 22 L60 28 L52 30 Z"/></g></svg>`,

  // Escavadeira de Braco Longo (long-reach) - lança bem mais longa
  escavadeira_braco_longo: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="4" y="30" width="38" height="5" rx="2"/><circle cx="10" cy="32" r="2.5" fill="#1f2937"/><circle cx="22" cy="32" r="2.5" fill="#1f2937"/><circle cx="36" cy="32" r="2.5" fill="#1f2937"/><rect x="14" y="22" width="16" height="8" rx="2"/><path d="M28 24 L62 6 L64 10 L30 28 Z"/><path d="M60 6 L62 4 L64 6 L62 8 Z" fill="#1f2937"/></g></svg>`,

  // Motoniveladora (Grader CAT 16M) - longo, lâmina central
  motoniveladora: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="2" y="22" width="14" height="6" rx="1"/><rect x="40" y="20" width="22" height="10" rx="2"/><circle cx="6" cy="30" r="3" fill="#1f2937"/><circle cx="12" cy="30" r="3" fill="#1f2937"/><circle cx="48" cy="32" r="3.5" fill="#1f2937"/><circle cx="58" cy="32" r="3.5" fill="#1f2937"/><rect x="16" y="20" width="24" height="3" /><path d="M22 24 L40 24 L40 32 L22 32 Z" fill="#475569" opacity="0.6"/><rect x="44" y="10" width="14" height="10" rx="2"/></g></svg>`,

  // Retroescavadeira (Backhoe CAT 416) - rodas + concha frontal + braço traseiro
  retroescavadeira: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="14" y="22" width="22" height="8" rx="2"/><circle cx="18" cy="32" r="3" fill="#1f2937"/><circle cx="32" cy="32" r="4.5" fill="#1f2937"/><circle cx="32" cy="32" r="1.5" fill="currentColor"/><rect x="20" y="14" width="14" height="8" rx="2"/><path d="M2 22 L14 24 L14 30 L4 28 Z"/><path d="M36 24 L52 14 L58 18 L40 28 Z"/><path d="M50 18 L60 14 L62 18 L52 22 Z" fill="#1f2937"/></g></svg>`,

  // Trator de Esteira (Bulldozer D8R/D6T) - esteira + lâmina frontal grande
  trator_esteira: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="4" y="24" width="48" height="10" rx="5"/><circle cx="12" cy="29" r="3" fill="#1f2937"/><circle cx="30" cy="29" r="3" fill="#1f2937"/><circle cx="48" cy="29" r="3" fill="#1f2937"/><rect x="14" y="12" width="24" height="12" rx="2"/><path d="M38 16 L52 16 L54 24 L38 24 Z"/><path d="M2 18 L8 14 L8 28 L2 28 Z"/></g></svg>`,

  // Trator Agricola (Scraper) - cabine compacta + carreta com lâmina
  trator_agricola: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="4" y="22" width="14" height="8" rx="1"/><circle cx="9" cy="32" r="3" fill="#1f2937"/><circle cx="14" cy="32" r="2.5" fill="#1f2937"/><rect x="6" y="14" width="10" height="8" rx="1"/><rect x="18" y="24" width="6" height="2"/><rect x="24" y="20" width="34" height="12" rx="2"/><path d="M58 22 L62 24 L62 30 L58 30 Z" fill="#1f2937"/><circle cx="32" cy="32" r="3.5" fill="#1f2937"/><circle cx="50" cy="32" r="3.5" fill="#1f2937"/><rect x="28" y="18" width="22" height="3" fill="#475569" opacity="0.6"/></g></svg>`,

  // Trator de Pneu (Wheel Dozer CAT 824H) - rodas grandes + lâmina frontal
  trator_pneu: `<svg viewBox="0 0 64 40" class="w-full h-full"><g fill="currentColor"><rect x="16" y="20" width="30" height="10" rx="2"/><circle cx="22" cy="32" r="5" fill="#1f2937"/><circle cx="22" cy="32" r="2" fill="currentColor"/><circle cx="42" cy="32" r="5" fill="#1f2937"/><circle cx="42" cy="32" r="2" fill="currentColor"/><rect x="22" y="10" width="18" height="10" rx="2"/><path d="M2 18 L8 14 L8 30 L2 30 Z"/><rect x="46" y="22" width="4" height="6"/></g></svg>`,
};
