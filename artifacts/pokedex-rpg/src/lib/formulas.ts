import { useEffect, useMemo, useState } from 'react';
import type { IVRank } from './types';
import { getServerCollection } from './cloudSync';

// ─── Safe expression parser (no eval / Function) ─────────────────────────────

type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; name: string }
  | { t: 'un'; op: string; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'tern'; c: Node; a: Node; b: Node }
  | { t: 'call'; name: string; args: Node[] };

type Token = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string };

const OPS = ['<=', '>=', '==', '!=', '&&', '||', '+', '-', '*', '/', '%', '^', '(', ')', ',', '<', '>', '?', ':', '!'];

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const v = Number(src.slice(i, j).replace(',', '.'));
      if (!Number.isFinite(v)) throw new Error(`Número inválido: ${src.slice(i, j)}`);
      out.push({ k: 'num', v }); i = j; continue;
    }
    if (/[A-Za-z_À-ÿ]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_À-ÿ]/.test(src[j])) j++;
      out.push({ k: 'id', v: src.slice(i, j) }); i = j; continue;
    }
    const op = OPS.find(o => src.startsWith(o, i));
    if (!op) throw new Error(`Caractere inesperado: "${ch}"`);
    out.push({ k: 'op', v: op }); i += op.length;
  }
  return out;
}

const FUNCS: Record<string, { min: number; max: number; fn: (...a: number[]) => number }> = {
  floor: { min: 1, max: 1, fn: Math.floor },
  ceil: { min: 1, max: 1, fn: Math.ceil },
  round: { min: 1, max: 1, fn: Math.round },
  abs: { min: 1, max: 1, fn: Math.abs },
  sqrt: { min: 1, max: 1, fn: Math.sqrt },
  min: { min: 1, max: 20, fn: Math.min },
  max: { min: 1, max: 20, fn: Math.max },
  pow: { min: 2, max: 2, fn: Math.pow },
  clamp: { min: 3, max: 3, fn: (v, lo, hi) => Math.max(lo, Math.min(hi, v)) },
  if: { min: 3, max: 3, fn: (c, a, b) => (c ? a : b) },
};

function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = toks[p]; return !!t && t.k === 'op' && t.v === v; };
  const expect = (v: string) => { if (!isOp(v)) throw new Error(`Esperado "${v}"`); p++; };

  const primary = (): Node => {
    const t = peek();
    if (!t) throw new Error('Expressão incompleta');
    if (t.k === 'num') { p++; return { t: 'num', v: t.v }; }
    if (t.k === 'id') {
      p++;
      if (isOp('(')) {
        const name = t.v.toLowerCase();
        const f = FUNCS[name];
        if (!f) throw new Error(`Função desconhecida: ${t.v}`);
        p++;
        const args: Node[] = [];
        if (!isOp(')')) {
          args.push(ternary());
          while (isOp(',')) { p++; args.push(ternary()); }
        }
        expect(')');
        if (args.length < f.min || args.length > f.max) throw new Error(`${name}() recebeu ${args.length} argumento(s)`);
        return { t: 'call', name, args };
      }
      return { t: 'var', name: t.v.toLowerCase() };
    }
    if (isOp('(')) { p++; const e = ternary(); expect(')'); return e; }
    throw new Error(`Símbolo inesperado: "${t.v}"`);
  };
  const unary = (): Node => {
    if (isOp('-') || isOp('+') || isOp('!')) { const op = (peek() as Token).v as string; p++; return { t: 'un', op, a: unary() }; }
    return power();
  };
  const power = (): Node => {
    const a = primary();
    if (isOp('^')) { p++; return { t: 'bin', op: '^', a, b: unary() }; }
    return a;
  };
  const level = (next: () => Node, ops: string[]) => (): Node => {
    let a = next();
    while (peek() && peek().k === 'op' && ops.includes(peek().v as string)) {
      const op = peek().v as string; p++;
      a = { t: 'bin', op, a, b: next() };
    }
    return a;
  };
  const mul = level(unary, ['*', '/', '%']);
  const add = level(mul, ['+', '-']);
  const cmp = level(add, ['<', '>', '<=', '>=']);
  const eq = level(cmp, ['==', '!=']);
  const and = level(eq, ['&&']);
  const or = level(and, ['||']);
  function ternary(): Node {
    const c = or();
    if (isOp('?')) { p++; const a = ternary(); expect(':'); const b = ternary(); return { t: 'tern', c, a, b }; }
    return c;
  }
  const root = ternary();
  if (p < toks.length) throw new Error(`Símbolo sobrando: "${toks[p].v}"`);
  return root;
}

