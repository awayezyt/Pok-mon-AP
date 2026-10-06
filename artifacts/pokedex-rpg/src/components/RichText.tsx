import type { ReactNode } from 'react';
import { PhysicalIcon, SpecialIcon, StatusIcon, TYPE_ICON_SOURCES } from '@/components/TypeIcon';

const SHORTCODE_ICONS: Record<string, { src: string; label: string }> = {
  type_ice: { src: TYPE_ICON_SOURCES.Gelo, label: 'Gelo' },
  type_bug: { src: TYPE_ICON_SOURCES.Inseto, label: 'Inseto' },
  type_steel: { src: TYPE_ICON_SOURCES.Metálico, label: 'Metálico' },
  type_fairy: { src: TYPE_ICON_SOURCES.Fada, label: 'Fada' },
  type_normal: { src: TYPE_ICON_SOURCES.Normal, label: 'Normal' },
  type_dragon: { src: TYPE_ICON_SOURCES.Dragão, label: 'Dragão' },
  type_grass: { src: TYPE_ICON_SOURCES.Planta, label: 'Planta' },
  type_flying: { src: TYPE_ICON_SOURCES.Voador, label: 'Voador' },
  type_rock: { src: TYPE_ICON_SOURCES.Pedra, label: 'Pedra' },
  type_psychic: { src: TYPE_ICON_SOURCES.Psíquico, label: 'Psíquico' },
  type_fire: { src: TYPE_ICON_SOURCES.Fogo, label: 'Fogo' },
  type_fighting: { src: TYPE_ICON_SOURCES.Lutador, label: 'Lutador' },
  type_ground: { src: TYPE_ICON_SOURCES.Terra, label: 'Terra' },
  type_poison: { src: TYPE_ICON_SOURCES.Veneno, label: 'Veneno' },
  type_eletric: { src: TYPE_ICON_SOURCES.Elétrico, label: 'Elétrico' },
  type_electric: { src: TYPE_ICON_SOURCES.Elétrico, label: 'Elétrico' },
  type_dark: { src: TYPE_ICON_SOURCES.Sombrio, label: 'Sombrio' },
  type_ghost: { src: TYPE_ICON_SOURCES.Fantasma, label: 'Fantasma' },
  type_water: { src: TYPE_ICON_SOURCES.Água, label: 'Água' },
  move_physical: { src: PhysicalIcon, label: 'Ataque físico' },
  move_special: { src: SpecialIcon, label: 'Ataque especial' },
  move_status: { src: StatusIcon, label: 'Movimento de status' },
};

const TYPE_WORDS: Record<string, string> = {
  normal: 'type_normal',
  fire: 'type_fire',
  fogo: 'type_fire',
  water: 'type_water',
  agua: 'type_water',
  grass: 'type_grass',
  planta: 'type_grass',
  electric: 'type_electric',
  eletrico: 'type_electric',
  ice: 'type_ice',
  gelo: 'type_ice',
  fighting: 'type_fighting',
  lutador: 'type_fighting',
  poison: 'type_poison',
  veneno: 'type_poison',
  ground: 'type_ground',
  terra: 'type_ground',
  flying: 'type_flying',
  voador: 'type_flying',
  psychic: 'type_psychic',
  psiquico: 'type_psychic',
  bug: 'type_bug',
  inseto: 'type_bug',
  rock: 'type_rock',
  pedra: 'type_rock',
  ghost: 'type_ghost',
  fantasma: 'type_ghost',
  dragon: 'type_dragon',
  dragao: 'type_dragon',
  dark: 'type_dark',
  sombrio: 'type_dark',
  steel: 'type_steel',
  metalico: 'type_steel',
  aco: 'type_steel',
  fairy: 'type_fairy',
  fada: 'type_fairy',
};

function normalizeTypeWord(word: string) {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const EXPLICIT_TYPE_CONTEXT = /(?:\b(?:type|tipo)\s+(?:(?:of|de|do|da|dos|das)\s+)?|\b(?:attack|ataque|golpe|move|movimento|dano)\s+(?:(?:of|de|do|da|dos|das)\s+)?|\b(?:contra|against)\s+(?:(?:o|a|os|as|the)\s+)?|\bPok[eé]mon\s+(?:(?:de|do|da|dos|das|of|type)\s+))$/iu;

function isExplicitTypeMention(value: string, wordStartIndex: number, wordEndIndex: number) {
  const followsProperName = /^\s+[\p{Lu}]/u.test(value.slice(wordEndIndex));
  return !followsProperName && EXPLICIT_TYPE_CONTEXT.test(value.slice(0, wordStartIndex));
}

export function RichText({
  text,
  className,
  replaceTypeNames = false,
}: {
  text?: string | null;
  className?: string;
  replaceTypeNames?: boolean;
}) {
  const value = typeof text === 'string' ? text : '';
  const parserPattern = replaceTypeNames
    ? /:(type|move)_([a-z]+):|(^|[^\p{L}\p{N}_])([\p{L}]+)(?![\p{L}\p{N}_])/giu
    : /:(type|move)_([a-z]+):/g;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let iconIndex = 0;

  while ((match = parserPattern.exec(value)) !== null) {
    if (match.index > cursor) parts.push(value.slice(cursor, match.index));
    const typedWord = replaceTypeNames ? match[4] : undefined;
    const shortcode = match[1] ? `${match[1]}_${match[2]}` : undefined;
    const typeCode = typedWord ? TYPE_WORDS[normalizeTypeWord(typedWord)] : undefined;
    const wordStartIndex = match.index + (match[3]?.length || 0);
    const icon = SHORTCODE_ICONS[shortcode || (typeCode && isExplicitTypeMention(value, wordStartIndex, wordStartIndex + typedWord!.length) ? typeCode : '')];
    if (icon) {
      if (match[3]) parts.push(match[3]);
      parts.push(
        <img
          key={`shortcode-${iconIndex++}`}
          src={icon.src}
          alt={icon.label}
          title={icon.label}
          className="mx-[0.08em] inline-block h-[1.1em] w-[1.1em] object-contain align-[-0.18em]"
        />,
      );
    } else {
      parts.push(`${match[3] || ''}${typedWord || match[0]}`);
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) parts.push(value.slice(cursor));
  return <span className={className}>{parts}</span>;
}