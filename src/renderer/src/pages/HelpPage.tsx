import { type ReactNode } from 'react';
import {
  HelpCircle,
  Lock,
  Database,
  Tv,
  Sprout,
  Lightbulb,
  Wand2,
  KeyRound,
  Activity,
  AlertTriangle,
  Sparkles,
  Crown,
  Github,
  Youtube,
  Tag,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { cn } from '../lib/cn';
import { useRouterStore } from '../stores/router';
import { useHelpStore, type HelpTopic } from '../stores/help';

interface TopicDef {
  id: HelpTopic;
  title: string;
  icon: typeof Tv;
  body: (navigate: (v: 'home' | 'settings' | 'keywords' | 'channels') => void) => ReactNode;
}

interface TopicGroup {
  title: string;
  items: TopicDef[];
}

export function HelpPage() {
  const navigate = useRouterStore((s) => s.navigate);
  const topic = useHelpStore((s) => s.topic);
  const setTopic = useHelpStore((s) => s.setTopic);
  const groups = useTopicGroups();

  const all = groups.flatMap((g) => g.items);
  const current = all.find((t) => t.id === topic) ?? all[0]!;
  const Icon = current.icon;

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-6 py-8">
      {/* Sidebar de tópicos */}
      <aside className="sticky top-8 w-64 shrink-0 self-start space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">Ajuda</h1>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            Tutoriais e documentação do isiTube.
          </p>
        </header>

        <nav className="space-y-4 text-sm">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.id === topic;
                  const ItemIcon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setTopic(item.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                          active
                            ? 'bg-red-50 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400'
                            : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                        )}
                      >
                        <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Conteúdo do tópico ativo */}
      <main className="min-w-0 flex-1">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">{current.title}</h2>
          </div>
          <div className="prose max-w-none text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {current.body((v) => navigate(v))}
          </div>
        </Card>
      </main>
    </div>
  );
}

// ============================================================================
// Tópicos
// ============================================================================

function useTopicGroups(): TopicGroup[] {
  return [
    {
      title: 'Começando',
      items: [
        { id: 'getting-started', title: 'Primeiros passos', icon: Sparkles, body: GettingStarted },
        { id: 'plans', title: 'Iniciante vs Pro', icon: Crown, body: Plans },
      ],
    },
    {
      title: 'Como gerar suas chaves',
      items: [
        { id: 'api-anthropic', title: 'Anthropic Claude', icon: Wand2, body: ApiAnthropic },
        { id: 'api-youtube', title: 'YouTube Data API', icon: Youtube, body: ApiYoutube },
        { id: 'api-ke', title: 'Keywords Everywhere', icon: Tag, body: ApiKeywordsEverywhere },
        { id: 'api-github-pat', title: 'GitHub (Backup)', icon: Github, body: ApiGithub },
      ],
    },
    {
      title: 'Como o isiTube funciona',
      items: [
        { id: 'channels-outliers', title: 'Canais e outliers', icon: Tv, body: ChannelsOutliers },
        { id: 'evergreen', title: 'Vídeos evergreen', icon: Sprout, body: Evergreen },
        { id: 'keyword-score', title: 'Score de oportunidade', icon: Lightbulb, body: KeywordScore },
        { id: 'keyword-suggestions', title: 'Sugestões de keywords', icon: Wand2, body: KeywordSuggestions },
      ],
    },
    {
      title: 'Custos e cotas',
      items: [
        { id: 'youtube-quota', title: 'Quota YouTube', icon: Activity, body: YoutubeQuota },
        { id: 'other-api-costs', title: 'Custos das APIs', icon: KeyRound, body: OtherApiCosts },
      ],
    },
    {
      title: 'Privacidade e dados',
      items: [
        { id: 'data-location', title: 'Onde seus dados vivem', icon: Database, body: DataLocation },
        { id: 'privacy', title: 'Privacidade e segurança', icon: Lock, body: Privacy },
        { id: 'limitations', title: 'Limitações conhecidas', icon: AlertTriangle, body: Limitations },
      ],
    },
  ];
}