function evalNode(n: Node, vars: Record<string, number>): number {
  switch (n.t) {
    case 'num': return n.v;
    case 'var': {
      if (!(n.name in vars)) throw new Error(`Variável desconhecida: ${n.name}`);
      return vars[n.name];
    }
    case 'un': { const a = evalNode(n.a, vars); return n.op === '-' ? -a : n.op === '!' ? (a ? 0 : 1) : a; }
    case 'tern': return evalNode(n.c, vars) ? evalNode(n.a, vars) : evalNode(n.b, vars);
    case 'call': {
      if (n.name === 'if') return evalNode(n.args[0], vars) ? evalNode(n.args[1], vars) : evalNode(n.args[2], vars);
      return FUNCS[n.name].fn(...n.args.map(a => evalNode(a, vars)));
    }
    case 'bin': {
      const a = evalNode(n.a, vars); const b = evalNode(n.b, vars);
      switch (n.op) {
        case '+': return a + b; case '-': return a - b; case '*': return a * b;
        case '/': if (b === 0) throw new Error('Divisão por zero'); return a / b;
        case '%': if (b === 0) throw new Error('Módulo por zero'); return ((a % b) + b) % b;
        case '^': return Math.pow(a, b);
        case '<': return +(a < b); case '>': return +(a > b);
        case '<=': return +(a <= b); case '>=': return +(a >= b);
        case '==': return +(a === b); case '!=': return +(a !== b);
        case '&&': return +(!!a && !!b); case '||': return +(!!a || !!b);
      }
    }
  }
  return 0;
}

const cache = new Map<string, Node | Error>();
function compiled(expr: string): Node | Error {
  let c = cache.get(expr);
  if (!c) {
    try { c = parse(expr); } catch (e) { c = e instanceof Error ? e : new Error(String(e)); }
    if (cache.size > 500) cache.clear();
    cache.set(expr, c);
  }
  return c;
}

function collectVars(n: Node, out: Set<string>) {
  switch (n.t) {
    case 'var': out.add(n.name); break;
    case 'un': collectVars(n.a, out); break;
    case 'bin': collectVars(n.a, out); collectVars(n.b, out); break;
    case 'tern': collectVars(n.c, out); collectVars(n.a, out); collectVars(n.b, out); break;
    case 'call': n.args.forEach(arg => collectVars(arg, out)); break;
  }
}

/** Static validation: syntax + every variable in every branch must be allowed. Returns error or null. */
export function validateExpression(expr: string, allowed: string[]): string | null {
  if (!expr.trim()) return 'Expressão vazia';
  const c = compiled(expr);
  if (c instanceof Error) return c.message;
  const used = new Set<string>();
  collectVars(c, used);
  const ok = new Set(allowed.map(v => v.toLowerCase()));
  const unknown = [...used].filter(v => !ok.has(v));
  return unknown.length ? `Variável desconhecida: ${unknown.join(', ')}` : null;
}

/** Evaluates safely without eval. Throws on syntax errors, unknown variables, division by zero or non-finite results. */
export function evaluate(expr: string, vars: Record<string, number>): number {
  const c = compiled(expr);
  if (c instanceof Error) throw c;
  const lower: Record<string, number> = {};
  for (const k in vars) lower[k.toLowerCase()] = vars[k];
  const v = evalNode(c, lower);
  if (!Number.isFinite(v)) throw new Error('Resultado não finito');
  return v;
}

// ─── Preset model ─────────────────────────────────────────────────────────────

export type FormulaKey =
  | 'statFinal' | 'statBonus' | 'hp' | 'rdPhys' | 'rdSpec' | 'dodge' | 'initiative' | 'dmgPhys' | 'dmgSpec'
  | 'stageAtk' | 'stageSpAtk' | 'stageDef' | 'stageSpDef' | 'stageSpe' | 'stageAccuracy' | 'stageEvasion' | 'stageCrit'
  | 'physOverflow' | 'specOverflow'
  | 'evCapHp' | 'evCapAtk' | 'evCapDef' | 'evCapSpAtk' | 'evCapSpDef' | 'evCapSpe' | 'ppPool';

