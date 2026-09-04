import { contextBridge, ipcRenderer } from 'electron';
import type {
  AddChannelResult,
  BridgeStatus,
  CardHooksResult,
  CardSeoResponse,
  CategoryActionResult,
  CategoryInfo,
  ChannelInfo,
  CredentialActionResult,
  CredentialProvider,
  CredentialStatus,
  ChannelTimeSeriesMetric,
  ChannelTimeSeriesPayload,
  EvergreenFilters,
  EvergreenVideo,
  ExtractedVideosFilters,
  FlaggedVideosFilters,
  FreeKeywordIdeasResult,
  IdeateInput,
  IdeasGenerateResult,
  SavedVideoIdea,
  IsitubeAPI,
  KeywordHistoryItem,
  LibraryActionResult,
  LibraryFilters,
  LibraryItem,
  KanbanBoard,
  KanbanCard,
  KanbanCardPatch,
  KanbanColumn,
  KanbanReferenceType,
  KanbanThumbnailUpload,
  GlobalSearchResult,
  KeywordIdeasResult,
  KeywordResult,
  KeywordSearchOptions,
  KeywordSource,
  KeywordSourceStatuses,
  KeywordSuggestionsPayload,
  RelatedKeywordsResult,
  LicenseInfo,
  MissedTask,
  ProviderSnapshot,
  QuotaSnapshot,
  ScheduleConfig,
  ScheduleRunResult,
  ScheduleTaskKind,
  BackupExportResult,
  BackupImportResult,
  BackupInspectResult,
  GithubBackupConfig,
  GithubListResult,
  GithubRepoListResult,
  GithubUploadResult,
  SaveFileResult,
  ScheduleInfo,
  StartupAction,
  ToastPayload,
  TranscriptExportFormat,
  TranscriptExportResult,
  TranscriptExtractionResult,
  UpdateRunInfo,
  VideoDetail,
  VideoInfo,
  VideoMetadataExtractionResult,
  VideoTranscript,
  ThumbnailAsset,
  ThumbnailAssetKind,
  ThumbnailAssetUpload,
  ThumbnailGeneration,
  ThumbnailGenerateInput,
  ThumbnailGenerateResult,
  ThumbnailExportResult,
  ThumbnailStudioStatus,
  ThumbnailCharacter,
  ThumbnailScene,
  ImageUpload,
  VideoThumbnailHit,
  YoutubeConnectionStatus,
  YoutubeConnectResult,
  YoutubeChannelSummary,
  YoutubeInsights,
  ChannelAuditResult,
} from '@shared/types';

