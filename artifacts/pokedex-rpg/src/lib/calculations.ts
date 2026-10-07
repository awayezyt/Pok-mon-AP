import { IVRank, StatEntry, PokemonStages, defaultStages } from "./types";
import { evaluate, getActivePreset, IV_DICE, baseStatDice, physicalRoll, STAT_KEYS, STAT_SUFFIX, type FormulaKey, type FormulaPreset, type DamageRow } from "./formulas";

export const RAW_NATURE_TABLE: Record<number, { name: string, b: string, p: string }> = {
  1: { name: "Árduo", b: "atk", p: "atk" },
  2: { name: "Alegre", b: "spe", p: "spAtk" },
  3: { name: "Adamante", b: "atk", p: "spAtk" },
  4: { name: "Audacioso", b: "def", p: "atk" },
  5: { name: "Calmo", b: "spAtk", p: "spAtk" },
  6: { name: "Corajoso", b: "atk", p: "spe" },
  7: { name: "Cuidadoso", b: "spDef", p: "spAtk" },
  8: { name: "Dócil", b: "def", p: "def" },
  9: { name: "Envergonhado", b: "spAtk", p: "spAtk" },
  10: { name: "Frouxo", b: "def", p: "spDef" },
  11: { name: "Gentil", b: "spDef", p: "def" },
  12: { name: "Ingênuo", b: "spe", p: "spDef" },
  13: { name: "Imprudente", b: "spAtk", p: "spDef" },
  14: { name: "Irreverente", b: "spDef", p: "spe" },
  15: { name: "Modesto", b: "spAtk", p: "atk" },
  16: { name: "Peculiar", b: "spDef", p: "spDef" },
  17: { name: "Perverso", b: "atk", p: "spDef" },
  18: { name: "Precipitado", b: "spe", p: "def" },
  19: { name: "Relaxado", b: "def", p: "spe" },
  20: { name: "Quieto", b: "spAtk", p: "spe" },
  21: { name: "Sério", b: "spe", p: "spe" },
  22: { name: "Suave", b: "spAtk", p: "def" },
  23: { name: "Solitário", b: "atk", p: "def" },
  24: { name: "Tímido", b: "spe", p: "atk" },
  25: { name: "Travesso", b: "def", p: "spAtk" }
};

export function getNatureEffects(natureId: number) {
  const n = RAW_NATURE_TABLE[natureId];
  if (!n) return { name: "Desconhecida", bonus: null, penalty: null };
  if (n.b === n.p) return { name: n.name, bonus: null, penalty: null };
  return { name: n.name, bonus: n.b, penalty: n.p };
}

export function getIVBaseDiceCount(iv: IVRank): number {
  return IV_DICE[iv] ?? 1;
}

type StatKey = keyof AllStats;
type AllStats = { hp: StatEntry; atk: StatEntry; def: StatEntry; spAtk: StatEntry; spDef: StatEntry; spe: StatEntry };

/** Logical dice count (can be 0 or negative) for a stat, using the active preset's dice mode. */
export function getLogicalDice(statKey: string, stat: StatEntry, natureId: number, preset: FormulaPreset = getActivePreset()): number {
  let d = preset.diceMode === 'base' ? baseStatDice(stat.base) : getIVBaseDiceCount(stat.iv);
  const nature = getNatureEffects(natureId);
  if (nature.bonus === statKey) d += 1;
  else if (nature.penalty === statKey) d -= 1;
  return Math.max(0, d);
}

function statVars(stat: StatEntry, level: number, dice: number, preset: FormulaPreset) {
  return {
    N: level, Bs: Number(stat.base) || 0, EVs: Number(stat.evPoints ?? stat.levelPoints) || 0,
    IVs: preset.ivValues[stat.iv] ?? 0, Ds: dice,
  };
}

export function calculateStatFinal(stat: StatEntry, level = 1, statKey = '', natureId = 21, preset: FormulaPreset = getActivePreset()): number {
  const dice = getLogicalDice(statKey, stat, natureId, preset);
  return Math.round(evaluate(preset.formulas.statFinal, statVars(stat, level, dice, preset)));
}