// ============================================================================
// Conteúdo de cada tópico
// ============================================================================

type Nav = (v: 'home' | 'settings' | 'keywords' | 'channels') => void;

function GettingStarted(navigate: Nav) {
  return (
    <Body>
      <P>
        Bem-vindo ao isiTube! Aqui vai um roteiro rápido pra você arrancar:
      </P>
      <Steps>
        <Step>
          <b>Cadastre sua licença</b> — quando você abre o app pela 1ª vez, aparece um modal pedindo
          a chave (formato <Code>ISI-XXXX-XXXX-XXXX-XXXX</Code>). Cole o que veio por email após a
          compra no Cakto. O app valida com o painel isipanel e libera todas as features.
        </Step>
        <Step>
          <b>Descubra qual plano você tem</b> — o chip no canto superior direito mostra{' '}
          <b>INICIANTE</b> ou <b>PRO</b>. Veja{' '}
          <TopicLink topic="plans">Iniciante vs Pro</TopicLink> pra entender a diferença.
        </Step>
        <Step>
          <b>Configure suas chaves de API (só Pro)</b> — vá em{' '}
          <Link onClick={() => navigate('settings')}>Configurações</Link> e cadastre Anthropic,
          YouTube Data API e (opcional) Keywords Everywhere. Tutoriais passo-a-passo nas seções
          abaixo. <i>No plano Iniciante, essas chaves vêm incluídas via proxy do isipanel — você
          não precisa criar conta em lugar nenhum.</i>
        </Step>
        <Step>
          <b>Cadastre seu(s) primeiro(s) canal(is)</b> — em{' '}
          <Link onClick={() => navigate('channels')}>Canais</Link>, clique "Adicionar canal" e cole
          a URL ou o @handle. O app importa o histórico de vídeos automaticamente.
        </Step>
        <Step>
          <b>Rode "Atualizar agora"</b> — vai buscar métricas atualizadas do YouTube. Faça isso 1-2
          vezes por dia (ou agende) pra que o app tenha dados pra detectar outliers e evergreen.
        </Step>
        <Step>
          <b>Explore palavras-chave</b> — em{' '}
          <Link onClick={() => navigate('keywords')}>Palavras-chave</Link>, gere ideias com AI
          (Pro) ou sem AI (autocomplete + Trends), clique numa ideia pra ver o score 0-100.
        </Step>
      </Steps>
      <P>
        Backup é altamente recomendado depois de você ter dados. Veja{' '}
        <TopicLink topic="api-github-pat">como gerar um Personal Access Token</TopicLink> pra
        configurar.
      </P>
    </Body>
  );
}

function Plans(_navigate: Nav) {
  return (
    <Body>
      <P>
        O isiTube tem dois planos. A diferença prática é <b>quem fornece as chaves de IA e
        YouTube</b>.
      </P>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PlanCard
          title="Iniciante"
          subtitle="Mais simples — chaves incluídas"
          color="amber"
          features={[
            'Você só precisa colar a licença, mais nada',
            'IA (Claude Haiku 4.5) incluído com cota mensal',
            'YouTube Data API incluído com cota diária',
            'Keywords Everywhere NÃO disponível',
            'Indicado pra quem quer começar rápido',
          ]}
        />
        <PlanCard
          title="Pro"
          subtitle="BYOK — você usa suas chaves"
          color="emerald"
          features={[
            'Você cria contas próprias na Anthropic, Google Cloud e (opcional) KE',
            'Qualquer modelo Claude (Opus, Sonnet, Haiku)',
            'YouTube Data API com a SUA cota Google (10k/dia free + paid)',
            'Keywords Everywhere com seus próprios créditos',
            'Sem cota imposta pelo isiTube — você paga direto pros provedores',
          ]}
        />
      </div>
      <P className="mt-4">
        <b>Como descobrir seu plano:</b> olhe o chip ao lado do avatar no Header, ou abra{' '}
        <b>Configurações → Licença</b>.
      </P>
      <P>
        <b>Quero migrar de Iniciante pra Pro:</b> compra o plano Pro no Cakto, recebe a chave nova,
        cola em <b>Configurações → Licença → Trocar chave</b>. O app detecta o slug novo
        automaticamente.
      </P>
    </Body>
  );
}

