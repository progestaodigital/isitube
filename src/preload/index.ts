import { contextBridge, ipcRenderer } from 'electron';
import type {
  AddChannelResult,
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
  IsitubeAPI,
  KeywordHistoryItem,
  LibraryActionResult,
  LibraryFilters,
  LibraryItem,
  KeywordIdeasResult,
  KeywordResult,
  KeywordSearchOptions,
  KeywordSource,
  KeywordSourceStatuses,
  KeywordSuggestionsPayload,
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

  ai: {
    generateKeywordIdeas: (seed: string): Promise<KeywordIdeasResult> =>
      ipcRenderer.invoke('ai:generate-keyword-ideas', seed),
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

  transcripts: {
    get: (videoId: string): Promise<VideoTranscript | null> =>
      ipcRenderer.invoke('transcripts:get', videoId),
    extract: (videoId: string): Promise<TranscriptExtractionResult> =>
      ipcRenderer.invoke('transcripts:extract', videoId),
    export: (videoId: string, format: TranscriptExportFormat): Promise<TranscriptExportResult> =>
      ipcRenderer.invoke('transcripts:export', videoId, format),
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
