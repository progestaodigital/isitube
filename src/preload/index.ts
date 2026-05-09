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
  KeywordIdeasResult,
  KeywordResult,
  KeywordSearchOptions,
  KeywordSource,
  KeywordSourceStatuses,
  KeywordSuggestionsPayload,
  LicenseInfo,
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

  events: {
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
