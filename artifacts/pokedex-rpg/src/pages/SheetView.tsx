import React from 'react';
import { useLocation } from 'wouter';
import PokemonSheetComponent from '../components/PokemonSheetComponent';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useCharacterSheets, useSessionRole } from '../lib/campaign';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePokemonData } from '../lib/hooks';
import { getCharacterPokemonRoster } from '../lib/pokemonOwnership';

export default function SheetView() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  const id = searchParams.get('id');
  const leftId = searchParams.get('left');
  const rightId = searchParams.get('right');

  const isSplit = leftId && rightId;
  const { role, activeCharacterId } = useSessionRole();
  const { characters } = useCharacterSheets();
  const { pokemon } = usePokemonData();
  const returnCharacterId = searchParams.get('returnCharacterId');
  const returnPokemonTab = searchParams.get('returnPokemonTab') === 'pc' ? 'pc' : 'party';
  const returnCharacter = characters.find(character => character.id === returnCharacterId);
  const returnToCharacter = returnCharacter
    ? `/personagem?${new URLSearchParams({
      id: returnCharacter.id,
      tab: 'Pokémon',
      pokemonTab: returnPokemonTab,
    }).toString()}`
    : null;
  const activeCharacter = characters.find(character => character.id === activeCharacterId);
  const activeRoster = activeCharacter
    ? getCharacterPokemonRoster(activeCharacter, pokemon, characters)
    : { partyPokemonIds: [], pcPokemonIds: [] };
  const allowedPokemon = new Set([...activeRoster.partyPokemonIds, ...activeRoster.pcPokemonIds]);
  const requestedIds = [id, leftId, rightId].filter(Boolean) as string[];
  let origin: string | null = null;
  try { origin = sessionStorage.getItem('pokemon-sheet-origin'); } catch { /* Use fallback below. */ }
  const safeOrigin = origin && /^\/(publico|pokemon|fichas|mestre|personagem)(\?|$)/.test(origin) ? origin : null;
  const returnPath = returnToCharacter || safeOrigin || (role === 'gm' ? '/pokemon' : role === 'player' ? '/personagem' : '/publico');
  const isReadOnly = (pokemonId: string) => role === 'public' || (role === 'player' && !allowedPokemon.has(pokemonId));

  return (
    <div className="w-full flex flex-col min-h-[calc(100vh-64px)]">
      <div className="bg-background border-b border-border p-2 sticky top-16 z-40 flex items-center shadow-sm">
         <Button variant="ghost" size="sm" onClick={() => setLocation(returnPath)} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4 mr-1" />
           {returnToCharacter ? 'Voltar para a ficha' : 'Voltar para a lista'}
        </Button>
        {isSplit && (
          <div className="ml-auto text-sm text-muted-foreground font-medium hidden sm:block">
            Modo Lado a Lado
          </div>
        )}
      </div>
      
      <div className={`flex-1 flex flex-col md:flex-row gap-0 overflow-hidden ${isSplit ? '' : 'justify-center p-4 sm:p-6'}`}>
        {isSplit ? (
          <>
            <div className="flex-1 w-full md:w-1/2 overflow-y-auto border-r border-border custom-scrollbar">
              <div className="p-4 sm:p-6 h-full">
                <PokemonSheetComponent pokemonId={leftId} readOnly={isReadOnly(leftId)} />
              </div>
            </div>
            <div className="flex-1 w-full md:w-1/2 overflow-y-auto custom-scrollbar bg-card/10">
              <div className="p-4 sm:p-6 h-full">
                <PokemonSheetComponent pokemonId={rightId} readOnly={isReadOnly(rightId)} />
              </div>
            </div>
          </>
        ) : (
          <div className="w-full max-w-5xl bg-card border border-border shadow-xl rounded-xl">
            <PokemonSheetComponent pokemonId={id || ''} readOnly={isReadOnly(id || '')} />
          </div>
        )}
      </div>
    </div>
  );
}