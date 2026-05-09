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

export function App() {
  const theme = useThemeStore((s) => s.theme);
  const loaded = useThemeStore((s) => s.loaded);
  const showToast = useToastStore((s) => s.show);

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

  return (
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900 dark:bg-[#0f0f0f] dark:text-zinc-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0f0f0f]">
          {loaded && <Router />}
        </main>
      </div>
      <ToastContainer />
      <UpdatePopup onActionTaken={() => { /* tab content reacts via its own listeners */ }} />
      <VideoDetailModal />
      <OnboardingModal ready={loaded} />
    </div>
  );
}