export interface DamageRow { max: number; dice: number; sides: number; bonus: number }

export interface FormulaPreset {
  id: string;
  name: string;
  builtin?: boolean;
  schemaVersion: number;
  diceMode: 'iv' | 'base';
  ppMode: 'individual' | 'pool';
  ppFreeThreshold: number;
  ppStep: number;
  ivValues: Record<IVRank, number>;
  formulas: Record<FormulaKey, string>;
  physTable: DamageRow[];
  specTable: DamageRow[];
}

export interface FormulaSettings { activePresetId: string; presets: FormulaPreset[] }

export const STAT_SUFFIX = { hp: 'hp', atk: 'atk', def: 'def', spAtk: 'spatk', spDef: 'spdef', spe: 'spe' } as const;
export const STAT_KEYS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'spe'] as const;

const STAGE_MULT = 'E >= 0 ? round(X * 1.3^E) : round(X / 1.3^(-E))';

export const ORIGINAL_PRESET: FormulaPreset = {
  id: 'original',
  name: 'Original',
  builtin: true,
  schemaVersion: 2,
  diceMode: 'iv',
  ppMode: 'individual',
  ppFreeThreshold: 5,
  ppStep: 5,
  ivValues: { SS: 100, S: 80, A: 60, B: 40, C: 20, D: 0 },
  formulas: {
    statFinal: 'Bs + EVs',
    statBonus: 'floor(F / 10) + (F % 10 > 5 ? 1 : 0)',
    hp: 'floor(Fhp / 2) + 10 * Dhp',
    rdPhys: 'BNdef + Ddef',
    rdSpec: 'BNspdef + Dspdef',
    dodge: '10 + BNspe + Dspe',
    initiative: 'BNspe + 10 * Dspe',
    dmgPhys: 'floor(BNatk / 2)',
    dmgSpec: 'floor(BNspatk / 2)',
    stageAtk: STAGE_MULT,
    stageSpAtk: STAGE_MULT,
    stageDef: STAGE_MULT,
    stageSpDef: STAGE_MULT,
    stageSpe: 'X + 10 * E',
    stageAccuracy: 'X + 2 * E',
    stageEvasion: 'X + 2 * E',
    stageCrit: 'X - E',
    physOverflow: 'Bt + 2 * (P - Pt)',
    specOverflow: 'Bt + 2 * (P - Pt)',
    evCapHp: 'max(1, ceil(N * 1.25))',
    evCapAtk: 'max(1, ceil(N * 1.25))',
    evCapDef: 'max(1, ceil(N * 1.25))',
    evCapSpAtk: 'max(1, ceil(N * 1.25))',
    evCapSpDef: 'max(1, ceil(N * 1.25))',
    evCapSpe: 'max(1, ceil(N * 1.25))',
    ppPool: 'N * 3',
  },
  physTable: [
    { max: 0, dice: 1, sides: 8, bonus: 0 }, { max: 15, dice: 1, sides: 8, bonus: 2 }, { max: 35, dice: 2, sides: 8, bonus: 4 },
    { max: 55, dice: 3, sides: 8, bonus: 6 }, { max: 75, dice: 4, sides: 8, bonus: 8 }, { max: 95, dice: 5, sides: 8, bonus: 10 },
    { max: 115, dice: 6, sides: 8, bonus: 12 }, { max: 135, dice: 7, sides: 8, bonus: 14 }, { max: 155, dice: 8, sides: 8, bonus: 16 },
    { max: 175, dice: 6, sides: 12, bonus: 18 }, { max: 195, dice: 7, sides: 12, bonus: 20 }, { max: 200, dice: 8, sides: 12, bonus: 25 },
  ],
  specTable: [
    { max: 0, dice: 4, sides: 4, bonus: 0 }, { max: 15, dice: 4, sides: 4, bonus: 0 }, { max: 35, dice: 6, sides: 4, bonus: 0 },
    { max: 55, dice: 8, sides: 4, bonus: 0 }, { max: 75, dice: 11, sides: 4, bonus: 0 }, { max: 95, dice: 9, sides: 6, bonus: 0 },
    { max: 115, dice: 8, sides: 8, bonus: 2 }, { max: 135, dice: 9, sides: 8, bonus: 3 }, { max: 155, dice: 8, sides: 10, bonus: 5 },
    { max: 175, dice: 9, sides: 10, bonus: 5 }, { max: 195, dice: 10, sides: 10, bonus: 5 }, { max: 200, dice: 11, sides: 10, bonus: 10 },
  ],
};