export function calculateStatBonus(final: number, stat?: StatEntry, level = 1, statKey = '', natureId = 21, preset: FormulaPreset = getActivePreset()): number {
  const base = stat ? statVars(stat, level, getLogicalDice(statKey, stat, natureId, preset), preset) : { N: level, Bs: 0, EVs: 0, IVs: 0, Ds: 0 };
  return Math.round(evaluate(preset.formulas.statBonus, { ...base, F: final }));
}

const EV_CAP_FORMULA: Record<StatKey, FormulaKey> = {
  hp: 'evCapHp', atk: 'evCapAtk', def: 'evCapDef', spAtk: 'evCapSpAtk', spDef: 'evCapSpDef', spe: 'evCapSpe',
};

export function getStatEvCap(statKey: StatKey, stat: StatEntry, level: number, natureId: number, preset: FormulaPreset = getActivePreset()): number {
  const dice = getLogicalDice(statKey, stat, natureId, preset);
  const cap = evaluate(preset.formulas[EV_CAP_FORMULA[statKey]], statVars(stat, level, dice, preset));
  return Math.max(0, Math.floor(cap));
}

export function getPpPoolMax(stats: AllStats, natureId: number, level: number, preset: FormulaPreset = getActivePreset()): number {
  return Math.max(0, Math.floor(evaluate(preset.formulas.ppPool, buildDerivedVars(stats, natureId, level, preset))));
}

export function getAttackPpCost(attackPp: number, preset: FormulaPreset = getActivePreset()): number {
  const pp = Math.max(0, Math.floor(Number(attackPp) || 0));
  if (pp <= preset.ppFreeThreshold) return 0;
  return Math.ceil((pp - preset.ppFreeThreshold) / preset.ppStep);
}

export function getStatDiceNotation(statKey: string, stat: StatEntry, natureId: number, level = 1, preset: FormulaPreset = getActivePreset()): { dice: number, logical: number, keepWorst: boolean, bonus: number, final: number, str: string } {
  const final = calculateStatFinal(stat, level, statKey, natureId, preset);
  const bonus = calculateStatBonus(final, stat, level, statKey, natureId, preset);
  const logical = getLogicalDice(statKey, stat, natureId, preset);
  const { dice, keepWorst } = physicalRoll(logical);
  const sign = bonus >= 0 ? "+" : "";
  const str = keepWorst ? `${dice}#d20↓${sign}${bonus}` : `${dice}#d20${sign}${bonus}`;
  return { dice, logical, keepWorst, bonus, final, str };
}

/** Variables for derived formulas: N, Bx, EVx, IVx, Dx, Fx and BNx per stat suffix. */
export function buildDerivedVars(stats: AllStats, natureId: number, level: number, preset: FormulaPreset = getActivePreset()) {
  const vars: Record<string, number> = { N: level };
  STAT_KEYS.forEach(k => {
    const s = STAT_SUFFIX[k];
    const st = stats[k as StatKey];
    const n = getStatDiceNotation(k, st, natureId, level, preset);
    vars[`B${s}`] = Number(st.base) || 0;
    vars[`EV${s}`] = Number(st.evPoints ?? st.levelPoints) || 0;
    vars[`IV${s}`] = preset.ivValues[st.iv] ?? 0;
    vars[`D${s}`] = n.logical;
    vars[`F${s}`] = n.final;
    vars[`BN${s}`] = n.bonus;
  });
  return vars;
}

export function applyStageFormula(key: 'stageAtk' | 'stageSpAtk' | 'stageDef' | 'stageSpDef' | 'stageSpe' | 'stageAccuracy' | 'stageEvasion' | 'stageCrit', base: number, stage: number, level = 1, preset: FormulaPreset = getActivePreset()): number {
  return Math.round(evaluate(preset.formulas[key], { X: base, E: stage, N: level }));
}

export function getEffectiveCritRange(critRange: number, stage: number, level = 1, preset: FormulaPreset = getActivePreset()): number {
  return Math.max(1, Math.min(20, applyStageFormula('stageCrit', critRange, stage, level, preset)));
}

