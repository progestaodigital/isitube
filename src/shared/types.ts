// Shared types between main, preload, and renderer processes.
// All cross-process contracts live here so the typed IPC bridge stays in sync.

// =============================================================================
// Credentials
// =============================================================================

export type CredentialProvider =
  | 'anthropic'
  | 'youtube'
  | 'keywords_everywhere';

export type CredentialStatus = {
  provider: CredentialProvider;
  status: 'missing' | 'untested' | 'valid' | 'invalid';
  lastValidatedAt: string | null;
  hasValue: boolean;
};

export type CredentialActionResult = {
  success: boolean;
  message: string;
};

// =============================================================================
// AI
// =============================================================================

export type Difficulty = 'low' | 'medium' | 'high';
export type Volume = 'low' | 'medium' | 'high';

export type KeywordIdea = {
  term: string;
  rationale: string;
  estimatedDifficulty: Difficulty;
  estimatedVolume: Volume;
};

export type AIProviderName = 'mock' | 'anthropic';

export type AIGenerationMeta = {
  provider: AIProviderName;
  model: string | null;
  durationMs: number;
};

export type KeywordIdeasResult = {
  ideas: KeywordIdea[];
  meta: AIGenerationMeta;
};

// =============================================================================
// Keyword research (Module 5)
// =============================================================================

export type KeywordSource = 'scraping' | 'keywords_everywhere' | 'trends';
export type SourceStatus = 'ok' | 'unavailable' | 'error' | 'disabled';

export type TopResult = {
  position: number;
  title: string;
  channelName: string;
  viewCount: number;
  publishedAt: string;
  /** YouTube video id (11 chars). Null when unavailable (older mock data). */
  videoId: string | null;
};

export type ScrapingData = {
  topResults: TopResult[];
  averageAgeDays: number;
  highViewCountInTop: number;
  averageViewsTop: number;
  competitionScore: number;
};

export type KeywordsEverywhereData = {
  volume: number;
  cpc: number;
  difficultyScore: number;
};

export type TrendsTimeSeriesPoint = {
  date: string;
  value: number;
};

export type TrendsData = {
  trendDirection: 'rising' | 'stable' | 'declining';
  trendScore: number;
  timeSeries: TrendsTimeSeriesPoint[];
  risingQueries: string[];
};

export type SourceResult<T> = {
  source: KeywordSource;
  status: SourceStatus;
  data: T | null;
  errorMessage: string | null;
  fetchedAt: string;
  durationMs: number;
};

export type ScoreComponent = {
  name: string;
  source: KeywordSource;
  rawValue: number;
  normalizedValue: number;
  weight: number;
  contribution: number;
};

export type KeywordScore = {
  value: number | null;
  components: ScoreComponent[];
  explanation: string;
  missingSources: KeywordSource[];
};

export type KeywordResult = {
  id: string;
  term: string;
  searchedAt: string;
  cachedFromSearch: boolean;
  scraping: SourceResult<ScrapingData>;
  keywordsEverywhere: SourceResult<KeywordsEverywhereData>;
  trends: SourceResult<TrendsData>;
  score: KeywordScore;
};

export type KeywordHistoryItem = {
  id: string;
  term: string;
  searchedAt: string;
  scoreValue: number | null;
};

export type KeywordSourceStatuses = {
  scraping: { enabled: boolean };
  keywordsEverywhere: { enabled: boolean };
  trends: { enabled: boolean };
};

export type KeywordSearchOptions = {
  forceRefresh?: boolean;
};

// =============================================================================
// Channel-mined keyword suggestions (panel "Sugestões dos seus canais")
// =============================================================================

/**
 * Single suggested keyword mined from the user's channels (outlier videos or
 * evergreen ones). `scoreValue` and `scoreLastComputedAt` are filled when
 * a cached search exists for this term — null when the user hasn't run a
 * search (or pre-compute hasn't gotten to it) yet.
 */
export type KeywordSuggestion = {
  term: string;
  /** Where the term was mined: a curated tag (stronger signal) or a title n-gram. */
  source: 'tag' | 'title';
  /** Number of distinct videos this term appears on. */
  occurrences: number;
  sampleVideoIds: string[];
  /** Aggregate view count across the videos this term appears on. */
  totalViews: number;
  shortsCount: number;
  longCount: number;
  /** Cached score (0-100) from the most recent search for this term; null if uncomputed. */
  scoreValue: number | null;
  /** ISO timestamp of when the cached score was computed; null if uncomputed. */
  scoreLastComputedAt: string | null;
};

