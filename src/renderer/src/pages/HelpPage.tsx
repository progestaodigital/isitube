import { useState, type ReactNode } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Lock,
  Database,
  Tv,
  Sprout,
  Lightbulb,
  Wand2,
  KeyRound,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useRouterStore } from '../stores/router';

interface Section {
  id: string;
  title: string;
  icon: typeof Tv;
  body: ReactNode;
}

export function HelpPage() {
  const navigate = useRouterStore((s) => s.navigate);
  const sections = useSections(navigate);
  const [open, setOpen] = useState<Set<string>>(new Set(['app']));

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ajuda</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Como o app funciona, custos das APIs, onde seus dados vivem.
        </p>
      </header>

      <div className="space-y-3">
        {sections.map((s) => {
          const isOpen = open.has(s.id);
          return (
            <Card key={s.id} className="p-0 overflow-hidden">
              <button
                onClick={() => toggle(s.id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-semibold">{s.title}</h2>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                )}
              </button>
              {isOpen && (
                <div className="border-t border-zinc-200 bg-zinc-50/50 px-5 py-4 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
                  {s.body}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function useSections(navigate: (view: import('../stores/router').View) => void): Section[] {
  return [
    {
      id: 'app',
      title: 'Sobre o isiTube',
      icon: HelpCircle,
      body: (
        <div className="space-y-2">
          <P>
            Software desktop de inteligência competitiva e planejamento de conteúdo para
            criadores no YouTube. Tudo roda local — seus dados ficam no seu computador.
          </P>
          <P>
            Stack: Electron + React + Prisma + SQLite. APIs externas (YouTube, Anthropic,
            Keywords Everywhere, Google Trends) são chamadas direto do seu app pros provedores,
            usando suas próprias chaves (BYOK = Bring Your Own Key).
          </P>
          <P>
            Parte do ecossistema isi (Instaisi, Masterisi, Isiflow, IsiPanel).
          </P>
        </div>
      ),
    },
    {
      id: 'channels',
      title: 'Canais e detecção de outliers',
      icon: Tv,
      body: (
        <div className="space-y-2">
          <P>
            "Outlier" = vídeo que rendeu <b>significativamente acima da média recente</b> do
            canal. Útil pra identificar o que está performando bem AGORA.
          </P>
          <P>
            <b>Cálculo:</b> média de views dos vídeos publicados nos últimos N dias (default 30).
            Vídeo cuja view count for ≥ X% dessa média (default 150%) é sinalizado.
          </P>
          <UL>
            <LI>
              <b>Threshold</b> e <b>janela de coleta (lookback)</b> são ajustáveis em{' '}
              <Link onClick={() => navigate('settings')}>Configurações → Canais</Link>.
            </LI>
            <LI>
              Janela maior (90/180 dias) = média mais estável, menos sensível a picos isolados.
            </LI>
            <LI>
              Threshold maior (200%/300%) = só destaca os vídeos que <b>realmente</b> estouraram.
            </LI>
          </UL>
        </div>
      ),
    },
    {
      id: 'evergreen',
      title: 'Evergreen — vídeos perenes',
      icon: Sprout,
      body: (
        <div className="space-y-2">
          <P>
            Evergreen = vídeo antigo que <b>continua ganhando views</b> ao longo do tempo. O
            oposto do conteúdo descartável.
          </P>
          <P>
            <b>Cálculo:</b> diferença entre views totais em snapshots consecutivos, dividido
            pelos dias entre eles = views/dia. Quando há ≥ 2 snapshots na janela, usa snapshots;
            quando há só 1 (ou nenhum), cai pra média all-time (views totais ÷ idade do vídeo).
          </P>
          <P>
            <b>Filtros padrão:</b> vídeo precisa ter ≥ 30 dias de idade (descarta o que ainda
            tá "trending") e ≥ 1 view/dia recente.
          </P>
          <UL>
            <LI>
              Aparece em <Link onClick={() => navigate('channels')}>Canais → tab Evergreen</Link>{' '}
              e nas <Link onClick={() => navigate('keywords')}>Sugestões de palavras-chave</Link>.
            </LI>
            <LI>
              Quanto mais "Atualizar agora" você fizer ao longo do tempo, mais preciso o cálculo
              (snapshots reais &gt; média all-time).
            </LI>
          </UL>
        </div>
      ),
    },
    {
      id: 'keywords-score',
      title: 'Score de oportunidade (palavras-chave)',
      icon: Lightbulb,
      body: (
        <div className="space-y-2">
          <P>
            Cada keyword pesquisada recebe um score 0-100 que combina sinais de 3 fontes
            independentes:
          </P>
          <table className="mt-2 w-full text-xs">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-1">Componente</th>
                <th>Fonte</th>
                <th>Peso</th>
                <th>Sentido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              <tr><td className="py-1.5">Volume mensal</td><td>Keywords Everywhere</td><td>25%</td><td>maior = melhor</td></tr>
              <tr><td className="py-1.5">Tendência</td><td>Google Trends</td><td>20%</td><td>subindo = melhor</td></tr>
              <tr><td className="py-1.5">Concorrência</td><td>Scraping (top 10)</td><td>25%</td><td>menor = melhor</td></tr>
              <tr><td className="py-1.5">Frescor dos top</td><td>Scraping (top 10)</td><td>15%</td><td>mais novo = melhor</td></tr>
              <tr><td className="py-1.5">Saturação</td><td>Scraping (top 10)</td><td>15%</td><td>menos saturado = melhor</td></tr>
            </tbody>
          </table>
          <P>
            <b>Renormalização dinâmica:</b> quando uma fonte falha (rate limit, sem chave, erro),
            os componentes dela saem do cálculo e os pesos das outras são reescalados pra somar
            100%. O score continua entre 0 e 100, comparável entre buscas — mas fica marcado
            "Score renormalizado" no card.
          </P>
        </div>
      ),
    },
    {
      id: 'suggestions',
      title: 'Sugestões de palavras-chave',
      icon: Wand2,
      body: (
        <div className="space-y-2">
          <P>
            Mineração offline a partir do seu próprio banco — <b>sem IA, sem custo</b>. Pega
            tags e títulos dos vídeos e ranqueia por frequência.
          </P>
          <UL>
            <LI><b>Em destaque:</b> palavras que aparecem em vídeos sinalizados como outlier.</LI>
            <LI><b>Evergreen:</b> palavras que aparecem em vídeos perenes.</LI>
            <LI>Tags vêm do YouTube (precisa do botão "Extrair informações" no vídeo).</LI>
            <LI>Títulos são tokenizados em 1-3 palavras, removendo stopwords pt-BR + en.</LI>
            <LI>Click numa sugestão dispara a pesquisa completa com as 3 fontes do score.</LI>
          </UL>
        </div>
      ),
    },
    {
      id: 'youtube-quota',
      title: 'Quota da YouTube Data API',
      icon: Activity,
      body: (
        <div className="space-y-2">
          <P>
            Cota gratuita: <b>10.000 unidades/dia</b>. Reseta às 00:00 PT (4h da manhã no horário
            de Brasília aproximadamente).
          </P>
          <P>
            Custos por operação no isiTube:
          </P>
          <UL>
            <LI>Cadastrar canal por handle/URL: <b>1-3 unidades</b> (1 lookup + às vezes 1 search)</LI>
            <LI>Atualizar 1 canal: <b>~101 unidades</b> (1 channels.list + 100 search.list + 1 videos.list)</LI>
            <LI>Extrair metadata de 1 vídeo: <b>1 unidade</b></LI>
            <LI>Validar a chave (botão "Testar conexão"): <b>1 unidade</b></LI>
          </UL>
          <P>
            <b>Conta prática:</b> com 5 canais cadastrados, dá pra atualizar ~19 vezes por dia.
            Geralmente 1-2 atualizações diárias é mais que suficiente, sobra cota pra extrair
            metadata de muitos vídeos.
          </P>
        </div>
      ),
    },
    {
      id: 'other-apis',
      title: 'Custos das outras APIs',
      icon: KeyRound,
      body: (
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold">Anthropic Claude</h3>
            <UL>
              <LI>US$ 5 prepago dura semanas de uso normal.</LI>
              <LI>Validar chave: ~US$ 0.0001 (1 token Haiku).</LI>
              <LI>Gerar 5 ideias: ~US$ 0.01-0.05 dependendo do modelo (Sonnet 4.6 padrão).</LI>
            </UL>
          </div>
          <div>
            <h3 className="font-semibold">Keywords Everywhere</h3>
            <UL>
              <LI>Não tem plano gratuito recorrente.</LI>
              <LI>Mínimo: <b>US$10 = 100.000 créditos</b>. 1 keyword pesquisada = 1 crédito.</LI>
              <LI>Sem KE, o app cai no mock pra esse componente do score (degradação graciosa).</LI>
            </UL>
          </div>
          <div>
            <h3 className="font-semibold">Google Trends</h3>
            <UL>
              <LI>Gratuito, sem chave.</LI>
              <LI>Tem rate limit agressivo — se rodar muitas pesquisas seguidas, pode dar 429.</LI>
              <LI>Quando dá 429, o componente "Tendência" cai pra status `error` e o score se renormaliza.</LI>
            </UL>
          </div>
        </div>
      ),
    },
    {
      id: 'data',
      title: 'Onde seus dados vivem',
      icon: Database,
      body: (
        <div className="space-y-2">
          <P>
            <b>Banco SQLite</b> em <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">%APPDATA%\isiTube\data.db</code> (no Windows). Contém todos os canais, vídeos, transcrições, palavras-chave pesquisadas, configurações e snapshots históricos.
          </P>
          <P>
            <b>Chaves de API</b> são criptografadas com o <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">safeStorage</code> do Electron (DPAPI no Windows) antes de irem pro banco. A chave em texto claro só existe na memória do main process quando precisa fazer uma chamada.
          </P>
          <P>
            <b>Prompts da IA</b> ficam em arquivos <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">.md</code> dentro do app — você pode editar depois sem rebuild (Fase 7+).
          </P>
          <P>
            Backup recomendado: copia o arquivo <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">data.db</code> periodicamente.
          </P>
        </div>
      ),
    },
    {
      id: 'privacy',
      title: 'Privacidade e segurança',
      icon: Lock,
      body: (
        <div className="space-y-2">
          <UL>
            <LI><b>BYOK:</b> você usa suas próprias chaves de API. Nada passa por servidor intermediário do isiTube.</LI>
            <LI><b>Chaves nunca expostas no front-end:</b> toda chamada de API roda no main process (Node.js do Electron). O renderer (UI) só fala via IPC tipado.</LI>
            <LI><b>Sem telemetria:</b> o app não coleta nem envia nada sobre seu uso.</LI>
            <LI><b>Sem coleta centralizada:</b> seus dados (canais monitorados, transcrições, configurações) não saem da sua máquina.</LI>
            <LI><b>Cumpre LGPD por design:</b> processamento local, dado pessoal mínimo (só sua licença é validada com o IsiPanel).</LI>
          </UL>
        </div>
      ),
    },
    {
      id: 'limitations',
      title: 'Limitações conhecidas',
      icon: AlertTriangle,
      body: (
        <div className="space-y-2">
          <UL>
            <LI><b>Trends rate-limita.</b> Se você fizer muitas pesquisas seguidas de keyword, o componente Trends pode falhar temporariamente. Espera ~30s entre pesquisas pra evitar.</LI>
            <LI><b>Scraping pode quebrar.</b> Top 10 do SERP e transcrições dependem do HTML do YouTube. Se o YouTube redesenhar, as libs de extração podem precisar de update.</LI>
            <LI><b>Vídeos sem legenda nativa</b> retornam "transcrição indisponível" — Whisper como fallback automático fica pra v2.</LI>
            <LI><b>Em primeiro uso,</b> os gráficos de Comparativo ficam vazios até você ter ≥ 2 snapshots (ou seja, 2 atualizações em dias diferentes).</LI>
            <LI><b>Atalhos de teclado:</b> ainda não implementados.</LI>
          </UL>
        </div>
      ),
    },
  ];
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

function LI({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

function Link({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-medium text-red-600 hover:underline dark:text-red-400"
    >
      {children}
    </button>
  );
}
