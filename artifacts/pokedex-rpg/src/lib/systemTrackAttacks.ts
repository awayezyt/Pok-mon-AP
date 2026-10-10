import type { Attack } from './types';
import trainerBlocks from '../data/pokemonSystemBlocks/3554bb16-8489-8084-8dfe-f89844ab7e6c.json';
import researcherBlocks from '../data/pokemonSystemBlocks/3554bb16-8489-807e-873d-c7009a24b536.json';
import contestantBlocks from '../data/pokemonSystemBlocks/3554bb16-8489-802a-92ab-de4c6de1735a.json';
import adventurerBlocks from '../data/pokemonSystemBlocks/3554bb16-8489-80ae-9981-cf8d8a204586.json';

type SourceBlock = {
  id: string;
  type: string;
  text?: string;
  children?: SourceBlock[];
};

type SystemAttackSource = Omit<Attack, 'id'> & { sourceBlockId: string };
export const SYSTEM_TRACK_ATTACK_SYNC_VERSION = 2;

const classPages = [
  trainerBlocks as SourceBlock[],
  researcherBlocks as SourceBlock[],
  contestantBlocks as SourceBlock[],
  adventurerBlocks as SourceBlock[],
];

const knownMoveTypes: Record<string, Attack['type']> = {
  bulkup: 'Lutador',
  counter: 'Lutador',
  batonpass: 'Normal',
  trickroom: 'Psíquico',
  calmmind: 'Psíquico',
  confusion: 'Psíquico',
  shadowsneak: 'Fantasma',
  agility: 'Psíquico',
  irondefense: 'Metálico',
  endure: 'Normal',
  stealthrock: 'Pedra',
  ancientpower: 'Pedra',
  disable: 'Normal',
  laserfocus: 'Normal',
  mindreader: 'Normal',
  instruct: 'Psíquico',
};

export function normalizeSystemAttackName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]/g, '');
}

function titleFromBlock(block: SourceBlock): string {
  return (block.text || '').replace(/^\/+|\/+$/g, '').trim();
}

function collectText(blocks: SourceBlock[]): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    const text = (block.text || '').replace(/\s+/g, ' ').trim();
    if (text) lines.push(text);
    if (block.children?.length) lines.push(...collectText(block.children));
  }
  return lines;
}

