'use client';

import { useMemo, useState } from 'react';
import { FLEET_ICONS, STATUS_DOT, STATUS_CLASS, STATUS_LABEL } from '@/lib/constants';
import type { Asset, Fleet, WorkOrder, WoStatus } from '@/lib/types';
import { AssetHistoryModal } from './AssetHistoryModal';

type Props = {
  assets: (Asset & { fleet: Fleet })[];
  activeWOs: Pick<WorkOrder, 'id' | 'asset_id' | 'status' | 'om_number'>[];
};

type EffectiveStatus = WoStatus | 'OPERANDO';

const EFFECTIVE_LABEL: Record<EffectiveStatus, string> = {
  OPERANDO: 'Operando',
  ...STATUS_LABEL,
};

const EFFECTIVE_CLASS: Record<EffectiveStatus, string> = {
  OPERANDO: 'bg-green-50 text-green-900 border-green-300',
  ...STATUS_CLASS,
};

const EFFECTIVE_DOT: Record<EffectiveStatus, string> = {
  OPERANDO: 'bg-green-500',
  ...STATUS_DOT,
};

export function FleetMap({ assets, activeWOs }: Props) {
  const [selected, setSelected] = useState<Asset | null>(null);

  const statusByAsset = useMemo(() => {
    const map = new Map<string, EffectiveStatus>();
    assets.forEach((a) => map.set(a.id, 'OPERANDO'));
    const prio: Record<EffectiveStatus, number> = {
      OPERANDO: 0,
      CONCLUIDO: 0,
      PENDENTE: 2,
      EM_EXECUCAO: 3,
      AGUARDANDO_PECA: 4,
    };
    activeWOs.forEach((wo) => {
      const curr = map.get(wo.asset_id) || 'OPERANDO';
      if ((prio[wo.status] || 0) > (prio[curr] || 0)) {
        map.set(wo.asset_id, wo.status as EffectiveStatus);
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
        {(['OPERANDO', 'EM_EXECUCAO', 'AGUARDANDO_PECA', 'PENDENTE'] as EffectiveStatus[]).map((s) => (
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
                <span className="w-6 h-4 text-slate-500" dangerouslySetInnerHTML={{ __html: icon }} />
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
                      className={`text-left border-2 rounded-lg p-3 transition-transform hover:-translate-y-0.5 ${EFFECTIVE_CLASS[status]}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-bold text-sm">{eq.tag}</span>
                        <span className={`w-2.5 h-2.5 rounded-full ${EFFECTIVE_DOT[status]}`} />
                      </div>
                      <div
                        className="w-full h-10 mb-1 opacity-80"
                        dangerouslySetInnerHTML={{ __html: FLEET_ICONS[eq.fleet?.code || ''] || '' }}
                      />
                      <div className="text-[10px] font-medium uppercase tracking-wide">
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
