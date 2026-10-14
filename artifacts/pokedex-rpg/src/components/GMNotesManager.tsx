import { useMemo, useState } from 'react';
import {
  ArrowDownAZ, BookOpen, Check, ChevronRight, CircleHelp, FilePlus2, Image,
  Link2, MapPin, Package, Pencil, Plus, Search, ShoppingBag, Tag, Trash2, X,
} from 'lucide-react';
import type { CampaignEpisode, CampaignScene, GMManagerNote, GMNoteAttachment, GMNoteResource, SceneMarketItem } from '../lib/campaign';

type Props = {
  notes: GMManagerNote[];
  resources: GMNoteResource[];
  episodes: CampaignEpisode[];
  onCreateNote: (note: GMManagerNote) => void;
  onUpdateNote: (note: GMManagerNote) => void;
  onDeleteNote: (id: string) => void;
  onUpdateEpisode: (id: string, patch: Partial<CampaignEpisode>) => void;
  onUpdateScene: (episodeId: string, sceneId: string, patch: Partial<CampaignScene>) => void;
  onApplyMarket: (note: GMManagerNote, episodeId: string, sceneId: string) => void;
};

const kinds: GMNoteAttachment['kind'][] = ['pokemon', 'trainer', 'character', 'item', 'music', 'episode', 'scene', 'attack'];
const kindLabels: Record<GMNoteAttachment['kind'], string> = {
  pokemon: 'Pokémon', trainer: 'Treinador', character: 'Personagem', item: 'Item',
  music: 'Música', episode: 'Episódio', scene: 'Cena', attack: 'Ataque',
};
const palette = ['#728b70', '#ba8062', '#7b879d', '#bf9a4c', '#8a7187', '#648c88'];
const now = () => new Date().toISOString();
const makeId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `nota-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const cleanHttps = (value: string) => {
  try { const url = new URL(value.trim()); return url.protocol === 'https:' ? url.toString() : ''; } catch { return ''; }
};
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function blankNote(kind: 'note' | 'market' = 'note'): GMManagerNote {
  const stamp = now();
  return { id: makeId(), kind, title: '', description: '', caption: '', color: palette[0], imageUrls: [], tags: [], attachments: [], linkedNoteIds: [], ...(kind === 'market' ? { marketItems: [] } : {}), createdAt: stamp, updatedAt: stamp };
}

function ResourcePreview({ resource, missingLabel }: { resource?: GMNoteResource; missingLabel?: string }) {
  const Icon = resource?.kind === 'item' ? Package : resource?.kind === 'episode' || resource?.kind === 'scene' ? MapPin : resource?.kind === 'music' ? BookOpen : CircleHelp;
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[#e5dfd2] bg-[#fbfaf5] p-2">
      {resource?.imageUrl ? <img src={resource.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" loading="lazy" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e8eee5] text-[#617b67]"><Icon size={17} /></span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-[#394942]">{resource?.title || missingLabel || 'Registro indisponível'}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#839087]">
          <span className="rounded-full px-1.5 py-0.5 font-semibold" style={{ backgroundColor: `${resource?.accentColor || '#87998a'}20`, color: resource?.accentColor || '#66786c' }}>{resource?.badge || (resource ? kindLabels[resource.kind] : 'Sem registro')}</span>
          {resource?.subtitle && <span className="truncate">{resource.subtitle}</span>}
        </span>
      </span>
    </div>
  );
}

function NoteCard({ note, active, onOpen }: { note: GMManagerNote; active: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={`group w-full rounded-xl border p-3 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-sm ${active ? 'border-[#879d83] bg-[#eef2e9] shadow-sm' : 'border-[#e4dfd4] bg-[#fbfaf6] hover:border-[#b9c6b5]'}`}>
      <span className="mb-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: note.color || palette[0] }} /><strong className="truncate text-[13px] text-[#33443d]">{note.title || 'Sem título'}</strong></span>
        {note.kind === 'market' && <span className="shrink-0 rounded-full bg-[#f3ead8] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8a7041]">Mercado</span>}
      </span>
      <span className="line-clamp-2 block text-[11px] leading-relaxed text-[#78857b]">{note.caption || note.description || 'Ainda sem descrição.'}</span>
      <span className="mt-2 flex items-center gap-1.5 text-[10px] text-[#93a097]"><Link2 size={11} />{(note.linkedNoteIds || []).length} ligações <span className="text-[#c4c9bd]">·</span>{(note.attachments || []).length} recursos</span>
    </button>
  );
}

export default function GMNotesManager({ notes = [], resources = [], episodes = [], onCreateNote, onUpdateNote, onDeleteNote, onUpdateEpisode, onUpdateScene, onApplyMarket }: Props) {
  const [activeId, setActiveId] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GMManagerNote | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [tagFilter, setTagFilter] = useState('todos');
  const [sort, setSort] = useState<'title' | 'created' | 'updated'>('updated');
  const [tagDraft, setTagDraft] = useState('');
  const [imageDraft, setImageDraft] = useState('');
  const [resourceKind, setResourceKind] = useState<GMNoteAttachment['kind']>('pokemon');
  const [resourceQuery, setResourceQuery] = useState('');
  const [linkId, setLinkId] = useState('');
  const [linkQuery, setLinkQuery] = useState('');
  const [episodeId, setEpisodeId] = useState('');
  const [sceneId, setSceneId] = useState('');
  const [templateScene, setTemplateScene] = useState('');
  const orderedNotes = useMemo(() => [...notes].sort((a, b) => {
    if (sort === 'title') return (a.title || '').localeCompare(b.title || '', 'pt-BR');
    return new Date(sort === 'created' ? a.createdAt : a.updatedAt || a.createdAt).getTime() > new Date(sort === 'created' ? b.createdAt : b.updatedAt || b.createdAt).getTime() ? -1 : 1;
  }), [notes, sort]);
  const tags = useMemo(() => unique(notes.flatMap(note => note.tags || [])).sort((a, b) => a.localeCompare(b, 'pt-BR')), [notes]);
  const filteredNotes = orderedNotes.filter(note => {
    const attachedResources = (note.attachments || []).map(attachment => resources.find(item => item.id === attachment.resourceId && item.kind === attachment.kind));
    const haystack = [note.title, note.description, note.caption, ...(note.tags || []), ...(note.imageUrls || []), ...attachedResources.flatMap(resource => resource ? [resource.title, resource.subtitle || '', resource.description || '', resource.badge || ''] : []), ...(note.attachments || []).map(attachment => attachment.resourceId), ...(note.linkedNoteIds || []).map(id => notes.find(item => item.id === id)?.title || id), ...(note.marketItems || []).flatMap(item => [item.name, item.description || '', String(item.price)])].join(' ').toLocaleLowerCase('pt-BR');
    const matchesType = typeFilter === 'todos' || (typeFilter === 'note' || typeFilter === 'market' ? note.kind === typeFilter : (note.attachments || []).some(attachment => attachment.kind === typeFilter));
    return (!query || haystack.includes(query.toLocaleLowerCase('pt-BR'))) && matchesType && (tagFilter === 'todos' || (note.tags || []).includes(tagFilter));
  });
  const active = (editing && draft && !notes.some(note => note.id === draft.id))
    ? draft
    : notes.find(note => note.id === activeId) || filteredNotes[0];
  const panels = useMemo(() => {
    if (!active) return [];
    const result: GMManagerNote[] = [];
    const seen = new Set<string>();
    const walk = (note: GMManagerNote, path: Set<string>) => {
      if (path.has(note.id) || seen.has(note.id)) return;
      seen.add(note.id); result.push(note);
      const nextPath = new Set(path); nextPath.add(note.id);
      (note.linkedNoteIds || []).forEach(id => { const linked = notes.find(item => item.id === id); if (linked) walk(linked, nextPath); });
    };
    walk(active, new Set());
    return result;
  }, [active, notes]);
  const scenesForEpisode = episodes.find(item => item.id === episodeId)?.scenes || [];
  const selectedScene = scenesForEpisode.find(item => item.id === sceneId);
  const selectedResources = resources.filter(resource => resource.kind === resourceKind);
  const matchingResources = selectedResources.filter(resource => !resourceQuery.trim() || [
    resource.title, resource.subtitle || '', resource.description || '', resource.badge || '',
  ].join(' ').toLocaleLowerCase('pt-BR').includes(resourceQuery.trim().toLocaleLowerCase('pt-BR')));
  const visibleResources = matchingResources.slice(0, 48);
  const matchingLinks = notes.filter(note => note.id !== draft?.id && (!linkQuery.trim() || [
    note.title, note.caption, note.description, ...(note.tags || []),
  ].join(' ').toLocaleLowerCase('pt-BR').includes(linkQuery.trim().toLocaleLowerCase('pt-BR')))).slice(0, 48);

  const beginCreate = (kind: 'note' | 'market' = 'note') => {
    const next = blankNote(kind);
    setActiveId(next.id); setDraft(next); setEditing(true);
  };
  const beginEdit = (note: GMManagerNote) => { setDraft({ ...note, imageUrls: [...(note.imageUrls || [])], tags: [...(note.tags || [])], attachments: [...(note.attachments || [])], linkedNoteIds: [...(note.linkedNoteIds || [])], marketItems: [...(note.marketItems || [])] }); setEditing(true); };
  const patchDraft = (patch: Partial<GMManagerNote>) => setDraft(current => current ? { ...current, ...patch } : current);
  const saveDraft = () => {
    if (!draft || !draft.title.trim() || !draft.description.trim() || !draft.caption.trim()) return;
    const saved = { ...draft, title: draft.title.trim(), updatedAt: now(), tags: unique(draft.tags || []), linkedNoteIds: unique(draft.linkedNoteIds || []).filter(id => id !== draft.id), attachments: (draft.attachments || []).filter((item, index, all) => all.findIndex(other => other.kind === item.kind && other.resourceId === item.resourceId) === index) };
    const previous = notes.find(note => note.id === draft.id);
    const removedLinks = (previous?.linkedNoteIds || []).filter(id => !saved.linkedNoteIds.includes(id));
    removedLinks.forEach(id => {
      const target = notes.find(note => note.id === id);
      if (target?.linkedNoteIds?.includes(saved.id)) onUpdateNote({ ...target, linkedNoteIds: target.linkedNoteIds.filter(value => value !== saved.id), updatedAt: now() });
    });
    saved.linkedNoteIds.forEach(id => {
      const target = notes.find(note => note.id === id);
      if (target && !target.linkedNoteIds?.includes(saved.id)) onUpdateNote({ ...target, linkedNoteIds: [...(target.linkedNoteIds || []), saved.id], updatedAt: now() });
    });
    if (notes.some(note => note.id === draft.id)) onUpdateNote(saved); else onCreateNote(saved);
    setActiveId(saved.id); setDraft(null); setEditing(false);
  };
  const updateNote = (note: GMManagerNote, patch: Partial<GMManagerNote>) => onUpdateNote({ ...note, ...patch, updatedAt: now() });
  const addTag = () => { const value = tagDraft.trim(); if (value && draft) patchDraft({ tags: unique([...(draft.tags || []), value]) }); setTagDraft(''); };
  const addImage = () => { const url = cleanHttps(imageDraft); if (url && draft) patchDraft({ imageUrls: unique([...(draft.imageUrls || []), url]) }); setImageDraft(''); };
  const addResource = (id: string) => {
    if (!draft || !id) return;
    const value = { kind: resourceKind, resourceId: id };
    patchDraft({ attachments: [...(draft.attachments || []).filter(item => !(item.kind === value.kind && item.resourceId === value.resourceId)), value] });
  };
  const addLink = () => {
    if (!draft || !linkId || linkId === draft.id) return;
    patchDraft({ linkedNoteIds: unique([...(draft.linkedNoteIds || []), linkId]) });
    const target = notes.find(note => note.id === linkId);
    if (target && !target.linkedNoteIds?.includes(draft.id)) onUpdateNote({ ...target, linkedNoteIds: [...(target.linkedNoteIds || []), draft.id], updatedAt: now() });
    setLinkId('');
  };
  const attachToScene = (note: GMManagerNote) => {
    if (!episodeId || !sceneId) return;
    const episode = episodes.find(item => item.id === episodeId);
    const scene = episode?.scenes.find(item => item.id === sceneId);
    if (!episode || !scene) return;
    if (scene.noteIds?.includes(note.id)) return;
    onUpdateScene(episodeId, sceneId, { noteIds: [...(scene.noteIds || []), note.id] });
  };
  const attachToEpisode = (note: GMManagerNote) => {
    if (!episodeId) return;
    const episode = episodes.find(item => item.id === episodeId);
    if (episode && !episode.noteIds?.includes(note.id)) onUpdateEpisode(episode.id, { noteIds: [...(episode.noteIds || []), note.id] });
  };
  const removeFromScene = (noteId: string, epId: string, scId: string) => {
    const ep = episodes.find(item => item.id === epId);
    const scene = ep?.scenes.find(item => item.id === scId);
    if (scene) onUpdateScene(epId, scId, { noteIds: (scene.noteIds || []).filter(id => id !== noteId) });
  };
  const removeFromEpisode = (noteId: string, epId: string) => {
    const episode = episodes.find(item => item.id === epId);
    if (episode) onUpdateEpisode(epId, { noteIds: (episode.noteIds || []).filter(id => id !== noteId) });
  };
  const deleteNote = (note: GMManagerNote) => {
    if (!window.confirm(`Excluir “${note.title || 'esta anotação'}”?`)) return;
    onDeleteNote(note.id);
    setActiveId('');
  };
  const addMarketItem = () => draft && patchDraft({ marketItems: [...(draft.marketItems || []), { id: makeId(), name: '', price: 0, description: '' }] });
  const updateMarketItem = (itemId: string, patch: Partial<SceneMarketItem>) => draft && patchDraft({ marketItems: (draft.marketItems || []).map(item => item.id === itemId ? { ...item, ...patch } : item) });
  const applyMarket = (note: GMManagerNote) => {
    if (!templateScene || !note.marketItems?.length) return;
    const [epId, scId] = templateScene.split('::');
    onApplyMarket(note, epId, scId);
  };

  const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/25';
  const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-card-foreground transition hover:border-primary/45 hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-45';

  return (
    <section className="gm-notes-manager flex min-h-[620px] flex-col overflow-hidden rounded-[22px] border border-[#d9d4c8] bg-[#f4f1e8] text-[#31423a] shadow-[0_18px_55px_rgba(42,48,42,.09)]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e1dccf] bg-[#faf8f1] px-5 py-4 md:px-7">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#304845] text-[#e8d9ab]"><BookOpen size={19} /></span>
          <div><p className="font-mono text-[9px] uppercase tracking-[.19em] text-[#839087]">Arquivo do mestre</p><h2 className="font-display text-xl font-semibold tracking-tight">Caderno de campanha</h2></div>
          <span className="ml-1 rounded-full border border-[#deded1] bg-[#f2f0e7] px-2.5 py-1 font-mono text-[10px] text-[#748078]">{notes.length} registos</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => beginCreate('note')} className="inline-flex items-center gap-2 rounded-lg bg-[#304845] px-3.5 py-2.5 text-xs font-bold text-[#f8f4e7] transition hover:bg-[#405c55]"><Plus size={15} /> Nova anotação</button>
          <button type="button" onClick={() => beginCreate('market')} className={buttonClass}><ShoppingBag size={14} /> Modelo de mercado</button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-[#e1dccf] bg-[#f7f5ed] md:border-b-0 md:border-r">
          <div className="space-y-2.5 p-4">
            <label className="relative block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d9990]" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar no caderno" className={`${inputClass} pl-9`} aria-label="Buscar anotações" /></label>
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Filtrar por tipo de recurso" value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className={`${inputClass} py-1.5 text-xs`}><option value="todos">Todos os tipos</option><option value="note">Anotações</option><option value="market">Mercados</option>{kinds.map(kind => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}</select>
              <select aria-label="Filtrar por etiqueta" value={tagFilter} onChange={event => setTagFilter(event.target.value)} className={`${inputClass} py-1.5 text-xs`}><option value="todos">Todas as etiquetas</option>{tags.map(tag => <option key={tag}>{tag}</option>)}</select>
            </div>
            <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#879188]"><ArrowDownAZ size={13} />Ordenar <select value={sort} onChange={event => setSort(event.target.value as typeof sort)} className="ml-auto border-0 bg-transparent text-xs font-semibold normal-case tracking-normal text-[#56675e] outline-none"><option value="updated">Alteradas</option><option value="created">Criadas</option><option value="title">Título</option></select></label>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
            {filteredNotes.map(note => <NoteCard key={note.id} note={note} active={active?.id === note.id} onOpen={() => { setActiveId(note.id); setEditing(false); setDraft(null); }} />)}
            {!filteredNotes.length && <div className="m-2 rounded-2xl border border-dashed border-[#d5d8cb] bg-[#faf9f3] px-4 py-8 text-center"><span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#edf0e7] text-[#789078]"><FilePlus2 size={17} /></span><p className="font-display text-base font-semibold text-[#526359]">{notes.length ? 'Nenhum resultado' : 'O caderno começa aqui'}</p><p className="mt-1 text-xs leading-relaxed text-[#879188]">{notes.length ? 'Tente outra busca ou ajuste os filtros.' : 'Guarde pistas, personagens e ideias para a próxima sessão.'}</p>{!notes.length && <button type="button" onClick={() => beginCreate()} className="mt-4 text-xs font-bold text-[#58775f] hover:underline">Criar primeira anotação</button>}</div>}
          </div>
          <footer className="border-t border-[#e3dfd5] px-4 py-3 text-[10px] text-[#8b958d]">Pistas relacionadas aparecem juntas no painel.</footer>
        </aside>

        <main className="min-w-0 overflow-y-auto p-4 md:p-6">
          {!active ? <div className="grid min-h-[420px] place-items-center"><div className="max-w-sm text-center"><span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#e9eee5] text-[#6d876f]"><BookOpen size={24} /></span><h3 className="font-display text-2xl font-semibold">Um espaço para as peças da história</h3><p className="mt-2 text-sm leading-relaxed text-[#7d8980]">Crie uma anotação e ligue-a a recursos, cenas ou outras pistas.</p><button type="button" onClick={() => beginCreate()} className="mt-5 rounded-lg bg-[#304845] px-4 py-2.5 text-sm font-bold text-[#f8f4e7]">Criar anotação</button></div></div> :
            editing && draft?.id === active.id ? (
              <div className="mx-auto max-w-3xl animate-[rise-in_.25s_ease-out_both]">
                <div className="mb-5 flex items-start justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#819087]">{draft.kind === 'market' ? 'Modelo reutilizável' : 'Nova entrada do caderno'}</p><h2 className="mt-1 font-display text-2xl font-semibold">{notes.some(note => note.id === draft.id) ? 'Editar anotação' : 'Nova anotação'}</h2></div><div className="flex gap-2"><button type="button" onClick={() => { setEditing(false); setDraft(null); setActiveId(notes.some(note => note.id === active.id) ? active.id : ''); }} className={buttonClass}><X size={14} />Cancelar</button><button type="button" onClick={saveDraft} disabled={!draft.title.trim() || !draft.description.trim() || !draft.caption.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#304845] px-3.5 py-2 text-xs font-bold text-[#f8f4e7] disabled:opacity-45"><Check size={14} />Salvar</button></div></div>
                <div className="space-y-5 rounded-2xl border border-[#e1dccf] bg-[#fbfaf5] p-4 md:p-6">
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]"><label className="text-xs font-bold text-[#65746a]">Título <span aria-hidden="true">*</span><input required autoFocus value={draft.title} onChange={event => patchDraft({ title: event.target.value })} placeholder={draft.kind === 'market' ? 'Mercado da vila' : 'A pista na estação'} className={`${inputClass} mt-1.5 text-base`} /></label><label className="text-xs font-bold text-[#65746a]">Cor<span className="mt-2 flex gap-1.5">{palette.map(color => <button key={color} type="button" onClick={() => patchDraft({ color })} aria-label={`Escolher cor ${color}`} className={`h-7 w-7 rounded-full border-2 transition ${draft.color === color ? 'scale-110 border-[#344c42] ring-2 ring-[#b7c5b2]' : 'border-white'}`} style={{ backgroundColor: color }} />)}</span></label></div>
                  <label className="block text-xs font-bold text-[#65746a]">Descrição <span aria-hidden="true">*</span><textarea required value={draft.description} onChange={event => patchDraft({ description: event.target.value })} rows={5} placeholder="Registre detalhes, pistas e decisões importantes…" className={`${inputClass} mt-1.5 resize-y leading-relaxed`} /></label>
                  <label className="block text-xs font-bold text-[#65746a]">Legenda curta <span aria-hidden="true">*</span><input required value={draft.caption} onChange={event => patchDraft({ caption: event.target.value })} placeholder="Uma frase para reconhecer esta entrada" className={`${inputClass} mt-1.5`} /></label>
                  <div><p className="mb-2 text-xs font-bold text-[#65746a]">Etiquetas</p><div className="flex flex-wrap gap-1.5">{(draft.tags || []).map(tag => <button key={tag} type="button" onClick={() => patchDraft({ tags: draft.tags.filter(item => item !== tag) })} className="inline-flex items-center gap-1 rounded-full bg-[#eaf0e7] px-2.5 py-1 text-[11px] font-semibold text-[#5e7862]">{tag}<X size={11} /></button>)}<div className="flex gap-1"><input value={tagDraft} onChange={event => setTagDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="Nova etiqueta" className="w-32 rounded-full border border-[#ded9cc] bg-white px-3 py-1 text-xs outline-none focus:border-[#8aa084]" /><button type="button" onClick={addTag} className="rounded-full border border-[#ded9cc] px-2 text-xs text-[#65746a]">Adicionar</button></div></div></div>
                  <div><p className="mb-2 text-xs font-bold text-[#65746a]">Imagens de referência <span className="font-normal text-[#929b92]">· somente endereços HTTPS</span></p><div className="flex gap-2"><input value={imageDraft} onChange={event => setImageDraft(event.target.value)} placeholder="https://…" className={inputClass} /><button type="button" onClick={addImage} className={buttonClass}><Image size={14} />Incluir</button></div><div className="mt-2 flex flex-wrap gap-2">{(draft.imageUrls || []).map(url => <span key={url} className="group relative h-20 w-28 overflow-hidden rounded-lg border border-[#dfdbd0] bg-white"><img src={url} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => patchDraft({ imageUrls: draft.imageUrls.filter(item => item !== url) })} aria-label="Remover imagem" className="absolute right-1 top-1 rounded-full bg-[#293a34]/80 p-1 text-white"><X size={11} /></button></span>)}</div></div>
                  {draft.kind === 'market' && <section className="rounded-xl border border-[#e5dfd2] bg-[#f8f5ec] p-4"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-display text-lg font-semibold">Produtos do modelo</h3><p className="text-[11px] text-[#859087]">Os preços e descrições serão copiados para a cena escolhida.</p></div><button type="button" onClick={addMarketItem} className={buttonClass}><Plus size={13} />Produto</button></div><div className="space-y-2">{(draft.marketItems || []).map(item => <div key={item.id} className="grid gap-2 rounded-lg border border-[#e4dfd3] bg-white p-3 sm:grid-cols-[1fr_100px_auto]"><input value={item.name} onChange={event => updateMarketItem(item.id, { name: event.target.value })} placeholder="Nome do produto" className={`${inputClass} py-1.5`} /><label className="text-[9px] font-semibold text-[#849087]">Preço<input type="number" min="0" value={item.price} onChange={event => updateMarketItem(item.id, { price: Number(event.target.value) })} className={`${inputClass} mt-0.5 py-1.5`} /></label><button type="button" onClick={() => patchDraft({ marketItems: draft.marketItems?.filter(value => value.id !== item.id) })} aria-label="Remover produto" className="self-center rounded p-2 text-[#a16e65] hover:bg-[#f7eae6]"><Trash2 size={14} /></button><textarea value={item.description || ''} onChange={event => updateMarketItem(item.id, { description: event.target.value })} placeholder="Descrição do produto" rows={2} className={`${inputClass} sm:col-span-3`} /></div>)}{!(draft.marketItems || []).length && <p className="py-4 text-center text-xs text-[#8b958b]">Inclua os produtos que deseja oferecer neste mercado.</p>}</div></section>}
                  <div className="grid gap-4 lg:grid-cols-2">
                     <section className="rounded-xl border border-border bg-card/70 p-4"><h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-foreground"><Package size={14} className="text-primary" />Recursos anexados</h3><div className="mb-3 grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]"><select value={resourceKind} onChange={event => { setResourceKind(event.target.value as GMNoteAttachment['kind']); setResourceQuery(''); }} className={`${inputClass} py-1.5 text-xs`}>{kinds.map(kind => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}</select><label className="relative block"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={resourceQuery} onChange={event => setResourceQuery(event.target.value)} placeholder={`Buscar ${kindLabels[resourceKind].toLocaleLowerCase('pt-BR')} por nome ou detalhe`} aria-label={`Buscar ${kindLabels[resourceKind].toLocaleLowerCase('pt-BR')}`} className={`${inputClass} pl-9`} /></label></div><div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">{visibleResources.map(item => { const attached = draft.attachments.some(entry => entry.kind === item.kind && entry.resourceId === item.id); return <div key={item.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><ResourcePreview resource={item} /></div><button type="button" onClick={() => addResource(item.id)} disabled={attached} aria-label={attached ? `${item.title} já está anexado` : `Anexar ${item.title}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:bg-accent hover:text-accent-foreground disabled:opacity-60">{attached ? <Check size={13} /> : <Plus size={13} />}{attached ? 'Anexado' : 'Anexar'}</button></div>; })}{!matchingResources.length && <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">{selectedResources.length ? 'Nenhum recurso corresponde à pesquisa.' : 'Nenhum recurso deste tipo disponível.'}</p>}{matchingResources.length > visibleResources.length && <p className="px-2 py-1 text-[10px] text-muted-foreground">Mostrando 48 de {matchingResources.length}; refine a pesquisa para encontrar outros.</p>}</div><div className="mt-3 space-y-1.5">{draft.attachments.map((attachment, index) => { const resource = resources.find(item => item.id === attachment.resourceId && item.kind === attachment.kind); return <div key={`${attachment.kind}-${attachment.resourceId}-${index}`} className="flex items-center gap-2"><div className="min-w-0 flex-1"><ResourcePreview resource={resource} missingLabel={`${kindLabels[attachment.kind]} · ${attachment.resourceId}`} /></div><button type="button" onClick={() => patchDraft({ attachments: draft.attachments.filter((_, i) => i !== index) })} aria-label="Remover recurso" className="rounded p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><X size={14} /></button></div>; })}</div></section>
                     <section className="rounded-xl border border-border bg-card/70 p-4"><h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-foreground"><Link2 size={14} className="text-primary" />Ligações entre anotações</h3><div className="mb-2 flex gap-2"><label className="relative min-w-0 flex-1"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={linkQuery} onChange={event => { setLinkQuery(event.target.value); setLinkId(''); }} placeholder="Buscar nota para vincular" aria-label="Buscar anotação para vincular" className={`${inputClass} pl-9`} /></label><button type="button" onClick={addLink} disabled={!linkId} className={buttonClass}><Plus size={13} />Vincular</button></div><div className="max-h-40 space-y-1 overflow-y-auto">{matchingLinks.map(note => <button key={note.id} type="button" onClick={() => setLinkId(note.id)} className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${linkId === note.id ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40'}`}><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: note.color || palette[0] }} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-foreground">{note.title || 'Sem título'}</span>{note.caption && <span className="block truncate text-[10px] text-muted-foreground">{note.caption}</span>}</span>{linkId === note.id && <Check size={13} className="text-primary" />}</button>)}{!matchingLinks.length && <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">{notes.length < 2 ? 'Crie outra anotação para vinculá-la.' : 'Nenhuma anotação corresponde à pesquisa.'}</p>}</div><div className="mt-3 flex flex-wrap gap-1.5">{draft.linkedNoteIds.map(id => { const linked = notes.find(note => note.id === id); return <button key={id} type="button" onClick={() => patchDraft({ linkedNoteIds: draft.linkedNoteIds.filter(value => value !== id) })} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1.5 text-[10px] font-semibold text-secondary-foreground">{linked?.title || `Anotação indisponível · ${id}`}<X size={11} /></button>; })}{!draft.linkedNoteIds.length && <p className="text-[11px] text-muted-foreground">Ligações mostram as pistas em conjunto.</p>}</div></section>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-5xl">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0"><p className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.18em] text-[#849087]"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: active.color || palette[0] }} />{active.kind === 'market' ? 'Modelo de mercado' : 'Anotação de campanha'}<span className="text-[#c2c7bb]">/</span>{new Date(active.updatedAt || active.createdAt).toLocaleDateString('pt-BR')}</p><h1 className="break-words font-display text-3xl font-semibold tracking-[-.035em] text-[#34463e] md:text-4xl">{active.title || 'Sem título'}</h1>{active.caption && <p className="mt-2 font-display text-base italic text-[#7d8a7f]">{active.caption}</p>}</div>
                  <div className="flex gap-2"><button type="button" onClick={() => beginEdit(active)} className={buttonClass}><Pencil size={14} />Editar</button><button type="button" onClick={() => deleteNote(active)} className={`${buttonClass} text-[#9a665d] hover:border-[#d9b7aa] hover:bg-[#fbefeb]`} aria-label="Excluir anotação"><Trash2 size={14} />Excluir</button></div>
                </div>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="min-w-0 space-y-5">
                    <article className="rounded-2xl border border-[#e3ded2] bg-[#fbfaf5] p-5 md:p-7"><p className="whitespace-pre-wrap text-sm leading-[1.85] text-[#56665c]">{active.description || 'Esta anotação ainda não tem descrição.'}</p>{(active.imageUrls || []).length > 0 && <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{active.imageUrls.map(url => <a key={url} href={cleanHttps(url) || undefined} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-[#e2ddd2] bg-[#f0eee6]"><img src={cleanHttps(url)} alt="" loading="lazy" className="h-32 w-full object-cover transition duration-200 hover:scale-[1.025]" /></a>)}</div>}{(active.tags || []).length > 0 && <div className="mt-5 flex flex-wrap gap-1.5">{active.tags.map(tag => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#eaf0e7] px-2.5 py-1 text-[10px] font-semibold text-[#617865]"><Tag size={10} />{tag}</span>)}</div>}</article>
                    {active.kind === 'market' && <section className="rounded-2xl border border-[#e6deca] bg-[#faf6e9] p-5"><div className="mb-3 flex items-center gap-2"><ShoppingBag size={16} className="text-[#967849]" /><h3 className="font-display text-lg font-semibold">Produtos do modelo</h3></div><div className="divide-y divide-[#e8e0d0]">{(active.marketItems || []).map(item => <div key={item.id} className="flex items-start justify-between gap-4 py-3"><div><p className="text-sm font-bold text-[#4b594e]">{item.name || 'Produto sem nome'}</p>{item.description && <p className="mt-1 text-xs leading-relaxed text-[#7f8879]">{item.description}</p>}</div><span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 font-mono text-[11px] text-[#8b7245]">{item.price} ₱</span></div>)}</div></section>}
                    <section className="rounded-2xl border border-[#e3ded2] bg-[#fbfaf5] p-5"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-display text-lg font-semibold">Onde aparece</h3><p className="mt-0.5 text-[11px] text-[#89938a]">Anexe esta nota a um episódio ou cena.</p></div><MapPin size={16} className="text-[#82917f]" /></div><div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"><select value={episodeId} onChange={event => { setEpisodeId(event.target.value); setSceneId(''); }} className={`${inputClass} py-1.5 text-xs`}><option value="">Escolher episódio</option>{episodes.map(ep => <option key={ep.id} value={ep.id}>{ep.title}</option>)}</select><select value={sceneId} onChange={event => setSceneId(event.target.value)} disabled={!episodeId} className={`${inputClass} py-1.5 text-xs`}><option value="">Escolher cena</option>{scenesForEpisode.map(scene => <option key={scene.id} value={scene.id}>{scene.title}</option>)}</select><button type="button" onClick={() => attachToEpisode(active)} disabled={!episodeId || !!episodes.find(ep => ep.id === episodeId)?.noteIds?.includes(active.id)} className={buttonClass}><Plus size={13} />Episódio</button><button type="button" onClick={() => attachToScene(active)} disabled={!selectedScene || !!selectedScene.noteIds?.includes(active.id)} className={buttonClass}><Plus size={13} />Cena</button></div><div className="mt-3 space-y-2">{episodes.filter(ep => ep.noteIds?.includes(active.id)).map(ep => <div key={`episode-${ep.id}`} className="flex items-center gap-2 rounded-xl border border-[#e5dfd2] bg-[#f9f8f2] px-3 py-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8eee5] text-[#73866f]"><BookOpen size={14} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#526258]">{ep.title || 'Episódio sem título'}</strong><small className="text-[10px] text-[#8b958c]">Episódio</small></span><button type="button" onClick={() => removeFromEpisode(active.id, ep.id)} className="rounded p-1.5 text-[#8c9890] hover:bg-[#f4e9e5] hover:text-[#9b6459]" aria-label="Remover do episódio"><X size={14} /></button></div>)}{episodes.flatMap(ep => (ep.scenes || []).filter(scene => scene.noteIds?.includes(active.id)).map(scene => <div key={`${ep.id}-${scene.id}`} className="flex items-center gap-2 rounded-xl border border-[#e5dfd2] bg-[#f9f8f2] px-3 py-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8eee5] text-[#73866f]"><MapPin size={14} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#526258]">{scene.title || 'Cena sem título'}</strong><small className="text-[10px] text-[#8b958c]">{ep.title || 'Episódio sem título'}</small></span><button type="button" onClick={() => removeFromScene(active.id, ep.id, scene.id)} className="rounded p-1.5 text-[#8c9890] hover:bg-[#f4e9e5] hover:text-[#9b6459]" aria-label="Remover da cena"><X size={14} /></button></div>))}</div>{!episodes.some(ep => ep.noteIds?.includes(active.id) || (ep.scenes || []).some(scene => scene.noteIds?.includes(active.id))) && <p className="mt-3 text-center text-[11px] text-[#929a91]">Ainda não está ligada a nenhum episódio ou cena.</p>}</section>
                    {active.kind === 'market' && <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e6deca] bg-[#faf6e9] p-4"><div className="mr-auto"><p className="text-xs font-bold text-[#62563e]">Aplicar este mercado</p><p className="text-[10px] text-[#97896e]">Escolha onde copiar os produtos.</p></div><select value={templateScene} onChange={event => setTemplateScene(event.target.value)} className={`${inputClass} max-w-xs py-1.5 text-xs`}><option value="">Escolher cena de destino</option>{episodes.flatMap(ep => ep.scenes.map(scene => <option key={`${ep.id}::${scene.id}`} value={`${ep.id}::${scene.id}`}>{ep.title} · {scene.title}</option>))}</select><button type="button" onClick={() => applyMarket(active)} disabled={!templateScene || !active.marketItems?.length} className="rounded-lg bg-[#766440] px-3 py-2 text-xs font-bold text-[#fff9e8] transition hover:bg-[#625337] disabled:opacity-45">Aplicar ao local</button></section>}
                  </div>
                  <aside className="space-y-5">
                    <section className="rounded-2xl border border-[#e3ded2] bg-[#fbfaf5] p-4"><h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold"><Package size={15} className="text-[#82917f]" />Recursos relacionados</h3><div className="space-y-2">{(active.attachments || []).map((attachment, index) => <ResourcePreview key={`${attachment.kind}-${attachment.resourceId}-${index}`} resource={resources.find(item => item.id === attachment.resourceId && item.kind === attachment.kind)} missingLabel={`${kindLabels[attachment.kind] || attachment.kind} · ${attachment.resourceId}`} />)}{!(active.attachments || []).length && <p className="rounded-lg border border-dashed border-[#dce0d6] px-3 py-4 text-center text-[11px] text-[#929b92]">Nenhum recurso anexado.</p>}</div></section>
                    <section className="rounded-2xl border border-[#e3ded2] bg-[#fbfaf5] p-4"><h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold"><Link2 size={15} className="text-[#82917f]" />Anotações ligadas <span className="ml-auto font-mono text-[10px] text-[#8f9a90]">{panels.length}</span></h3><div className="space-y-2">{(active.linkedNoteIds || []).map(id => { const linked = notes.find(note => note.id === id); return <button key={id} type="button" onClick={() => linked && setActiveId(linked.id)} className="flex w-full items-center gap-2 rounded-lg border border-[#e5e2d8] bg-[#f7f7f0] px-2.5 py-2 text-left hover:border-[#aab9a4]"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: linked?.color || '#a7b1a5' }} /><span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#607166]">{linked?.title || `Anotação indisponível · ${id}`}</span><ChevronRight size={13} className="text-[#9aa49a]" /></button>; })}{!(active.linkedNoteIds || []).length && <p className="rounded-lg border border-dashed border-[#dce0d6] px-3 py-4 text-center text-[11px] text-[#929b92]">Ainda sem ligações.</p>}</div></section>
                  </aside>
                </div>
                {panels.length > 1 && <section className="mt-6"><div className="mb-3 flex items-end justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[.17em] text-[#849087]">Percurso de pistas</p><h2 className="font-display text-xl font-semibold">Painéis ligados</h2></div><span className="text-[10px] text-[#89948c]">A navegação evita ciclos</span></div><div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{panels.slice(1).map((note, index) => <article key={note.id} className="rounded-2xl border border-[#e2ddd2] bg-[#fbfaf5] p-4 animate-[rise-in_.25s_ease-out_both]" style={{ animationDelay: `${Math.min(index * 35, 240)}ms` }}><div className="mb-2 flex items-start justify-between gap-2"><button type="button" onClick={() => setActiveId(note.id)} className="min-w-0 text-left"><span className="mb-1 block font-mono text-[8px] uppercase tracking-[.15em] text-[#96a097]">Entrada relacionada</span><strong className="block truncate font-display text-lg text-[#405249]">{note.title || 'Sem título'}</strong></button><button type="button" onClick={() => beginEdit(note)} aria-label={`Editar ${note.title}`} className="rounded-md p-1.5 text-[#7c8a7f] hover:bg-[#edf1e9]"><Pencil size={13} /></button></div><p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-[#748178]">{note.caption || note.description || 'Sem descrição.'}</p><div className="mt-3 flex flex-wrap gap-1">{(note.tags || []).slice(0, 4).map(tag => <span key={tag} className="rounded-full bg-[#edf1e9] px-2 py-0.5 text-[9px] text-[#718273]">{tag}</span>)}</div><div className="mt-3 border-t border-[#e8e4da] pt-3">{(note.attachments || []).slice(0, 2).map(item => <div key={`${item.kind}-${item.resourceId}`} className="mb-1.5"><ResourcePreview resource={resources.find(resource => resource.id === item.resourceId && resource.kind === item.kind)} missingLabel={`${kindLabels[item.kind]} · ${item.resourceId}`} /></div>)}<span className="text-[9px] text-[#9aa39a]">{(note.linkedNoteIds || []).length} ligações seguintes</span></div></article>)}</div></section>}
              </div>
            )}
        </main>
      </div>
    </section>
  );
}
