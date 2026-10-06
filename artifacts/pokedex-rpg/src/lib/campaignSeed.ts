import { defaultStages } from './types';
import type { Attack, Pokemon } from './types';
import type { CharacterAbility, CharacterSheet, InventoryItem } from './campaign';
import { getServerCollection, syncGameState } from './cloudSync';
import { defaultProvisionalItems } from './constants';

const importedItemData: InventoryItem[] = [
  { name: 'Faixas de escalada', category: 'Itens Chave', weight: 1, detail: 'Faixas usadas para escalada.', equipped: false },
  { name: 'Patins XY4', category: 'Itens Chave', weight: 1, detail: 'Patins para deslocamento rápido.', equipped: false },
  { name: 'Razor Claw', category: 'Batalha', weight: 1, detail: 'Aumenta a chance de acerto crítico.', equipped: false },
  { name: 'Punching Gloves', category: 'Batalha', weight: 1, detail: 'Luvas próprias para golpes de punho.', equipped: false },
  { name: 'Luck Egg', category: 'Batalha', weight: 1, detail: 'Ovo da sorte.', equipped: false },
  { name: 'Pokébola', category: 'Pokebolas', weight: 1, detail: 'Quantidade registrada na ficha: 4.', equipped: false },
  { name: 'Potion', category: 'Consumíveis', weight: 1, detail: 'Poção de recuperação.', equipped: false },
  { name: 'Jaboca', category: 'Alimentos', weight: 1, detail: 'Fruta Jaboca.', equipped: false },
  { name: 'Lapapa', category: 'Alimentos', weight: 1, detail: 'Fruta Lapapa.', equipped: false },
  { name: 'Persim', category: 'Alimentos', weight: 1, detail: 'Fruta Persim.', equipped: false },
];

const importedAbilities: CharacterAbility[] = [
  {
    name: 'Geração: Quebrar costumes',
    detail: 'Pode definir com o mestre características únicas do personagem, como vícios, gostos específicos, fetiches, etc... aplicando pontos negativos em cada uma delas.\n\nPara cada característica definida, você recebe +1 ponto de atributo, com um máximo de 3.',
    uses: '',
  },
  {
    name: 'Movimento próprio',
    detail: 'Permite o personagem usar o movimento Focus Punch gastando 4 de PE.',
    uses: 'Custo: 4 PE.',
  },
  {
    name: 'Double kick',
    detail: 'O usuário desfere dois chutes consecutivos no alvo.',
    uses: '',
  },
  {
    name: 'Punhos de precisão',
    detail: 'A Taxa de Crítico de movimentos que façam contato dos seus Pokémon aumenta em +2.',
    uses: '',
  },
  {
    name: 'Treinador pokémon',
    detail: 'Recebe +5 em testes de Pontaria para captura. Seus Pokémon começam com Afeição no ranque Bom (15).',
    uses: '',
  },
];

const sabineSkillValues: Record<string, number> = {
  Acrobacia: 10,
  Artes: 0,
  Adestramento: 5,
  Atletismo: 5,
  Atualidade: 0,
  Crime: 0,
  Ciências: 0,
  Diplomacia: 2,
  Determinação: 0,
  Enganação: 0,
  Engajamento: 0,
  Exploração: 0,
  Furtividade: 0,
  Fortitude: 5,
  Iniciativa: 0,
  Intimidação: 0,
  Intuição: 0,
  Investigação: 0,
  Luta: 5,
  Medicina: 0,
  Ofício: 0,
  Pontaria: 2,
  Percepção: 0,
  Reflexo: 5,
  Sorte: 0,
  Sobrevivência: 0,
  Tática: 2,
  Tecnologia: 0,
};

const chucky: Pokemon = {
  id: 'pokemon-chucky-torchic',
  name: 'Chucky',
  species: 'Torchic',
  image: null,
  trainerName: '',
  history: '',
  pokedexDescription: '',
  types: ['Fogo'],
  gender: 'Macho',
  catchRate: 45,
  level: 7,
  hp: 53,
  hpMax: 53,
  evGained: '',
  xp: 26,
  growthRate: 'Meio devagar',
  affection: 0,
  item: 'Razor Claw',
  itemDescription: 'Aumenta a chance de acerto crítico.',
  ability: '',
  abilityDescription: '',
  natureNumber: 12,
  stages: { ...defaultStages },
  // The visible sheet reports 53 PV at level 7. These entries preserve that
  // displayed result through the app's derived-stat calculation.
  stats: {
    hp: { base: 45, levelPoints: 1, ev: 0, iv: 'A' },
    atk: { base: 60, levelPoints: 13, ev: 1, iv: 'S' },
    def: { base: 40, levelPoints: 1, ev: 1, iv: 'SS' },
    spAtk: { base: 70, levelPoints: 0, ev: 0, iv: 'A' },
    spDef: { base: 50, levelPoints: 0, ev: 1, iv: 'B' },
    spe: { base: 45, levelPoints: 6, ev: 3, iv: 'S' },
  },
  attacks: ['attack-double-kick'],
  inDex: false,
  createdAt: '2026-09-25T00:00:00.000Z',
};

