import { useState, useEffect, useRef } from 'react';
import { Pokemon, Attack, DiceRollResult, defaultStages } from './types';
import { generateId } from './utils';
import { getServerCollection, syncGameState } from './cloudSync';
import { defaultAttacks, defaultPokemon, defaultPokemonTemplate } from './constants';
import { computeDerivedStats as computeDerivedStatsStrict, getPpPoolMax } from './calculations';
import { getActivePreset, ORIGINAL_PRESET, STAT_KEYS } from './formulas';

// Never let a runtime formula error (e.g. division by zero) break data loading.
const computeDerivedStats: typeof computeDerivedStatsStrict = (stats, nature, stages, level, preset) => {
  try { return computeDerivedStatsStrict(stats, nature, stages, level, preset); }
  catch { return computeDerivedStatsStrict(stats, nature, stages, level, ORIGINAL_PRESET); }
};
import { localizeAttack } from './attackLocalization';

let attackCatalogMigrationStarted = false;

function normalizeAttack(attack: Attack): Attack {
  return localizeAttack({
    ...attack,
    makesContact: attack.makesContact ?? false,
    stab: attack.stab ?? true,
    statusChances: attack.statusChances ?? [],
  });
}

function getAttackCatalog() {
  const saved = getServerCollection<Attack[]>('attacks', []);
  const normalized = saved.map(normalizeAttack);
  if (!saved.length) return defaultAttacks.map(normalizeAttack);

  const savedIds = new Set(normalized.map(attack => attack.id));
  return [
    ...normalized,
    ...defaultAttacks.filter(attack => !savedIds.has(attack.id)),
  ];
}

function migrateOldPokemon(raw: any[]): Pokemon[] {
  return raw.map(p => {
    const stats = Object.fromEntries(STAT_KEYS.map(key => {
      const oldStat = p.stats?.[key] || defaultPokemonTemplate.stats[key];
      return [key, {
        base: Number(oldStat.base) || 0,
        evPoints: Number(oldStat.evPoints ?? oldStat.levelPoints) || 0,
        iv: oldStat.iv || defaultPokemonTemplate.stats[key].iv,
      }];
    })) as Pokemon['stats'];
    const stages = { ...defaultStages, ...(p.stages || {}) };
    const calculatedHpMax = computeDerivedStats(
      stats,
      typeof p.natureNumber === 'number' ? p.natureNumber : defaultPokemonTemplate.natureNumber,
      stages,
      typeof p.level === 'number' ? p.level : 1,
    ).hp;
    const hasDefaultHpMax = p.hpMax === 10 && calculatedHpMax > 10;
    const hpMax = hasDefaultHpMax
      ? Math.max(1, calculatedHpMax)
      : typeof p.hpMax === 'number' ? Math.max(1, Math.floor(p.hpMax)) : Math.max(1, calculatedHpMax);
    const storedHp = typeof p.hp === 'number' ? Math.floor(p.hp) : hpMax;
    const hp = Math.max(0, Math.min(hpMax, hasDefaultHpMax && storedHp === 10 ? hpMax : storedHp));
    return {
      ...defaultPokemonTemplate,
      species: '',
      inDex: false,
      xp: 0,
      growthRate: 'Meio rápido',
      affection: 0,
      ...p,
      stats,
      hpMax,
      hp,
      stages,
      attacks: Array.isArray(p.attacks) ? p.attacks.slice(0, 4) : [],
    };
  });
}

