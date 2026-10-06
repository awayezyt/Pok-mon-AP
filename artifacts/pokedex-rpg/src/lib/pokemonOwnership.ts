import type { CharacterSheet, TrainerRecord } from './campaign';
import { getServerCollection, syncGameState } from './cloudSync';
import type { Pokemon } from './types';

export type PokemonTrainerTarget = {
  id: string;
  name: string;
  kind: 'character' | 'trainer';
};

export function normalizeTrainerName(value: string | null | undefined) {
  return (value || '').trim().normalize('NFKC').toLocaleLowerCase();
}

export function characterHasPokemon(character: CharacterSheet, pokemonId: string) {
  return character.partyPokemonIds.includes(pokemonId) || character.pcPokemonIds.includes(pokemonId);
}

function trainerHasPokemon(trainer: TrainerRecord, pokemonId: string) {
  return trainer.pokemonIds?.includes(pokemonId) || trainer.pokemonId === pokemonId;
}

export function getCharacterPokemonRoster(
  character: CharacterSheet,
  pokemon: Pokemon[],
  characters: CharacterSheet[],
) {
  const partyPokemonIds = [...new Set(character.partyPokemonIds)];
  const pcPokemonIds = [...new Set(character.pcPokemonIds)].filter(id => !partyPokemonIds.includes(id));
  const idsAssignedElsewhere = new Set(
    characters
      .filter(other => other.id !== character.id)
      .flatMap(other => [...other.partyPokemonIds, ...other.pcPokemonIds]),
  );
  const listedHere = new Set([...partyPokemonIds, ...pcPokemonIds]);
  const linkedByTrainerName = pokemon
    .filter(item => normalizeTrainerName(item.trainerName) === normalizeTrainerName(character.name))
    .filter(item => !listedHere.has(item.id) && !idsAssignedElsewhere.has(item.id));
  const partySlots = Math.max(0, 6 - partyPokemonIds.length);

  return {
    partyPokemonIds: [...partyPokemonIds, ...linkedByTrainerName.slice(0, partySlots).map(item => item.id)],
    pcPokemonIds: [...pcPokemonIds, ...linkedByTrainerName.slice(partySlots).map(item => item.id)],
  };
}

export function getPokemonTrainerName(
  pokemon: Pick<Pokemon, 'id' | 'trainerName'>,
  characters: CharacterSheet[],
  trainers: TrainerRecord[],
) {
  const fieldTrainer = (pokemon.trainerName || '').trim();
  if (fieldTrainer) return fieldTrainer;

  const character = characters.find(item => characterHasPokemon(item, pokemon.id));
  if (character) return character.name;

  const trainer = trainers.find(item => trainerHasPokemon(item, pokemon.id));
  if (trainer?.characterId) {
    const linkedCharacter = characters.find(item => item.id === trainer.characterId);
    if (linkedCharacter) return linkedCharacter.name;
  }
  return trainer?.name?.trim() || '';
}

export function getPokemonAssignmentConflict(
  pokemon: Pick<Pokemon, 'id' | 'trainerName'>,
  target: PokemonTrainerTarget,
  characters: CharacterSheet[],
  trainers: TrainerRecord[],
) {
  const characterOwner = characters.find(
    character => characterHasPokemon(character, pokemon.id)
      && !(target.kind === 'character' && character.id === target.id),
  );
  if (characterOwner) return characterOwner.name;

  const trainerOwner = trainers.find(
    trainer => trainerHasPokemon(trainer, pokemon.id)
      && !(target.kind === 'trainer' && trainer.id === target.id)
      && !(target.kind === 'character' && (
        trainer.characterId === target.id
        || trainer.id === target.id
        || (trainer.kind === 'player' && normalizeTrainerName(trainer.name) === normalizeTrainerName(target.name))
      )),
  );
  if (trainerOwner) return trainerOwner.name;

  const fieldTrainer = (pokemon.trainerName || '').trim();
  if (fieldTrainer && normalizeTrainerName(fieldTrainer) !== normalizeTrainerName(target.name)) {
    return fieldTrainer;
  }

  return null;
}

export function syncPokemonTrainerRecord(pokemonId: string, targetTrainerId?: string) {
  const current = getServerCollection<TrainerRecord[]>('trainers', []);
  if (!current.length) return;

  let changed = false;
  const next = current.map(trainer => {
    const ids = [...new Set([...(trainer.pokemonIds || []), ...(trainer.pokemonId ? [trainer.pokemonId] : [])])];
    const nextIds = trainer.id === targetTrainerId
      ? [...new Set([...ids, pokemonId])]
      : ids.filter(id => id !== pokemonId);
    const nextLegacyId = trainer.pokemonId === pokemonId ? undefined : trainer.pokemonId;
    if (
      trainer.pokemonId !== nextLegacyId
      || (trainer.pokemonIds || []).length !== nextIds.length
      || (trainer.pokemonIds || []).some((id, index) => id !== nextIds[index])
    ) changed = true;
    return { ...trainer, pokemonIds: nextIds, pokemonId: nextLegacyId };
  });

  if (changed) void syncGameState({ trainers: next });
}