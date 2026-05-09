import { useEffect } from 'react';
import { X } from 'lucide-react';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-xl font-semibold">Como o score de oportunidade funciona</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Um número de 0 a 100 que combina sinais de 3 fontes complementares.
        </p>

        <Section title="As 3 fontes">
          <ul className="space-y-3">
            <Item
              dot="bg-blue-500"
              title="Scraping próprio"
              desc="Lê os top 10 do YouTube pra estimar concorrência (qualidade dos canais que ranqueiam), frescor (idade média dos vídeos) e saturação (quantos têm muitas views)."
            />
            <Item
              dot="bg-emerald-500"
              title="Keywords Everywhere"
              desc="Volume real mensal de busca, CPC e dificuldade SEO. Cobra por crédito usado."
            />
            <Item
              dot="bg-violet-500"
              title="Google Trends"
              desc="Sinal de tendência temporal — se o tema está subindo, estável ou caindo. Sem chave, mas com rate limit."
            />
          </ul>
        </Section>

        <Section title="Componentes do score">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Cada componente vai a 0-100 e é combinado com um peso. Componentes "negativos"
            (concorrência, saturação, idade) são invertidos antes de entrar no cálculo.
          </p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="py-1">Componente</th>
                <th>Fonte</th>
                <th className="text-right">Peso padrão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              <Row name="Volume" source="KE" weight="25%" />
              <Row name="Tendência" source="Trends" weight="20%" />
              <Row name="Concorrência" source="Scraping" weight="25%" />
              <Row name="Frescor dos top" source="Scraping" weight="15%" />
              <Row name="Saturação" source="Scraping" weight="15%" />
            </tbody>
          </table>
        </Section>

        <Section title="Quando uma fonte falha">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Os componentes da fonte caída são removidos e os pesos das remanescentes são
            <b> renormalizados</b> para somar 100%. O score continua entre 0 e 100, comparável
            entre buscas — mas com a nota de "renormalizado" no card.
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Você pode desligar fontes manualmente em <b>Configurações → Fontes de palavras-chave</b>
            (útil pra economizar créditos da Keywords Everywhere ou contornar rate limits do Trends).
          </p>
        </Section>

        <Section title="Cache">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Buscas são cacheadas por 30 minutos. Pra forçar re-consulta sem esperar, use o
            botão <b>Atualizar</b> no card do resultado.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Item({ dot, title, desc }: { dot: string; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{desc}</p>
      </div>
    </li>
  );
}

function Row({ name, source, weight }: { name: string; source: string; weight: string }) {
  return (
    <tr>
      <td className="py-1.5 text-sm">{name}</td>
      <td className="py-1.5 text-xs text-zinc-500">{source}</td>
      <td className="py-1.5 text-right text-sm font-medium">{weight}</td>
    </tr>
  );
}
