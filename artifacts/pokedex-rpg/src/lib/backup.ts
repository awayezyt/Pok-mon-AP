import { getServerCollection, syncGameState } from './cloudSync';

export const GAME_STATE_KEYS = [
  'characters', 'pokemon', 'attacks', 'history', 'notes',
  'trainers', 'provisionalItems', 'gmBoard', 'story', 'formulaSettings', 'gmHistory',
] as const;

export type GameStateKey = typeof GAME_STATE_KEYS[number];
export type GameState = Partial<Record<GameStateKey, unknown>>;

export function readCompleteGameState(): GameState {
  return Object.fromEntries(
    GAME_STATE_KEYS
      .map(name => [name, getServerCollection(name, undefined)])
      .filter(([, value]) => value !== undefined),
  ) as GameState;
}

export async function createGameBackup() {
  // Backups deliberately request inline image data so exported files remain
  // portable and compatible with older app versions.
  const response = await fetch('/api/state?media=inline', {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Não foi possível carregar os dados para o backup (${response.status}).`);
  }
  const state = await response.json() as GameState;
  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    ...Object.fromEntries(
      GAME_STATE_KEYS
        .filter(key => Object.prototype.hasOwnProperty.call(state, key))
        .map(key => [key, state[key]]),
    ),
  };
}

export function importGameState(payload: unknown): GameState {
  if (Array.isArray(payload)) {
    return { pokemon: payload };
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('O arquivo precisa conter um objeto JSON.');
  }

  const source = payload as Record<string, unknown>;
  const imported = Object.fromEntries(
    GAME_STATE_KEYS
      .filter(key => Object.prototype.hasOwnProperty.call(source, key))
      .map(key => [key, source[key]]),
  ) as GameState;

  if (Object.keys(imported).length === 0) {
    throw new Error('O arquivo não contém dados da campanha reconhecidos.');
  }

  return imported;
}

export async function syncImportedGameState(state: GameState) {
  await syncGameState(state);
}