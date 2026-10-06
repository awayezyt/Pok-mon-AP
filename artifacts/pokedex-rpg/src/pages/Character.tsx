import { useState, type ReactNode, type CSSProperties } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Backpack, BookOpen, Check, ChevronDown, ChevronLeft, CircleDot, Crosshair, Edit3,
  HeartPulse, ImagePlus, Minus, PackageOpen, Pin, Plus, ScrollText, Search, Sparkles, Swords, Target, Trash2, UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichText } from '@/components/RichText';
import {
  CHARACTER_CLASSES, CHARACTER_ATTRIBUTE_LABELS, CHARACTER_THEME_COLORS, FLOW_TEMPLATE, SKILL_NAMES, getCharacterThemeColor, getSkillCap,
  useCharacterSheets, useSessionRole, type CharacterAttribute, type CharacterSheet, type TrainerRecord,
  type FlowStep, type InventoryItem,
} from '../lib/campaign';
import { usePokemonData } from '../lib/hooks';
import { getServerCollection } from '../lib/cloudSync';
import { getCharacterPokemonRoster, getPokemonAssignmentConflict, normalizeTrainerName, syncPokemonTrainerRecord } from '../lib/pokemonOwnership';
import { toast } from 'sonner';
import { useAppTheme } from '../lib/theme';

const tabs = ['Visão geral', 'Perícias', 'Inventário', 'Habilidades', 'Fluxo', 'Pokémon'];
const itemCategories = ['Consumíveis', 'Itens Chave', 'Especiais', 'Alimentos', 'TM', 'Pokebolas', 'Batalha'];

