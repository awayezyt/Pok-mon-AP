import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent as ReactClipboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowDownRight, ArrowUpRight, BookOpen, Check, ChevronDown, Circle, CircleDot, Copy,
  Diamond, Eye, FileText, Frame, ImagePlus, Link2, MapPin, Maximize2, Music2,
  Package, Plus, Search, Shapes, Store, Trash2, UsersRound, X, ZoomIn, ZoomOut,
  Bold, Italic, Underline, HelpCircle, ExternalLink, Magnet,
} from 'lucide-react';
import type { GMPlanningMap, GMPlanningNode, GMPlanningNodeKind } from '../lib/campaign';
import { sanitizePlanningHtml, snapPlanningNodePosition, textAsPlanningHtml } from '../lib/gmPlanningCanvas';
import { ImageUrlField } from './ImageUrlField';

type Resource = {
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
type Props = {
  maps: GMPlanningMap[];
  activeMapId: string;
  resources: Resource[];
  readOnly: boolean;
  onSelectMap: (id: string) => void;
  onCreateMap: () => void;
  onRenameMap: (id: string, title: string) => void;
  onDeleteMap: (id: string) => void;
  onUpdateMap: (map: GMPlanningMap) => void;
  onOpenEditor: (mapId: string) => void;
  onNavigateToSheet?: (sheetUrl: string) => void;
};
const kindLabels: Record<GMPlanningNodeKind, string> = {
  note: 'Anotação', pokemon: 'Pokémon', trainer: 'Treinador', music: 'Música',
  item: 'Item', shop: 'Loja', episode: 'Episódio', scene: 'Local', image: 'Imagem', shape: 'Forma',
};
const kindIcons: Record<GMPlanningNodeKind, typeof FileText> = {
  note: FileText, pokemon: CircleDot, trainer: UsersRound, music: Music2, item: Package,
  shop: Store, episode: BookOpen, scene: MapPin, image: ImagePlus, shape: Shapes,
};
const colors: Record<GMPlanningNodeKind, string> = {
  note: 'border-amber-300/70 bg-[#fff7df]', pokemon: 'border-rose-300/70 bg-[#fff0ed]',
  trainer: 'border-indigo-300/70 bg-[#f1efff]', music: 'border-cyan-300/70 bg-[#eaf8f8]',
  item: 'border-orange-300/70 bg-[#fff2e7]', shop: 'border-emerald-300/70 bg-[#edf8ef]',
  episode: 'border-sky-300/70 bg-[#edf6ff]', scene: 'border-violet-300/70 bg-[#f6efff]',
  image: 'border-slate-300/70 bg-[#f3f3ef]', shape: 'border-[#9eb0a2] bg-[#e8eee5]',
};
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function GMNotesWorkspace({
  maps, activeMapId, resources, readOnly, onSelectMap, onCreateMap, onRenameMap,
  onDeleteMap, onUpdateMap, onOpenEditor, onNavigateToSheet,
}: Props) {
  const activeMap = maps.find(map => map.id === activeMapId) || maps[0];
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ type: 'node' | 'pan' | 'resize'; id?: string; x: number; y: number; startX: number; startY: number; viewportX: number; viewportY: number; width?: number; height?: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [showConnections, setShowConnections] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pokemonDetail, setPokemonDetail] = useState<Resource | null>(null);
  const [feedback, setFeedback] = useState('');
  const [localViewport, setLocalViewport] = useState<{ mapId: string; value: { x: number; y: number; zoom: number } } | null>(null);
  const nodes = activeMap?.nodes || [];
  const connections = activeMap?.connections || [];
  const snapEnabled = activeMap?.snapToGrid !== false;
  const viewport = (readOnly && localViewport?.mapId === activeMap?.id ? localViewport.value : activeMap?.viewport) || { x: 48, y: 38, zoom: 1 };
  const filteredResources = useMemo(() => resources.filter(resource => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return (!query || `${resource.title} ${resource.subtitle || ''} ${kindLabels[resource.kind]}`.toLocaleLowerCase('pt-BR').includes(query));
  }), [resources, search]);
  const update = (patch: Partial<GMPlanningMap>) => {
    if (!activeMap || readOnly) return;
    onUpdateMap({ ...activeMap, ...patch, updatedAt: new Date().toISOString() });
  };
  const patchNode = (id: string, patch: Partial<GMPlanningNode>) => {
    if (!activeMap || readOnly) return;
    update({ nodes: nodes.map(node => node.id === id ? { ...node, ...patch } : node) });
  };
  const changeViewport = (next: { x: number; y: number; zoom: number }) => {
    if (!activeMap) return;
    if (readOnly) setLocalViewport({ mapId: activeMap.id, value: next });
    else update({ viewport: next });
  };
  const pointOnCanvas = () => {
    const rect = boardRef.current?.getBoundingClientRect();
    return rect ? { x: Math.max(40, Math.round((rect.width / 2 - viewport.x) / viewport.zoom)), y: Math.max(40, Math.round((rect.height / 2 - viewport.y) / viewport.zoom)) } : { x: 320, y: 220 };
  };
  const addNode = (kind: GMPlanningNodeKind, resource?: Resource, extra: Partial<GMPlanningNode> = {}) => {
    if (!activeMap || readOnly) return;
    const point = pointOnCanvas();
    const node: GMPlanningNode = {
      id: newId(), kind, title: resource?.title || (kind === 'shop' ? 'Nova loja' : kind === 'shape' ? 'Novo quadro' : kind === 'image' ? 'Imagem' : 'Nova anotação'),
      description: resource?.description || '', x: point.x - 126, y: point.y - 86,
      ...(resource ? { resourceId: resource.id } : {}), ...extra,
    };
    update({ nodes: [...nodes, node] });
    setSelectedNode(node.id);
    setAdding(false);
    setSearch('');
  };
  const removeNode = (id: string) => {
    if (!activeMap || readOnly) return;
    update({ nodes: nodes.filter(node => node.id !== id), connections: connections.filter(connection => connection.fromNodeId !== id && connection.toNodeId !== id) });
    if (selectedNode === id) setSelectedNode(null);
  };
  const duplicateNode = (node: GMPlanningNode) => {
    if (!activeMap || readOnly) return;
    const copy = { ...node, id: newId(), title: `${node.title} (cópia)`, x: node.x + 40, y: node.y + 44 };
    update({ nodes: [...nodes, copy] });
    setSelectedNode(copy.id);
  };
  const changeZoom = (amount: number) => changeViewport({ ...viewport, zoom: Math.min(1.65, Math.max(0.48, +(viewport.zoom + amount).toFixed(2))) });
  const resetView = () => changeViewport({ x: 48, y: 38, zoom: 1 });
  const fitView = () => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || !nodes.length) return resetView();
    const minX = Math.min(...nodes.map(node => node.x));
    const minY = Math.min(...nodes.map(node => node.y));
    const maxX = Math.max(...nodes.map(node => node.x + (node.width || 252)));
    const maxY = Math.max(...nodes.map(node => node.y + (node.height || 172)));
    const zoom = Math.min(1.2, Math.max(.48, Math.min((rect.width - 100) / (maxX - minX + 120), (rect.height - 100) / (maxY - minY + 120))));
    changeViewport({ x: Math.round((rect.width - (maxX - minX) * zoom) / 2 - minX * zoom), y: Math.round((rect.height - (maxY - minY) * zoom) / 2 - minY * zoom), zoom });
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>, type: 'node' | 'pan' | 'resize', nodeId?: string) => {
    if (event.button !== 0 || (type !== 'pan' && readOnly)) return;
    if (type === 'pan' && (event.target as HTMLElement).closest('[data-node-card],button,input,textarea,[contenteditable=true]')) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const node = nodeId ? nodes.find(item => item.id === nodeId) : undefined;
    dragRef.current = {
      type, id: nodeId, x: event.clientX, y: event.clientY, startX: node?.x || 0, startY: node?.y || 0,
      viewportX: viewport.x, viewportY: viewport.y, width: node?.width || 252, height: node?.height || 172,
    };
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !activeMap) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (drag.type === 'node' && drag.id) {
      patchNode(drag.id, { x: Math.round(drag.startX + dx / viewport.zoom), y: Math.round(drag.startY + dy / viewport.zoom) });
    } else if (drag.type === 'resize' && drag.id) {
      patchNode(drag.id, { width: Math.max(150, Math.round((drag.width || 252) + dx / viewport.zoom)), height: Math.max(112, Math.round((drag.height || 172) + dy / viewport.zoom)) });
    } else {
      changeViewport({ ...viewport, x: Math.round(drag.viewportX + dx), y: Math.round(drag.viewportY + dy) });
    }
  };
  const stopDrag = () => {
    const drag = dragRef.current;
    if (drag?.type === 'node' && drag.id && activeMap && snapEnabled) {
      const node = nodes.find(item => item.id === drag.id);
      if (node) {
        const position = snapPlanningNodePosition(node, nodes, viewport.zoom, true);
        patchNode(node.id, position);
      }
    }
    dragRef.current = null;
  };
  const handleNodeClick = (node: GMPlanningNode) => {
    setSelectedNode(node.id);
    if (node.kind === 'pokemon' && !connectMode) {
      const resource = node.resourceId ? resources.find(item => item.id === node.resourceId) : undefined;
      if (resource) setPokemonDetail(resource);
    }
    if (!connectMode || readOnly) return;
    if (!connectFrom) setConnectFrom(node.id);
    else if (connectFrom !== node.id && activeMap) {
      const label = window.prompt('Nome desta ligação', 'relacionado a');
      if (label !== null) update({ connections: [...connections, { id: newId(), fromNodeId: connectFrom, toNodeId: node.id, label: label.trim(), style: 'solid' }] });
      setConnectFrom(null); setConnectMode(false);
    }
  };
  const beginRename = () => { if (!activeMap || readOnly) return; setRenameDraft(activeMap.title); setRenaming(true); };
  const saveRename = () => { if (activeMap && renameDraft.trim()) onRenameMap(activeMap.id, renameDraft.trim()); setRenaming(false); };
  const removeConnection = (id: string) => update({ connections: connections.filter(connection => connection.id !== id) });
  const handlePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (readOnly || !activeMap) return;
    const target = event.target as HTMLElement;
    if (target.closest('input,textarea,[contenteditable=true]')) return;
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    if (!html && !text) return;
    event.preventDefault();
    const safeHtml = html ? sanitizePlanningHtml(html) : textAsPlanningHtml(text);
    const plain = text || new DOMParser().parseFromString(safeHtml, 'text/html').body.textContent || '';
    addNode('note', undefined, { title: plain.trim().split('\n')[0]?.slice(0, 48) || 'Nota colada', description: plain, contentHtml: safeHtml, width: 300, height: 190 });
    setFeedback('Anotação criada a partir da área de transferência.');
  };
  const selected = nodes.find(node => node.id === selectedNode);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable=true]')) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNode && !readOnly) {
        event.preventDefault();
        if (window.confirm('Excluir o elemento selecionado?')) removeNode(selectedNode);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selected && !readOnly) {
        event.preventDefault();
        duplicateNode(selected);
      } else if (event.key === '?' && !readOnly) {
        setShowHelp(value => !value);
      } else if (event.key === 'Escape') {
        setShowHelp(false);
        setPokemonDetail(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNode, selected, readOnly]);

  if (!activeMap) return <section className="rounded-2xl border border-[#d9d1c4] bg-[#f6f1e7] p-8 text-center text-[#58656a]">Nenhum mapa disponível.</section>;

  return (
    <section className={`gm-notes-workspace flex ${readOnly ? 'min-h-[calc(100dvh-180px)]' : 'h-full min-h-0'} flex-col overflow-hidden rounded-[22px] border border-[#d9d3c8] bg-[#f4f0e7] text-[#23333a] shadow-[0_18px_55px_rgba(42,48,42,.10)] ${readOnly ? 'gm-notes-readonly' : ''}`} data-testid="workspace-anotacoes">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ded8cd] bg-[#f8f5ee] px-4 py-3 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#243b3e] text-[#f4d982]"><MapPin size={19} /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {renaming ? <input autoFocus value={renameDraft} onChange={event => setRenameDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveRename(); if (event.key === 'Escape') setRenaming(false); }} className="max-w-[260px] rounded-md border border-[#a7b1a7] bg-white px-2 py-1 text-lg font-bold outline-none focus:ring-2 focus:ring-[#728c70]" aria-label="Nome do mapa" data-testid="input-map-name" /> : <h2 className="truncate font-display text-xl font-bold tracking-[-.03em]" data-testid={`text-map-title-${activeMap.id}`}>{activeMap.title}</h2>}
              {renaming ? <><button onClick={saveRename} className="rounded p-1 text-[#40734c]" aria-label="Salvar nome" data-testid="button-save-map-name"><Check size={17} /></button><button onClick={() => setRenaming(false)} className="rounded p-1 text-[#687477]" aria-label="Cancelar edição" data-testid="button-cancel-map-name"><X size={17} /></button></> : !readOnly && <button onClick={beginRename} className="rounded p-1 text-[#77817d] hover:bg-[#ebe6dc]" aria-label="Renomear mapa" data-testid="button-rename-map"><FileText size={15} /></button>}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#78817c]">{nodes.length} elementos <span className="px-1 text-[#c0b7a6]">/</span> {connections.length} ligações</p>
          </div>
          <div className="hidden h-8 w-px bg-[#ded8cd] md:block" />
          <div className="relative min-w-[148px]"><select value={activeMap.id} onChange={event => onSelectMap(event.target.value)} className="max-w-[210px] appearance-none rounded-lg border border-[#ddd7cb] bg-[#f4f0e7] py-2 pl-3 pr-8 text-sm font-semibold text-[#53605f] outline-none focus:ring-2 focus:ring-[#8a9f84]" aria-label="Selecionar mapa" data-testid="select-map">{maps.map(map => <option value={map.id} key={map.id}>{map.title}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#77817d]" /></div>
        </div>
        <div className="flex items-center gap-2">
          {readOnly ? <><span className="hidden items-center gap-1.5 rounded-full border border-[#d8d2c5] bg-[#efebe2] px-3 py-2 text-xs font-semibold text-[#66736e] sm:flex"><Eye size={14} /> Somente leitura</span><button onClick={() => onOpenEditor(activeMap.id)} className="inline-flex items-center gap-2 rounded-lg bg-[#293f41] px-3.5 py-2.5 text-sm font-bold text-[#f7f1df] hover:bg-[#395657]" data-testid="button-open-editor">Abrir editor <ArrowUpRight size={15} /></button></> :
          <><button onClick={() => { setAdding(value => !value); setConnectMode(false); }} className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-bold ${adding ? 'bg-[#e8e1d3] text-[#34484a]' : 'bg-[#293f41] text-[#f7f1df] hover:bg-[#395657]'}`} data-testid="button-add-element"><Plus size={16} /> Adicionar</button><button onClick={() => { setConnectMode(value => !value); setConnectFrom(null); setAdding(false); }} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${connectMode ? 'border-[#658867] bg-[#e5efe2] text-[#3b6447]' : 'border-[#d8d2c5] bg-[#f7f3ea] text-[#54615d]'}`} data-testid="button-connect-nodes"><Link2 size={15} /> Ligar</button></>}
        </div>
      </header>
      {adding && !readOnly && <div className="z-20 flex flex-wrap items-center gap-2 border-b border-[#ddd7cb] bg-[#fbf9f3] px-4 py-3 md:px-6" data-testid="panel-add-elements">
        <button onClick={() => addNode('note')} className="inline-flex items-center gap-2 rounded-lg border border-[#e0c978] bg-[#fff7df] px-3 py-2 text-sm font-semibold" data-testid="button-add-note"><FileText size={15} /> Anotação</button>
        <button onClick={() => addNode('shop')} className="inline-flex items-center gap-2 rounded-lg border border-[#a7c9a7] bg-[#edf8ef] px-3 py-2 text-sm font-semibold" data-testid="button-add-shop"><Store size={15} /> Loja</button>
       <button onClick={() => addNode('image', undefined, { title: 'Imagem de referência', width: 320, height: 240 })} className="inline-flex items-center gap-2 rounded-lg border border-[#d8d4c8] bg-white px-3 py-2 text-sm font-semibold text-[#53615f]" data-testid="button-add-image"><ImagePlus size={15} /> Imagem</button>
        <div className="flex items-center gap-1 rounded-lg border border-[#d8d4c8] bg-white p-1">
          {([['rectangle', Shapes, 'Retângulo'], ['ellipse', Circle, 'Elipse'], ['diamond', Diamond, 'Losango'], ['frame', Frame, 'Quadro rotulado']] as const).map(([shape, Icon, label]) => <button key={shape} onClick={() => addNode('shape', undefined, { shape, width: shape === 'frame' ? 360 : 230, height: shape === 'frame' ? 230 : 150, color: '#dce7d6' })} title={label} aria-label={`Adicionar ${label.toLocaleLowerCase('pt-BR')}`} className="grid h-8 w-8 place-items-center rounded-md text-[#607269] hover:bg-[#edf1e9]" data-testid={`button-add-shape-${shape}`}><Icon size={15} /></button>)}
        </div>
        <div className="relative min-w-[190px] flex-1 sm:max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#85908a]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar recursos da campanha" className="w-full rounded-lg border border-[#ddd7cb] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#91a48d]" data-testid="input-search-resources" /></div>
        <div className="flex max-h-28 flex-1 flex-wrap gap-1.5 overflow-y-auto">{filteredResources.slice(0, 12).map(resource => {
          const Icon = kindIcons[resource.kind];
          return <button key={`${resource.kind}-${resource.id}`} onClick={() => addNode(resource.kind, resource)} className="inline-flex items-center gap-1.5 rounded-full border border-[#d9d6cb] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#53615f] hover:border-[#82977e]" data-testid={`button-link-resource-${resource.id}`}>{resource.imageUrl && resource.kind === 'pokemon' ? <img src={resource.imageUrl} alt="" loading="lazy" className="h-5 w-5 rounded-full object-contain" /> : <Icon size={13} />}{resource.title}</button>;
        })}{!filteredResources.length && <p className="py-1 text-xs text-[#7b8580]">Nenhum recurso encontrado. Crie uma anotação ou loja.</p>}</div>
        <button onClick={() => setAdding(false)} className="rounded-md p-1.5 text-[#77817d]" aria-label="Fechar menu de adição" data-testid="button-close-add-menu"><X size={16} /></button>
      </div>}
      {connectMode && <div className="z-10 flex items-center gap-2 border-b border-[#cfdec9] bg-[#e9f1e5] px-5 py-2.5 text-sm text-[#48654c]"><Link2 size={15} />{connectFrom ? 'Agora escolha o destino da ligação.' : 'Escolha um elemento de origem e depois o destino.'}<button onClick={() => { setConnectMode(false); setConnectFrom(null); }} className="ml-auto rounded px-2 py-1 font-semibold hover:bg-white/70" data-testid="button-cancel-connect">Cancelar</button></div>}
      <div className="relative flex min-h-[560px] flex-1 overflow-hidden">
           <div ref={boardRef} tabIndex={0} className="relative min-h-[560px] flex-1 cursor-grab overflow-hidden outline-none active:cursor-grabbing" onPointerDown={event => handlePointerDown(event, 'pan')} onPointerMove={handlePointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} onPaste={handlePaste} onWheel={event => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); changeZoom(event.deltaY < 0 ? .08 : -.08); } }} style={{ touchAction: 'none' }} data-testid="canvas-planning-board" aria-label="Área de planejamento. Use Ctrl e V para colar uma anotação.">
          <div className="pointer-events-none absolute inset-0 opacity-[.46]" style={{ backgroundImage: activeMap.background === 'plain' ? 'none' : activeMap.background === 'grid' ? 'linear-gradient(#c9cec2 1px, transparent 1px), linear-gradient(90deg, #c9cec2 1px, transparent 1px)' : 'radial-gradient(#aab0a5 0.8px, transparent 0.8px)', backgroundSize: activeMap.background === 'grid' ? '32px 32px' : '22px 22px' }} />
          <div className="absolute left-0 top-0 h-[4200px] w-[5200px]" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}>
            <svg className="pointer-events-none absolute left-0 top-0 h-[4200px] w-[5200px] overflow-visible"><defs><marker id="gm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#788980" /></marker></defs>
              {connections.map(connection => { const from = nodes.find(node => node.id === connection.fromNodeId); const to = nodes.find(node => node.id === connection.toNodeId); if (!from || !to) return null;
                const x1 = from.x + (from.width || 252) / 2, y1 = from.y + (from.height || 172) / 2, x2 = to.x + (to.width || 252) / 2, y2 = to.y + (to.height || 172) / 2;
                return <g key={connection.id} className="pointer-events-auto cursor-pointer" onClick={event => { event.stopPropagation(); if (!readOnly && window.confirm('Remover esta ligação?')) removeConnection(connection.id); }}><path d={`M ${x1} ${y1} C ${x1 + (x2 - x1) * .42} ${y1}, ${x2 - (x2 - x1) * .42} ${y2}, ${x2} ${y2}`} fill="none" stroke="transparent" strokeWidth="18" /><path d={`M ${x1} ${y1} C ${x1 + (x2 - x1) * .42} ${y1}, ${x2 - (x2 - x1) * .42} ${y2}, ${x2} ${y2}`} fill="none" stroke="#829188" strokeWidth="2" strokeDasharray={connection.style === 'dashed' ? '7 6' : undefined} markerEnd="url(#gm-arrow)" />{connection.label && <g><rect x={(x1 + x2) / 2 - 48} y={(y1 + y2) / 2 - 13} width="96" height="24" rx="12" fill="#f7f4ec" stroke="#d6d5c9" /><text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 4} textAnchor="middle" fill="#62716b" fontSize="11" fontWeight="600">{connection.label.slice(0, 18)}</text></g>}</g>;
              })}
            </svg>
            {nodes.map(node => {
              const Icon = kindIcons[node.kind];
              const resource = node.resourceId ? resources.find(item => item.id === node.resourceId) : undefined;
              const selectedNodeCard = selectedNode === node.id;
              const isShape = node.kind === 'shape';
              const isPokemon = node.kind === 'pokemon';
              return <article key={node.id} data-node-card="true" onPointerDown={event => { event.stopPropagation(); handlePointerDown(event, 'node', node.id); }} onClick={event => { event.stopPropagation(); handleNodeClick(node); }} style={{ left: node.x, top: node.y, width: node.width || (isShape ? 230 : 252), height: node.height || undefined, backgroundColor: isShape ? node.color || '#dce7d6' : undefined }} className={`absolute z-[1] select-none overflow-hidden border shadow-[0_7px_20px_rgba(38,46,40,.10)] transition-shadow ${isShape && node.shape === 'ellipse' ? 'rounded-[50%]' : 'rounded-xl'} ${isShape && node.shape === 'frame' ? 'border-dashed' : ''} ${isShape ? 'border-[#849b8b]/80' : colors[node.kind]} ${selectedNodeCard ? 'ring-2 ring-[#708b6c] ring-offset-2 ring-offset-[#f4f0e7]' : 'hover:shadow-[0_11px_27px_rgba(38,46,40,.15)]'} ${connectMode ? 'cursor-crosshair' : 'cursor-grab'} ${isShape && node.shape === 'diamond' ? 'rotate-45 rounded-lg' : ''}`} data-testid={`card-board-node-${node.id}`}>
                <div className={`flex items-center gap-2 border-b border-[#46514a]/10 px-3 py-2.5 ${isShape && node.shape === 'diamond' ? '-rotate-45' : ''}`}>
                  {!isShape && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/70 text-[#59675f]"><Icon size={15} /></span>}
                  {!readOnly ? <input value={node.title} onPointerDown={event => event.stopPropagation()} onChange={event => patchNode(node.id, { title: event.target.value })} className={`min-w-0 flex-1 bg-transparent text-sm font-bold text-[#344348] outline-none placeholder:text-[#8a938b] ${isShape && node.shape === 'diamond' ? 'text-center' : ''}`} placeholder={kindLabels[node.kind]} aria-label={`Título: ${node.title}`} data-testid={`input-node-title-${node.id}`} /> : <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-[#344348]">{node.title || kindLabels[node.kind]}</h3>}
                  {!isShape && <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#78817a]">{kindLabels[node.kind]}</span>}
                </div>
                {isShape ? <div className={`flex h-[calc(100%-43px)] items-center justify-center px-4 text-center text-xs text-[#52665a] ${node.shape === 'diamond' ? '-rotate-45' : ''}`}>{node.shape === 'frame' ? <span className="self-start rounded-b-md bg-[#f4f0e7]/85 px-3 py-1 font-semibold">{node.title || 'Quadro'}</span> : <span>{node.description}</span>}</div> :
                 node.kind === 'image' ? <div className="h-[calc(100%-44px)] p-2"><ImageUrlField value={node.imageUrl} onChange={imageUrl => patchNode(node.id, { imageUrl: imageUrl || undefined })} label={node.title || 'Imagem do mapa'} disabled={readOnly} className="h-full min-h-20 w-full rounded-lg border border-dashed border-[#bfc5bb] bg-white/50 text-[#78817c]" imageClassName="h-full w-full rounded-lg object-contain" /></div> :
                isPokemon ? <button type="button" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (resource) setPokemonDetail(resource); }} className="block w-full text-left" aria-label={`Abrir detalhes de ${node.title}`} data-testid={`button-pokemon-details-${node.id}`}>
                  {resource?.imageUrl ? <div className="relative flex h-32 items-center justify-center overflow-hidden border-b border-rose-200/70 bg-[radial-gradient(ellipse_at_center,#fff9f5,#f7d8d2)]"><img src={resource.imageUrl} alt={node.title} loading="lazy" className="h-full max-w-full object-contain drop-shadow-sm" /><span className="absolute bottom-2 left-2 rounded-full bg-white/85 px-2 py-1 text-[10px] font-bold text-[#80544f]">{resource.subtitle || 'Registro da campanha'}</span></div> : <div className="flex items-center gap-2 border-b border-[#46514a]/10 bg-white/35 px-3 py-2"><Icon size={16} /><p className="text-xs font-medium text-[#67736e]">{resource?.subtitle || 'Pokémon da campanha'}</p></div>}
                  <div className="px-3 py-2"><p className="font-display text-base font-bold text-[#533f3c]">{node.title}</p><p className="mt-0.5 text-[11px] text-[#796866]">Toque para consultar a Pokédex</p></div>
                </button> : resource?.imageUrl || resource?.subtitle ? <div className="flex items-center gap-2 border-b border-[#46514a]/10 bg-white/35 px-3 py-2">{resource.imageUrl && <img src={resource.imageUrl} alt="" loading="lazy" className="h-9 w-9 rounded-lg object-cover" />}<p className="line-clamp-2 text-xs font-medium text-[#67736e]">{resource.subtitle || resource.title}</p></div> : null}
                {!isShape && node.kind !== 'image' && !isPokemon && (!readOnly ? node.kind === 'note' ? <div className="border-t border-[#46514a]/10" onPointerDown={event => event.stopPropagation()}>
                  <div className="flex flex-wrap items-center gap-1 border-b border-[#46514a]/10 bg-white/35 px-2 py-1">
                    <button onClick={() => document.execCommand('bold')} title="Negrito" aria-label="Negrito" className="rounded p-1 hover:bg-white" data-testid={`button-format-bold-${node.id}`}><Bold size={13} /></button>
                    <button onClick={() => document.execCommand('italic')} title="Itálico" aria-label="Itálico" className="rounded p-1 hover:bg-white" data-testid={`button-format-italic-${node.id}`}><Italic size={13} /></button>
                    <button onClick={() => document.execCommand('underline')} title="Sublinhado" aria-label="Sublinhado" className="rounded p-1 hover:bg-white" data-testid={`button-format-underline-${node.id}`}><Underline size={13} /></button>
                    <label className="ml-1 flex cursor-pointer items-center gap-1 text-[10px] text-[#6b7770]" title="Cor do texto"><input type="color" defaultValue="#42564c" onChange={event => { document.execCommand('foreColor', false, event.target.value); }} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" aria-label="Cor do texto" data-testid={`input-note-color-${node.id}`} /></label>
                    <select aria-label="Tamanho do texto" value={node.fontSize || 13} onChange={event => patchNode(node.id, { fontSize: Number(event.target.value) })} className="ml-auto rounded border border-[#e0ded4] bg-white/70 px-1 py-0.5 text-[10px]" data-testid={`select-note-font-size-${node.id}`}>{[12, 13, 14, 16, 18, 20].map(size => <option key={size} value={size}>{size}px</option>)}</select>
                  </div>
                  <div key={`${node.id}-${node.contentHtml ? 'html' : 'legacy'}`} contentEditable suppressContentEditableWarning onInput={event => { const el = event.currentTarget; patchNode(node.id, { contentHtml: sanitizePlanningHtml(el.innerHTML), description: el.innerText }); }} dangerouslySetInnerHTML={{ __html: node.contentHtml ? sanitizePlanningHtml(node.contentHtml) : textAsPlanningHtml(node.description || '') }} style={{ minHeight: 70, maxHeight: 210, overflowY: 'auto', fontSize: node.fontSize || 13 }} className="planning-note-editor px-3 py-2.5 leading-[1.55] text-[#586761] outline-none empty:before:content-['Registre_uma_pista,_ideia_ou_segredo…'] empty:before:text-[#929991]" aria-label={`Texto da anotação: ${node.title}`} data-testid={`editor-node-note-${node.id}`} />
                </div> : <textarea value={node.description} onPointerDown={event => event.stopPropagation()} onChange={event => patchNode(node.id, { description: event.target.value })} placeholder="Adicione detalhes para esta sessão…" className="block min-h-[76px] w-full resize-y bg-transparent px-3 py-2.5 text-xs leading-[1.55] text-[#586761] outline-none placeholder:text-[#929991]" aria-label={`Descrição: ${node.title}`} data-testid={`input-node-description-${node.id}`} /> :
                  <div className="min-h-[76px] whitespace-pre-wrap px-3 py-2.5 text-xs leading-[1.55] text-[#586761]">{node.description || 'Sem detalhes registrados.'}</div>)}
                {!readOnly && <div className={`flex items-center justify-between border-t border-[#46514a]/10 px-2.5 py-1.5 ${isShape && node.shape === 'diamond' ? '-rotate-45' : ''}`}><span className="px-1 text-[10px] text-[#8a938b]">{node.kind === 'note' ? 'Texto rico salvo automaticamente' : 'Arraste para organizar'}</span><div className="flex gap-1"><button onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); duplicateNode(node); }} title="Duplicar elemento" className="rounded-md p-1.5 text-[#6c7972] hover:bg-white/70" aria-label={`Duplicar ${node.title}`} data-testid={`button-duplicate-node-${node.id}`}><Copy size={14} /></button><button onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (window.confirm(`Excluir “${node.title}”?`)) removeNode(node.id); }} title="Excluir elemento" className="rounded-md p-1.5 text-[#8c6c64] hover:bg-[#f8e4df]" aria-label={`Excluir ${node.title}`} data-testid={`button-delete-node-${node.id}`}><Trash2 size={14} /></button></div></div>}
                {!readOnly && isShape && <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-white/80 p-1" onPointerDown={event => event.stopPropagation()}><input type="color" value={node.color || '#dce7d6'} onChange={event => patchNode(node.id, { color: event.target.value })} aria-label={`Cor de ${node.title}`} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" data-testid={`input-shape-color-${node.id}`} /></div>}
                {!readOnly && <button type="button" onPointerDown={event => { event.stopPropagation(); handlePointerDown(event, 'resize', node.id); }} onClick={event => event.stopPropagation()} className="absolute bottom-0 right-0 z-10 grid h-6 w-6 cursor-nwse-resize place-items-center rounded-tl-lg bg-white/80 text-[#708276] hover:bg-white" aria-label={`Redimensionar ${node.title}`} title="Arraste para redimensionar" data-testid={`handle-resize-node-${node.id}`}><Maximize2 size={12} /></button>}
              </article>;
            })}
             {!nodes.length && <div className="absolute left-[440px] top-[360px] w-[340px] text-center" data-testid="empty-board"><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-[22px] border border-[#d8d5c9] bg-[#fbf9f2] text-[#80917f] shadow-sm"><MapPin size={26} /></div><p className="font-display text-xl font-bold text-[#43534f]">Um mapa em branco, muitas possibilidades.</p><p className="mt-2 text-sm leading-6 text-[#78827b]">{readOnly ? 'Este mapa ainda não tem elementos.' : 'Reúna pistas, personagens e lugares para preparar o próximo capítulo. Você também pode colar texto com Ctrl+V.'}</p>{!readOnly && <button onClick={() => setAdding(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#293f41] px-4 py-2.5 text-sm font-bold text-[#f7f1df]" data-testid="button-first-element"><Plus size={15} /> Criar primeiro elemento</button>}</div>}
          </div>
          <div className="absolute bottom-4 left-4 max-w-[75%] rounded-lg border border-[#dad5ca] bg-[#f8f5ee]/95 px-3 py-2 text-[11px] font-medium text-[#78817b] shadow-sm" data-testid="status-canvas">{feedback || (connectMode ? 'Selecione dois elementos para criar uma ligação' : 'Arraste o fundo para navegar')} <span className="px-1.5 text-[#c2b9a9]">·</span> {Math.round(viewport.zoom * 100)}%</div>
        </div>
        <aside className="absolute bottom-4 right-4 z-10 flex flex-col gap-1 rounded-xl border border-[#d9d4c9] bg-[#faf8f1]/95 p-1.5 shadow-md md:bottom-auto md:right-4 md:top-4">
          <button onClick={() => changeZoom(.12)} title="Aumentar zoom" aria-label="Aumentar zoom" className="grid h-9 w-9 place-items-center rounded-lg text-[#566660] hover:bg-[#ebe8dd]" data-testid="button-zoom-in"><ZoomIn size={17} /></button>
          <button onClick={() => changeZoom(-.12)} title="Diminuir zoom" aria-label="Diminuir zoom" className="grid h-9 w-9 place-items-center rounded-lg text-[#566660] hover:bg-[#ebe8dd]" data-testid="button-zoom-out"><ZoomOut size={17} /></button>
          <div className="mx-1 h-px bg-[#ded8cd]" />
          <button onClick={fitView} title="Enquadrar elementos" aria-label="Enquadrar elementos" className="grid h-9 w-9 place-items-center rounded-lg text-[#566660] hover:bg-[#ebe8dd]" data-testid="button-fit-view"><Maximize2 size={16} /></button>
          {!readOnly && <button onClick={() => update({ snapToGrid: !snapEnabled })} title={snapEnabled ? 'Desativar alinhamento inteligente' : 'Ativar alinhamento inteligente'} aria-label={snapEnabled ? 'Desativar alinhamento inteligente' : 'Ativar alinhamento inteligente'} className={`grid h-9 w-9 place-items-center rounded-lg ${snapEnabled ? 'bg-[#e5efe2] text-[#477050]' : 'text-[#78817b] hover:bg-[#ebe8dd]'}`} data-testid="button-toggle-snap"><Magnet size={16} /></button>}
          <button onClick={() => setShowConnections(value => !value)} title="Ver ligações" aria-label="Ver ligações" className={`grid h-9 w-9 place-items-center rounded-lg ${showConnections ? 'bg-[#e5efe2] text-[#477050]' : 'text-[#566660] hover:bg-[#ebe8dd]'}`} data-testid="button-toggle-connections"><Link2 size={16} /></button>
          {!readOnly && <button onClick={() => setShowHelp(value => !value)} title="Atalhos e ajuda" aria-label="Atalhos e ajuda" className="grid h-9 w-9 place-items-center rounded-lg text-[#566660] hover:bg-[#ebe8dd]" data-testid="button-canvas-help"><HelpCircle size={16} /></button>}
        </aside>
         {showHelp && <aside className="absolute bottom-16 right-4 z-20 w-[min(300px,calc(100%-2rem))] rounded-xl border border-[#d8d3c7] bg-[#faf8f1] p-4 shadow-xl md:bottom-auto md:top-[250px]" data-testid="panel-canvas-help"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#69766f]">Atalhos do mapa</p><button onClick={() => setShowHelp(false)} aria-label="Fechar ajuda" className="rounded p-1 hover:bg-[#ebe8dd]" data-testid="button-close-help"><X size={14} /></button></div><ul className="space-y-2 text-xs text-[#62716b]"><li><kbd>Ctrl + V</kbd> colar anotação</li><li><kbd>Delete</kbd> excluir elemento selecionado</li><li><kbd>Ctrl + D</kbd> duplicar elemento</li><li><kbd>Ctrl + roda</kbd> zoom · arrastar fundo para mover</li><li>Arraste o canto de um cartão para redimensionar</li></ul></aside>}
        {showConnections && <aside className="absolute bottom-16 right-4 z-20 w-[min(310px,calc(100%-2rem))] rounded-xl border border-[#d8d3c7] bg-[#faf8f1] p-3 shadow-xl md:bottom-auto md:top-[68px]" data-testid="panel-connections"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#69766f]">Ligações do mapa</p><button onClick={() => setShowConnections(false)} aria-label="Fechar ligações" className="rounded p-1 hover:bg-[#ebe8dd]" data-testid="button-close-connections"><X size={14} /></button></div>{!connections.length ? <p className="py-3 text-xs text-[#87908a]">Ainda não há ligações.</p> : <div className="max-h-48 space-y-1 overflow-y-auto">{connections.map(connection => { const from = nodes.find(node => node.id === connection.fromNodeId); const to = nodes.find(node => node.id === connection.toNodeId); return <div key={connection.id} className="flex items-center gap-2 rounded-lg bg-[#f0ede5] px-2.5 py-2 text-xs"><span className="min-w-0 flex-1 truncate font-semibold text-[#52615c]">{from?.title || 'Elemento'} <ArrowDownRight size={12} className="inline" /> {to?.title || 'Elemento'}<span className="block truncate pt-0.5 font-normal text-[#849089]">{connection.label || 'sem rótulo'}</span></span>{!readOnly && <button onClick={() => removeConnection(connection.id)} aria-label="Remover ligação" className="rounded p-1 text-[#8c6c64] hover:bg-[#f8e4df]" data-testid={`button-remove-connection-${connection.id}`}><Trash2 size={13} /></button>}</div>; })}</div>}</aside>}
      </div>
      {!readOnly && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ded8cd] bg-[#f8f5ee] px-4 py-3 md:px-6"><div className="flex items-center gap-2 text-xs text-[#7a837d]"><span className="h-2 w-2 rounded-full bg-[#78a078]" />Alterações entregues ao espaço da campanha <span className="hidden sm:inline">· Encaixe inteligente {snapEnabled ? 'ativo' : 'desativado'}</span></div><div className="flex items-center gap-2">{maps.length > 1 && <button onClick={() => { if (window.confirm(`Excluir o mapa “${activeMap.title}”?`)) onDeleteMap(activeMap.id); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#8b6b62] hover:bg-[#f5e7e1]" data-testid="button-delete-map"><Trash2 size={14} /> Excluir mapa</button>}<button onClick={onCreateMap} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d7d2c6] bg-[#fbf9f3] px-3 py-2 text-xs font-bold text-[#51635a] hover:border-[#9ead9a]" data-testid="button-create-map"><Plus size={14} /> Novo mapa</button></div></footer>}
      {pokemonDetail && <div className="fixed inset-0 z-[130] grid place-items-center bg-[#1e302d]/55 p-4" role="presentation" onClick={() => setPokemonDetail(null)} data-testid="dialog-pokemon-overlay"><section role="dialog" aria-modal="true" aria-labelledby="pokemon-detail-title" className="relative max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[24px] border border-[#e4d3ca] bg-[#fff9f3] shadow-2xl" onClick={event => event.stopPropagation()} data-testid="dialog-pokemon-details">
        <button onClick={() => setPokemonDetail(null)} aria-label="Fechar detalhes" className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-[#59645e] shadow-sm" data-testid="button-close-pokemon-details"><X size={17} /></button>
        <div className="grid min-h-52 grid-cols-[minmax(130px,.8fr)_1.2fr] items-center gap-3 bg-[radial-gradient(ellipse_at_center,#fffdf9,#f3d9d1)] px-5 py-8 sm:px-9"><div className="grid h-40 place-items-center">{pokemonDetail.imageUrl && <img src={pokemonDetail.imageUrl} alt={pokemonDetail.title} loading="lazy" className="max-h-full max-w-full object-contain drop-shadow-md" />}</div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#a46b61]">Pokédex · registro da campanha</p><h2 id="pokemon-detail-title" className="font-display text-3xl font-bold text-[#3e4c47]">{pokemonDetail.title}</h2><p className="mt-2 text-sm text-[#6f7972]">{pokemonDetail.subtitle}</p></div></div>
        <div className="space-y-5 p-5 sm:p-7">{pokemonDetail.description && <p className="text-sm leading-6 text-[#5f6a63]" data-testid="text-pokemon-description">{pokemonDetail.description}</p>}{!!pokemonDetail.details?.length && <dl className="grid gap-2 sm:grid-cols-2">{pokemonDetail.details.map((detail, index) => <div key={`${detail.label}-${index}`} className="rounded-xl border border-[#e5dfd4] bg-[#f8f4eb] px-3 py-2"><dt className="text-[10px] font-bold uppercase tracking-[.13em] text-[#889088]">{detail.label}</dt><dd className="mt-1 text-sm font-semibold text-[#4b5d54]">{detail.value}</dd></div>)}</dl>}{pokemonDetail.sheetUrl && <button onClick={() => { onNavigateToSheet?.(pokemonDetail.sheetUrl!); setPokemonDetail(null); }} className="inline-flex items-center gap-2 rounded-lg bg-[#293f41] px-4 py-2.5 text-sm font-bold text-[#f7f1df] hover:bg-[#395657]" data-testid="button-open-pokemon-sheet">Abrir ficha <ExternalLink size={15} /></button>}</div>
      </section></div>}
      <style>{`
        .gm-notes-workspace { font-family: var(--font-sans, 'DM Sans', sans-serif); }
        .gm-notes-workspace .font-display { font-family: var(--font-display, 'Fraunces', Georgia, serif); }
        .gm-notes-workspace kbd { border: 1px solid #d9d7cb; border-radius: 4px; background: #f2efe6; padding: 2px 4px; font: 10px ui-monospace, monospace; }
        .gm-notes-workspace .planning-note-editor:empty:before { content: 'Registre uma pista, ideia ou segredo…'; color: #929991; }
        @media (prefers-reduced-motion: no-preference) {
          .gm-notes-workspace [data-node-card] { animation: gm-node-arrive .32s cubic-bezier(.2,.7,.2,1) both; }
          @keyframes gm-node-arrive { from { opacity: .55; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        }
      `}</style>
    </section>
  );
}