function ApiAnthropic(navigate: Nav) {
  return (
    <Body>
      <Pill color="emerald">Necessário só pro plano Pro</Pill>
      <P>
        A Anthropic é quem faz o modelo Claude. Você precisa de uma conta + créditos pré-pagos pra
        usar a IA do isiTube no plano Pro.
      </P>
      <Steps>
        <Step>
          <b>Crie sua conta na Anthropic.</b> Acesse{' '}
          <ExtLink href="https://console.anthropic.com">console.anthropic.com</ExtLink> e cadastre
          email + senha. Cria a conta como pessoa física mesmo, é mais simples.
        </Step>
        <Step>
          <b>Configure billing.</b> No Console, vá em <b>Settings → Billing</b>. Você precisa
          adicionar um cartão de crédito e <b>pré-pagar créditos</b> — sugiro começar com{' '}
          <b>US$5</b>, dura semanas de uso normal.
        </Step>
        <Step>
          <b>Crie a API Key.</b> Vai em{' '}
          <ExtLink href="https://console.anthropic.com/settings/keys">
            Settings → API Keys
          </ExtLink>{' '}
          → <b>Create Key</b>. Dá um nome ("isiTube") e copia o token que aparece — ele só é
          mostrado UMA vez, então copia logo. Formato: <Code>sk-ant-api03-...</Code>
        </Step>
        <Step>
          <b>Cole no isiTube.</b> Vai em{' '}
          <Link onClick={() => navigate('settings')}>
            Configurações → Inteligência Artificial — Anthropic Claude
          </Link>{' '}
          → cola no campo "API Key da Anthropic" → <b>Salvar</b> → <b>Testar conexão</b>. Status
          deve virar verde "Chave válida".
        </Step>
      </Steps>
      <Callout kind="info">
        <b>Spending cap (recomendado):</b> no Anthropic Console → Settings → Billing → Spending
        limits. Define um teto mensal (ex: US$30) pra evitar surpresa em caso de bug ou abuso.
        Nada limita você sem isso — créditos pré-pagos acabam, depois cobra do cartão direto.
      </Callout>
      <Callout kind="tip">
        <b>Custos típicos:</b> com Sonnet 4.6 (padrão), gerar 5 ideias custa ~US$0.01-0.05. Com
        Haiku 4.5 (mais barato), ~US$0.003. Veja{' '}
        <TopicLink topic="other-api-costs">tabela completa de custos</TopicLink>.
      </Callout>
    </Body>
  );
}