export default function Character() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const requestedId = searchParams.get('id');
  const requestedTab = searchParams.get('tab') || '';
  const requestedPokemonTab = searchParams.get('pokemonTab');
  const { characters, updateCharacter } = useCharacterSheets();
  const { pokemon, updatePokemon } = usePokemonData();
  const { role, activeCharacterId } = useSessionRole();
  const id = requestedId || (role === 'player' ? activeCharacterId : null) || 'character-lyra';
  const trainerRecords = getServerCollection<TrainerRecord[]>('trainers', []);
  const character = characters.find(item => item.id === id) || characters[0];
  const [tab, setTab] = useState(() => tabs.includes(requestedTab) ? requestedTab : 'Visão geral');
  const [pokemonTab, setPokemonTab] = useState<'party' | 'pc'>(() => requestedPokemonTab === 'pc' ? 'pc' : 'party');
  const [editingAttributes, setEditingAttributes] = useState(false);
  const [editingSkills, setEditingSkills] = useState(false);
  const [editingLevel, setEditingLevel] = useState(false);
  const [portraitPreviewOpen, setPortraitPreviewOpen] = useState(false);
  const { theme: siteTheme } = useAppTheme();

  if (!character) return <div className="p-8">Nenhuma ficha disponível.</div>;
  if (role === 'player' && activeCharacterId !== character.id) {
    return <div className="rpg-shell min-h-[calc(100dvh-72px)] p-8"><Card className="mx-auto max-w-lg text-center"><CardHeader><CardTitle>Acesso restrito</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Esta ficha pertence a outro jogador.</p><Button className="mt-4" onClick={() => setLocation('/')}>Voltar</Button></CardContent></Card></div>;
  }

  const isOwner = role === 'gm' || activeCharacterId === character.id;
  const patch = (data: Partial<CharacterSheet>) => updateCharacter(character.id, data);
  const handleCharacterImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Escolha um arquivo de imagem.');
      return;
    }
    const reader = new FileReader();
    reader.onload = loadEvent => {
      if (typeof loadEvent.target?.result === 'string') patch({ image: loadEvent.target.result });
    };
    reader.readAsDataURL(file);
  };
  const adjust = (field: 'hp' | 'focus', amount: number) => patch({ [field]: Math.max(0, Math.min(field === 'hp' ? character.hpMax : character.focusMax, character[field] + amount)) });
  const characterRoster = getCharacterPokemonRoster(character, pokemon, characters);
  const linkedPokemon = pokemon.find(item => item.id === characterRoster.partyPokemonIds[0]);
  const pinnedAbilities = character.abilities.filter(ability => ability.pinned);
  const flowBonuses = character.flow.filter(step => step.active && step.detail);
  const themeColor = getCharacterThemeColor(character.themeColor);
  const sheetPalette = themeColor === 'navy' && siteTheme === 'dark'
    ? { ...CHARACTER_THEME_COLORS[themeColor], primary: '214 88% 64%', foreground: '222 47% 11%' }
    : CHARACTER_THEME_COLORS[themeColor];

  const assignPokemon = (pokemonId: string, destination: 'party' | 'pc') => {
    if (role !== 'gm') return;
    const selectedPokemon = pokemon.find(item => item.id === pokemonId);
    if (!selectedPokemon) return;
    const conflict = getPokemonAssignmentConflict(
      selectedPokemon,
      { kind: 'character', id: character.id, name: character.name },
      characters,
      getServerCollection<TrainerRecord[]>('trainers', []),
    );
    if (conflict) {
      toast.error(`${selectedPokemon.name} já está associado a ${conflict}. Remova-o da ficha atual antes de transferi-lo.`);
      return;
    }
    const roster = getCharacterPokemonRoster(character, pokemon, characters);
    const party = roster.partyPokemonIds.filter(item => item !== pokemonId);
    const pc = roster.pcPokemonIds.filter(item => item !== pokemonId);
    if (destination === 'party' && party.length >= 6) return;
    patch({
      partyPokemonIds: destination === 'party' ? [...party, pokemonId] : party,
      pcPokemonIds: destination === 'pc' ? [...pc, pokemonId] : pc,
    });
    updatePokemon(pokemonId, { trainerName: character.name });
    syncPokemonTrainerRecord(pokemonId);
  };

  const removePokemon = (pokemonId: string) => {
    if (role !== 'gm') return;
    const selectedPokemon = pokemon.find(item => item.id === pokemonId);
    if (!selectedPokemon) return;
    const confirmed = window.confirm(
      `Remover ${selectedPokemon.name} da ficha de ${character.name}? O Pokémon continuará cadastrado na Pokédex global.`,
    );
    if (!confirmed) return;
    patch({
      partyPokemonIds: character.partyPokemonIds.filter(item => item !== pokemonId),
      pcPokemonIds: character.pcPokemonIds.filter(item => item !== pokemonId),
    });
    if (!selectedPokemon.trainerName || normalizeTrainerName(selectedPokemon.trainerName) === normalizeTrainerName(character.name)) {
      updatePokemon(pokemonId, { trainerName: '' });
      syncPokemonTrainerRecord(pokemonId);
    }
  };

  return (
    <div className="rpg-shell min-h-[calc(100dvh-72px)] p-4 md:p-8" style={{ '--primary': sheetPalette.primary, '--ring': sheetPalette.primary, '--primary-foreground': sheetPalette.foreground } as CSSProperties}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(role === 'gm' ? '/fichas' : '/personagem')} data-testid="button-back-sheets"><ChevronLeft /></Button>
            <div>
              <p className="eyebrow">Ficha: <RichText text={character.name} /></p>
              <h1 className="font-display text-3xl"><RichText text={character.name} /></h1>
              <p className="mt-1 text-sm text-muted-foreground">Jogador: <RichText text={character.player || 'Não definido'} /></p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {role === 'gm' && <Link href="/pokemon" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-primary" data-testid="link-pokemon-manager"><CircleDot size={16} /> Gerenciar Pokémon</Link>}
            {isOwner && <Button onClick={() => patch({ name: window.prompt('Nome da ficha', character.name) || character.name })} variant="outline" data-testid="button-edit-character">Editar nome da ficha</Button>}
            {role === 'gm' && <Button onClick={() => { const player = window.prompt('Nome do jogador', character.player); if (player !== null) patch({ player: player.trim() }); }} variant="outline" data-testid="button-edit-player">Editar jogador</Button>}
          </div>
        </div>

        <div className="mb-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <Card className="paper-panel overflow-hidden border-primary/20">
            <div className="bg-primary p-6 text-primary-foreground">
              <p className="eyebrow mb-2 text-primary-foreground/65">personagem</p>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><h2 className="font-display text-4xl"><RichText text={character.name} /></h2><p className="mt-1 text-primary-foreground/75"><RichText text={`${character.className} · ${character.path}`} /></p></div>
                <div className="flex items-center gap-2">
                  {role === 'gm' && editingLevel ? <Input className="w-20 bg-primary-foreground text-foreground" type="number" min={1} value={character.level} onChange={event => patch({ level: Math.max(1, Number(event.target.value) || 1) })} /> : <Badge className="bg-accent text-accent-foreground hover:bg-accent">Nível {character.level}</Badge>}
                  {role === 'gm' && <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/15" onClick={() => setEditingLevel(value => !value)}>{editingLevel ? <Check size={15} /> : <Edit3 size={15} />}</Button>}
                </div>
              </div>
            </div>
            <CardContent className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="CLASSE"><select disabled={!isOwner} value={character.className} onChange={event => patch({ className: event.target.value as typeof character.className, path: CHARACTER_CLASSES[event.target.value as keyof typeof CHARACTER_CLASSES][0] })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{Object.keys(CHARACTER_CLASSES).map(item => <option key={item}>{item}</option>)}</select></Field>
                <Field label="TRILHA"><select disabled={!isOwner} value={character.path} onChange={event => patch({ path: event.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{CHARACTER_CLASSES[character.className].map(item => <option key={item}>{item}</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Resource label="VIDA" value={character.hp} max={character.hpMax} icon={<HeartPulse size={16} />} color="text-red-700" onChange={amount => adjust('hp', amount)} />
                <Resource label="ESFORÇO" value={character.focus} max={character.focusMax} icon={<Sparkles size={16} />} color="text-primary" onChange={amount => adjust('focus', amount)} compactMobileValue />
              </div>
            </CardContent>
          </Card>

          <Card className="paper-panel">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg"><Target className="text-primary" /> Atributos</CardTitle>
              {isOwner && <Button size="sm" variant="outline" onClick={() => setEditingAttributes(value => !value)}><Edit3 size={14} className="mr-2" />{editingAttributes ? 'Concluir' : 'Editar'}</Button>}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(CHARACTER_ATTRIBUTE_LABELS) as CharacterAttribute[]).map(key => {
                  const value = character.attributes[key] || 0;
                  return <div key={key} className="rounded-2xl border border-primary/20 bg-secondary/35 p-2 text-center">
                    <div className="stat-orb mx-auto w-16 sm:w-20"><strong className="stat-orb-value">{value}</strong></div>
                    <p className="mt-2 font-mono text-sm font-bold tracking-wider text-primary">{key.toUpperCase()}</p>
                    {editingAttributes && <div className="mt-1 flex justify-center gap-1"><button onClick={() => patch({ attributes: { ...character.attributes, [key]: value - 1 } })} className="h-6 w-6 rounded border border-border bg-card">−</button><button onClick={() => patch({ attributes: { ...character.attributes, [key]: value + 1 } })} className="h-6 w-6 rounded border border-border bg-card">+</button></div>}
                  </div>;
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {flowBonuses.length > 0 && <div className="mb-5 rounded-xl border border-primary/25 bg-primary/5 p-4"><p className="eyebrow mb-2">bônus de fluxo ativos</p><div className="flex flex-wrap gap-2">{flowBonuses.map(step => <Badge key={step.level} variant="outline">Nível {step.level}: <RichText text={step.detail} replaceTypeNames /></Badge>)}</div></div>}

        <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">{tabs.map(item => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === item ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} data-testid={`tab-${item.toLowerCase().replace(' ', '-')}`}>{item}</button>)}</div>

        {tab === 'Visão geral' && <div className="grid gap-5 md:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen size={18} className="text-primary" /> Anotações</CardTitle></CardHeader><CardContent><Textarea value={character.notes} onChange={event => patch({ notes: event.target.value })} disabled={!isOwner} className="min-h-32" placeholder="Anotações da personagem, pistas e observações..." data-testid="textarea-character-notes" />{character.notes.trim() && <div className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-secondary/20 p-3 text-sm"><RichText text={character.notes} /></div>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles size={18} className="text-primary" /> Habilidades fixadas</CardTitle></CardHeader><CardContent>{pinnedAbilities.length ? <div className="space-y-2">{pinnedAbilities.map(ability => <div key={ability.name} className="rounded-lg border border-primary/25 bg-primary/5 p-3"><p className="font-semibold"><RichText text={ability.name} replaceTypeNames /></p><p className="text-sm text-muted-foreground"><RichText text={ability.detail} replaceTypeNames /></p></div>)}</div> : <p className="text-sm text-muted-foreground">Fixe habilidades na aba Habilidades para deixá-las sempre visíveis aqui.</p>}</CardContent></Card>
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2"><CircleDot size={18} className="text-primary" /> Companheiro Pokémon</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  {linkedPokemon ? <>
                    <div className="min-w-0"><p className="font-display text-2xl"><RichText text={linkedPokemon.name} /></p><p className="text-sm text-muted-foreground">Nível {linkedPokemon.level} · {linkedPokemon.types.join(' / ')}</p></div>
                    <Link href={`/sheet?${new URLSearchParams({ id: linkedPokemon.id, returnCharacterId: character.id, returnPokemonTab: pokemonTab }).toString()}`} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"><Swords size={15} /> Abrir ficha</Link>
                  </> : <p className="text-sm text-muted-foreground">Nenhum parceiro vinculado. Escolha um na aba Pokémon.</p>}
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-1 text-xs font-semibold"><ImagePlus size={14} /> Imagem do personagem</p>
                  <button
                    type="button"
                    onClick={() => character.image && setPortraitPreviewOpen(true)}
                    disabled={!character.image}
                    className="flex h-52 w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/40 text-primary disabled:cursor-default"
                    aria-label={character.image ? `Ampliar imagem de ${character.name}` : 'Nenhuma imagem anexada'}
                    data-testid="button-character-image-preview"
                  >
                    {character.image
                      ? <img src={character.image} alt={`Retrato de ${character.name}`} className="h-full w-full object-contain" />
                      : <div className="flex flex-col items-center gap-2 text-muted-foreground"><UserRound size={34} /><span className="text-xs">Nenhuma imagem anexada</span></div>}
                  </button>
                  {isOwner && <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="input-character-image" className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-primary">
                      <ImagePlus size={15} /> {character.image ? 'Trocar imagem' : 'Anexar imagem'}
                    </label>
                    <input id="input-character-image" data-testid="input-character-image" type="file" accept="image/*" className="sr-only" onChange={handleCharacterImageUpload} />
                    {character.image && <Button type="button" size="sm" variant="ghost" onClick={() => patch({ image: '' })}>Remover</Button>}
                  </div>}
                  <p className="text-[11px] text-muted-foreground">Selecione um arquivo de imagem. Clique na prévia para ampliar.</p>
                </div>
              </div>
              <Dialog open={portraitPreviewOpen} onOpenChange={setPortraitPreviewOpen}>
                <DialogContent className="max-h-[95vh] max-w-6xl overflow-hidden p-3">
                  <DialogHeader><DialogTitle>Imagem de {character.name}</DialogTitle><DialogDescription>Prévia ampliada do retrato da ficha.</DialogDescription></DialogHeader>
                  {character.image && <img src={character.image} alt={`Imagem ampliada de ${character.name}`} className="mx-auto max-h-[78vh] max-w-full rounded-lg object-contain" />}
                  {isOwner && <label htmlFor="input-character-image-fullscreen" className="mx-auto inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-primary">
                    <ImagePlus size={15} /> Trocar imagem
                    <input id="input-character-image-fullscreen" type="file" accept="image/*" className="sr-only" onChange={event => { handleCharacterImageUpload(event); setPortraitPreviewOpen(false); }} />
                  </label>}
                </DialogContent>
              </Dialog>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-sm font-semibold">Cor da ficha</p>
                <select disabled={!isOwner} aria-label="Cor da ficha" value={themeColor} onChange={event => patch({ themeColor: event.target.value as CharacterSheet['themeColor'] })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{Object.entries(CHARACTER_THEME_COLORS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
              </div>
            </CardContent>
          </Card>
        </div>}

        {tab === 'Perícias' && <SkillsEditor character={character} editable={editingSkills} onToggle={() => setEditingSkills(value => !value)} onChange={skills => patch({ skills })} isOwner={isOwner} />}
        {tab === 'Inventário' && <InventoryEditor items={character.inventory} capacity={Math.max(0, (character.attributes.for || 0) * 5)} money={character.money} onChange={inventory => patch({ inventory })} onMoneyChange={money => patch({ money })} isOwner={isOwner} />}
        {tab === 'Habilidades' && <AbilitiesEditor abilities={character.abilities} onChange={abilities => patch({ abilities })} isOwner={isOwner} />}
        {tab === 'Fluxo' && <FlowEditor flow={character.flow} onChange={flow => patch({ flow })} editable={isOwner} />}
        {tab === 'Pokémon' && <PokemonRoster character={character} characters={characters} trainers={trainerRecords} pokemon={pokemon} activeTab={pokemonTab} setActiveTab={setPokemonTab} assignPokemon={assignPokemon} removePokemon={removePokemon} canManagePokemon={role === 'gm'} />}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="mb-1 block text-xs font-bold text-muted-foreground">{label}</label>{children}</div>;
}

function Resource({ label, value, max, icon, color, onChange, compactMobileValue = false }: { label: string; value: number; max: number; icon: ReactNode; color: string; onChange: (amount: number) => void; compactMobileValue?: boolean }) {
  return <div className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-1 text-xs font-bold text-muted-foreground"><span className={`flex items-center gap-1 ${color}`}>{icon}{label}</span><span className={`font-mono ${compactMobileValue ? 'whitespace-nowrap' : ''}`}>{compactMobileValue ? <><span className="hidden sm:inline">{value} / {max}</span><span className="sm:hidden">{value}/{max}</span></> : `${value} / ${max}`}</span></div><div className="mt-2 h-2 rounded-full bg-secondary"><div className={`h-2 rounded-full ${color === 'text-primary' ? 'bg-primary' : 'bg-red-700'}`} style={{ width: `${max ? Math.round((value / max) * 100) : 0}%` }} /></div><div className="mt-2 flex justify-end gap-1"><button onClick={() => onChange(-1)} className="rounded border border-border px-2 text-xs">−</button><button onClick={() => onChange(1)} className="rounded border border-border px-2 text-xs">+</button></div></div>;
}

function SkillsEditor({ character, editable, onToggle, onChange, isOwner }: { character: CharacterSheet; editable: boolean; onToggle: () => void; onChange: (skills: CharacterSheet['skills']) => void; isOwner: boolean }) {
  const cap = getSkillCap(character.level);
  const [query, setQuery] = useState('');
  const term = query.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const visible = character.skills
    .map((skill, index) => ({ skill, index }))
    .filter(({ skill }) => !term || skill.name.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(term));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><Crosshair /> Perícias</CardTitle>
        {isOwner && <Button size="sm" variant="outline" onClick={onToggle}><Edit3 size={14} className="mr-2" />{editable ? 'Concluir' : 'Editar'}</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar perícia..." className="h-9 pl-9" aria-label="Buscar perícia" data-testid="input-skill-search" />
        </div>
        {editable && <p className="text-xs text-muted-foreground">Pontos extras ficam separados dos pontos normais e aparecem no formato normal+extra.</p>}
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {visible.length === 0 && <p className="col-span-full rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma perícia corresponde a “{query}”.</p>}
          {visible.map(({ skill, index }) => {
            const extraPoints = skill.extraPoints ?? 0;
            return (
              <div key={skill.name} className="flex items-center justify-between gap-2 rounded-md border border-border/80 bg-secondary/20 px-2.5 py-1.5">
                <p className="truncate text-xs font-semibold"><RichText text={skill.name} /></p>
                {editable ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={cap}
                      step={1}
                      value={skill.value}
                      aria-label={`Pontos normais de ${skill.name}`}
                      title="Pontos normais"
                      onChange={event => onChange(character.skills.map((item, itemIndex) => itemIndex === index
                        ? { ...item, value: Math.max(0, Math.min(cap, Math.floor(Number(event.target.value) || 0))) }
                        : item))}
                      className="h-7 w-11 px-1 text-center text-xs"
                    />
                    <span className="text-xs text-muted-foreground" aria-hidden="true">+</span>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={extraPoints}
                      aria-label={`Pontos extras de ${skill.name}`}
                      title="Pontos extras"
                      onChange={event => onChange(character.skills.map((item, itemIndex) => itemIndex === index
                        ? { ...item, extraPoints: Math.max(0, Math.floor(Number(event.target.value) || 0)) }
                        : item))}
                      className="h-7 w-11 px-1 text-center text-xs"
                    />
                  </div>
                ) : (
                  <strong className="shrink-0 font-mono text-sm text-primary">
                    {skill.value}{extraPoints > 0 && <span className="text-amber-400">+{extraPoints}</span>}
                  </strong>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function InventoryEditor({ items, capacity, money, onChange, onMoneyChange, isOwner }: { items: InventoryItem[]; capacity: number; money: number; onChange: (items: InventoryItem[]) => void; onMoneyChange: (money: number) => void; isOwner: boolean }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<InventoryItem | null>(null);
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(null);
  const [moneyOperation, setMoneyOperation] = useState<'add' | 'subtract' | null>(null);
  const [moneyAmount, setMoneyAmount] = useState('');
  const load = items.reduce((sum, item) => sum + item.weight, 0);
  const open = (index: number) => { setEditing(index); setDraft({ ...items[index] }); };
  const save = () => { if (!draft || editing === null || !draft.name.trim()) return; onChange(items.map((item, index) => index === editing ? draft : item)); setEditing(null); setDraft(null); };
  const add = () => {
    const next: InventoryItem = { name: 'Novo item', detail: '', equipped: false, category: 'Itens Chave', weight: 1 };
    onChange([...items, next]);
    setEditing(items.length);
    setDraft(next);
  };
  const uploadItemImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !draft) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Escolha um arquivo de imagem.');
      return;
    }
    const reader = new FileReader();
    reader.onload = loadEvent => {
      if (typeof loadEvent.target?.result === 'string') {
        setDraft(current => current ? { ...current, image: loadEvent.target!.result as string } : current);
      }
    };
    reader.readAsDataURL(file);
  };
  const applyMoneyChange = () => {
    const amount = Number(moneyAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !moneyOperation) {
      toast.error('Informe um valor maior que zero.');
      return;
    }
    const nextMoney = Math.max(0, money + (moneyOperation === 'add' ? amount : -amount));
    onMoneyChange(nextMoney);
    toast.success(`Saldo atualizado: ${nextMoney}.`);
    setMoneyOperation(null);
    setMoneyAmount('');
  };
  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="flex items-center gap-2"><Backpack /> Inventário</CardTitle>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 sm:px-4">
          <div className="min-w-0"><p className="eyebrow text-primary">carga atual</p><p className="font-display text-2xl sm:text-3xl">{load} <span className="text-base text-muted-foreground">/ {capacity}</span></p></div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="text-right"><p className="eyebrow text-primary">Pokédollar</p><p className="font-display text-2xl sm:text-3xl">₽{money}</p></div>
            {isOwner && <div className="flex flex-col gap-1">
              <Button type="button" variant="outline" size="icon" className="h-7 w-7" aria-label="Somar pokédollar" data-testid="button-add-money" onClick={() => setMoneyOperation('add')}><Plus size={14} /></Button>
              <Button type="button" variant="outline" size="icon" className="h-7 w-7" aria-label="Subtrair pokédollar" data-testid="button-subtract-money" onClick={() => setMoneyOperation('subtract')}><Minus size={14} /></Button>
            </div>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => {
          const expanded = expandedItemIndex === index;
          return <div key={`${item.name}-${index}`} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/25 p-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background/70 text-primary">
              {item.image
                ? <img src={item.image} alt={`Imagem de ${item.name}`} className="h-full w-full object-cover" />
                : <PackageOpen size={22} aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold"><RichText text={item.name} replaceTypeNames /></p>
              <p className="text-xs text-muted-foreground">Peso {item.weight} · {item.category}</p>
              <button
                type="button"
                className="mt-1 block w-full text-left text-xs text-muted-foreground"
                aria-expanded={expanded}
                onClick={() => setExpandedItemIndex(expanded ? null : index)}
              >
                <span className={expanded ? 'block whitespace-pre-wrap break-words leading-relaxed' : 'block line-clamp-2'}>
                  <RichText text={item.detail || 'Sem descrição'} replaceTypeNames />
                </span>
                <span className="mt-1 inline-flex items-center gap-1 font-semibold text-primary">
                  {expanded ? 'Recolher' : 'Ver descrição'}
                  <ChevronDown size={13} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </span>
              </button>
            </div>
            {isOwner && <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="outline" onClick={() => open(index)}>Editar</Button>
              <Button size="icon" variant="ghost" aria-label={`Remover ${item.name}`} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></Button>
            </div>}
          </div>;
        })}
        {isOwner && <Button variant="outline" onClick={add}><Plus size={16} className="mr-2" /> Adicionar item</Button>}
         {draft && <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"><div className="grid gap-3 sm:grid-cols-2"><Input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Nome" /><select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{itemCategories.map(category => <option key={category}>{category}</option>)}</select><Input type="number" min={0} value={draft.weight} onChange={event => setDraft({ ...draft, weight: Math.max(0, Number(event.target.value) || 0) })} placeholder="Peso" /><Textarea value={draft.detail} onChange={event => setDraft({ ...draft, detail: event.target.value })} placeholder="Descrição" />
           <div className="flex items-center gap-3 sm:col-span-2">
             <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background/70 text-primary">{draft.image ? <img src={draft.image} alt="" className="h-full w-full object-cover" /> : <PackageOpen size={22} />}</div>
             <label htmlFor="input-inventory-item-image" className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-primary"><ImagePlus size={15} /> {draft.image ? 'Trocar imagem' : 'Anexar imagem'}</label>
             <input id="input-inventory-item-image" type="file" accept="image/*" className="sr-only" onChange={uploadItemImage} />
             {draft.image && <Button type="button" size="sm" variant="ghost" onClick={() => setDraft({ ...draft, image: undefined })}>Remover imagem</Button>}
           </div>
         </div><div className="flex gap-2"><Button onClick={save}>Salvar item</Button><Button variant="ghost" onClick={() => { setEditing(null); setDraft(null); }}>Cancelar</Button></div></div>}
        <Dialog open={moneyOperation !== null} onOpenChange={open => { if (!open) { setMoneyOperation(null); setMoneyAmount(''); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{moneyOperation === 'add' ? 'Somar pokédollar' : 'Subtrair pokédollar'}</DialogTitle>
              <DialogDescription>Saldo atual: ₽{money}. Informe o valor da operação.</DialogDescription>
            </DialogHeader>
            <Input autoFocus type="number" min="0" step="any" value={moneyAmount} onChange={event => setMoneyAmount(event.target.value)} placeholder="Valor de pokédollar" aria-label="Valor da operação" data-testid="input-money-adjustment" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setMoneyOperation(null); setMoneyAmount(''); }}>Cancelar</Button>
              <Button type="button" onClick={applyMoneyChange}>{moneyOperation === 'add' ? 'Somar' : 'Subtrair'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function AbilitiesEditor({ abilities, onChange, isOwner }: { abilities: CharacterSheet['abilities']; onChange: (abilities: CharacterSheet['abilities']) => void; isOwner: boolean }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<CharacterSheet['abilities'][number] | null>(null);
  const open = (index: number) => { setEditing(index); setDraft({ ...abilities[index] }); };
  const add = () => { const next = { name: 'Nova habilidade', detail: '', uses: '' }; onChange([...abilities, next]); open(abilities.length); };
  const save = () => { if (!draft || editing === null || !draft.name.trim()) return; onChange(abilities.map((item, index) => index === editing ? draft : item)); setEditing(null); setDraft(null); };
  return <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><Sparkles /> Habilidades</CardTitle>{isOwner && <Button size="sm" variant="outline" onClick={add}><Plus size={14} className="mr-2" /> Nova habilidade</Button>}</CardHeader><CardContent className="space-y-3">{abilities.map((ability, index) => <div key={`${ability.name}-${index}`} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold"><RichText text={ability.name} replaceTypeNames /></p><p className="whitespace-pre-wrap text-sm text-muted-foreground"><RichText text={ability.detail} replaceTypeNames /></p><p className="mt-1 text-xs text-primary"><RichText text={ability.uses} replaceTypeNames /></p></div>{isOwner && <div className="flex gap-1"><Button size="icon" variant={ability.pinned ? 'secondary' : 'ghost'} onClick={() => onChange(abilities.map((item, itemIndex) => itemIndex === index ? { ...item, pinned: !item.pinned } : item))} title="Fixar habilidade"><Pin size={15} /></Button><Button size="icon" variant="ghost" onClick={() => open(index)}><Edit3 size={15} /></Button><Button size="icon" variant="ghost" onClick={() => onChange(abilities.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></Button></div>}</div>{draft && editing === index && <div className="mt-3 grid gap-2 border-t border-border pt-3"><Input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Nome" /><Textarea value={draft.detail} onChange={event => setDraft({ ...draft, detail: event.target.value })} placeholder="Descrição" /><Input value={draft.uses} onChange={event => setDraft({ ...draft, uses: event.target.value })} placeholder="Usos ou custo" /><div className="flex gap-2"><Button size="sm" onClick={save}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => { setDraft(null); setEditing(null); }}>Cancelar</Button></div></div>}</div>)}</CardContent></Card>;
}

function FlowEditor({ flow, onChange, editable }: { flow: FlowStep[]; onChange: (flow: FlowStep[]) => void; editable: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ScrollText /> Fluxo</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {flow.map((step, index) => {
          const custom = step.level === 5 || step.level === 10;
          return <div key={step.level} className={`rounded-lg border p-3 ${step.active ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={step.active} onChange={event => editable && onChange(flow.map((item, itemIndex) => itemIndex === index ? { ...item, active: event.target.checked } : item))} disabled={!editable} className="mt-1 h-4 w-4 accent-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{step.level}~ <RichText text={step.name || 'Nível de fluxo'} /></p>
                <p className="text-sm text-muted-foreground"><RichText text={step.detail || 'Nenhum bônus descrito.'} /></p>
                {custom && editable && <div className="mt-2 grid gap-2 sm:grid-cols-2"><Input value={step.name} onChange={event => onChange(flow.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="Nome do fluxo" /><Input value={step.detail} onChange={event => onChange(flow.map((item, itemIndex) => itemIndex === index ? { ...item, detail: event.target.value } : item))} placeholder="Descrição do benefício" /></div>}
              </div>
              {custom && <Badge variant="outline">editável</Badge>}
            </div>
          </div>;
        })}
      </CardContent>
    </Card>
  );
}

function characterAffectionLabel(value: number) {
  if (value <= -6) return 'Péssima';
  if (value < 0) return 'Ruim';
  if (value <= 10) return 'Neutra';
  if (value <= 20) return 'Boa';
  if (value <= 30) return 'Amigo';
  return 'Inquebrável';
}

function PokemonRoster({ character, characters, trainers, pokemon, activeTab, setActiveTab, assignPokemon, removePokemon, canManagePokemon }: { character: CharacterSheet; characters: CharacterSheet[]; trainers: TrainerRecord[]; pokemon: ReturnType<typeof usePokemonData>['pokemon']; activeTab: 'party' | 'pc'; setActiveTab: (value: 'party' | 'pc') => void; assignPokemon: (id: string, destination: 'party' | 'pc') => void; removePokemon: (id: string) => void; canManagePokemon: boolean }) {
  const roster = getCharacterPokemonRoster(character, pokemon, characters);
  const ids = activeTab === 'party' ? roster.partyPokemonIds : roster.pcPokemonIds;
  const available = pokemon.filter(item =>
    !roster.partyPokemonIds.includes(item.id)
    && !roster.pcPokemonIds.includes(item.id)
    && !getPokemonAssignmentConflict(item, { kind: 'character', id: character.id, name: character.name }, characters, trainers),
  );
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><CircleDot /> Companheiros Pokémon</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-2">
          <Button size="sm" variant={activeTab === 'party' ? 'default' : 'outline'} onClick={() => setActiveTab('party')}>Party ({roster.partyPokemonIds.length}/6)</Button>
          <Button size="sm" variant={activeTab === 'pc' ? 'default' : 'outline'} onClick={() => setActiveTab('pc')}>PC ({roster.pcPokemonIds.length})</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ids.map(id => {
            const item = pokemon.find(entry => entry.id === id);
            if (!item) return null;
            const sheetQuery = new URLSearchParams({
              id: item.id,
              returnCharacterId: character.id,
              returnPokemonTab: activeTab,
            }).toString();
            return (
              <div key={id} className="rounded-lg border border-border p-3">
                <p className="font-display text-xl"><RichText text={item.name} /></p>
                <p className="text-xs text-muted-foreground">Nível {item.level} · {item.types.join(' / ')}</p>
                <p className="mt-2 text-sm"><span className="text-muted-foreground">Afeição</span> <strong className="text-primary">{item.affection} · {characterAffectionLabel(item.affection)}</strong></p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/sheet?${sheetQuery}`} className="self-center text-xs font-semibold text-primary">Abrir ficha</Link>
                  {canManagePokemon && <Button size="sm" variant="ghost" onClick={() => assignPokemon(item.id, activeTab === 'party' ? 'pc' : 'party')}>Mover para {activeTab === 'party' ? 'PC' : 'Party'}</Button>}
                  {canManagePokemon && <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removePokemon(item.id)}><Trash2 size={14} /> Remover da ficha</Button>}
                </div>
              </div>
            );
          })}
        </div>
        {canManagePokemon && available.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-sm font-semibold">Adicionar Pokémon criado</p>
            <div className="flex flex-wrap gap-2">{available.map(item => <Button key={item.id} size="sm" variant="outline" onClick={() => assignPokemon(item.id, activeTab)}><RichText text={item.name} /></Button>)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}