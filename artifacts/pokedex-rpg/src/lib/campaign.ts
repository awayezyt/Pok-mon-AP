import { useEffect, useRef, useState } from 'react';
import { generateId } from './utils';
import { getServerCollection, hydrateGameState, syncGameState } from './cloudSync';

export type SessionRole = 'player' | 'gm' | 'public';
export const CHARACTER_CLASSES = {
  Contestante: ['Artista de rua', 'Cantor', 'Duelista', 'Dançarino', 'Estilista'],
  Aventureiro: ['Audacioso', 'Engenheiro', 'Cozinheiro', 'Caçador de tesouros', 'Mochileiro'],
  Pesquisador: ['Arqueólogo', 'Cientista', 'Estudado', 'Teólogo', 'Médico'],
  Treinador: ['Artista marcial', 'Estrategista', 'Médium', 'Ninja', 'Obstinado'],
} as const;

export type CharacterClass = keyof typeof CHARACTER_CLASSES;
export type CharacterAttribute = 'agi' | 'car' | 'for' | 'int' | 'vig' | 'von';
export type FlowStep = {
  level: number;
  name: string;
  detail: string;
  active: boolean;
};

export type CharacterSkill = { name: string; value: number; extraPoints?: number; trained: boolean };
export type InventoryItem = {
  name: string;
  detail: string;
  equipped: boolean;
  category: string;
  weight: number;
  image?: string;
  holdable?: boolean;
};
export type CharacterAbility = { name: string; detail: string; uses: string; pinned?: boolean };

export const CHARACTER_RULES: Record<CharacterClass, { hpBase: number; hpPerLevel: number; focusBase: number; focusPerLevel: number }> = {
  Contestante: { hpBase: 5, hpPerLevel: 2, focusBase: 10, focusPerLevel: 5 },
  Aventureiro: { hpBase: 10, hpPerLevel: 2, focusBase: 5, focusPerLevel: 4 },
  Pesquisador: { hpBase: 6, hpPerLevel: 2, focusBase: 9, focusPerLevel: 2 },
  Treinador: { hpBase: 8, hpPerLevel: 2, focusBase: 7, focusPerLevel: 4 },
};

export const CHARACTER_ATTRIBUTE_LABELS: Record<CharacterAttribute, string> = {
  agi: 'Agilidade',
  car: 'Carisma',
  for: 'Força',
  int: 'Inteligência',
  vig: 'Vigor',
  von: 'Vontade',
};

export const SKILL_NAMES = [
  'Acrobacia', 'Artes', 'Adestramento', 'Atletismo', 'Atualidade', 'Crime',
  'Ciências', 'Diplomacia', 'Determinação', 'Enganação', 'Engajamento',
  'Exploração', 'Furtividade', 'Fortitude', 'Iniciativa', 'Intimidação',
  'Intuição', 'Investigação', 'Luta', 'Medicina', 'Ofício', 'Pontaria',
  'Percepção', 'Reflexo', 'Sorte', 'Sobrevivência', 'Tática', 'Tecnologia',
] as const;

export function getSkillCap(level: number) {
  if (level <= 5) return 5;
  if (level <= 9) return 10;
  return 20;
}

export function calculateCharacterResources(character: Pick<CharacterSheet, 'className' | 'level' | 'attributes'>) {
  const className = (character.className in CHARACTER_RULES ? character.className : 'Treinador') as CharacterClass;
  const rules = CHARACTER_RULES[className];
  const vigor = character.attributes.vig;
  const will = character.attributes.von;
  return {
    hpMax: rules.hpBase + vigor * 2 + character.level * (rules.hpPerLevel + vigor),
    focusMax: rules.focusBase + will * 2 + character.level * (rules.focusPerLevel + will),
  };
}

export interface CharacterSheet {
  id: string;
  name: string;
  player: string;
  className: CharacterClass;
  path: string;
  level: number;
  accessCode: string;
  concept: string;
  origin: string;
  notes: string;
  image?: string;
  hp: number;
  hpMax: number;
  focus: number;
  focusMax: number;
  attributes: Record<CharacterAttribute, number>;
  skills: CharacterSkill[];
  inventory: InventoryItem[];
  abilities: CharacterAbility[];
  flow: FlowStep[];
  money: number;
  partyPokemonIds: string[];
  pcPokemonIds: string[];
  themeColor?: CharacterThemeColor;
}

export type CharacterThemeColor = 'forest' | 'pumpkin' | 'violet' | 'navy' | 'tiffany';

