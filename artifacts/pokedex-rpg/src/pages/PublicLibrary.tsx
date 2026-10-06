import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, BookOpen, Check, CircleDot, Filter, Pencil, Search, Sparkles, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCampaignNotes, useSessionRole } from '../lib/campaign';
import { usePokemonData } from '../lib/hooks';
import { RichText } from '@/components/RichText';
import type { PokemonType } from '../lib/types';
import { POKEMON_SORT_OPTIONS, sortPokemon, type PokemonSortOrder } from '../lib/pokemonSorting';

const TYPE_PALETTES: Record<PokemonType, { accent: string; panel: string }> = {
  Normal: { accent: '#b7bec8', panel: '#343d4b' },
  Fogo: { accent: '#ff805e', panel: '#512a26' },
  Água: { accent: '#65c3ff', panel: '#173e60' },
  Planta: { accent: '#83d887', panel: '#1f432f' },
  Elétrico: { accent: '#ffdc65', panel: '#4e411c' },
  Gelo: { accent: '#9ceafa', panel: '#254955' },
  Lutador: { accent: '#f08a65', panel: '#512b25' },
  Veneno: { accent: '#ce8ae8', panel: '#412849' },
  Terra: { accent: '#e0bf7b', panel: '#4d4028' },
  Voador: { accent: '#aab8ff', panel: '#303b58' },
  Psíquico: { accent: '#e58af2', panel: '#46284e' },
  Inseto: { accent: '#bedb65', panel: '#384322' },
  Pedra: { accent: '#d2b98b', panel: '#49402f' },
  Fantasma: { accent: '#ad9bed', panel: '#342c50' },
  Dragão: { accent: '#9ba8ff', panel: '#2b3456' },
  Sombrio: { accent: '#a0a7b6', panel: '#292e3a' },
  Metálico: { accent: '#b5ccd8', panel: '#33434a' },
  Fada: { accent: '#f1a8d4', panel: '#51334c' },
};

function paletteForType(type?: PokemonType) {
  return TYPE_PALETTES[type || 'Normal'];
}

function pokemonPanelBackground(types?: PokemonType[]) {
  const primary = paletteForType(types?.[0]);
  const secondaryType = types?.[1];
  if (!secondaryType) {
    return `radial-gradient(circle at 72% 38%, ${primary.accent}55 0%, transparent 42%), linear-gradient(145deg, ${primary.panel} 15%, #111827 100%)`;
  }
  const secondary = paletteForType(secondaryType);
  return `radial-gradient(circle at 72% 38%, ${primary.accent}55 0%, transparent 42%), linear-gradient(135deg, ${primary.panel} 0%, ${primary.panel} 50%, ${secondary.panel} 50%, ${secondary.panel} 100%)`;
}