// Roll logic
export function rollDice(diceCount: number, keepWorst: boolean): { results: number[], kept: number } {
  const results = [];
  for (let i = 0; i < diceCount; i++) {
    results.push(Math.floor(Math.random() * 20) + 1);
  }
  let kept = results[0];
  if (diceCount > 1) {
    if (keepWorst) {
      kept = Math.min(...results);
    } else {
      kept = Math.max(...results);
    }
  }
  return { results, kept };
}

// ─── DAMAGE TABLE ────────────────────────────────────────────────────────────

export interface DamageEntry {
  dice: number;
  sides: number;
  bonus: number;
  notation: string;
}

function makeDamage(dice: number, sides: number, bonus: number): DamageEntry {
  const sign = bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : "";
  return { dice, sides, bonus, notation: `${dice}d${sides}${sign}` };
}

function lookupDamage(power: number, table: DamageRow[], overflow: string): DamageEntry {
  const rows = [...table].sort((a, b) => a.max - b.max);
  if (!rows.length) return makeDamage(1, 8, 0);
  const p = Math.max(0, Number(power) || 0);
  const row = rows.find(r => p <= r.max);
  if (row) return makeDamage(row.dice, row.sides, row.bonus);
  const last = rows[rows.length - 1];
  const bonus = Math.round(evaluate(overflow, { P: p, Pt: last.max, Bt: last.bonus }));
  return makeDamage(last.dice, last.sides, bonus);
}

export function getPhysicalDamage(power: number, preset: FormulaPreset = getActivePreset()): DamageEntry {
  return lookupDamage(power, preset.physTable, preset.formulas.physOverflow);
}

export function getSpecialDamage(power: number, preset: FormulaPreset = getActivePreset()): DamageEntry {
  return lookupDamage(power, preset.specTable, preset.formulas.specOverflow);
}