export const CHARACTER_THEME_COLORS: Record<CharacterThemeColor, { label: string; primary: string; foreground: string }> = {
  forest: { label: 'Verde', primary: '146 48% 35%', foreground: '210 40% 98%' },
  pumpkin: { label: 'Laranja', primary: '24 95% 52%', foreground: '222 47% 11%' },
  violet: { label: 'Violeta', primary: '270 70% 57%', foreground: '210 40% 98%' },
  navy: { label: 'Azul escuro', primary: '215 80% 40%', foreground: '210 40% 98%' },
  tiffany: { label: 'Azul claro', primary: '174 70% 45%', foreground: '222 47% 11%' },
};

export function getCharacterThemeColor(color?: string): CharacterThemeColor {
  const legacyMap: Record<string, CharacterThemeColor> = {
    azure: 'tiffany',
    ruby: 'pumpkin',
    teal: 'tiffany',
    amber: 'pumpkin',
  };
  if (color && color in CHARACTER_THEME_COLORS) return color as CharacterThemeColor;
  return (color && legacyMap[color]) || 'forest';
}

export interface CampaignNote {
  id: string;
  title: string;
  body: string;
  tag: string;
  public: boolean;
  updatedAt: string;
}

export interface ProvisionalItem {
  id: string;
  name: string;
  category: string;
  weight: number;
  detail: string;
  image?: string;
  holdable: boolean;
}

export interface TrainerRecord {
  id: string;
  name: string;
  player: string;
  characterId?: string;
  pokemonId?: string;
  kind?: 'npc' | 'player';
  className?: CharacterClass;
  path?: string;
  level?: number;
  hp?: number;
  hpMax?: number;
  focus?: number;
  focusMax?: number;
  attributes?: Record<CharacterAttribute, number>;
  skills?: CharacterSkill[];
  abilities?: CharacterAbility[];
  notes?: string;
  pokemonIds?: string[];
}

export interface SceneMarketItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  provisionalItemId?: string;
}

export interface SceneTest {
  id: string;
  skill: string;
  description: string;
  difficulties: string[];
}

export interface CampaignScene {
  id: string;
  title: string;
  description: string;
  pokemonIds: string[];
  trainerIds: string[];
  musicIds: string[];
  provisionalMarket: SceneMarketItem[];
  customMarket: SceneMarketItem[];
  tests: SceneTest[];
  pointsOfInterest: string[];
}

export interface CampaignEpisode {
  id: string;
  title: string;
  description: string;
  scenes: CampaignScene[];
}

export interface GMReminder {
  id: string;
  text: string;
  important: boolean;
}

export interface MusicTrack {
  id: string;
  title: string;
  url: string;
  category: 'Batalha' | 'Suspense' | 'Calmo' | 'Único';
  keywords: string;
}

export type GMPlanningShape = 'rectangle' | 'ellipse' | 'diamond' | 'frame';
export type GMPlanningNodeKind = 'note' | 'pokemon' | 'trainer' | 'music' | 'item' | 'shop' | 'episode' | 'scene' | 'image' | 'shape';

export interface GMPlanningNode {
  id: string;
  kind: GMPlanningNodeKind;
  title: string;
  description: string;
  x: number;
  y: number;
  resourceId?: string;
  color?: string;
  width?: number;
  height?: number;
  contentHtml?: string;
  imageUrl?: string;
  shape?: GMPlanningShape;
  fontSize?: number;
}

export interface GMPlanningConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  style?: 'solid' | 'dashed';
  color?: string;
}

export interface GMPlanningMap {
  id: string;
  title: string;
  nodes: GMPlanningNode[];
  connections: GMPlanningConnection[];
  viewport?: { x: number; y: number; zoom: number };
  snapToGrid?: boolean;
  background?: 'dots' | 'grid' | 'plain';
  createdAt: string;
  updatedAt: string;
}

export interface GMBoardState {
  reminders: GMReminder[];
  sceneScript: string;
  music: MusicTrack[];
  mindMaps: GMPlanningMap[];
  activeMindMapId: string;
}

export type BrigadaKirkBattleOutcome = 'win' | 'loss' | 'draw';
export type BrigadaKirkRarity = 'Comum' | 'Incomum' | 'Raro' | 'Épico' | 'Lendário' | 'Mítico';
export type BrigadaKirkContestPlacement = 'first' | 'second' | 'third' | 'other' | 'unplaced';
type BrigadaKirkHistoryDraft<T = BrigadaKirkHistoryEntry> =
  T extends BrigadaKirkHistoryEntry
    ? Omit<T, 'id' | 'createdAt' | 'rankBefore' | 'rankAfter' | 'movement'>
    : never;