export type KeywordSuggestionsPayload = {
  outliers: KeywordSuggestion[];
  evergreen: KeywordSuggestion[];
};

// =============================================================================
// Channel monitoring (Module 1)
// =============================================================================

export type ChannelInfo = {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  totalViewCount: number | null;
  monitored: boolean;
  lastUpdatedAt: string | null;
  videoCountTracked: number; // videos we have stored locally
  flaggedCount: number;
  /** Average views nos vídeos publicados nos últimos `lookbackDays`. */
  recentAverageViews: number | null;
  recentVideoCount: number;
  lookbackDays: number;
  categories: Array<{ id: string; name: string; color: string | null }>;
};

export type VideoInfo = {
  id: string;
  youtubeId: string;
  channelId: string;
  channelTitle?: string;
  title: string;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  durationSec: number | null;
  publishedAt: string;
  channelAvgViewsAtCheck: number | null;
  outlierPercent: number | null;
  flaggedAsOutlier: boolean;
  /** Biblioteca pessoal — true se o usuário salvou esse vídeo. */
  inLibrary?: boolean;
  libraryAddedAt?: string | null;
  /**
   * Set only by getFlaggedVideos: indicates whether the per-video baseline was
   * the same-type subset of the channel ('type') or a fallback to the channel's
   * full mixed list because there were too few same-type videos in the window.
   */
  baselineKind?: 'type' | 'mixed';
  baselineCount?: number;
  /** Recent views/day for this video (set by getFlaggedVideos). */
  viewsPerDay?: number;
};

export type AddChannelResult = {
  success: boolean;
  message: string;
  channel?: ChannelInfo;
};

export type UpdateRunInfo = {
  id: string;
  triggeredBy: 'manual' | 'scheduled' | 'startup';
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'success' | 'partial' | 'failed';
  channelsTotal: number;
  channelsSuccessful: number;
  channelsFailed: number;
  videosNew: number;
  videosFlagged: number;
  errorMessage: string | null;
};

export type FlaggedVideosFilters = {
  channelId?: string;
  sinceDays?: number; // last N days of publishedAt
  minPercent?: number; // outlierPercent >= this
  categoryIds?: string[]; // OR — flagged from any of these categories
};

// =============================================================================
// Video metadata extraction (Module 2)
// =============================================================================

export type VideoDetail = VideoInfo & {
  description: string | null;
  tags: string[] | null;
  thumbnailHdUrl: string | null;
  language: string | null;
  category: string | null;
  liveBroadcastStatus: string | null;
  metadataExtractedAt: string | null;
  transcriptStatus: TranscriptStatus | null;
  transcriptLanguage: string | null;
  transcriptExtractedAt: string | null;
  /** Anotação livre do usuário pra esse vídeo na biblioteca. */
  libraryNotes: string | null;
};

// =============================================================================
// Biblioteca pessoal (Module 4)
// =============================================================================

/**
 * Item da biblioteca pessoal — `VideoDetail` enriquecido com a anotação
 * livre e a data de adição. Listagem é ordenada por `libraryAddedAt desc`
 * por padrão (último salvo no topo).
 */
export type LibraryItem = VideoDetail & {
  libraryAddedAt: string;
};

export type LibraryFilters = {
  /** Busca por termo no título do vídeo. */
  query?: string;
  channelId?: string;
  videoType?: VideoType;
  sort?: 'recent' | 'oldest' | 'mostViews' | 'title';
};

export type LibraryActionResult = {
  success: boolean;
  message: string;
  /** Estado final do vídeo após a operação (útil pra atualizar o botão sem refetch). */
  inLibrary: boolean;
};

export type VideoMetadataExtractionResult = {
  success: boolean;
  message: string;
  video?: VideoDetail;
};

export type ExtractedVideosFilters = {
  channelId?: string;
  flaggedOnly?: boolean;
};

// =============================================================================
// Video transcripts (Module 3)
// =============================================================================

export type TranscriptStatus = 'available' | 'unavailable';

