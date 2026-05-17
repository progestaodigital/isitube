# isiTube — Roadmap de Construção

> Software desktop de inteligência competitiva e planejamento de conteúdo para criadores no YouTube.
> Stack: Electron + React + TypeScript + Vite + Prisma + SQLite + Vercel AI SDK + Claude.

**Status atual:** Fase 9 concluída (licença real + proxy isipanel + plano Iniciante/Pro) · Lançado em 17/05/2026 como v0.3.0 · Próxima: Fase 10 (KE + Trends + scraping reais)
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
| 10 | Wire up real: KE + Trends + scraping | ⏭️ próxima | Keywords Everywhere + Google Trends + scraping de SERP/transcrição (ex-8b) |

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

## Fase 10 — Wire up real: KE + Trends + scraping ⏳

**Objetivo:** Substituir os mocks restantes (Keywords Everywhere, Google Trends, scraping de SERP) por chamadas reais. **Despriorizada após Fase 9** — Anthropic + YouTube já estão reais (Fase 8a), e KE no plano iniciante depende de decisão futura sobre proxy (hoje fora do escopo do isipanel).

**Entregáveis previstos:**
- Instalar `ai`, `@ai-sdk/anthropic`, `zod`
- Implementar `AnthropicProvider` real usando Vercel AI SDK
- Implementar `YouTubeProvider` real (Google APIs Node.js client ou fetch direto)
- Implementar `KeywordsEverywhereProvider` real
- Implementar `TrendsProvider` real (google-trends-api ou implementação própria)
- Implementar scraping real para transcrição e SERP analysis
- Substituir o `testCredential` mock por validação real por provider:
  - Anthropic: `GET /v1/models`
  - YouTube: `GET /youtube/v3/channels?part=id&forUsername=GoogleDevelopers`
  - Keywords Everywhere: endpoint de validação
- Trocar `selectProvider()` em `services/ai/index.ts` para usar Anthropic quando credencial válida
- Trocar todos os providers mock em keywords/channels para versões reais
- Logs locais de uso e custo estimado por chamada de IA
- Página de status de saúde por provider (cota restante, créditos, latência média)

**Critério de aceitação:**
- Cadastrar chave real → testar conexão → validação real bate na API
- Pesquisar keyword → 3 fontes reais respondem (com degradação graciosa se uma falhar)
- Cadastrar canal real → vídeos reais aparecem
- Extrair transcrição real → texto verdadeiro do vídeo

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
