export type GameState = Record<string, unknown>;
export type SyncConnectionState = 'connecting' | 'connected' | 'saving' | 'offline' | 'error';

export interface SyncStatusSnapshot {
  state: SyncConnectionState;
  message?: string;
}

let serverState: GameState = {};
let serverRevision = 0;
let writeQueue: Promise<void> = Promise.resolve();
let latestWriteId = 0;
let pendingWrites = 0;
let refreshInFlight: Promise<void> | null = null;
let stopRealtimeSync: (() => void) | null = null;
let syncStatus: SyncStatusSnapshot = { state: 'connecting' };

export function getServerCollection<T>(name: string, fallback: T): T {
  return (serverState[name] as T | undefined) ?? fallback;
}

export function getSyncStatus(): SyncStatusSnapshot {
  return syncStatus;
}

function setSyncStatus(state: SyncConnectionState, message?: string) {
  syncStatus = { state, ...(message ? { message } : {}) };
  window.dispatchEvent(new CustomEvent<SyncStatusSnapshot>('pokemon-rpg-sync-status', {
    detail: syncStatus,
  }));
}

function getRevision(response: Response, fallback: number) {
  const revision = Number(response.headers.get('X-State-Revision'));
  return Number.isInteger(revision) && revision >= 0 ? revision : fallback;
}

function stateEtag(revision: number) {
  return `"campaign-state-${revision}"`;
}

async function requestState() {
  const response = await fetch('/api/state', { cache: 'no-store' });
  if (!response.ok) throw new Error(`State read failed with status ${response.status}`);
  return {
    state: await response.json() as GameState,
    revision: getRevision(response, 0),
  };
}

function isRetryable(error: unknown): boolean {
  return error instanceof TypeError
    || (error instanceof Error && 'retryable' in error && error.retryable === true);
}

async function writePatch(patch: GameState, writeId: number) {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const error = new Error(`State write failed with status ${response.status}`);
        Object.assign(error, {
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        });
        throw error;
      }

      const savedState = await response.json() as GameState;
      serverRevision = getRevision(response, serverRevision);
      // Text inputs save on every change. A slower response from an older
      // request must not replace a newer optimistic edit while the user types.
      if (writeId === latestWriteId) {
        serverState = savedState;
        window.dispatchEvent(new CustomEvent('pokemon-rpg-state-change'));
      }
      return;
    } catch (error) {
      if (!isRetryable(error)) throw error;

      setSyncStatus('offline', 'A gravação será repetida quando o servidor responder.');
      const delay = Math.min(750 * (2 ** Math.min(attempt, 4)), 12000);
      attempt += 1;
      await new Promise(resolve => window.setTimeout(resolve, delay));
    }
  }
}

export function syncGameState(patch: GameState, options?: { throwOnError?: boolean }) {
  const writeId = ++latestWriteId;
  pendingWrites += 1;
  // Keep subsequent edits based on the newest local snapshot even while an
  // earlier request is in flight.
  serverState = { ...serverState, ...patch };
  setSyncStatus('saving');
  const next = writeQueue.then(() => writePatch(patch, writeId), () => writePatch(patch, writeId));
  writeQueue = next.then(() => undefined, () => undefined);
  return next.then(() => {
    pendingWrites -= 1;
    setSyncStatus(pendingWrites ? 'saving' : 'connected');
  }).catch(error => {
    pendingWrites -= 1;
    setSyncStatus('error', error instanceof Error ? error.message : 'Não foi possível salvar as alterações.');
    window.dispatchEvent(new CustomEvent('pokemon-rpg-sync-error', { detail: error }));
    if (options?.throwOnError) throw error;
  });
}

export async function hydrateGameState() {
  setSyncStatus('connecting');
  const result = await requestState();
  serverState = result.state;
  serverRevision = result.revision;
  setSyncStatus('connected');
  return true;
}

export async function refreshGameState(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  if (pendingWrites > 0) return;

  const requestWriteId = latestWriteId;
  refreshInFlight = (async () => {
    try {
      const response = await fetch('/api/state', {
        cache: 'no-store',
        headers: { 'If-None-Match': stateEtag(serverRevision) },
      });

      if (response.status === 304) {
        if (requestWriteId === latestWriteId && pendingWrites === 0) setSyncStatus('connected');
        return;
      }
      if (!response.ok) {
        const error = new Error(`State refresh failed with status ${response.status}`);
        Object.assign(error, { retryable: response.status === 408 || response.status === 429 || response.status >= 500 });
        throw error;
      }

      const nextState = await response.json() as GameState;
      const nextRevision = getRevision(response, serverRevision);
      // A local edit may have started while this request was in flight. Keep
      // that optimistic state and fetch the latest server revision next time.
      if (requestWriteId !== latestWriteId || pendingWrites > 0) return;
      if (nextRevision !== serverRevision) {
        serverState = nextState;
        serverRevision = nextRevision;
        window.dispatchEvent(new CustomEvent('pokemon-rpg-state-change'));
      }
      setSyncStatus('connected');
    } catch (error) {
      if (pendingWrites === 0) {
        const retryable = isRetryable(error);
        setSyncStatus(
          retryable ? 'offline' : 'error',
          retryable
            ? 'Sem resposta do servidor da mesa; tentando novamente.'
            : error instanceof Error ? error.message : 'Não foi possível atualizar os dados compartilhados.',
        );
      }
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function startRealtimeSync() {
  if (stopRealtimeSync) return stopRealtimeSync;

  let stopped = false;
  let timer = 0;
  const refresh = () => { void refreshGameState(); };
  // navigator.onLine may describe internet access rather than reachability of
  // this same-origin API (for example behind an app preview proxy). Confirm
  // the server before marking campaign sync as offline.
  const onOffline = () => { void refreshGameState(); };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  const schedulePoll = () => {
    if (stopped) return;
    const interval = document.visibilityState === 'visible' ? 2000 : 15000;
    timer = window.setTimeout(() => {
      void refreshGameState().finally(schedulePoll);
    }, interval);
  };
  const cleanup = () => {
    stopped = true;
    window.clearTimeout(timer);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('online', refresh);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (stopRealtimeSync === cleanup) stopRealtimeSync = null;
  };

  stopRealtimeSync = cleanup;
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisibilityChange);
  schedulePoll();
  return cleanup;
}