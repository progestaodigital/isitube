import { useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Router } from './router';
import { useThemeStore } from './stores/theme';
import { useToastStore } from './stores/toast';
import { ToastContainer } from './components/ui/Toast';
import { UpdatePopup } from './pages/channels/UpdatePopup';
import { VideoDetailModal } from './pages/videos/VideoDetailModal';
import { OnboardingModal } from './pages/onboarding/OnboardingModal';
import { LicenseGateModal } from './components/license/LicenseGateModal';
import { useLicense } from './hooks/useLicense';
import { useUpdateRunStore } from './stores/updateRun';

export function App() {
  const theme = useThemeStore((s) => s.theme);
  const loaded = useThemeStore((s) => s.loaded);
  const showToast = useToastStore((s) => s.show);
  const license = useLicense();

  useEffect(() => {
    useThemeStore.getState().load();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Bridge main-process toast events into the renderer toast store.
  useEffect(() => {
    const off = window.api.events.onToast((payload) => showToast(payload));
    return off;
  }, [showToast]);

  // Bridge update-run events para o store global. Subscrito uma vez aqui
  // no App pra que páginas que vêm e vão (Canais, Home) leiam o estado
  // atual via useUpdateRunStore sem perder track de uma execução que está
  // rodando "em background" relativo ao renderer.
  useEffect(() => {
    const start = useUpdateRunStore.getState().start;
    const complete = useUpdateRunStore.getState().complete;
    const offStarted = window.api.events.onUpdateRunStarted((run) => start(run));
    const offCompleted = window.api.events.onUpdateRunCompleted((run) => complete(run));
    return () => {
      offStarted();
      offCompleted();
    };
  }, []);

  // Loading state: theme + license. Show a minimal splash so the chrome
  // doesn't flash before we know whether to show the gate or the app.
  if (!loaded || license.loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-zinc-900 dark:bg-[#0f0f0f] dark:text-zinc-50">
        <div className="flex flex-col items-center gap-2 text-sm text-zinc-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
          <span>Inicializando…</span>
        </div>
      </div>
    );
  }

  // License gate: app is fully blocked until a valid license is in place.
  // We render only the modal (no Sidebar/Header/main) so the user can't see
  // a half-broken app behind it.
  if (license.info && !license.info.valid) {
    return (
      <div className="h-screen bg-white text-zinc-900 dark:bg-[#0f0f0f] dark:text-zinc-50">
        <LicenseGateModal
          info={license.info}
          submitting={license.submitting}
          onSubmit={license.setKey}
          onRetry={() => license.refresh(true)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900 dark:bg-[#0f0f0f] dark:text-zinc-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0f0f0f]">
          <Router />
        </main>
      </div>
      <ToastContainer />
      <UpdatePopup onActionTaken={() => { /* tab content reacts via its own listeners */ }} />
      <VideoDetailModal />
      <OnboardingModal ready={loaded} />
    </div>
  );
}
