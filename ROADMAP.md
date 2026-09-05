# isiTube — Roadmap de Construção

> Software desktop de inteligência competitiva e planejamento de conteúdo para criadores no YouTube.
> Stack: Electron + React + TypeScript + Vite + Prisma + SQLite + Vercel AI SDK + Claude.

**Status atual:** Fases 17-19 concluídas — **Bridge local + MCP** (Claude Code cria/edita/move cards e lê a Biblioteca) · **Kanban instantâneo** + mudanças do MCP ao vivo · **Campo Planejamento** e **tag de formato** no card · **Biblioteca com 2 marcadores de "em alta"** (período e vitalício) · **Release v0.11.0 publicada** · **Pendências abertas:** ver `## Pendências conhecidas` (typecheck com 148 erros) · **Próxima:** YouTube SERP via DataForSEO (trocar o ytsr frágil) ou aprofundar os agentes (search intent, calendário)
**Início:** Maio de 2026 · **MVP previsto:** 9-12 semanas

---

## Constraints fixos

Estas regras valem em **todas as fases** e não devem ser quebradas sem decisão explícita:

1. **API keys nunca no renderer.** Toda chamada a API externa (YouTube, Anthropic, Keywords Everywhere, Trends, scraping) roda no main process do Electron. Renderer só fala via `window.api.*` (IPC tipado pelo `contextBridge`). Chaves vivem criptografadas no SQLite via `safeStorage` do Electron.
2. **Windows only no MVP.** Build via `electron-builder --win` (NSIS). macOS/Linux ficam para v2+.
3. **Código em inglês, UI em pt-BR.** Identificadores, comentários, commits em inglês. Strings de interface em português brasileiro.
4. **Dois planos no MVP** (revisado na Fase 9): **Iniciante** (chaves master via proxy isipanel, com cotas server-enforced — Anthropic Haiku-only + YouTube com endpoints bloqueados) e **Pro** (BYOK, sem cotas, qualquer modelo). Detalhamento na Fase 9.
5. **Cada fase termina rodável.** `npm run dev` sempre abre uma versão funcional e demonstrável. Nada de build quebrado entre fases.
6. **Schema sync-ready desde o dia 1.** Toda tabela tem `id` UUID, `created_at`, `updated_at`, `synced_at` (nullable), `deleted_at` (nullable, soft delete). Tabela `change_log` registra mutações.
7. **Degradação graciosa.** Quando uma fonte de dado falha (scraping, Trends, Keywords Everywhere), o app continua funcional com as outras. Score se renormaliza.
8. **Privacidade primeiro.** Dados do usuário ficam locais (SQLite no `%APPDATA%\isiTube\`). Nada sobe pra servidor sem opt-in explícito.

---

## Visão geral das fases

| # | Fase | Status | Entrega principal |
|---|---|---|---|
| 0 | Scaffolding + shell visual | ✅ feito | Janela Electron com layout YouTube + toggle de tema |
| 1 | Banco + IPC + Configurações | ✅ feito | SQLite + Prisma + painel de chaves criptografadas |
| 2 | Camada de IA abstrata | ✅ feito | `AIService` + `AIProvider` + MockProvider + prompt files |
| 3 | Módulo 5 — Keywords | ✅ feito | Busca de palavras-chave com 3 fontes + score 0-100 |
| 4 | Módulo 1 — Canais | ✅ feito | Monitoramento, popup de atualização, agendamento, outliers |
| 5 | Módulo 2 — Metadata de vídeo | ✅ feito | Extração de título, descrição, thumbnail, tags |
| 6 | Módulo 3 — Transcrição | ✅ feito | Janela invisível + cache permanente |
| 7 | Licenciamento stub + onboarding + polish | ✅ feito | `LicenseProvider` interface + onboarding + migration runtime |
| 8a | Wire up real: Anthropic + YouTube | ✅ feito | Real API calls + validação real + UX "configure chave" |
| 9 | Licenciamento real + proxy isipanel + two-slug | ✅ feito | IsiPanel validate + proxy server-side Anthropic/YouTube + plano Iniciante/Pro (v0.3.0) |
| 10 | Polish dos providers reais + autocomplete + tela de Status | ✅ feito | Autocomplete real do YouTube + Trends rate-limit cooldown + telemetria por provider + tela "Status das integrações" (v0.4.0) |
| 11 | Entitlement assinado (Ed25519) na validação de licença | ✅ feito | Verificação criptográfica do token do isipanel — gating confia só no JWT assinado quando presente; aditivo e com fallback pro JSON legado |
| 12 | Thumbnail Studio (geração com IA) | ✅ feito | Personagens (fotos) + cenários + referência→prompt detalhado (visão) + Gemini Flash Image + custo em R$ + integração Kanban + ajuste de thumbnails (Pro-BYOK) |
| 13 | Canal próprio (OAuth) + auditoria | ✅ feito | Meu canal: OAuth loopback + YouTube Analytics (retenção/AVD/views/inscritos/receita) + agente de auditoria com Claude (Pro-BYOK) |
| 14 | DataForSEO (fonte de SEO real) | ✅ feito | Substitui Keywords Everywhere; volume clickstream + CPC + dificuldade real + sazonalidade + ideias de keyword (v0.8.0) |
| 15 | Criar (Ideação) + agentes de IA no card | ✅ feito | Página Criar (8 ideias, auto-pull do canal, estilo da Biblioteca, persistência→Kanban) + SEO/gancho→roteiro no card preenchendo os campos (v0.8.0) |
| 16 | Thumbnails — criação em 2 campos + conceito por IA | ✅ feito | Brief→prompt editável, "Criar thumbnail" no card com conceito por IA + 3 refs da Biblioteca (v0.8.0) |
| 17 | Bridge local + MCP pro Claude Code | ✅ feito | HTTP em 127.0.0.1 com bearer token reusando os serviços do app + `mcp-server/` com 6 tools + skill; tag de formato no card (v0.9.0) |
| 18 | Kanban instantâneo + Planejamento | ✅ feito | Thumbnails fora do payload via `isitube-thumb://` (5,7 MB → 17 kB), board em store global com prefetch, mudanças do MCP ao vivo, campo Planejamento (v0.10.0) |
| 19 | Biblioteca — dois marcadores de "em alta" | ✅ feito | Selo do período (tração 30d) passa a conviver com um vitalício (views totais vs. média histórica do canal), que não expira (v0.11.0) |

> Nota: as versões entre v0.4.0 e v0.6.2 (lixeira/retention, busca global, auto-update) não foram documentadas como fases neste arquivo. A Fase 11 retoma o registro a partir do trabalho de hardening de licença.

---

## Fase 0 — Scaffolding + shell visual ✅

**Objetivo:** Janela Electron rodando com identidade visual estilo YouTube e infra base de dev.

**Entregue:**
- Estrutura `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`
- `electron-vite` com hot reload
- React 18 + TypeScript + Tailwind v4
- `Sidebar` (5 itens) + `Header` (busca, sino, avatar, toggle de tema)
- `useThemeStore` (Zustand + persist no localStorage à época)
- `BrowserWindow` com `contextIsolation: true`, `nodeIntegration: false`, CSP restritiva
- `electron-builder` configurado para Windows NSIS

**Arquivos-chave:** `electron.vite.config.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/App.tsx`, `tailwind` em `globals.css`.

**Como testar:** `npm run dev` → janela abre, sidebar e header renderizam, toggle sol/lua alterna tema, persiste após restart.

---

## Fase 1 — Banco + IPC + Configurações ✅

**Objetivo:** Persistência local segura e painel de configurações com chaves criptografadas.

**Entregue:**
- Prisma 6 + SQLite, schema sync-ready (`Setting`, `ApiCredential`, `ChangeLog`)
- Migration `20260509033223_init` aplicada em `prisma/dev.db`
- DB path: `prisma/dev.db` em dev, `app.getPath('userData')/data.db` em produção
- `getPrisma()` singleton lazy em `src/main/db/index.ts`
- Services: `src/main/services/settings.ts`, `src/main/services/credentials.ts`
- Encriptação via `safeStorage.encryptString` (DPAPI no Windows). Chave plaintext nunca volta pro renderer
- IPC handlers tipados: `settings:get|set`, `credentials:list|set|delete|test` (test é mock até Fase 8)
- Roteamento entre 5 páginas (Zustand-based, sem react-router)
- UI components: `Button`, `Input`, `Card`, `StatusDot`
- 5 seções de Settings: AI (com dropdown de modelo), YouTube, Keywords Everywhere, Trends, Geral
- Theme migrado do localStorage para SQLite (via settings:set 'theme')

**Arquivos-chave:** `prisma/schema.prisma`, `src/main/db/index.ts`, `src/main/services/credentials.ts`, `src/main/ipc/credentials.ts`, `src/preload/index.ts`, `src/renderer/src/pages/SettingsPage.tsx`, `src/renderer/src/pages/settings/CredentialField.tsx`.

**Como testar:**
- Navegar entre 5 páginas via sidebar
- Settings → cadastrar chave qualquer (ex: `sk-test-1234`) em qualquer provider → status muda de "Não configurado" → "Não testado" → após **Testar conexão** vira "Conectado" (mock, ~1.2s)
- Fechar e reabrir → tema, modelo escolhido e chaves continuam salvos
- DevTools console: `window.api.credentials.list()` mostra status; **não existe** método pra ler chave em texto plano

**Decisões importantes:**
- Prisma 6 escolhido sobre 7 (Prisma 7 quebrou o `url = env(...)` no schema, exige adapter explícito + better-sqlite3 nativo, complexo de empacotar com Electron). Migration para Prisma 7 fica para v2.
- Migration runtime para produção empacotada **NÃO** está implementada (Fase 7 cuida disso).

---

## Fase 2 — Camada de IA abstrata ✅

**Objetivo:** API plugável de IA que isola a UI da implementação do provider.

**Entregue:**
- Interface `AIProvider` com `generateText` e `generateJSON` (espelha o Vercel AI SDK)
- `MockProvider`: respostas mockadas plausíveis para keyword ideas, com latência simulada
- `AnthropicProvider`: stub que documenta como Phase 8 vai conectar (Vercel AI SDK + `@ai-sdk/anthropic`)
- `AIService` (camada de domínio) com `generateKeywordIdeas(seed)` que retorna `{ ideas, meta }`
- Factory `selectProvider()` em `src/main/services/ai/index.ts` (Fase 2 sempre retorna mock; Fase 8 troca por lógica baseada em credencial válida)
- Prompts em arquivos markdown editáveis sem rebuild: `prompts/keyword-ideas.md`
- Loader de prompt com cache + interpolação `{{var}}` em `src/main/services/ai/prompts.ts`
- IPC `ai:generate-keyword-ideas` com validação
- Demo na HomePage: card violeta "Demo: camada de IA" com input de seed e 5 cards de resultado com badges de dificuldade e volume

**Arquivos-chave:** `src/main/services/ai/`, `prompts/keyword-ideas.md`, `src/main/ipc/ai.ts`, `src/renderer/src/pages/HomePage.tsx` (componente `AIDemo`).

**Como testar:** HomePage → trocar seed por qualquer tema → "Gerar 5 ideias" → 5 cards aparecem com termo derivado do seed (`<seed> para iniciantes`, `melhores <seed>`, etc), badges de dif/vol, e linha "Gerado em XXXms via provider mock".

**Decisões importantes:**
- Vercel AI SDK ainda **NÃO** instalado. Será na Fase 8 quando wirar o real.
- Prompts em `prompts/` na raiz do projeto. Em produção precisarão entrar em `extraResources` do electron-builder (Fase 7).

---

## Fase 3 — Módulo 5: Keywords ✅

**Objetivo:** Sistema completo de busca de palavras-chave com 3 fontes e score 0-100, mocked end-to-end para validar arquitetura antes de wirar APIs reais.

**Entregue:**
- Schema: tabelas `Keyword` (term único, search_count, last_searched_at) e `KeywordSearch` (uma linha por busca, JSON do resultado completo). Migration `20260509035357_add_keywords`.
- Interface `KeywordSourceProvider<T>` em `src/main/services/keywords/providers/types.ts`
- 3 providers mock determinísticos (mesmo termo → mesmo resultado, baseado em hash):
  - `ScrapingProvider`: top 10, idade média, saturação (`>500k views`), competição derivada — latência 900-2200ms
  - `KeywordsEverywhereProvider`: volume, CPC, dificuldade — latência 150-450ms
  - `TrendsProvider`: série de 12 meses, direção (rising/stable/declining), queries em ascensão — latência 500-1400ms
- Helpers em `providers/utils.ts`: hash determinístico, RNG seeded, range int/float, pick, delay
- `enrichKeyword(term, enabled)` em `enricher.ts` orquestra com `Promise.allSettled` — fonte desligada vira `status: 'disabled'`, fonte que joga vira `status: 'error'`, sucesso vira `status: 'ok'`. Score sempre calculado com o que sobrou.
- `calculateScore(result)` em `score.ts` com 5 componentes (Volume, Tendência, Concorrência, Frescor, Saturação), pesos padrão (25%/20%/25%/15%/15%), invert para componentes "menor é melhor", **renormalização dinâmica** quando faltam fontes
- `cache.ts`: TTL de 30 minutos, busca por termo lê última `KeywordSearch` não-deletada e retorna se fresca
- `index.ts` (service principal): `searchKeyword(term, options)`, `listHistory(limit)`, `autocomplete(prefix)`, `getSourceStatuses()`, `setSourceEnabled(source, enabled)` — toggles persistidos como `Setting` com keys `keywords.source.*.enabled`
- IPC: `keywords:search`, `keywords:history`, `keywords:autocomplete`, `keywords:get-source-statuses`, `keywords:set-source-enabled`
- `KeywordsPage` completa:
  - `SearchBar` com autocomplete (debounce 180ms, navegação por seta, enter para escolher)
  - `SourceStatusBar` (3 dots: ok/erro/desativado/aguardando-pulsando)
  - `KeywordResultCard` com score gigante (cor por faixa: vermelho <30, amber 30-60, esmeralda 60+), botão de atualizar (force refresh), 3 cards (KE/Scraping/Trends) com dados, "Detalhamento do score" colapsível com barras, "Top 10 do scraping" colapsível, sparkline SVG do Trends, queries em ascensão
  - `HistoryList` com até 20 buscas anteriores, badge de score colorido, click recarrega
  - `HelpDialog` modal com explicação das 3 fontes, tabela de pesos, comportamento na falha de fonte, política de cache
- Settings: nova seção `KeywordSourcesSection` com 3 toggles (Scraping/KE/Trends) — desligar uma fonte e re-pesquisar mostra o score se renormalizando

**Arquivos-chave:** `prisma/schema.prisma` (+Keyword/+KeywordSearch), `src/main/services/keywords/`, `src/main/ipc/keywords.ts`, `src/renderer/src/pages/KeywordsPage.tsx`, `src/renderer/src/pages/keywords/*` (6 componentes), `src/renderer/src/pages/settings/KeywordSourcesSection.tsx`.

**Como testar:**
1. KeywordsPage → pesquisa "receitas fitness" → após ~2s aparece o card com score, 3 colunas de dados, top 10 expansível, sparkline do Trends.
2. Clica **Atualizar** no card → força nova consulta (a mesma de 2s), gera nova entrada no histórico.
3. Pesquisa de novo o mesmo termo → resultado **instantâneo** com badge "Resultado do cache" no card. Histórico ainda mostra a busca original (não duplica enquanto cache válido).
4. Settings → "Fontes de palavras-chave" → desliga **Tendências** → volta na KeywordsPage → atualiza → score se renormaliza, card do Trends mostra "Desativado nas configurações", explicação do score muda para "Score renormalizado — Tendências indisponível".
5. Desliga **2 fontes** → score continua 0-100 com 1 componente.
6. Desliga **3 fontes** → score = `—` com mensagem "Nenhuma fonte respondeu".
7. Botão "Como funciona o score" no canto superior direito abre o modal com tabela de pesos.

**Decisões importantes:**
- Mocks são **determinísticos** (hash do termo → seed do RNG). Mesmo termo sempre dá mesmo resultado — facilita demo e screenshots.
- Cache TTL fixo em 30 min (Phase 8 pode tornar configurável). Mesmo termo dentro do TTL vem do banco, não re-fetcha.
- Score componentes "negativos" (concorrência, saturação, idade) são invertidos antes da soma — mantém sempre "100 = ótimo, 0 = ruim".
- Toggles de fonte são features reais, não só de dev — usuário pode desligar Keywords Everywhere pra economizar créditos sem perder o app.
- `KeywordSearch.result` armazena JSON completo do `KeywordResult` — permite re-renderizar histórico sem nova consulta. Custo de espaço aceitável (poucos KB por busca).
- **Cache é source-aware** (corrigido durante teste): se uma fonte hoje habilitada não tem dados no cache, o cache é invalidado e re-fetcha. Se uma fonte hoje desabilitada tem dados no cache, o cache é servido com aquela fonte mascarada como `disabled` e o score é recalculado na hora. Garante que o score exibido sempre reflete a configuração atual de fontes — mesmo em cache hit.

---

## Fase 4 — Módulo 1: Canais ✅

**Objetivo:** Monitoramento de canais do YouTube com detecção de outliers de performance, popup de atualização ao abrir, agendamento e execução em background — tudo mocked.

**Entregue:**
- Schema novo: `Channel` (youtube_id único, title, thumbnail, subscriberCount, videoCount, monitored, lastUpdatedAt) + `Video` (youtube_id único, channelId FK com onDelete cascade, title, viewCount, likeCount, commentCount, durationSec, publishedAt, **channelAvgViewsAtCheck**, **outlierPercent**, **flaggedAsOutlier**) + `UpdateRun` (triggeredBy, started/completedAt, status, channels/videos counts) + `ScheduledUpdate` (scheduledAt, active, cancelled, ranAt). Migration `20260509141120_add_channels`.
- `ChannelProvider` interface + `YouTubeMockProvider` determinístico:
  - `lookupChannel(urlOrId)` aceita UC.../@handle/youtube.com/c/.../texto livre, gera mock com nome derivado do input (handle vira "Nome Bonitão"), thumbnail SVG inline com iniciais e cor HSL por hash, sub/video count em ranges plausíveis
  - `listRecentVideos(channelId, lookbackDays)` gera 6-18 vídeos espalhados na janela com 1-2 outliers garantidos por canal (3-9x a média do canal) — daí o demo já mostra vídeos sinalizados de cara
- Helper `extractChannelId` faz parsing tolerante; `mockIdFrom` sintetiza UC...-shaped id de 24 chars pra inputs sem ID real
- `assessOutliers(videos, thresholdPercent)`: média do canal; flag se viewCount/avg ≥ threshold; precisa de ≥3 vídeos para ter baseline
- `runUpdateAll(triggeredBy)`:
  1. Busca canais monitorados
  2. Pra cada canal: fetch via provider, upsert vídeos por youtubeId, recomputa outliers de TODOS os vídeos do canal, atualiza Channel.lastUpdatedAt
  3. Cria UpdateRun com counts (canais ok/falhos, vídeos novos, vídeos sinalizados) — status `success`/`partial`/`failed`
- `getStartupAction()` decide o que mostrar ao abrir o app:
  - `missed-schedule` se há ScheduledUpdate ativa com scheduledAt < now e ranAt = null
  - `suggest-update` se há canais e (sem updates ainda OU último >24h atrás) e usuário não dispensou nas últimas 12h
  - `none` caso contrário
- `dismissStartupSuggestion()` define snooze de 12h via Setting `channels.suggestion_dismissed_until`
- Scheduler: `setSchedule(date)` cancela qualquer agendamento ativo (só 1 por vez), persiste novo, dispara `setTimeout` capado em 23 dias. Quando dispara: re-verifica que ainda está ativo, roda update, marca `ranAt`, broadcast pra renderer com toast.
- IPC: `channels:add|list|remove|update-all|get-flagged-videos|get-channel-videos|list-update-runs|get-startup-action|dismiss-startup-suggestion` + `schedule:get|set|cancel`
- Eventos broadcast pra renderer: `events:update-run-completed` e `events:toast` (via `webContents.send` em todas as janelas)
- Settings keys: `channels.outlier_threshold_percent` (default 150), `channels.lookback_days` (default 30)
- UI components novos: `Modal` (reusável, ESC/backdrop close), `Toast` + `ToastContainer` + `useToastStore` (auto-dismiss 5s)
- ChannelsPage redesenhada:
  - Header com "Cadastrar canal"
  - Card de controle: botão "Atualizar agora" (spinner girando), status da última run, agendamento ativo + "Cancelar"/"Agendar"
  - Tabs: "Vídeos em destaque" (default) / "Canais cadastrados (N)"
  - Vídeos em destaque: filtros (canal dropdown, período 7/30/90/365 dias, % mínimo 150/200/300/500), VideoCard com thumbnail, título, canal, views, likes, badge colorido por intensidade do outlier (≥500% vermelho, ≥300% amber sólido, ≥150% amber claro)
  - Canais cadastrados: ChannelList com avatar, título, ID, contadores, "atualizado há Xh", botão remover
  - AddChannelDialog: input + validação + feedback inline
  - SchedulePicker: `<input type="datetime-local">` default amanhã 9h, aviso de "computador precisa estar ligado"
  - UpdatePopup auto-renderiza ao mount do App quando há startup-action
- Settings: `ChannelsSection` para configurar threshold (≥100%) e janela de lookback (≥1 dia)
- App.tsx: ToastContainer + UpdatePopup montados globalmente; bridge dos eventos `events:toast` do main pra useToastStore

**Arquivos-chave:** `prisma/schema.prisma`, `src/main/services/channels/` (providers, outlier, index, scheduler), `src/main/ipc/channels.ts`, `src/main/ipc/schedule.ts`, `src/main/index.ts` (scheduleNextTimer no startup), `src/renderer/src/pages/ChannelsPage.tsx`, `src/renderer/src/pages/channels/*` (6 componentes), `src/renderer/src/pages/settings/ChannelsSection.tsx`, `src/renderer/src/components/ui/Modal.tsx`, `src/renderer/src/components/ui/Toast.tsx`, `src/renderer/src/stores/toast.ts`.

**Como testar:**
1. **Cadastro**: Canais → "Cadastrar canal" → cola qualquer coisa (`@receitas-da-vovo`, `https://youtube.com/@kpopfan`, `UCTestExample` ou texto livre `meu canal`). Salva em ~700ms, aparece na lista com avatar colorido + iniciais derivadas do nome.
2. **Múltiplos canais**: cadastra 3-4 canais diferentes pra ter variedade.
3. **Atualizar manual**: clica "Atualizar agora" → após ~1-3s por canal aparece toast "Atualização concluída — N novos vídeos, M sinalizados". Tab "Vídeos em destaque" lista os outliers.
4. **Card do outlier**: badge colorido com `XXX%` (% acima da média do canal), barra de stats com views/likes/data + linha "média do canal: Yk".
5. **Filtros**: na tab Vídeos em destaque, dropdown de canal, período (7/30/90/365 dias), % mínimo (150/200/300/500). Mudam a lista na hora.
6. **Threshold**: Settings → "Canais — detecção de vídeos em destaque" → muda threshold pra 300% → salva → volta em Canais → clica "Atualizar agora" → re-flag baseado no novo threshold (vídeos com 150-299% deixam de aparecer).
7. **Lookback**: muda janela de 30 pra 7 dias → atualiza → providers retornam vídeos só da última semana.
8. **Remover canal**: ícone de lixeira no card → soft delete (deletedAt setado), some da lista. Cadastrar de novo o mesmo input reativa (não duplica).
9. **Agendamento**: clica "Agendar" no header → datetime-local default amanhã 9h, ajusta pra **+2 minutos no futuro**, salva. Header agora mostra "Próxima: dd/mm/aaaa HH:MM · Cancelar". Espera 2 min com app aberto → roda automático em background → toast "Atualização concluída". Header limpa o agendamento.
10. **Cancelar agendamento**: agenda pra +1h → clica "Cancelar" → some.
11. **Popup ao abrir (suggest-update)**: tem ≥1 canal cadastrado E última atualização foi há >24h (ou nenhuma) → ao abrir o app aparece modal "Atualizar canais agora?" com 3 botões: Não / Agendar / Sim atualizar agora. "Não" snooze por 12h.
12. **Popup ao abrir (missed-schedule)**: agenda pra **+30 segundos**, fecha o app antes de disparar (Ctrl+C no terminal e `npm run dev` de novo após 1 min) → ao abrir, modal mostra "Atualização agendada perdida" com Sim/Não/Reagendar.
13. **DevTools console**: `await window.api.channels.list()`, `await window.api.channels.getFlaggedVideos({ minPercent: 200 })`, `await window.api.schedule.get()`.

**Decisões importantes:**
- **Mocks determinísticos por hash do channelId** — mesmo input sempre dá mesmo canal e mesma lista de vídeos. 1-2 outliers por canal são garantidos via índices fixos (`i === 1` e às vezes `i === 4`). Isso garante que o demo sempre mostra vídeos sinalizados sem precisar pesquisar várias vezes.
- **Thumbnail por SVG data URL** com iniciais sobre círculo HSL — evita dependência de hosting externo durante mock; substituível em Phase 8 por URLs reais.
- **Reativação por upsert**: cadastrar de novo um canal removido reativa em vez de duplicar (`youtubeId` é unique).
- **Outlier recomputado no canal inteiro** a cada update, não só nos novos vídeos — garante consistência se threshold mudou.
- **Agendamento via setTimeout único capado em 23 dias**: simples, sobrevive a restarts (re-armado em `app.whenReady()`), past-due NÃO dispara automaticamente (vai para popup).
- **`broadcastUpdateRunCompleted` + `broadcastToast`** são as únicas formas do main process empurrar pra renderer; mantém o contrato IPC simples e visível.
- **Popup-on-open lógica fica no main** (`getStartupAction`); renderer só pergunta e renderiza. Política de "snooze 12h" centraliza decisão no main.
- **Bug corrigido durante teste — RNG seed negativo**: o mock de vídeos usava `XOR 0xdeadbeef` para diferenciar a sequência da do `lookupChannel`. `0xdeadbeef` é 3.7B, maior que int31, então em JS vira negativo. RNG com seed negativo retorna valores em (-1, 0], `rangeInt` calcula tamanho negativo, `Array.from({length: -1})` retorna vazio → mock devolvia 0 vídeos. Fix: trocar para `0xbeef` (cabe em int31) + `Math.abs` defensivo no `rng` de ambos providers de keywords e channels para prevenir o mesmo bug no futuro.

---

## Fase 5 — Módulo 2: Metadata de vídeo ✅

**Objetivo:** Extrair e armazenar localmente metadata completa de qualquer vídeo via clique no card.

**Entregue:**
- Schema: campos novos em `Video` — `description`, `tags` (JSON-encoded string array), `thumbnailHdUrl`, `language`, `category`, `liveBroadcastStatus`, `metadataExtractedAt`. Migration `20260509144217_add_video_metadata`. Index em `metadataExtractedAt` pra ordenação por extração recente.
- Interface `VideoMetadataProvider` + `YouTubeMockMetadataProvider` que gera (deterministicamente, por hash do youtubeId XOR `0xcafe`):
  - Descrição realista estilo criador BR: intro, sumário com timestamps, redes sociais, materiais gratuitos, CTA, hashtags. 4-7 seções no sumário, hashtags derivadas do título do vídeo.
  - 7-14 tags pescadas de um banco de 23 termos, sem duplicatas
  - Thumbnail HD (SVG inline com seed `hd-${id}` pra diferir do thumb pequeno)
  - language = `pt-BR`, category aleatória de 7 opções, liveBroadcastStatus quase sempre `none`
- Service `videos/index.ts`: `getVideoDetail(id)`, `extractVideoMetadata(id)`, `listExtractedVideos(filters)`. Tags são stringify ao salvar e parseadas ao retornar (fail-safe se JSON corrompido).
- IPC: `videos:get-detail`, `videos:extract-metadata`, `videos:list-extracted`
- `useVideoDetailStore` (Zustand global): `{videoId, open(id), close()}`. Qualquer componente abre o modal sem prop drilling.
- `VideoDetailModal` montado globalmente em App.tsx — observa o store, busca o detalhe, mostra:
  - Header com thumbnail HD (ou pequeno como fallback), título, canal, badge de outlier
  - 4-5 stat cards (views, likes, comentários, duração, data)
  - Painel de extração com botão "Extrair informações" (primary) ou "Re-extrair" (secondary) + timestamp
  - Após extrair: descrição em `<pre whitespace-pre-wrap>` preservando timestamps, tags como chips, KV cards (categoria/idioma/tipo), youtube id no rodapé
- `VideoCard` agora é `<button>` clicável de cobertura inteira — abre o modal; ícone external link aparece no hover
- `VideosPage` substituída do placeholder: lista de vídeos extraídos com filtros (canal, "só outliers"), miniaturas, badges de outlier, contagem de tags. Subscribe no store re-fetcha quando o modal fecha.
- Modal ganhou size `xl` (max-w-3xl) e `max-h-[85vh] overflow-y-auto` pra caber descrição longa

**Arquivos-chave:** `prisma/schema.prisma`, `src/main/services/videos/` (providers/types.ts, providers/youtube-mock.ts, index.ts), `src/main/ipc/videos.ts`, `src/renderer/src/stores/videoDetail.ts`, `src/renderer/src/pages/videos/VideoDetailModal.tsx`, `src/renderer/src/pages/VideosPage.tsx`, `src/renderer/src/pages/channels/VideoCard.tsx`, `src/renderer/src/App.tsx`.

**Como testar:**
1. Canais → Vídeos em destaque → clica em qualquer card → modal abre. Painel diz "Ainda não extraído" com botão "Extrair informações".
2. Clica o botão. Após ~500-1300ms toast esmeralda "Metadata extraída", modal expande mostrando descrição completa, tags como chips, e cards de categoria/idioma/tipo.
3. Fecha o modal (X ou ESC), clica de novo no mesmo vídeo → instantâneo, vem do cache. Botão agora é "Re-extrair".
4. Re-extrair → mock retorna **mesmo conteúdo** (determinístico). Timestamp atualiza.
5. Sidebar → Vídeos. Lista vídeos JÁ extraídos, ordenados pela data de extração. Filtra por canal e "Só outliers".
6. Determinismo: re-extrair o mesmo vídeo dá exatamente a mesma descrição, mesmas tags, mesma categoria.

**Decisões importantes:**
- **Modal global via Zustand** em vez de prop drilling — VideoCard, VideosPage e qualquer outro lugar futuro chamam `useVideoDetailStore.getState().open(id)`.
- **Tags como JSON-encoded string** no SQLite (Prisma SQLite não tem array nativo). Service parseia ao retornar com try/catch.
- **Thumbnail HD com seed diferente** (`hd-${youtubeId}`) — gera SVG ligeiramente diferente do thumb pequeno, simula diferença real entre `default.jpg` e `maxresdefault.jpg`.
- **Re-fetch ao fechar modal** — `useVideoDetailStore.subscribe` na VideosPage detecta `videoId === null` e re-fetcha. Garante que extrações novas aparecem sem reload manual.
- **Description em `<pre whitespace-pre-wrap>`** preserva timestamps "00:00 - Introdução" e quebras de linha sem markdown parser.

---

## Fase 6 — Módulo 3: Transcrição ✅

**Objetivo:** Baixar transcrições com janela invisível (mocked) + cache permanente em SQLite + visualização com timestamps + copy/export.

**Entregue:**
- Schema: 4 campos novos em `Video` — `transcriptSegments` (JSON), `transcriptStatus` ('available' | 'unavailable'), `transcriptLanguage`, `transcriptExtractedAt`. Migration `20260509150632_add_video_transcripts`.
- Interface `TranscriptProvider` com método `fetch({youtubeId, durationSec})` retornando `{status, language, segments}`. Documenta no JSDoc o caminho real da Fase 8 (BrowserWindow show:false → DOM parse → DevTools Protocol fallback).
- `YouTubeMockTranscriptProvider`: gera transcrição realista estilo criador BR baseada no hash do youtubeId, segmentos de 4-12 segundos, intro (1-2) + body + outro (1-2). Cobertura tem o tempo todo do vídeo. **Cerca de 14% dos vídeos** (`hash % 7 === 0`) retornam `unavailable` pra demonstrar a UX de empty state.
- Service `transcripts/index.ts`: `getTranscript(id)`, `extractTranscript(id)`, `exportTranscript(id, format)`. Export usa `dialog.showSaveDialog` do Electron + `fs/promises.writeFile`. Formatos TXT (com timestamps `[mm:ss]`) e MD (com `**[mm:ss]**` em negrito).
- IPC: `transcripts:get`, `transcripts:extract`, `transcripts:export`
- VideoDetail (do service de videos) extendido com `transcriptStatus`, `transcriptLanguage`, `transcriptExtractedAt` — segments NÃO entram aqui (ficam no fetch separado de transcripts.get pra payload menor).
- UI nova `TranscriptPanel` no VideoDetailModal com 3 estados:
  - **Não extraída**: card cinza com botão "Extrair transcrição"
  - **Indisponível**: card amber com ícone alerta, mensagem clara, info sobre Whisper na v2, botão "Tentar de novo"
  - **Disponível**: header com idioma badge + contador de segmentos + 4 botões (Copiar, TXT, MD, Re-extrair). Lista scrollable max-h-[320px] com 1 segmento por linha (timestamp em fonte mono à esquerda, texto à direita)
- **Timestamps clicáveis**: cada linha é um link pra `youtube.com/watch?v={id}&t={start}s` que abre no navegador (em produção pula direto pro momento exato; com mocks ainda abre na URL certa, só não tem vídeo real)
- Botão "Copiar" usa `navigator.clipboard.writeText` com formato `[mm:ss] texto` por linha + toast de confirmação com contagem de segmentos
- Botões TXT/MD chamam `dialog.showSaveDialog` no main, default filename `transcricao-{id}.{ext}`, escrevem o arquivo, retornam path. Toast mostra o caminho onde foi salvo. "Cancelar" do dialog é tratado silenciosamente (sem toast de erro).
- O modal busca **video detail + transcript em paralelo** ao abrir (`Promise.all`). Após extrair, refetch do video pra atualizar `transcriptStatus` no state.

**Arquivos-chave:** `prisma/schema.prisma`, `src/main/services/transcripts/` (providers/types.ts, providers/youtube-mock.ts, index.ts), `src/main/ipc/transcripts.ts`, `src/main/services/videos/index.ts` (estendido), `src/preload/index.ts`, `src/renderer/src/pages/videos/VideoDetailModal.tsx` (TranscriptPanel inline).

**Como testar:**
1. **Atualizar canais** primeiro pra garantir que tem vídeos com IDs deterministas: Canais → "Atualizar agora".
2. **Extrair transcrição disponível**: clica num vídeo qualquer → modal abre → role até o card "Transcrição" → clica "Extrair transcrição". Após ~2-3s aparece a transcrição com 30-100 segmentos, idioma `pt-BR`, contagem de segmentos no header.
3. **Cache instantâneo**: fecha o modal, abre o mesmo vídeo de novo → transcrição já vem carregada (não re-extrai).
4. **Copiar**: clica "Copiar" → toast "Copiado · X segmentos copiados". Cola num bloco de notas → texto formatado com `[mm:ss]` por linha.
5. **Exportar TXT**: clica "TXT" → dialog nativo do Windows abre pra escolher onde salvar (default `transcricao-XXXXXXXXXXX.txt`) → salva → toast com path. Abre o arquivo: tem header com URL do YouTube, idioma, data, e os segmentos com timestamps.
6. **Exportar MD**: clica "MD" → similar, mas formato markdown com `**[mm:ss]**`.
7. **Cancelar export**: clica "TXT" → cancela o dialog → nada acontece (sem toast de erro).
8. **Vídeo sem transcrição**: extrai transcrição em vários vídeos até cair num cujo hash dá `% 7 === 0` (estatística: ~1 em 7) → painel vira amber com mensagem "Vídeo sem transcrição disponível", botão "Tentar de novo" (re-extrair sempre vai voltar `unavailable` pra esse mesmo vídeo, é determinístico).
9. **Timestamp clicável**: clica em qualquer timestamp → abre navegador na URL `youtube.com/watch?v={id}&t={s}s` (com mocks vai dar 404, mas a URL é correta).
10. **Re-extrair**: botão `↻` no canto direito do header da transcrição re-roda. Como é determinístico, conteúdo é igual; timestamp atualiza.

**Decisões importantes:**
- **Mocks deterministas com 14% de "indisponível"** (`hash % 7 === 0`) — facilita testar ambos os estados sem hack. O usuário consegue ver o empty state extraindo poucos vídeos.
- **Segments não entram em VideoDetail** — VideoDetail traz só `transcriptStatus/Language/ExtractedAt` (campos pequenos). Os segments (potencialmente KB) só vêm via `transcripts.get(id)` quando o modal abre. Mantém VideosPage list rápida.
- **Export via dialog nativo + fs.writeFile no main** — usuário escolhe onde salvar, formato é gerado no main pra evitar passar JSON grande de volta pro renderer só pra fazer download.
- **Timestamps como links pro segundo exato** — UX que vale ouro pra criadores que querem ir direto pra um trecho. URL pattern `&t={s}s` é o oficial do YouTube.
- **Promise.all no modal** — VideoDetail e VideoTranscript fetcham em paralelo ao abrir o modal. Sem cascata de loading, abre e mostra tudo de uma vez.
- **Status 'unavailable' é persistido** — não tentamos a cada abertura. Usuário precisa clicar "Tentar de novo" explicitamente. Em produção isso evita gastar quota toda hora num vídeo que sabidamente não tem captions.

---

## Fase 7 — Licenciamento stub + onboarding + polish ✅

**Objetivo:** Endurecer o app para distribuição — licença plugável, primeiro uso, e migrations em produção.

**Entregue:**
- **Migration runtime** em `src/main/db/migrations.ts`: lê `prisma/migrations/` (dev) ou `<install>/resources/migrations/` (produção), aplica via `$executeRawUnsafe`, rastreia em `_prisma_migrations` (mesma tabela que o Prisma CLI usa). Idempotente — roda em todo startup, pula migrations já aplicadas. Faz o instalador funcionar em máquina limpa sem o repo.
- **electron-builder atualizado**:
  - `extraResources`: copia `prompts/**` e `prisma/migrations/**` pra `<install>/resources/prompts/` e `<install>/resources/migrations/`
  - `asarUnpack`: extrai `node_modules/.prisma/**` e `node_modules/@prisma/client/**` do asar (Prisma client precisa do engine binary acessível como arquivo, não dentro do asar)
  - `files`: agora inclui explicitamente os módulos do Prisma
- **Interface `LicenseProvider`** + `StubLicenseProvider` que sempre retorna `{valid: true, plan: 'pro', isStub: true, expiresAt: +1 ano}`. Cache de 24h em `services/license/index.ts` com `getLicense(forceRefresh)`. Factory pronto pra trocar por `IsiPanelLicenseProvider` em uma linha.
- IPC `license:get` + tipo `LicenseInfo` no `@shared/types`
- **Indicador de licença no Header**: chip esmeralda "PRO" com bullet pulsante (ou vermelho "BLOCKED" se inválido). Clica → vai pra Settings. Tooltip mostra plano + se é stub.
- **Settings → Licença**: card com ícone, plano, badges (Stub + Ativa), data de expiração, última validação, botão "Revalidar agora", link "Comprar / renovar". Aparece como **primeira seção** das configurações.
- Avatar do header agora é clicável → vai pra Settings também
- **Onboarding modal**: detecta primeira execução via setting `app.onboarding_completed_at`. Mostra modal de boas-vindas com 3 cards-atalho (Configurar chaves / Cadastrar canal / Pesquisar palavra-chave) + botão "Pular por agora". Cada card navega pra página correspondente E marca onboarding como concluído. Não reaparece em sessões futuras.

**Arquivos-chave:** `src/main/db/migrations.ts`, `src/main/services/license/` (types.ts, stub.ts, index.ts), `src/main/ipc/license.ts`, `src/main/index.ts` (chama `ensureMigrationsApplied` no startup), `package.json` (build config), `src/renderer/src/pages/settings/LicenseSection.tsx`, `src/renderer/src/pages/onboarding/OnboardingModal.tsx`, `src/renderer/src/components/layout/Header.tsx` (license chip + avatar clicável), `src/renderer/src/App.tsx` (mount OnboardingModal).

**Como testar:**
1. **Onboarding** — apaga o setting via DevTools console: `await window.api.settings.set('app.onboarding_completed_at', '')` (ou `npm run db:reset`). Reinicia o dev. Modal aparece com 3 cards. Testa cada um (vai pra página correta E fecha). "Pular por agora" também fecha.
2. **License chip** — Header tem chip verde "PRO" com bullet pulsante. Hover mostra tooltip "Licença Pro (BYOK) (modo stub)". Clica → navega pra Settings.
3. **Settings → Licença** (primeira seção): card com plano Pro, badges Stub + Ativa, data de expiração (1 ano à frente), última validação. Botão "Revalidar agora" re-busca (instantâneo, mock). "Comprar / renovar" abre `isipanel.com.br/comprar` no navegador.
4. **Migration runtime** — não testável fácil em dev (DB já tem todas migrations). Pra testar:
   - `npm run build:win` (gera o instalador)
   - Instala em outro computador (ou desinstala + apaga `%APPDATA%\isiTube\`) e roda
   - App deve abrir, criar `data.db` no AppData, aplicar todas as migrations e funcionar normalmente
5. DevTools: `await window.api.license.get()` retorna o objeto LicenseInfo completo.

**Decisões importantes:**
- **Stub LicenseProvider sempre válido** — não bloqueia nada do MVP. Usuário não percebe diferença até o IsiPanel real entrar (que vai mudar a factory). Cache de 24h no main process imita o que a real implementação vai fazer pra evitar hit excessivo no servidor.
- **Migrations programáticas via `$executeRawUnsafe`** ao invés de spawn do CLI Prisma — evita shipar 50MB+ do CLI no instalador. Funciona porque migrações Prisma SQLite são DDL puro sem string literals com `;`. Rastreamento usa o mesmo `_prisma_migrations` schema do CLI, então futuras migrations rodadas via `prisma migrate dev` em desenvolvimento são reconhecidas.
- **asarUnpack do Prisma** é obrigatório no Electron — o engine binary `query_engine-windows.dll.node` precisa estar fora do asar pra ser carregado nativamente.
- **Onboarding shortcut-cards em vez de wizard sequencial** — usuário escolhe por onde quer começar em vez de ser empurrado num fluxo linear. Mais respeitoso, menos cansativo.
- **License chip no Header** dá visibilidade constante do status. Em modo stub é benigno; quando o IsiPanel real entrar e a licença expirar/falhar, o chip vermelho leva o usuário direto pra Settings → Licença.
- **Não implementei tutoriais visuais por API** (o ROADMAP previa vídeos curtos + FAQ por seção). Cada `CredentialField` já tem o `helpUrl` apontando pra "Como obter sua chave?" do provedor — essa é a primeira parada útil. Vídeos próprios de tutoriais são um esforço de produção de conteúdo, não de código; podem ser adicionados depois sem alterar a arquitetura.

---

## Fase 9 — Licenciamento real + proxy isipanel + two-slug ✅

**Objetivo:** Substituir o `StubLicenseProvider` por validação real com o painel isipanel (`https://api.isitools.com.br`), introduzir o plano **Iniciante** (proxy server-side pra Anthropic + YouTube com cotas) e o plano **Pro** (BYOK puro), e fazer gating de UI/features conforme o plano detectado.

**Contexto:**
- O Constraint #4 original (BYOK puro no MVP) foi revogado após alinhamento de produto: o plano Iniciante via proxy entra no MVP — necessário pra casar com o posicionamento da família "isi" (fácil pro usuário não-técnico, sem precisar criar conta Anthropic + Google Cloud + cadastrar chaves).
- Server-side (isipanel — Phase 14.5 do painel) entregue em sprint paralelo. Documentação no painel: `CLIENT-HANDOFF.md` + `PROXY-CONTRACT.md`.
- License key de teste usada no smoke test: `ISI-YK7Y-HHZ8-EDE8-XB27` (produto `isitube` basic, cotas 800 cents/mês Anthropic + 5k units/dia YouTube, expira em 2036).

**Entregue (3 sub-fases + bonus):**

### 9.A.1 — Camada de provider abstrato (commit `c0e2f79`)

- `src/main/services/external/types.ts` — `ExternalApiConfig = DirectConfig | ProxyConfig`
- `src/main/services/external/quota.ts` — parser de `X-Quota-Used/Remaining/Period/Cost`, snapshot store em memória por API (`anthropic`/`youtube`), `fetchWithQuotaTracking()` e `createTrackingFetch()` (custom fetch pro AI SDK)
- `src/main/services/external/endpoints.ts` — base URLs do proxy isipanel em single source
- `src/main/ipc/quota.ts` + preload — IPC `quota:list` expõe snapshots pro renderer
- Refactor dos 4 providers reais (`anthropic.ts`, `channels/youtube-real.ts`, `videos/youtube-real.ts`, `keywords-everywhere-real.ts`) pra aceitarem `ExternalApiConfig`. KE continua só BYOK (Pro) — sem proxy por decisão do painel (Opção B do Phase 14.5).
- `shared/types.ts` ganha `QuotaApi` + `QuotaSnapshot` + `IsitubeAPI.quota`.

### 9.A.2 — Licença real + two-slug discovery (commit `4e44906`)

- Dependência `node-machine-id` ^1.1.12 (lê `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` no Windows; sobrevive a reinstalação do app, muda só em reinstalação do Windows ou clone de disco).
- `src/main/services/license/hwid.ts` — SHA-256 hex 64 chars do raw MachineGuid (formato que o painel exige).
- `src/main/services/license/storage.ts` — Prisma + `safeStorage` (DPAPI) pra armazenar o `licenseKey` encriptado.
- `src/main/services/license/isipanel.ts` — `IsiPanelLicenseProvider` com cache 1h, two-slug discovery (tenta `isitubepro` → fallback `isitube`, cacheia o slug que deu match), `grace_until` 48h offline, rediscovery inline quando cached slug volta `invalid`.
- `src/main/services/license/index.ts` — swap pro IsiPanel + `getActivePlan()` e `getActiveLicenseKey()` (internal-only) pros selectors.
- `src/main/ipc/license.ts` — handlers `license:set` + `license:clear` (além do `license:get` original).
- Schema novo: migration `20260516221453_add_license_table` cria tabela `licenses` (licenseKey Bytes encrypted, hwid, slug, plan, expiresAt, graceUntil, subscriptionUrl, supportUrl, lastValidatedAt, lastResponseJson).
- Service selectors (`ai/index.ts`, `channels/index.ts`, `videos/index.ts`) consultam `getActivePlan()` e escolhem `direct` (Pro/BYOK) vs `proxy` (Iniciante, license_key como bearer). AI selector força **Haiku 4.5** pro Iniciante (proxy rejeita outros).
- `keywords/index.ts` força `keywordsEverywhere: false` no plano Iniciante (KE é Pro-BYOK only).
- `LicenseInfo` no shared/types ganha `status` (discriminator com 9 estados), `slug`, `graceUntil`, `subscriptionUrl`, `supportUrl`.
- Stub provider deletado (history fica no git).

### 9.A.3 — UI: gate modal + gating + quota display (commit `2b82665`)

- `src/renderer/src/components/license/LicenseGateModal.tsx` — modal bloqueante que cobre o app inteiro quando `info.valid === false`. Form com validação de formato `ISI-XXXX-XXXX-XXXX-XXXX`, ações contextuais (retry/support/subscription) baseadas no `status`.
- `src/renderer/src/components/license/PlanBadge.tsx` — chip "PRO"/"INICIANTE"/"BLOQUEADA" com bullet pulsante, reutilizado no Header e LicenseSection.
- `src/renderer/src/hooks/useLicense.ts` — source-of-truth do estado de licença no renderer + sync entre componentes via window event.
- `src/renderer/src/hooks/useQuota.ts` — polling de `quota:list` cada 30s + refetch on focus.
- `src/renderer/src/lib/licenseErrors.ts` — mensagens pt-BR pros 9 `LicenseStatus` + 11 error codes do proxy (`model_not_allowed`, `endpoint_blocked`, `quota_exceeded`, etc).
- `App.tsx` — splash de loading + gate modal quando bloqueado + Sidebar/Header/main só quando válido.
- `LicenseSection.tsx` refatorado: PlanBadge, expiração, barras de cota (Anthropic em R$/mês BRL, YouTube em units/dia), botão "Trocar chave" com inline confirm, "Revalidar", "Renovar" (subscription_url), "Suporte" (support_url).
- `SettingsPage.tsx` — Iniciante oculta `AISection`/`YouTubeSection`/`KeywordsEverywhereSection` e mostra `IniciantePlanBanner` (CTA upgrade); Pro mostra tudo + `ProTipBanner`.
- `Header.tsx` — chip de plano via `useLicense` (atualiza imediato quando user troca chave).

### Hotfix + features extras lançadas junto

- **Fix Anthropic baseURL** (commit `4cd4bed`): o `@ai-sdk/anthropic` appenda só `/messages` ao baseURL, então `ANTHROPIC_PROXY_BASE_URL` precisa terminar em `/v1`. Sem o `/v1`, request virava `/v1/proxy/anthropic/messages` → proxy retornava 403 `endpoint_not_allowed`. Diagnóstico ficou no `anthropic.ts` (logApiError captura statusCode + url + responseBody).
- **IdeaGenerator reusable** (commit `5c95712`): gerador de ideias extraído de HomePage pra `components/keywords/IdeaGenerator.tsx`, agora também aparece em KeywordsPage acima do "Verificar volume de busca". Click numa ideia preenche o campo e dispara análise automática. Tooltip "Verificar volume de busca" nos cards/chips. SearchBar ganhou prop `currentTerm` pra sync externo.
- **Suggestions exclude** (commit `d5cf905`): `X` em cada sugestão dos canais → persiste em Setting `keywords.suggestions.excluded` → próximo melhor candidato sobe automático (filter antes do slice TOP_N). IPC `keywords:exclude-suggestion`.
- **Score pré-computado nas sugestões** (commit `d0bb227`): `KeywordSuggestion` ganha `scoreValue` + `scoreLastComputedAt` (carregado do KeywordSearch cache no backend). UI mostra bolha tier-colored (verde ≥70, âmbar ≥40, vermelho <40). Renderer faz background pre-compute sequencial (700ms entre buscas) pra preencher terms sem score, sem bloquear UI.

**Arquivos-chave (real):**
- Backend external: `src/main/services/external/{types,quota,endpoints}.ts`, `src/main/ipc/quota.ts`
- Backend license: `src/main/services/license/{hwid,storage,isipanel,index,types}.ts`, `src/main/ipc/license.ts`
- Backend providers refatorados: `src/main/services/ai/providers/anthropic.ts`, `src/main/services/{channels,videos}/providers/youtube-real.ts`
- Backend selectors plan-aware: `src/main/services/{ai,channels,videos,keywords}/index.ts`
- Schema: `prisma/schema.prisma` (model `License`) + `prisma/migrations/20260516221453_add_license_table/`
- Renderer license: `src/renderer/src/components/license/{LicenseGateModal,PlanBadge}.tsx`, `src/renderer/src/hooks/{useLicense,useQuota}.ts`, `src/renderer/src/lib/licenseErrors.ts`, refactor `src/renderer/src/pages/settings/LicenseSection.tsx` + `src/renderer/src/pages/SettingsPage.tsx` + `src/renderer/src/components/layout/Header.tsx` + `src/renderer/src/App.tsx`
- Shared: `src/shared/types.ts` (LicenseStatus, LicenseSlug, QuotaApi, QuotaSnapshot, KeywordSuggestion, etc) + `src/preload/index.ts`
- Bonus features: `src/renderer/src/components/keywords/IdeaGenerator.tsx`, `src/main/services/keywords/suggestions.ts`, `src/renderer/src/pages/keywords/SuggestionsPanel.tsx` (com exclude + score badge)

**Coordenação com o painel isipanel (concluída):**
- Endpoint validate confirmado contra `https://api.isitools.com.br/v1/license/validate` — discriminator de status `valid/invalid/hwid_mismatch/expired/blocked`, retorna `grace_until`, `subscription_url`, `support_url`.
- Proxy Anthropic em `https://api.isitools.com.br/v1/proxy/anthropic/v1/messages` — aceita `x-api-key` (default do AI SDK) ou `Authorization: Bearer`. Whitelist `^claude-haiku-4-5` e path `/v1/messages`.
- Proxy YouTube em `https://api.isitools.com.br/v1/proxy/youtube/youtube/v3/{path}` — GET only, allowlist de endpoints (sem `search.list`), `Authorization: Bearer`.
- Cota Google subjacente: pedido de aumento submetido ao Google Cloud Console (aprovação leva semanas). Até lá, 10k units/dia compartilhados entre todos Iniciantes — viável só com poucos clientes simultâneos.

**Decisões importantes:**
- **Constraint #4 revogado.** Plano Iniciante via isipanel entrou no MVP — decisão de produto (família "isi" = fácil).
- **Anthropic SDK usa `x-api-key` por default.** O proxy aceita ambos formatos, então `createAnthropic({ apiKey: licenseKey, baseURL })` funciona out-of-the-box. Sem override custom de header.
- **`baseURL` do Anthropic SDK precisa do `/v1` no final** (descoberto em produção via curl + log diagnóstico). Sem isso, request vai pra `/messages` (sem `/v1/`) e 403'a.
- **HWID via `node-machine-id`.** Sobrevive reinstalação do app, muda só em reinstalação do Windows. Strict lock + admin reset manual no painel.
- **Cache em memória de 1min no service + 1h soft no provider + grace_until 48h offline** — três camadas, cada uma com propósito (UI hit, server load, internet outage).
- **JWT signed offline NÃO implementado.** Cache simples + grace_until suficiente; cracker que modifica binário também remove a checagem de assinatura, então JWT só atrasa sem defender.
- **Haiku 4.5 forçado pro Iniciante.** Proxy rejeita outros modelos com 403 `model_not_allowed`. Pro escolhe livremente. Protege margem (COGS) e diferencia produto.
- **`search.list` bloqueado no proxy YouTube.** Custa 100 units, queimaria cota. Cliente usa `channels?forHandle=`/`?forUsername=` (1 unit cada).
- **KE Pro-only.** Painel não proxia KE no MVP (Opção B da Phase 14.5). Cliente força `keywordsEverywhere: false` no plano Iniciante.
- **Diagnóstico permanente em anthropic.ts.** `logApiError` capturando responseBody + statusCode + URL — pago uma vez, evita rodadas de debug remoto pra erros de proxy.

**Como testar (validado em v0.3.0):**
1. Apaga a licença local: `await window.api.license.clear()` no DevTools (ou apaga row da tabela `licenses` via Prisma Studio). Reinicia o app — `LicenseGateModal` aparece bloqueando.
2. Cola `ISI-YK7Y-HHZ8-EDE8-XB27` no modal → "Validar" → modal fecha → chip do Header mostra "INICIANTE".
3. Settings → seções Anthropic/YouTube/KE ocultas; LicenseSection mostra plano, expiração e barras de cota (Anthropic R$ 0,00 / R$ 8,00; YouTube 0 / 5.000 units inicialmente).
4. Home → "Gerar ideias de palavra-chave" com "Com IA" → gera ideias via proxy Anthropic → barra de cota Anthropic atualiza em ~30s.
5. Cadastrar canal por handle → vídeos reais via proxy YouTube → cota YouTube atualiza.
6. Restart sem internet (dentro de 48h da última validação) — funciona via cache.
7. Trocar chave (Settings → "Trocar chave" → "Sim, remover") → modal volta → cola outra chave.
8. Sugestões dos seus canais: cada card mostra bolha colorida com score; `X` exclui e o próximo melhor toma o lugar.

**Lançado como v0.3.0** em 17/05/2026 (commit `5e21e0e`, instalador `isiTube-Setup-0.3.0.exe`, 159 MB, publicado no GitHub Releases via `scripts/publish-release.mjs`).

---

## Fase 10 — Polish dos providers reais + autocomplete + tela de Status ✅

**Objetivo (re-escopado):** A descrição original previa "wire up real KE + Trends + scraping", mas auditoria pré-execução revelou que isso já tinha sido feito organicamente nas Fases 8a/9. O que sobrou eram polishes: substituir o autocomplete (último mock realmente vivo), limpar mocks dead-code, endurecer Trends contra 429, adicionar telemetria leve, e construir a tela "Status das integrações" prevista desde o plano inicial mas nunca implementada.

**Entregue (4 sub-fases):**

### 10.A — Autocomplete real do YouTube (commit `97c6a2c`)

- Substitui `keywords/autocomplete.ts` (mock de sufixos hardcoded "para iniciantes / em 2026 / ...") por chamada ao endpoint público `suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=pt-BR&gl=br&q=...` — mesmo endpoint que o YouTube usa no próprio search box. Sem chave de API.
- Timeout 1.5s via AbortController (autocomplete dispara a cada tecla, não pode travar digitação).
- Fallback silencioso pros sufixos antigos quando o endpoint falha (rate limit, anti-bot, sem internet) — UX sobrevive sem sugestões "vivas".

### 10.B — Limpeza de dead code (commit `e3b761e`)

- Deletados 3 mocks órfãos que nunca eram chamados em produção (só ficavam `void X;` pra silenciar lint):
  - `keywords/providers/scraping.ts`
  - `keywords/providers/trends.ts`
  - `transcripts/providers/youtube-mock.ts`
- **Bug encontrado durante a limpeza**: `keywords/free-ideas.ts` importava `TrendsProvider` (mock!) em vez de `GoogleTrendsRealProvider`. O gerador de ideias "Sem IA" estava devolvendo tendências sintéticas em vez de queries reais. Corrigido.
- Mocks mantidos como fallback ativo: `keywords-everywhere.ts` (Pro sem chave BYOK), `channels/youtube-mock.ts`, `videos/youtube-mock.ts` (idem).

### 10.C — Trends cooldown + telemetria por provider (commit `9b6cb67`)

- `trends-real.ts`: cooldown de 5min após qualquer erro que cheire a rate limit (regex em "429", "rate limit", "too many", "unavailable"). Bater de novo com 429 só piora o ban; melhor calar.
- Novo módulo `src/main/services/telemetry/providers.ts` com store in-memory `recordSuccess/recordFailure` + snapshot `{ lastSuccessAt, lastErrorAt, lastErrorMessage, totalCalls, totalFailures }` por `ProviderKey`.
- Telemetry hooked em 7 providers reais: anthropic, youtube-data-api (channels + videos), youtube-scraping (ytsr), youtube-transcript (com tratamento especial: "sem legendas" conta como sucesso), youtube-autocomplete, trends, keywords-everywhere.
- Shared types: `ProviderKey` + `ProviderSnapshot`. IPC `health:list` exposto via `window.api.health.list()`.
- **Decisão consciente:** NÃO persistir em DB. Stats "desde o boot" são mais úteis que histórico longo pra responder "essa integração está saudável agora?" e cobra schema zero.

### 10.D — Tela "Status das integrações" (commit `52b9f93`)

- `pages/settings/HealthSection.tsx` — lista os 9 providers conhecidos em ordem fixa (independente da ordem que foram chamados pela 1ª vez). Cada linha:
  - Ícone por status (✅ OK / 🔴 ERRO / ⚪ OCIOSO)
  - Nome friendly em pt-BR + descrição curta
  - Última chamada OK + última falha (relativo: "5 min atrás", "2h atrás") + contadores
  - Mensagem completa do erro quando estado=erro
- Tick a cada 30s pra re-renderizar os "X min atrás" sozinhos. Botão Atualizar pra refetch.
- **Escopo deliberadamente enxuto (opção 1 escolhida pelo usuário):** só snapshot. Sem latência média 24h, sem sparkline, sem alertas push.
- Posicionada entre BackupSection e DataSection no SettingsPage. Visível pra Iniciante e Pro.

**Arquivos-chave (real):**
- Novo: `src/main/services/telemetry/providers.ts`, `src/main/ipc/health.ts`, `src/renderer/src/pages/settings/HealthSection.tsx`
- Refator: `src/main/services/keywords/autocomplete.ts` (real + fallback), `src/main/services/keywords/providers/trends-real.ts` (cooldown), 7 providers reais ganhando hooks de telemetria, `keywords/free-ideas.ts` (fix import mock→real), `keywords/index.ts` + `transcripts/index.ts` (limpeza de imports dead)
- Shared: `src/shared/types.ts` (+`ProviderKey`, `ProviderSnapshot`, `IsitubeAPI.health`)
- Deletados: 3 arquivos mock orfãos (~300 linhas removidas)

**Bonus entregue na mesma rodada (commits fora das sub-fases 10):**
- `de6dc34` — fix(channels/evergreen): filtro 'Tipo' (Shorts/Longo/Desconhecido) não estava aplicando. Renderer enviava `videoType` mas o `analytics.ts` ignorava silenciosamente. Aplicado dentro do loop de cálculo, antes do push (baseline do canal continua sendo computada com todos os tipos — filtro é só display).
- `3a2d4a4` — feat(home): toggle Longos/Curtos nos cards "Top vídeos em destaque" e "Top vídeos evergreen" da página Início. Default Longos. Filtro client-side (count nos MetricCards não muda). `EvergreenVideo` ganha `durationSec` (já existia no DB, só não era projetado).

**Decisões importantes:**
- **Fase 10 re-escopada antes de codar.** A descrição original era inerited de quando vários providers eram mock. Auditoria pré-execução revelou que só o autocomplete continuava sendo mock vivo; os outros "wire up real" itens já tinham acontecido em 8a/9. Re-escopo focou no que realmente faltava + polish.
- **Endpoint público do YouTube pra autocomplete** (suggestqueries.google.com com `client=firefox`) — não documentado mas estável há anos. Se quebrar, fallback pro mock antigo continua salvando a UX.
- **Cooldown em vez de retry** pro Trends rate limit. Retry com backoff em endpoint que rate-limita por IP só queima IP do usuário mais rápido.
- **Telemetria in-memory, não persistida**. Reseta no boot. Trade-off: perde histórico de >24h, ganha schema zero + clareza ("o que aconteceu desde que abri o app").
- **Health screen é só snapshot (opção 1)** — usuário escolheu o escopo mínimo. Sparkline + latência média + alertas push ficam pra fase futura se aparecer caso de uso.

**Como testar (validado em v0.4.0):**
1. SearchBar de Keywords: digitar "receit" → autocomplete real do YouTube aparece em ~300ms (não mais sufixos sintéticos).
2. Free ideas no IdeaGenerator (Sem IA, seed "receitas fitness") → queries em ascensão reais do Trends (quando Trends não está em cooldown).
3. Settings → "Status das integrações" → todas as integrações começam como OCIOSO; conforme você usa features, viram OK ou ERRO.
4. Forçar erro: desconfigurar a chave Anthropic e gerar ideia → Anthropic vai pra estado ERRO com mensagem.
5. Disparar várias buscas de keyword em sequência → Trends pode entrar em cooldown (mensagem clara "Trends em cooldown (rate limit recente). Tente novamente em Xs.").
6. Página Canais → aba Evergreen → filtro Tipo (Shorts / Longos / Desconhecido) agora funciona.
7. Início → Top vídeos em destaque + Top vídeos evergreen → toggle Longos / Curtos no header de cada card filtra a lista. Default Longos.

**Lançado como v0.4.0** em 17/05/2026.

---

## Fase 11 — Entitlement assinado (Ed25519) na validação de licença ✅

**Objetivo:** Endurecer o licenciamento da Fase 9. Até aqui o app confiava no JSON puro de `POST /v1/license/validate`. Um `{ status: "valid" }` adulterado ou interceptado (MITM) era aceito como verdade. O isipanel passou a incluir — **só na resposta `valid`** — um campo opcional `entitlement`: um JWT compacto assinado em Ed25519/EdDSA. Quando presente, o app confia **criptograficamente** no resultado em vez de no JSON.

**Entregue:**
- Novo módulo `src/main/services/license/entitlement.ts` — verificação EdDSA com o `crypto` nativo do Node (zero dependência nova). Chave pública embarcada como SPKI PEM, carregada via `crypto.createPublicKey`, verificada com `crypto.verify(null, msg, key, sig)`.
- Mapa `{ kid -> KeyObject }` para suportar **rotação** de chave. PROD (`isi-ed25519-prod-2026-06`) sempre carrega; a chave DEV só carrega quando `!app.isPackaged` (nunca vai no build de release). Construção do mapa é lazy (não roda no load do módulo).
- `verifyEntitlement()` segue a ordem: split → header/`kid` → assinatura → claims → `status==='valid'` → `iss==='isipanel'` → `exp`/`iat` (skew de 90s) → `hwid` local → `product_slug` === slug que validou → `edition`.
- Integração em `isipanel.ts`: campo opcional `entitlement?` no payload `valid` + helper `resolveValid()` que centraliza os 3 pontos de tratamento de `valid`. Quando o token é confiável, o `plan` salvo vem da `edition` **assinada** (não mais inferido do slug), então `getActivePlan()` e todos os seletores a jusante passam a confiar no token.

**Regras de comportamento (aditivo, nunca obrigatório):**
- **Token ausente** → comportamento legado: confia no JSON, plano pelo slug. Nunca falha duro (servidor antigo / chave não configurada).
- **Token presente e válido** → gating só pela `edition` assinada.
- **Token presente e inválido** (assinatura/binding) → `status:'invalid'` bloqueia, **sem tocar o cache** (o servidor real está ok; aquela resposta é suspeita).
- **Edition divergente do slug** (com assinatura válida = bug de servidor, não ataque) → não bloqueia; faz *clamp* pro tier mais restritivo entre (claimed, expected) e loga. Nunca concede acima do esperado.

**Decisões importantes:**
- **Binding ao slug pedido** (confirmado com o painel): o token traz o `product_slug` real do produto (`isitube`/`iniciante` ou `isitubepro`/`pro`), igual ao slug enviado na request. A verificação exige `product_slug === slug que validou` (reject estrito em divergência).
- **`crypto` nativo, não `jose`.** Ed25519 é suportado direto pelo Node; SPKI PEM é o formato mais simples de embarcar e o que o painel já forneceu.
- **Higiene de log:** nunca loga token inteiro, license_key, nem hwid completo (mascarado `abcdef…wxyz`).

**Test runner introduzido nesta fase:** o projeto não tinha `vitest`/`jest`. Adicionado `vitest` + `vitest.config.ts` + scripts `test`/`test:watch`. Suíte `src/main/services/license/entitlement.test.ts` (21 testes) cobre assinatura ok/adulterada, kid desconhecido, alg confusion, expirado, iat no futuro, hwid/produto divergente, clamp de edition, token ausente→fallback, e consistência da pubkey PROD embarcada. **A suíte já pegou um bug real**: um TDZ (`const` lido antes de inicializar) que crasharia o módulo no import — corrigido tornando a construção do mapa de chaves lazy.

**Arquivos-chave:**
- Novo: `src/main/services/license/entitlement.ts`, `src/main/services/license/entitlement.test.ts`, `vitest.config.ts`
- Refator: `src/main/services/license/isipanel.ts` (campo `entitlement`, `resolveValid`, plano vindo da edition assinada), `src/main/services/license/storage.ts` (sem mudança de schema — `planOverride` é em memória)
- Config: `package.json` (vitest + scripts), `tsconfig.node.json` (exclui `**/*.test.ts` do build)

**Como testar:**
1. `npm test` → 21 testes passam.
2. `npm run dev` com servidor que **não** manda `entitlement` → app funciona igual a hoje (fallback legado).
3. Servidor mandando token válido → gating pela edition assinada; token adulterado/MITM → app bloqueia com "Não foi possível verificar a assinatura da licença".

---

## Fase 12 — Thumbnail Studio (geração de thumbnails com IA) ✅

**Objetivo:** Gerar thumbnails de vídeo dentro do isiTube a partir de (1) fotos do criador (rosto/corpo, pra IA manter a fisionomia), (2) uma imagem de fundo/cenário e (3) um prompt detalhado. As referências podem vir de **upload**, da **biblioteca** (thumbnails de vídeos que performaram acima da média) ou de **escolha automática** pelo sistema.

**⚠️ Nota de execução (2026-08-23): a implementação divergiu bastante do plano previsto abaixo — que fica como registro histórico. O que de fato entrou:**

- **Personagens** (`ThumbnailCharacter` + N fotos) no lugar do "asset de rosto solto": o criador agrupa 5-10 fotos como identidade; até 8 vão pro gerador.
- **Cenários** (`ThumbnailScene`): fundos nomeados, selecionáveis e opcionais na geração.
- **Referência de estilo vira TEXTO, não imagem** (o pulo do gato): mandar a thumb do concorrente pro gerador fazia a pessoa dele vazar pra imagem. Agora o **Gemini visão lê a referência e escreve um prompt detalhado** (botão "Gerar prompt da referência"), o usuário revisa e gera. `hasScene` faz o prompt deixar o fundo pro cenário selecionado em vez de descrever o da referência.
- **Referências vêm de busca de vídeo por título** (`searchVideoThumbnails`), auto-pick do maior outlier, ou upload — selecionadas por padrão.
- **Custo em R$**: `services/fx` (cotação USD→BRL via AwesomeAPI, cache 6h + fallback offline).
- **Integração com o Kanban**: cada geração tem um **código** (8 chars do id); no card dá pra **puxar do estúdio** (busca por código/termo do prompt → copia o BLOB), **baixar** a thumb (dialog nativo) e o **upload** manual continua.
- **Modelos**: imagem `gemini-2.5-flash-image`; visão `gemini-3.6-flash` (o `2.5-flash` saiu de linha para contas novas durante a execução).
- **Plano/dev**: Pro-BYOK (credencial `google_ai`); em dev sem chave, `MockImageProvider` (gradiente) demonstra o fluxo. Iniciante bloqueado (upsell).
- **Migrations**: `add_thumbnails`, `add_characters_scenes`, `add_style_description`. Imagens como **BLOB** (padrão Kanban → entram no backup do `.db`).
- **Bug corrigido**: `ipc/credentials.ts` tinha whitelist própria de providers sem `google_ai` (a chave não salvava, com falha muda) → adicionado + `catch` no `CredentialField`.
- **Arquivos reais**: `services/thumbnails/{providers/{types,gemini,mock}.ts,index.ts}`, `services/fx/index.ts`, `services/kanban/index.ts` (+`addThumbnailFromGeneration`/`exportCardThumbnail`), `ipc/{thumbnails,kanban}.ts`, `credentials.ts`; `shared/types.ts` + `preload/index.ts`; `pages/ThumbnailsPage.tsx`, `pages/settings/ThumbnailsSection.tsx`, `pages/HelpPage.tsx` (+`api-gemini`), `pages/kanban/CardEditorModal.tsx`, Sidebar + rota, `MissingKeyCTA`/`HealthSection`.
- **Validado ao vivo** com o usuário (Pro + chave real): referência→prompt→geração com personagem + cenário, sem vazamento de pessoa, custo em R$, e puxar/baixar no Kanban.

**Decisões de produto (definidas em planejamento, 2026-08-22):**
- **Motor:** Gemini 2.5 Flash Image ("Nano Banana") — multi-referência, mantém rosto/sujeito, ~US$0,04/img, rápido. Abstraído atrás de `ImageProvider` pra ser trocável sem mexer na UI.
- **Plano:** **Pro-BYOK primeiro** (usuário cola a própria chave Gemini). Iniciante vê upsell; proxy no isipanel fica pra fase futura. Espelha o tratamento do Keywords Everywhere (Pro-only).
- **API HTTP direto no main**, não MCP — o NanoBanana MCP é ferramenta do Claude Code, não shipável no Electron; chamamos a API REST direto, como os outros providers reais.

**Constraints herdados aplicáveis:** #1 chave nunca no renderer (imagem gerada no main; renderer recebe path/preview); #3 código EN / UI pt-BR; #6 schema sync-ready; #7 degradação graciosa (sem chave → CTA "configurar"); #8 privacidade (fotos do rosto ficam locais, só sobem pro provedor no ato da geração, com aviso explícito).

**Três insumos, dois papéis de referência (não misturar):**
- **Identidade** — fotos de rosto/corpo do criador.
- **Estilo/layout** — uma thumbnail vencedora (composição, cor, posição de texto).
- **Fundo/cenário** — a foto do set real onde grava.

**Entregáveis previstos:**

*Schema (nova migration `add_thumbnails`):*
- `ThumbnailAsset` — `id`, `kind` (`face` | `scene` | `style`), `label`, `data` (Bytes/BLOB), `mimeType`, `sourceType` (`upload` | `library`), `sourceVideoId?` (quando veio de um vídeo monitorado), `width`, `height` + campos sync-ready (`id` UUID, `createdAt`, `updatedAt`, `syncedAt?`, `deletedAt?`).
- `ThumbnailGeneration` — `id`, `prompt`, `refAssetIds` (JSON array), `provider` (`gemini`|`mock`), `model`, `aspectRatio` (default `16:9`), `data` (Bytes/BLOB), `mimeType`, `costEstimateUsd?` + sync-ready.
- Imagens como **BLOB no SQLite** (`Bytes`), mesmo padrão do `KanbanCardThumbnail` — entram no backup do `.db` e reusam o fluxo base64→BLOB→data URL. (Decisão revista na execução: guardar como arquivo deixaria as imagens fora do backup do GitHub, que só sobe o `.db`.)

*Provider (main-only):*
- Interface `ImageProvider` em `services/thumbnails/providers/types.ts`: `generateThumbnails(args) → { images: {path}[], usage }`, com `args = { prompt, references: {kind, filePath}[], aspectRatio, count }`.
- `GeminiImageProvider` (`providers/gemini.ts`) — chama a Gemini API REST (`gemini-2.5-flash-image`), manda refs como inline parts base64 + texto, devolve os bytes gerados (o service persiste como BLOB). Telemetria via `recordSuccess/recordFailure` (novo `ProviderKey` `gemini-image`).
- Novo `CredentialProvider` `google_ai` em `credentials.ts` (+`ALL_PROVIDERS` +`testGoogleAI()` com chamada mínima pra validar a chave).

*Selector plan-aware (`services/thumbnails/index.ts`, espelhando `ai/index.ts`):*
- Pro/BYOK → `GeminiImageProvider` com a credencial `google_ai`.
- Iniciante → `null` (feature bloqueada; UI mostra upsell). Sem proxy nesta fase.

*Serviços de domínio (`services/thumbnails/index.ts`):*
- `listAssets(kind?)`, `addAssetFromUpload(files)`, `addAssetFromVideo(videoId)` (baixa o `thumbnailHdUrl` já persistido e materializa como asset de estilo), `pickAutoStyleRef()` (maior `outlierPercent` dos vídeos monitorados — reusa outliers já calculados), `deleteAsset(id)`.
- `generate({ prompt, refAssetIds, aspectRatio, count })`, `listGenerations()`, `exportGeneration(id)` (save dialog nativo + `fs.writeFile`, igual às transcrições).

*IPC (`ipc/thumbnails.ts` + preload):* `thumbnails:list-assets`, `:add-upload`, `:add-from-video`, `:pick-auto-ref`, `:delete-asset`, `:generate`, `:list-generations`, `:export`.

*UI (nova página **Thumbnails** na Sidebar):*
- Painel de composição: textarea de prompt (+ helper opcional com estrutura de CTR), seletor de referências em 3 abas (Upload / Biblioteca / Automático), preview das refs escolhidas, botão "Gerar" com nº de variantes.
- Galeria/histórico de gerações: download, "usar como referência de estilo", associar a um vídeo.
- Biblioteca de assets reusáveis (sobe rosto/cenário uma vez, reusa sempre).
- Aviso de privacidade explícito (imagens sobem pro Google só no ato da geração).
- `MissingKeyCTA` / upsell quando sem chave (Pro) ou plano Iniciante.

*Prompt:* `prompts/thumbnail.md` (template com heurísticas de CTR), shipado via `extraResources` como os demais.

*Custos + tutorial:* estende quota/telemetria com estimativa em US$ por geração; novo tópico de Ajuda "Gerar sua chave Gemini (Google AI Studio)" + seção Gemini em "Custos das APIs".

**Arquivos-chave previstos:**
- Backend: `prisma/schema.prisma` (+`ThumbnailAsset`, +`ThumbnailGeneration`) + migration; `src/main/services/thumbnails/` (`providers/types.ts`, `providers/gemini.ts`, `index.ts`); `src/main/ipc/thumbnails.ts`; `src/main/services/credentials.ts` (+`google_ai`).
- Prompt: `prompts/thumbnail.md`.
- Shared/preload: `src/shared/types.ts` (+tipos `Thumbnail*`, +`CredentialProvider` `google_ai`, +`ProviderKey` `gemini-image`, +`IsitubeAPI.thumbnails`), `src/preload/index.ts`.
- Renderer: `src/renderer/src/pages/ThumbnailsPage.tsx` + `pages/thumbnails/*`; item na Sidebar; campo de credencial Gemini em `pages/settings/`; tópicos da Ajuda.

**Como testar (previsto):**
1. Settings → cadastra a chave Gemini → "Testar conexão" fica verde.
2. Thumbnails → Biblioteca → "Adicionar do vídeo" pega a thumb de um outlier; sobe 1-2 fotos suas (`face`) + 1 foto do cenário (`scene`).
3. Escreve prompt, escolhe refs (identidade + cenário + estilo), "Gerar" → em alguns segundos aparecem 1 principal + N variantes.
4. Modo Automático: sistema escolhe a thumb de maior outlier como referência de estilo.
5. Baixa/exporta uma geração (dialog nativo). Histórico persiste após restart.
6. Sem chave (Pro) → CTA "configure sua chave Gemini". Iniciante → upsell.
7. Privacidade: banner deixa claro que as imagens sobem pro Google só na geração.

**Fora de escopo desta fase (registrado):**
- Proxy Gemini no isipanel pro Iniciante (fase futura).
- Overlay de texto via canvas / edição por região específica (v2 — por ora o texto vem do próprio modelo).
- Geração de vídeo/animação de thumbnail.

**Decisões de design (a confirmar na execução):**
- Dois papéis de referência (identidade vs estilo) modelados como `kind` no `ThumbnailAsset`.
- Imagens como BLOB no banco (padrão Kanban) — entram no backup do `.db`.
- `ImageProvider` abstrato pra trocar o motor sem tocar a UI.
- Reuso dos outliers já calculados pra "thumbs acima da média" e auto-pick — zero schema novo além do link `sourceVideoId`.

---

## Fase 13 — Canal próprio (OAuth) + auditoria/analyze reais ✅

**Objetivo:** Conectar o canal do próprio usuário via OAuth e trazer os relatórios reais (YouTube Analytics) — retenção, AVD, views, inscritos, receita — mais um agente de auditoria com IA em cima desses dados. Pré-requisito (app Google/OAuth) provisionado antes da fase (memória `youtube-oauth-own-channel-setup`).

**Decisões de produto:** conectar o canal = **Pro** (OAuth do próprio projeto Google do usuário, BYOK). Client tipo "App para computador" → fluxo loopback + PKCE, sem redirect URI registrado. Escopos `yt-analytics.readonly` + `yt-analytics-monetary.readonly` (receita).

**Entregue (3 fatias, validado ao vivo com o usuário):**

*Fatia 1a — Conexão (OAuth):* schema `YoutubeConnection` (singleton; client_secret e refresh_token criptografados via safeStorage) + migration `add_youtube_connection`; `services/youtube-connect/oauth.ts` (Authorization Code + PKCE S256, servidor http loopback `127.0.0.1`, `shell.openExternal`, troca/refresh de tokens, `InvalidGrantError`); `services/youtube-connect/index.ts` (config/connect/disconnect/status + `getAccessToken()` com cache e detecção de expiração do modo Teste → `needsReconnect`); página **Meu canal** (novo item na Sidebar): colar Client ID/Secret, conectar (abre o navegador), status, reconectar/desconectar, upsell pro Iniciante.

*Fatia 1b — Métricas reais:* `services/youtube-connect/analytics.ts` (`reports.query` com `ids=channel==MINE`: núcleo + receita best-effort + impressões/CTR best-effort + série diária); painel **Desempenho do canal** (stat cards + gráfico Views/dia reusando `LineChart` + seletor 7/28/90/365). Nota honesta: **CTR/impressões a API pública não expõe** (só no Studio); receita na moeda da conta AdSense.

*Fatia 2 — Agente de auditoria:* `AIService.auditChannel()` + `prompts/channel-audit.md` — Claude recebe as métricas do período atual **vs** anterior e devolve JSON estruturado (veredito, pontos fortes, findings com severidade + ação, ganhos rápidos), ancorado nos números. IPC `youtube:audit`; UI: botão "Auditar com IA" + relatório renderizado. Precisa de chave Anthropic (Pro BYOK).

*Incremento na Fase 12 (mesma rodada):* **Ajuste de thumbnails** — `ImageProvider.editImage` (Gemini edita a imagem base + instrução em texto, mantendo o rosto via fotos do personagem), serviço `adjustGeneration`, IPC `thumbnails:adjust`, botão "Ajustar" em cada thumb gerada (salva como nova geração).

**Arquivos-chave:** `src/main/services/youtube-connect/{oauth,index,analytics}.ts`, `src/main/ipc/youtube.ts`, `src/main/services/ai/AIService.ts` (+`auditChannel`), `prompts/channel-audit.md`; `src/renderer/src/pages/MeuCanalPage.tsx` + Sidebar/rota/View; `prisma/schema.prisma` (+`YoutubeConnection`) + migration; `src/shared/types.ts` + preload (+`youtube` API, +`ProviderKey` `youtube-analytics`, +tipos audit/summary); Fase 12: `thumbnails/providers/{types,gemini,mock}.ts` + `thumbnails/index.ts` (+`editImage`/`adjustGeneration`), `ipc/thumbnails.ts`, `ThumbnailsPage.tsx`.

**Decisões importantes:**
- **Loopback + PKCE, client Desktop** — aceita qualquer porta, sem redirect URI; evita um app OAuth "da isi" (que exigiria verificação do Google pra escopo sensível). Cada usuário usa o próprio projeto Google.
- **Modo Teste = refresh token de 7 dias** — o app detecta o `invalid_grant` e pede reconectar, sem quebrar.
- **CTR/impressões não vêm da API pública** — mostrado honestamente, sem inventar.
- **Auditoria = texto (Claude); thumbnail/ajuste = imagem (Gemini)** — chaves separadas.

**Aprofundamento da auditoria (mesmo ciclo, feito):** top vídeos com **retenção por vídeo** (título/thumb resolvidos via YouTube Data API), **fontes de tráfego** (busca/sugeridos/inscritos/externo…), e a auditoria passou a receber tudo isso pra recomendações vídeo a vídeo e de distribuição. Novos `getTopVideos`/`getTrafficSources`/`getInsights` em `analytics.ts`, IPC `youtube:get-insights`, UI (Top vídeos + Fontes de tráfego), prompt enriquecido. Fix: teto da auditoria subido pra 4000 tokens (o JSON truncava com o input maior).

**Fora de escopo (fica pra depois):** resolver o nome do canal (hoje "Meu canal" genérico — a API de Analytics não retorna o título); OAuth pro Iniciante via broker no isipanel; exportar a auditoria (PDF/MD).

---

## Como testar a fase atual

A cada fase, ao final, atualizo a seção `## Status atual` no topo deste arquivo e adiciono instruções de teste no bloco `Como testar` da fase. Sempre rodar:

```
npm run dev
```

E seguir o checklist da fase mais recente concluída.

---

## Onde os dados vivem

| Item | Em dev | Em produção (depois da Fase 7) |
|---|---|---|
| Banco SQLite | `prisma/dev.db` | `%APPDATA%\isiTube\data.db` |
| Theme/settings | banco SQLite (tabela `settings`) | mesmo |
| Chaves de API | banco SQLite (tabela `api_credentials`, encrypted) | mesmo |
| Prompts de IA | `prompts/*.md` | `<install>/resources/prompts/*.md` |
| Migrations | `prisma/migrations/` | `<install>/resources/migrations/` |
| Logs | console (electron-vite) | `%APPDATA%\isiTube\logs\` (a definir na Fase 7) |

---

## Scripts úteis

```bash
npm run dev           # roda em modo desenvolvimento (hot reload)
npm run build         # builda main + preload + renderer
npm run build:win     # gera instalador NSIS em dist/
npm run typecheck     # checa tipos sem buildar
npm run db:migrate    # cria/aplica migrations Prisma em dev
npm run db:studio     # abre Prisma Studio em http://localhost:5555
npm run db:reset      # apaga DB de dev e re-aplica todas migrations
```

---

## Fase 14 — DataForSEO (fonte de SEO real) ✅

**Objetivo:** Trocar o Keywords Everywhere pelo DataForSEO como fonte de volume/dificuldade e enriquecer o relatório de palavra-chave.

**Entregue:**
- `DataForSEOProvider` no slot `keywords_everywhere` (drop-in). Endpoint `keyword_overview` (Labs, com `include_clickstream_data`) com fallback pro `google_ads/search_volume`; retry sem clickstream se a conta não tem o add-on. Termo sem volume em lugar nenhum **lança erro → o score renormaliza** (não finge volume 0).
- Credencial `dataforseo` (login+senha, encriptada via DPAPI) + `DataForSEOSection` (2 campos) + `testDataForSEO` + telemetria por provider.
- Enriquecimento do card "Volume de busca": volume clickstream (cobertura long-tail), CPC, dificuldade real (`keyword_difficulty`), **sazonalidade** (`monthly_searches`, 12 meses) num mini-gráfico de barras com o mês de pico.
- **Ideias de palavras-chave** relacionadas via `keyword_ideas` (on-demand, `RelatedKeywordsPanel`), com volume real e clique pra analisar.
- Rótulos "Keywords Everywhere" → "Volume de busca" (card + barra de status).

**Arquivos-chave:** `src/main/services/keywords/providers/dataforseo.ts`, `src/main/services/keywords/index.ts`, `src/main/services/credentials.ts`, `src/main/ipc/keywords.ts`, `src/renderer/src/pages/settings/DataForSEOSection.tsx`, `src/renderer/src/pages/keywords/{KeywordResultCard,RelatedKeywordsPanel,SourceStatusBar}.tsx`.

**Decisões importantes:**
- `keyword_overview` cobre muito mais keyword (clickstream + long-tail) e é mais barato que `google_ads/search_volume` (US$ 0,09/chamada) — mas o Google Ads fica de fallback pra garantir cobertura de termos comerciais.
- `null` de volume ≠ volume 0: significa "sem dado pra esse termo" → a fonte cai como indisponível e o score usa só scraping+trends (renormaliza), em vez de derrubar a nota.

**Commits:** `acbcf33`, `f19e5d0`.

---

## Fase 15 — Criar (Ideação) + agentes de IA no card ✅

**Objetivo:** Transformar as sub-skills do claude-youtube em agentes dentro do app. Página "Criar" só com Ideação; SEO, gancho e roteiro **dentro do card**, operando no conteúdo específico e preenchendo os campos.

**Entregue:**
- **Ideação** (página Criar): 8 ideias de vídeo a partir do nicho + contexto. **Auto-pull** dos top vídeos reais do canal conectado (com retenção, via YouTube Analytics) e **títulos modelados no estilo** dos vídeos mais vistos da Biblioteca. Ideias **persistem** (`GeneratedIdea` + migração), listadas entre sessões, com apagar e **"Criar card no Kanban"** (promove com título + keyword + conceito de thumbnail).
- **Agentes de card** (CardEditorModal): campos novos (`description`, `tags`, `chapters`, `hashtags`, `hook`, `thumbnailPrompt` + 2 migrações).
  - **SEO/metadados:** 3 variações de título (modeladas na Biblioteca; ao escolher, vincula o vídeo como **referência de TÍTULO**), descrição, tags, capítulos, hashtags — preenche o card.
  - **Gancho→Roteiro:** 5 ganchos (mecanismo/risco/tráfego) → escolher salva em `hook` → **"Criar roteiro"** gera o `script` partindo do gancho.
- `card-agents` service + handlers `ai:card-seo/hooks/script/thumbnail-concept`; whitelist de `kanban:update-card` estendido pros campos novos.
- Prompts: `video-ideas.md`, `video-seo.md`, `video-hooks.md`, `video-script.md`, `thumbnail-concept.md`.

**Arquivos-chave:** `src/main/services/{ideas,card-agents}/index.ts`, `src/main/services/ai/AIService.ts`, `src/renderer/src/pages/CriarPage.tsx` + `criar/IdeateTool.tsx`, `src/renderer/src/pages/kanban/{CardEditorModal,CardSeoSection,CardScriptSection}.tsx`, `prompts/*`.

**Decisões importantes:**
- "Criar" fica só com Ideação; os demais agentes moram no card porque agem sobre um conteúdo específico e devem **preencher os campos** do card.
- Gancho é a etapa 1 do roteiro (escolher um gancho libera "Criar roteiro").
- Todos os agentes puxam o canal conectado automaticamente; a referência de título sai da Biblioteca.

**Commits:** `2ae9d39`, `9c003dd`.

---

## Fase 16 — Thumbnails: criação em 2 campos + conceito por IA ✅

**Objetivo:** Separar o brief do prompt na criação de thumbnail e ligar o card ao criador.

**Entregue:**
- **Criação em 2 campos:** campo 1 = brief (o que o usuário quer, **preservado**) → **"Gerar prompt"** (lê a referência de estilo via visão do Gemini, ou expande só o texto via novo `buildPromptFromText`) → campo 2 = prompt completo **editável** → **"Gerar thumbnail"**.
- **Botão "Criar thumbnail" no card:** leva ao criador com o brief pré-preenchido (conceito salvo no card ou **gerado na hora** pelo agente `generateThumbnailConcept`) e **pré-seleciona 3 thumbnails** mais vistas da Biblioteca como referência de estilo.
- **Dedup das referências:** guard contra o double-fire do StrictMode, dedup por `youtubeId` e auto-limpeza de assets de estilo duplicados (`dedupeStyleAssetsBySource`).

**Arquivos-chave:** `src/main/services/thumbnails/index.ts` + `providers/{gemini,mock,types}.ts`, `src/main/ipc/thumbnails.ts`, `src/renderer/src/pages/ThumbnailsPage.tsx`, `src/renderer/src/pages/kanban/CardEditorModal.tsx`, `src/renderer/src/stores/router.ts`.

**Decisões importantes:**
- O campo 1 recebe um **conceito** (brief), não um prompt técnico — o "Gerar prompt" é que produz o prompt final. Card sem conceito salvo gera um na hora com IA.
- Referência de estilo só entra no gerador como texto (via prompt) — a pessoa da referência nunca vaza pra imagem (mantém o padrão da Fase 12).

**Commit:** `fdc8c08` · **Release:** v0.8.0.

---

## Fase 17 — Bridge local + MCP pro Claude Code ✅

**Objetivo:** Deixar o Claude Code ler a Biblioteca e gerenciar o Kanban sem sair do editor.

**Entregue:**
- **Bridge HTTP** em `127.0.0.1` protegido por bearer token, rodando **dentro do main process**: `GET /library`, `GET /kanban/board`, `GET /kanban/card/:id`, `POST /kanban/card`, `PATCH /kanban/card/:id`, `POST /kanban/card/:id/move`. Opt-in em *Configurações → Integração MCP* (toggle, token, regenerar).
- **`mcp-server/`:** servidor MCP em Node com 6 tools (`library_search`, `kanban_board`, `get_card`, `create_card`, `update_card`, `move_card`) que proxeiam o bridge.
- **`.claude/skills/isitube/SKILL.md`:** roteamento das tools pro Claude Code.
- **Tag de formato no card:** campo `format` (`longo`|`short`|`live`|`estreia`) com seletor no editor e badge no board, validado no IPC, no `sanitizePatch` do bridge e como enum no MCP.

**Arquivos-chave:** `src/main/services/bridge/index.ts`, `src/main/ipc/bridge.ts`, `mcp-server/index.mjs`, `.claude/skills/isitube/SKILL.md`, `src/renderer/src/pages/settings/BridgeSection.tsx`, `src/renderer/src/pages/kanban/cardFormat.tsx`.

**Decisões importantes:**
- O bridge roda **no processo do app** e reusa o mesmo Prisma client e as mesmas funções de service das telas — sem dois writers, sem lógica duplicada. Foi isso que depois permitiu a Fase 18 emitir o evento de mudança num lugar só e cobrir UI e MCP de uma vez.
- Nunca escuta fora de `127.0.0.1`, e o bridge fica **desligado por padrão**.

**Commits:** `4e9f8be`, `0fbe7f3` · **Release:** v0.9.0.

---

## Fase 18 — Kanban instantâneo + campo Planejamento ✅

**Objetivo:** Fazer o board abrir na hora e refletir na hora o que o MCP muda.

**Entregue:**
- **Thumbnails fora do payload:** protocolo custom `isitube-thumb://kanban/<id>` serve os BLOBs sob demanda. Antes o `getBoard()` embutia cada imagem como data URL base64 — na base real, 4,14 MB de blobs viravam **~5,7 MB trafegados por IPC a cada carregamento**, e o refresh rodava depois de *toda* mutação (inclusive cada drag). Medido depois: **payload de 17,3 kB, `getBoard()` em 34 ms**.
- **Abertura instantânea:** o board saiu do `useState` da página pro store global `stores/kanban.ts`, com prefetch no boot do App — clicar em "Kanban" não espera round-trip nenhum. Refreshes concorrentes são coalescidos.
- **Mudanças ao vivo:** as 15 mutações do service emitem `events:kanban-changed`. Como o bridge usa as mesmas funções, o que o Claude Code muda via MCP aparece na tela na hora, mesmo com a página aberta há horas.
- **Drag & drop otimista** (e recolher coluna): o card gruda onde foi solto; o refresh só reverte se o IPC falhar.
- **Campo Planejamento:** coluna `planning` — anotações livres do criador (o que gravar, com quem, o que preparar). Seção no editor, selo no card do board e exposto no MCP.

**Arquivos-chave:** `src/main/services/kanban/protocol.ts`, `src/main/services/kanban/events.ts`, `src/main/services/kanban/index.ts`, `src/renderer/src/stores/kanban.ts`, `src/renderer/src/pages/KanbanPage.tsx`, `src/renderer/src/pages/kanban/CardPlanningSection.tsx`.

**Decisões importantes:**
- Thumbnail é **imutável por id** (editar cria outra linha), então a resposta do protocolo vai com `Cache-Control: immutable` — o Chromium busca em paralelo, fora da thread do JS, e não rebusca em refresh. Exigiu `registerSchemesAsPrivileged` antes do app ready e `isitube-thumb:` no `img-src` do CSP.
- O evento vive no **service**, não no handler de IPC: é o único ponto por onde UI e bridge passam, então cobre os dois sem instrumentar o bridge à parte.
- O campo Planejamento **não tem agente de IA** de propósito — é rascunho do criador, não texto que vai pro YouTube (isso é `script`/`description`).

**Commit:** `381678e` · **Release:** v0.10.0.

---
## Fase 19 — Biblioteca: dois marcadores de "em alta" ✅

**Objetivo:** Parar de perder a informação de que um vídeo salvo foi um destaque.

**Problema:** o selo sumia dos itens da Biblioteca com o tempo. No fim de cada atualização de canal o app limpa `flaggedAsOutlier` de **todos** os vídeos e só re-aplica nos publicados nos últimos 30 dias — passado disso o vídeo perde o selo mesmo tendo múltiplos da média do canal. (O `outlierPercent` nunca era apagado; só o booleano caía, então o número já estava no banco.)

**Entregue:** dois sinais independentes na Biblioteca, porque respondem a perguntas diferentes:
- **Em alta no período** (🔥 âmbar) — views/dia nos últimos 30d vs. os outros vídeos ativos do canal. Transitório por design: mede tração de agora. Continua vindo das colunas do banco, intocadas.
- **Acima da média do canal** (📈 esmeralda) — total de views vs. média histórica de views por vídeo do canal. Não expira. Calculado na leitura do `listLibrary`.

Cruzamento: vídeo novo bombando marca só período; clássico de 3 meses marca só vitalício; hit recente marca os dois. Legenda no topo da página e tooltip em cada selo — duas porcentagens coloridas lado a lado, sem rótulo, parecem a mesma métrica medida duas vezes.

**Arquivos-chave:** `src/main/services/library/index.ts` (`channelLifetimeAverages`, `projectLibraryItem`), `src/renderer/src/pages/LibraryPage.tsx`, `src/shared/types.ts` (`LibraryItem`).

**Decisões importantes:**
- O vitalício é **calculado na leitura**, não persistido: assim a aba "Vídeos em destaque" e os cards de canal seguem com o critério de tração recente, sem efeito colateral. O preço é recalcular por listagem — irrelevante no volume da Biblioteca (`take: 500`).
- Média vitalícia sai de `totalViewCount / videoCount` do canal (cobre o catálogo inteiro mesmo monitorando só parte dele), com fallback pra média dos vídeos guardados quando o canal não tem essas stats.
- Descartado congelar o valor no momento em que salva: não resolveria vídeo salvo já velho, que nunca teve selo pra congelar.

**Verificação:** na base real, os 2 itens salvos estavam **sem selo nenhum** e passaram a mostrar 808% (288k views / média 35,6k) e 396% (78k / 19,7k).

**Commit:** `12d93e9` · **Release:** v0.11.0.

---


## Pendências conhecidas

Itens levantados e **não resolvidos**. Nenhum deles quebra o app em runtime — a v0.10.0 está sadia.

### 1. `npm run typecheck` nunca passou — 148 erros ⏳

**Não é regressão.** Os imports quebrados existem desde o commit inicial (`2eb95f7`); `src/shared/types.ts` só cresceu (1130 → 1330 linhas), nada foi perdido. Esses tipos nunca foram escritos.

14 tipos que o preload e o renderer importam de `@shared/types` e que não existem em lugar nenhum do `src/`:

```
BackupExportResult   BackupImportResult    BackupInspectResult   BackupManifest
GithubBackupConfig   GithubBackupRelease   GithubListResult      GithubUploadResult
ChannelTimeSeriesMetric   ChannelTimeSeriesPayload
FreeIdeaSource   FreeKeywordIdea   FreeKeywordIdeasResult   SaveFileResult
```

Como o tipo `IsitubeAPI` não declara as seções correspondentes, cascateiam **70 erros TS2339** ("Property does not exist") em `api.backup.*`, `api.videos.remove`, `api.channels.removeMany`, `events.onCredentialsChanged` e afins. Distribuição: 70×TS2339, 21×TS2305, 15×TS2322, 14×TS7006, 6×TS6133, 6×TS2724, 6×TS2345, resto pulverizado.

**Por que não quebra:** o electron-vite/esbuild transpila sem checar tipos. O runtime nunca vê isso.

**Por que importa:** o Constraint 3 deste roadmap ("IPC tipado pelo `contextBridge`") não é verificado por ninguém — o compilador nunca valida o contrato entre main, preload e renderer. Isso já produziu drift real: na Fase 18, `IsitubeAPI.events` não declarava `onCredentialsChanged` embora o preload exponha há tempo. Não há CI nem hook de pre-commit que pegue.

**Como atacar:** definir os 14 tipos + completar as seções faltantes do `IsitubeAPI` deve derrubar a maioria. O resto (implicit `any`, imports não usados, mismatches) precisa ser olhado caso a caso — pode haver bug real escondido ali. Considerar um gate (`typecheck` no pre-commit ou CI) só **depois** de zerar, senão trava todo commit.

### 2. Arquivos de marketing soltos no repo ⏳

`isitube-benchmark.docx`, `isitube-oferta.md`, `isitube-vendas.html` e `marketing/` estão untracked. Decidir: entram no repo, vão pro `.gitignore`, ou saem da pasta do projeto.

### 3. `dist/` acumulando instaladores ⏳

3,7 GB em 22 `.exe` (os anteriores à v0.8.0 têm 159 MB cada). Já está no `.gitignore`, então é só disco local — dá pra apagar tudo menos o da versão corrente.

### 4. Validar a v0.10.0 instalada ⏳

A migração `add_card_planning` foi testada aplicando na base de dev (log `[migrations] Applied`, round-trip do campo ok), mas ainda **não** numa instalação real por cima da v0.9.0. Instalar e abrir uma vez pra confirmar.

---

## Como atualizar este roadmap

Ao concluir uma fase:
1. Atualizar `Status atual` no topo.
2. Mudar emoji da fase de ⏭️/⏳ para ✅.
3. Preencher seção `Entregue` da fase (era `Entregáveis previstos`).
4. Listar `Arquivos-chave` reais (não previstos).
5. Confirmar `Como testar` com instruções verificadas no app rodando.
6. Anotar `Decisões importantes` que divergiram do plano original.
7. Marcar a próxima fase como ⏭️ no resumo de fases.

Ao iniciar uma fase nova, **ler este arquivo inteiro antes** — é o contrato.