const api: IsitubeAPI = {
  platform: process.platform,

  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  },

  credentials: {
    list: (): Promise<CredentialStatus[]> => ipcRenderer.invoke('credentials:list'),
    set: (provider: CredentialProvider, plainKey: string): Promise<CredentialActionResult> =>
      ipcRenderer.invoke('credentials:set', provider, plainKey),
    delete: (provider) => ipcRenderer.invoke('credentials:delete', provider),
    test: (provider) => ipcRenderer.invoke('credentials:test', provider),
  },

  bridge: {
    status: (): Promise<BridgeStatus> => ipcRenderer.invoke('bridge:status'),
    setEnabled: (enabled: boolean): Promise<BridgeStatus> =>
      ipcRenderer.invoke('bridge:set-enabled', enabled),
    regenerateToken: (): Promise<BridgeStatus> =>
      ipcRenderer.invoke('bridge:regenerate-token'),
  },
  ai: {
    generateKeywordIdeas: (seed: string): Promise<KeywordIdeasResult> =>
      ipcRenderer.invoke('ai:generate-keyword-ideas', seed),
    generateCardSeo: (cardId: string): Promise<CardSeoResponse> =>
      ipcRenderer.invoke('ai:card-seo', cardId),
    generateCardHooks: (cardId: string): Promise<CardHooksResult> =>
      ipcRenderer.invoke('ai:card-hooks', cardId),
    generateCardScript: (cardId: string, targetLengthMin: number): Promise<KanbanCard> =>
      ipcRenderer.invoke('ai:card-script', cardId, targetLengthMin),
    generateThumbnailConcept: (cardId: string): Promise<string> =>
      ipcRenderer.invoke('ai:card-thumbnail-concept', cardId),
  },
  ideas: {
    generate: (input: IdeateInput): Promise<IdeasGenerateResult> =>
      ipcRenderer.invoke('ideas:generate', input),
    list: (): Promise<SavedVideoIdea[]> => ipcRenderer.invoke('ideas:list'),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('ideas:delete', id),
    createCard: (id: string): Promise<KanbanCard> =>
      ipcRenderer.invoke('ideas:create-card', id),
  },

  keywords: {
    search: (term: string, options?: KeywordSearchOptions): Promise<KeywordResult> =>
      ipcRenderer.invoke('keywords:search', term, options),
    history: (limit?: number): Promise<KeywordHistoryItem[]> =>
      ipcRenderer.invoke('keywords:history', limit),
    autocomplete: (prefix: string): Promise<string[]> =>
      ipcRenderer.invoke('keywords:autocomplete', prefix),
    getSourceStatuses: (): Promise<KeywordSourceStatuses> =>
      ipcRenderer.invoke('keywords:get-source-statuses'),
    setSourceEnabled: (source: KeywordSource, enabled: boolean): Promise<void> =>
      ipcRenderer.invoke('keywords:set-source-enabled', source, enabled),
    generateFreeIdeas: (seed: string): Promise<FreeKeywordIdeasResult> =>
      ipcRenderer.invoke('keywords:generate-free-ideas', seed),
    getSuggestions: (): Promise<KeywordSuggestionsPayload> =>
      ipcRenderer.invoke('keywords:get-suggestions'),
    excludeSuggestion: (term: string): Promise<void> =>
      ipcRenderer.invoke('keywords:exclude-suggestion', term),
    testTrends: (): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('keywords:test-trends'),
    relatedKeywords: (term: string): Promise<RelatedKeywordsResult> =>
      ipcRenderer.invoke('keywords:related-keywords', term),
  },

  channels: {
    add: (urlOrId: string, categoryIds?: string[]): Promise<AddChannelResult> =>
      ipcRenderer.invoke('channels:add', urlOrId, categoryIds ?? []),
    list: (filters?: { categoryIds?: string[] }): Promise<ChannelInfo[]> =>
      ipcRenderer.invoke('channels:list', filters),
    remove: (channelId: string): Promise<void> =>
      ipcRenderer.invoke('channels:remove', channelId),
    removeMany: (channelIds: string[]): Promise<number> =>
      ipcRenderer.invoke('channels:remove-many', channelIds),
    removeAll: (): Promise<{ channels: number; videos: number }> =>
      ipcRenderer.invoke('channels:remove-all'),
    updateAll: (triggeredBy): Promise<UpdateRunInfo> =>
      ipcRenderer.invoke('channels:update-all', triggeredBy),
    getFlaggedVideos: (filters?: FlaggedVideosFilters): Promise<VideoInfo[]> =>
      ipcRenderer.invoke('channels:get-flagged-videos', filters),
    getChannelVideos: (channelId: string): Promise<VideoInfo[]> =>
      ipcRenderer.invoke('channels:get-channel-videos', channelId),
    backfill: (
      channelId: string
    ): Promise<{ success: boolean; message: string; ingested: number; skippedDeleted: number }> =>
      ipcRenderer.invoke('channels:backfill', channelId),
    backfillAll: (): Promise<{
      success: boolean;
      message: string;
      results: Array<{
        channelId: string;
        channelTitle: string;
        success: boolean;
        message: string;
        ingested: number;
        skippedDeleted: number;
      }>;
    }> => ipcRenderer.invoke('channels:backfill-all'),
    snapshotsStats: (): Promise<{
      videoSnapshots: number;
      channelSnapshots: number;
      videoCutoff: string;
      channelCutoff: string;
    }> => ipcRenderer.invoke('channels:snapshots-stats'),
    snapshotsCleanup: (): Promise<{
      videoSnapshots: number;
      channelSnapshots: number;
      videoCutoff: string;
      channelCutoff: string;
    }> => ipcRenderer.invoke('channels:snapshots-cleanup'),
    listUpdateRuns: (limit?: number): Promise<UpdateRunInfo[]> =>
      ipcRenderer.invoke('channels:list-update-runs', limit),
    getStartupAction: (): Promise<StartupAction> =>
      ipcRenderer.invoke('channels:get-startup-action'),
    dismissStartupSuggestion: (): Promise<void> =>
      ipcRenderer.invoke('channels:dismiss-startup-suggestion'),
    analyticsTimeSeries: (
      metric: ChannelTimeSeriesMetric,
      daysBack?: number,
      categoryIds?: string[]
    ): Promise<ChannelTimeSeriesPayload> =>
      ipcRenderer.invoke(
        'channels:analytics-timeseries',
        metric,
        daysBack ?? 30,
        categoryIds ?? []
      ),
    analyticsEvergreen: (filters?: EvergreenFilters): Promise<EvergreenVideo[]> =>
      ipcRenderer.invoke('channels:analytics-evergreen', filters),
    analyticsEvergreenReadiness: (): Promise<{
      totalUpdateRuns: number;
      intervalsAvailable: number;
      minNeeded: number;
    }> => ipcRenderer.invoke('channels:analytics-evergreen-readiness'),
  },

  categories: {
    list: (): Promise<CategoryInfo[]> => ipcRenderer.invoke('categories:list'),
    create: (name: string, color?: string | null): Promise<CategoryActionResult> =>
      ipcRenderer.invoke('categories:create', name, color ?? null),
    update: (
      id: string,
      name: string,
      color?: string | null
    ): Promise<CategoryActionResult> =>
      ipcRenderer.invoke('categories:update', id, name, color ?? null),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('categories:delete', id),
    setForChannel: (channelId: string, categoryIds: string[]): Promise<void> =>
      ipcRenderer.invoke('categories:set-for-channel', channelId, categoryIds),
  },

  schedule: {
    get: (): Promise<ScheduleInfo | null> => ipcRenderer.invoke('schedule:get'),
    set: (iso: string): Promise<ScheduleInfo> => ipcRenderer.invoke('schedule:set', iso),
    cancel: (): Promise<void> => ipcRenderer.invoke('schedule:cancel'),
  },

  videos: {
    getDetail: (videoId: string): Promise<VideoDetail | null> =>
      ipcRenderer.invoke('videos:get-detail', videoId),
    extractMetadata: (videoId: string): Promise<VideoMetadataExtractionResult> =>
      ipcRenderer.invoke('videos:extract-metadata', videoId),
    listExtracted: (filters?: ExtractedVideosFilters): Promise<VideoDetail[]> =>
      ipcRenderer.invoke('videos:list-extracted', filters),
    remove: (videoId: string): Promise<void> =>
      ipcRenderer.invoke('videos:remove', videoId),
    removeMany: (videoIds: string[]): Promise<number> =>
      ipcRenderer.invoke('videos:remove-many', videoIds),
    listDeleted: (): Promise<VideoDetail[]> => ipcRenderer.invoke('videos:list-deleted'),
    restore: (videoIds: string[]): Promise<number> =>
      ipcRenderer.invoke('videos:restore', videoIds),
    purge: (videoIds: string[]): Promise<number> =>
      ipcRenderer.invoke('videos:purge', videoIds),
    purgeAll: (): Promise<number> => ipcRenderer.invoke('videos:purge-all'),
    trashRetentionDays: (): Promise<number> =>
      ipcRenderer.invoke('videos:trash-retention-days'),
  },

  library: {
    add: (videoId: string, notes?: string | null): Promise<LibraryActionResult> =>
      ipcRenderer.invoke('library:add', videoId, notes ?? null),
    remove: (videoId: string): Promise<LibraryActionResult> =>
      ipcRenderer.invoke('library:remove', videoId),
    list: (filters?: LibraryFilters): Promise<LibraryItem[]> =>
      ipcRenderer.invoke('library:list', filters),
    updateNotes: (videoId: string, notes: string): Promise<LibraryActionResult> =>
      ipcRenderer.invoke('library:update-notes', videoId, notes),
    count: (): Promise<number> => ipcRenderer.invoke('library:count'),
  },

  search: {
    global: (query: string): Promise<GlobalSearchResult> =>
      ipcRenderer.invoke('search:global', query),
  },

  kanban: {
    getBoard: (): Promise<KanbanBoard> => ipcRenderer.invoke('kanban:get-board'),
    createColumn: (name: string): Promise<KanbanColumn> =>
      ipcRenderer.invoke('kanban:create-column', name),
    renameColumn: (columnId: string, name: string): Promise<void> =>
      ipcRenderer.invoke('kanban:rename-column', columnId, name),
    toggleColumnCollapsed: (columnId: string, collapsed: boolean): Promise<void> =>
      ipcRenderer.invoke('kanban:toggle-column-collapsed', columnId, collapsed),
    deleteColumn: (columnId: string): Promise<void> =>
      ipcRenderer.invoke('kanban:delete-column', columnId),
    reorderColumns: (columnIds: string[]): Promise<void> =>
      ipcRenderer.invoke('kanban:reorder-columns', columnIds),
    createCard: (columnId: string, title?: string): Promise<KanbanCard> =>
      ipcRenderer.invoke('kanban:create-card', columnId, title ?? ''),
    updateCard: (cardId: string, patch: KanbanCardPatch): Promise<KanbanCard> =>
      ipcRenderer.invoke('kanban:update-card', cardId, patch),
    moveCard: (cardId: string, toColumnId: string, toPosition: number): Promise<void> =>
      ipcRenderer.invoke('kanban:move-card', cardId, toColumnId, toPosition),
    deleteCard: (cardId: string): Promise<void> =>
      ipcRenderer.invoke('kanban:delete-card', cardId),
    addThumbnail: (cardId: string, upload: KanbanThumbnailUpload): Promise<KanbanCard> =>
      ipcRenderer.invoke('kanban:add-thumbnail', cardId, upload),
    addThumbnailFromGeneration: (cardId: string, generationId: string): Promise<KanbanCard> =>
      ipcRenderer.invoke('kanban:add-thumbnail-from-generation', cardId, generationId),
    exportThumbnail: (thumbnailId: string): Promise<ThumbnailExportResult> =>
      ipcRenderer.invoke('kanban:export-thumbnail', thumbnailId),
    deleteThumbnail: (thumbnailId: string): Promise<KanbanCard> =>
      ipcRenderer.invoke('kanban:delete-thumbnail', thumbnailId),
    setCoverThumbnail: (thumbnailId: string): Promise<KanbanCard> =>
      ipcRenderer.invoke('kanban:set-cover-thumbnail', thumbnailId),
    addReference: (
      cardId: string,
      videoId: string,
      refType: KanbanReferenceType
    ): Promise<KanbanCard> =>
      ipcRenderer.invoke('kanban:add-reference', cardId, videoId, refType),
    removeReference: (referenceId: string): Promise<KanbanCard> =>
      ipcRenderer.invoke('kanban:remove-reference', referenceId),
  },

  transcripts: {
    get: (videoId: string): Promise<VideoTranscript | null> =>
      ipcRenderer.invoke('transcripts:get', videoId),
    extract: (videoId: string): Promise<TranscriptExtractionResult> =>
      ipcRenderer.invoke('transcripts:extract', videoId),
    export: (videoId: string, format: TranscriptExportFormat): Promise<TranscriptExportResult> =>
      ipcRenderer.invoke('transcripts:export', videoId, format),
  },

  thumbnails: {
    listAssets: (kind?: ThumbnailAssetKind): Promise<ThumbnailAsset[]> =>
      ipcRenderer.invoke('thumbnails:list-assets', kind),
    addAssetFromUpload: (upload: ThumbnailAssetUpload): Promise<ThumbnailAsset> =>
      ipcRenderer.invoke('thumbnails:add-upload', upload),
    addAssetFromVideo: (
      videoId: string,
      kind?: ThumbnailAssetKind,
      label?: string
    ): Promise<ThumbnailAsset> =>
      ipcRenderer.invoke('thumbnails:add-from-video', videoId, kind, label),
    pickAutoStyleRef: (): Promise<ThumbnailAsset | null> =>
      ipcRenderer.invoke('thumbnails:pick-auto-ref'),
    pickTopStyleRefs: (limit?: number): Promise<ThumbnailAsset[]> =>
      ipcRenderer.invoke('thumbnails:pick-top-refs', limit),
    deleteAsset: (id: string): Promise<void> =>
      ipcRenderer.invoke('thumbnails:delete-asset', id),
    searchVideos: (query: string): Promise<VideoThumbnailHit[]> =>
      ipcRenderer.invoke('thumbnails:search-videos', query),
    listCharacters: (): Promise<ThumbnailCharacter[]> =>
      ipcRenderer.invoke('thumbnails:list-characters'),
    createCharacter: (name: string, notes?: string | null): Promise<ThumbnailCharacter> =>
      ipcRenderer.invoke('thumbnails:create-character', name, notes ?? null),
    addCharacterPhotos: (characterId: string, photos: ImageUpload[]): Promise<ThumbnailCharacter> =>
      ipcRenderer.invoke('thumbnails:add-character-photos', characterId, photos),
    removeCharacterPhoto: (photoId: string): Promise<void> =>
      ipcRenderer.invoke('thumbnails:remove-character-photo', photoId),
    renameCharacter: (
      id: string,
      name: string,
      notes?: string | null
    ): Promise<ThumbnailCharacter> =>
      ipcRenderer.invoke('thumbnails:rename-character', id, name, notes ?? null),
    deleteCharacter: (id: string): Promise<void> =>
      ipcRenderer.invoke('thumbnails:delete-character', id),
    listScenes: (): Promise<ThumbnailScene[]> => ipcRenderer.invoke('thumbnails:list-scenes'),
    createScene: (name: string, photo: ImageUpload): Promise<ThumbnailScene> =>
      ipcRenderer.invoke('thumbnails:create-scene', name, photo),
    renameScene: (id: string, name: string): Promise<ThumbnailScene> =>
      ipcRenderer.invoke('thumbnails:rename-scene', id, name),
    deleteScene: (id: string): Promise<void> =>
      ipcRenderer.invoke('thumbnails:delete-scene', id),
    buildPrompt: (
      styleAssetId: string | null,
      instructions: string,
      hasScene: boolean
    ): Promise<string> =>
      ipcRenderer.invoke('thumbnails:build-prompt', styleAssetId, instructions, hasScene),
    generate: (input: ThumbnailGenerateInput): Promise<ThumbnailGenerateResult> =>
      ipcRenderer.invoke('thumbnails:generate', input),
    adjust: (generationId: string, instruction: string): Promise<ThumbnailGenerateResult> =>
      ipcRenderer.invoke('thumbnails:adjust', generationId, instruction),
    listGenerations: (): Promise<ThumbnailGeneration[]> =>
      ipcRenderer.invoke('thumbnails:list-generations'),
    searchGenerations: (query: string): Promise<ThumbnailGeneration[]> =>
      ipcRenderer.invoke('thumbnails:search-generations', query),
    deleteGeneration: (id: string): Promise<void> =>
      ipcRenderer.invoke('thumbnails:delete-generation', id),
    export: (id: string): Promise<ThumbnailExportResult> =>
      ipcRenderer.invoke('thumbnails:export', id),
    status: (): Promise<ThumbnailStudioStatus> => ipcRenderer.invoke('thumbnails:status'),
    usdBrlRate: (): Promise<number> => ipcRenderer.invoke('thumbnails:usd-brl-rate'),
  },

  youtube: {
    status: (): Promise<YoutubeConnectionStatus> => ipcRenderer.invoke('youtube:status'),
    setConfig: (clientId: string, clientSecret: string): Promise<YoutubeConnectionStatus> =>
      ipcRenderer.invoke('youtube:set-config', clientId, clientSecret),
    connect: (): Promise<YoutubeConnectResult> => ipcRenderer.invoke('youtube:connect'),
    disconnect: (): Promise<void> => ipcRenderer.invoke('youtube:disconnect'),
    getSummary: (days: number): Promise<YoutubeChannelSummary> =>
      ipcRenderer.invoke('youtube:get-summary', days),
    getInsights: (days: number): Promise<YoutubeInsights> =>
      ipcRenderer.invoke('youtube:get-insights', days),
    audit: (days: number): Promise<ChannelAuditResult> =>
      ipcRenderer.invoke('youtube:audit', days),
  },

  license: {
    get: (forceRefresh?: boolean): Promise<LicenseInfo> =>
      ipcRenderer.invoke('license:get', forceRefresh ?? false),
    set: (key: string): Promise<LicenseInfo> => ipcRenderer.invoke('license:set', key),
    clear: (): Promise<void> => ipcRenderer.invoke('license:clear'),
  },

  quota: {
    list: (): Promise<QuotaSnapshot[]> => ipcRenderer.invoke('quota:list'),
  },

  health: {
    list: (): Promise<ProviderSnapshot[]> => ipcRenderer.invoke('health:list'),
  },

  schedules: {
    list: (): Promise<ScheduleConfig[]> => ipcRenderer.invoke('schedules:list'),
    get: (kind: ScheduleTaskKind): Promise<ScheduleConfig> =>
      ipcRenderer.invoke('schedules:get', kind),
    set: (
      kind: ScheduleTaskKind,
      patch: Partial<Pick<ScheduleConfig, 'mode' | 'time' | 'weekday'>>
    ): Promise<ScheduleConfig> => ipcRenderer.invoke('schedules:set', kind, patch),
    listMissed: (): Promise<MissedTask[]> => ipcRenderer.invoke('schedules:list-missed'),
    run: (kind: ScheduleTaskKind): Promise<ScheduleRunResult> =>
      ipcRenderer.invoke('schedules:run', kind),
    snooze: (kind: ScheduleTaskKind): Promise<void> =>
      ipcRenderer.invoke('schedules:snooze', kind),
  },

  dialog: {
    saveFile: (
      defaultName: string,
      extension: string,
      content: string
    ): Promise<SaveFileResult> =>
      ipcRenderer.invoke('dialog:save-file', defaultName, extension, content),
  },

  backup: {
    export: (): Promise<BackupExportResult> => ipcRenderer.invoke('backup:export'),
    inspect: (): Promise<BackupInspectResult> => ipcRenderer.invoke('backup:inspect'),
    restore: (filePath: string): Promise<BackupImportResult> =>
      ipcRenderer.invoke('backup:restore', filePath),
    githubGetConfig: (): Promise<GithubBackupConfig> =>
      ipcRenderer.invoke('backup:github:get-config'),
    githubSetConfig: (repo: string): Promise<void> =>
      ipcRenderer.invoke('backup:github:set-config', repo),
    githubListRepos: (): Promise<GithubRepoListResult> =>
      ipcRenderer.invoke('backup:github:list-repos'),
    githubUpload: (): Promise<GithubUploadResult> => ipcRenderer.invoke('backup:github:upload'),
    githubList: (): Promise<GithubListResult> => ipcRenderer.invoke('backup:github:list'),
    githubRestore: (releaseId: number): Promise<BackupImportResult> =>
      ipcRenderer.invoke('backup:github:restore', releaseId),
  },

  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
  },

  updates: {
    check: (): Promise<{
      currentVersion: string;
      latestVersion: string | null;
      isNewer: boolean;
      releaseUrl: string | null;
      releaseNotes: string | null;
      publishedAt: string | null;
      assetUrl: string | null;
      assetSize: number | null;
      assetId: number | null;
      error: string | null;
    }> => ipcRenderer.invoke('updates:check'),
    listAll: (): Promise<{
      releases: Array<{
        version: string;
        tagName: string;
        name: string;
        publishedAt: string;
        releaseUrl: string;
        releaseNotes: string | null;
        assetId: number | null;
        assetSize: number | null;
        isCurrent: boolean;
        isNewer: boolean;
        isOlder: boolean;
      }>;
      error: string | null;
    }> => ipcRenderer.invoke('updates:list-all'),
    downloadAndInstall: (
      assetId: number,
      fileName: string
    ): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('updates:download-and-install', assetId, fileName),
    openUrl: (url: string): Promise<void> => ipcRenderer.invoke('updates:open-url', url),
  },

  events: {
    onUpdateRunStarted: (handler) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: UpdateRunInfo) => handler(payload);
      ipcRenderer.on('events:update-run-started', listener);
      return () => {
        ipcRenderer.removeListener('events:update-run-started', listener);
      };
    },
    onUpdateRunCompleted: (handler) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: UpdateRunInfo) => handler(payload);
      ipcRenderer.on('events:update-run-completed', listener);
      return () => {
        ipcRenderer.removeListener('events:update-run-completed', listener);
      };
    },
    onToast: (handler) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: ToastPayload) => handler(payload);
      ipcRenderer.on('events:toast', listener);
      return () => {
        ipcRenderer.removeListener('events:toast', listener);
      };
    },
    onKanbanChanged: (handler) => {
      const listener = () => handler();
      ipcRenderer.on('events:kanban-changed', listener);
      return () => {
        ipcRenderer.removeListener('events:kanban-changed', listener);
      };
    },
    onCredentialsChanged: (handler) => {
      const listener = (
        _e: Electron.IpcRendererEvent,
        payload: { provider: CredentialProvider }
      ) => handler(payload);
      ipcRenderer.on('events:credentials-changed', listener);
      return () => {
        ipcRenderer.removeListener('events:credentials-changed', listener);
      };
    },
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error('[preload] Failed to expose API:', error);
  }
} else {
  // @ts-expect-error window typing handled in index.d.ts
  window.api = api;
}