function ApiYoutube(navigate: Nav) {
  return (
    <Body>
      <Pill color="emerald">Necessário só pro plano Pro</Pill>
      <P>
        A YouTube Data API v3 é gratuita (10.000 unidades/dia) e cobre todo uso normal. Precisa de
        uma conta Google Cloud (qualquer Gmail vale).
      </P>
      <Steps>
        <Step>
          <b>Acesse o Google Cloud Console.</b> Vai em{' '}
          <ExtLink href="https://console.cloud.google.com">console.cloud.google.com</ExtLink>.
          Loga com a conta Google que você quer usar.
        </Step>
        <Step>
          <b>Crie um projeto novo</b> (ou use um existente). No topo da página, clica no seletor de
          projeto → <b>Novo projeto</b>. Nome: "isiTube" ou similar. Cria.
        </Step>
        <Step>
          <b>Habilite a YouTube Data API v3.</b> No menu lateral, vai em{' '}
          <b>APIs e Serviços → Biblioteca</b> (ou{' '}
          <ExtLink href="https://console.cloud.google.com/apis/library/youtube.googleapis.com">
            link direto
          </ExtLink>
          ). Busca "YouTube Data API v3" → <b>Ativar</b>.
        </Step>
        <Step>
          <b>Crie a credencial (API Key).</b> Em <b>APIs e Serviços → Credenciais</b> (ou{' '}
          <ExtLink href="https://console.cloud.google.com/apis/credentials">
            link direto
          </ExtLink>
          ) → <b>Criar credencial</b> → <b>Chave de API</b>. Copia a chave gerada (formato:{' '}
          <Code>AIza...</Code>). Não precisa restringir agora — pode fazer depois.
        </Step>
        <Step>
          <b>(Opcional) Restrinja a chave</b> pra reduzir risco se ela vazar: clica no nome da
          chave que acabou de criar → "Restrições de API" → "Restringir chave" → marca apenas{' '}
          <b>YouTube Data API v3</b>. Salva.
        </Step>
        <Step>
          <b>Cole no isiTube.</b> Vai em{' '}
          <Link onClick={() => navigate('settings')}>
            Configurações → YouTube Data API
          </Link>{' '}
          → cola no campo → <b>Salvar</b> → <b>Testar conexão</b>.
        </Step>
      </Steps>
      <Callout kind="info">
        <b>Cota:</b> 10.000 unidades/dia free, reseta às 00:00 PT (~4h da manhã em Brasília). Veja{' '}
        <TopicLink topic="youtube-quota">detalhamento de cota</TopicLink> pra entender o que cada
        operação consome.
      </Callout>
      <Callout kind="tip">
        Pode levar 1-2 minutos pra Google propagar a key e ela funcionar — se o "Testar conexão"
        falhar imediatamente, espera 1 min e tenta de novo.
      </Callout>
    </Body>
  );
}

function ApiKeywordsEverywhere(navigate: Nav) {
  return (
    <Body>
      <Pill color="emerald">Necessário só pro plano Pro</Pill>
      <P>
        Keywords Everywhere fornece <b>volume mensal absoluto</b> de busca pra cada keyword
        pesquisada — é um dos 3 componentes do score 0-100. <b>Não é grátis</b>: créditos
        pré-pagos, mínimo US$10. Sem KE, o score do isiTube se renormaliza pros outros 2
        componentes (Trends + scraping) — funciona, só fica menos preciso.
      </P>
      <Steps>
        <Step>
          <b>Crie conta no site.</b> Vai em{' '}
          <ExtLink href="https://keywordseverywhere.com">keywordseverywhere.com</ExtLink> →{' '}
          <b>Sign up</b>. Cadastra com email + senha. Confirma email.
        </Step>
        <Step>
          <b>Compre créditos.</b> Loga, vai em <b>My Account → Subscriptions / Credits</b>.
          Mínimo: <b>US$10 = 100.000 créditos</b> (válidos por 1 ano). 1 keyword pesquisada =
          1 crédito. Não tem plano gratuito recorrente.
        </Step>
        <Step>
          <b>Pegue sua API key.</b> Após pagar, vai em{' '}
          <ExtLink href="https://keywordseverywhere.com/manage-api-key.html">
            My Account → API Key
          </ExtLink>
          . Copia o token (formato alfanumérico longo).
        </Step>
        <Step>
          <b>Cole no isiTube.</b>{' '}
          <Link onClick={() => navigate('settings')}>
            Configurações → Keywords Everywhere
          </Link>{' '}
          → cola → <b>Salvar</b> → <b>Testar conexão</b>. Vai mostrar quantos créditos você ainda
          tem disponível.
        </Step>
      </Steps>
      <Callout kind="warning">
        <b>Não obrigatório:</b> KE é opcional mesmo no Pro. Se você não quiser pagar US$10, o
        isiTube continua funcionando com Trends + scraping — só perde o componente "volume
        absoluto" do score, e ele se renormaliza automaticamente.
      </Callout>
    </Body>
  );
}

