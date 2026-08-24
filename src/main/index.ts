import { app, BrowserWindow, shell, nativeTheme } from 'electron';
import { join } from 'node:path';
import { registerIpcHandlers } from './ipc';
import { disconnectPrisma, getPrisma } from './db';
import { ensureMigrationsApplied } from './db/migrations';
import { scheduleNextTimer } from './services/channels/scheduler';
import { startScheduler } from './services/schedules';
import { initBridge, stopBridge } from './services/bridge';
import { purgeExpiredDeletedVideos } from './services/videos';

const isDev = !app.isPackaged;

function resolveIconPath(): string | undefined {
  // In dev, the icon lives at the project root under build/icon.png.
  // In production, the icon is baked into the .exe by electron-builder, so
  // BrowserWindow uses it automatically — but we still pass it for the
  // window-frame icon (some Windows themes display it).
  if (app.isPackaged) {
    return join(process.resourcesPath, 'build', 'icon.png');
  }
  return join(__dirname, '../../build/icon.png');
}

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'isiTube',
    icon: resolveIconPath(),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f0f0f' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (isDev && rendererUrl) {
    mainWindow.loadURL(rendererUrl);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  try {
    // Apply pending migrations before any service touches the DB. Idempotent —
    // already-applied migrations are skipped via _prisma_migrations tracking.
    // This is what makes the packaged installer work on a fresh machine.
    await ensureMigrationsApplied();
    await getPrisma().setting.count();
  } catch (error) {
    console.error('[isiTube] Database init failed:', error);
  }

  registerIpcHandlers();
  createMainWindow();

  // Restore the background scheduler timer for any active future-dated schedule.
  // Past-due schedules are surfaced via getStartupAction() and handled by the
  // renderer with a "missed schedule" modal — not auto-fired here.
  try {
    await scheduleNextTimer();
  } catch (err) {
    console.error('[isiTube] Failed to schedule background timer:', err);
  }

  // In-session scheduler pras tasks recorrentes (backup + verificação de
  // atualização). Tick de 1min. Tasks missed quando o app estava fechado
  // são detectadas no boot do renderer via schedules:list-missed e um
  // modal pergunta "Rodar agora ou Adiar".
  startScheduler();

  // Bridge local (MCP do Claude Code): sobe se o usuário habilitou nas
  // configurações. Só escuta em 127.0.0.1 e exige bearer token.
  initBridge();

  // Lixeira: purge silencioso de vídeos soft-deleted há mais de 30d.
  // Roda no boot e a cada 12h enquanto o app fica aberto. Erros são
  // logados mas não interrompem o boot.
  const runTrashPurge = async () => {
    try {
      const n = await purgeExpiredDeletedVideos();
      if (n > 0) console.log(`[trash] auto-purged ${n} expired video(s)`);
    } catch (err) {
      console.error('[trash] auto-purge failed:', err);
    }
  };
  runTrashPurge();
  setInterval(runTrashPurge, 12 * 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', async () => {
  await stopBridge();
  await disconnectPrisma();
  if (process.platform !== 'darwin') app.quit();
});