export function usePokemonData() {
  const [pokemon, setPokemonState] = useState<Pokemon[]>(() => {
    const saved = getServerCollection<Partial<Pokemon>[]>('pokemon', []);
    return saved.length
      ? migrateOldPokemon(saved)
      : defaultPokemon.map(item => ({ ...item, id: generateId(), createdAt: new Date().toISOString() }));
  });
  const pokemonRef = useRef(pokemon);

  useEffect(() => {
    const sync = () => {
      const next = migrateOldPokemon(getServerCollection<Pokemon[]>('pokemon', []));
      pokemonRef.current = next;
      setPokemonState(next);
    };
    window.addEventListener('pokemon-rpg-state-change', sync);
    return () => window.removeEventListener('pokemon-rpg-state-change', sync);
  }, []);

  const addPokemon = (p: Omit<Pokemon, 'id' | 'createdAt'>): Pokemon => {
    const preset = getActivePreset();
    const hpMax = Math.max(1, computeDerivedStats(p.stats, p.natureNumber, p.stages, p.level, preset).hp);
    const ppMax = getPpPoolMax(p.stats, p.natureNumber, p.level, preset);
    const wasAtFullHealth = p.hp >= p.hpMax;
    const newP: Pokemon = {
      ...p,
      hpMax,
      hp: Math.max(0, Math.min(hpMax, wasAtFullHealth ? hpMax : p.hp)),
      ppMax,
      ppCurrent: Math.max(0, Math.min(ppMax, p.ppCurrent ?? p.ppMax ?? ppMax)),
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...pokemonRef.current, newP];
    pokemonRef.current = updated;
    void syncGameState({ pokemon: updated });
    setPokemonState(updated);
    return newP;
  };

  const updatePokemon = (id: string, data: Partial<Pokemon>) => {
    const updated = pokemonRef.current.map(p => p.id === id ? { ...p, ...data } : p);
    pokemonRef.current = updated;
    void syncGameState({ pokemon: updated });
    setPokemonState(updated);
  };

  const deletePokemon = (id: string) => {
    const updated = pokemonRef.current.filter(p => p.id !== id);
    pokemonRef.current = updated;
    void syncGameState({ pokemon: updated });
    setPokemonState(updated);
  };

  const setPokemon = (next: Pokemon[] | ((current: Pokemon[]) => Pokemon[])) => {
    const updated = typeof next === 'function' ? next(pokemonRef.current) : next;
    pokemonRef.current = updated;
    void syncGameState({ pokemon: updated });
    setPokemonState(updated);
  };

  return { pokemon, addPokemon, updatePokemon, deletePokemon, setPokemon };
}

export function useAttackData() {
  const [attacks, setAttacksState] = useState<Attack[]>(getAttackCatalog);
  const attacksRef = useRef(attacks);

  useEffect(() => {
    const sync = () => {
      const next = getAttackCatalog();
      attacksRef.current = next;
      setAttacksState(next);
    };
    window.addEventListener('pokemon-rpg-state-change', sync);
    if (!attackCatalogMigrationStarted) {
      attackCatalogMigrationStarted = true;
      const saved = getServerCollection<Attack[]>('attacks', []);
      if (saved.length) {
        const catalog = getAttackCatalog();
        const translatedNames = saved.some(attack => normalizeAttack(attack).name !== attack.name);
        if (catalog.length > saved.length || translatedNames) {
          void syncGameState({ attacks: catalog });
        }
      } else {
        void syncGameState({ attacks: defaultAttacks.map(normalizeAttack) });
      }
    }
    return () => window.removeEventListener('pokemon-rpg-state-change', sync);
  }, []);

  const addAttack = (a: Omit<Attack, 'id'>): Attack => {
    const newA: Attack = { ...a, id: generateId() };
    const updated = [...attacksRef.current, newA];
    attacksRef.current = updated;
    void syncGameState({ attacks: updated });
    setAttacksState(updated);
    return newA;
  };

  const updateAttack = (id: string, data: Partial<Attack>) => {
    const updated = attacksRef.current.map(a => a.id === id ? { ...a, ...data } : a);
    attacksRef.current = updated;
    void syncGameState({ attacks: updated });
    setAttacksState(updated);
  };

  const deleteAttack = (id: string) => {
    const updated = attacksRef.current.filter(a => a.id !== id);
    attacksRef.current = updated;
    void syncGameState({ attacks: updated });
    setAttacksState(updated);
  };

  const setAttacks = (next: Attack[] | ((current: Attack[]) => Attack[])) => {
    const updated = typeof next === 'function' ? next(attacksRef.current) : next;
    attacksRef.current = updated;
    void syncGameState({ attacks: updated });
    setAttacksState(updated);
  };

  return { attacks, addAttack, updateAttack, deleteAttack, setAttacks };
}

export function useDiceHistory() {
  const [history, setHistory] = useState<DiceRollResult[]>(() => getServerCollection<DiceRollResult[]>('history', []));
  const historyRef = useRef(history);

  useEffect(() => {
    const sync = () => {
      const next = getServerCollection<DiceRollResult[]>('history', []);
      historyRef.current = next;
      setHistory(next);
    };
    window.addEventListener('pokemon-rpg-state-change', sync);
    return () => window.removeEventListener('pokemon-rpg-state-change', sync);
  }, []);

  const addRoll = (roll: Omit<DiceRollResult, 'id' | 'timestamp'>) => {
    const newRoll: DiceRollResult = { ...roll, id: generateId(), timestamp: new Date().toISOString() };
    const updated = [newRoll, ...historyRef.current].slice(0, 30);
    historyRef.current = updated;
    void syncGameState({ history: updated });
    setHistory(updated);
  };

  const clearHistory = () => {
    void syncGameState({ history: [] });
    historyRef.current = [];
    setHistory([]);
  };

  return { history, addRoll, clearHistory, setHistory };
}