function ApiGithub(navigate: Nav) {
  return (
    <Body>
      <Pill color="zinc">Necessário pra backup + auto-update (todos os planos)</Pill>
      <P>
        O isiTube usa o GitHub Releases como backend de backup (privacidade primeiro — os arquivos
        vão pra um repo SEU, não pro nosso) e como canal de auto-update. Você precisa de um
        Personal Access Token (PAT) "fine-grained" com acesso apenas ao repo que vai guardar os
        backups.
      </P>
      <Steps>
        <Step>
          <b>Crie um repositório no GitHub pra backup</b> (se ainda não tem). Vai em{' '}
          <ExtLink href="https://github.com/new">github.com/new</ExtLink> → nome:{' '}
          <Code>isitube-backup</Code> (ou similar) → <b>Private</b> → cria. Pode ficar vazio, o
          app vai inicializar com um README.
        </Step>
        <Step>
          <b>Gere o token.</b> Vai em{' '}
          <ExtLink href="https://github.com/settings/personal-access-tokens/new">
            github.com/settings/personal-access-tokens/new
          </ExtLink>{' '}
          (fluxo "fine-grained", mais seguro).
        </Step>
        <Step>
          <b>Configure o token:</b>
          <UL>
            <LI>
              <b>Token name:</b> <Code>isitube-backup</Code>
            </LI>
            <LI>
              <b>Expiration:</b> 90 dias (ou "No expiration" se preferir). Quando expirar, gera
              outro.
            </LI>
            <LI>
              <b>Repository access:</b> <b>Only select repositories</b> → escolhe APENAS o repo
              que você criou no passo 1.
            </LI>
            <LI>
              <b>Repository permissions:</b>
              <UL>
                <LI><b>Contents:</b> <b>Read and write</b> (obrigatório — cria releases e faz upload).</LI>
                <LI><b>Metadata:</b> <b>Read-only</b> (vem marcado automaticamente).</LI>
                <LI>Mais nada. Não marca workflows, secrets, admin, etc.</LI>
              </UL>
            </LI>
          </UL>
        </Step>
        <Step>
          <b>Generate token.</b> Copia o token (formato <Code>github_pat_...</Code>). Ele só é
          mostrado UMA vez.
        </Step>
        <Step>
          <b>Cole no isiTube.</b>{' '}
          <Link onClick={() => navigate('settings')}>
            Configurações → Backup do GitHub
          </Link>{' '}
          → cola o token + nome do repo (<Code>seu-usuario/isitube-backup</Code>) → <b>Salvar</b>{' '}
          → <b>Testar conexão</b>.
        </Step>
        <Step>
          <b>Faça o primeiro backup.</b> Mesma seção, botão "Fazer backup agora". Vai criar uma
          release no repo com o seu <Code>data.db</Code> como asset. Backups subsequentes ficam
          como releases novas (histórico).
        </Step>
      </Steps>
      <Callout kind="info">
        <b>O mesmo token também serve pra auto-update:</b> se você publicar o app num repo
        público (ou se for usuário do <Code>progestaodigital/isitube</Code> com acesso), o token
        é usado pra checar se há versão nova e baixar o instalador. Mesmo PAT, dois usos.
      </Callout>
      <Callout kind="warning">
        <b>Não use PAT classic se puder evitar.</b> O fluxo fine-grained (link acima) é bem mais
        seguro porque você escopa o token a UM repo específico em vez de "todos os repos da sua
        conta". Se vazar, dano é mínimo.
      </Callout>
    </Body>
  );
}

function ChannelsOutliers(navigate: Nav) {
  return (
    <Body>
      <P>
        "Outlier" = vídeo que rendeu <b>significativamente acima da média recente</b> do canal.
        Útil pra identificar o que está performando bem AGORA.
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
    </Body>
  );
}

