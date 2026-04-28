'use client';

import { useMemo, useState } from 'react';
import { FLEET_ICONS, STATUS_DOT, STATUS_CLASS, STATUS_LABEL } from '@/lib/constants';
import type { Asset, Fleet, WorkOrder, WoStatus } from '@/lib/types';
import { AssetHistoryModal } from './AssetHistoryModal';

type Props = {
  assets: (Asset & { fleet: Fleet })[];
  activeWOs: Pick<WorkOrder, 'id' | 'asset_id' | 'status' | 'om_number'>[];
};

// Visual: agrupamos PENDENTE + EM_EXECUCAO em "Em Manutencao" no Mapa.
// (Os status detalhados continuam disponiveis no Kanban e nas outras telas.)
type EffectiveStatus = 'OPERANDO' | 'EM_MANUTENCAO' | 'AGUARDANDO_PECA';

const EFFECTIVE_LABEL: Record<EffectiveStatus, string> = {
  OPERANDO: 'Operando',
  EM_MANUTENCAO: 'Em Manutencao',
  AGUARDANDO_PECA: 'Aguardando Peca',
};

const EFFECTIVE_CLASS: Record<EffectiveStatus, string> = {
  OPERANDO: 'bg-green-50 text-green-900 border-green-300',
  EM_MANUTENCAO: 'bg-amber-50 text-amber-900 border-amber-300',
  AGUARDANDO_PECA: 'bg-orange-50 text-orange-900 border-orange-300',
};

const EFFECTIVE_DOT: Record<EffectiveStatus, string> = {
  OPERANDO: 'bg-green-500',
  EM_MANUTENCAO: 'bg-amber-500',
  AGUARDANDO_PECA: 'bg-orange-500',
};

function mapToEffective(s: WoStatus | undefined): EffectiveStatus {
  if (s === 'AGUARDANDO_PECA') return 'AGUARDANDO_PECA';
  if (s === 'PENDENTE' || s === 'EM_EXECUCAO') return 'EM_MANUTENCAO';
  return 'OPERANDO';
}

export function FleetMap({ assets, activeWOs }: Props) {
  const [selected, setSelected] = useState<Asset | null>(null);

  const statusByAsset = useMemo(() => {
    const map = new Map<string, EffectiveStatus>();
    assets.forEach((a) => map.set(a.id, 'OPERANDO'));
    const prio: Record<EffectiveStatus, number> = {
      OPERANDO: 0,
      EM_MANUTENCAO: 2,
      AGUARDANDO_PECA: 3,
    };
    activeWOs.forEach((wo) => {
      const eff = mapToEffective(wo.status as WoStatus);
      const curr = map.get(wo.asset_id) || 'OPERANDO';
      if (prio[eff] > prio[curr]) {
        map.set(wo.asset_id, eff);
      }
    });
    return map;
  }, [assets, activeWOs]);

  const byFleet = useMemo(() => {
    const groups: Record<string, (Asset & { fleet: Fleet })[]> = {};
    assets.forEach((a) => {
      const code = a.fleet?.code || 'outros';
      if (!groups[code]) groups[code] = [];
      groups[code].push(a);
    });
    return groups;
  }, [assets]);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        {(['OPERANDO', 'EM_MANUTENCAO', 'AGUARDANDO_PECA'] as EffectiveStatus[]).map((s) => (
          <span key={s} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${EFFECTIVE_CLASS[s]}`}>
            <span className={`w-2 h-2 rounded-full ${EFFECTIVE_DOT[s]}`} />
            {EFFECTIVE_LABEL[s]}
          </span>
        ))}
      </div>

      <div className="space-y-6">
        {Object.entries(byFleet).map(([code, items]) => {
          const fleetName = items[0]?.fleet?.name || code;
          const icon = FLEET_ICONS[code] || '';
          return (
            <div key={code}>
              <h3 className="font-semibold text-slate-700 text-sm mb-2 flex items-center gap-2">
                <span className="w-6 h-4 text-slate-500 flex-shrink-0" dangerouslySetInnerHTML={{ __html: icon }} />
                {fleetName}
                <span className="text-xs text-slate-400 font-normal">({items.length} ativos)</span>
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {items.map((eq) => {
                  const status = statusByAsset.get(eq.id) || 'OPERANDO';
                  return (
                    <button
                      key={eq.id}
                      onClick={() => setSelected(eq)}
                      className={`flex flex-col items-stretch text-left border-2 rounded-lg p-2 h-[112px] transition-transform hover:-translate-y-0.5 ${EFFECTIVE_CLASS[status]}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-bold text-sm leading-none">{eq.tag}</span>
                        <span className={`w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 ${EFFECTIVE_DOT[status]}`} />
                      </div>
                      <div className="flex-1 flex items-center justify-center min-h-0 my-1">
                        <div
                          className="w-full h-10 opacity-80 flex items-center justify-center"
                          dangerouslySetInnerHTML={{ __html: FLEET_ICONS[eq.fleet?.code || ''] || '' }}
                        />
                      </div>
                      <div className="text-[10px] font-medium uppercase tracking-wide leading-tight text-center">
                        {EFFECTIVE_LABEL[status]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AssetHistoryModal
        asset={selected as (Asset & { fleet?: Fleet }) | null}
        currentStatus={selected ? statusByAsset.get(selected.id) || 'OPERANDO' : 'OPERANDO'}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