export const FORMULA_META: Record<FormulaKey, { label: string; group: 'stat' | 'derived' | 'stage' | 'table' | 'allocation' | 'pp'; help: string; vars: string[] }> = (() => {
  const perStat = ['N', 'Bs', 'EVs', 'IVs', 'Ds'];
  const all = ['N', ...STAT_KEYS.flatMap(k => { const s = STAT_SUFFIX[k]; return [`B${s}`, `EV${s}`, `IV${s}`, `D${s}`, `F${s}`, `BN${s}`]; })];
  const stage = ['X', 'E', 'N'];
  return {
    statFinal: { label: 'Stat final (F)', group: 'stat', help: 'Valor final de cada atributo.', vars: perStat },
    statBonus: { label: 'Bônus do stat (BNs)', group: 'stat', help: 'Bônus somado aos testes a partir do final F.', vars: [...perStat, 'F'] },
    hp: { label: 'HP calculado', group: 'derived', help: 'Vida máxima. Ao mudar, o dano sofrido é preservado.', vars: all },
    rdPhys: { label: 'RD física', group: 'derived', help: 'Redução de dano físico.', vars: all },
    rdSpec: { label: 'RD especial', group: 'derived', help: 'Redução de dano especial.', vars: all },
    dodge: { label: 'Esquiva', group: 'derived', help: 'Dificuldade para ser atingido.', vars: all },
    initiative: { label: 'Iniciativa', group: 'derived', help: 'Ordem de ação.', vars: all },
    dmgPhys: { label: 'Bônus de dano físico', group: 'derived', help: 'Somado ao dano de golpes físicos.', vars: all },
    dmgSpec: { label: 'Bônus de dano especial', group: 'derived', help: 'Somado ao dano de golpes especiais.', vars: all },
    stageAtk: { label: 'Estágio ATK → dano físico', group: 'stage', help: 'X = bônus de dano físico, E = estágio.', vars: stage },
    stageSpAtk: { label: 'Estágio SP.ATK → dano especial', group: 'stage', help: 'X = bônus de dano especial, E = estágio.', vars: stage },
    stageDef: { label: 'Estágio DEF → RD física', group: 'stage', help: 'X = RD física, E = estágio.', vars: stage },
    stageSpDef: { label: 'Estágio SP.DEF → RD especial', group: 'stage', help: 'X = RD especial, E = estágio.', vars: stage },
    stageSpe: { label: 'Estágio SPE → iniciativa', group: 'stage', help: 'X = iniciativa, E = estágio.', vars: stage },
    stageAccuracy: { label: 'Estágio Precisão → teste', group: 'stage', help: 'X = 0 (modificador base do teste), E = estágio. Resultado somado ao teste de ataque.', vars: stage },
    stageEvasion: { label: 'Estágio Evasiva → esquiva', group: 'stage', help: 'X = esquiva, E = estágio.', vars: stage },
    stageCrit: { label: 'Estágio Crítico → margem', group: 'stage', help: 'X = margem de crítico do golpe, E = estágio (-6 a +6). Limitado a 1–20.', vars: stage },
    physOverflow: { label: 'Bônus acima da tabela física', group: 'table', help: 'P = poder, Pt = poder da última linha, Bt = bônus da última linha.', vars: ['P', 'Pt', 'Bt'] },
    specOverflow: { label: 'Bônus acima da tabela especial', group: 'table', help: 'P = poder, Pt = poder da última linha, Bt = bônus da última linha.', vars: ['P', 'Pt', 'Bt'] },
    evCapHp: { label: 'Cap de EV — HP', group: 'allocation', help: 'Máximo de EV que pode ser investido em HP. O valor é limitado a um inteiro não negativo.', vars: perStat },
    evCapAtk: { label: 'Cap de EV — ATK', group: 'allocation', help: 'Máximo de EV que pode ser investido em ATK. O valor é limitado a um inteiro não negativo.', vars: perStat },
    evCapDef: { label: 'Cap de EV — DEF', group: 'allocation', help: 'Máximo de EV que pode ser investido em DEF. O valor é limitado a um inteiro não negativo.', vars: perStat },
    evCapSpAtk: { label: 'Cap de EV — SP.ATK', group: 'allocation', help: 'Máximo de EV que pode ser investido em SP.ATK. O valor é limitado a um inteiro não negativo.', vars: perStat },
    evCapSpDef: { label: 'Cap de EV — SP.DEF', group: 'allocation', help: 'Máximo de EV que pode ser investido em SP.DEF. O valor é limitado a um inteiro não negativo.', vars: perStat },
    evCapSpe: { label: 'Cap de EV — SPEED', group: 'allocation', help: 'Máximo de EV que pode ser investido em SPEED. O valor é limitado a um inteiro não negativo.', vars: perStat },
    ppPool: { label: 'Tamanho da barra de PP', group: 'pp', help: 'Define o máximo de Pontos de Poder disponíveis para o Pokémon.', vars: all },
  };
})();