export function rollDamage(dice: number, sides: number): number[] {
  const results = [];
  for (let i = 0; i < dice; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}

export function rollStatusChance(chance: number): { roll: number; success: boolean } {
  if (chance >= 100) return { roll: 0, success: true };
  const roll = Math.floor(Math.random() * 10) + 1;
  const successfulFaces = Math.max(0, Math.min(10, Math.round(chance / 10)));
  return { roll, success: roll <= successfulFaces };
}

// ─── STAGE MULTIPLIER ─────────────────────────────────────────────────────────

export function applyStageMultiplier(base: number, stage: number): number {
  if (stage === 0) return base;
  if (stage > 0) return Math.round(base * Math.pow(1.3, stage));
  return Math.round(base / Math.pow(1.3, Math.abs(stage)));
}

// ─── DERIVED STATS WITH STAGES ───────────────────────────────────────────────

export interface DerivedStats {
  hp: number;
  rdFisica: number;
  rdEspecial: number;
  esquiva: number;
  iniciativa: number;
  bonusDanoFis: number;
  bonusDanoEsp: number;
  // With stages applied
  rdFisicaEff: number;
  rdEspecialEff: number;
  esquivaEff: number;
  iniciativaEff: number;
  bonusDanoFisEff: number;
  bonusDanoEspEff: number;
}

export function computeDerivedStats(
  stats: AllStats,
  natureId: number,
  stages: PokemonStages,
  level = 1,
  preset: FormulaPreset = getActivePreset(),
): DerivedStats {
  const v = buildDerivedVars(stats, natureId, level, preset);
  const f = preset.formulas;
  const r = (expr: string) => Math.round(evaluate(expr, v));
  const hp = r(f.hp);
  const rdFisica = r(f.rdPhys);
  const rdEspecial = r(f.rdSpec);
  const esquiva = r(f.dodge);
  const iniciativa = r(f.initiative);
  const bonusDanoFis = r(f.dmgPhys);
  const bonusDanoEsp = r(f.dmgSpec);
  const st = (k: Parameters<typeof applyStageFormula>[0], b: number, e: number) => applyStageFormula(k, b, e || 0, level, preset);
  return {
    hp, rdFisica, rdEspecial, esquiva, iniciativa, bonusDanoFis, bonusDanoEsp,
    rdFisicaEff: st('stageDef', rdFisica, stages.def),
    rdEspecialEff: st('stageSpDef', rdEspecial, stages.spDef),
    esquivaEff: st('stageEvasion', esquiva, stages.evasion),
    iniciativaEff: st('stageSpe', iniciativa, stages.spe),
    bonusDanoFisEff: st('stageAtk', bonusDanoFis, stages.atk),
    bonusDanoEspEff: st('stageSpAtk', bonusDanoEsp, stages.spAtk),
  };
}

/** Recomputes max HP and the PP pool while preserving damage and spent PP. */
export function recalcPokemonResources<T extends {
  stats: AllStats;
  natureNumber: number;
  stages: PokemonStages;
  level: number;
  hp: number;
  hpMax: number;
  ppCurrent?: number;
  ppMax?: number;
}>(p: T, preset: FormulaPreset = getActivePreset()): T {
  const hpMax = Math.max(1, computeDerivedStats(p.stats, p.natureNumber, p.stages || defaultStages, p.level || 1, preset).hp);
  const damage = Math.max(0, (p.hpMax || 0) - (p.hp || 0));
  const ppMax = getPpPoolMax(p.stats, p.natureNumber, p.level || 1, preset);
  const previousMax = Number.isFinite(p.ppMax) ? Math.max(0, Number(p.ppMax)) : ppMax;
  const previousCurrent = Number.isFinite(p.ppCurrent) ? Math.max(0, Number(p.ppCurrent)) : previousMax;
  const ppSpent = Math.max(0, previousMax - previousCurrent);
  return {
    ...p,
    hpMax,
    hp: Math.max(0, Math.min(hpMax, hpMax - damage)),
    ppMax,
    ppCurrent: Math.max(0, Math.min(ppMax, ppMax - ppSpent)),
  };
}

/** Backward-compatible name used by existing HP recalculation call sites. */
export const recalcPokemonHp = recalcPokemonResources;

/** Runs every formula against every given Pokémon (all stages -6..6, powers 0..300). Returns error messages. */
export function validatePresetAgainstPokemon(preset: FormulaPreset, pokemon: Array<{ name?: string; stats: AllStats; natureNumber: number; stages?: PokemonStages; level: number }>): string[] {
  const errs: string[] = [];
  for (let power = 0; power <= 300; power += 5) {
    try { getPhysicalDamage(power, preset); getSpecialDamage(power, preset); }
    catch (e) { errs.push(`Tabela de dano (poder ${power}): ${(e as Error).message}`); break; }
  }
  for (const p of pokemon) {
    try {
      const d = computeDerivedStats(p.stats, p.natureNumber, p.stages || defaultStages, p.level || 1, preset);
      if (d.hp < 1) throw new Error(`HP calculado ${d.hp} (< 1)`);
      const vars = buildDerivedVars(p.stats, p.natureNumber, p.level || 1, preset);
      const ppMaximum = evaluate(preset.formulas.ppPool, vars);
      if (ppMaximum < 0) throw new Error(`Barra máxima de PP não pode ser negativa (${ppMaximum})`);
      getPpPoolMax(p.stats, p.natureNumber, p.level || 1, preset);
      STAT_KEYS.forEach(key => {
        const stat = p.stats[key as StatKey];
        const cap = evaluate(preset.formulas[EV_CAP_FORMULA[key as StatKey]], statVars(stat, p.level || 1, getLogicalDice(key, stat, p.natureNumber, preset), preset));
        if (cap < 0) throw new Error(`Cap de EV de ${key.toUpperCase()} não pode ser negativo (${cap})`);
        getStatEvCap(key as StatKey, stat, p.level || 1, p.natureNumber, preset);
      });
      for (let e = -6; e <= 6; e++) {
        computeDerivedStats(p.stats, p.natureNumber, { atk: e, spAtk: e, def: e, spDef: e, spe: e, accuracy: e, evasion: e, crit: e }, p.level || 1, preset);
        applyStageFormula('stageAccuracy', 0, e, p.level || 1, preset);
        getEffectiveCritRange(20, e, p.level || 1, preset);
      }
    } catch (e) {
      errs.push(`${p.name || 'Pokémon sem nome'}: ${(e as Error).message}`);
    }
    if (errs.length > 8) break;
  }
  return errs;
}
