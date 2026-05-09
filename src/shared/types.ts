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
// Channel monitoring (Module 1)
// =============================================================================

export type ChannelInfo = {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  monitored: boolean;
  lastUpdatedAt: string | null;
  videoCountTracked: number; // videos we have stored locally
  flaggedCount: number;
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

export type LicenseInfo = {
  valid: boolean;
  plan: LicensePlan;
  planLabel: string;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  isStub: boolean;
  reason: string | null;
};

export type ScheduleInfo = {
  id: string;
  scheduledAt: string;
  active: boolean;
  cancelled: boolean;
  ranAt: string | null;
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
  transcripts: {
    get: (videoId: string) => Promise<VideoTranscript | null>;
    extract: (videoId: string) => Promise<TranscriptExtractionResult>;
    export: (videoId: string, format: TranscriptExportFormat) => Promise<TranscriptExportResult>;
  };
  license: {
    get: (forceRefresh?: boolean) => Promise<LicenseInfo>;
  };
  schedule: {
    get: () => Promise<ScheduleInfo | null>;
    set: (scheduledAtIso: string) => Promise<ScheduleInfo>;
    cancel: () => Promise<void>;
  };
  events: {
    onUpdateRunCompleted: (handler: (run: UpdateRunInfo) => void) => () => void;
    onToast: (handler: (payload: ToastPayload) => void) => () => void;
  };
};