export type TranscriptSegment = {
  start: number; // seconds from video start
  text: string;
};

export type VideoTranscript = {
  videoId: string;
  youtubeId: string;
  status: TranscriptStatus;
  language: string | null;
  segments: TranscriptSegment[];
  fullText: string;
  extractedAt: string | null;
};

export type TranscriptExtractionResult = {
  success: boolean;
  message: string;
  transcript?: VideoTranscript;
};

export type TranscriptExportFormat = 'txt' | 'md';

export type TranscriptExportResult = {
  success: boolean;
  message: string;
  path?: string;
};

// =============================================================================
// Licensing
// =============================================================================

export type LicensePlan = 'pro' | 'iniciante';

export type LicenseSlug = 'isitube' | 'isitubepro';

/**
 * Discriminator of license state. The renderer drives gate-modal UX off this
 * field; `valid: true` is convenience equivalent to `status === 'valid'`.
 *
 * - `valid`: license active, app fully unlocked
 * - `invalid`: chave não bate em nenhum produto (after both slugs tried)
 * - `hwid_mismatch`: chave + slug ok, máquina diferente da que bindou
 * - `expired`: licença ativa mas data de expiração passou
 * - `blocked`: admin bloqueou no painel
 * - `no_key`: nenhuma licença cadastrada (1ª execução)
 * - `expired_offline`: sem internet há mais que `grace_until`
 * - `network_error`: validate falhou por rede; cliente cai pro cache se houver
 * - `rate_limited`: 429 do painel; cliente cai pro cache se houver
 */
export type LicenseStatus =
  | 'valid'
  | 'invalid'
  | 'hwid_mismatch'
  | 'expired'
  | 'blocked'
  | 'no_key'
  | 'expired_offline'
  | 'network_error'
  | 'rate_limited';

export type LicenseInfo = {
  valid: boolean;
  status: LicenseStatus;
  plan: LicensePlan;
  planLabel: string;
  /** Source slug at the panel; null when status='no_key'. */
  slug: LicenseSlug | null;
  expiresAt: string | null;
  /** ISO; license is usable offline until this moment. */
  graceUntil: string | null;
  subscriptionUrl: string | null;
  supportUrl: string | null;
  lastValidatedAt: string | null;
  /** Whether this came from the stub provider (dev only). False in production. */
  isStub: boolean;
  reason: string | null;
};

export type LicenseActionResult = {
  success: boolean;
  message: string;
  info: LicenseInfo;
};

// =============================================================================
// Telemetria leve por provider externo (alimenta a tela "Status das integrações")
// =============================================================================

export type ProviderKey =
  | 'anthropic'
  | 'youtube-data-api'
  | 'youtube-scraping'
  | 'youtube-transcript'
  | 'youtube-autocomplete'
  | 'trends'
  | 'keywords-everywhere'
  | 'isipanel-validate'
  | 'github';

export type ProviderSnapshot = {
  key: ProviderKey;
  /** ISO timestamp da última chamada bem-sucedida. */
  lastSuccessAt: string | null;
  /** ISO timestamp da última falha. */
  lastErrorAt: string | null;
  /** Mensagem do último erro (truncada em 200 chars). */
  lastErrorMessage: string | null;
  /** Total de chamadas desde o boot do app. */
  totalCalls: number;
  /** Quantas dessas falharam. */
  totalFailures: number;
};

// =============================================================================
// Proxy quota tracking (Plano Iniciante via isipanel proxy)
// =============================================================================

/**
 * Which upstream the snapshot tracks. Each isipanel proxy emits X-Quota-*
 * headers per response; we cache the latest per API for renderer display.
 */
export type QuotaApi = 'anthropic' | 'youtube';

export type QuotaSnapshot = {
  api: QuotaApi;
  /** Units (YouTube) or cents BRL (Anthropic) consumed in the current period. */
  used: number;
  /** Same unit; remaining headroom in the current period. */
  remaining: number;
  /**
   * Period window key. 'YYYY-MM' for Anthropic (monthly reset, UTC) or
   * 'YYYY-MM-DD' for YouTube (daily reset, UTC).
   */
  period: string;
  /** Units this last call deducted (YouTube only; null for Anthropic). */
  lastCallCost: number | null;
  /** ISO timestamp when the snapshot was captured client-side. */
  recordedAt: string;
};

