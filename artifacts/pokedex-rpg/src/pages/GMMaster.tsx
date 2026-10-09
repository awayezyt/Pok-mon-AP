import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  AlertTriangle, Archive, BookOpen, Check, ChevronRight, CircleDot, ClipboardList,
  Copy, Edit3, Eye, Flag, Headphones, LockKeyhole, Map, Plus, ScrollText,
  Search, ImagePlus, ClipboardPaste, Filter,
  Shield, Trash2, UsersRound, Swords, PackageOpen, ExternalLink, Coins,
  Settings, Download, Upload, FileJson, FunctionSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichText } from '@/components/RichText';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useCampaignNotes, useCampaignStory, useCharacterSheets, useGMBoard,
  calculateCharacterResources, CHARACTER_CLASSES, CHARACTER_ATTRIBUTE_LABELS, SKILL_NAMES, getSkillCap,
  createGMPlanningMap, type CampaignEpisode, type CampaignScene, type CharacterAttribute, type CharacterSheet,
  type GMPlanningMap,
  type MusicTrack, type ProvisionalItem, type SceneMarketItem, type SceneTest, type TrainerRecord,
} from '../lib/campaign';
import { usePokemonData, useAttackData } from '../lib/hooks';
import { getServerCollection, syncGameState } from '../lib/cloudSync';
import FormulaEditor from '../components/FormulaEditor';
import { useFormulaSettings } from '../lib/formulas';
import { createGameBackup, importGameState, syncImportedGameState } from '../lib/backup';
import type { Pokemon, PokemonGrowthRate } from '../lib/types';
import { getCharacterPokemonRoster, getPokemonAssignmentConflict, getPokemonTrainerName, normalizeTrainerName } from '../lib/pokemonOwnership';
import {
  buildGMPlanningResources,
  normalizeGMProvisionalItems as normalizeItems,
  normalizeGMTrainers as normalizeTrainers,
} from '../lib/gmPlanning';
import GMNotesWorkspace from '../components/GMNotesWorkspace';

type Panel = 'visao' | 'pokemon' | 'treinadores' | 'itens' | 'episodios' | 'musica' | 'anotacoes' | 'configuracoes';
const panelLabels: Record<Panel, string> = {
  visao: 'Visão geral',
  pokemon: 'Pokémon',
  treinadores: 'Treinadores e fichas',
  itens: 'Itens provisórios',
  episodios: 'Episódios',
  musica: 'Música',
  anotacoes: 'Anotações',
  configuracoes: 'Configurações',
};
const attributeKeys: CharacterAttribute[] = ['agi', 'car', 'for', 'int', 'vig', 'von'];
const itemCategories = ['Consumíveis', 'Berries', 'Itens Chave', 'Especiais', 'Alimentos', 'TM', 'Pokebolas', 'Batalha'];
type GMSceneFocus = { episodeId: string; sceneId: string };

const GROWTH_VALUES: Record<PokemonGrowthRate, number> = {
  'Errático': 1, 'Rápido': 2, 'Meio rápido': 3,
  'Meio devagar': 4, 'Devagar': 5, 'Muito devagar': 6,
};
function xpCap(pokemon: { level: number; growthRate?: PokemonGrowthRate }) {
  return Math.max(1, Math.floor(pokemon.level) * GROWTH_VALUES[pokemon.growthRate || 'Meio rápido']);
}

function affectionLabel(value: number) {
  if (value <= -6) return 'Péssima';
  if (value < 0) return 'Ruim';
  if (value <= 10) return 'Neutro';
  if (value <= 20) return 'Bom';
  if (value <= 30) return 'Amigo';
  return 'Inquebrável';
}