export default function PublicLibrary() {
  const { pokemon } = usePokemonData();
  const { notes, saveNote, removeNote } = useCampaignNotes();
  const { role } = useSessionRole();
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<PokemonSortOrder>('arrival-newest');
  const [selectedPokemonId, setSelectedPokemonId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(true);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [editingNote, setEditingNote] = useState<{ id: string; title: string; body: string } | null>(null);
  const saveEditedNote = () => {
    if (!editingNote || !editingNote.title.trim()) return;
    saveNote({ id: editingNote.id, title: editingNote.title.trim(), body: editingNote.body });
    setEditingNote(null);
  };
  const selectedPokemon = pokemon.find(item => item.id === selectedPokemonId) || null;
  const searchTerm = search.trim().toLowerCase();
  const filtered = useMemo(() => pokemon
    .filter(item => item.inDex)
    .filter(item => `${item.name} ${item.species} ${item.trainerName} ${item.types.join(' ')} ${item.pokedexDescription}`.toLowerCase().includes(searchTerm)), [pokemon, searchTerm]);
  const sortedPokemon = useMemo(() => sortPokemon(filtered, sortOrder), [filtered, sortOrder]);
  const publicNotes = notes.filter(note => note.public);
  const selectedPalette = paletteForType(selectedPokemon?.types[0]);
  const addPlayerNote = () => {
    if (!noteTitle.trim() || !noteBody.trim()) return;
    saveNote({ title: noteTitle, body: noteBody, tag: 'jogador', public: true });
    setNoteTitle('');
    setNoteBody('');
  };
  return (
    <div className="rpg-shell min-h-[calc(100dvh-72px)] px-4 py-6 sm:px-6 md:py-9">
      <div className="mx-auto max-w-7xl">
        <header className="relative mb-7 overflow-hidden rounded-2xl border border-border bg-card/85 p-5 shadow-xl shadow-black/10 sm:p-7">
          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="eyebrow mb-2 text-primary">Arquivo compartilhado · Porto Salitre</p>
              <h1 className="font-display text-4xl tracking-tight md:text-5xl">Arquivo</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">Pokédex e registros compartilhados pela mesa.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? 'criatura' : 'criaturas'}
              </span>
              <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary" data-testid="link-back-access">Voltar ao acesso <ArrowUpRight size={15} /></Link>
            </div>
          </div>
        </header>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
            <Input value={search} onChange={e => setSearch(e.target.value)} className="h-12 rounded-xl border-border/80 bg-card/80 pl-10 shadow-sm" placeholder="Buscar criatura, tipo ou treinador..." data-testid="input-public-search" />
          </div>
          <select
            value={sortOrder}
            onChange={event => setSortOrder(event.target.value as PokemonSortOrder)}
            aria-label="Ordenar Arquivo"
            className="h-12 w-full rounded-xl border border-border/80 bg-card/80 px-3 text-sm shadow-sm sm:w-56"
            data-testid="select-public-pokemon-sort"
          >
            {POKEMON_SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <Button variant={showNotes ? 'default' : 'outline'} className="h-12 rounded-xl px-4 shadow-sm" onClick={() => setShowNotes(!showNotes)} data-testid="button-toggle-public-notes">
            <Filter size={16} /> {showNotes ? 'Ocultar anotações' : 'Mostrar anotações'}
            <span className="ml-1 rounded-full bg-background/20 px-2 py-0.5 text-xs">{publicNotes.length}</span>
          </Button>
        </div>
        <div className={`grid items-start gap-6 ${showNotes ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,.75fr)]' : ''}`}>
          <section aria-label="Pokédex pública">
            <div className={`grid gap-5 ${showNotes ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
              {sortedPokemon.map(item => {
                const primaryType = item.types[0] || 'Normal';
                const palette = paletteForType(primaryType);
                return (
                  <Card
                    key={item.id}
                    data-testid={`card-pokemon-${item.id}`}
                    className="paper-panel group overflow-hidden rounded-2xl border shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                    style={{
                      borderColor: `${palette.accent}55`,
                      background: `linear-gradient(180deg, ${palette.accent}12 0%, hsl(var(--card)) 38%)`,
                    }}
                  >
                  <div
                    className="relative flex h-52 items-center justify-center overflow-hidden px-5 sm:h-56"
                    style={{
                      backgroundColor: palette.panel,
                       backgroundImage: pokemonPanelBackground(item.types),
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: `linear-gradient(135deg, transparent 48%, ${palette.accent} 49%, transparent 50%)`, backgroundSize: '34px 34px' }} />
                    {item.image
                      ? <img src={item.image} alt={item.name} className="relative z-10 h-full w-full object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105" />
                      : <div className="relative z-10 grid h-20 w-20 place-items-center rounded-full border border-white/20 bg-white/10 text-white/70 backdrop-blur-sm"><CircleDot size={36} /></div>}
                    <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80 backdrop-blur-sm">{primaryType}</span>
                    <span className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 font-mono text-xs font-bold text-white backdrop-blur-sm">LV {item.level}</span>
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-2xl leading-tight"><RichText text={item.name || 'Pokémon sem nome'} /></h2>
                        <p className="mt-1 text-sm text-muted-foreground"><i><RichText text={item.species || 'Espécie não registrada'} /></i></p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        {item.types.slice(1).map(type => <Badge key={type} variant="outline" className="border-border/80 bg-background/60 text-[10px]">{type}</Badge>)}
                      </div>
                    </div>
                    <p className="mt-4 min-h-[4.25rem] line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {item.pokedexDescription || 'Ainda não há registro público para esta criatura.'}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4 h-10 w-full rounded-lg border border-border/70 bg-background/60 font-semibold transition-colors hover:border-primary/50 hover:bg-primary/10"
                      onClick={() => setSelectedPokemonId(item.id)}
                      data-testid={`button-pokemon-dex-info-${item.id}`}
                    >
                      <BookOpen size={15} /> Ver descrição completa
                    </Button>
                    <Link href={`/sheet?id=${item.id}`} className="mt-3 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10" data-testid={`link-public-pokemon-${item.id}`}>
                      Abrir ficha <ArrowUpRight size={15} />
                    </Link>
                  </CardContent>
                  </Card>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center shadow-inner">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Sparkles size={25} /></div>
                <p className="font-display text-xl">{search ? 'Nenhuma criatura encontrada' : 'A Pokédex ainda está vazia'}</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{search ? 'Tente buscar por outro nome, espécie ou tipo.' : 'Quando o GM compartilhar Pokémon, eles aparecerão aqui.'}</p>
              </div>
            )}
          </section>
          {showNotes && (
            <aside className="lg:sticky lg:top-24" aria-label="Anotações da mesa">
              <Card className="paper-panel overflow-hidden rounded-2xl border-border/80 shadow-lg shadow-black/10">
                <CardHeader className="border-b border-border/70 bg-card/70 pb-4">
                  <CardTitle className="flex items-center justify-between gap-3 text-lg">
                    <span className="flex items-center gap-2"><BookOpen className="text-primary" size={19} /> Anotações da mesa</span>
                    <Badge variant="outline" className="rounded-full">{publicNotes.length}</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Informações compartilhadas com todos os jogadores.</p>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div className="max-h-[min(42vh,420px)] space-y-3 overflow-y-auto pr-1">
                    {publicNotes.map(note => (
                      <article key={note.id} className="rounded-xl border border-border/70 bg-background/50 p-3.5 transition-colors hover:border-primary/30" data-testid={`note-public-${note.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="rounded-full text-[10px]">{note.tag}</Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{note.updatedAt}</span>
                            {role === 'gm' && <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" aria-label={`Editar anotação ${note.title}`} title="Editar anotação" onClick={() => setEditingNote({ id: note.id, title: note.title, body: note.body })} data-testid={`button-edit-note-${note.id}`}><Pencil size={14} /></Button>}
                            {role === 'gm' && <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label={`Excluir anotação ${note.title}`} title="Excluir anotação" onClick={() => { if (window.confirm(`Excluir a anotação “${note.title}”?`)) removeNote(note.id); }}><Trash2 size={14} /></Button>}
                          </div>
                        </div>
                        {editingNote?.id === note.id ? (
                          <div className="mt-2 space-y-2">
                            <Input value={editingNote.title} onChange={e => setEditingNote({ ...editingNote, title: e.target.value })} aria-label="Título da anotação" data-testid={`input-edit-note-title-${note.id}`} />
                            <Textarea value={editingNote.body} onChange={e => setEditingNote({ ...editingNote, body: e.target.value })} className="min-h-24" aria-label="Texto da anotação" data-testid={`input-edit-note-body-${note.id}`} />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}><X size={14} /> Cancelar</Button>
                              <Button size="sm" onClick={saveEditedNote} disabled={!editingNote.title.trim()} data-testid={`button-save-note-${note.id}`}><Check size={14} /> Salvar</Button>
                            </div>
                          </div>
                        ) : <>
                          <h3 className="mt-2 font-display text-lg leading-snug"><RichText text={note.title} /></h3>
                          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground"><RichText text={note.body} /></p>
                        </>}
                      </article>
                    ))}
                    {publicNotes.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Ainda não há anotações compartilhadas.</p>}
                  </div>
                  <div className="space-y-2 border-t border-border/70 pt-4">
                    <p className="text-sm font-semibold">Adicionar anotação</p>
                    <Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Título" aria-label="Título da anotação" data-testid="input-public-note-title" />
                    <Textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="Algo que todos podem saber..." aria-label="Texto da anotação" data-testid="input-public-note-body" />
                    <Button size="sm" className="w-full rounded-lg" onClick={addPlayerNote} disabled={!noteTitle.trim() || !noteBody.trim()} data-testid="button-publish-public-note">Publicar anotação</Button>
                  </div>
                </CardContent>
              </Card>
            </aside>
          )}
        </div>
      </div>
        <Dialog open={!!selectedPokemon} onOpenChange={open => { if (!open) setSelectedPokemonId(null); }}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            {selectedPokemon && <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">{selectedPokemon.name || 'Pokémon sem nome'}</DialogTitle>
                <DialogDescription>
                  Registro completo da Pokédex · {selectedPokemon.species || 'espécie não registrada'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                <div
                  className="flex min-h-36 items-center justify-center overflow-hidden rounded-lg p-3"
                  style={{
                    backgroundColor: selectedPalette.panel,
                    backgroundImage: pokemonPanelBackground(selectedPokemon.types),
                  }}
                >
                  {selectedPokemon.image
                    ? <img src={selectedPokemon.image} alt={selectedPokemon.name} className="max-h-48 max-w-full object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.45)]" />
                    : <CircleDot size={40} className="text-white/60" />}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Tipo</dt><dd className="mt-1 flex flex-wrap gap-1">{selectedPokemon.types.map(type => <Badge key={type} variant="outline">{type}</Badge>)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Nível</dt><dd className="mt-1 font-mono">LV {selectedPokemon.level}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Gênero</dt><dd className="mt-1">{selectedPokemon.gender}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Taxa de captura</dt><dd className="mt-1">{selectedPokemon.catchRate}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-muted-foreground">Habilidade</dt><dd className="mt-1 font-semibold">{selectedPokemon.ability || 'Não registrada'}</dd>{selectedPokemon.abilityDescription && <dd className="mt-1 text-muted-foreground">{selectedPokemon.abilityDescription}</dd>}</div>
                </dl>
              </div>
              <section className="space-y-2 border-t border-border pt-4">
                <h3 className="font-semibold">Estatísticas base</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    ['HP', selectedPokemon.stats.hp.base],
                    ['ATK', selectedPokemon.stats.atk.base],
                    ['DEF', selectedPokemon.stats.def.base],
                    ['Sp. Atk', selectedPokemon.stats.spAtk.base],
                    ['Sp. Def', selectedPokemon.stats.spDef.base],
                    ['Velocidade', selectedPokemon.stats.spe.base],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-border bg-secondary/20 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="font-mono font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="space-y-2 border-t border-border pt-4">
                <h3 className="font-semibold">Descrição completa</h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                  {selectedPokemon.pokedexDescription || 'Ainda não há registro público para esta criatura.'}
                </p>
              </section>
            </>}
          </DialogContent>
        </Dialog>
    </div>
  );
}