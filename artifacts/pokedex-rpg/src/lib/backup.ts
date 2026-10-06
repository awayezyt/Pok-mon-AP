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

export function createGameBackup() {
  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    ...readCompleteGameState(),
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