export type BrigadaKirkHistoryEntry =
  | {
    id: string; kind: 'battle'; createdAt: string; title: string; rankBefore: number; rankAfter: number; movement: number;
    outcome: BrigadaKirkBattleOutcome; opponentName: string; opponentRank: number; opponentRankAfter: number;
    brigadaCompetitors: string[]; opponentCompetitors: string[];
    brigadaPokemon: string[]; opponentPokemon: string[];
  }
  | {
    id: string; kind: 'pokemon'; createdAt: string; title: string; rankBefore: number; rankAfter: number; movement: number;
    pokemonName: string; species: string; rarity: BrigadaKirkRarity; image?: string;
  }
  | {
    id: string; kind: 'contest'; createdAt: string; title: string; rankBefore: number; rankAfter: number; movement: number;
    contestName: string; topThree: Array<{ place: 1 | 2 | 3; name: string; pokemon: string[] }>;
    participantName: string; placement: BrigadaKirkContestPlacement; approval: number; relevance: number;
  }
  | {
    id: string; kind: 'manual'; createdAt: string; title: string; rankBefore: number; rankAfter: number; movement: number;
    reason: string;
  };
export interface BrigadaKirkLeague {
  currentRank: number;
  history: BrigadaKirkHistoryEntry[];
  opponentRanks: Record<string, number>;
}
export type BrigadaKirkBattleInput = {
  opponentName: string;
  opponentRank: number;
  brigadaCompetitors: string[];
  opponentCompetitors: string[];
  brigadaPokemon: string[];
  opponentPokemon: string[];
  outcome: BrigadaKirkBattleOutcome;
};
export type BrigadaKirkPokemonInput = {
  pokemonName: string;
  species: string;
  rarity: BrigadaKirkRarity;
  image?: string;
};
export type BrigadaKirkContestInput = {
  contestName: string;
  topThree: Array<{ place: 1 | 2 | 3; name: string; pokemon: string[] }>;
  participantName: string;
  placement: BrigadaKirkContestPlacement;
  approval: number;
  relevance: number;
};
export const DEFAULT_BRIGADA_KIRK_LEAGUE: BrigadaKirkLeague = { currentRank: 481, history: [], opponentRanks: {} };

export function calculateBrigadaBattleMovement(
  teamRank: number,
  opponentRank: number,
  outcome: BrigadaKirkBattleOutcome,
) {
  const safeTeamRank = Math.max(1, Math.floor(teamRank));
  const safeOpponentRank = Math.max(1, Math.floor(opponentRank));
  // A lower rank number is stronger. This smooth expectation gives underdogs
  // more credit for wins and makes a favorite's loss costly, without swapping
  // distant teams' league positions after a single match.
  const expectedWin = safeOpponentRank / (safeTeamRank + safeOpponentRank);
  const winMovement = Math.round(6 + 44 * Math.pow(1 - expectedWin, 1.5));
  const lossMovement = Math.round(6 + 44 * Math.pow(expectedWin, 1.5));
  if (outcome === 'win') return winMovement;
  if (outcome === 'loss') return -lossMovement;
  return Math.round((0.5 - expectedWin) * 20);
}

export function calculateBrigadaContestMovement(
  placement: BrigadaKirkContestPlacement,
  approval: number,
  relevance: number,
) {
  const placementEffect: Record<BrigadaKirkContestPlacement, number> = {
    first: 10, second: 6, third: 2, other: -6, unplaced: -10,
  };
  const approvalEffect = ((Math.max(0, Math.min(100, approval)) - 50) / 50)
    * Math.max(1, Math.min(5, relevance)) * 5;
  return Math.round(placementEffect[placement] + approvalEffect);
}

function applyBrigadaMovement(currentRank: number, movement: number) {
  return Math.max(1, Math.min(10000, currentRank - movement));
}