function normalizePreset(raw: Partial<FormulaPreset>): FormulaPreset {
  const schemaVersion = Number(raw.schemaVersion) || 0;
  const formulas = { ...ORIGINAL_PRESET.formulas, ...(raw.formulas || {}) };
  if (schemaVersion < 2 && raw.formulas) {
    const legacyStatSuffix = '(s|hp|atk|def|spatk|spdef|spe)';
    const preserveAllocatedEv = new RegExp(`\\bPn${legacyStatSuffix}\\b`, 'gi');
    const removeLegacyEv = new RegExp(`\\bEV${legacyStatSuffix}\\b`, 'gi');
    const restoreAllocatedEv = /__allocated_ev_(s|hp|atk|def|spatk|spdef|spe)__/gi;
    (Object.keys(raw.formulas) as FormulaKey[]).forEach(key => {
      if (typeof formulas[key] !== 'string') return;
      formulas[key] = formulas[key]
        .replace(preserveAllocatedEv, (_match, suffix: string) => `__allocated_ev_${suffix.toLowerCase()}__`)
        .replace(removeLegacyEv, '0')
        .replace(restoreAllocatedEv, (_match, suffix: string) => `EV${suffix}`);
    });
  }
  return {
    ...ORIGINAL_PRESET,
    ...raw,
    id: raw.id || `preset-${Date.now()}`,
    name: raw.name || 'Preset',
    builtin: raw.id === ORIGINAL_PRESET.id,
    schemaVersion: 2,
    ppMode: raw.ppMode === 'pool' ? 'pool' : 'individual',
    ppFreeThreshold: Number.isInteger(raw.ppFreeThreshold) && raw.ppFreeThreshold! >= 0 ? raw.ppFreeThreshold! : ORIGINAL_PRESET.ppFreeThreshold,
    ppStep: Number.isInteger(raw.ppStep) && raw.ppStep! > 0 ? raw.ppStep! : ORIGINAL_PRESET.ppStep,
    ivValues: { ...ORIGINAL_PRESET.ivValues, ...(raw.ivValues || {}) },
    formulas,
    physTable: Array.isArray(raw.physTable) && raw.physTable.length ? raw.physTable : ORIGINAL_PRESET.physTable,
    specTable: Array.isArray(raw.specTable) && raw.specTable.length ? raw.specTable : ORIGINAL_PRESET.specTable,
  };
}

export function getFormulaSettings(): FormulaSettings {
  const raw = getServerCollection<Partial<FormulaSettings> | null>('formulaSettings', null);
  const presets = (raw?.presets || []).map(normalizePreset).filter(p => p.id !== ORIGINAL_PRESET.id);
  const all = [ORIGINAL_PRESET, ...presets];
  const activePresetId = all.some(p => p.id === raw?.activePresetId) ? raw!.activePresetId! : ORIGINAL_PRESET.id;
  return { activePresetId, presets: all };
}