function parseTrackMove(block: SourceBlock): SystemAttackSource | null {
  const name = titleFromBlock(block);
  const lines = collectText(block.children || []);
  const categoryLine = lines.find(line => /categoria\s*:/i.test(line));
  const ppLine = lines.find(line => /\bPP\s*:/i.test(line));
  const categoryMatch = categoryLine?.match(/move_(physical|special|status)/i);
  const ppMatch = ppLine?.match(/\bPP\s*:\s*(\d+)/i);
  if (!name || normalizeSystemAttackName(name) === 'nome' || !categoryMatch || !ppMatch) return null;

  const category: Attack['category'] = categoryMatch[1].toLowerCase() === 'physical'
    ? 'Físico'
    : categoryMatch[1].toLowerCase() === 'special'
      ? 'Especial'
      : 'Status';
  const accuracyLine = lines.find(line => /\bACC\s*:/i.test(line));
  const accuracy = Number(accuracyLine?.match(/\bACC\s*:\s*(\d+)/i)?.[1] || 100);
  const damageLine = lines.find(line => /Dano\s*\(/i.test(line));
  const power = Number(damageLine?.match(/Dano\s*\((\d+)\)/i)?.[1] ?? (category === 'Status' ? NaN : 0));
  const targetLine = lines.find(line => /\bAlvo\s*:/i.test(line));
  const areaLine = lines.find(line => /Área\s*:/i.test(line));
  const target = (areaLine || targetLine)?.replace(/^[^:]+:\s*/, '').trim() || 'Alvo único';
  const priority = Number(lines.find(line => /Prioridade\s*\(/i.test(line))?.match(/Prioridade\s*\(\s*(-?\d+)/i)?.[1] || 0);
  const critRange = Number(lines.find(line => /\bCrit\s*:/i.test(line))?.match(/\bCrit\s*:\s*(\d+)/i)?.[1] || 20);
  const makesContact = lines.some(line => /^Contato$/i.test(line));
  const metadata = /^(?:Categoria|PP|ACC|Dano(?:\s*\([^)]*\))?|Alvo|Área)\s*:/i;
  const descriptions = lines.filter(line =>
    !metadata.test(line)
    && !/^Contato$/i.test(line)
    && !/^Campo(?:\s*:|\s*\()/i.test(line)
    && !/^Prioridade\s*\(/i.test(line)
    && !/^\(?Crit\s*:/i.test(line)
    && !/^[-—]+$/.test(line),
  );
  if (!descriptions.length) return null;

  const effectFull = descriptions.join('\n');
  const effectSummary = descriptions[0];

  return {
    sourceBlockId: block.id,
    name,
    type: knownMoveTypes[normalizeSystemAttackName(name)] || 'Normal',
    category,
    pp: Number(ppMatch[1]),
    power: Number.isFinite(power) ? power : null,
    accuracy: Number.isFinite(accuracy) ? accuracy : 100,
    critRange: Number.isFinite(critRange) ? critRange : 20,
    target,
    priority: Number.isFinite(priority) ? priority : 0,
    makesContact,
    effectSummary,
    effectFull,
    statusChances: [],
    stab: true,
  };
}

function collectTrackMoves(page: SourceBlock[]): SystemAttackSource[] {
  let inTracks = false;
  const moves: SystemAttackSource[] = [];
  for (const block of page) {
    if (block.type === 'heading_2') {
      inTracks = (block.text || '').trim().toLocaleLowerCase('pt-BR') === 'trilhas';
      continue;
    }
    if (inTracks && block.type === 'toggle') {
      const move = parseTrackMove(block);
      if (move) moves.push(move);
    }
  }
  return moves;
}

const movedSystemAttacks: SystemAttackSource[] = [
  {
    sourceBlockId: 'system-page-move-low-kick',
    name: 'Low Kick',
    type: 'Lutador',
    category: 'Físico',
    pp: 20,
    power: 0,
    accuracy: 100,
    critRange: 20,
    target: '1 ser',
    priority: 0,
    makesContact: true,
    effectSummary: 'Realiza um chute baixo contra o alvo, causando dano principalmente com sua queda.',
    effectFull: [
      'Realiza um chute baixo contra o alvo, causando dano principalmente com sua queda.',
      'Seu PDR é baseado no peso do alvo acertado.',
      '0.1 a 9.9 → (20) 2d8+4',
      '10.0 a 24.9 → (40) 3d8+6',
      '25.0 a 49.9 → (60) 4d8+8',
      '50.0 a 99.9 → (80) 5d8+10',
      '100.0 a 199.9 → (100) 6d8+12',
      '200.0+ → (120) 7d8+14',
    ].join('\n'),
    statusChances: [],
    stab: true,
  },
  {
    sourceBlockId: 'system-page-move-smokescreen',
    name: 'Smokescreen',
    type: 'Normal',
    category: 'Status',
    pp: 20,
    power: null,
    accuracy: 100,
    critRange: 20,
    target: 'Campo do oponente',
    priority: 0,
    makesContact: false,
    effectSummary: 'Uma onda de fumaça que dificulta a visão dos atingidos.',
    effectFull: 'Uma onda de fumaça que dificulta a visão dos atingidos.\nReduz em -1 Estágio Acerto dos alvos atingidos.',
    statusChances: [],
    stab: true,
  },
  {
    sourceBlockId: 'system-page-move-flash',
    name: 'Flash',
    type: 'Normal',
    category: 'Status',
    pp: 20,
    power: null,
    accuracy: 100,
    critRange: 20,
    target: '1 ser',
    priority: 0,
    makesContact: false,
    effectSummary: 'Emite um forte brilho que cega seus inimigos.',
    effectFull: 'Emite um forte brilho que cega seus inimigos.\nReduz em -1 Estágio o Acerto do alvo.',
    statusChances: [],
    stab: true,
  },
];

export const SYSTEM_TRACK_ATTACKS = classPages
  .flatMap(page => collectTrackMoves(page))
  .concat(movedSystemAttacks);

export function syncSystemTrackAttacks(
  current: Attack[],
  currentLinks: Record<string, string>,
): { attacks: Attack[]; links: Record<string, string> } {
  const attacks = current.map(attack => ({ ...attack }));
  const links = { ...currentLinks };

  for (const source of SYSTEM_TRACK_ATTACKS) {
    const { sourceBlockId, ...attackData } = source;
    const linkedId = links[sourceBlockId];
    let index = linkedId ? attacks.findIndex(attack => attack.id === linkedId) : -1;
    if (index < 0) {
      const normalizedName = normalizeSystemAttackName(source.name);
      index = attacks.findIndex(attack => normalizeSystemAttackName(attack.name) === normalizedName);
    }

    if (index >= 0) {
      const existing = attacks[index];
      attacks[index] = { ...existing, ...attackData, id: existing.id, name: source.name };
      links[sourceBlockId] = existing.id;
      continue;
    }

    const id = `system-move-${normalizeSystemAttackName(source.name)}`;
    attacks.push({ ...attackData, id });
    links[sourceBlockId] = id;
  }

  return { attacks, links };
}
