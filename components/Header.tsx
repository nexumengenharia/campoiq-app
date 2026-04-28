'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Kanban, PlusSquare, FileText, ClipboardList, History, Download } from 'lucide-react';

const tabs = [
  { href: '/',            label: 'Mapa da Frota',   Icon: Map },
  { href: '/kanban',      label: 'Kanban de Turno', Icon: Kanban },
  { href: '/nova',        label: 'Nova Atividade',  Icon: PlusSquare },
  { href: '/historico',   label: 'Historico',       Icon: History },
  { href: '/observacoes', label: 'Observacoes',     Icon: ClipboardList },
  { href: '/relatorio',   label: 'Relatorio',       Icon: FileText },
  { href: '/exportar',    label: 'Exportar',        Icon: Download },
];

export function Header() {
  const pathname = usePathname();
  const today = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date());

  return (
    <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-lg no-print">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center font-bold text-base">
            GRD
          </div>
          <div>
            <div className="font-bold text-lg leading-none">Passagem de Turno</div>
            <div className="text-xs text-slate-400">GRD - Manutencao</div>
          </div>
        </Link>
        <div className="text-xs text-slate-400 hidden sm:block">{today}</div>
      </div>
      <nav className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap flex items-center gap-2 ${
                active ? 'bg-slate-50 text-slate-900' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