function Evergreen(navigate: Nav) {
  return (
    <Body>
      <P>
        Evergreen = vídeo antigo que <b>continua ganhando views</b> ao longo do tempo. O oposto do
        conteúdo descartável.
      </P>
      <P>
        <b>Cálculo:</b> diferença entre views totais em snapshots consecutivos, dividido pelos
        dias entre eles = views/dia. Quando há ≥ 2 snapshots na janela, usa snapshots; quando há
        só 1 (ou nenhum), cai pra média all-time (views totais ÷ idade do vídeo).
      </P>
      <P>
        <b>Filtros padrão:</b> vídeo precisa ter ≥ 30 dias de idade (descarta o que ainda tá
        "trending") e ≥ 1 view/dia recente.
      </P>
      <UL>
        <LI>
          Aparece em <Link onClick={() => navigate('channels')}>Canais → tab Evergreen</Link> e
          nas <Link onClick={() => navigate('keywords')}>Sugestões de palavras-chave</Link>.
        </LI>
        <LI>
          Quanto mais "Atualizar agora" você fizer ao longo do tempo, mais preciso o cálculo
          (snapshots reais &gt; média all-time).
        </LI>
      </UL>
    </Body>
  );
}

function KeywordScore(_navigate: Nav) {
  return (
    <Body>
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
        <b>Renormalização dinâmica:</b> quando uma fonte falha (rate limit, sem chave, erro), os
        componentes dela saem do cálculo e os pesos das outras são reescalados pra somar 100%. O
        score continua entre 0 e 100, comparável entre buscas — mas fica marcado "Score
        renormalizado" no card.
      </P>
    </Body>
  );
}

function KeywordSuggestions(_navigate: Nav) {
  return (
    <Body>
      <P>
        Mineração offline a partir do seu próprio banco — <b>sem IA, sem custo</b>. Pega tags e
        títulos dos vídeos e ranqueia por frequência.
      </P>
      <UL>
        <LI><b>Em destaque:</b> palavras que aparecem em vídeos sinalizados como outlier.</LI>
        <LI><b>Evergreen:</b> palavras que aparecem em vídeos perenes.</LI>
        <LI>Tags vêm do YouTube (precisa do botão "Extrair informações" no vídeo).</LI>
        <LI>Títulos são tokenizados em 1-3 palavras, removendo stopwords pt-BR + en.</LI>
        <LI>Click numa sugestão dispara a pesquisa completa com as 3 fontes do score.</LI>
        <LI>
          <b>X em cada sugestão</b> remove o termo da lista — não volta a aparecer, próximo melhor
          candidato sobe automaticamente.
        </LI>
        <LI>
          <b>Score 0-100 pré-computado</b> em cada card (bolha colorida: verde ≥70, âmbar ≥40,
          vermelho &lt;40).
        </LI>
      </UL>
    </Body>
  );
}

function YoutubeQuota(_navigate: Nav) {
  return (
    <Body>
      <P>
        Cota gratuita: <b>10.000 unidades/dia</b>. Reseta às 00:00 PT (4h da manhã no horário de
        Brasília aproximadamente).
      </P>
      <P>Custos por operação no isiTube:</P>
      <UL>
        <LI>Cadastrar canal por handle/URL: <b>1-3 unidades</b> (1 lookup + às vezes 1 search)</LI>
        <LI>Atualizar 1 canal: <b>~5-10 unidades</b> (1 channels.list + playlistItems pagination + 1 videos.list por batch de 50)</LI>
        <LI>Extrair metadata de 1 vídeo: <b>1 unidade</b></LI>
        <LI>Validar a chave (botão "Testar conexão"): <b>1 unidade</b></LI>
      </UL>
      <P>
        <b>Conta prática:</b> com 5 canais cadastrados, dá pra atualizar 50-100 vezes por dia.
        Geralmente 1-2 atualizações diárias é mais que suficiente, sobra cota pra extrair metadata
        de muitos vídeos.
      </P>
      <Callout kind="info">
        Iniciante usa proxy do isipanel — a cota não é da sua key, é uma alocação mensal/diária
        da sua licença. Aparece em barras de progresso em <b>Configurações → Licença</b>.
      </Callout>
    </Body>
  );
}

