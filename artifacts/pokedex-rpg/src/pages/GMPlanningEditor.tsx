import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Map, Save } from 'lucide-react';
import GMNotesWorkspace from '../components/GMNotesWorkspace';
import { useCampaignStory, useCharacterSheets, useGMBoard, createGMPlanningMap } from '../lib/campaign';
import { usePokemonData } from '../lib/hooks';
import {
  buildGMPlanningResources,
  normalizeGMProvisionalItems,
  normalizeGMTrainers,
} from '../lib/gmPlanning';
import type { GMPlanningMap } from '../lib/campaign';

export default function GMPlanningEditor() {
  const { board, setBoard } = useGMBoard();
  const { characters } = useCharacterSheets();
  const { pokemon } = usePokemonData();
  const { episodes } = useCampaignStory();
  const [selectedMapId, setSelectedMapId] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('map');
    return requested || '';
  });
  const trainers = normalizeGMTrainers();
  const items = normalizeGMProvisionalItems();
  const resources = useMemo(() => buildGMPlanningResources({
    pokemon,
    trainers,
    music: board.music,
    items,
    episodes,
    characters,
  }), [pokemon, trainers, board.music, items, episodes, characters]);
  const activeMapId = board.mindMaps.some(map => map.id === selectedMapId)
    ? selectedMapId
    : board.mindMaps.some(map => map.id === board.activeMindMapId)
      ? board.activeMindMapId
      : board.mindMaps[0]?.id || '';

  const selectMap = (id: string) => {
    setSelectedMapId(id);
    setBoard(current => ({ ...current, activeMindMapId: id }));
    const url = new URL(window.location.href);
    url.searchParams.set('map', id);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const updateMap = (updatedMap: GMPlanningMap) => setBoard(current => ({
    ...current,
    mindMaps: current.mindMaps.map(map => map.id === updatedMap.id
      ? { ...updatedMap, updatedAt: new Date().toISOString() }
      : map),
  }));

  const createMap = () => {
    const map = createGMPlanningMap(`Mapa ${board.mindMaps.length + 1}`);
    setBoard(current => ({
      ...current,
      mindMaps: [...current.mindMaps, map],
      activeMindMapId: map.id,
    }));
    setSelectedMapId(map.id);
  };

  const renameMap = (id: string, title: string) => setBoard(current => ({
    ...current,
    mindMaps: current.mindMaps.map(map => map.id === id
      ? { ...map, title, updatedAt: new Date().toISOString() }
      : map),
  }));

  const deleteMap = (id: string) => {
    const mindMaps = board.mindMaps.filter(map => map.id !== id);
    if (mindMaps.length === board.mindMaps.length || mindMaps.length === 0) return;
    const nextId = board.activeMindMapId === id ? mindMaps[0].id : board.activeMindMapId;
    setBoard({ ...board, mindMaps, activeMindMapId: nextId });
    setSelectedMapId(nextId);
  };

  const navigateToPokemonSheet = (sheetUrl: string) => {
    const pokemonId = new URL(sheetUrl, window.location.origin).searchParams.get('id');
    const targetId = new URLSearchParams(window.location.search).get('returnTab');
    if (!pokemonId || !targetId || typeof BroadcastChannel === 'undefined') {
      window.location.assign(sheetUrl);
      return;
    }

    const channel = new BroadcastChannel('pokemon-rpg-planning-navigation');
    channel.postMessage({ type: 'open-pokemon-sheet', targetId, pokemonId });
    window.setTimeout(() => channel.close(), 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-[#f4f0e7] p-2 text-[#23333a] sm:p-3" data-testid="planning-editor-page">
      <header className="mb-2 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-[#ded8cd] bg-[#f8f5ee] px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#243b3e] text-[#f4d982]"><Map size={18} /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold sm:text-base">Editor de planejamento</p>
            <p className="hidden text-xs text-[#78817c] sm:block">Edições sincronizadas com a campanha</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-[#d8d2c5] bg-[#efebe2] px-3 py-2 text-xs font-semibold text-[#66736e] md:flex"><Save size={13} /> Salvamento automático</span>
          <Link href="/mestre?panel=anotacoes" className="inline-flex items-center gap-2 rounded-lg border border-[#d8d2c5] bg-[#fbf9f3] px-3 py-2 text-xs font-bold text-[#52615c] hover:bg-white sm:text-sm"><ArrowLeft size={15} /> Voltar à visualização</Link>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <GMNotesWorkspace
          maps={board.mindMaps}
          activeMapId={activeMapId}
          resources={resources}
          readOnly={false}
          onSelectMap={selectMap}
          onCreateMap={createMap}
          onRenameMap={renameMap}
          onDeleteMap={deleteMap}
          onUpdateMap={updateMap}
          onOpenEditor={() => undefined}
          onNavigateToSheet={navigateToPokemonSheet}
        />
      </div>
    </div>
  );
}