export function createGMPlanningMap(title = 'Novo mapa'): GMPlanningMap {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title,
    nodes: [],
    connections: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const FLOW_TEMPLATE: FlowStep[] = [
  { level: 1, name: 'Desbloqueio', detail: 'Desbloqueia as mecânicas especiais.', active: false },
  { level: 2, name: '', detail: '', active: false },
  { level: 3, name: 'Apoio compartilhado', detail: '+2 em testes para você e seus PKM’s.', active: false },
  { level: 4, name: '', detail: '', active: false },
  { level: 5, name: 'Nome do fluxo', detail: 'Descreva o benefício desbloqueado.', active: false },
  { level: 6, name: '', detail: '', active: false },
  { level: 7, name: 'Dado extra', detail: '+1d20 em testes para você e seus PKM’s.', active: false },
  { level: 8, name: '', detail: '', active: false },
  { level: 9, name: 'Ação adicional', detail: 'Recebe uma ação padrão adicional no turno em que alcançar esse fluxo.', active: false },
  { level: 10, name: 'Nome do fluxo', detail: 'Descreva o benefício desbloqueado.', active: false },
];

export const DEFAULT_GM_BOARD: GMBoardState = {
  reminders: [
    { id: 'reminder-map', text: 'Revelar o mapa só depois do teste de investigação.', important: false },
    { id: 'reminder-sabine', text: 'Conferir os itens da Sabine antes da próxima cena.', important: false },
  ],
  sceneScript: 'Chuva fina · sino submerso · uma escolha sem resposta.',
  music: [],
  mindMaps: [{
    id: 'gm-planning-main',
    title: 'Campanha principal',
    nodes: [],
    connections: [],
    createdAt: '',
    updatedAt: '',
  }],
  activeMindMapId: 'gm-planning-main',
};

const starterCharacter: CharacterSheet = {
  id: 'character-sabine',
  name: 'Sabine',
  player: '',
  className: 'Treinador',
  path: 'Artista marcial',
  level: 2,
  accessCode: 'sabine',
  concept: '',
  origin: 'Lutador',
  notes: '',
  hp: 16,
  hpMax: 16,
  focus: 14,
  focusMax: 14,
  attributes: { agi: 4, car: 3, for: 2, int: 1, vig: 2, von: 1 },
  skills: SKILL_NAMES.map(name => ({ name, value: 0, trained: false })),
  inventory: [],
  abilities: [],
  flow: FLOW_TEMPLATE.map(step => ({ ...step })),
  money: 0,
  partyPokemonIds: [],
  pcPokemonIds: [],
  themeColor: 'forest',
};

const starterNotes: CampaignNote[] = [
  { id: 'note-1', title: 'O farol sem chama', body: 'O farol de Baía Íris apagou há três noites. Pescadores dizem ouvir sinos abaixo da água.', tag: 'gancho', public: true, updatedAt: 'Hoje, 18:40' },
  { id: 'note-2', title: 'Porto Salitre', body: 'Mercado de mapas, sal e histórias exageradas. A hospedaria da Dália oferece quarto em troca de favores.', tag: 'local', public: true, updatedAt: 'Ontem, 21:12' },
  { id: 'note-3', title: 'Verdade sobre o sino', body: 'A frequência do sino coincide com a migração dos Wingull. Não compartilhar ainda.', tag: 'segredo', public: false, updatedAt: 'Ontem, 23:08' },
];

function readSessionRole(): SessionRole {
  return 'public';
}

let currentSessionRole: SessionRole = 'public';
let currentActiveCharacterId: string | null = null;
const sessionListeners = new Set<() => void>();

export function getCurrentSessionRole(): SessionRole {
  return currentSessionRole;
}

function notifySessionListeners() {
  sessionListeners.forEach(listener => listener());
  window.dispatchEvent(new CustomEvent('pokemon-rpg-session-change'));
}

export async function restoreSession() {
  const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'include' });
  if (!response.ok) {
    const error = new Error('Não foi possível verificar o acesso.');
    Object.assign(error, { retryable: response.status === 408 || response.status === 429 || response.status >= 500 });
    throw error;
  }
  const session = await response.json();
  currentSessionRole = session.role;
  currentActiveCharacterId = session.activeCharacterId;
  notifySessionListeners();
}

function normalizeFlow(raw: unknown): FlowStep[] {
  const saved = Array.isArray(raw) ? raw : [];
  const hasCurrentShape = saved.length === FLOW_TEMPLATE.length && saved.every(item => typeof (item as Partial<FlowStep>).level === 'number');
  if (!hasCurrentShape) return FLOW_TEMPLATE.map(step => ({ ...step }));
  return FLOW_TEMPLATE.map((template, index) => {
    const item = saved[index] as (Partial<FlowStep> & { status?: string }) | undefined;
    if (!item) return { ...template };
    return {
      ...template,
      ...(typeof item.level === 'number' ? { level: item.level } : {}),
      ...(typeof item.name === 'string' ? { name: item.name } : {}),
      ...(typeof item.detail === 'string' ? { detail: item.detail } : {}),
      active: typeof item.active === 'boolean' ? item.active : item.status === 'em_cena' || item.status === 'gasto',
    };
  });
}

