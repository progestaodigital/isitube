import { useRouterStore } from './stores/router';
import { HomePage } from './pages/HomePage';
import { ChannelsPage } from './pages/ChannelsPage';
import { KeywordsPage } from './pages/KeywordsPage';
import { VideosPage } from './pages/VideosPage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';

export function Router() {
  const view = useRouterStore((s) => s.view);

  switch (view) {
    case 'home':
      return <HomePage />;
    case 'channels':
      return <ChannelsPage />;
    case 'keywords':
      return <KeywordsPage />;
    case 'videos':
      return <VideosPage />;
    case 'library':
      return <LibraryPage />;
    case 'settings':
      return <SettingsPage />;
    case 'help':
      return <HelpPage />;
  }
}
