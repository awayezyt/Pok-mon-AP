import type {
  CampaignEpisode,
  CharacterSheet,
  GMNoteResource,
  GMPlanningNodeKind,
  MusicTrack,
  ProvisionalItem,
  TrainerRecord,
} from './campaign';
import {
  calculateCharacterResources,
  CHARACTER_CLASSES,
  SKILL_NAMES,
} from './campaign';
import { defaultProvisionalItems } from './constants';
import { getServerCollection } from './cloudSync';
import type { Pokemon } from './types';
import type { Attack } from './types';

export type GMPlanningResource = {
  id: string;
  kind: Exclude<GMPlanningNodeKind, 'note' | 'shop'>;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  url?: string;
  details?: Array<{ label: string; value: string }>;
  sheetUrl?: string;
};

export function normalizeGMTrainers(): TrainerRecord[] {
  const raw = getServerCollection<unknown[]>('trainers', []);
  return raw.map((item, index) => {
    const value = item as Partial<TrainerRecord> & { name?: string; pokemonId?: string };
    if (value.kind !== 'npc' && !value.attributes && !value.pokemonIds) {
      return {
        ...value,
        id: value.id || `trainer-${index}`,
        name: value.name || 'Treinador',
        player: value.player || '',
        characterId: value.characterId,
        pokemonId: value.pokemonId,
      };
    }
    const rawAttributes = { agi: 1, car: 1, for: 1, int: 1, vig: 1, von: 1, ...(value.attributes || {}) };
    const attributes = {
      agi: Math.max(1, Number(rawAttributes.agi) || 1),
      car: Math.max(1, Number(rawAttributes.car) || 1),
      for: Math.max(1, Number(rawAttributes.for) || 1),
      int: Math.max(1, Number(rawAttributes.int) || 1),
      vig: Math.max(1, Number(rawAttributes.vig) || 1),
      von: Math.max(1, Number(rawAttributes.von) || 1),
    };
    const npc = {
      ...value,
      id: value.id || `trainer-${index}`,
      name: value.name || 'Treinador',
      player: value.player || '',
      kind: 'npc' as const,
      className: value.className || 'Treinador',
      path: value.path || CHARACTER_CLASSES.Treinador[0],
      level: Math.max(1, value.level || 1),
      attributes,
      skills: value.skills || SKILL_NAMES.map(skill => ({ name: skill, value: 0, trained: false })),
      abilities: value.abilities || [],
      notes: value.notes || '',
      pokemonIds: value.pokemonIds || [],
    };
    const calculated = calculateCharacterResources(npc as unknown as CharacterSheet);
    return {
      ...npc,
      hpMax: calculated.hpMax,
      focusMax: calculated.focusMax,
      hp: typeof value.hp === 'number' ? Math.min(value.hp, calculated.hpMax) : calculated.hpMax,
      focus: typeof value.focus === 'number' ? Math.min(value.focus, calculated.focusMax) : calculated.focusMax,
    };
  });
}

export function normalizeGMProvisionalItems(): ProvisionalItem[] {
  const raw = getServerCollection<unknown[]>('provisionalItems', []);
  const normalized = raw.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `item-${index}`,
        name: item,
        category: 'Especiais',
        weight: 1,
        detail: 'Item provisório enviado pelo GM.',
        holdable: true,
      };
    }
    const value = item as Partial<ProvisionalItem>;
    const category = value.category || 'Especiais';
    return {
      id: value.id || `item-${index}`,
      name: value.name || 'Item sem nome',
      category,
      weight: Number(value.weight) || 0,
      detail: value.detail || '',
      image: value.image || '',
      holdable: typeof value.holdable === 'boolean' ? value.holdable : !['Itens Chave', 'Pokebolas'].includes(category),
    };
  });
  const existingNames = new Set(normalized.map(item => item.name.toLocaleLowerCase()));
  const missingDefaults = defaultProvisionalItems
    .filter(item => !existingNames.has(item.name.toLocaleLowerCase()))
    .map(item => ({ ...item }));
  return [...normalized, ...missingDefaults];
}