export function useSessionRole() {
  const [snapshot, setSnapshot] = useState(() => ({
    role: currentSessionRole,
    activeCharacterId: currentActiveCharacterId,
  }));
  useEffect(() => {
    const sync = () => setSnapshot({
      role: currentSessionRole,
      activeCharacterId: currentActiveCharacterId,
    });
    sessionListeners.add(sync);
    sync();
    return () => {
      sessionListeners.delete(sync);
    };
  }, []);
  const changeRole = (next: SessionRole, characterId?: string | null) => {
    if (characterId !== undefined) {
      currentActiveCharacterId = characterId;
    }
    currentSessionRole = next;
    notifySessionListeners();
  };
  const signOut = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    if (!response.ok) throw new Error('Não foi possível sair. Tente novamente.');
    changeRole('public', null);
    window.location.assign(import.meta.env.BASE_URL);
  };
  return { role: snapshot.role, activeCharacterId: snapshot.activeCharacterId, setRole: changeRole, signOut };
}

function migrateLegacyLyra(item: Partial<CharacterSheet>): Partial<CharacterSheet> {
  // The legacy id is intentionally kept for compatibility with old saves.
  // It must not trigger this reset after the record has already been renamed
  // to Sabine, otherwise every remount would erase inventory and abilities.
  if (item.name !== 'Lyra Vale') return item;
  return {
    ...item,
    name: 'Sabine',
    player: item.player === 'Marina' ? '' : (item.player || ''),
    className: 'Treinador',
    path: 'Artista marcial',
    level: 2,
    origin: 'Lutador',
    concept: '',
    notes: '',
    hp: 16,
    focus: 14,
    attributes: { agi: 4, car: 3, for: 2, int: 1, vig: 2, von: 1 },
    skills: SKILL_NAMES.map(name => ({ name, value: 0, trained: false })),
    inventory: [],
    abilities: [],
  };
}

export function useCharacterSheets() {
  const [characters, setCharacters] = useState<CharacterSheet[]>(() => {
    const saved = getServerCollection<Partial<CharacterSheet>[]>('characters', []);
    const list = saved.length ? saved.map(migrateLegacyLyra) : [starterCharacter];
    return list.map(normalizeCharacter);
  });
  const charactersRef = useRef(characters);
  useEffect(() => {
    const sync = () => {
      const saved = getServerCollection<Partial<CharacterSheet>[]>('characters', []);
      const migrated = saved.length ? saved.map(migrateLegacyLyra) : [];
      const next = migrated.length ? migrated.map(normalizeCharacter) : [normalizeCharacter(starterCharacter)];
      charactersRef.current = next;
      setCharacters(next);
      if (saved.some(item => item.name === 'Lyra Vale')) {
        void syncGameState({ characters: next });
      }
    };
    window.addEventListener('pokemon-rpg-state-change', sync);
    sync();
    return () => window.removeEventListener('pokemon-rpg-state-change', sync);
  }, []);
  const updateCharacter = (id: string, patch: Partial<CharacterSheet>) => {
    const applyPatch = (list: CharacterSheet[]) => list.map(character => {
      if (character.id !== id) return character;
      const next = { ...character, ...patch, attributes: { ...character.attributes, ...(patch.attributes || {}) } };
      const resources = calculateCharacterResources(next);
      return { ...next, hpMax: resources.hpMax, focusMax: resources.focusMax, hp: Math.min(next.hp, resources.hpMax), focus: Math.min(next.focus, resources.focusMax) };
    });
    const updated = applyPatch(charactersRef.current);
    charactersRef.current = updated;
    void syncGameState({ characters: updated });
    setCharacters(updated);
  };
  const addCharacter = () => {
    const newCharacter: CharacterSheet = {
      ...starterCharacter,
      id: generateId(),
      name: 'Nova personagem',
      player: 'Jogador',
      accessCode: generateId().slice(-6),
      skills: SKILL_NAMES.map(name => ({ name, value: 0, trained: false })),
      abilities: [],
      flow: FLOW_TEMPLATE.map(step => ({ ...step })),
      notes: '',
      money: 0,
      partyPokemonIds: [],
      pcPokemonIds: [],
    };
    const updated = [...charactersRef.current, newCharacter];
    charactersRef.current = updated;
    void syncGameState({ characters: updated });
    setCharacters(updated);
    return newCharacter;
  };
  const deleteCharacter = (id: string) => {
    const updated = charactersRef.current.filter(character => character.id !== id);
    charactersRef.current = updated;
    void syncGameState({ characters: updated });
    setCharacters(updated);
  };
  return { characters, updateCharacter, addCharacter, deleteCharacter };
}