const structurallyValid = new Map<string, boolean>();
/** Active preset; falls back to Original if the stored one fails static validation (never crash renders). */
export function getActivePreset(): FormulaPreset {
  const s = getFormulaSettings();
  const p = s.presets.find(item => item.id === s.activePresetId) || ORIGINAL_PRESET;
  const key = JSON.stringify(p);
  let ok = structurallyValid.get(key);
  if (ok === undefined) { ok = validatePresetStructure(p).length === 0; structurallyValid.set(key, ok); }
  return ok ? p : ORIGINAL_PRESET;
}

/** Name, tables, IV values and expression syntax/variables. */
export function validatePresetStructure(p: FormulaPreset): string[] {
  const errs: string[] = [];
  if (!p.name.trim()) errs.push('O nome do preset não pode ficar vazio.');
  if (p.ppMode !== 'individual' && p.ppMode !== 'pool') errs.push('Modo de PP inválido.');
  if (!Number.isInteger(p.ppFreeThreshold) || p.ppFreeThreshold < 0) errs.push('O valor inicial de PP deve ser um inteiro não negativo.');
  if (!Number.isInteger(p.ppStep) || p.ppStep < 1) errs.push('A média de conversão de PP deve ser um inteiro maior que zero.');
  (Object.keys(FORMULA_META) as FormulaKey[]).forEach(k => {
    const e = validateExpression(p.formulas[k] || '', FORMULA_META[k].vars);
    if (e) errs.push(`${FORMULA_META[k].label}: ${e}`);
  });
  (Object.keys(p.ivValues) as IVRank[]).forEach(r => { if (!Number.isFinite(p.ivValues[r])) errs.push(`Valor do IV ${r} inválido.`); });
  ([['physTable', 'Tabela física'], ['specTable', 'Tabela especial']] as const).forEach(([t, label]) => {
    const rows = p[t];
    if (!rows.length) errs.push(`${label}: precisa de ao menos uma linha.`);
    rows.forEach((r, i) => {
      const n = `${label}, linha ${i + 1}`;
      if (!Number.isFinite(r.max) || r.max < 0) errs.push(`${n}: poder deve ser finito e ≥ 0.`);
      if (i > 0 && !(r.max > rows[i - 1].max)) errs.push(`${n}: poderes devem ser únicos e crescentes.`);
      if (!Number.isInteger(r.dice) || r.dice < 1 || r.dice > 100) errs.push(`${n}: dados devem ser inteiros entre 1 e 100.`);
      if (!Number.isInteger(r.sides) || r.sides < 2 || r.sides > 1000) errs.push(`${n}: faces devem ser inteiras entre 2 e 1000.`);
      if (!Number.isFinite(r.bonus)) errs.push(`${n}: bônus inválido.`);
    });
  });
  return errs;
}

export function serializeFormulaSettings(settings: FormulaSettings): FormulaSettings {
  return { activePresetId: settings.activePresetId, presets: settings.presets.filter(p => p.id !== ORIGINAL_PRESET.id) };
}

/** Re-renders on any formula settings change; returns active preset. */
export function useFormulaSettings() {
  const [settings, setSettings] = useState<FormulaSettings>(getFormulaSettings);
  useEffect(() => {
    const sync = () => setSettings(getFormulaSettings());
    window.addEventListener('pokemon-rpg-state-change', sync);
    window.addEventListener('formula-settings-change', sync);
    return () => {
      window.removeEventListener('pokemon-rpg-state-change', sync);
      window.removeEventListener('formula-settings-change', sync);
    };
  }, []);
  const active = useMemo(() => getActivePreset(), [settings]);
  return { settings, active };
}

// ─── Dice ─────────────────────────────────────────────────────────────────────

export const IV_DICE: Record<IVRank, number> = { SS: 5, S: 4, A: 3, B: 2, C: 1, D: 0 };

export function baseStatDice(base: number): number {
  return Math.max(0, Math.min(30, Math.floor(((Number(base) || 0) + 10) / 20)));
}

/**
 * Logical dice count -> physical roll.
 * Logical count is clamped at 0 (a nature penalty never goes below 0).
 * 0 => roll 2d20 keep the worst; n >= 1 => roll n d20 keep the best.
 */
export function physicalRoll(logical: number): { dice: number; keepWorst: boolean } {
  const n = Math.max(0, Math.floor(logical));
  if (n >= 1) return { dice: Math.min(30, n), keepWorst: false };
  return { dice: 2, keepWorst: true };
}