export default function GMMaster() {
  const [, setLocation] = useLocation();
  const { characters, addCharacter, updateCharacter, deleteCharacter } = useCharacterSheets();
  const { pokemon, updatePokemon, setPokemon } = usePokemonData();
  const { attacks, setAttacks } = useAttackData();
  const { notes, saveNote, removeNote } = useCampaignNotes();
  const { board, setBoard } = useGMBoard();
  const { episodes, addEpisode, updateEpisode, removeEpisode, emptyScene } = useCampaignStory();
  const [panel, setPanelState] = useState<Panel>(() => {
    const requested = new URLSearchParams(window.location.search).get('panel');
    return requested && requested in panelLabels ? requested as Panel : 'visao';
  });
  const setPanel = (next: Panel) => {
    setPanelState(next);
    // Keep the tab in the URL so returning from a sheet restores it.
    const url = new URL(window.location.href);
    url.searchParams.set('panel', next);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  };
  const [selectedNote, setSelectedNote] = useState<string | null>(notes[0]?.id || null);
  const [selectedCharacterId, setSelectedCharacterId] = useState(characters[0]?.id || '');
  const [expandedCharacterId, setExpandedCharacterId] = useState<string | null>(characters[0]?.id || null);
  const [selectedPokemonId, setSelectedPokemonId] = useState(pokemon[0]?.id || '');
  const [pokemonSearch, setPokemonSearch] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [trainerDraft, setTrainerDraft] = useState({ name: '', player: '', characterId: '', pokemonId: '' });
  const [trainers, setTrainersState] = useState<TrainerRecord[]>(normalizeTrainers);
  const trainersRef = useRef(trainers);
  const [provisionalItems, setProvisionalItemsState] = useState<ProvisionalItem[]>(normalizeItems);
  const provisionalItemsRef = useRef(provisionalItems);
  const [itemDraft, setItemDraft] = useState({ name: '', category: 'Especiais', weight: 1, detail: '', image: '', holdable: true });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [pendingDelivery, setPendingDelivery] = useState<{ item: ProvisionalItem; character: CharacterSheet } | null>(null);
  const [reminderDraft, setReminderDraft] = useState('');
  const [importantReminder, setImportantReminder] = useState(false);
  const [musicDraft, setMusicDraft] = useState<{ title: string; url: string; category: MusicTrack['category']; keywords: string }>({ title: '', url: '', category: 'Batalha', keywords: '' });
  const [musicSearch, setMusicSearch] = useState('');
  const [musicCategory, setMusicCategory] = useState<'all' | MusicTrack['category']>('all');
  const [editingTrainerId, setEditingTrainerId] = useState<string | null>(null);
  const [sceneFocus, setSceneFocusState] = useState<GMSceneFocus>(() => {
    const saved = getServerCollection<Partial<GMSceneFocus>>('gmSceneFocus', {});
    return { episodeId: saved.episodeId || '', sceneId: saved.sceneId || '' };
  });
  const selectedEpisodeId = sceneFocus.episodeId;
  const selectedSceneId = sceneFocus.sceneId;
  const saveSceneFocus = (next: GMSceneFocus) => {
    setSceneFocusState(next);
    void syncGameState({ gmSceneFocus: next });
  };
  const setSelectedEpisodeId = (id: string) => {
    const nextEpisode = episodes.find(item => item.id === id);
    saveSceneFocus({ episodeId: id, sceneId: nextEpisode?.scenes[0]?.id || '' });
  };
  const setSelectedSceneId = (id: string) => {
    const ownerEpisode = episodes.find(item => item.scenes.some(scene => scene.id === id));
    saveSceneFocus({ episodeId: ownerEpisode?.id || selectedEpisodeId, sceneId: id });
  };
  const [focusedTrainerId, setFocusedTrainerId] = useState('');
  const setTrainers = (next: TrainerRecord[] | ((current: TrainerRecord[]) => TrainerRecord[])) => {
    const updated = typeof next === 'function' ? next(trainersRef.current) : next;
    trainersRef.current = updated;
    void syncGameState({ trainers: updated });
    setTrainersState(updated);
  };
  const setProvisionalItems = (next: ProvisionalItem[] | ((current: ProvisionalItem[]) => ProvisionalItem[])) => {
    const updated = typeof next === 'function' ? next(provisionalItemsRef.current) : next;
    provisionalItemsRef.current = updated;
    void syncGameState({ provisionalItems: updated });
    setProvisionalItemsState(updated);
  };

  const selected = notes.find(note => note.id === selectedNote);
  const playerPokemonIds = new Set(characters.flatMap(character => {
    const roster = getCharacterPokemonRoster(character, pokemon, characters);
    return [...roster.partyPokemonIds, ...roster.pcPokemonIds];
  }));
  const associatedPokemon = pokemon.filter(item => playerPokemonIds.has(item.id));
  const filteredPokemon = associatedPokemon.filter(item => `${item.name} ${item.species} ${item.trainerName}`.toLowerCase().includes(pokemonSearch.toLowerCase()));
  const selectedPokemon = filteredPokemon.find(item => item.id === selectedPokemonId) || filteredPokemon[0];
  const selectedEpisode = episodes.find(item => item.id === selectedEpisodeId) || episodes[0];
  const selectedScene = selectedEpisode?.scenes.find(item => item.id === selectedSceneId) || selectedEpisode?.scenes[0];
  const activeMindMap = board.mindMaps.find(map => map.id === board.activeMindMapId) || board.mindMaps[0];
  const planningResources = useMemo(() => buildGMPlanningResources({
    pokemon,
    trainers,
    music: board.music,
    items: provisionalItems,
    episodes,
    characters,
  }), [pokemon, trainers, board.music, provisionalItems, episodes, characters]);
  const updateMindMap = (map: GMPlanningMap) => setBoard(current => ({
    ...current,
    mindMaps: current.mindMaps.map(item => item.id === map.id
      ? { ...map, updatedAt: new Date().toISOString() }
      : item),
  }));
  const selectMindMap = (id: string) => setBoard(current => ({ ...current, activeMindMapId: id }));
  const createMindMap = () => {
    const map = createGMPlanningMap(`Mapa ${board.mindMaps.length + 1}`);
    setBoard(current => ({
      ...current,
      mindMaps: [...current.mindMaps, map],
      activeMindMapId: map.id,
    }));
  };
  const renameMindMap = (id: string, title: string) => setBoard(current => ({
    ...current,
    mindMaps: current.mindMaps.map(map => map.id === id ? { ...map, title, updatedAt: new Date().toISOString() } : map),
  }));
  const deleteMindMap = (id: string) => setBoard(current => {
    if (current.mindMaps.length <= 1) return current;
    const mindMaps = current.mindMaps.filter(map => map.id !== id);
    return {
      ...current,
      mindMaps,
      activeMindMapId: current.activeMindMapId === id ? mindMaps[0].id : current.activeMindMapId,
    };
  });
  const openMindMapEditor = (id: string) => {
    const targetId = crypto.randomUUID();
    try { sessionStorage.setItem('pokemon-rpg-planning-origin', targetId); } catch { /* Editing still works without cross-tab sheet navigation. */ }
    const query = new URLSearchParams({ map: id, returnTab: targetId });
    window.open(`/mestre/anotacoes/editor?${query.toString()}`, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    const syncLocalCollections = () => {
      const rawTrainers = getServerCollection<unknown[]>('trainers', []);
      const nextTrainers = normalizeTrainers();
      const nextItems = normalizeItems();
      trainersRef.current = nextTrainers;
      provisionalItemsRef.current = nextItems;
      setTrainersState(nextTrainers);
      setProvisionalItemsState(nextItems);
       const rawItems = getServerCollection<unknown[]>('provisionalItems', []);
       const patches: Record<string, unknown> = {};
       if (JSON.stringify(rawTrainers) !== JSON.stringify(nextTrainers)) patches.trainers = nextTrainers;
       if (JSON.stringify(rawItems) !== JSON.stringify(nextItems)) patches.provisionalItems = nextItems;
       if (Object.keys(patches).length) void syncGameState(patches);
    };
    window.addEventListener('pokemon-rpg-state-change', syncLocalCollections);
    syncLocalCollections();
    return () => window.removeEventListener('pokemon-rpg-state-change', syncLocalCollections);
  }, []);
  useEffect(() => {
    const syncSceneFocus = () => {
      const saved = getServerCollection<Partial<GMSceneFocus>>('gmSceneFocus', {});
      const next = { episodeId: saved.episodeId || '', sceneId: saved.sceneId || '' };
      setSceneFocusState(current => current.episodeId === next.episodeId && current.sceneId === next.sceneId
        ? current
        : next);
    };
    window.addEventListener('pokemon-rpg-state-change', syncSceneFocus);
    syncSceneFocus();
    return () => window.removeEventListener('pokemon-rpg-state-change', syncSceneFocus);
  }, []);
  useEffect(() => {
    if (!selectedCharacterId && characters[0]) setSelectedCharacterId(characters[0].id);
    if (selectedPokemonId && !pokemon.some(item => item.id === selectedPokemonId) && pokemon[0]) setSelectedPokemonId(pokemon[0].id);
    if (!selectedEpisodeId && episodes[0]) setSelectedEpisodeId(episodes[0].id);
    if (selectedEpisodeId && !episodes.some(item => item.id === selectedEpisodeId)) setSelectedEpisodeId(episodes[0]?.id || '');
    const currentEpisode = episodes.find(item => item.id === selectedEpisodeId) || episodes[0];
    if (currentEpisode && !currentEpisode.scenes.some(scene => scene.id === selectedSceneId)) setSelectedSceneId(currentEpisode.scenes[0]?.id || '');
  }, [characters, pokemon, selectedCharacterId, selectedPokemonId, episodes, selectedEpisodeId, selectedSceneId]);

  const addNote = () => {
    if (!draftTitle.trim()) return;
    saveNote({ title: draftTitle, body: draftBody, tag: 'registro', public: false });
    setDraftTitle('');
    setDraftBody('');
  };

  const createCharacter = () => {
    const newCharacter = addCharacter();
    setSelectedCharacterId(newCharacter.id);
    setExpandedCharacterId(newCharacter.id);
    setPanel('treinadores');
    toast.success('Nova ficha criada. Defina o nome, jogador e senha.');
  };

  const addProvisionalItem = () => {
    if (!itemDraft.name.trim()) return;
    const nextItem = { ...itemDraft, name: itemDraft.name.trim(), weight: Math.max(0, itemDraft.weight) };
    if (editingItemId) {
      setProvisionalItems(prev => prev.map(item => item.id === editingItemId ? { ...item, ...nextItem } : item));
      toast.success('Item provisório atualizado.');
    } else {
      setProvisionalItems(prev => [{ id: `item-${Date.now()}`, ...nextItem }, ...prev]);
      toast.success('Item provisório criado.');
    }
    setEditingItemId(null);
    setItemDraft({ name: '', category: 'Especiais', weight: 1, detail: '', image: '', holdable: true });
  };

  const deliverItem = () => {
    if (!pendingDelivery) return;
    const { item, character } = pendingDelivery;
     updateCharacter(character.id, { inventory: [...character.inventory, { name: item.name, category: item.category, weight: item.weight, detail: item.detail, image: item.image, holdable: item.holdable, equipped: false }] });
    setPendingDelivery(null);
    toast.success(`${item.name} enviado para ${character.name}.`);
  };

  const addReminder = () => {
    if (!reminderDraft.trim()) return;
    setBoard(prev => ({ ...prev, reminders: [{ id: `reminder-${Date.now()}`, text: reminderDraft.trim(), important: importantReminder }, ...prev.reminders] }));
    setReminderDraft('');
    setImportantReminder(false);
  };

  const addMusic = () => {
    if (!musicDraft.title.trim() || !musicDraft.url.trim()) return;
    setBoard(prev => ({ ...prev, music: [{ id: `music-${Date.now()}`, ...musicDraft }, ...prev.music] }));
    setMusicDraft({ title: '', url: '', category: 'Batalha', keywords: '' });
  };

  const copyMusic = async (url: string) => {
    const command = `m!p ${url.trim()}`;
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Comando copiado', { description: command });
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente:', { description: command });
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(createGameBackup(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pokemon_rpg_backup_${new Date().toISOString().split('T')[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Backup completo exportado.');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async loadEvent => {
      try {
        const imported = importGameState(JSON.parse(loadEvent.target?.result as string));
        if (imported.pokemon) setPokemon(imported.pokemon as ReturnType<typeof usePokemonData>['pokemon']);
        if (imported.attacks) setAttacks(imported.attacks as ReturnType<typeof useAttackData>['attacks']);
        await syncImportedGameState(imported);
        // Read the merged server snapshot after the import. Updating only the
        // React state here left the refs used by the autosave callbacks stale.
        const importedTrainers = normalizeTrainers();
        const importedItems = normalizeItems();
        trainersRef.current = importedTrainers;
        provisionalItemsRef.current = importedItems;
        setTrainersState(importedTrainers);
        setProvisionalItemsState(importedItems);
        toast.success('Backup completo importado e sincronizado.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao importar o arquivo JSON.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className={`rpg-shell min-h-[calc(100dvh-72px)] ${panel === 'anotacoes' ? 'p-2 md:p-3' : 'p-4 md:p-8'}`}>
      <div className={`mx-auto ${panel === 'anotacoes' ? 'max-w-none' : 'max-w-7xl'}`}>
        {panel !== 'anotacoes' && <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div><p className="eyebrow mb-2">Pokémon: Ascensão e Presságio · Mestre</p><h1 className="font-display text-4xl md:text-5xl">{panelLabels[panel]}</h1></div>
          <div className="flex gap-2"><Button onClick={createCharacter} variant="outline" data-testid="button-add-character"><Plus size={16} /> Nova ficha</Button><Link href="/publico" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-primary"><Eye size={16} /> Ver área pública</Link></div>
        </header>}

        <div className={`${panel === 'anotacoes' ? 'mb-2' : 'mb-6'} flex gap-2 overflow-x-auto border-b border-border pb-2`}>
          {[
             ['visao', 'Visão geral', UsersRound], ['pokemon', 'Pokémon', CircleDot],
            ['treinadores', 'Treinadores e fichas', UsersRound], ['itens', 'Itens provisórios', PackageOpen],
             ['episodios', 'Episódios', ScrollText], ['musica', 'Música', Headphones], ['anotacoes', 'Anotações', Map], ['configuracoes', 'Configurações', Settings],
          ].map(([value, label, Icon]) => <button key={value as string} onClick={() => setPanel(value as Panel)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold ${panel === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}><Icon size={15} />{label as string}</button>)}
        </div>

        {panel === 'pokemon' && <PokemonPanel pokemon={filteredPokemon} selectedPokemon={selectedPokemon} selectedPokemonId={selectedPokemonId} setSelectedPokemonId={setSelectedPokemonId} search={pokemonSearch} setSearch={setPokemonSearch} updatePokemon={updatePokemon} />}
        {panel === 'treinadores' && <NpcTrainersPanel characters={characters} trainers={trainers} setTrainers={setTrainers} pokemon={pokemon} updatePokemon={updatePokemon} focusedTrainerId={focusedTrainerId} updateCharacter={updateCharacter} deleteCharacter={deleteCharacter} />}
        {panel === 'itens' && <ItemsPanel characters={characters} items={provisionalItems} draft={itemDraft} setDraft={setItemDraft} addItem={addProvisionalItem} editingItemId={editingItemId} onEdit={item => { setEditingItemId(item.id); setItemDraft({ name: item.name, category: item.category, weight: item.weight, detail: item.detail, image: item.image || '', holdable: item.holdable }); }} onCancelEdit={() => { setEditingItemId(null); setItemDraft({ name: '', category: 'Especiais', weight: 1, detail: '', image: '', holdable: true }); }} onSend={setPendingDelivery} />}
        {panel === 'episodios' && <EpisodesPanel episodes={episodes} addEpisode={addEpisode} updateEpisode={updateEpisode} removeEpisode={removeEpisode} pokemon={pokemon} trainers={trainers} music={board.music} provisionalItems={provisionalItems} selectedEpisodeId={selectedEpisode?.id || ''} setSelectedEpisodeId={setSelectedEpisodeId} selectedSceneId={selectedScene?.id || ''} setSelectedSceneId={setSelectedSceneId} emptyScene={emptyScene} />}
        {panel === 'musica' && <MusicPanel tracks={board.music} draft={musicDraft} setDraft={setMusicDraft} addTrack={addMusic} copyTrack={copyMusic} removeTrack={id => setBoard(prev => ({ ...prev, music: prev.music.filter(track => track.id !== id) }))} search={musicSearch} setSearch={setMusicSearch} category={musicCategory} setCategory={setMusicCategory} />}
        {panel === 'anotacoes' && activeMindMap && <GMNotesWorkspace
          maps={board.mindMaps}
          activeMapId={activeMindMap.id}
          resources={planningResources}
          readOnly
          onSelectMap={selectMindMap}
          onCreateMap={createMindMap}
          onRenameMap={renameMindMap}
          onDeleteMap={deleteMindMap}
          onUpdateMap={updateMindMap}
          onOpenEditor={openMindMapEditor}
          onNavigateToSheet={setLocation}
        />}
        {panel === 'configuracoes' && <SettingsPanel pokemon={pokemon} onExport={handleExport} onImport={handleImport} summary={{ characters: characters.length, pokemon: pokemon.length, attacks: attacks.length, episodes: episodes.length, music: board.music.length, items: provisionalItems.length }} />}

        {panel === 'visao' && <Overview characters={characters} notes={notes} expandedCharacterId={expandedCharacterId} setExpandedCharacterId={setExpandedCharacterId} board={board} setBoard={setBoard} reminderDraft={reminderDraft} setReminderDraft={setReminderDraft} importantReminder={importantReminder} setImportantReminder={setImportantReminder} addReminder={addReminder} />}
        <ScenePicker episodes={episodes} selectedEpisodeId={selectedEpisode?.id || ''} setSelectedEpisodeId={setSelectedEpisodeId} selectedSceneId={selectedScene?.id || ''} setSelectedSceneId={setSelectedSceneId} scene={selectedScene} pokemon={pokemon} trainers={trainers} music={board.music} onOpenTrainer={id => { setFocusedTrainerId(id); setPanel('treinadores'); }} />
      </div>

      <Dialog open={!!pendingDelivery} onOpenChange={open => !open && setPendingDelivery(null)}>
        <DialogContent><DialogHeader><DialogTitle>Confirmar envio do item</DialogTitle><DialogDescription>O item será adicionado ao inventário da ficha escolhida.</DialogDescription></DialogHeader>{pendingDelivery && <div className="rounded-lg border border-border bg-secondary/30 p-4"><p className="font-semibold">{pendingDelivery.item.name}</p><p className="text-sm text-muted-foreground">{pendingDelivery.item.category} · peso {pendingDelivery.item.weight}</p><p className="mt-2 text-sm"><RichText text={pendingDelivery.item.detail || 'Sem descrição.'} replaceTypeNames /></p><p className="mt-3 text-sm">Destinatário: <strong>{pendingDelivery.character.name}</strong></p></div>}<DialogFooter><Button variant="ghost" onClick={() => setPendingDelivery(null)}>Cancelar</Button><Button onClick={deliverItem}>Enviar para a ficha</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsPanel({ pokemon, onExport, onImport, summary }: { pokemon: Pokemon[]; onExport: () => void; onImport: (event: React.ChangeEvent<HTMLInputElement>) => void; summary: { characters: number; pokemon: number; attacks: number; episodes: number; music: number; items: number } }) {
  const [editingFormulas, setEditingFormulas] = useState(() => new URLSearchParams(window.location.search).get('formulas') === '1');
  const { active } = useFormulaSettings();
  if (editingFormulas) return <FormulaEditor pokemon={pokemon} onClose={() => setEditingFormulas(false)} />;
  return <div className="space-y-5">
    <Card className="paper-panel">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><FunctionSquare size={20} /></span>
          <div><p className="font-semibold">Fórmulas e dados</p><p className="text-sm text-muted-foreground">Preset ativo: <strong>{active.name}</strong> · dados por {active.diceMode === 'iv' ? 'IV' : 'stat base'}</p></div>
        </div>
        <Button onClick={() => setEditingFormulas(true)} data-testid="button-edit-formulas"><FunctionSquare className="mr-2 h-4 w-4" /> Alterar fórmulas</Button>
      </CardContent>
    </Card>
    <Card className="paper-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Settings className="text-primary" /> Configurações da campanha</CardTitle>
        <p className="text-sm text-muted-foreground">Faça uma cópia única de tudo que pertence a esta mesa ou restaure uma cópia anterior.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Fichas', summary.characters],
            ['Pokémon', summary.pokemon],
            ['Movimentos', summary.attacks],
            ['Episódios', summary.episodes],
            ['Músicas', summary.music],
            ['Itens provisórios', summary.items],
          ].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-secondary/20 p-3"><p className="eyebrow">{label}</p><p className="font-display text-2xl">{value}</p></div>)}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-5">
            <FileJson className="mb-3 text-primary" />
            <h3 className="font-semibold">Exportar tudo</h3>
            <p className="mt-1 text-sm text-muted-foreground">Inclui fichas, Pokémon, movimentos, histórico de rolagens, notas, treinadores, itens, músicas e episódios.</p>
            <Button className="mt-4" onClick={onExport}><Download className="mr-2 h-4 w-4" /> Exportar backup completo</Button>
          </div>
          <div className="rounded-xl border border-border bg-secondary/20 p-5">
            <Upload className="mb-3 text-primary" />
            <h3 className="font-semibold">Importar tudo</h3>
            <p className="mt-1 text-sm text-muted-foreground">Use um backup completo JSON. Os dados presentes no arquivo substituirão os dados atuais da campanha.</p>
            <div className="relative mt-4 w-fit">
              <input type="file" accept=".json,application/json" onChange={onImport} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              <Button variant="outline" className="pointer-events-none"><Upload className="mr-2 h-4 w-4" /> Selecionar backup</Button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">A senha de cada ficha também faz parte do backup. Guarde o arquivo em local seguro.</p>
      </CardContent>
    </Card>
  </div>;
}

function PokemonPanel({ pokemon, selectedPokemon, selectedPokemonId, setSelectedPokemonId, search, setSearch, updatePokemon }: { pokemon: ReturnType<typeof usePokemonData>['pokemon']; selectedPokemon?: ReturnType<typeof usePokemonData>['pokemon'][number]; selectedPokemonId: string; setSelectedPokemonId: (id: string) => void; search: string; setSearch: (value: string) => void; updatePokemon: ReturnType<typeof usePokemonData>['updatePokemon'] }) {
  const [xpGain, setXpGain] = useState(1);
  const applyXp = () => {
    if (!selectedPokemon) return;
    let level = Math.max(1, Math.floor(selectedPokemon.level));
    let xp = Math.max(0, Math.floor(selectedPokemon.xp));
    let remaining = Math.max(0, Math.floor(Number(xpGain) || 0));
    const advanceLevels = () => {
      let cap = level * GROWTH_VALUES[selectedPokemon.growthRate || 'Meio rápido'];
      while (xp >= cap) {
        xp -= cap;
        level += 1;
        cap = level * GROWTH_VALUES[selectedPokemon.growthRate || 'Meio rápido'];
      }
    };
    advanceLevels();
    xp += remaining;
    advanceLevels();
    updatePokemon(selectedPokemon.id, { level, xp });
    setXpGain(1);
  };
  const requiredXp = selectedPokemon ? xpCap(selectedPokemon) : 0;
  const remainingXp = selectedPokemon ? Math.max(0, requiredXp - Math.max(0, Math.floor(selectedPokemon.xp))) : 0;
  return (
    <Card className="paper-panel mb-5">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><CircleDot className="text-primary" /> Pokédex dos jogadores</CardTitle>
          <p className="text-sm text-muted-foreground">Apenas Pokémon associados às fichas dos jogadores aparecem aqui.</p>
        </div>
        {selectedPokemon && <Link href={`/sheet?id=${selectedPokemon.id}`} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold hover:border-primary">Abrir ficha <ExternalLink size={15} /></Link>}
      </CardHeader>
      <CardContent>
        <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar Pokémon..." className="mb-4" />
        {pokemon.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum Pokémon está associado às fichas dos jogadores.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="grid max-h-96 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {pokemon.map(item => (
                <button key={item.id} onClick={() => setSelectedPokemonId(item.id)} className={`rounded-lg border p-3 text-left ${item.id === selectedPokemonId ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">{item.name || 'Sem nome'}</span>
                    <span className="shrink-0 font-mono text-base font-bold text-red-700 dark:text-red-300">PV {item.hp}/{item.hpMax}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">LV {item.level} · {item.trainerName || 'sem treinador'} · {item.types.join(' / ')}</p>
                </button>
              ))}
            </div>
            {selectedPokemon && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 lg:w-80">
                <p className="font-display text-2xl"><RichText text={selectedPokemon.name} /></p>
                <div className="mt-4 grid gap-3">
                  <label className="text-xs font-bold text-muted-foreground">
                    CRESCIMENTO
                    <select value={selectedPokemon.growthRate || 'Meio rápido'} onChange={event => updatePokemon(selectedPokemon.id, { growthRate: event.target.value as PokemonGrowthRate })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-normal">
                      {Object.keys(GROWTH_VALUES).map(rate => <option key={rate}>{rate}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-bold text-muted-foreground">NÍVEL<Input type="number" min={1} value={selectedPokemon.level} onChange={event => updatePokemon(selectedPokemon.id, { level: Math.max(1, Number(event.target.value) || 1) })} /></label>
                    <label className="text-xs font-bold text-muted-foreground">EXP ATUAL<Input type="number" readOnly value={selectedPokemon.xp} /></label>
                  </div>
                  <div className="rounded-lg border border-border bg-background/60 p-2 text-xs">
                    <p>Próximo nível: <b>{remainingXp} EXP restantes</b></p>
                    <p className="text-muted-foreground">EXP atual: {selectedPokemon.xp} / {requiredXp}</p>
                    <p className="text-muted-foreground">Crescimento: {GROWTH_VALUES[selectedPokemon.growthRate || 'Meio rápido']} por nível</p>
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" min={1} value={xpGain} onChange={event => setXpGain(Math.max(1, Number(event.target.value) || 1))} aria-label="EXP para adicionar" />
                    <Button onClick={applyXp}>Adicionar EXP</Button>
                  </div>
                  <label className="text-xs font-bold text-muted-foreground">AFEIÇÃO — {affectionLabel(selectedPokemon.affection)}<Input type="number" min={-6} max={31} value={selectedPokemon.affection} onChange={event => updatePokemon(selectedPokemon.id, { affection: Math.max(-6, Math.min(31, Number(event.target.value) || 0)) })} /></label>
                  <p className="text-xs text-muted-foreground">De -6 a 31: Péssima, Ruim, Neutro, Bom, Amigo e Inquebrável.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrainersPanel({ characters, trainers, trainerDraft, setTrainerDraft, editingTrainerId, setEditingTrainerId, setTrainers, selectedCharacterId, setSelectedCharacterId, expandedCharacterId, setExpandedCharacterId, updateCharacter, pokemon }: { characters: CharacterSheet[]; trainers: TrainerRecord[]; trainerDraft: { name: string; player: string; characterId: string; pokemonId: string }; setTrainerDraft: (value: { name: string; player: string; characterId: string; pokemonId: string }) => void; editingTrainerId: string | null; setEditingTrainerId: (id: string | null) => void; setTrainers: React.Dispatch<React.SetStateAction<TrainerRecord[]>>; selectedCharacterId: string; setSelectedCharacterId: (id: string) => void; expandedCharacterId: string | null; setExpandedCharacterId: (id: string | null) => void; updateCharacter: (id: string, patch: Partial<CharacterSheet>) => void; pokemon: ReturnType<typeof usePokemonData>['pokemon'] }) {
  const addTrainer = () => { if (!trainerDraft.name.trim()) return; setTrainers(prev => [...prev, { id: `trainer-${Date.now()}`, ...trainerDraft }]); setTrainerDraft({ name: '', player: '', characterId: '', pokemonId: '' }); };
  return <div className="space-y-5"><Card className="paper-panel"><CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="text-primary" /> Treinadores e associações</CardTitle><p className="text-sm text-muted-foreground">Cadastre associações simples ou edite diretamente as fichas dos jogadores.</p></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-4"><Input value={trainerDraft.name} onChange={event => setTrainerDraft({ ...trainerDraft, name: event.target.value })} placeholder="Nome do treinador" /><Input value={trainerDraft.player} onChange={event => setTrainerDraft({ ...trainerDraft, player: event.target.value })} placeholder="Jogador" /><select value={trainerDraft.characterId} onChange={event => setTrainerDraft({ ...trainerDraft, characterId: event.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="">Ficha relacionada</option>{characters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select><Button onClick={addTrainer}><Plus size={16} className="mr-2" /> Adicionar</Button></div><div className="mt-4 grid gap-2 md:grid-cols-2">{trainers.map(trainer => <div key={trainer.id} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{trainer.name}</p><p className="text-xs text-muted-foreground">{trainer.player || 'Jogador não definido'} · {characters.find(character => character.id === trainer.characterId)?.name || 'sem ficha'}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => setEditingTrainerId(editingTrainerId === trainer.id ? null : trainer.id)}><Edit3 size={15} /></Button><Button size="icon" variant="ghost" onClick={() => setTrainers(prev => prev.filter(item => item.id !== trainer.id))}><Trash2 size={15} /></Button></div></div>{editingTrainerId === trainer.id && <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2"><Input value={trainer.name} onChange={event => setTrainers(prev => prev.map(item => item.id === trainer.id ? { ...item, name: event.target.value } : item))} /><Input value={trainer.player} onChange={event => setTrainers(prev => prev.map(item => item.id === trainer.id ? { ...item, player: event.target.value } : item))} /><select value={trainer.characterId || ''} onChange={event => setTrainers(prev => prev.map(item => item.id === trainer.id ? { ...item, characterId: event.target.value } : item))} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="">Ficha relacionada</option>{characters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select></div>}</div>)}</div></CardContent></Card><Card className="paper-panel"><CardHeader><CardTitle>Fichas dos jogadores</CardTitle></CardHeader><CardContent className="space-y-3">{characters.map(character => <div key={character.id} className="rounded-lg border border-border"><button className="flex w-full items-center justify-between gap-3 p-3 text-left" onClick={() => { setSelectedCharacterId(character.id); setExpandedCharacterId(expandedCharacterId === character.id ? null : character.id); }}><div><p className="font-semibold">{character.name}</p><p className="text-xs text-muted-foreground">{character.player} · nível {character.level}</p></div><ChevronRight className={`transition-transform ${expandedCharacterId === character.id ? 'rotate-90' : ''}`} size={16} /></button>{expandedCharacterId === character.id && <CharacterAdminEditor character={character} selected={selectedCharacterId === character.id} updateCharacter={updateCharacter} pokemon={pokemon} />}</div>)}</CardContent></Card></div>;
}

function CharacterAdminEditor({ character, selected, updateCharacter, pokemon }: { character: CharacterSheet; selected: boolean; updateCharacter: (id: string, patch: Partial<CharacterSheet>) => void; pokemon: ReturnType<typeof usePokemonData>['pokemon'] }) {
  const [editingAttributes, setEditingAttributes] = useState(false);
  const patch = (data: Partial<CharacterSheet>) => updateCharacter(character.id, data);
  return <div className="grid gap-4 border-t border-border bg-secondary/15 p-4 md:grid-cols-[1fr_auto]"><div className="grid gap-2 sm:grid-cols-2"><Input value={character.name} onChange={event => patch({ name: event.target.value })} placeholder="Nome da ficha" /><Input value={character.player} onChange={event => patch({ player: event.target.value })} placeholder="Jogador" /><Input type="number" min={1} value={character.level} onChange={event => patch({ level: Math.max(1, Number(event.target.value) || 1) })} placeholder="Nível" /><Input value={character.accessCode} onChange={event => patch({ accessCode: event.target.value })} placeholder="Senha do jogador" /><Input type="number" min={0} value={character.money} onChange={event => patch({ money: Math.max(0, Number(event.target.value) || 0) })} placeholder="Dinheiro" /><Input value={character.className} onChange={event => patch({ className: event.target.value as CharacterSheet['className'] })} placeholder="Classe" /></div><div><Button size="sm" variant="outline" onClick={() => setEditingAttributes(value => !value)}><Edit3 size={14} className="mr-2" />Atributos</Button><div className="mt-2 grid grid-cols-3 gap-1">{attributeKeys.map(key => <label key={key} className="text-[10px] text-muted-foreground">{CHARACTER_ATTRIBUTE_LABELS[key]}<Input disabled={!editingAttributes} type="number" value={character.attributes[key]} onChange={event => patch({ attributes: { ...character.attributes, [key]: Number(event.target.value) || 0 } })} className="h-7 px-1 text-center" /></label>)}</div><div className="mt-3 text-xs text-muted-foreground">PV {character.hp}/{character.hpMax} · Esforço {character.focus}/{character.focusMax} · {pokemon.filter(item => character.partyPokemonIds.includes(item.id)).length} Pokémon na Party</div></div></div>;
}

function ImagePickerDialog({ open, onOpenChange, value, onChange, title }: { open: boolean; onOpenChange: (open: boolean) => void; value: string; onChange: (value: string) => void; title: string }) {
  const readFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = event => onChange(String(event.target?.result || ''));
    reader.readAsDataURL(file);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Cole uma imagem da área de transferência ou escolha um arquivo.</DialogDescription></DialogHeader>
      <div tabIndex={0} autoFocus onPaste={event => { const image = Array.from(event.clipboardData.items).find(item => item.type.startsWith('image/')); if (image) { event.preventDefault(); readFile(image.getAsFile() || undefined); } }} className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 text-center outline-none focus:ring-2 focus:ring-primary">
        {value ? <img src={value} alt="Prévia" className="mx-auto mb-4 max-h-48 max-w-full rounded-lg object-contain" /> : <ClipboardPaste className="mx-auto mb-3 h-10 w-10 text-primary" />}
        <p className="font-semibold">Cole sua imagem ou aperte aqui para escolher dos arquivos</p>
        <p className="mt-1 text-xs text-muted-foreground">Clique nesta área e use Ctrl+V para colar uma imagem.</p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-primary"><ImagePlus size={16} /> Escolher arquivo<input type="file" accept="image/*" className="hidden" onChange={event => readFile(event.target.files?.[0])} /></label>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => onOpenChange(false)} disabled={!value}>Usar imagem</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function ItemsPanel({ characters, items, draft, setDraft, addItem, editingItemId, onEdit, onCancelEdit, onSend }: { characters: CharacterSheet[]; items: ProvisionalItem[]; draft: { name: string; category: string; weight: number; detail: string; image: string; holdable: boolean }; setDraft: (value: { name: string; category: string; weight: number; detail: string; image: string; holdable: boolean }) => void; addItem: () => void; editingItemId: string | null; onEdit: (item: ProvisionalItem) => void; onCancelEdit: () => void; onSend: (value: { item: ProvisionalItem; character: CharacterSheet }) => void }) {
  const [recipient, setRecipient] = useState(characters[0]?.id || '');
  const [imageOpen, setImageOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const visibleItems = items.filter(item => {
    const normalized = search.trim().toLocaleLowerCase();
    const matchesSearch = !normalized || `${item.name} ${item.detail} ${item.category}`.toLocaleLowerCase().includes(normalized);
    return matchesSearch && (category === 'all' || item.category === category);
  });
  return <Card className="paper-panel">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><PackageOpen className="text-primary" /> Itens provisórios</CardTitle>
      <p className="text-sm text-muted-foreground">Pesquise, organize e edite o catálogo usado pela campanha. Itens marcados como seguráveis podem ser escolhidos na ficha de um Pokémon.</p>
    </CardHeader>
    <CardContent>
      <div className="grid gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 md:grid-cols-2">
        <Input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Nome do item" />
        <select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{itemCategories.map(itemCategory => <option key={itemCategory}>{itemCategory}</option>)}</select>
        <Input type="number" min={0} value={draft.weight} onChange={event => setDraft({ ...draft, weight: Math.max(0, Number(event.target.value) || 0) })} placeholder="Peso" />
        <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm"><input type="checkbox" checked={draft.holdable} onChange={event => setDraft({ ...draft, holdable: event.target.checked })} /> Pokémon pode segurar</label>
        <Textarea value={draft.detail} onChange={event => setDraft({ ...draft, detail: event.target.value })} placeholder="Efeito transformado em mecânica de RPG" className="md:col-span-2" />
        <Button type="button" variant="outline" onClick={() => setImageOpen(true)} className="md:col-span-2">{draft.image ? <img src={draft.image} alt="" className="mr-2 h-6 w-6 rounded object-cover" /> : <ImagePlus size={16} className="mr-2" />} {draft.image ? 'Trocar imagem' : 'Adicionar imagem'}</Button>
        <div className="flex gap-2 md:col-span-2">
          <Button onClick={addItem} className="flex-1">{editingItemId ? <><Check size={16} className="mr-2" /> Salvar alterações</> : <><Plus size={16} className="mr-2" /> Criar item provisório</>}</Button>
          {editingItemId && <Button type="button" variant="outline" onClick={onCancelEdit}>Cancelar</Button>}
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} /><Input value={search} onChange={event => setSearch(event.target.value)} className="pl-9" placeholder="Pesquisar nome, efeito ou categoria" /></div>
        <div className="relative md:w-56"><Filter className="absolute left-3 top-1/2 -translate-y-1/2" size={15} /><select value={category} onChange={event => setCategory(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"><option value="all">Todas as categorias</option>{itemCategories.map(itemCategory => <option key={itemCategory}>{itemCategory}</option>)}</select></div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm font-semibold">Enviar para</label>
        <select value={recipient} onChange={event => setRecipient(event.target.value)} className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm">{characters.map(character => <option key={character.id} value={character.id}>{character.name} · {character.player}</option>)}</select>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {visibleItems.map(item => <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
          {item.image ? <img src={item.image} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><PackageOpen size={20} /></div>}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{item.name}</p><Badge variant={item.holdable ? 'default' : 'outline'}>{item.holdable ? 'Segurável' : 'Não segurável'}</Badge></div>
            <p className="mt-1 text-xs text-muted-foreground">{item.category} · peso {item.weight}</p>
             <p className="mt-1 text-sm text-muted-foreground"><RichText text={item.detail || 'Sem descrição'} replaceTypeNames /></p>
          </div>
          <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
            <Button size="icon" variant="ghost" onClick={() => onEdit(item)} title="Editar item"><Edit3 size={15} /></Button>
            <Button size="sm" onClick={() => { const character = characters.find(entry => entry.id === recipient); if (character) onSend({ item, character }); }}>Enviar</Button>
          </div>
        </div>)}
      </div>
      {visibleItems.length === 0 && <p className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum item encontrado.</p>}
      <ImagePickerDialog open={imageOpen} onOpenChange={setImageOpen} value={draft.image} onChange={image => setDraft({ ...draft, image })} title="Adicionar imagem ao item" />
    </CardContent>
  </Card>;
}

function NotesPanel({ notes, selected, selectedNote, setSelectedNote, draftTitle, setDraftTitle, draftBody, setDraftBody, addNote, saveNote, removeNote }: { notes: ReturnType<typeof useCampaignNotes>['notes']; selected?: ReturnType<typeof useCampaignNotes>['notes'][number]; selectedNote: string | null; setSelectedNote: (id: string) => void; draftTitle: string; setDraftTitle: (value: string) => void; draftBody: string; setDraftBody: (value: string) => void; addNote: () => void; saveNote: ReturnType<typeof useCampaignNotes>['saveNote']; removeNote: (id: string) => void }) {
  return <Card className="paper-panel"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><ClipboardList className="text-primary" /> Caderno da campanha</CardTitle><Button size="sm" onClick={addNote}><Plus size={16} /> Nova nota</Button></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-[.8fr_1.2fr]"><div className="space-y-2">{notes.map(note => <button key={note.id} onClick={() => setSelectedNote(note.id)} className={`w-full rounded-lg border p-3 text-left ${selectedNote === note.id ? 'border-primary bg-primary/10' : 'border-border'}`}><div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{note.title}</span>{note.public ? <Eye size={14} /> : <LockKeyhole size={14} />}</div><span className="text-xs text-muted-foreground">{note.tag} · {note.updatedAt}</span></button>)}</div>{selected ? <div className="rounded-xl border border-border bg-secondary/20 p-4"><div className="mb-3 flex justify-between gap-3"><div><p className="eyebrow">{selected.tag}</p><h3 className="font-display text-2xl">{selected.title}</h3></div><Button variant="ghost" size="icon" onClick={() => removeNote(selected.id)}><Archive size={16} /></Button></div><Textarea value={selected.body} onChange={event => saveNote({ id: selected.id, body: event.target.value })} className="mb-4 min-h-36" /><div className="flex items-center justify-between rounded-lg border border-border bg-card p-3"><span className="text-sm">{selected.public ? 'Visível na área pública' : 'Somente mestre'}</span><Button size="sm" variant="outline" onClick={() => saveNote({ id: selected.id, public: !selected.public })}>{selected.public ? 'Tornar secreta' : 'Publicar nota'}</Button></div></div> : <p className="p-8 text-center text-sm text-muted-foreground">Selecione uma nota para editar.</p>}</div><div className="mt-5 grid gap-3 md:grid-cols-[.8fr_1.2fr_auto]"><Input value={draftTitle} onChange={event => setDraftTitle(event.target.value)} placeholder="Título da nova nota" /><Input value={draftBody} onChange={event => setDraftBody(event.target.value)} placeholder="Primeira linha ou pista" /><Button onClick={addNote}>Criar</Button></div></CardContent></Card>;
}

function MusicPanel({ tracks, draft, setDraft, addTrack, copyTrack, removeTrack, search, setSearch, category, setCategory }: { tracks: ReturnType<typeof useGMBoard>['board']['music']; draft: { title: string; url: string; category: MusicTrack['category']; keywords: string }; setDraft: (value: { title: string; url: string; category: MusicTrack['category']; keywords: string }) => void; addTrack: () => void; copyTrack: (url: string) => void; removeTrack: (id: string) => void; search: string; setSearch: (value: string) => void; category: 'all' | MusicTrack['category']; setCategory: (value: 'all' | MusicTrack['category']) => void }) {
  const visibleTracks = tracks.filter(track => {
    const normalized = search.toLowerCase();
    const matchesSearch = !normalized || `${track.title} ${track.keywords || ''} ${track.url}`.toLowerCase().includes(normalized);
    return matchesSearch && (category === 'all' || (track.category || 'Único') === category);
  });
  return <Card className="paper-panel"><CardHeader><CardTitle className="flex items-center gap-2"><Headphones className="text-primary" /> Música da mesa</CardTitle><p className="text-sm text-muted-foreground">Salve links, tipos e palavras-chave para encontrar rapidamente a trilha certa.</p></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2"><Input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="Título de identificação" /><Input value={draft.url} onChange={event => setDraft({ ...draft, url: event.target.value })} placeholder="https://..." /><select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as MusicTrack['category'] })} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option>Batalha</option><option>Suspense</option><option>Calmo</option><option>Único</option></select><Input value={draft.keywords} onChange={event => setDraft({ ...draft, keywords: event.target.value })} placeholder="Palavras-chave: floresta, chefe, noite" /><Button onClick={addTrack} className="md:col-span-2"><Plus size={16} className="mr-2" /> Adicionar música</Button></div><div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px]"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} /><Input value={search} onChange={event => setSearch(event.target.value)} className="pl-9" placeholder="Pesquisar títulos ou palavras-chave" /></div><div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2" size={15} /><select value={category} onChange={event => setCategory(event.target.value as 'all' | MusicTrack['category'])} className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"><option value="all">Todos os tipos</option><option>Batalha</option><option>Suspense</option><option>Calmo</option><option>Único</option></select></div></div><div className="mt-5 space-y-2">{visibleTracks.map(track => <div key={track.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"><div className="min-w-0"><div className="flex items-center gap-2"><button type="button" onClick={() => copyTrack(track.url)} className="truncate text-left font-semibold hover:text-primary" title="Copiar link da música">{track.title}</button><Badge variant="outline">{track.category || 'Único'}</Badge></div><p className="truncate text-xs text-muted-foreground">{track.keywords || 'Sem palavras-chave'} · {track.url}</p></div><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => copyTrack(track.url)}><Copy size={14} className="mr-2" /> Copiar link</Button><Button size="icon" variant="ghost" onClick={() => removeTrack(track.id)}><Trash2 size={15} /></Button></div></div>)}{visibleTracks.length === 0 && <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma música encontrada.</p>}</div></CardContent></Card>;
}

function Overview({ characters, notes, expandedCharacterId, setExpandedCharacterId, board, setBoard, reminderDraft, setReminderDraft, importantReminder, setImportantReminder, addReminder }: { characters: CharacterSheet[]; notes: ReturnType<typeof useCampaignNotes>['notes']; expandedCharacterId: string | null; setExpandedCharacterId: (id: string | null) => void; board: ReturnType<typeof useGMBoard>['board']; setBoard: ReturnType<typeof useGMBoard>['setBoard']; reminderDraft: string; setReminderDraft: (value: string) => void; importantReminder: boolean; setImportantReminder: (value: boolean) => void; addReminder: () => void }) {
  return <>
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { label: 'Personagens', value: characters.length, icon: <UsersRound /> },
        { label: 'Pokémon catalogados', value: characters.reduce((count, character) => count + character.partyPokemonIds.length + character.pcPokemonIds.length, 0), icon: <Shield /> },
        { label: 'Notas públicas', value: notes.filter(note => note.public).length, icon: <BookOpen /> },
        { label: 'Segredos', value: notes.filter(note => !note.public).length, icon: <LockKeyhole /> },
      ].map(item => <Card key={item.label} className="paper-panel"><CardContent className="p-4"><div className="mb-3 text-primary">{item.icon}</div><p className="eyebrow">{item.label}</p><strong className="font-display text-3xl">{item.value}</strong></CardContent></Card>)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <Card className="paper-panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><UsersRound className="text-primary" /> Na mesa agora</CardTitle>
          <Badge variant="outline">ao vivo</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {characters.map(character => <div key={character.id} className="rounded-lg border border-border bg-secondary/25">
            <div className="flex items-center justify-between gap-3 p-3">
              <Link href={`/personagem?id=${character.id}`} className="min-w-0 flex-1 rounded-sm text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <p className="font-semibold">{character.name}</p>
                <p className="text-xs text-muted-foreground">{character.player} · {character.className}</p>
              </Link>
              <div className="flex shrink-0 items-center gap-2 text-right">
                <p className="font-mono text-sm">{character.hp}/{character.hpMax} PV</p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`${expandedCharacterId === character.id ? 'Ocultar' : 'Mostrar'} resumo de ${character.name}`}
                  aria-expanded={expandedCharacterId === character.id}
                  onClick={() => setExpandedCharacterId(expandedCharacterId === character.id ? null : character.id)}
                >
                  <ChevronRight size={16} className={`transition-transform ${expandedCharacterId === character.id ? 'rotate-90' : ''}`} />
                </Button>
              </div>
            </div>
            {expandedCharacterId === character.id && <PlayerSnapshot character={character} />}
          </div>)}
        </CardContent>
      </Card>
      <div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle size={17} className="text-accent-foreground" /> Lembretes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">{board.reminders.map(reminder => <div key={reminder.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${reminder.important ? 'border-red-500 bg-red-500/10 text-red-800 dark:text-red-200' : 'border-border'}`}><span className="flex items-center gap-2">{reminder.important && <AlertTriangle size={15} />}{reminder.text}</span><Button size="icon" variant="ghost" onClick={() => setBoard(prev => ({ ...prev, reminders: prev.reminders.filter(item => item.id !== reminder.id) }))}><Trash2 size={14} /></Button></div>)}</div>
            <div className="mt-4 flex gap-2"><Input value={reminderDraft} onChange={event => setReminderDraft(event.target.value)} placeholder="Adicionar lembrete" /><label className="flex shrink-0 items-center gap-1 text-xs"><input type="checkbox" checked={importantReminder} onChange={event => setImportantReminder(event.target.checked)} /> urgente</label><Button size="icon" onClick={addReminder}><Plus size={15} /></Button></div>
          </CardContent>
        </Card>
      </div>
    </div>
  </>;
}

function PlayerSnapshot({ character }: { character: CharacterSheet }) {
  return <div className="grid gap-3 border-t border-border bg-card/60 p-4 text-sm sm:grid-cols-2"><div><p className="eyebrow mb-1">Atributos</p><div className="flex flex-wrap gap-2">{attributeKeys.map(key => <Badge key={key} variant="outline">{key.toUpperCase()} {character.attributes[key]}</Badge>)}</div></div><div><p className="eyebrow mb-1">Recursos</p><p className="font-mono">{character.hp}/{character.hpMax} PV · {character.focus}/{character.focusMax} PE · <Coins size={13} className="inline" /> {character.money}</p></div><div><p className="eyebrow mb-1">Perícias</p><p className="text-muted-foreground">{character.skills.filter(skill => skill.value > 0 || (skill.extraPoints ?? 0) > 0).map(skill => `${skill.name} ${skill.value}${(skill.extraPoints ?? 0) > 0 ? `+${skill.extraPoints}` : ''}`).join(' · ') || 'Nenhuma registrada'}</p></div><div><p className="eyebrow mb-1">Ficha rápida</p><p className="text-muted-foreground">Nível {character.level} · {character.partyPokemonIds.length} Pokémon na Party · {character.pcPokemonIds.length} no PC</p></div></div>;
}

function makeNpc(id: string, name: string): TrainerRecord {
  const attributes = { agi: 1, car: 1, for: 1, int: 1, vig: 1, von: 1 };
  const base = { id, name, player: '', kind: 'npc' as const, className: 'Treinador' as const, path: CHARACTER_CLASSES.Treinador[0], level: 1, attributes, skills: SKILL_NAMES.map(skill => ({ name: skill, value: 0, trained: false })), abilities: [], notes: '', pokemonIds: [] };
  const resources = calculateCharacterResources(base);
  return { ...base, hp: resources.hpMax, hpMax: resources.hpMax, focus: resources.focusMax, focusMax: resources.focusMax };
}

function NpcTrainersPanel({ characters, trainers, setTrainers, pokemon, updatePokemon, focusedTrainerId, updateCharacter, deleteCharacter }: { characters: CharacterSheet[]; trainers: TrainerRecord[]; setTrainers: React.Dispatch<React.SetStateAction<TrainerRecord[]>>; pokemon: ReturnType<typeof usePokemonData>['pokemon']; updatePokemon: ReturnType<typeof usePokemonData>['updatePokemon']; focusedTrainerId: string; updateCharacter: (id: string, patch: Partial<CharacterSheet>) => void; deleteCharacter: (id: string) => void }) {
  const [draftName, setDraftName] = useState('');
  const [selectedId, setSelectedId] = useState(focusedTrainerId || trainers[0]?.id || '');
  const [tab, setTab] = useState<'ficha' | 'anotacoes' | 'pokemon'>('ficha');
  const selected = trainers.find(item => item.id === selectedId);
  useEffect(() => { if (focusedTrainerId) setSelectedId(focusedTrainerId); }, [focusedTrainerId]);
  const patch = (data: Partial<TrainerRecord>) => {
    if (!selected) return;
    if (typeof data.name === 'string' && data.name.trim() && data.name.trim() !== selected.name.trim()) {
      const previousName = selected.name.trim().toLocaleLowerCase();
      const nextName = data.name.trim();
      // Keep the two sides of an NPC-Pokémon relation in sync when the NPC is
      // renamed. Pokémon that belong to another trainer are untouched.
      pokemon
        .filter(item => item.trainerName.trim().toLocaleLowerCase() === previousName)
        .forEach(item => updatePokemon(item.id, { trainerName: nextName }));
      data = { ...data, name: nextName };
    }
    setTrainers(prev => prev.map(item => {
      if (item.id !== selected.id) return item;
      const next = { ...item, ...data };
      if (next.className && next.level && next.attributes) {
        const resources = calculateCharacterResources(next as CharacterSheet);
        return { ...next, hpMax: resources.hpMax, focusMax: resources.focusMax, hp: Math.min(next.hp ?? resources.hpMax, resources.hpMax), focus: Math.min(next.focus ?? resources.focusMax, resources.focusMax) };
      }
      return next;
    }));
  };
  const addNpc = () => {
    if (!draftName.trim()) return;
    const npc = makeNpc(`trainer-${Date.now()}`, draftName.trim());
    setTrainers(prev => [npc, ...prev]);
    setSelectedId(npc.id);
    setDraftName('');
  };
  const togglePokemon = (id: string) => {
    if (!selected) return;
    const ids = selected.pokemonIds || [];
    patch({ pokemonIds: ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id] });
  };
  return <div className="space-y-5"><Card className="paper-panel"><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><UsersRound className="text-primary" /> NPCs e treinadores</CardTitle><p className="text-sm text-muted-foreground">Crie e organize quem aparece na campanha.</p></div><div className="flex gap-2"><Input value={draftName} onChange={event => setDraftName(event.target.value)} placeholder="Nome do NPC" /><Button onClick={addNpc}><Plus size={16} /> Criar</Button></div></CardHeader><CardContent><div className="grid gap-5 lg:grid-cols-[240px_1fr]"><div className="space-y-2">{trainers.map(trainer => <div key={trainer.id} className={`flex items-center gap-1 rounded-lg border ${trainer.id === selectedId ? 'border-primary bg-primary/10' : 'border-border'}`}><button onClick={() => { setSelectedId(trainer.id); setTab('ficha'); }} className="min-w-0 flex-1 p-3 text-left"><p className="truncate font-semibold">{trainer.name}</p><p className="text-xs text-muted-foreground">{trainer.kind === 'player' ? 'Ficha de jogador' : 'NPC'} · Nível {trainer.level || 1}</p></button><Button size="icon" variant="ghost" onClick={() => { setTrainers(prev => prev.filter(item => item.id !== trainer.id)); if (selectedId === trainer.id) setSelectedId(trainers.find(item => item.id !== trainer.id)?.id || ''); }}><Trash2 size={14} /></Button></div>)}{trainers.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum NPC criado.</p>}</div>{selected ? <div><div className="mb-4 flex gap-1 border-b border-border">{[['ficha', 'Ficha'], ['anotacoes', 'Anotações'], ['pokemon', 'Pokémon']].map(([value, label]) => <button key={value} onClick={() => setTab(value as typeof tab)} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>{label}</button>)}</div>{tab === 'ficha' && <NpcSheetEditor npc={selected} patch={patch} />}{tab === 'anotacoes' && <Textarea value={selected.notes || ''} onChange={event => patch({ notes: event.target.value })} className="min-h-64" placeholder="Informações importantes sobre este NPC..." />}{tab === 'pokemon' && <NpcPokemonEditor npc={selected} pokemon={pokemon} updatePokemon={updatePokemon} patch={patch} />}</div> : <p className="p-8 text-center text-sm text-muted-foreground">Selecione ou crie um NPC.</p>}</div></CardContent></Card><Card><CardHeader><CardTitle>Fichas de jogadores</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{characters.map(character => <div key={character.id} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><Link href={`/personagem?id=${character.id}`} className="min-w-0 hover:text-primary"><p className="font-semibold">{character.name}</p><p className="text-xs text-muted-foreground">{character.player} · nível {character.level}</p></Link><CharacterAccessControls character={character} updateCharacter={updateCharacter} deleteCharacter={deleteCharacter} /></div></div>)}</CardContent></Card></div>;
}

function NpcPokemonEditor({ npc, pokemon, updatePokemon, patch }: { npc: TrainerRecord; pokemon: ReturnType<typeof usePokemonData>['pokemon']; updatePokemon: ReturnType<typeof usePokemonData>['updatePokemon']; patch: (data: Partial<TrainerRecord>) => void }) {
  const [search, setSearch] = useState('');
  const { characters } = useCharacterSheets();
  const trainers = getServerCollection<TrainerRecord[]>('trainers', []);
  const normalizedName = normalizeTrainerName(npc.name);
  const target = { kind: 'trainer' as const, id: npc.id, name: npc.name };
  const linked = pokemon.filter(item => normalizeTrainerName(getPokemonTrainerName(item, characters, trainers)) === normalizedName);
  const linkedIds = new Set(linked.map(item => item.id));
  const available = pokemon.filter(item =>
    !linkedIds.has(item.id)
    && !getPokemonAssignmentConflict(item, target, characters, trainers)
    && `${item.name} ${item.species} ${item.trainerName}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const toggle = (item: ReturnType<typeof usePokemonData>['pokemon'][number], linkedNow: boolean) => {
    const ids = npc.pokemonIds || [];
    if (!linkedNow) {
      const conflict = getPokemonAssignmentConflict(item, target, characters, getServerCollection<TrainerRecord[]>('trainers', []));
      if (conflict) {
        toast.error(`${item.name} já está associado a ${conflict}. Remova-o da ficha atual antes de transferi-lo.`);
        return;
      }
    }
    patch({ pokemonIds: linkedNow ? ids.filter(id => id !== item.id) : [...ids.filter(id => id !== item.id), item.id] });
    updatePokemon(item.id, { trainerName: linkedNow ? '' : npc.name });
  };
  return <div className="space-y-5">
    <div><p className="mb-2 text-sm font-semibold">Pokémon associados a {npc.name}</p>{linked.length ? <div className="grid gap-3 sm:grid-cols-2">{linked.map(item => <div key={item.id} className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">{item.image ? <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-contain" /> : <CircleDot size={20} />}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{item.species || 'Espécie não registrada'}</p></div><Button size="sm" variant="ghost" onClick={() => toggle(item, true)}>Remover</Button></div>)}</div> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum Pokémon tem o nome deste NPC na ficha.</p>}</div>
    <div className="border-t border-border pt-4"><p className="mb-2 text-sm font-semibold">Adicionar Pokémon ao NPC</p><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar por nome, espécie ou treinador..." />{available.length ? <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{available.map(item => <button key={item.id} onClick={() => toggle(item, false)} className="flex items-center gap-3 rounded-lg border border-border p-2 text-left hover:border-primary"><CircleDot size={18} className="shrink-0 text-primary" /><span className="truncate text-sm">{item.name}</span><span className="ml-auto text-xs text-muted-foreground">Adicionar</span></button>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Nenhum Pokémon encontrado.</p>}</div>
  </div>;
}

function CharacterAccessControls({ character, updateCharacter, deleteCharacter }: { character: CharacterSheet; updateCharacter: (id: string, patch: Partial<CharacterSheet>) => void; deleteCharacter: (id: string) => void }) {
  const [password, setPassword] = useState('');
  const savePassword = () => {
    const nextPassword = password.trim();
    if (!nextPassword) {
      toast.error('Digite uma nova senha para a ficha.');
      return;
    }
    updateCharacter(character.id, { accessCode: nextPassword });
    setPassword('');
    toast.success(`Senha de ${character.name} alterada.`);
  };
  const removeSheet = () => {
    if (!confirm(`Excluir a ficha de ${character.name}? Essa ação não pode ser desfeita.`)) return;
    deleteCharacter(character.id);
    toast.success('Ficha excluída.');
  };
  return <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
    <div className="flex gap-1">
      <Input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Nova senha" className="h-8 w-28 text-xs" />
      <Button size="sm" variant="outline" onClick={savePassword}>Alterar senha</Button>
    </div>
    <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={removeSheet} title="Excluir ficha"><Trash2 size={15} /></Button>
  </div>;
}

function NpcSheetEditor({ npc, patch }: { npc: TrainerRecord; patch: (data: Partial<TrainerRecord>) => void }) {
  const className = npc.className || 'Treinador';
  const attributes = { agi: 1, car: 1, for: 1, int: 1, vig: 1, von: 1, ...(npc.attributes || {}) };
  const skills: NonNullable<TrainerRecord['skills']> = npc.skills || SKILL_NAMES.map(name => ({ name, value: 0, trained: false }));
  const abilities = npc.abilities || [];
  const setAttribute = (key: CharacterAttribute, value: number) => patch({ attributes: { ...attributes, [key]: Math.max(1, value || 1) } });
  const updateAbility = (index: number, data: Partial<TrainerRecord['abilities'] extends Array<infer Ability> | undefined ? Ability : never>) => {
    patch({ abilities: abilities.map((ability, abilityIndex) => abilityIndex === index ? { ...ability, ...data } : ability) });
  };
  const addAbility = () => patch({ abilities: [...abilities, { name: '', detail: '', uses: '' }] });

  return (
    <div className="max-h-[72vh] space-y-5 overflow-y-auto overscroll-contain pr-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input value={npc.name} onChange={event => patch({ name: event.target.value })} placeholder="Nome" />
        <select value={className} onChange={event => patch({ className: event.target.value as CharacterSheet['className'], path: CHARACTER_CLASSES[event.target.value as CharacterSheet['className']][0] })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{Object.keys(CHARACTER_CLASSES).map(item => <option key={item}>{item}</option>)}</select>
        <select value={npc.path || CHARACTER_CLASSES[className][0]} onChange={event => patch({ path: event.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{CHARACTER_CLASSES[className].map(item => <option key={item}>{item}</option>)}</select>
        <Input type="number" min={1} value={npc.level || 1} onChange={event => patch({ level: Math.max(1, Number(event.target.value) || 1) })} placeholder="Nível" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3"><p className="eyebrow">PV</p><p className="font-mono text-xl">{npc.hp || 0} / {npc.hpMax || 0}</p></div>
        <div className="rounded-lg border border-border p-3"><p className="eyebrow">PE</p><p className="font-mono text-xl">{npc.focus || 0} / {npc.focusMax || 0}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{attributeKeys.map(key => <label key={key} className="rounded-lg border border-primary/20 bg-secondary/20 p-2 text-center"><span className="font-mono text-xs font-bold text-primary">{key.toUpperCase()}</span><Input type="number" min={1} value={attributes[key]} onChange={event => setAttribute(key, Math.max(1, Number(event.target.value) || 1))} className="mt-1 h-8 px-1 text-center" /></label>)}</div>
      <div>
        <p className="eyebrow mb-2">Perícias</p>
        <p className="mb-2 text-xs text-muted-foreground">Pontos extras são separados: normal+extra.</p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {skills.map((skill, index) => (
            <div key={skill.name} className="flex items-center justify-between gap-1 rounded-md border border-border px-2 py-1.5 text-xs">
              <span className="min-w-0 truncate">{skill.name}</span>
              <Input
                type="number"
                min={0}
                max={getSkillCap(npc.level || 1)}
                step={1}
                value={skill.value}
                aria-label={`Pontos normais de ${skill.name}`}
                onChange={event => patch({ skills: skills.map((item, itemIndex) => itemIndex === index
                  ? { ...item, value: Math.max(0, Math.min(getSkillCap(npc.level || 1), Math.floor(Number(event.target.value) || 0))) }
                  : item) })}
                className="h-7 w-10 shrink-0 px-1 text-center"
              />
              <span className="text-muted-foreground" aria-hidden="true">+</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={skill.extraPoints ?? 0}
                aria-label={`Pontos extras de ${skill.name}`}
                onChange={event => patch({ skills: skills.map((item, itemIndex) => itemIndex === index
                  ? { ...item, extraPoints: Math.max(0, Math.floor(Number(event.target.value) || 0)) }
                  : item) })}
                className="h-7 w-10 shrink-0 px-1 text-center"
              />
            </div>
          ))}
        </div>
      </div>
      <section className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Habilidades</p>
          <Button size="sm" variant="outline" onClick={addAbility}><Plus size={14} className="mr-2" /> Nova habilidade</Button>
        </div>
        {abilities.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma habilidade cadastrada.</p>}
        {abilities.map((ability, index) => (
          <div key={`${ability.name}-${index}`} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(130px,.8fr)_minmax(160px,1.4fr)_minmax(110px,.7fr)_auto]">
            <Input value={ability.name} onChange={event => updateAbility(index, { name: event.target.value })} placeholder="Nome da habilidade" aria-label={`Nome da habilidade ${index + 1}`} />
            <div><Textarea value={ability.detail} onChange={event => updateAbility(index, { detail: event.target.value })} placeholder="Descrição" rows={2} className="min-h-10 resize-y" aria-label={`Descrição da habilidade ${index + 1}`} />{ability.detail && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground"><RichText text={ability.detail} /></p>}</div>
            <Input value={ability.uses || ''} onChange={event => updateAbility(index, { uses: event.target.value })} placeholder="Usos ou custo" aria-label={`Usos da habilidade ${index + 1}`} />
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => patch({ abilities: abilities.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Excluir habilidade ${index + 1}`}><Trash2 size={15} /></Button>
          </div>
        ))}
      </section>
    </div>
  );
}

function EpisodesPanel({ episodes, addEpisode, updateEpisode, removeEpisode, pokemon, trainers, music, provisionalItems, selectedEpisodeId, setSelectedEpisodeId, selectedSceneId, setSelectedSceneId, emptyScene }: { episodes: CampaignEpisode[]; addEpisode: () => CampaignEpisode; updateEpisode: (id: string, patch: Partial<CampaignEpisode>) => void; removeEpisode: (id: string) => void; pokemon: ReturnType<typeof usePokemonData>['pokemon']; trainers: TrainerRecord[]; music: MusicTrack[]; provisionalItems: ProvisionalItem[]; selectedEpisodeId: string; setSelectedEpisodeId: (id: string) => void; selectedSceneId: string; setSelectedSceneId: (id: string) => void; emptyScene: (id?: string) => CampaignScene }) {
  const episode = episodes.find(item => item.id === selectedEpisodeId) || episodes[0];
  const scene = episode?.scenes.find(item => item.id === selectedSceneId) || episode?.scenes[0];
  const updateScene = (patch: Partial<CampaignScene>) => {
    if (!episode || !scene) return;
    updateEpisode(episode.id, { scenes: episode.scenes.map(item => item.id === scene.id ? { ...item, ...patch } : item) });
  };
  const createEpisode = () => {
    const next = addEpisode();
    setSelectedEpisodeId(next.id);
  };
  const createScene = () => {
    if (!episode) return;
    const next = emptyScene();
    updateEpisode(episode.id, { scenes: [...episode.scenes, next] });
    setSelectedSceneId(next.id);
  };
  return <Card className="paper-panel"><CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><ScrollText className="text-primary" /> Episódios da campanha</CardTitle><p className="text-sm text-muted-foreground">Organize episódios, cenas e tudo que pode aparecer durante a sessão.</p></div><Button onClick={createEpisode}><Plus size={16} /> Novo episódio</Button></CardHeader><CardContent><div className="grid gap-5 lg:grid-cols-[220px_1fr]"><div className="space-y-2">{episodes.map(item => <div key={item.id} className={`flex items-center rounded-lg border ${item.id === episode?.id ? 'border-primary bg-primary/10' : 'border-border'}`}><button onClick={() => setSelectedEpisodeId(item.id)} className="min-w-0 flex-1 p-3 text-left"><p className="truncate font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.scenes.length} cenas</p></button><Button size="icon" variant="ghost" onClick={() => { removeEpisode(item.id); if (item.id === episode?.id) setSelectedEpisodeId(episodes.find(other => other.id !== item.id)?.id || ''); }}><Trash2 size={14} /></Button></div>)}{episodes.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Crie o primeiro episódio.</p>}</div>{episode && scene ? <div><div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]"><div><Input value={episode.title} onChange={event => updateEpisode(episode.id, { title: event.target.value })} placeholder="Título do episódio" /><Textarea value={episode.description} onChange={event => updateEpisode(episode.id, { description: event.target.value })} className="mt-2" placeholder="Resumo do episódio" /></div><div className="flex items-start gap-2"><select value={scene.id} onChange={event => setSelectedSceneId(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{episode.scenes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><Button variant="outline" onClick={createScene}><Plus size={15} /> Cena</Button></div></div><SceneEditor scene={scene} updateScene={updateScene} pokemon={pokemon} trainers={trainers} music={music} provisionalItems={provisionalItems} /></div> : <p className="p-8 text-center text-sm text-muted-foreground">Selecione um episódio para editar.</p>}</div></CardContent></Card>;
}

function SceneEditor({ scene, updateScene, pokemon, trainers, music, provisionalItems }: { scene: CampaignScene; updateScene: (patch: Partial<CampaignScene>) => void; pokemon: ReturnType<typeof usePokemonData>['pokemon']; trainers: TrainerRecord[]; music: MusicTrack[]; provisionalItems: ProvisionalItem[] }) {
  const [provisionalId, setProvisionalId] = useState(provisionalItems[0]?.id || '');
  const [provisionalPrice, setProvisionalPrice] = useState('0');
  const [marketDraft, setMarketDraft] = useState({ name: '', price: '0', description: '' });
  const [testDraft, setTestDraft] = useState<{ skill: string; description: string }>({ skill: SKILL_NAMES[0], description: '' });
  const [pointDraft, setPointDraft] = useState('');
  const [sceneSearch, setSceneSearch] = useState('');
  const toggle = (field: 'pokemonIds' | 'trainerIds' | 'musicIds', id: string) => {
    const ids = scene[field] || [];
    updateScene({ [field]: ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id] });
  };
  const matchesSceneSearch = (value: string) => !sceneSearch.trim() || value.toLocaleLowerCase().includes(sceneSearch.toLocaleLowerCase());
  const addProvisional = () => {
    const item = provisionalItems.find(entry => entry.id === provisionalId);
    if (!item) return;
    const market: SceneMarketItem = { id: `market-${Date.now()}`, name: item.name, price: Number(provisionalPrice) || 0, provisionalItemId: item.id, description: item.detail };
    updateScene({ provisionalMarket: [...scene.provisionalMarket, market] });
  };
  const addMarket = () => {
    if (!marketDraft.name.trim()) return;
    updateScene({ customMarket: [...scene.customMarket, { id: `market-${Date.now()}`, name: marketDraft.name.trim(), price: Number(marketDraft.price) || 0, description: marketDraft.description }] });
    setMarketDraft({ name: '', price: '0', description: '' });
  };
  const addTest = () => {
    if (!testDraft.description.trim()) return;
    const test: SceneTest = { id: `test-${Date.now()}`, skill: testDraft.skill, description: testDraft.description, difficulties: [''] };
    updateScene({ tests: [...scene.tests, test] });
    setTestDraft({ ...testDraft, description: '' });
  };
  const selectedPokemonIds = scene.pokemonIds || [];
  const selectedTrainerIds = scene.trainerIds || [];
  const selectedMusicIds = scene.musicIds || [];
  const visiblePokemon = pokemon.filter(item => matchesSceneSearch(`${item.name} ${item.species} ${item.trainerName}`));
  const visibleTrainers = trainers.filter(item => matchesSceneSearch(`${item.name} ${item.player} ${item.className || ''} ${item.path || ''}`));
  const visibleMusic = music.filter(item => matchesSceneSearch(`${item.title} ${item.keywords} ${item.url}`));
  return <div className="space-y-5">
    <div><p className="eyebrow mb-2">Cena selecionada</p><Input value={scene.title} onChange={event => updateScene({ title: event.target.value })} className="text-lg font-semibold" /><Textarea value={scene.description} onChange={event => updateScene({ description: event.target.value })} className="mt-2 min-h-24" placeholder="Descrição da cena" /></div>
    <Card><CardHeader><CardTitle className="text-base">Adicionar à cena</CardTitle><p className="text-sm text-muted-foreground">Pesquise por Pokémon, treinador ou música e clique no resultado para anexar ou remover.</p></CardHeader><CardContent><div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><Input value={sceneSearch} onChange={event => setSceneSearch(event.target.value)} className="pl-9" placeholder="Pesquisar na cena..." /></div><div className="grid gap-4 lg:grid-cols-3"><div><p className="mb-2 text-sm font-semibold">Pokémon</p><div className="max-h-52 space-y-2 overflow-y-auto">{visiblePokemon.map(item => <button key={item.id} onClick={() => toggle('pokemonIds', item.id)} className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left ${selectedPokemonIds.includes(item.id) ? 'border-primary bg-primary/10' : 'border-border'}`}><CircleDot size={18} className="shrink-0 text-primary" /><span className="truncate text-sm">{item.name}</span><span className="ml-auto text-xs text-muted-foreground">{selectedPokemonIds.includes(item.id) ? 'Anexado' : 'Adicionar'}</span></button>)}</div></div><div><p className="mb-2 text-sm font-semibold">Treinadores</p><div className="max-h-52 space-y-2 overflow-y-auto">{visibleTrainers.map(item => <button key={item.id} onClick={() => toggle('trainerIds', item.id)} className={`flex w-full items-center justify-between rounded-lg border p-2 text-left ${selectedTrainerIds.includes(item.id) ? 'border-primary bg-primary/10' : 'border-border'}`}><span className="truncate text-sm font-semibold">{item.name}</span><span className="text-xs text-muted-foreground">{selectedTrainerIds.includes(item.id) ? 'Anexado' : 'Adicionar'}</span></button>)}</div>{!trainers.length && <p className="text-sm text-muted-foreground">Nenhum treinador cadastrado.</p>}</div><div><p className="mb-2 text-sm font-semibold">Música</p><div className="max-h-52 space-y-2 overflow-y-auto">{visibleMusic.map(item => <button key={item.id} onClick={() => toggle('musicIds', item.id)} className={`flex w-full items-center justify-between rounded-lg border p-2 text-left ${selectedMusicIds.includes(item.id) ? 'border-primary bg-primary/10' : 'border-border'}`}><span className="truncate text-sm font-semibold">{item.title}</span><span className="text-xs text-muted-foreground">{selectedMusicIds.includes(item.id) ? 'Anexada' : 'Adicionar'}</span></button>)}</div>{!music.length && <p className="text-sm text-muted-foreground">Adicione músicas na aba Música.</p>}</div></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Mini mercado</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]"><select value={provisionalId} onChange={event => setProvisionalId(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{provisionalItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Input type="number" value={provisionalPrice} onChange={event => setProvisionalPrice(event.target.value)} placeholder="Preço" /><Button onClick={addProvisional}>Adicionar provisório</Button></div><div className="grid gap-2 sm:grid-cols-[1fr_120px_1.5fr_auto]"><Input value={marketDraft.name} onChange={event => setMarketDraft({ ...marketDraft, name: event.target.value })} placeholder="Item de consumo" /><Input type="number" value={marketDraft.price} onChange={event => setMarketDraft({ ...marketDraft, price: event.target.value })} placeholder="Preço" /><Input value={marketDraft.description} onChange={event => setMarketDraft({ ...marketDraft, description: event.target.value })} placeholder="Descrição" /><Button onClick={addMarket}>Adicionar</Button></div><div className="grid gap-2 sm:grid-cols-2">{[...scene.provisionalMarket, ...scene.customMarket].map(item => <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-3"><div><p className="font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{item.description || 'Sem descrição'}</p></div><div className="flex items-center gap-2"><span className="font-mono text-primary">{item.price}</span><Button size="icon" variant="ghost" onClick={() => updateScene({ provisionalMarket: scene.provisionalMarket.filter(entry => entry.id !== item.id), customMarket: scene.customMarket.filter(entry => entry.id !== item.id) })}><Trash2 size={14} /></Button></div></div>)}</div></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Anotações de testes</CardTitle></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]"><select value={testDraft.skill} onChange={event => setTestDraft({ ...testDraft, skill: event.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{SKILL_NAMES.map(skill => <option key={skill}>{skill}</option>)}</select><Input value={testDraft.description} onChange={event => setTestDraft({ ...testDraft, description: event.target.value })} placeholder="Ex.: DT - Descrição do sucesso" /><Button onClick={addTest}><Plus size={15} /> DT</Button></div><div className="mt-3 space-y-3">{scene.tests.map(test => <div key={test.id} className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{test.skill} · {test.description}</p><Button size="icon" variant="ghost" onClick={() => updateScene({ tests: scene.tests.filter(item => item.id !== test.id) })}><Trash2 size={14} /></Button></div><div className="mt-2 flex flex-wrap gap-2">{test.difficulties.map((difficulty, index) => <Input key={`${test.id}-${index}`} value={difficulty} onChange={event => updateScene({ tests: scene.tests.map(item => item.id === test.id ? { ...item, difficulties: item.difficulties.map((value, valueIndex) => valueIndex === index ? event.target.value : value) } : item) })} placeholder={`DT ${index + 1} - descrição do sucesso`} className="h-8 min-w-[260px] flex-1 sm:w-72 sm:flex-none" />)}<Button size="sm" variant="outline" onClick={() => updateScene({ tests: scene.tests.map(item => item.id === test.id ? { ...item, difficulties: [...item.difficulties, ''] } : item) })}><Plus size={14} /> DT</Button></div></div>)}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Pontos de interesse</CardTitle></CardHeader><CardContent><div className="flex gap-2"><Input value={pointDraft} onChange={event => setPointDraft(event.target.value)} placeholder="Novo ponto de interesse" /><Button onClick={() => { if (pointDraft.trim()) { updateScene({ pointsOfInterest: [...scene.pointsOfInterest, pointDraft.trim()] }); setPointDraft(''); } }}><Plus size={15} /></Button></div><div className="mt-3 flex flex-wrap gap-2">{scene.pointsOfInterest.map((point, index) => <Badge key={`${point}-${index}`} variant="outline">{point}<button className="ml-2 text-muted-foreground hover:text-destructive" onClick={() => updateScene({ pointsOfInterest: scene.pointsOfInterest.filter((_, itemIndex) => itemIndex !== index) })}>×</button></Badge>)}</div></CardContent></Card>
  </div>;
}

function ScenePicker({ episodes, selectedEpisodeId, setSelectedEpisodeId, selectedSceneId, setSelectedSceneId, scene, pokemon, trainers, music, onOpenTrainer }: { episodes: CampaignEpisode[]; selectedEpisodeId: string; setSelectedEpisodeId: (id: string) => void; selectedSceneId: string; setSelectedSceneId: (id: string) => void; scene?: CampaignScene; pokemon: ReturnType<typeof usePokemonData>['pokemon']; trainers: TrainerRecord[]; music: MusicTrack[]; onOpenTrainer: (id: string) => void }) {
  const episode = episodes.find(item => item.id === selectedEpisodeId);
  const scenePokemon = pokemon.filter(item => scene?.pokemonIds?.includes(item.id));
  const sceneTrainers = trainers.filter(item => scene?.trainerIds?.includes(item.id));
  const sceneMusic = music.filter(item => scene?.musicIds?.includes(item.id));
  const copySceneMusic = async (url: string) => {
    const command = `m!p ${url.trim()}`;
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Comando copiado', { description: command });
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente:', { description: command });
    }
  };
  return <Card className="paper-panel mt-6 border-primary/25"><CardHeader><CardTitle className="flex items-center gap-2"><Flag className="text-primary" /> Cena em foco</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2"><select value={selectedEpisodeId} onChange={event => { setSelectedEpisodeId(event.target.value); const next = episodes.find(item => item.id === event.target.value); setSelectedSceneId(next?.scenes[0]?.id || ''); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione um episódio</option>{episodes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><select value={selectedSceneId} onChange={event => setSelectedSceneId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" disabled={!episode}><option value="">Selecione uma cena</option>{episode?.scenes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>{scene ? <div className="mt-5 space-y-4"><div><p className="eyebrow">{episode?.title}</p><h3 className="font-display text-3xl">{scene.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{scene.description || 'Sem descrição.'}</p></div><div className="grid gap-4 md:grid-cols-3">{scenePokemon.length > 0 && <div><p className="eyebrow mb-2">Pokémon</p><div className="flex flex-wrap gap-2">{scenePokemon.map(item => <Link key={item.id} href={`/sheet?id=${item.id}`} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2 py-1.5 text-sm hover:border-primary">{item.image && <img src={item.image} alt="" className="h-7 w-7 rounded object-contain" />}{item.name}</Link>)}</div></div>}{sceneTrainers.length > 0 && <div><p className="eyebrow mb-2">NPCs e treinadores</p><div className="flex flex-wrap gap-2">{sceneTrainers.map(item => <button key={item.id} onClick={() => onOpenTrainer(item.id)} className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm hover:border-primary">{item.name}</button>)}</div></div>}{sceneMusic.length > 0 && <div><p className="eyebrow mb-2">Música</p><div className="flex flex-wrap gap-2">{sceneMusic.map(item => <button key={item.id} onClick={() => copySceneMusic(item.url)} title={`Copiar m!p ${item.url}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-sm transition-colors hover:border-primary active:scale-[.98]" data-testid={`button-copy-scene-music-${item.id}`}><Copy size={13} className="text-primary" />{item.title}</button>)}</div></div>}</div>{(scene.provisionalMarket.length + scene.customMarket.length) > 0 && <div><p className="eyebrow mb-2">Mini mercado</p><div className="grid gap-2 sm:grid-cols-2">{[...scene.provisionalMarket, ...scene.customMarket].map(item => <div key={item.id} className="flex justify-between rounded-lg border border-border p-3 text-sm"><span>{item.name}</span><span className="font-mono text-primary">{item.price}</span></div>)}</div></div>}{scene.tests.length > 0 && <div><p className="eyebrow mb-2">Testes</p><div className="space-y-2">{scene.tests.map(test => <div key={test.id} className="rounded-lg border border-border p-3 text-sm"><strong>{test.skill}</strong> · {test.description}<div className="mt-2 flex flex-wrap gap-2">{test.difficulties.filter(Boolean).map((difficulty, index) => <Badge key={index} variant="outline">DT {difficulty}</Badge>)}</div></div>)}</div></div>}{scene.pointsOfInterest.length > 0 && <div><p className="eyebrow mb-2">Pontos de interesse</p><div className="flex flex-wrap gap-2">{scene.pointsOfInterest.map((point, index) => <Badge key={`${point}-${index}`} variant="outline">{point}</Badge>)}</div></div>}</div> : <p className="mt-5 text-sm text-muted-foreground">Crie um episódio para escolher uma cena.</p>}</CardContent></Card>;
}