function normalizeCharacter(item: Partial<CharacterSheet>): CharacterSheet {
  const merged = {
    ...starterCharacter,
    ...item,
    notes: item.notes ?? item.origin ?? starterCharacter.notes,
    attributes: { ...starterCharacter.attributes, ...item.attributes },
    skills: SKILL_NAMES.map(name => item.skills?.find(skill => skill.name === name) || { name, value: 0, trained: false }),
    abilities: (item.abilities || starterCharacter.abilities).map(ability => ({ ...ability, pinned: !!ability.pinned })),
    flow: normalizeFlow(item.flow),
    money: typeof item.money === 'number' ? item.money : 0,
    partyPokemonIds: item.partyPokemonIds || [],
    pcPokemonIds: item.pcPokemonIds || [],
  };
  const resources = calculateCharacterResources(merged);
  return {
    ...merged,
    hpMax: resources.hpMax,
    focusMax: resources.focusMax,
    hp: Math.min(Math.max(Number(merged.hp) || 0, 0), resources.hpMax),
    focus: Math.min(Math.max(Number(merged.focus) || 0, 0), resources.focusMax),
  } as CharacterSheet;
}

export function useCampaignNotes() {
  const [notes, setNotes] = useState<CampaignNote[]>(() => getServerCollection('notes', starterNotes));
  const notesRef = useRef(notes);
  useEffect(() => {
    const sync = () => {
      const next = getServerCollection<CampaignNote[]>('notes', []);
      notesRef.current = next;
      setNotes(next);
    };
    window.addEventListener('pokemon-rpg-state-change', sync);
    return () => window.removeEventListener('pokemon-rpg-state-change', sync);
  }, []);
  const saveNote = (note: Partial<CampaignNote> & { id?: string }) => {
    const current = notesRef.current;
    const updated = note.id
      ? current.map(item => item.id === note.id ? { ...item, ...note, updatedAt: 'Agora' } : item)
      : [{ id: generateId(), title: note.title || 'Nota sem título', body: note.body || '', tag: note.tag || 'registro', public: !!note.public, updatedAt: 'Agora' }, ...current];
    notesRef.current = updated;
    void syncGameState({ notes: updated });
    setNotes(updated);
  };
  const removeNote = (id: string) => {
    const updated = notesRef.current.filter(note => note.id !== id);
    notesRef.current = updated;
    void syncGameState({ notes: updated });
    setNotes(updated);
  };
  return { notes, saveNote, removeNote };
}

function normalizeBrigadaKirkLeague(value: Partial<BrigadaKirkLeague> | undefined): BrigadaKirkLeague {
  const savedOpponentRanks = value?.opponentRanks && typeof value.opponentRanks === 'object'
    ? Object.fromEntries(Object.entries(value.opponentRanks)
      .filter(([name, rank]) => name.trim() && Number.isFinite(rank))
      .map(([name, rank]) => [name, Math.max(1, Math.min(10000, Math.floor(rank)))]))
    : {};
  return {
    currentRank: Number.isFinite(value?.currentRank)
      ? Math.max(1, Math.min(10000, Math.floor(value!.currentRank!)))
      : DEFAULT_BRIGADA_KIRK_LEAGUE.currentRank,
    history: Array.isArray(value?.history) ? value.history : [],
    opponentRanks: savedOpponentRanks,
  };
}

