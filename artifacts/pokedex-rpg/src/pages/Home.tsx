import React, { useState } from 'react';
import { usePokemonData } from '../lib/hooks';
import { useCharacterSheets, useSessionRole } from '../lib/campaign';
import { RichText } from '@/components/RichText';
import { useLocation } from 'wouter';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TypeIconBadge } from '@/components/TypeIcon';
import { Search, Plus, Trash2, SplitSquareHorizontal, WandSparkles } from 'lucide-react';
import { defaultPokemonTemplate } from '../lib/constants';
import { toast } from 'sonner';
import { getCharacterPokemonRoster } from '../lib/pokemonOwnership';
import { POKEMON_SORT_OPTIONS, sortPokemon, type PokemonSortOrder } from '../lib/pokemonSorting';

export default function Home() {
  const { pokemon, addPokemon, deletePokemon } = usePokemonData();
  const { characters } = useCharacterSheets();
  const { role, activeCharacterId } = useSessionRole();
  const activeCharacter = characters.find(character => character.id === activeCharacterId);
  const activeRoster = activeCharacter
    ? getCharacterPokemonRoster(activeCharacter, pokemon, characters)
    : { partyPokemonIds: [], pcPokemonIds: [] };
  const activePokemonIds = new Set([...activeRoster.partyPokemonIds, ...activeRoster.pcPokemonIds]);
  const visibleCharacters = role === 'gm'
    ? characters
    : characters.filter(character => character.id === activeCharacterId);
  const shownPokemon = role === 'gm'
    ? pokemon
    : pokemon.filter(item => item.inDex && activePokemonIds.has(item.id));
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<PokemonSortOrder>('arrival-oldest');
  const [selectedForSplit, setSelectedForSplit] = useState<string[]>([]);

  const filteredPokemon = shownPokemon.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.trainerName.toLowerCase().includes(term) ||
      p.types.some(t => t.toLowerCase().includes(term)) ||
      (p.pokedexDescription || '').toLowerCase().includes(term)
    );
  });
  const sortedPokemon = sortPokemon(filteredPokemon, sortOrder);

  const handleCreate = () => {
    if (role !== 'gm') {
      toast.error('A criação de Pokémon é exclusiva do GM.');
      return;
    }
    const newP = addPokemon({ ...defaultPokemonTemplate });
    setLocation(`/sheet?id=${newP.id}`);
  };

  const toggleSplitSelect = (id: string) => {
    setSelectedForSplit(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2)  return [prev[1], id];
      return [...prev, id];
    });
  };

  const openSplitView = () => {
    if (selectedForSplit.length === 2) {
      setLocation(`/sheet?left=${selectedForSplit[0]}&right=${selectedForSplit[1]}`);
    } else if (selectedForSplit.length === 1) {
      setLocation(`/sheet?id=${selectedForSplit[0]}`);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl animate-in fade-in zoom-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciador de Fichas</h1>
          <p className="text-muted-foreground mt-1">Sua mesa começa aqui. Personagens, parceiros e regras no mesmo caderno.</p>
        </div>
        <div className="flex items-center gap-2">
          {role === 'gm' && <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Novo Pokémon
          </Button>}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div><p className="eyebrow">fichas de personagem</p><h2 className="font-display text-2xl">A companhia</h2></div>
          <Button variant="outline" size="sm" onClick={() => setLocation(activeCharacter ? `/personagem?id=${encodeURIComponent(activeCharacter.id)}` : '/personagem')} data-testid="button-open-character-sheet"><WandSparkles className="mr-2 h-4 w-4" /> Abrir ficha principal</Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
           {visibleCharacters.map(character => (
            <button key={character.id} onClick={() => setLocation(`/personagem?id=${character.id}`)} className="text-left rounded-lg border border-border bg-card p-4 hover:border-primary transition-colors" data-testid={`button-character-card-${character.id}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="font-display text-xl"><RichText text={character.name} /></p><p className="text-xs text-muted-foreground"><RichText text={`${character.className} · ${character.path}`} /></p></div><span className="font-mono text-xs text-primary">NÍV. {character.level}</span></div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span><RichText text={character.player} /></span><span className="font-mono">{character.hp}/{character.hpMax} PV</span></div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, treinador, tipo ou pokédex..."
            className="pl-9"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={sortOrder}
          onChange={event => setSortOrder(event.target.value as PokemonSortOrder)}
          aria-label="Ordenar Pokédex"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-56"
          data-testid="select-pokemon-sort"
        >
          {POKEMON_SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {selectedForSplit.length > 0 && (
          <div className="flex items-center gap-3 bg-secondary/50 p-2 rounded-lg border border-border">
            <span className="text-sm text-muted-foreground ml-2">
              {selectedForSplit.length} selecionado{selectedForSplit.length > 1 ? 's' : ''}
            </span>
            <Button size="sm" variant="secondary" onClick={openSplitView}>
              <SplitSquareHorizontal className="mr-2 h-4 w-4" />
              {selectedForSplit.length === 2 ? 'Abrir Lado a Lado' : 'Abrir Ficha'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedForSplit([])}>Cancelar</Button>
          </div>
        )}
      </div>

      {shownPokemon.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <div className="text-muted-foreground mb-4">Nenhum Pokémon encontrado.</div>
          {role === 'gm' && <Button onClick={handleCreate}>Criar Primeiro Pokémon</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedPokemon.map(p => (
            <Card
              key={p.id}
              className={`overflow-hidden transition-all duration-200 hover:border-primary/50 group ${selectedForSplit.includes(p.id) ? 'ring-2 ring-primary border-primary' : ''}`}
            >
              <div
                className="h-32 bg-secondary/30 relative flex items-center justify-center cursor-pointer"
                onClick={() => setLocation(`/sheet?id=${p.id}`)}
              >
                {p.image ? (
                  <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <div className="text-muted-foreground text-4xl font-bold opacity-20">?</div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  {p.types.map(t => <TypeIconBadge key={t} type={t} size={24} />)}
                </div>
                <div className="absolute bottom-2 left-2">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">Lv. {p.level}</Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <h3
                    className="font-bold text-lg leading-tight truncate mr-2 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setLocation(`/sheet?id=${p.id}`)}
                  >
                    {p.name || 'Sem Nome'}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {p.trainerName ? `Treinador: ${p.trainerName}` : 'Sem treinador'}
                </p>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex justify-between gap-2">
                <Button
                  variant={selectedForSplit.includes(p.id) ? "secondary" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={e => { e.stopPropagation(); toggleSplitSelect(p.id); }}
                >
                  <SplitSquareHorizontal className="h-4 w-4 mr-1" />
                  {selectedForSplit.includes(p.id) ? 'Selecionado' : 'Comparar'}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={e => { e.stopPropagation(); if (role === 'gm' && confirm(`Excluir ${p.name}?`)) deletePokemon(p.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