export type ScheduleInfo = {
  id: string;
  scheduledAt: string;
  active: boolean;
  cancelled: boolean;
  ranAt: string | null;
};

// =============================================================================
// Schedules — backup automático e checagem de atualização do app
// =============================================================================

/**
 * Tipos de tarefa agendável recorrente (diário/semanal). `backup` = upload do
 * .db pro GitHub Releases (precisa de PAT configurado). `channelUpdate` =
 * dispara o mesmo "Atualizar agora" da página Canais (busca métricas novas,
 * descobre vídeos novos, recalcula outliers).
 *
 * Distinto do `ScheduledUpdate` one-shot (tabela Prisma) que continua
 * disponível pra agendamento pontual de "rodar uma vez em data/hora X".
 */
export type ScheduleTaskKind = 'backup' | 'channelUpdate';

export type ScheduleMode = 'manual' | 'daily' | 'weekly';

export type ScheduleConfig = {
  kind: ScheduleTaskKind;
  mode: ScheduleMode;
  /** HH:MM no fuso local da máquina do usuário. */
  time: string;
  /** 0-6 (domingo=0). Usado só quando mode='weekly'. */
  weekday: number;
  /** ISO da última execução bem-sucedida. Null se nunca rodou. */
  lastRunAt: string | null;
};

export type MissedTask = {
  kind: ScheduleTaskKind;
  /** ISO de quando a execução deveria ter acontecido (mais recente missed). */
  expectedAt: string;
};

export type ScheduleRunResult = {
  success: boolean;
  message: string;
};

export type StartupAction =
  | { kind: 'missed-schedule'; schedule: ScheduleInfo }
  | { kind: 'suggest-update'; lastRunAt: string | null; channelsCount: number }
  | { kind: 'none' };

// =============================================================================
// Toast (renderer-side; sent from main via 'toast:show' event for completed
// background runs)
// =============================================================================

export type ToastPayload = {
  kind: 'success' | 'info' | 'error';
  title: string;
  description?: string;
};

// =============================================================================
// Evergreen detector
// =============================================================================

export type EvergreenVideo = {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  totalViewCount: number;
  /** Views/day in the most recent measured interval (last update). */
  viewsPerDay: number;
  /** How many of the most recent intervals had >100% of the channel average. */
  consecutiveAboveAverage: number;
  /** Last few interval percentages (chronological, oldest→newest). */
  recentPercentages: number[];
  /** Legacy: kept so existing UI doesn't break. Always 'window' in new algo. */
  basedOn: 'window' | 'all-time';
  snapshotCount: number;
  /** Duração do vídeo em segundos. Usado pra filtrar Shorts (≤180) vs longos no UI. */
  durationSec: number | null;
};

export type EvergreenFilters = {
  channelId?: string;
  categoryIds?: string[];
  minAgeDays?: number;
  /** Min number of consecutive recent intervals > channel average. Default 3. */
  minConsecutiveAboveAverage?: number;
  /** Optional absolute floor on most-recent views/day to filter noise. */
  minViewsPerDay?: number;
  videoType?: VideoType;
  sort?: 'viewsPerDay' | 'totalViews' | 'newest' | 'oldest';
  titleQuery?: string;
  /** Legacy field — no longer affects the new algorithm. */
  lookbackDays?: number;
};

export type VideoType = 'all' | 'shorts' | 'long' | 'unknown';

// =============================================================================
// Categories
// =============================================================================

export type CategoryInfo = {
  id: string;
  name: string;
  color: string | null;
  channelCount: number;
};

export type CategoryActionResult = {
  success: boolean;
  message: string;
  category?: CategoryInfo;
};

// =============================================================================
// GitHub repository selector (backup)
// =============================================================================

export type GithubRepoInfo = {
  fullName: string;
  private: boolean;
  description: string | null;
  pushedAt: string;
};

export type GithubRepoListResult = {
  success: boolean;
  message: string;
  repos?: GithubRepoInfo[];
};

// =============================================================================
// IPC bridge contract
// =============================================================================