export function useBrigadaKirk() {
  const [league, setLeague] = useState(() => normalizeBrigadaKirkLeague(
    getServerCollection<Partial<BrigadaKirkLeague> | undefined>('brigadaKirk', undefined),
  ));
  const leagueRef = useRef(league);

  useEffect(() => {
    const sync = () => {
      const next = normalizeBrigadaKirkLeague(
        getServerCollection<Partial<BrigadaKirkLeague> | undefined>('brigadaKirk', undefined),
      );
      leagueRef.current = next;
      setLeague(next);
    };
    window.addEventListener('pokemon-rpg-state-change', sync);
    return () => window.removeEventListener('pokemon-rpg-state-change', sync);
  }, []);

  const save = (next: BrigadaKirkLeague) => {
    leagueRef.current = next;
    setLeague(next);
    return syncGameState({ brigadaKirk: next }, { throwOnError: true }).catch(async error => {
      // An API rejection (including a non-GM write) must discard the optimistic
      // change and restore the authoritative campaign snapshot.
      await hydrateGameState();
      const current = normalizeBrigadaKirkLeague(
        getServerCollection<Partial<BrigadaKirkLeague> | undefined>('brigadaKirk', undefined),
      );
      leagueRef.current = current;
      setLeague(current);
      window.dispatchEvent(new CustomEvent('pokemon-rpg-state-change'));
      throw error;
    });
  };

  const addEntry = (entry: BrigadaKirkHistoryDraft, movement: number, leaguePatch: Partial<BrigadaKirkLeague> = {}) => {
    const currentRank = leagueRef.current.currentRank;
    const rankAfter = applyBrigadaMovement(currentRank, movement);
    return save({
      ...leagueRef.current,
      ...leaguePatch,
      currentRank: rankAfter,
      history: [{
        ...entry,
        id: generateId(),
        createdAt: new Date().toISOString(),
        rankBefore: currentRank,
        rankAfter,
        movement,
      } as BrigadaKirkHistoryEntry, ...leagueRef.current.history],
    });
  };

  const addBattle = (input: BrigadaKirkBattleInput) => {
    const currentRank = leagueRef.current.currentRank;
    const movement = calculateBrigadaBattleMovement(currentRank, input.opponentRank, input.outcome);
    const opponentOutcome = input.outcome === 'win' ? 'loss' : input.outcome === 'loss' ? 'win' : 'draw';
    const opponentMovement = calculateBrigadaBattleMovement(input.opponentRank, currentRank, opponentOutcome);
    const opponentRankAfter = applyBrigadaMovement(input.opponentRank, opponentMovement);
    const outcomeTitle = input.outcome === 'win' ? 'Vitória' : input.outcome === 'loss' ? 'Derrota' : 'Empate / imprevisto';
    return addEntry({
      ...input,
      kind: 'battle',
      title: `${outcomeTitle} contra ${input.opponentName}`,
      opponentRankAfter,
    }, movement, {
      opponentRanks: {
        ...leagueRef.current.opponentRanks,
        [input.opponentName.trim().toLowerCase()]: opponentRankAfter,
      },
    });
  };

  const addPokemonDiscovery = (input: BrigadaKirkPokemonInput) => {
    const points: Record<BrigadaKirkRarity, number> = {
      Comum: 2, Incomum: 5, Raro: 9, Épico: 14, Lendário: 21, Mítico: 26,
    };
    return addEntry({
      ...input,
      kind: 'pokemon',
      title: `Nova descoberta: ${input.pokemonName}`,
    }, points[input.rarity]);
  };

  const addContest = (input: BrigadaKirkContestInput) => {
    const movement = calculateBrigadaContestMovement(input.placement, input.approval, input.relevance);
    const placementLabel: Record<BrigadaKirkContestPlacement, string> = {
      first: '1º lugar', second: '2º lugar', third: '3º lugar', other: 'colocação baixa', unplaced: 'sem colocação',
    };
    return addEntry({
      ...input,
      kind: 'contest',
      title: `${input.contestName} · ${placementLabel[input.placement]}`,
    }, movement);
  };

  const setCurrentRank = (rank: number, reason: string) => {
    const rankAfter = Math.max(1, Math.min(10000, Math.floor(rank)));
    const rankBefore = leagueRef.current.currentRank;
    if (rankAfter === rankBefore) return Promise.resolve();
    const movement = rankBefore - rankAfter;
    return save({
      ...leagueRef.current,
      currentRank: rankAfter,
      history: [{
        id: generateId(),
        kind: 'manual',
        title: 'Ajuste manual de colocação',
        createdAt: new Date().toISOString(),
        rankBefore,
        rankAfter,
        movement,
        reason: reason.trim() || 'Ajuste feito pelo GM nas configurações.',
      }, ...leagueRef.current.history],
    });
  };

  return { league, addBattle, addPokemonDiscovery, addContest, setCurrentRank };
}

