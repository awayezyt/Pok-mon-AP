import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { usePokemonData, useAttackData } from '../lib/hooks';
import { useDiceHistory } from '../lib/DiceHistoryContext';
import { Pokemon, PokemonType, IVRank, StatEntry, PokemonStages, defaultStages } from '../lib/types';
import { defaultPokemonTypes } from '../lib/constants';
import {
  getNatureEffects,
  getStatDiceNotation, rollDice,
  getPhysicalDamage, getSpecialDamage, rollDamage, rollStatusChance,
  computeDerivedStats, applyStageFormula, getEffectiveCritRange,
} from '../lib/calculations';
import { ORIGINAL_PRESET, useFormulaSettings } from '../lib/formulas';
import { formatStatusChance } from '../lib/attackLocalization';
import { CategoryIcon, TYPE_COLORS, TYPE_ICON_SOURCES, TypeIconBadge } from './TypeIcon';
import { RichText } from '@/components/RichText';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Camera, ChevronDown, Minus, Swords, Trash2, Search, Plus, Dices, Pencil, X,
  Shield, Heart, Zap, Activity, RefreshCw, Copy, Check, ClipboardPaste, ImagePlus,
  Mars, Venus, CircleHelp
} from 'lucide-react';
import { toast } from 'sonner';
import { useCharacterSheets, useSessionRole, type TrainerRecord } from '../lib/campaign';
import { getServerCollection } from '../lib/cloudSync';
import { characterHasPokemon, getCharacterPokemonRoster, getPokemonAssignmentConflict, getPokemonTrainerName, normalizeTrainerName, syncPokemonTrainerRecord } from '../lib/pokemonOwnership';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ─── Stage widget ──────────────────────────────────────────────────────────────

