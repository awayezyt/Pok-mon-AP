import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  Award, ChevronDown, ChevronUp, CircleDot, Crown,
  LoaderCircle, Plus, Swords, Trophy, Users, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type {
  BrigadaKirkBattleInput, BrigadaKirkContestInput, BrigadaKirkHistoryEntry,
  BrigadaKirkLeague, BrigadaKirkPokemonInput, BrigadaKirkRarity,
} from '../lib/campaign';
import type { Pokemon } from '../lib/types';

type Props = {
  league: BrigadaKirkLeague;
  pokemon: Pokemon[];
  isGM: boolean;
  onAddBattle(input: BrigadaKirkBattleInput): Promise<void>;
  onAddPokemonDiscovery(input: BrigadaKirkPokemonInput): Promise<void>;
  onAddContest(input: BrigadaKirkContestInput): Promise<void>;
};

const rarities: BrigadaKirkRarity[] = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário', 'Mítico'];
const rarityColor: Record<BrigadaKirkRarity, string> = {
  Comum: 'border-border bg-muted text-muted-foreground',
  Incomum: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  Raro: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'Épico': 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  'Lendário': 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'Mítico': 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

const outcomeLabel = { win: 'Vitória', loss: 'Derrota', draw: 'Empate / imprevisto' } as const;
const placementLabel = {
  first: '1º lugar', second: '2º lugar', third: '3º lugar', other: 'Colocação baixa', unplaced: 'Sem colocação',
} as const;

function movementText(movement: number) {
  if (movement > 0) return `Subiu ${movement} ${movement === 1 ? 'posição' : 'posições'}`;
  if (movement < 0) return `Desceu ${Math.abs(movement)} ${Math.abs(movement) === 1 ? 'posição' : 'posições'}`;
  return 'Sem movimento';
}

function rankGradientHue(rank: number) {
  const boundedRank = Math.max(1, Math.min(530, Math.floor(rank)));
  return Math.round(((530 - boundedRank) / 529) * 120);
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-foreground">
    <span>{label}</span>
    {children}
    {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
  </label>;
}

function RankMovement({ before, after, movement }: { before: number; after: number; movement: number }) {
  return <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs">
    <span className="font-mono text-muted-foreground">#{before}</span>
    <span aria-hidden="true" className="text-muted-foreground">→</span>
    <strong className="font-mono text-foreground">#{after}</strong>
    <span className={`ml-auto font-semibold ${movement > 0 ? 'text-emerald-700 dark:text-emerald-300' : movement < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'}`}>{movementText(movement)}</span>
  </div>;
}

function DetailLine({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm leading-relaxed text-foreground">{children}</dd></div>;
}

function HistoryDetails({ entry }: { entry: BrigadaKirkHistoryEntry }) {
  if (entry.kind === 'battle') return <>
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailLine label="Adversários">{entry.opponentName} · posição #{entry.opponentRank}</DetailLine>
      <DetailLine label="Resultado">{outcomeLabel[entry.outcome]}</DetailLine>
      <DetailLine label="Brigada Kirk · competidores">{entry.brigadaCompetitors.join(', ') || 'Não informado'}</DetailLine>
      <DetailLine label="Outro grupo · competidores">{entry.opponentCompetitors.join(', ') || 'Não informado'}</DetailLine>
      <DetailLine label="Pokémon da Brigada">{entry.brigadaPokemon.join(', ') || 'Nenhum registrado'}</DetailLine>
      <DetailLine label="Pokémon adversários">{entry.opponentPokemon.join(', ') || 'Nenhum registrado'}</DetailLine>
    </div>
    <RankMovement before={entry.rankBefore} after={entry.rankAfter} movement={entry.movement} />
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">Movimento do grupo adversário</p>
      <RankMovement before={entry.opponentRank} after={entry.opponentRankAfter} movement={entry.opponentRank - entry.opponentRankAfter} />
    </div>
  </>;
  if (entry.kind === 'pokemon') return <>
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailLine label="Pokémon">{entry.pokemonName}</DetailLine>
      <DetailLine label="Espécie">{entry.species || 'Não informada'}</DetailLine>
      <DetailLine label="Raridade"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${rarityColor[entry.rarity]}`}>{entry.rarity}</span></DetailLine>
    </div>
    <RankMovement before={entry.rankBefore} after={entry.rankAfter} movement={entry.movement} />
  </>;
  if (entry.kind === 'contest') return <>
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailLine label="Evento">{entry.contestName}</DetailLine>
      <DetailLine label="Brigada Kirk">{entry.participantName} · {placementLabel[entry.placement]}</DetailLine>
      {entry.topThree.map(item => <DetailLine key={item.place} label={`${item.place}º lugar`}>{item.name} · Pokémon: {item.pokemon.join(', ') || 'Não informado'}</DetailLine>)}
      <DetailLine label="Aprovação">{entry.approval}%</DetailLine>
      <DetailLine label="Relevância">{entry.relevance} / 5</DetailLine>
    </div>
    <RankMovement before={entry.rankBefore} after={entry.rankAfter} movement={entry.movement} />
  </>;
  return <>
    <DetailLine label="Motivo">{entry.reason}</DetailLine>
    <RankMovement before={entry.rankBefore} after={entry.rankAfter} movement={entry.movement} />
  </>;
}

function summary(entry: BrigadaKirkHistoryEntry) {
  switch (entry.kind) {
    case 'battle': return `${outcomeLabel[entry.outcome]} · ${entry.opponentName}`;
    case 'pokemon': return `${entry.pokemonName} · ${entry.rarity}`;
    case 'contest': return `${entry.participantName} · ${placementLabel[entry.placement]}`;
    case 'manual': return entry.reason;
  }
}

function EntryForm({ children, onSubmit, title, subtitle, icon, className = '' }: {
  children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  title: string; subtitle: string; icon: ReactNode; className?: string;
}) {
  return <form onSubmit={onSubmit} className={`rounded-xl border border-border bg-card p-4 sm:p-5 ${className}`}>
    <div className="mb-4 flex items-start gap-3 border-b border-border pb-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <div><h3 className="font-display text-lg leading-tight text-card-foreground">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">{children}</div>
  </form>;
}

export default function BrigadaKirkPanel({
  league, pokemon, isGM, onAddBattle, onAddPokemonDiscovery, onAddContest,
}: Props) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [activeForm, setActiveForm] = useState<'battle' | 'pokemon' | 'contest'>('battle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [battle, setBattle] = useState({
    opponentName: '', opponentRank: '', brigadaCompetitors: ['', ''], opponentCompetitors: ['', ''],
    brigadaPokemon: '', opponentPokemon: '', outcome: 'win' as BrigadaKirkBattleInput['outcome'],
  });
  const [discovery, setDiscovery] = useState({ pokemonId: '', rarity: 'Comum' as BrigadaKirkRarity });
  const [contest, setContest] = useState({
    contestName: '', names: ['', '', ''], pokemonLists: ['', '', ''], participantName: '',
    placement: 'unplaced' as BrigadaKirkContestInput['placement'], approval: '50', relevance: '3',
  });
  const knownOpponentRank = battle.opponentName.trim()
    ? league.opponentRanks[battle.opponentName.trim().toLowerCase()]
    : undefined;

  const toggleExpanded = (id: string) => setExpanded(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const splitNames = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);
  const runSave = async (save: () => Promise<void>, reset: () => void) => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await save();
      reset();
      setSuccess('Registro adicionado ao histórico da liga.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o registro. Tente novamente.');
    } finally { setSaving(false); }
  };
  const updateCompetitor = (side: 'brigadaCompetitors' | 'opponentCompetitors', index: number, value: string) => {
    setBattle(current => ({ ...current, [side]: current[side].map((name, i) => i === index ? value : name) }));
  };
  const addCompetitor = (side: 'brigadaCompetitors' | 'opponentCompetitors') => {
    setBattle(current => current[side].length >= 3 ? current : { ...current, [side]: [...current[side], ''] });
  };

  const submitBattle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const brigadaCompetitors = battle.brigadaCompetitors.map(name => name.trim()).filter(Boolean);
    const opponentCompetitors = battle.opponentCompetitors.map(name => name.trim()).filter(Boolean);
    const brigadaPokemon = splitNames(battle.brigadaPokemon);
    const opponentPokemon = splitNames(battle.opponentPokemon);
    const opponentRank = Number(battle.opponentRank);
    if (!battle.opponentName.trim() || !Number.isInteger(opponentRank) || opponentRank < 1 || opponentRank > 10000 || brigadaCompetitors.length < 1 || opponentCompetitors.length < 1) {
      setError('Informe um grupo, uma posição inteira entre 1 e 10.000 e os competidores dos dois lados.'); return;
    }
    if (brigadaCompetitors.length !== opponentCompetitors.length) {
      setError('A batalha precisa ter o mesmo número de competidores nos dois grupos (1×1, 2×2 ou 3×3).'); return;
    }
    if (!brigadaPokemon.length || !opponentPokemon.length) {
      setError('Informe ao menos um Pokémon usado por cada grupo.'); return;
    }
    const input: BrigadaKirkBattleInput = {
      opponentName: battle.opponentName.trim(), opponentRank,
      brigadaCompetitors, opponentCompetitors,
      brigadaPokemon, opponentPokemon,
      outcome: battle.outcome,
    };
    void runSave(() => onAddBattle(input), () => setBattle({
      opponentName: '', opponentRank: '', brigadaCompetitors: ['', ''], opponentCompetitors: ['', ''],
      brigadaPokemon: '', opponentPokemon: '', outcome: 'win',
    }));
  };
  const submitPokemon = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selected = pokemon.find(item => item.id === discovery.pokemonId);
    if (!selected) { setError('Escolha um Pokémon do arquivo.'); return; }
    const input: BrigadaKirkPokemonInput = {
      pokemonName: selected.name, species: selected.species, rarity: discovery.rarity,
      ...(selected.image ? { image: selected.image } : {}),
    };
    void runSave(() => onAddPokemonDiscovery(input), () => setDiscovery({ pokemonId: '', rarity: 'Comum' }));
  };
  const submitContest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const topThree = ([1, 2, 3] as const).map((place, index) => ({
      place, name: contest.names[index].trim(), pokemon: splitNames(contest.pokemonLists[index]),
    }));
    const approval = Number(contest.approval), relevance = Number(contest.relevance);
    if (!contest.contestName.trim() || !contest.participantName.trim() || topThree.some(item => !item.name || !item.pokemon.length) ||
      !Number.isInteger(approval) || approval < 0 || approval > 100 || !Number.isInteger(relevance) || relevance < 1 || relevance > 5) {
      setError('Preencha o evento, os nomes e Pokémon do pódio, o participante da Brigada e os valores válidos.'); return;
    }
    const input: BrigadaKirkContestInput = {
      contestName: contest.contestName.trim(), topThree, participantName: contest.participantName.trim(),
      placement: contest.placement, approval, relevance,
    };
    void runSave(() => onAddContest(input), () => setContest({
      contestName: '', names: ['', '', ''], pokemonLists: ['', '', ''], participantName: '',
      placement: 'unplaced', approval: '50', relevance: '3',
    }));
  };

  const history = [...league.history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const rankHue = rankGradientHue(league.currentRank);
  const rankGradientStyle: CSSProperties = {
    backgroundImage: `linear-gradient(115deg, hsl(${rankHue} 76% 52% / .19) 0%, hsl(${rankHue} 60% 60% / .1) 54%, transparent 100%)`,
  };
  return <section className="mx-auto w-full max-w-5xl space-y-5 px-3 py-5 sm:px-5 sm:py-7" aria-labelledby="brigada-title">
    <Card className="overflow-hidden rounded-2xl border-border bg-card text-card-foreground shadow-lg shadow-foreground/10">
      <div style={rankGradientStyle} className="relative overflow-hidden border-b border-border bg-card px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full border-[24px] border-foreground/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/70 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-primary">
              <CircleDot size={13} /> Registro público · Brigada Kirk
            </div>
            <h1 id="brigada-title" className="font-display text-4xl leading-none tracking-tight text-foreground sm:text-5xl">Crônica da liga</h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">Uma história compartilhada de duelos, descobertas e pódios. Cada marca registra o resultado confirmado da campanha.</p>
          </div>
          <div className="flex w-full items-center gap-4 rounded-xl border border-border bg-background/70 p-4 sm:w-auto sm:min-w-56">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Crown size={23} /></div>
            <div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">Posição atual</p><p className="mt-0.5 font-mono text-3xl font-bold leading-none text-foreground">#{league.currentRank}</p></div>
            <div className="ml-auto text-right sm:ml-2"><p className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Marcos</p><p className="font-display text-2xl text-primary">{league.history.length}</p></div>
          </div>
        </div>
      </div>
      <CardContent className="p-4 sm:p-6">
        {isGM && <section className="mb-7 rounded-2xl border border-border bg-muted/30 p-3 sm:p-5" aria-labelledby="add-record-title">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div><h2 id="add-record-title" className="font-display text-xl text-foreground">Registrar um marco</h2><p className="mt-0.5 text-xs text-muted-foreground">A colocação exibida vem do resultado salvo pela campanha.</p></div>
            <Badge variant="outline" className="hidden border-border bg-background text-muted-foreground sm:inline-flex">GM</Badge>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Tipo de registro">
            {([
              ['battle', 'Batalha', Swords], ['pokemon', 'Descoberta', CircleDot], ['contest', 'Concurso', Trophy],
            ] as const).map(([key, label, Icon]) => <button type="button" role="tab" aria-selected={activeForm === key} key={key} onClick={() => { setActiveForm(key); setError(''); setSuccess(''); }}
              className={`flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 text-xs font-semibold transition-colors sm:gap-2 sm:text-sm ${activeForm === key ? 'bg-card text-card-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon size={15} /> <span className="truncate">{label}</span>
            </button>)}
          </div>
          {error && <div role="alert" className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"><span>{error}</span><button type="button" aria-label="Dispensar erro" onClick={() => setError('')}><X size={16} /></button></div>}
          {success && <p role="status" className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{success}</p>}
          {activeForm === 'battle' && <EntryForm title="Relato de batalha" subtitle="Vitórias contra grupos mais bem colocados rendem mais; os dois rankings são atualizados sem saltos extremos." icon={<Swords size={18} />} onSubmit={submitBattle}>
             <Field label="Grupo adversário"><Input value={battle.opponentName} onChange={e => {
               const name = e.target.value;
               const savedRank = league.opponentRanks[name.trim().toLowerCase()];
               setBattle(current => ({ ...current, opponentName: name, opponentRank: savedRank === undefined ? '' : String(savedRank) }));
             }} placeholder="Nome do grupo" required /></Field>
             <Field label="Posição atual do adversário" hint={knownOpponentRank ? `Última posição registrada: #${knownOpponentRank}` : 'Informe a posição atual na liga'}><Input type="number" min="1" max="10000" step="1" value={battle.opponentRank} onChange={e => setBattle({ ...battle, opponentRank: e.target.value })} placeholder="Ex.: 325" required /></Field>
             <div className="sm:col-span-2">
               <p className="mb-1.5 text-sm font-semibold text-foreground">Resultado</p>
               <div className="grid grid-cols-3 gap-2" role="group" aria-label="Resultado da batalha">
                 {([
                   ['win', 'Vitória'], ['loss', 'Derrota'], ['draw', 'Empate / imprevisto'],
                 ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={battle.outcome === value} onClick={() => setBattle({ ...battle, outcome: value })}
                   className={`min-h-10 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${battle.outcome === value ? value === 'win' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : value === 'loss' ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-border bg-background/70 text-muted-foreground hover:border-primary/50'}`}>
                   {label}
                 </button>)}
               </div>
             </div>
            <Field label="Pokémon da Brigada" hint="Separe vários nomes por vírgula"><Input value={battle.brigadaPokemon} onChange={e => setBattle({ ...battle, brigadaPokemon: e.target.value })} placeholder="Nomes dos Pokémon" /></Field>
            <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Competidores da Brigada</p>{battle.brigadaCompetitors.length < 3 && <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-primary" onClick={() => addCompetitor('brigadaCompetitors')}><Plus size={14} /> Adicionar</Button>}</div>
              {battle.brigadaCompetitors.map((name, index) => <div key={`b-${index}`} className="flex gap-2"><Input aria-label={`Competidor da Brigada ${index + 1}`} value={name} onChange={e => updateCompetitor('brigadaCompetitors', index, e.target.value)} placeholder={`Competidor ${index + 1}`} />{battle.brigadaCompetitors.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remover competidor da Brigada ${index + 1}`} onClick={() => setBattle(current => ({ ...current, brigadaCompetitors: current.brigadaCompetitors.filter((_, i) => i !== index) }))}><X size={15} /></Button>}</div>)}
            </div>
            <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Competidores adversários</p>{battle.opponentCompetitors.length < 3 && <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-primary" onClick={() => addCompetitor('opponentCompetitors')}><Plus size={14} /> Adicionar</Button>}</div>
              {battle.opponentCompetitors.map((name, index) => <div key={`o-${index}`} className="flex gap-2"><Input aria-label={`Competidor adversário ${index + 1}`} value={name} onChange={e => updateCompetitor('opponentCompetitors', index, e.target.value)} placeholder={`Competidor ${index + 1}`} />{battle.opponentCompetitors.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remover competidor adversário ${index + 1}`} onClick={() => setBattle(current => ({ ...current, opponentCompetitors: current.opponentCompetitors.filter((_, i) => i !== index) }))}><X size={15} /></Button>}</div>)}
            </div>
            <Field label="Pokémon adversários" hint="Separe vários nomes por vírgula"><Input value={battle.opponentPokemon} onChange={e => setBattle({ ...battle, opponentPokemon: e.target.value })} placeholder="Nomes dos Pokémon" /></Field>
            <div className="flex items-end sm:justify-end"><Button type="submit" disabled={saving} className="w-full sm:w-auto">{saving ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />} Salvar batalha</Button></div>
          </EntryForm>}
           {activeForm === 'pokemon' && <EntryForm title="Nova descoberta" subtitle="A raridade define a pontuação: comum +2, incomum +5, raro +9, épico +14, lendário +21 e mítico +26." icon={<CircleDot size={18} />} onSubmit={submitPokemon}>
            {pokemon.length ? <>
              <Field label="Pokémon"><select value={discovery.pokemonId} onChange={e => setDiscovery({ ...discovery, pokemonId: e.target.value })} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" required><option value="">Escolha no arquivo</option>{pokemon.map(item => <option key={item.id} value={item.id}>{item.name} · {item.species}</option>)}</select></Field>
              <Field label="Raridade"><select value={discovery.rarity} onChange={e => setDiscovery({ ...discovery, rarity: e.target.value as BrigadaKirkRarity })} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm">{rarities.map(rarity => <option key={rarity} value={rarity}>{rarity}</option>)}</select></Field>
              <div className="sm:col-span-2"><Button type="submit" disabled={saving || !discovery.pokemonId} className="w-full sm:w-auto">{saving ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />} Salvar descoberta</Button></div>
            </> : <div className="sm:col-span-2 rounded-lg border border-dashed border-border px-4 py-7 text-center"><p className="font-semibold text-foreground">O arquivo de Pokémon está vazio</p><p className="mt-1 text-sm text-muted-foreground">Assim que houver fichas disponíveis, será possível registrar uma descoberta.</p></div>}
          </EntryForm>}
           {activeForm === 'contest' && <EntryForm title="Resultado de concurso" subtitle="A mudança combina colocação, aprovação e relevância (escala de 1 a 5)." icon={<Trophy size={18} />} onSubmit={submitContest}>
            <Field label="Nome do concurso"><Input value={contest.contestName} onChange={e => setContest({ ...contest, contestName: e.target.value })} placeholder="Nome do evento" required /></Field>
            <Field label="Participante da Brigada"><Input value={contest.participantName} onChange={e => setContest({ ...contest, participantName: e.target.value })} placeholder="Nome do participante" required /></Field>
            {([1, 2, 3] as const).map((place, index) => <div key={place} className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{place}º lugar</p>
              <Input aria-label={`Nome do ${place}º lugar`} value={contest.names[index]} onChange={e => setContest(current => ({ ...current, names: current.names.map((name, i) => i === index ? e.target.value : name) }))} placeholder="Nome" required />
               <Input aria-label={`Pokémon do ${place}º lugar`} value={contest.pokemonLists[index]} onChange={e => setContest(current => ({ ...current, pokemonLists: current.pokemonLists.map((list, i) => i === index ? e.target.value : list) }))} placeholder="Pokémon separados por vírgula" required />
            </div>)}
            <Field label="Colocação da Brigada"><select value={contest.placement} onChange={e => setContest({ ...contest, placement: e.target.value as BrigadaKirkContestInput['placement'] })} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"><option value="first">1º lugar</option><option value="second">2º lugar</option><option value="third">3º lugar</option><option value="other">Outra colocação / baixa</option><option value="unplaced">Sem colocação</option></select></Field>
             <Field label="Aprovação" hint="Percentual inteiro de 0 a 100"><Input type="number" min="0" max="100" step="1" value={contest.approval} onChange={e => setContest({ ...contest, approval: e.target.value })} required /></Field>
             <Field label="Relevância" hint="Escala inteira de 1 a 5"><Input type="number" min="1" max="5" step="1" value={contest.relevance} onChange={e => setContest({ ...contest, relevance: e.target.value })} required /></Field>
            <div className="flex items-end sm:justify-end"><Button type="submit" disabled={saving} className="w-full sm:w-auto">{saving ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />} Salvar concurso</Button></div>
          </EntryForm>}
        </section>}

        <section aria-labelledby="history-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-muted-foreground">Do mais recente ao primeiro</p><h2 id="history-title" className="mt-1 font-display text-2xl text-foreground">Histórico da Brigada</h2></div>
            <span className="rounded-full border border-border bg-background/70 px-3 py-1.5 font-mono text-xs text-muted-foreground">{history.length} {history.length === 1 ? 'registro' : 'registros'}</span>
          </div>
          {history.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Users size={25} /></div>
            <h3 className="mt-4 font-display text-xl text-foreground">A crônica começa aqui</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{isGM ? 'Ainda não há marcos. Registre uma batalha, descoberta ou concurso para iniciar o histórico compartilhado.' : 'Ainda não há registros públicos para a Brigada Kirk. Volte depois para acompanhar os próximos marcos.'}</p>
          </div> : <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[17px] before:top-6 before:w-px before:bg-border sm:before:left-[19px]">
            {history.map((entry, index) => {
              const open = expanded.includes(entry.id);
              const typeName = entry.kind === 'battle' ? 'Batalha' : entry.kind === 'pokemon' ? 'Descoberta' : entry.kind === 'contest' ? 'Concurso' : 'Ajuste';
              const Icon = entry.kind === 'battle' ? Swords : entry.kind === 'pokemon' ? CircleDot : entry.kind === 'contest' ? Award : Crown;
              const timestamp = new Date(entry.createdAt);
              const dateText = Number.isNaN(timestamp.getTime()) ? entry.createdAt : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
              return <li key={entry.id} className="relative pl-10 sm:pl-12">
                <span className={`absolute left-0 top-4 z-10 grid h-9 w-9 place-items-center rounded-xl border shadow-sm sm:h-10 sm:w-10 ${entry.kind === 'battle' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' : entry.kind === 'pokemon' ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300' : entry.kind === 'contest' ? 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300' : 'border-border bg-muted text-muted-foreground'}`}><Icon size={17} /></span>
                <article className={`overflow-hidden rounded-xl border bg-card shadow-sm transition-colors ${open ? 'border-primary/40' : 'border-border hover:border-primary/30'}`}>
                  <button type="button" aria-expanded={open} aria-controls={`entry-detail-${entry.id}`} onClick={() => toggleExpanded(entry.id)} className="flex min-h-[82px] w-full items-center gap-3 p-3 text-left sm:gap-4 sm:p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-border bg-muted text-[10px] text-muted-foreground">{typeName}</Badge><time className="text-[10px] text-muted-foreground">{dateText}</time></div>
                      <p className="mt-1.5 truncate font-display text-base leading-snug text-card-foreground sm:text-lg">{entry.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{summary(entry)}</p>
                    </div>
                    <span className={`hidden shrink-0 rounded-lg px-2.5 py-1.5 text-right sm:block ${entry.movement > 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : entry.movement < 0 ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-muted text-muted-foreground'}`}>
                      <span className="block font-mono text-xs font-bold">{entry.movement > 0 ? '+' : ''}{entry.movement}</span><span className="text-[9px]">posição</span>
                    </span>
                    {open ? <ChevronUp className="shrink-0 text-muted-foreground" size={17} /> : <ChevronDown className="shrink-0 text-muted-foreground" size={17} />}
                  </button>
                  {open && <div id={`entry-detail-${entry.id}`} className="grid gap-4 border-t border-border bg-muted/20 p-3 sm:p-4">
                    <dl className="grid gap-3 sm:grid-cols-2"><DetailLine label="Movimento">{movementText(entry.movement)}</DetailLine><DetailLine label="Colocação anterior e atual">#{entry.rankBefore} → #{entry.rankAfter}</DetailLine></dl>
                    <HistoryDetails entry={entry} />
                    <div className="text-right font-mono text-[10px] text-muted-foreground">Marco {history.length - index} · registro da campanha</div>
                  </div>}
                </article>
              </li>;
            })}
          </ol>}
        </section>
      </CardContent>
    </Card>
  </section>;
}
