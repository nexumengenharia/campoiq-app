import { MonthExporter } from '@/components/MonthExporter';

export const dynamic = 'force-dynamic';

export default function ExportarPage() {
  return (
    <>
      <h2 className="text-xl font-bold mb-1">Exportar Dados</h2>
      <p className="text-xs text-slate-500 mb-4">
        Baixe todas as OMs, observacoes e dados do mes selecionado em arquivo CSV (abre no Excel).
      </p>
      <MonthExporter />
    </>
  );
}