export function useGMBoard() {
  const [board, setBoard] = useState<GMBoardState>(() => {
    const saved = getServerCollection<Partial<GMBoardState>>('gmBoard', {});
    const mindMaps = Array.isArray(saved.mindMaps) && saved.mindMaps.length
      ? saved.mindMaps
      : DEFAULT_GM_BOARD.mindMaps;
    return {
      reminders: saved.reminders || DEFAULT_GM_BOARD.reminders,
      sceneScript: saved.sceneScript ?? DEFAULT_GM_BOARD.sceneScript,
      music: saved.music || DEFAULT_GM_BOARD.music,
      mindMaps,
      activeMindMapId: mindMaps.some(map => map.id === saved.activeMindMapId)
        ? saved.activeMindMapId!
        : mindMaps[0].id,
    };
  });
  const boardRef = useRef(board);
  useEffect(() => {
    const sync = () => {
      const incoming = getServerCollection<Partial<GMBoardState>>('gmBoard', {});
      const mindMaps = Array.isArray(incoming.mindMaps) && incoming.mindMaps.length
        ? incoming.mindMaps
        : DEFAULT_GM_BOARD.mindMaps;
      const next = {
        reminders: incoming.reminders || [],
        sceneScript: incoming.sceneScript || '',
        music: incoming.music || [],
        mindMaps,
        activeMindMapId: mindMaps.some(map => map.id === incoming.activeMindMapId)
          ? incoming.activeMindMapId!
          : mindMaps[0].id,
      };
      boardRef.current = next;
      setBoard(next);
    };
    window.addEventListener('pokemon-rpg-state-change', sync);
    return () => window.removeEventListener('pokemon-rpg-state-change', sync);
  }, []);

  const updateBoard = (next: GMBoardState | ((current: GMBoardState) => GMBoardState)) => {
    const updated = typeof next === 'function' ? next(boardRef.current) : next;
    boardRef.current = updated;
    void syncGameState({ gmBoard: updated });
    setBoard(updated);
  };

  return { board, setBoard: updateBoard };
}

const emptyScene = (id = generateId()): CampaignScene => ({
  id,
  title: 'Nova cena',
  description: '',
  pokemonIds: [],
  trainerIds: [],
  musicIds: [],
  provisionalMarket: [],
  customMarket: [],
  tests: [],
  pointsOfInterest: [],
});

function normalizeScene(item: Partial<CampaignScene>): CampaignScene {
  return {
    ...emptyScene(item.id),
    ...item,
    pokemonIds: Array.isArray(item.pokemonIds) ? item.pokemonIds : [],
    trainerIds: Array.isArray(item.trainerIds) ? item.trainerIds : [],
    musicIds: Array.isArray(item.musicIds) ? item.musicIds : [],
    provisionalMarket: Array.isArray(item.provisionalMarket) ? item.provisionalMarket : [],
    customMarket: Array.isArray(item.customMarket) ? item.customMarket : [],
    tests: Array.isArray(item.tests) ? item.tests : [],
    pointsOfInterest: Array.isArray(item.pointsOfInterest) ? item.pointsOfInterest : [],
  };
}

function normalizeEpisode(item: Partial<CampaignEpisode>): CampaignEpisode {
  return {
    id: item.id || generateId(),
    title: item.title || 'Novo episódio',
    description: item.description || '',
    scenes: Array.isArray(item.scenes) && item.scenes.length
      ? item.scenes.map(scene => normalizeScene(scene))
      : [emptyScene()],
  };
}

export function useCampaignStory() {
  const [episodes, setEpisodesState] = useState<CampaignEpisode[]>(() => getServerCollection<Partial<CampaignEpisode>[]>('story', []).map(normalizeEpisode));
  const episodesRef = useRef(episodes);

  useEffect(() => {
    const sync = () => {
      const saved = getServerCollection<Partial<CampaignEpisode>[]>('story', []);
      const next = saved.map(normalizeEpisode);
      episodesRef.current = next;
      setEpisodesState(next);
      if (JSON.stringify(saved) !== JSON.stringify(next)) {
        void syncGameState({ story: next });
      }
    };
    window.addEventListener('pokemon-rpg-state-change', sync);
    sync();
    return () => window.removeEventListener('pokemon-rpg-state-change', sync);
  }, []);

  const addEpisode = () => {
    const episode: CampaignEpisode = {
      id: generateId(),
      title: 'Novo episódio',
      description: '',
      scenes: [emptyScene()],
    };
    const updated = [...episodesRef.current, episode];
    episodesRef.current = updated;
    void syncGameState({ story: updated });
    setEpisodesState(updated);
    return episode;
  };
  const updateEpisode = (id: string, patch: Partial<CampaignEpisode>) => {
    const updated = episodesRef.current.map(item => item.id === id ? { ...item, ...patch } : item);
    episodesRef.current = updated;
    void syncGameState({ story: updated });
    setEpisodesState(updated);
  };
  const removeEpisode = (id: string) => {
    const updated = episodesRef.current.filter(item => item.id !== id);
    episodesRef.current = updated;
    void syncGameState({ story: updated });
    setEpisodesState(updated);
  };
  const setEpisodes = (next: CampaignEpisode[] | ((current: CampaignEpisode[]) => CampaignEpisode[])) => {
    const updated = typeof next === 'function' ? next(episodesRef.current) : next;
    episodesRef.current = updated;
    void syncGameState({ story: updated });
    setEpisodesState(updated);
  };
  return { episodes, setEpisodes, addEpisode, updateEpisode, removeEpisode, emptyScene };
}