export type IsitubeAPI = {
  platform: string;
  settings: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
  };
  credentials: {
    list: () => Promise<CredentialStatus[]>;
    set: (provider: CredentialProvider, plainKey: string) => Promise<CredentialActionResult>;
    delete: (provider: CredentialProvider) => Promise<void>;
    test: (provider: CredentialProvider) => Promise<CredentialActionResult>;
  };
  ai: {
    generateKeywordIdeas: (seed: string) => Promise<KeywordIdeasResult>;
  };
  keywords: {
    search: (term: string, options?: KeywordSearchOptions) => Promise<KeywordResult>;
    history: (limit?: number) => Promise<KeywordHistoryItem[]>;
    autocomplete: (prefix: string) => Promise<string[]>;
    getSourceStatuses: () => Promise<KeywordSourceStatuses>;
    setSourceEnabled: (source: KeywordSource, enabled: boolean) => Promise<void>;
    generateFreeIdeas: (seed: string) => Promise<FreeKeywordIdeasResult>;
    getSuggestions: () => Promise<KeywordSuggestionsPayload>;
    excludeSuggestion: (term: string) => Promise<void>;
    testTrends: () => Promise<{ success: boolean; message: string }>;
  };
  channels: {
    add: (urlOrId: string) => Promise<AddChannelResult>;
    list: () => Promise<ChannelInfo[]>;
    remove: (channelId: string) => Promise<void>;
    updateAll: (triggeredBy?: 'manual' | 'scheduled' | 'startup') => Promise<UpdateRunInfo>;
    getFlaggedVideos: (filters?: FlaggedVideosFilters) => Promise<VideoInfo[]>;
    getChannelVideos: (channelId: string) => Promise<VideoInfo[]>;
    listUpdateRuns: (limit?: number) => Promise<UpdateRunInfo[]>;
    getStartupAction: () => Promise<StartupAction>;
    dismissStartupSuggestion: () => Promise<void>;
  };
  videos: {
    getDetail: (videoId: string) => Promise<VideoDetail | null>;
    extractMetadata: (videoId: string) => Promise<VideoMetadataExtractionResult>;
    listExtracted: (filters?: ExtractedVideosFilters) => Promise<VideoDetail[]>;
  };
  library: {
    add: (videoId: string, notes?: string | null) => Promise<LibraryActionResult>;
    remove: (videoId: string) => Promise<LibraryActionResult>;
    list: (filters?: LibraryFilters) => Promise<LibraryItem[]>;
    updateNotes: (videoId: string, notes: string) => Promise<LibraryActionResult>;
    count: () => Promise<number>;
  };
  transcripts: {
    get: (videoId: string) => Promise<VideoTranscript | null>;
    extract: (videoId: string) => Promise<TranscriptExtractionResult>;
    export: (videoId: string, format: TranscriptExportFormat) => Promise<TranscriptExportResult>;
  };
  license: {
    get: (forceRefresh?: boolean) => Promise<LicenseInfo>;
    set: (licenseKey: string) => Promise<LicenseInfo>;
    clear: () => Promise<void>;
  };
  quota: {
    /** Latest cached quota snapshots (one per API; absent until first proxy call). */
    list: () => Promise<QuotaSnapshot[]>;
  };
  health: {
    /** Snapshot in-memory dos providers externos desde o boot. */
    list: () => Promise<ProviderSnapshot[]>;
  };
  schedules: {
    list: () => Promise<ScheduleConfig[]>;
    get: (kind: ScheduleTaskKind) => Promise<ScheduleConfig>;
    set: (
      kind: ScheduleTaskKind,
      patch: Partial<Pick<ScheduleConfig, 'mode' | 'time' | 'weekday'>>
    ) => Promise<ScheduleConfig>;
    listMissed: () => Promise<MissedTask[]>;
    run: (kind: ScheduleTaskKind) => Promise<ScheduleRunResult>;
    snooze: (kind: ScheduleTaskKind) => Promise<void>;
  };
  schedule: {
    get: () => Promise<ScheduleInfo | null>;
    set: (scheduledAtIso: string) => Promise<ScheduleInfo>;
    cancel: () => Promise<void>;
  };
  events: {
    onUpdateRunStarted: (handler: (run: UpdateRunInfo) => void) => () => void;
    onUpdateRunCompleted: (handler: (run: UpdateRunInfo) => void) => () => void;
    onToast: (handler: (payload: ToastPayload) => void) => () => void;
  };
};
