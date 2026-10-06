import React, { createContext, useContext, useState, useEffect } from 'react';
import { DiceRollResult } from './types';
import { generateId } from './utils';
import { getServerCollection, syncGameState } from './cloudSync';
import { useSessionRole } from './campaign';

interface DiceHistoryContextType {
  history: DiceRollResult[];
  addRoll: (roll: Omit<DiceRollResult, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  setHistory: React.Dispatch<React.SetStateAction<DiceRollResult[]>>;
}

const DiceHistoryContext = createContext<DiceHistoryContextType | null>(null);

export function DiceHistoryProvider({ children }: { children: React.ReactNode }) {
  const { role } = useSessionRole();
  const collection = role === 'gm' ? 'gmHistory' : 'history';
  const [history, setHistoryState] = useState<DiceRollResult[]>(() => getServerCollection('history', []));
  const [publicHistory, setPublicHistory] = useState<DiceRollResult[]>([]);

  useEffect(() => {
    const sync = () => {
      setHistoryState(getServerCollection<DiceRollResult[]>(collection, []));
      setPublicHistory(role === 'gm' ? getServerCollection<DiceRollResult[]>('history', []) : []);
    };
    sync();
    window.addEventListener('pokemon-rpg-state-change', sync);
    return () => window.removeEventListener('pokemon-rpg-state-change', sync);
  }, [collection]);

  const addRoll = (roll: Omit<DiceRollResult, 'id' | 'timestamp'>) => {
    const newRoll: DiceRollResult = { ...roll, id: generateId(), timestamp: new Date().toISOString() };
    const updated = [newRoll, ...history].slice(0, 30);
    void syncGameState({ [collection]: updated });
    setHistoryState(updated);
  };

  const clearHistory = () => {
    void syncGameState({ [collection]: [] });
    setHistoryState([]);
  };

  const setHistory = (next: DiceRollResult[] | ((current: DiceRollResult[]) => DiceRollResult[])) => {
    const updated = typeof next === 'function' ? next(history) : next;
    void syncGameState({ [collection]: updated });
    setHistoryState(updated);
  };

  return (
    <DiceHistoryContext.Provider value={{ history: [...history, ...publicHistory].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 60), addRoll, clearHistory, setHistory }}>
      {children}
    </DiceHistoryContext.Provider>
  );
}

export function useDiceHistory() {
  const ctx = useContext(DiceHistoryContext);
  if (!ctx) throw new Error('useDiceHistory must be used inside DiceHistoryProvider');
  return ctx;
}