export function buildGMPlanningResources({
  pokemon,
  trainers,
  music,
  items,
  episodes,
  characters = [],
}: {
  pokemon: Pokemon[];
  trainers: TrainerRecord[];
  music: MusicTrack[];
  items: ProvisionalItem[];
  episodes: CampaignEpisode[];
  characters?: CharacterSheet[];
}): GMPlanningResource[] {
  return [
    ...pokemon.map(item => ({
      id: `pokemon:${item.id}`,
      kind: 'pokemon' as const,
      title: item.name || item.species || 'Pokémon sem nome',
      subtitle: [item.species, `Nv. ${item.level}`, item.trainerName].filter(Boolean).join(' · '),
      description: item.notes || item.pokedexDescription || '',
      ...(item.image ? { imageUrl: item.image } : {}),
      sheetUrl: `/sheet?id=${encodeURIComponent(item.id)}`,
      details: [
        { label: 'Espécie', value: item.species || 'Não informada' },
        { label: 'Nível', value: String(item.level) },
        { label: 'Tipos', value: item.types.join(' / ') || 'Não informado' },
        { label: 'Treinador', value: item.trainerName || 'Sem treinador' },
        { label: 'Pontos de vida', value: `${item.hp}/${item.hpMax}` },
        { label: 'Habilidade', value: item.ability || 'Não informada' },
        { label: 'Item equipado', value: item.item || 'Nenhum' },
        { label: 'Ataques', value: item.attacks.join(', ') || 'Nenhum cadastrado' },
        { label: 'História', value: item.history || 'Sem história registrada.' },
      ],
    })),
    ...trainers.map(item => ({
      id: `trainer:${item.id}`,
      kind: 'trainer' as const,
      title: item.name || 'Treinador sem nome',
      subtitle: [item.kind === 'npc' ? 'NPC' : 'Treinador', item.player].filter(Boolean).join(' · '),
      description: item.notes || '',
    })),
    ...characters.map(item => ({
      id: `character:${item.id}`,
      kind: 'trainer' as const,
      title: item.name || 'Ficha sem nome',
      subtitle: ['Ficha de jogador', item.player].filter(Boolean).join(' · '),
      description: item.notes || '',
    })),
    ...music.map(item => ({
      id: `music:${item.id}`,
      kind: 'music' as const,
      title: item.title,
      subtitle: item.category,
      description: item.keywords || '',
      url: item.url,
    })),
    ...items.map(item => ({
      id: `item:${item.id}`,
      kind: 'item' as const,
      title: item.name,
      subtitle: item.category,
      description: item.detail,
      ...(item.image ? { imageUrl: item.image } : {}),
    })),
    ...episodes.flatMap(episode => [
      {
        id: `episode:${episode.id}`,
        kind: 'episode' as const,
        title: episode.title,
        subtitle: 'Episódio',
        description: episode.description,
      },
      ...episode.scenes.map(scene => ({
        id: `scene:${episode.id}:${scene.id}`,
        kind: 'scene' as const,
        title: scene.title,
        subtitle: episode.title,
        description: scene.description,
      })),
    ]),
  ];
}

const noteResourceTypeColors: Record<string, string> = {
  Normal: '#a8a77a', Fogo: '#ee8130', Água: '#6390f0', Planta: '#7ac74c',
  Elétrico: '#f7d02c', Gelo: '#96d9d6', Lutador: '#c22e28', Veneno: '#a33ea1',
  Terra: '#e2bf65', Voador: '#a98ff3', Psíquico: '#f95587', Inseto: '#a6b91a',
  Pedra: '#b6a136', Fantasma: '#735797', Dragão: '#6f35fc', Sombrio: '#705746',
  Metálico: '#b7b7ce', Fada: '#d685ad',
};

export function buildGMNotesResources({
  pokemon,
  trainers,
  music,
  items,
  episodes,
  characters,
  attacks,
}: {
  pokemon: Pokemon[];
  trainers: TrainerRecord[];
  music: MusicTrack[];
  items: ProvisionalItem[];
  episodes: CampaignEpisode[];
  characters: CharacterSheet[];
  attacks: Attack[];
}): GMNoteResource[] {
  return [
    ...pokemon.map(item => ({
      id: item.id,
      kind: 'pokemon' as const,
      title: item.name || item.species || 'Pokémon sem nome',
      subtitle: [item.species, `Nv. ${item.level}`, item.trainerName].filter(Boolean).join(' · '),
      description: item.notes || item.pokedexDescription || '',
      ...(item.image ? { imageUrl: item.image } : {}),
      accentColor: noteResourceTypeColors[item.types[0]] || '#6d9775',
      badge: item.types.join(' / ') || 'Pokémon',
    })),
    ...trainers.map(item => ({
      id: item.id,
      kind: 'trainer' as const,
      title: item.name || 'NPC sem nome',
      subtitle: [item.kind === 'npc' ? 'NPC' : 'Treinador', item.player].filter(Boolean).join(' · '),
      description: item.notes || '',
      accentColor: '#6575ad',
    })),
    ...characters.map(item => ({
      id: item.id,
      kind: 'character' as const,
      title: item.name || 'Ficha sem nome',
      subtitle: ['Ficha de jogador', item.player].filter(Boolean).join(' · '),
      description: item.notes || '',
      ...(item.image ? { imageUrl: item.image } : {}),
      accentColor: ({
        forest: '#287247', pumpkin: '#dc7629', violet: '#8759be',
        navy: '#2f5f9f', tiffany: '#329a94',
      } as const)[item.themeColor || 'forest'],
      badge: 'Ficha',
    })),
    ...items.map(item => ({
      id: item.id,
      kind: 'item' as const,
      title: item.name,
      subtitle: item.category,
      description: item.detail,
      ...(item.image ? { imageUrl: item.image } : {}),
      accentColor: '#cf8c48',
    })),
    ...music.map(item => ({
      id: item.id,
      kind: 'music' as const,
      title: item.title,
      subtitle: item.category,
      description: item.keywords || '',
      url: item.url,
      accentColor: '#4d9da4',
    })),
    ...episodes.flatMap(episode => [
      {
        id: episode.id,
        kind: 'episode' as const,
        title: episode.title,
        subtitle: 'Episódio',
        description: episode.description,
        accentColor: '#5081a6',
      },
      ...episode.scenes.map(scene => ({
        id: scene.id,
        kind: 'scene' as const,
        title: scene.title,
        subtitle: episode.title,
        description: scene.description,
        accentColor: '#8a70ad',
      })),
    ]),
    ...attacks.map(attack => ({
      id: attack.id,
      kind: 'attack' as const,
      title: attack.name,
      subtitle: `${attack.category} · PP ${attack.pp}`,
      description: attack.effectSummary || attack.effectFull || '',
      accentColor: noteResourceTypeColors[attack.type] || '#8b6eb2',
      badge: attack.type,
    })),
  ];
}