function OtherApiCosts(_navigate: Nav) {
  return (
    <Body>
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Anthropic Claude</h3>
          <UL>
            <LI>US$5 prepago dura semanas de uso normal.</LI>
            <LI>Validar chave: ~US$0.0001 (1 token Haiku).</LI>
            <LI>Gerar 5 ideias com Sonnet 4.6: ~US$0.01-0.05.</LI>
            <LI>Gerar 5 ideias com Haiku 4.5: ~US$0.003 (muito mais barato, qualidade ótima pra esse tipo de tarefa).</LI>
          </UL>
        </div>
        <div>
          <h3 className="font-semibold">Keywords Everywhere</h3>
          <UL>
            <LI>Não tem plano gratuito recorrente.</LI>
            <LI>Mínimo: <b>US$10 = 100.000 créditos</b> (válidos por 1 ano).</LI>
            <LI>1 keyword pesquisada = 1 crédito.</LI>
            <LI>Sem KE, o score se renormaliza pros outros 2 componentes — funciona, fica menos preciso.</LI>
          </UL>
        </div>
        <div>
          <h3 className="font-semibold">Google Trends</h3>
          <UL>
            <LI>Gratuito, sem chave.</LI>
            <LI>Tem rate limit agressivo — se rodar muitas pesquisas seguidas, pode dar 429.</LI>
            <LI>O isiTube tem cooldown de 5min após 429 — não bate mais no endpoint até passar.</LI>
            <LI>Quando dá 429, o componente "Tendência" cai pra status erro e o score se renormaliza.</LI>
          </UL>
        </div>
        <div>
          <h3 className="font-semibold">Scraping do YouTube SERP (ytsr)</h3>
          <UL>
            <LI>Gratuito, sem chave.</LI>
            <LI>Pode quebrar se o YouTube mudar o HTML — incluído no pacote npm @distube/ytsr que atualiza periodicamente.</LI>
            <LI>Rate limit é leve em uso normal; pode dar 429 se você rodar lote grande.</LI>
          </UL>
        </div>
      </div>
    </Body>
  );
}

function DataLocation(_navigate: Nav) {
  return (
    <Body>
      <P>
        <b>Banco SQLite</b> em <Code>%APPDATA%\isiTube\data.db</Code> (no Windows). Contém todos
        os canais, vídeos, transcrições, palavras-chave pesquisadas, configurações e snapshots
        históricos.
      </P>
      <P>
        <b>Chaves de API</b> são criptografadas com o <Code>safeStorage</Code> do Electron (DPAPI
        no Windows) antes de irem pro banco. A chave em texto claro só existe na memória do main
        process quando precisa fazer uma chamada.
      </P>
      <P>
        <b>Licença</b> também é criptografada via safeStorage e armazenada no DB local. Ela é
        validada periodicamente contra o painel isipanel (a cada 1h, com grace period offline de
        48h).
      </P>
      <P>
        <b>Prompts da IA</b> ficam em arquivos <Code>.md</Code> dentro do app — podemos editar
        depois sem rebuild.
      </P>
      <P>
        <b>Backup recomendado:</b> use a feature de backup no GitHub (veja{' '}
        <TopicLink topic="api-github-pat">como gerar um PAT</TopicLink>). Backups vão como
        Releases num repo SEU — privacidade total.
      </P>
    </Body>
  );
}

