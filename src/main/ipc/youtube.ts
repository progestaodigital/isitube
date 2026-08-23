import { ipcMain } from 'electron';
import {
  connect,
  disconnect,
  getConnectionStatus,
  setOAuthConfig,
} from '../services/youtube-connect';
import { getChannelSummary, getInsights } from '../services/youtube-connect/analytics';
import { getAIService } from '../services/ai';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clampDays(days: unknown): number {
  return typeof days === 'number' && days > 0 ? Math.min(Math.floor(days), 730) : 28;
}

export function registerYoutubeHandlers(): void {
  ipcMain.handle('youtube:status', async () => getConnectionStatus());

  ipcMain.handle('youtube:get-summary', async (_e, days: unknown) => {
    const d = clampDays(days);
    const end = new Date();
    const start = new Date(end.getTime() - d * 86_400_000);
    return getChannelSummary(ymd(start), ymd(end));
  });

  ipcMain.handle('youtube:get-insights', async (_e, days: unknown) => {
    const d = clampDays(days);
    const end = new Date();
    const start = new Date(end.getTime() - d * 86_400_000);
    return getInsights(ymd(start), ymd(end));
  });

  ipcMain.handle('youtube:audit', async (_e, days: unknown) => {
    const d = clampDays(days);
    const end = new Date();
    const start = new Date(end.getTime() - d * 86_400_000);
    const prevEnd = new Date(start.getTime() - 86_400_000);
    const prevStart = new Date(prevEnd.getTime() - d * 86_400_000);

    const [current, previous, insights] = await Promise.all([
      getChannelSummary(ymd(start), ymd(end)),
      getChannelSummary(ymd(prevStart), ymd(prevEnd)),
      getInsights(ymd(start), ymd(end)),
    ]);

    const ai = await getAIService();
    if (!ai) {
      throw new Error(
        'Configure a IA (chave da Anthropic em Configurações → Inteligência Artificial) para gerar a auditoria.'
      );
    }

    const strip = (s: typeof current) => {
      const { timeSeries, ...rest } = s;
      void timeSeries;
      return rest;
    };
    return ai.auditChannel({
      periodDays: d,
      current: strip(current),
      previous: strip(previous),
      topVideos: insights.topVideos,
      trafficSources: insights.trafficSources,
    });
  });

  ipcMain.handle('youtube:set-config', async (_e, clientId: unknown, clientSecret: unknown) => {
    if (typeof clientId !== 'string' || typeof clientSecret !== 'string') {
      throw new Error('youtube:set-config expects (clientId, clientSecret)');
    }
    return setOAuthConfig(clientId, clientSecret);
  });

  ipcMain.handle('youtube:connect', async () => connect());

  ipcMain.handle('youtube:disconnect', async () => disconnect());
}