const doubleKick: Attack = {
  id: 'attack-double-kick',
  name: 'Double kick',
  type: 'Lutador',
  category: 'Físico',
  pp: 30,
  power: 30,
  accuracy: 100,
  critRange: 20,
  target: 'Alvo único',
  priority: 0,
  makesContact: true,
  effectSummary: 'Ataca duas vezes com chutes consecutivos.',
  effectFull: 'O usuário desfere dois chutes consecutivos no alvo.',
  statusChances: [],
  stab: false,
};

function hasName(value: { name?: string }, name: string) {
  return value.name?.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase();
}

export async function seedImportedCampaignData() {
  const characters = getServerCollection<CharacterSheet[]>('characters', []);
  const pokemon = getServerCollection<Pokemon[]>('pokemon', []);
  const attacks = getServerCollection<Attack[]>('attacks', []);
  const provisionalItems = getServerCollection<Array<Record<string, unknown>>>('provisionalItems', []);

  const changes: Record<string, unknown> = {};
  const character = characters.find(item =>
    item.id === 'character-sabine'
    || item.id === 'character-lyra'
    || hasName(item, 'Sabine'),
  );

  if (character) {
    const inventory = [...(character.inventory || [])];
    for (const item of importedItemData) {
      if (!inventory.some(existing => hasName(existing, item.name))) inventory.push(item);
    }
    const abilities = [...(character.abilities || [])];
    for (const ability of importedAbilities) {
      const existing = abilities.find(item => hasName(item, ability.name));
      if (!existing) {
        abilities.push(ability);
      } else if (!existing.detail.trim() && ability.detail) {
        existing.detail = ability.detail;
        existing.uses = existing.uses || ability.uses;
      }
    }
    const existingSkills = character.skills || [];
    const shouldSeedSkills = existingSkills.length === 0 || existingSkills.every(skill => Number(skill.value) === 0);
    const skills = shouldSeedSkills
      ? existingSkills.map(skill => ({ ...skill, value: sabineSkillValues[skill.name] ?? skill.value }))
      : existingSkills;
    const nextCharacter = { ...character, inventory, abilities, skills };
    if (JSON.stringify(nextCharacter) !== JSON.stringify(character)) {
      changes.characters = characters.map(item => item.id === character.id ? nextCharacter : item);
    }
  }

  if (!pokemon.some(item => item.id === chucky.id || hasName(item, chucky.name) && hasName(item, chucky.species))) {
    changes.pokemon = [...pokemon, chucky];
  }

  if (!attacks.some(item => item.id === doubleKick.id || hasName(item, doubleKick.name))) {
    changes.attacks = [...attacks, doubleKick];
  }

  const existingItemNames = new Set(provisionalItems.map(item => String(item.name || '').toLocaleLowerCase()));
  const normalizedItems = provisionalItems.map(item => ({
    ...item,
    holdable: typeof item.holdable === 'boolean'
      ? item.holdable
      : !['Itens Chave', 'Pokebolas'].includes(String(item.category || '')),
  }));
  const missingDefaultItems = defaultProvisionalItems
    .filter(item => !existingItemNames.has(item.name.toLocaleLowerCase()))
    .map(item => ({ ...item }));
  const missingItems = importedItemData
    .filter(item => !existingItemNames.has(item.name.toLocaleLowerCase()))
    .map((item, index) => ({ id: `imported-item-${index + 1}`, ...item }));
  const nextProvisionalItems = [...normalizedItems, ...missingDefaultItems, ...missingItems];
  if (JSON.stringify(nextProvisionalItems) !== JSON.stringify(provisionalItems)) changes.provisionalItems = nextProvisionalItems;

  if (Object.keys(changes).length) await syncGameState(changes);
}