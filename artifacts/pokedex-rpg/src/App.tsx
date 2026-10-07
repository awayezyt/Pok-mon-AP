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
import { ServerStartupScreen, type StartupPhase } from './components/ServerStartupScreen';

const queryClient = new QueryClient();

async function checkApiHealth() {
  const response = await fetch('/api/healthz', { cache: 'no-store' });
  if (!response.ok) {
    const error = new Error(`API health check failed with status ${response.status}`);
    Object.assign(error, { retryable: response.status === 408 || response.status === 429 || response.status >= 500 });
    throw error;
  }
  const health = await response.json() as { status?: unknown };
  if (health.status !== 'ok') throw new Error('Resposta de saúde da API inválida.');
}

function canRetryStartup(error: unknown) {
  return error instanceof TypeError
    || (error instanceof Error && 'retryable' in error && error.retryable === true);
}

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
  const [startupPhase, setStartupPhase] = useState<StartupPhase>('server');
  const [startupElapsed, setStartupElapsed] = useState(0);
  const [startupRetryCount, setStartupRetryCount] = useState(0);
  const [retryToken, setRetryToken] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let stopSync: (() => void) | undefined;
    let retryTimeout: number | undefined;
    const startedAt = Date.now();
    setCloudReady(false);
    setCloudError(false);
    setStartupElapsed(0);
    setStartupRetryCount(0);
    const elapsedTimer = window.setInterval(() => {
      setStartupElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    const runStartupStep = async (phase: StartupPhase, task: () => Promise<unknown>) => {
      let attempt = 0;
      while (!cancelled) {
        setStartupPhase(phase);
        try {
          await task();
          return;
        } catch (error) {
          if (!canRetryStartup(error)) throw error;
          attempt += 1;
          setStartupRetryCount(count => count + 1);
          await new Promise<void>(resolve => {
            const delayMs = Math.min(1000 * (2 ** Math.min(attempt - 1, 3)), 8000);
            retryTimeout = window.setTimeout(resolve, delayMs);
          });
          retryTimeout = undefined;
        }
      }
    };

    void (async () => {
      try {
        await runStartupStep('server', checkApiHealth);
        await runStartupStep('session', restoreSession);
        await runStartupStep('campaign', hydrateGameState);
        await runStartupStep('prepare', seedImportedCampaignData);
        if (cancelled) return;
        stopSync = startRealtimeSync();
        setCloudReady(true);
      } catch {
        if (!cancelled) setCloudError(true);
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(elapsedTimer);
      if (retryTimeout !== undefined) window.clearTimeout(retryTimeout);
      stopSync?.();
    };
  }, [retryToken]);
  if (cloudError) {
    return (
      <ServerStartupScreen
        phase={startupPhase}
        elapsedSeconds={startupElapsed}
        retryCount={startupRetryCount}
        error
        onRetry={() => setRetryToken(token => token + 1)}
      />
    );
  }
  if (!cloudReady) {
    return (
      <ServerStartupScreen
        phase={startupPhase}
        elapsedSeconds={startupElapsed}
        retryCount={startupRetryCount}
      />
    );
  }
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