function Privacy(_navigate: Nav) {
  return (
    <Body>
      <UL>
        <LI><b>BYOK no Pro:</b> você usa suas próprias chaves. Nada passa por servidor intermediário.</LI>
        <LI><b>Iniciante usa proxy do isipanel</b>, mas só pras chamadas que precisam de chave (Anthropic + YouTube). Trends e scraping continuam locais.</LI>
        <LI><b>Chaves nunca expostas no front-end:</b> toda chamada de API roda no main process (Node.js do Electron). O renderer (UI) só fala via IPC tipado.</LI>
        <LI><b>Sem telemetria escondida:</b> o único dado que sai do seu app é a validação de licença (POST com license_key + hwid).</LI>
        <LI><b>Sem coleta centralizada:</b> seus dados (canais monitorados, transcrições, configurações) não saem da sua máquina, exceto quando você manda backup pro seu próprio repo GitHub.</LI>
        <LI><b>Telemetria de provider</b> (que mostra na seção "Status das integrações") é só local, in-memory, reseta a cada restart do app.</LI>
      </UL>
    </Body>
  );
}

function Limitations(_navigate: Nav) {
  return (
    <Body>
      <UL>
        <LI><b>Trends rate-limita.</b> Se você fizer muitas pesquisas seguidas de keyword, o componente Trends pode falhar temporariamente (cooldown de 5min). Espera um pouco entre pesquisas pra evitar.</LI>
        <LI><b>Scraping pode quebrar.</b> Top 10 do SERP e transcrições dependem do HTML do YouTube. Se o YouTube redesenhar, as libs de extração podem precisar de update.</LI>
        <LI><b>Vídeos sem legenda nativa</b> retornam "transcrição indisponível" — Whisper como fallback automático fica pra v2.</LI>
        <LI><b>Em primeiro uso,</b> os gráficos de Comparativo ficam vazios até você ter ≥ 2 snapshots (ou seja, 2 atualizações em dias diferentes).</LI>
        <LI><b>Atalhos de teclado:</b> ainda não implementados.</LI>
        <LI><b>Windows only.</b> Suporte a macOS/Linux fica pra V2+.</LI>
      </UL>
    </Body>
  );
}

// ============================================================================
// Helpers de markup
// ============================================================================

function Body({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="ml-5 list-disc space-y-1">{children}</ul>;
}

function LI({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="space-y-3">{children}</ol>;
}

function Step({ children }: { children: ReactNode }) {
  return (
    <li className="ml-5 list-decimal pl-1 marker:font-semibold marker:text-zinc-500">{children}</li>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </code>
  );
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

function ExtLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 font-medium text-red-600 hover:underline dark:text-red-400"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function TopicLink({ topic, children }: { topic: HelpTopic; children: ReactNode }) {
  const setTopic = useHelpStore((s) => s.setTopic);
  return (
    <button
      onClick={() => setTopic(topic)}
      className="font-medium text-red-600 hover:underline dark:text-red-400"
    >
      {children}
    </button>
  );
}

function Pill({
  children,
  color,
}: {
  children: ReactNode;
  color: 'emerald' | 'amber' | 'zinc';
}) {
  const tone = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    zinc: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  }[color];
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        tone
      )}
    >
      {children}
    </span>
  );
}

function Callout({
  children,
  kind,
}: {
  children: ReactNode;
  kind: 'info' | 'tip' | 'warning';
}) {
  const tone = {
    info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
    tip: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  }[kind];
  return (
    <div className={cn('rounded-lg border px-3 py-2 text-xs', tone)}>{children}</div>
  );
}

function PlanCard({
  title,
  subtitle,
  color,
  features,
}: {
  title: string;
  subtitle: string;
  color: 'amber' | 'emerald';
  features: string[];
}) {
  const tone = {
    amber: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
    emerald: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
  }[color];
  return (
    <div className={cn('rounded-lg border p-3', tone)}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs opacity-80">{subtitle}</p>
      <ul className="mt-2 space-y-1 text-xs">
        {features.map((f, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden>•</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
