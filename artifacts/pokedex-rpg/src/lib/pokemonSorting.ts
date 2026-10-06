import type { Pokemon } from './types';

export type PokemonSortOrder =
  | 'name'
  | 'arrival-oldest'
  | 'arrival-newest'
  | 'type'
  | 'level-high'
  | 'level-low'
  | 'trainer'
  | 'species';

export const POKEMON_SORT_OPTIONS: Array<{ value: PokemonSortOrder; label: string }> = [
  { value: 'name', label: 'Nome (A–Z)' },
  { value: 'arrival-oldest', label: 'Chegada (mais antiga)' },
  { value: 'arrival-newest', label: 'Chegada (mais recente)' },
  { value: 'type', label: 'Tipo' },
  { value: 'level-high', label: 'Nível (maior primeiro)' },
  { value: 'level-low', label: 'Nível (menor primeiro)' },
  { value: 'trainer', label: 'Treinador' },
  { value: 'species', label: 'Espécie' },
];

const compareText = (left: string, right: string) =>
  left.localeCompare(right, 'pt-BR', { sensitivity: 'base', numeric: true });

function compareArrival(left: Pokemon, right: Pokemon, newestFirst: boolean) {
  const leftTime = Date.parse(left.createdAt || '');
  const rightTime = Date.parse(right.createdAt || '');
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);
  if (leftValid !== rightValid) return leftValid ? -1 : 1;
  if (!leftValid || !rightValid || leftTime === rightTime) return 0;
  return newestFirst ? rightTime - leftTime : leftTime - rightTime;
}

export function sortPokemon(pokemon: Pokemon[], order: PokemonSortOrder): Pokemon[] {
  return [...pokemon].sort((left, right) => {
    let comparison = 0;
    switch (order) {
      case 'arrival-oldest':
        comparison = compareArrival(left, right, false);
        break;
      case 'arrival-newest':
        comparison = compareArrival(left, right, true);
        break;
      case 'type':
        comparison = compareText(left.types.join(' / '), right.types.join(' / '));
        break;
      case 'level-high':
        comparison = right.level - left.level;
        break;
      case 'level-low':
        comparison = left.level - right.level;
        break;
      case 'trainer':
        comparison = compareText(left.trainerName || '', right.trainerName || '');
        break;
      case 'species':
        comparison = compareText(left.species || '', right.species || '');
        break;
      case 'name':
      default:
        comparison = compareText(left.name || '', right.name || '');
        break;
    }

    return comparison
      || compareText(left.name || '', right.name || '')
      || left.id.localeCompare(right.id);
  });
}