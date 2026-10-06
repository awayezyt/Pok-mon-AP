import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation, useSearch } from 'wouter';
import { Navigation } from './components/Navigation';
import { DiceHistoryPanel } from './components/DiceHistory';
import Home from './pages/Home';
import Attacks from './pages/Attacks';
import SheetView from './pages/SheetView';
import { DiceHistoryProvider } from './lib/DiceHistoryContext';
import Access from './pages/Access';
import Character from './pages/Character';
import GMMaster from './pages/GMMaster';
import PublicLibrary from './pages/PublicLibrary';
import { useSessionRole, restoreSession } from './lib/campaign';
import { hydrateGameState, startRealtimeSync } from './lib/cloudSync';
import { seedImportedCampaignData } from './lib/campaignSeed';
import { ThemeProvider } from './lib/theme';
import { ThemeFooter } from './components/ThemeFooter';

const queryClient = new QueryClient();

function Router() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { role } = useSessionRole();
  useEffect(() => {
    if (location !== '/sheet' && location !== '/') {
      try { sessionStorage.setItem('pokemon-sheet-origin', `${location}${search ? `?${search}` : ''}`); } catch { /* Navigation still has a role-based fallback. */ }
    }
  }, [location, search]);
  useEffect(() => {
    if (role === 'public' && location !== '/' && location !== '/publico' && location !== '/sheet') setLocation('/');
    if (role !== 'gm' && (location === '/mestre' || location === '/attacks' || location === '/pokemon' || location === '/fichas')) setLocation(role === 'player' ? '/personagem' : '/');
  }, [location, role, setLocation]);

  if (role === 'public' && location !== '/' && location !== '/publico' && location !== '/sheet') return null;
  if (role !== 'gm' && (location === '/mestre' || location === '/attacks' || location === '/pokemon' || location === '/fichas')) return null;
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <DiceHistoryPanel />
      <main className="flex-1 relative">
        <Switch>
          <Route path="/" component={Access} />
          <Route path="/fichas" component={Home} />
          <Route path="/pokemon" component={Home} />
          <Route path="/personagem" component={Character} />
          <Route path="/mestre" component={GMMaster} />
          <Route path="/publico" component={PublicLibrary} />
          <Route path="/attacks" component={Attacks} />
          <Route path="/sheet" component={SheetView} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <ThemeFooter />
    </div>
  );
}

function App() {
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let stopSync: (() => void) | undefined;
    void restoreSession().then(() => hydrateGameState())
      .then(() => seedImportedCampaignData())
      .then(() => {
        if (cancelled) return;
        stopSync = startRealtimeSync();
        setCloudError(false);
        setCloudReady(true);
      })
      .catch(() => {
        if (!cancelled) setCloudError(true);
      });
    return () => {
      cancelled = true;
      stopSync?.();
    };
  }, []);
  if (cloudError) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold">Servidor indisponível</h1>
          <p className="text-muted-foreground">Os dados só ficam no servidor. Conecte-se novamente para abrir a mesa.</p>
          <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }
  if (!cloudReady) return <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">Abrindo a mesa...</div>;
  return (
    <QueryClientProvider client={queryClient}>
      <DiceHistoryProvider>
        <TooltipProvider>
          <ThemeProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
          </ThemeProvider>
          <Toaster />
          <SonnerToaster richColors position="bottom-right" />
        </TooltipProvider>
      </DiceHistoryProvider>
    </QueryClientProvider>
  );
}

export default App;