interface StageRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  color?: string;
}
function StageRow({ label, value, min, max, onChange, color = 'text-foreground' }: StageRowProps) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const colorClass = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-muted-foreground';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-muted-foreground w-20 uppercase">{label}</span>
      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => onChange(clamp(value - 1))}>–</Button>
      <span className={`w-8 text-center font-mono font-bold text-sm ${colorClass}`}>
        {value > 0 ? `+${value}` : value}
      </span>
      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => onChange(clamp(value + 1))}>+</Button>
      <div className="flex gap-0.5 ml-1">
        {Array.from({ length: Math.abs(max) }).map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full ${
            value > 0 && i < value ? 'bg-green-400' : value < 0 && i < Math.abs(value) ? 'bg-red-400' : 'bg-muted/40'
          }`} />
        ))}
      </div>
    </div>
  );
}

const POKEMON_GROWTH_VALUES: Record<Pokemon['growthRate'], number> = {
  'Errático': 1,
  'Rápido': 2,
  'Meio rápido': 3,
  'Meio devagar': 4,
  'Devagar': 5,
  'Muito devagar': 6,
};

function affectionLabel(value: number) {
  if (value <= -6) return 'Péssima';
  if (value < 0) return 'Ruim';
  if (value <= 10) return 'Neutra';
  if (value <= 20) return 'Boa';
  if (value <= 30) return 'Amigo';
  return 'Inquebrável';
}

function PokemonTypePicker({
  type,
  label,
  occupiedType,
  disabled,
  onChange,
}: {
  type: PokemonType;
  label: string;
  occupiedType?: PokemonType;
  disabled: boolean;
  onChange: (type: PokemonType) => void;
}) {
  const types = defaultPokemonTypes as PokemonType[];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          className="h-11 w-11 rounded-full border-2 bg-background/70 p-1 shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-background"
          style={{ borderColor: TYPE_COLORS[type] }}
          aria-label={`${label}: ${type}. Selecionar tipo`}
          title={`${label}: ${type}`}
        >
          <span className="grid h-full w-full place-items-center rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }}>
            <img src={TYPE_ICON_SOURCES[type]} alt="" aria-hidden="true" className="h-[78%] w-[78%] object-contain" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {types.map(option => {
            const selected = option === type;
            const unavailable = option === occupiedType && !selected;
            return (
              <button
                key={option}
                type="button"
                disabled={unavailable}
                aria-label={option}
                aria-pressed={selected}
                title={option}
                onClick={() => onChange(option)}
                className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                  selected
                    ? 'border-[color:var(--type-color)] bg-[color:var(--type-color)]/15 text-foreground'
                    : 'border-border bg-background hover:bg-muted'
                } ${unavailable ? 'cursor-not-allowed opacity-35' : ''}`}
                style={{ '--type-color': TYPE_COLORS[option] } as React.CSSProperties}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ backgroundColor: TYPE_COLORS[option] }}>
                  <img src={TYPE_ICON_SOURCES[option]} alt="" aria-hidden="true" className="h-[78%] w-[78%] object-contain" />
                </span>
                <span className="truncate">{option}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PokemonSheetComponent({ pokemonId, readOnly = false }: { pokemonId: string; readOnly?: boolean }) {
  const { pokemon, updatePokemon } = usePokemonData();
  const { attacks } = useAttackData();
  const { addRoll } = useDiceHistory();
  const { role } = useSessionRole();
  const { characters, updateCharacter } = useCharacterSheets();
  const trainerRecords = getServerCollection<TrainerRecord[]>('trainers', []);
  const canEditMoves = role === 'gm' && !readOnly;
  const canEdit = !readOnly;

  const [sheet, setSheet] = useState<Pokemon | null>(null);
  const { active: activePreset } = useFormulaSettings();
  const [hpDialog, setHpDialog] = useState<'damage' | 'heal' | null>(null);
  const [hpAmount, setHpAmount] = useState('');
  const [hpUseRd, setHpUseRd] = useState(true);
  const [hpDamageKind, setHpDamageKind] = useState<'physical' | 'special'>('physical');
  const [editingDescription, setEditingDescription] = useState<'itemDescription' | 'abilityDescription' | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [editingPokedexDescription, setEditingPokedexDescription] = useState(false);
  const [pokedexDescriptionDraft, setPokedexDescriptionDraft] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Initialize sheet from pokemon list
  useEffect(() => {
    const p = pokemon.find(p => p.id === pokemonId);
    if (p && (!sheet || sheet.id !== pokemonId)) {
      setSheet({ ...p, stages: p.stages || defaultStages });
    } else if (p && sheet && (p.hp !== sheet.hp || p.hpMax !== sheet.hpMax) && !debounceTimerRef.current) {
      setSheet(prev => prev ? { ...prev, hp: p.hp, hpMax: p.hpMax } : prev);
    }
  }, [pokemon, pokemonId]);

  const handleChange = useCallback((updates: Partial<Pokemon>) => {
    if (!canEdit) return;
    setSheet(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      if (updates.stats || updates.natureNumber !== undefined || updates.level !== undefined) {
        let calculated: number;
        try { calculated = computeDerivedStats(next.stats, next.natureNumber, next.stages, next.level).hp; }
        catch { calculated = computeDerivedStats(next.stats, next.natureNumber, next.stages, next.level, ORIGINAL_PRESET).hp; }
        const nextHpMax = Math.max(1, calculated);
        const damage = Math.max(0, prev.hpMax - prev.hp);
        next.hpMax = nextHpMax;
        next.hp = Math.max(0, Math.min(nextHpMax, nextHpMax - damage));
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => { debounceTimerRef.current = undefined; updatePokemon(next.id, next); }, 500);
      return next;
    });
  }, [canEdit, updatePokemon]);

  const handleStatChange = (statKey: keyof Pokemon['stats'], field: keyof StatEntry, value: any) => {
    if (!sheet) return;
    if ((field === 'ev' || field === 'iv') && !canEditMoves) return;
    handleChange({ stats: { ...sheet.stats, [statKey]: { ...sheet.stats[statKey], [field]: value } } });
  };

  const handleStageChange = (key: keyof PokemonStages, value: number) => {
    if (!sheet || !canEdit) return;
    handleChange({ stages: { ...sheet.stages, [key]: value } });
  };

  const handleResetStages = () => {
    if (!sheet) return;
    handleChange({ stages: { ...defaultStages } });
    toast.success('Estágios resetados!');
  };

  // ── Parsers ────────────────────────────────────────────────────────────────
  const [baseStatsPaste, setBaseStatsPaste] = useState('');
  const handleParseBaseStats = () => {
    if (!sheet || !canEditMoves) return;
    const normalized = baseStatsPaste.replace(/\s+/g, ' ').trim();
    const getVal = (label: string) => {
      const m = normalized.match(new RegExp(`(?:^|\\s)${label.replace('.', '\\.')}\\s+(\\d+)`, 'i'));
      return m ? parseInt(m[1], 10) : null;
    };
    const ns = { ...sheet.stats };
    const hp = getVal('HP');      if (hp !== null)    ns.hp.base    = hp;
    const atk = getVal('Attack'); if (atk !== null)   ns.atk.base   = atk;
    const def = getVal('Defense');if (def !== null)   ns.def.base   = def;
    const sa = getVal('Sp. Atk');if (sa !== null)    ns.spAtk.base = sa;
    const sd = getVal('Sp. Def');if (sd !== null)    ns.spDef.base = sd;
    const sp = getVal('Speed');   if (sp !== null)    ns.spe.base   = sp;
    handleChange({ stats: ns });
    setBaseStatsPaste('');
    toast.success('Base Stats colados!');
  };

  const [ivPaste, setIvPaste] = useState('');
  const handleParseIVs = () => {
    if (!canEditMoves) {
      toast.error('Apenas o GM pode alterar os IVs.');
      return;
    }
    if (!sheet) return;
    const tokens = ivPaste.trim().split(/\s+/).map(t => t.toUpperCase());
    if (tokens.length >= 6) {
      const valid = ['SS', 'S', 'A', 'B', 'C', 'D'];
      const get = (i: number) => valid.includes(tokens[i]) ? tokens[i] as IVRank : 'C';
      handleChange({
        stats: {
          hp:    { ...sheet.stats.hp,    iv: get(0) },
          atk:   { ...sheet.stats.atk,   iv: get(1) },
          def:   { ...sheet.stats.def,   iv: get(2) },
          spAtk: { ...sheet.stats.spAtk, iv: get(3) },
          spDef: { ...sheet.stats.spDef, iv: get(4) },
          spe:   { ...sheet.stats.spe,   iv: get(5) },
        }
      });
      setIvPaste(''); toast.success('IVs aplicados!');
    } else {
      toast.error('Precisa de 6 valores (ex: A SS B S A C).');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => handleChange({ image: ev.target?.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleImagePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const imageItem = Array.from(e.clipboardData.items).find(item => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) handleImageUpload({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  const handleRandomNature = () => {
    if (!canEditMoves) {
      toast.error('Apenas o GM pode alterar a natureza.');
      return;
    }
    handleChange({ natureNumber: Math.floor(Math.random() * 25) + 1 });
  };

  const randomizeLevelPoints = () => {
    if (!sheet || !canEditMoves) return;
    const keys = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'spe'] as Array<keyof Pokemon['stats']>;
    const nextStats = { ...sheet.stats };
    keys.forEach(key => {
      nextStats[key] = { ...nextStats[key], levelPoints: 0 };
    });
    let remaining = Math.max(0, sheet.level * 3);
    while (remaining > 0) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      nextStats[key] = { ...nextStats[key], levelPoints: nextStats[key].levelPoints + 1 };
      remaining -= 1;
    }
    handleChange({ stats: nextStats });
    toast.success(`Pontos de nível distribuídos (${sheet.level * 3}).`);
  };

  const randomizeEvs = () => {
    if (!sheet || !canEditMoves) return;
    const raw = window.prompt('Quantos pontos de EV deseja sortear?', '20');
    if (raw === null) return;
    const amount = Math.max(0, Math.min(510, Number(raw) || 0));
    const keys = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'spe'] as Array<keyof Pokemon['stats']>;
    const nextStats = { ...sheet.stats };
    keys.forEach(key => {
      nextStats[key] = { ...nextStats[key], ev: 0 };
    });
    for (let index = 0; index < amount; index += 1) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      nextStats[key] = { ...nextStats[key], ev: nextStats[key].ev + 1 };
    }
    handleChange({ stats: nextStats });
    toast.success(`EVs distribuídos (${amount}).`);
  };

  const randomizeIvs = () => {
    if (!sheet || !canEditMoves) return;
    const rank = (value: number): IVRank => value === 31 ? 'SS' : value >= 25 ? 'S' : value >= 18 ? 'A' : value >= 9 ? 'B' : value >= 2 ? 'C' : 'D';
    const nextStats = { ...sheet.stats };
    (Object.keys(nextStats) as Array<keyof Pokemon['stats']>).forEach(key => {
      nextStats[key] = { ...nextStats[key], iv: rank(Math.floor(Math.random() * 31) + 1) };
    });
    handleChange({ stats: nextStats });
    toast.success('IVs sorteados.');
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const natureEffects = useMemo(() => getNatureEffects(sheet?.natureNumber || 21), [sheet?.natureNumber]);

  // If the active preset throws for this Pokémon (e.g. division by zero), fall back to Original instead of crashing.
  const formulaPreset = useMemo(() => {
    if (!sheet) return activePreset;
    try { computeDerivedStats(sheet.stats, sheet.natureNumber, sheet.stages, sheet.level, activePreset); return activePreset; }
    catch { return ORIGINAL_PRESET; }
  }, [sheet, activePreset]);
  const formulaFallback = formulaPreset !== activePreset;

  const derived = useMemo(() => {
    if (!sheet) return null;
    return computeDerivedStats(sheet.stats, sheet.natureNumber, sheet.stages, sheet.level, formulaPreset);
  }, [sheet, formulaPreset]);

  const levelPointsUsed = useMemo(() => {
    if (!sheet) return 0;
    const s = sheet.stats;
    return ['hp','atk','def','spAtk','spDef','spe'].reduce((sum, k) =>
      sum + (Number((s as any)[k].levelPoints) || 0), 0);
  }, [sheet]);

  const evsUsed = useMemo(() => {
    if (!sheet) return 0;
    const s = sheet.stats;
    return ['hp','atk','def','spAtk','spDef','spe'].reduce((sum, k) =>
      sum + (Number((s as any)[k].ev) || 0), 0);
  }, [sheet]);

  const nextLevelXp = sheet ? sheet.level * POKEMON_GROWTH_VALUES[sheet.growthRate || 'Meio rápido'] : 0;

  // ── Roll Stat ──────────────────────────────────────────────────────────────
  const handleRollStat = (statKey: keyof Pokemon['stats'], label: string) => {
    if (!sheet) return;
    const stat = sheet.stats[statKey];
    const { dice, keepWorst, bonus, str } = getStatDiceNotation(statKey, stat, sheet.natureNumber, sheet.level, formulaPreset);
    const { results, kept } = rollDice(dice, keepWorst);
    const total = kept + bonus;
    addRoll({
      pokemonName: sheet.name || 'Desconhecido',
      actionName: `Teste de ${label}`,
      notation: str, diceResults: results, keptResult: kept,
      bonus, total, isCrit: kept >= 20, isStab: false, statusEffects: []
    });
    toast(`Rolou ${label}: ${total}`, {
      description: `[${results.join(', ')}] → Mantido: ${kept} ${bonus >= 0 ? '+' : ''}${bonus}`,
      icon: <Dices className="h-4 w-4" />
    });
  };

  // ── Roll Attack ────────────────────────────────────────────────────────────
  const handleRollAttack = (attackId: string) => {
    if (!sheet || !derived) return;
    const attack = attacks.find(a => a.id === attackId);
    if (!attack) return;

    const isPhysical = attack.category === 'Físico';
    const isSpecial  = attack.category === 'Especial';
    const statKey: keyof Pokemon['stats'] = isSpecial ? 'spAtk' : 'atk';

    const { dice, keepWorst, bonus, str } = getStatDiceNotation(statKey, sheet.stats[statKey], sheet.natureNumber, sheet.level, formulaPreset);
    const accPenalty   = attack.accuracy < 100 ? Math.floor((attack.accuracy - 100) / 2) : 0;
    const accStageBonus = applyStageFormula('stageAccuracy', 0, sheet.stages.accuracy, sheet.level, formulaPreset);
    const isStab       = !!(attack.stab && sheet.types.includes(attack.type));
    const baseDmgBonus = isPhysical ? derived.bonusDanoFisEff : derived.bonusDanoEspEff;

    // Attack test roll
    const { results, kept } = rollDice(dice, keepWorst);
    const effectiveCritRange = getEffectiveCritRange(attack.critRange, sheet.stages.crit, sheet.level, formulaPreset);
    const isCrit = kept >= effectiveCritRange;
    const attackTotal = kept + bonus + accPenalty + accStageBonus;

    // Damage roll
    let damageNotation = '';
    let damageResults: number[] = [];
    let damageTotal = 0;

    if (attack.power && attack.category !== 'Status') {
      const dmgEntry = isPhysical ? getPhysicalDamage(attack.power, formulaPreset) : getSpecialDamage(attack.power, formulaPreset);
      damageResults  = rollDamage(dmgEntry.dice, dmgEntry.sides);
      const dmgSum   = damageResults.reduce((s, v) => s + v, 0);
      const stabBonus = isStab ? baseDmgBonus : 0;
      damageTotal    = dmgSum + dmgEntry.bonus + baseDmgBonus + stabBonus;
      damageNotation = `${dmgEntry.notation} +${baseDmgBonus}(dano)${isStab ? ` +${stabBonus}(STAB)` : ''}`;
    }

    // Status chances
    const statusEffects: string[] = [];
    (attack.statusChances || []).forEach(sc => {
      const { roll, success } = rollStatusChance(sc.chance);
      statusEffects.push(`${sc.effect}: ${success ? 'Ativado!' : 'Falhou'} (${sc.chance >= 100 ? formatStatusChance(sc.chance) : `${roll}/10`})`);
    });

    const notation = `${str}${accPenalty !== 0 ? ` ${accPenalty}(acc)` : ''}${accStageBonus !== 0 ? ` ${accStageBonus > 0 ? '+' : ''}${accStageBonus}(acc stage)` : ''}`;

    addRoll({
      pokemonName: sheet.name || 'Desconhecido',
      actionName: `Ataque: ${attack.name}`,
      notation, diceResults: results, keptResult: kept,
      bonus: bonus + accPenalty + accStageBonus,
      total: attackTotal, isCrit, isStab, statusEffects,
      damageNotation, damageResults, damageTotal,
      attackTestTotal: attackTotal,
    });

    toast(isCrit ? `CRÍTICO! ${attack.name}` : `${attack.name}: ${attackTotal}`, {
      description: `Teste: ${attackTotal}${attack.power ? ` | Dano: ${damageTotal}` : ''}${isCrit ? ' | CRÍTICO!' : ''}`,
      icon: <Swords className="h-4 w-4" />
    });
  };

  const [isAttackModalOpen, setIsAttackModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [attackSearch, setAttackSearch] = useState('');
  const [copiedPokedex, setCopiedPokedex] = useState(false);

  const handleCopyPokedex = () => {
    if (!sheet?.pokedexDescription) return;
    navigator.clipboard.writeText(sheet.pokedexDescription).then(() => {
      setCopiedPokedex(true);
      setTimeout(() => setCopiedPokedex(false), 2000);
    });
  };

  const handleAddAttack = (attackId: string) => {
    if (!canEditMoves) {
      toast.error('Apenas o GM pode alterar os movimentos.');
      return;
    }
    if (!sheet) return;
    if (sheet.attacks.length >= 4) {
      toast.error('Cada Pokémon pode ter no máximo 4 ataques.');
      return;
    }
    if (!sheet.attacks.includes(attackId)) handleChange({ attacks: [...sheet.attacks, attackId] });
    setIsAttackModalOpen(false);
  };

  const handleRemoveAttack = (attackId: string) => {
    if (!canEditMoves) {
      toast.error('Apenas o GM pode alterar os movimentos.');
      return;
    }
    if (!sheet) return;
    handleChange({ attacks: sheet.attacks.filter(id => id !== attackId) });
  };

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!sheet || !derived) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando ficha...</div>;
  }

  const currentTrainerName = getPokemonTrainerName(sheet, characters, trainerRecords);
  const canEditTrainer = role === 'gm' && !readOnly;
  const handleTrainerChange = (value: string) => {
    if (!canEditTrainer) return;
    const selectedName = value === 'selvagem' ? '' : value;
    const targetCharacter = characters.find(character => normalizeTrainerName(character.name) === normalizeTrainerName(selectedName));
    const targetTrainer = trainerRecords.find(trainer => normalizeTrainerName(trainer.name) === normalizeTrainerName(selectedName));
    const target = targetCharacter
      ? { kind: 'character' as const, id: targetCharacter.id, name: targetCharacter.name }
      : targetTrainer
        ? { kind: 'trainer' as const, id: targetTrainer.id, name: targetTrainer.name }
        : null;

    if (selectedName && !target) {
      toast.error('Não foi possível localizar essa ficha de treinador.');
      return;
    }
    if (target) {
      const conflict = getPokemonAssignmentConflict(sheet, target, characters, trainerRecords);
      if (conflict) {
        toast.error(`${sheet.name} já está associado a ${conflict}. Desvincule-o antes de atribuí-lo a outra ficha.`);
        return;
      }
    }

    const nextTrainerName = target?.name || selectedName;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setSheet(current => current ? { ...current, trainerName: nextTrainerName } : current);
    updatePokemon(sheet.id, { trainerName: nextTrainerName });

    if (!nextTrainerName) {
      characters.filter(character => characterHasPokemon(character, sheet.id)).forEach(character => {
        updateCharacter(character.id, {
          partyPokemonIds: character.partyPokemonIds.filter(id => id !== sheet.id),
          pcPokemonIds: character.pcPokemonIds.filter(id => id !== sheet.id),
        });
      });
    } else if (targetCharacter && !characterHasPokemon(targetCharacter, sheet.id)) {
      const roster = getCharacterPokemonRoster(targetCharacter, pokemon, characters);
      const partyCountWithoutThisPokemon = roster.partyPokemonIds.filter(id => id !== sheet.id).length;
      const partyPokemonIds = targetCharacter.partyPokemonIds.filter(id => id !== sheet.id);
      const pcPokemonIds = targetCharacter.pcPokemonIds.filter(id => id !== sheet.id);
      if (partyCountWithoutThisPokemon < 6) {
        updateCharacter(targetCharacter.id, { partyPokemonIds: [...partyPokemonIds, sheet.id], pcPokemonIds });
      } else {
        updateCharacter(targetCharacter.id, { partyPokemonIds, pcPokemonIds: [...pcPokemonIds, sheet.id] });
      }
    }

    syncPokemonTrainerRecord(sheet.id, targetTrainer?.id);
  };

  const statLabels: Record<keyof Pokemon['stats'], string> = {
    hp: 'HP', atk: 'ATK', def: 'DEF', spAtk: 'SP.ATK', spDef: 'SP.DEF', spe: 'SPEED'
  };

  return (
    <div
      className="pokemon-sheet flex min-w-0 flex-col gap-4 pb-8 animate-in fade-in duration-300 sm:gap-5 sm:pb-12"
      style={{ '--pokemon-accent': TYPE_COLORS[sheet.types[0] || 'Normal'] } as React.CSSProperties}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="pokemon-sheet-header grid grid-cols-1 items-start gap-4 rounded-2xl border p-4 shadow-sm sm:gap-6 sm:p-6 md:grid-cols-[180px_minmax(0,1fr)]">
        {/* Avatar */}
        <div className="group relative mx-auto flex h-28 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-secondary/30 sm:mx-0 sm:h-36 sm:w-36 md:h-44 md:w-44" style={{ borderColor: 'color-mix(in srgb, var(--pokemon-accent) 60%, transparent)' }} onClick={() => setIsImageModalOpen(true)}>
          {sheet.image
            ? <img src={sheet.image} alt={sheet.name} className="w-full h-full object-cover" />
            : <div className="text-7xl text-muted-foreground opacity-20 font-bold">?</div>}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Camera className="text-white h-8 w-8" />
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 w-full space-y-4">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 w-full flex-1 sm:w-auto">
             <input
              className="w-full border-none bg-transparent p-0 text-3xl font-black text-foreground outline-none placeholder:text-muted-foreground sm:text-4xl"
              value={sheet.name}
              onChange={e => handleChange({ name: e.target.value })}
              placeholder="Nome do Pokémon"
              aria-label="Nome do Pokémon"
            />
            {sheet.name.includes(':') && <p className="mt-1 text-sm text-muted-foreground"><RichText text={sheet.name} /></p>}
            </div>
             <div className={`grid w-full grid-cols-1 gap-3 sm:w-auto ${role === 'gm' && !readOnly ? 'sm:grid-cols-2' : ''}`}>
             <div>
               <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Espécie</label>
              <Input value={sheet.species} onChange={e => handleChange({ species: e.target.value })} placeholder="Ex: Pokémon Pedra de Sal" className="h-8" />
              {sheet.species.includes(':') && <p className="mt-1 text-xs text-muted-foreground"><RichText text={sheet.species} /></p>}
             </div>
              {role === 'gm' && !readOnly && (
                <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-2.5">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registro da Pokédex</label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (role === 'gm' && !readOnly) handleChange({ inDex: !sheet.inDex });
                    }}
                    className={`h-auto min-h-10 w-full justify-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      sheet.inDex
                        ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                        : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5'
                    }`}
                    aria-pressed={sheet.inDex}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${sheet.inDex ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                      {sheet.inDex ? <Check size={15} /> : <Plus size={15} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{sheet.inDex ? 'Na Pokédex pública' : 'Registrar Pokémon'}</span>
                      <span className="block truncate text-[10px] font-normal opacity-75">{sheet.inDex ? 'Visível no Arquivo compartilhado' : 'Compartilhar com o Arquivo'}</span>
                    </span>
                  </Button>
                </div>
              )}
           </div>
          </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Types */}
             <div className="flex items-center gap-1.5" role="group" aria-label="Tipos do Pokémon">
               <PokemonTypePicker
                 type={sheet.types[0] || 'Normal'}
                 label="Tipo principal"
                 occupiedType={sheet.types[1]}
                 disabled={!canEdit}
                 onChange={type => handleChange({ types: sheet.types.length > 1 ? [type, sheet.types[1]] : [type] })}
               />
              {sheet.types.length === 2 ? (
                 <div className="flex items-center gap-1">
                   <PokemonTypePicker
                     type={sheet.types[1]}
                     label="Tipo secundário"
                     occupiedType={sheet.types[0]}
                     disabled={!canEdit}
                     onChange={type => handleChange({ types: [sheet.types[0] || 'Normal', type] })}
                   />
                   <Button type="button" variant="ghost" size="icon" disabled={!canEdit} className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive" aria-label="Remover tipo secundário" title="Remover tipo secundário" onClick={() => handleChange({ types: [sheet.types[0]] })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                 <Button type="button" variant="outline" size="icon" disabled={!canEdit} className="h-10 w-10 rounded-full border-dashed text-muted-foreground" aria-label="Adicionar tipo secundário" title="Adicionar tipo secundário" onClick={() => handleChange({ types: [...sheet.types, 'Normal' as PokemonType] })}>
                   <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Gender */}
             <div className="flex h-11 items-center gap-1 rounded-full border border-border bg-background/70 p-1" role="radiogroup" aria-label="Gênero do Pokémon">
               {([
                 { value: 'Macho', label: 'Macho', Icon: Mars },
                 { value: 'Fêmea', label: 'Fêmea', Icon: Venus },
                 { value: 'Indefinido', label: 'Indefinido', Icon: CircleHelp },
               ] as const).map(({ value, label, Icon }) => {
                 const selected = sheet.gender === value;
                 return (
                   <button
                     key={value}
                     type="button"
                     role="radio"
                     aria-checked={selected}
                     aria-label={label}
                     title={label}
                     disabled={!canEdit}
                     onClick={() => handleChange({ gender: value })}
                     className={`grid h-8 w-8 place-items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'shadow-sm' : 'border-transparent text-muted-foreground hover:bg-muted'}`}
                     style={selected ? {
                       color: 'var(--pokemon-accent)',
                       backgroundColor: 'color-mix(in srgb, var(--pokemon-accent) 16%, transparent)',
                       borderColor: 'color-mix(in srgb, var(--pokemon-accent) 48%, transparent)',
                     } : undefined}
                   >
                     <Icon className="h-4 w-4" aria-hidden="true" />
                   </button>
                 );
               })}
             </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-md border border-border">
                <span className="text-sm font-bold text-muted-foreground">LVL</span>
                <input type="number" value={sheet.level} onChange={e => handleChange({ level: Number(e.target.value) || 1 })}
                  className="w-12 bg-transparent border-b border-muted-foreground/30 outline-none text-center font-bold font-mono" />
              </div>
              {role !== 'public' && (
                <div
                  className="flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"
                  title={`Afeição: ${sheet.affection}`}
                >
                  <Heart size={15} aria-hidden="true" />
                  <span>{affectionLabel(sheet.affection)}</span>
                </div>
              )}
            </div>
             <div className="min-w-[220px] rounded-md border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs">
               <div className="flex items-center justify-between gap-3"><span className="font-semibold text-muted-foreground">EXP atual</span><strong className="font-mono text-primary">{sheet.xp} / {nextLevelXp}</strong></div>
               <div className="mt-0.5 text-muted-foreground">Próximo nível: <b className="text-foreground">{nextLevelXp} EXP</b> · Crescimento: <b className="text-foreground">{POKEMON_GROWTH_VALUES[sheet.growthRate || 'Meio rápido']} por nível</b></div>
                {canEditMoves && (
                  <label className="mt-2 block font-semibold text-muted-foreground">
                    VELOCIDADE DE CRESCIMENTO
                    <select
                      value={sheet.growthRate || 'Meio rápido'}
                      onChange={event => handleChange({ growthRate: event.target.value as Pokemon['growthRate'] })}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-normal text-foreground"
                      aria-label="Velocidade de crescimento do Pokémon"
                      data-testid="select-sheet-growth-rate"
                    >
                      {Object.keys(POKEMON_GROWTH_VALUES).map(rate => <option key={rate} value={rate}>{rate}</option>)}
                    </select>
                  </label>
                )}
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border">
            <div>
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Nature (1-25)</label>
              <div className="flex items-center gap-2">
                 <Input type="number" min={1} max={25} disabled={!canEditMoves} value={sheet.natureNumber} onChange={e => handleChange({ natureNumber: Number(e.target.value) || 1 })} className="w-16 h-8 text-center font-mono" />
                 {canEditMoves && <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRandomNature} title="Sortear natureza"><Dices className="h-3.5 w-3.5" /></Button>}
                <div className="text-sm">
                  <span className="font-bold text-primary">{natureEffects.name}</span>
                  <div className="text-[10px] text-muted-foreground leading-tight">
                    {natureEffects.bonus ? `▲ ${(natureEffects.bonus as string).toUpperCase()}` : ''}
                    {natureEffects.penalty ? ` ▼ ${(natureEffects.penalty as string).toUpperCase()}` : ''}
                    {!natureEffects.bonus && !natureEffects.penalty && 'Neutra'}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Catch Rate</label>
              <Input type="number" min={1} max={255} value={sheet.catchRate} onChange={e => handleChange({ catchRate: Number(e.target.value) || 1 })} className="h-8" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">EV Cedido ao ser Derrotado</label>
              <Input value={sheet.evGained} onChange={e => handleChange({ evGained: e.target.value })} className="h-8" placeholder="Ex: +1 ATK, +1 SPE" />
            </div>
          </div>
        </div>
      </div>

      <Card className="border-red-500/20 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <Heart className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wide">Vida</span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-600" disabled={!canEdit || sheet.hp <= 0} aria-label="Aplicar dano" data-testid="button-hp-damage" onClick={() => { setHpAmount(''); setHpDialog('damage'); }}><Minus className="h-4 w-4" /></Button>
            <span className="min-w-[3.5rem] text-center font-mono text-2xl font-black tabular-nums" data-testid="text-hp-current">{sheet.hp}</span>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600" disabled={!canEdit || sheet.hp >= sheet.hpMax} aria-label="Curar" data-testid="button-hp-heal" onClick={() => { setHpAmount(''); setHpDialog('heal'); }}><Plus className="h-4 w-4" /></Button>
            <span className="font-mono text-lg text-muted-foreground">/ {sheet.hpMax} PV</span>
          </div>
          <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-red-600 transition-[width]" style={{ width: `${sheet.hpMax ? Math.round((sheet.hp / sheet.hpMax) * 100) : 0}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* ── ITEM & ABILITY ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { field: 'item' as const, descField: 'itemDescription' as const, label: 'Item Equipado', color: 'primary' },
          { field: 'ability' as const, descField: 'abilityDescription' as const, label: 'Habilidade', color: 'blue-500' },
        ].map(({ field, descField, label, color }) => (
          <Card key={field} className={`border-${color}/20 shadow-sm bg-gradient-to-br from-card to-card/50`}>
            <Collapsible>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex-1 mr-4">
                  <label className={`text-xs text-${color} font-bold uppercase tracking-wider mb-1 block`}>{label}</label>
                   <input
                     className="font-bold text-lg w-full bg-transparent outline-none border-b border-transparent focus:border-primary/50 transition-colors disabled:opacity-70"
                     value={sheet[field] || ''}
                     onChange={e => handleChange({ [field]: e.target.value } as any)}
                     placeholder={`Nome do ${label}...`}
                     disabled={!canEdit}
                   />
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-9 p-0"><ChevronDown className="h-4 w-4" /></Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4">
                  {editingDescription === descField ? (
                    <div className="space-y-2">
                      <Textarea
                        autoFocus
                        className="min-h-[80px] text-sm bg-background/50 resize-y"
                        placeholder="Descrição..."
                        value={descriptionDraft}
                        onChange={event => setDescriptionDraft(event.target.value)}
                        aria-label={`Descrição de ${label}`}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingDescription(null)}>
                          <X className="mr-1 h-4 w-4" /> Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            handleChange({ [descField]: descriptionDraft } as Partial<Pokemon>);
                            setEditingDescription(null);
                          }}
                        >
                          <Check className="mr-1 h-4 w-4" /> Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-md bg-secondary/30 p-2">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">
                        {sheet[descField]
                          ? <RichText text={sheet[descField]} replaceTypeNames />
                          : <span className="text-muted-foreground">Sem descrição cadastrada.</span>}
                      </p>
                      {canEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          aria-label={`Editar descrição de ${label}`}
                          title={`Editar descrição de ${label}`}
                          onClick={() => {
                            setDescriptionDraft(sheet[descField] || '');
                            setEditingDescription(descField);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {formulaFallback && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300" data-testid="text-formula-fallback">As fórmulas ativas falharam para este Pokémon; usando o preset Original temporariamente.</div>}
      {/* ── STATS TABLE ────────────────────────────────────────────────────── */}
       <Card className="shadow-lg border-border/60">
        <CardHeader className="py-4 border-b border-border bg-card/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2 text-xl"><Activity className="text-primary" /> Estatísticas</CardTitle>
           <div className="grid w-full gap-2 sm:flex sm:w-auto sm:items-center">
             {canEditMoves && <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-2">
               <span className="w-full text-xs font-semibold text-muted-foreground sm:w-auto">Sortear</span>
               <Button size="sm" variant="outline" className="min-w-[86px] flex-1 gap-1.5 px-2 sm:flex-none" onClick={randomizeLevelPoints} title="Sortear pontos de nível"><Dices className="h-3.5 w-3.5" /> Nível</Button>
               <Button size="sm" variant="outline" className="min-w-[70px] flex-1 gap-1.5 px-2 sm:flex-none" onClick={randomizeEvs} title="Sortear EVs do zero"><Dices className="h-3.5 w-3.5" /> EV</Button>
               <Button size="sm" variant="outline" className="min-w-[70px] flex-1 gap-1.5 px-2 sm:flex-none" onClick={randomizeIvs} title="Sortear IVs novamente"><Dices className="h-3.5 w-3.5" /> IV</Button>
             </div>}
              {canEditMoves && (
               <div className="relative w-full sm:w-52">
                 <Input placeholder="IVs: A SS B S A C" className="h-8 pr-16 text-xs font-mono" value={ivPaste} onChange={e => setIvPaste(e.target.value)} />
                 <Button size="sm" variant="ghost" className="absolute right-0 top-0 h-8 px-2 text-xs hover:bg-primary/20 hover:text-primary" onClick={handleParseIVs}>Aplicar</Button>
               </div>
             )}
          </div>
        </CardHeader>
         <CardContent className="p-0">
          <div className="pokemon-stat-responsive">
           <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-xs text-left sm:text-sm">
            <thead className="bg-secondary/30 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-2 py-2 font-bold w-16 sm:px-4 sm:py-3 sm:w-24">Stat</th>
                <th className="px-2 py-3 text-center">Base</th>
                 <th className="px-2 py-3 text-center">Nível</th>
                  <th className="px-2 py-3 text-center">EV{!canEditMoves && <span className="block text-[9px] normal-case font-normal">Somente GM</span>}</th>
                  <th className="px-2 py-3 text-center">IV{!canEditMoves && <span className="block text-[9px] normal-case font-normal">Somente GM</span>}</th>
                <th className="px-3 py-3 text-center border-l border-border/50">Final</th>
                <th className="px-3 py-3 text-center">Bônus</th>
                <th className="px-2 py-2 text-right sm:px-4 sm:py-3">Dado<span className="hidden sm:inline"> (clique p/ rolar)</span></th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(statLabels) as Array<keyof Pokemon['stats']>).map(key => {
                const stat = sheet.stats[key];
                const dn     = getStatDiceNotation(key, stat, sheet.natureNumber, sheet.level, formulaPreset);
                const final  = dn.final;
                const bonus  = dn.bonus;
                return (
                  <tr key={key} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-2 py-1.5 font-black text-foreground sm:px-4 sm:py-2">
                      {statLabels[key]}
                      {natureEffects.bonus === key && <span className="text-green-400 ml-1 text-xs">▲</span>}
                      {natureEffects.penalty === key && <span className="text-red-400 ml-1 text-xs">▼</span>}
                    </td>
                    <td className="px-2 py-2"><Input type="number" className="h-8 w-12 mx-auto text-center p-1 sm:w-16" value={stat.base || ''} onChange={e => handleStatChange(key, 'base', Number(e.target.value))} /></td>
                    <td className="px-2 py-2"><Input type="number" className="h-8 w-12 mx-auto text-center p-1 sm:w-16" value={stat.levelPoints || ''} onChange={e => handleStatChange(key, 'levelPoints', Number(e.target.value))} /></td>
                     <td className="px-2 py-2"><Input type="number" disabled={!canEditMoves} className="h-8 w-12 mx-auto text-center p-1 sm:w-16" value={stat.ev || ''} onChange={e => handleStatChange(key, 'ev', Number(e.target.value))} /></td>
                     <td className="px-2 py-2 text-center">
                       <Select value={stat.iv} onValueChange={v => handleStatChange(key, 'iv', v)} disabled={!canEditMoves}>
                        <SelectTrigger className="h-8 w-12 mx-auto px-1 sm:w-16 sm:px-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['SS','S','A','B','C','D'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-lg border-l border-border/50">{final}</td>
                    <td className="px-3 py-2 text-center font-bold text-muted-foreground">{bonus >= 0 ? `+${bonus}` : bonus}</td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className="font-mono text-primary cursor-pointer hover:bg-primary/20 px-2 py-1 rounded transition-colors"
                        onClick={() => handleRollStat(key, statLabels[key])}
                        title="Clique para rolar"
                      >
                        {dn.str}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
           </div>

          </div>

          <div className="p-4 bg-secondary/10 flex flex-col sm:flex-row justify-between items-center border-t border-border gap-4">
            <div className="flex gap-6 text-sm">
              <div className={`font-medium ${levelPointsUsed > sheet.level * 3 ? 'text-destructive' : 'text-muted-foreground'}`}>
                Pontos de Nível: {levelPointsUsed} / {sheet.level * 3}
              </div>
              <div className={`font-medium ${evsUsed > 510 ? 'text-destructive' : 'text-muted-foreground'}`}>
                EVs: {evsUsed} / 510
              </div>
            </div>
            {canEditMoves && (
              <Collapsible className="w-full sm:w-auto">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs">Colar Base Stats</Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 w-full sm:w-[300px]">
                  <Textarea className="text-xs font-mono h-24 mb-2" placeholder="Cole do Pokémon Database aqui..." value={baseStatsPaste} onChange={e => setBaseStatsPaste(e.target.value)} />
                  <Button size="sm" className="w-full" onClick={handleParseBaseStats}>Aplicar</Button>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── DERIVED STATS ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {[
          { icon: <Heart className="h-4 w-4 text-green-500" />, label: 'HP calculado', value: derived.hp, color: 'text-green-500' },
          { icon: <Shield className="h-4 w-4 text-orange-400" />, label: 'RD Fís.', value: derived.rdFisicaEff, base: derived.rdFisica, color: '' },
          { icon: <Shield className="h-4 w-4 text-blue-400" />, label: 'RD Esp.', value: derived.rdEspecialEff, base: derived.rdEspecial, color: '' },
          { icon: <Zap className="h-4 w-4 text-yellow-400" />, label: 'Esquiva', value: derived.esquivaEff, base: derived.esquiva, color: '' },
          { icon: <Activity className="h-4 w-4 text-purple-400" />, label: 'Iniciativa', value: derived.iniciativaEff, base: derived.iniciativa, color: '' },
          { icon: <Swords className="h-4 w-4 text-orange-500" />, label: 'Dano Fís.', value: derived.bonusDanoFisEff, base: derived.bonusDanoFis, prefix: '+', color: 'text-orange-500' },
          { icon: <Swords className="h-4 w-4 text-blue-500" />, label: 'Dano Esp.', value: derived.bonusDanoEspEff, base: derived.bonusDanoEsp, prefix: '+', color: 'text-blue-500' },
        ].map(({ icon, label, value, base, prefix = '', color }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-3 text-center flex flex-col justify-center">
            <div className="mx-auto mb-1 opacity-50">{icon}</div>
            <span className="text-xs text-muted-foreground font-bold uppercase leading-tight">{label}</span>
            <span className={`text-xl font-bold ${color}`}>{prefix}{value}</span>
            {base !== undefined && base !== value && (
              <span className="text-[10px] text-muted-foreground">(base: {prefix}{base})</span>
            )}
          </div>
        ))}
      </div>

      {/* ── ESTÁGIOS ───────────────────────────────────────────────────────── */}
      <Card className="shadow-sm border-border">
        <CardHeader className="py-3 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-yellow-400" /> Estágios de Batalha</CardTitle>
          <Button size="sm" variant="outline" onClick={handleResetStages}>
            <RefreshCw className="h-3 w-3 mr-1" /> Resetar
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Ofensivo (×1.3 por estágio no Dano)</p>
              <StageRow label="ATK" value={sheet.stages.atk} min={-6} max={6} onChange={v => handleStageChange('atk', v)} />
              <StageRow label="SP.ATK" value={sheet.stages.spAtk} min={-6} max={6} onChange={v => handleStageChange('spAtk', v)} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Defensivo (×1.3 por estágio na RD)</p>
              <StageRow label="DEF" value={sheet.stages.def} min={-6} max={6} onChange={v => handleStageChange('def', v)} />
              <StageRow label="SP.DEF" value={sheet.stages.spDef} min={-6} max={6} onChange={v => handleStageChange('spDef', v)} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Velocidade (+10 por estágio na Iniciativa)</p>
              <StageRow label="SPE" value={sheet.stages.spe} min={-6} max={6} onChange={v => handleStageChange('spe', v)} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Outros</p>
              <StageRow label="Precisão" value={sheet.stages.accuracy} min={-6} max={6} onChange={v => handleStageChange('accuracy', v)} />
              <StageRow label="Evasiva" value={sheet.stages.evasion} min={-3} max={3} onChange={v => handleStageChange('evasion', v)} />
              <StageRow label="Crítico" value={sheet.stages.crit} min={-6} max={6} onChange={v => handleStageChange('crit', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── ATTACKS ────────────────────────────────────────────────────────── */}
      <Card className="shadow-sm border-border">
        <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Swords className="text-primary" /> Ataques</CardTitle>
           {canEditMoves && <Button size="sm" onClick={() => setIsAttackModalOpen(true)}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>}
        </CardHeader>
        <CardContent className="p-0">
          {sheet.attacks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum ataque adicionado.</div>
          ) : (
            <div className="divide-y divide-border">
              {sheet.attacks.map(attackId => {
                const attack = attacks.find(a => a.id === attackId);
                if (!attack) return null;
                const isStab = !!(attack.stab && sheet.types.includes(attack.type));
                const dmgNotation = attack.power && attack.category !== 'Status'
                  ? (attack.category === 'Físico' ? getPhysicalDamage(attack.power, formulaPreset) : getSpecialDamage(attack.power, formulaPreset)).notation
                  : null;
                return (
                   <Collapsible key={attack.id}>
                     <div
                       className="pokemon-move-row flex flex-col gap-3 p-3 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                       style={{ '--move-accent': TYPE_COLORS[attack.type] } as React.CSSProperties}
                     >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <TypeIconBadge type={attack.type} size={26} />
                        <CategoryIcon category={attack.category} size={18} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="truncate font-bold text-foreground">{attack.name}</span>
                            {isStab && <Badge variant="outline" className="text-[10px] h-4 py-0 border-primary/50 text-primary">STAB</Badge>}
                            {attack.makesContact && <Badge variant="outline" className="text-[10px] h-4 py-0">Contato</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-0.5">
                            {attack.power !== null && <span>Poder: <b>{attack.power}</b></span>}
                            {dmgNotation && <span className="font-mono text-primary/80">{dmgNotation}</span>}
                            <span>Acc: {attack.accuracy}%</span>
                            <span>Crit: {getEffectiveCritRange(attack.critRange, sheet.stages.crit, sheet.level, formulaPreset)}+</span>
                            {(attack.statusChances||[]).map((sc, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] h-4 py-0 bg-background">{sc.effect} ({formatStatusChance(sc.chance)})</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-1">
                        <Button variant="default" size="sm" className="h-9 gap-1 font-bold bg-primary hover:bg-primary/90 sm:h-8"
                          onClick={e => { e.stopPropagation(); handleRollAttack(attack.id); }}>
                          <Dices className="h-4 w-4" /> <span>Rolar</span>
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronDown className="h-4 w-4" /></Button>
                        </CollapsibleTrigger>
                         {canEditMoves && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/20"
                          onClick={() => handleRemoveAttack(attack.id)}>
                          <Trash2 className="h-4 w-4" />
                         </Button>}
                      </div>
                    </div>
                    <CollapsibleContent>
                      <div className="px-12 pb-4 pt-1 text-sm bg-secondary/10">
                        {attack.effectSummary && <p className="mb-1 font-medium text-primary"><RichText text={attack.effectSummary} replaceTypeNames /></p>}
                        <p className="mb-2 whitespace-pre-wrap text-muted-foreground"><RichText text={attack.effectFull} replaceTypeNames /></p>
                        <div className="flex flex-wrap gap-4 text-xs">
                          <span><b>Alvo:</b> <RichText text={attack.target} replaceTypeNames /></span>
                          <span><b>PP:</b> {attack.pp}</span>
                          {attack.priority !== 0 && <span><b>Prioridade:</b> {attack.priority > 0 ? `+${attack.priority}` : attack.priority}</span>}
                          <span><b>Contato:</b> {attack.makesContact ? 'Sim' : 'Não'}</span>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── LORE ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3 px-4 border-b border-border">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Treinador & História</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
             <div>
              <label className="text-xs text-muted-foreground block mb-1">Nome do Treinador</label>
                <Select value={currentTrainerName || 'selvagem'} onValueChange={handleTrainerChange} disabled={!canEditTrainer}>
                  <SelectTrigger><SelectValue placeholder="Selecionar treinador" /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="selvagem">Selvagem</SelectItem>
                    {characters.map(character => <SelectItem
                      key={`character-${character.id}`}
                      value={character.name}
                      disabled={!!getPokemonAssignmentConflict(sheet, { kind: 'character', id: character.id, name: character.name }, characters, trainerRecords)}
                    >{character.name} · ficha de jogador</SelectItem>)}
                    {trainerRecords
                      .filter(record => record.name && !characters.some(character => normalizeTrainerName(character.name) === normalizeTrainerName(record.name)))
                      .map(record => <SelectItem
                        key={`trainer-${record.id}`}
                        value={record.name}
                        disabled={!!getPokemonAssignmentConflict(sheet, { kind: 'trainer', id: record.id, name: record.name }, characters, trainerRecords)}
                      >{record.name} · NPC</SelectItem>)}
                    {currentTrainerName
                      && !characters.some(character => normalizeTrainerName(character.name) === normalizeTrainerName(currentTrainerName))
                      && !trainerRecords.some(record => normalizeTrainerName(record.name) === normalizeTrainerName(currentTrainerName))
                      && <SelectItem value={currentTrainerName} disabled>{currentTrainerName} · vínculo antigo</SelectItem>}
                 </SelectContent>
               </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">História com o Pokémon</label>
              <Textarea value={sheet.history} onChange={e => handleChange({ history: e.target.value })} placeholder="Como se conheceram..." className="min-h-[120px] resize-none" />
              {sheet.history.trim() && <p className="mt-2 whitespace-pre-wrap rounded-md bg-secondary/30 p-2 text-sm"><RichText text={sheet.history} /></p>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1" htmlFor="pokemon-notes">Anotações</label>
              <Textarea id="pokemon-notes" value={sheet.notes || ''} disabled={!canEdit} onChange={e => handleChange({ notes: e.target.value })} placeholder="Observações, condições, lembretes de combate..." className="min-h-[100px] resize-y" data-testid="textarea-pokemon-notes" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardHeader className="py-3 px-4 border-b border-border bg-primary/5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">Descrição da Pokédex</CardTitle>
            <div className="flex items-center gap-1">
              {canEdit && <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={editingPokedexDescription ? 'Cancelar edição da descrição' : 'Editar descrição da Pokédex'}
                title={editingPokedexDescription ? 'Cancelar edição' : 'Editar descrição'}
                onClick={() => {
                  if (editingPokedexDescription) {
                    setEditingPokedexDescription(false);
                    return;
                  }
                  setPokedexDescriptionDraft(sheet.pokedexDescription || '');
                  setEditingPokedexDescription(true);
                }}
              >
                {editingPokedexDescription ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </Button>}
              <Button
                variant="ghost" size="sm"
                onClick={handleCopyPokedex}
                disabled={!sheet.pokedexDescription}
                className={`h-7 gap-1 text-xs transition-colors ${copiedPokedex ? 'text-green-400 hover:text-green-400' : 'text-muted-foreground'}`}
                title="Copiar descrição completa"
              >
                {copiedPokedex ? <><Check className="h-3.5 w-3.5" /> Copiado!</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {editingPokedexDescription ? (
              <div className="space-y-2">
                <Textarea
                  autoFocus
                  value={pokedexDescriptionDraft}
                  onChange={event => setPokedexDescriptionDraft(event.target.value)}
                  placeholder="Anotações biológicas..."
                  className="min-h-[200px] resize-y border-primary/20 bg-background/50"
                  aria-label="Descrição da Pokédex"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPokedexDescription(false)}>
                    <X className="mr-1 h-4 w-4" /> Cancelar
                  </Button>
                  <Button type="button" size="sm" onClick={() => {
                    handleChange({ pokedexDescription: pokedexDescriptionDraft });
                    setEditingPokedexDescription(false);
                  }}>
                    <Check className="mr-1 h-4 w-4" /> Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="min-h-12 whitespace-pre-wrap break-words rounded-md bg-secondary/30 p-3 text-sm leading-relaxed">
                {sheet.pokedexDescription
                  ? <RichText text={sheet.pokedexDescription} />
                  : <span className="text-muted-foreground">Ainda não há descrição. Use o lápis para adicionar uma.</span>}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── HP DIALOG ───────────────────────────────────────────────────── */}
      <Dialog open={!!hpDialog} onOpenChange={open => { if (!open) setHpDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{hpDialog === 'damage' ? <><Minus className="h-4 w-4 text-red-600" /> Aplicar dano</> : <><Plus className="h-4 w-4 text-emerald-600" /> Curar</>}</DialogTitle>
            <DialogDescription>Vida atual: {sheet.hp} / {sheet.hpMax} PV</DialogDescription>
          </DialogHeader>
          {(() => {
            const amount = Math.max(0, Math.floor(Number(hpAmount) || 0));
            const rd = hpDamageKind === 'physical' ? derived.rdFisicaEff : derived.rdEspecialEff;
            const applied = hpDialog === 'damage' ? Math.max(0, amount - (hpUseRd ? Math.max(0, rd) : 0)) : amount;
            const result = hpDialog === 'damage' ? Math.max(0, sheet.hp - applied) : Math.min(sheet.hpMax, sheet.hp + applied);
            const confirm = () => {
              if (!amount) return;
              handleChange({ hp: result });
              setHpDialog(null);
              toast(hpDialog === 'damage' ? `${sheet.name || 'Pokémon'} sofreu ${applied} de dano` : `${sheet.name || 'Pokémon'} recuperou ${result - sheet.hp} PV`, { description: `${result} / ${sheet.hpMax} PV` });
            };
            return <>
              <div className="space-y-3">
                <Input autoFocus type="number" min={0} inputMode="numeric" value={hpAmount} onChange={e => setHpAmount(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirm(); }} placeholder="Quantidade" className="h-11 text-center font-mono text-lg" data-testid="input-hp-amount" />
                {hpDialog === 'damage' && <>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={hpUseRd} onChange={e => setHpUseRd(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid="checkbox-hp-use-rd" />
                    Aplicar Redução de Dano
                  </label>
                  {hpUseRd && <div className="grid grid-cols-2 gap-2">
                    {([['physical', 'Física', derived.rdFisicaEff], ['special', 'Especial', derived.rdEspecialEff]] as const).map(([kind, label, value]) => (
                      <button key={kind} type="button" onClick={() => setHpDamageKind(kind)} aria-pressed={hpDamageKind === kind} className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${hpDamageKind === kind ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`} data-testid={`button-hp-rd-${kind}`}>
                        <span className="flex items-center gap-1.5 font-semibold"><Shield className="h-3.5 w-3.5" /> {label}</span>
                        <span className="font-mono text-xs opacity-80">RD {value}</span>
                      </button>
                    ))}
                  </div>}
                </>}
                <div className="rounded-lg border border-border bg-secondary/30 p-3 font-mono text-sm">
                  {hpDialog === 'damage'
                    ? <>max(0, {amount}{hpUseRd ? ` − ${Math.max(0, rd)}` : ''}) = <b>{applied}</b> de dano</>
                    : <>+{amount} PV</>}
                  <div className="mt-1 text-muted-foreground">{sheet.hp} → <b className="text-foreground">{result}</b> / {sheet.hpMax}</div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setHpDialog(null)}>Cancelar</Button>
                <Button onClick={confirm} disabled={!amount} className={hpDialog === 'damage' ? 'bg-red-600 hover:bg-red-700 text-white' : ''} data-testid="button-hp-confirm">{hpDialog === 'damage' ? 'Aplicar dano' : 'Curar'}</Button>
              </DialogFooter>
            </>;
          })()}
        </DialogContent>
      </Dialog>

      {/* ── ADD ATTACK MODAL ──────────────────────────────────────────────── */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar imagem ao Pokémon</DialogTitle><DialogDescription>Cole uma imagem da área de transferência ou escolha um arquivo.</DialogDescription></DialogHeader>
          <div tabIndex={0} autoFocus onPaste={handleImagePaste} className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 text-center outline-none focus:ring-2 focus:ring-primary">
            {sheet.image ? <img src={sheet.image} alt="Prévia" className="mx-auto mb-4 max-h-48 max-w-full rounded-lg object-contain" /> : <ClipboardPaste className="mx-auto mb-3 h-10 w-10 text-primary" />}
            <p className="font-semibold">Cole sua imagem ou aperte aqui para escolher dos arquivos</p>
            <p className="mt-1 text-xs text-muted-foreground">Clique nesta área e use Ctrl+V para colar uma imagem.</p>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-primary"><ImagePlus className="h-4 w-4" /> Escolher arquivo<input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsImageModalOpen(false)}>Cancelar</Button><Button onClick={() => setIsImageModalOpen(false)} disabled={!sheet.image}>Usar imagem</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAttackModalOpen} onOpenChange={setIsAttackModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Adicionar Ataque</DialogTitle></DialogHeader>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar no banco de ataques..." className="pl-9" value={attackSearch} onChange={e => setAttackSearch(e.target.value)} />
          </div>
          <div className="space-y-2">
            {attacks.filter(a => a.name.toLowerCase().includes(attackSearch.toLowerCase()) || a.type.toLowerCase().includes(attackSearch.toLowerCase())).map(attack => {
              const isAdded = sheet.attacks.includes(attack.id);
              return (
                <div key={attack.id} className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${isAdded ? 'bg-secondary/30 opacity-60' : 'bg-card hover:border-primary/50'}`}>
                  <div className="flex items-center gap-3">
                    <TypeIconBadge type={attack.type} size={24} />
                    <CategoryIcon category={attack.category} size={18} />
                    <div>
                      <div className="font-bold">{attack.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {attack.power !== null ? `Poder: ${attack.power} | ` : ''}Acc: {attack.accuracy}% | PP: {attack.pp}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant={isAdded ? 'secondary' : 'default'} disabled={isAdded} onClick={() => handleAddAttack(attack.id)}>
                    {isAdded ? 'Adicionado' : 'Adicionar'}
                  </Button>
                </div>
              );
            })}
            {attacks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">Nenhum ataque no banco. Vá em "Ataques" no menu.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
