import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CopyPlus, FunctionSquare, Plus, RotateCcw, Save, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  FORMULA_META, ORIGINAL_PRESET, serializeFormulaSettings, useFormulaSettings, validateExpression, validatePresetStructure,
  type DamageRow, type FormulaKey, type FormulaPreset, type FormulaSettings,
} from '../lib/formulas';
import { computeDerivedStats, getPpPoolMax, getStatDiceNotation, getStatEvCap, recalcPokemonHp, validatePresetAgainstPokemon } from '../lib/calculations';
import { getServerCollection, syncGameState } from '../lib/cloudSync';
import type { IVRank, Pokemon } from '../lib/types';

const GROUPS: Array<{ id: 'stat' | 'derived' | 'stage' | 'table' | 'allocation' | 'pp'; title: string; note: string }> = [
  { id: 'stat', title: 'Atributos', note: 'Cada stat usa Bs, EVs, IVs, Ds e N; o cálculo do bônus também recebe F.' },
  { id: 'derived', title: 'Valores derivados', note: 'Use variáveis com sufixo do stat: hp, atk, def, spatk, spdef, spe. Ex.: Fhp, BNdef, Dspe, EVatk.' },
  { id: 'stage', title: 'Efeitos de estágio', note: 'X é o valor antes do estágio e E o estágio atual.' },
  { id: 'table', title: 'Tabelas de dano por poder', note: 'A primeira linha cujo poder máximo comporta o golpe é usada.' },
  { id: 'allocation', title: 'Distribuição e cap de EV', note: 'O total disponível é 3 EV por nível; cada fórmula define o máximo investido em um stat.' },
  { id: 'pp', title: 'Barra de Pontos de Poder', note: 'A fórmula define o tamanho máximo da barra compartilhada por cada Pokémon.' },
];
const IV_RANKS: IVRank[] = ['SS', 'S', 'A', 'B', 'C', 'D'];
const VARIABLE_REFERENCE = [
  ['N', 'Nível do Pokémon.'],
  ['Bs', 'Status base do atributo que está sendo calculado.'],
  ['EVs', 'EVs distribuídos nesse atributo (3 pontos disponíveis por nível).'],
  ['Ds', 'Dados do atributo após aplicar o efeito da natureza.'],
  ['IVs', 'Valor numérico configurado para o IV escolhido.'],
  ['F', 'Resultado do cálculo do status final (usado no bônus).'],
  ['BNs', 'Bônus do status final, disponível como BNhp, BNatk e outros.'],
  ['Bhp / EVhp / IVhp / Dhp / Fhp', 'Variáveis com sufixo: status base, EV, IV numérico, dados e final do HP. Use os outros sufixos para os demais stats.'],
] as const;

function clonePreset(p: FormulaPreset): FormulaPreset {
  return JSON.parse(JSON.stringify(p)) as FormulaPreset;
}

export default function FormulaEditor({ pokemon, onClose }: {
  pokemon: Pokemon[];
  onClose?: () => void;
}) {
  const { settings } = useFormulaSettings();
  const [selectedId, setSelectedId] = useState(settings.activePresetId);
  const stored = settings.presets.find(p => p.id === selectedId) || ORIGINAL_PRESET;
  const [draft, setDraft] = useState<FormulaPreset>(() => clonePreset(stored));
  const [sampleId, setSampleId] = useState(pokemon[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const storedJson = JSON.stringify(stored);
  const baselineRef = useRef(storedJson);
  const lastSelectedRef = useRef(selectedId);

  // Background polls recreate the settings object: only adopt the server copy
  // when switching presets or when the draft has no unsaved edits.
  useEffect(() => {
    const switched = lastSelectedRef.current !== selectedId;
    lastSelectedRef.current = selectedId;
    setDraft(current => {
      const clean = JSON.stringify(current) === baselineRef.current;
      baselineRef.current = storedJson;
      return switched || clean ? (JSON.parse(storedJson) as FormulaPreset) : current;
    });
  }, [selectedId, storedJson]);

  const readOnly = !!draft.builtin;
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const errors = useMemo(() => {
    const out: Partial<Record<FormulaKey, string>> = {};
    (Object.keys(FORMULA_META) as FormulaKey[]).forEach(k => {
      const e = validateExpression(draft.formulas[k], FORMULA_META[k].vars);
      if (e) out[k] = e;
    });
    return out;
  }, [draft.formulas]);
  const structureErrors = useMemo(() => validatePresetStructure(draft), [draft]);
  const hasErrors = structureErrors.length > 0;

  const sample = pokemon.find(p => p.id === sampleId);
  const preview = useMemo(() => {
    if (!sample || hasErrors) return null;
    try {
      const d = computeDerivedStats(sample.stats, sample.natureNumber, sample.stages, sample.level, draft);
      const dice = getStatDiceNotation('spe', sample.stats.spe, sample.natureNumber, sample.level, draft);
      const evCaps = Object.fromEntries((['hp', 'atk', 'def', 'spAtk', 'spDef', 'spe'] as const).map(key => [
        key, getStatEvCap(key, sample.stats[key], sample.level, sample.natureNumber, draft),
      ]));
      const ppMax = getPpPoolMax(sample.stats, sample.natureNumber, sample.level, draft);
      return { d, dice, evCaps, ppMax, error: null as string | null };
    } catch (e) {
      return { d: null, dice: null, evCaps: {}, ppMax: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [sample, draft, hasErrors]);

  /** One atomic patch: settings (+ recalculated HP for every Pokémon when the active preset changes). */
  const persist = async (next: FormulaSettings, recalc: boolean, success: string): Promise<boolean> => {
    const active = next.presets.find(p => p.id === next.activePresetId) || ORIGINAL_PRESET;
    const currentPokemon = getServerCollection<Pokemon[]>('pokemon', []);
    if (recalc) {
      const errs = [...validatePresetStructure(active), ...validatePresetAgainstPokemon(active, currentPokemon)];
      if (errs.length) {
        toast.error('O preset falha com Pokémon existentes', { description: errs.slice(0, 4).join(' · ') });
        return false;
      }
    }
    const patch: Record<string, unknown> = { formulaSettings: serializeFormulaSettings(next) };
    if (recalc) patch.pokemon = currentPokemon.map(p => recalcPokemonHp({ ...p, stages: p.stages || { atk: 0, spAtk: 0, def: 0, spDef: 0, spe: 0, accuracy: 0, evasion: 0, crit: 0 } }, active));
    setSaving(true);
    const pending = syncGameState(patch, { throwOnError: true });
    // syncGameState updates the local snapshot synchronously; notify hooks optimistically.
    window.dispatchEvent(new Event('pokemon-rpg-state-change'));
    window.dispatchEvent(new Event('formula-settings-change'));
    try {
      await pending;
      toast.success(success);
      return true;
    } catch (e) {
      toast.error('Não foi possível salvar as fórmulas', { description: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (readOnly || hasErrors) return;
    const isActive = draft.id === settings.activePresetId;
    void persist({ ...settings, presets: settings.presets.map(p => p.id === draft.id ? draft : p) }, isActive, `Preset "${draft.name}" salvo.`);
  };

  const activate = (id: string) => {
    void persist({ ...settings, activePresetId: id }, true, 'Preset ativado. HP e PP de todos os Pokémon recalculados preservando o dano e os pontos gastos.');
  };

  const create = (base: FormulaPreset) => {
    const name = window.prompt('Nome do novo preset', `${base.name} (cópia)`);
    if (!name?.trim()) return;
    const next: FormulaPreset = { ...clonePreset(base), id: `preset-${Date.now()}`, name: name.trim(), builtin: false };
    void persist({ ...settings, presets: [...settings.presets, next] }, false, 'Preset criado.').then(ok => { if (ok) setSelectedId(next.id); });
  };

  const remove = () => {
    if (readOnly || !window.confirm(`Excluir o preset "${stored.name}"?`)) return;
    const wasActive = settings.activePresetId === stored.id;
    const presets = settings.presets.filter(p => p.id !== stored.id);
    void persist({ presets, activePresetId: wasActive ? ORIGINAL_PRESET.id : settings.activePresetId }, wasActive, 'Preset excluído.').then(ok => { if (ok) setSelectedId(ORIGINAL_PRESET.id); });
  };

  const setFormula = (k: FormulaKey, v: string) => setDraft(d => ({ ...d, formulas: { ...d.formulas, [k]: v } }));
  const setRow = (table: 'physTable' | 'specTable', i: number, patch: Partial<DamageRow>) =>
    setDraft(d => ({ ...d, [table]: d[table].map((r, idx) => idx === i ? { ...r, ...patch } : r) }));

  const formulaField = (k: FormulaKey) => {
    const meta = FORMULA_META[k];
    return (
      <div key={k} className="rounded-xl border border-border bg-background/60 p-3">
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor={`formula-${k}`} className="text-sm font-semibold">{meta.label}</label>
          <span className="text-[11px] text-muted-foreground">{meta.help}</span>
        </div>
        <Input
          id={`formula-${k}`}
          value={draft.formulas[k]}
          disabled={readOnly}
          onChange={e => setFormula(k, e.target.value)}
          spellCheck={false}
          className={`h-9 font-mono text-sm ${errors[k] ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          data-testid={`input-formula-${k}`}
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {errors[k]
            ? <span className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle size={12} /> {errors[k]}</span>
            : meta.vars.length <= 12 && meta.vars.map(v => <code key={v} className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{v}</code>)}
        </div>
      </div>
    );
  };

  const tableEditor = (table: 'physTable' | 'specTable', title: string, overflow: FormulaKey) => (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {!readOnly && <Button size="sm" variant="ghost" onClick={() => setDraft(d => { const last = d[table][d[table].length - 1] || { max: 0, dice: 1, sides: 8, bonus: 0 }; return { ...d, [table]: [...d[table], { ...last, max: last.max + 20 }] }; })}><Plus size={14} /> Linha</Button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[18rem] text-xs">
          <thead className="text-muted-foreground"><tr><th className="py-1 text-left">Poder até</th><th>Dados</th><th>Faces</th><th>Bônus</th><th className="w-6" /></tr></thead>
          <tbody>
            {draft[table].map((row, i) => (
              <tr key={i} className="border-t border-border/50">
                {(['max', 'dice', 'sides', 'bonus'] as const).map(f => (
                  <td key={f} className="px-0.5 py-1"><Input type="number" disabled={readOnly} value={Number.isFinite(row[f]) ? row[f] : ''} onChange={e => setRow(table, i, { [f]: e.target.value === '' ? NaN : Number(e.target.value) })} className="h-7 px-1 text-center font-mono text-xs" /></td>
                ))}
                <td>{!readOnly && draft[table].length > 1 && <button type="button" aria-label="Remover linha" className="p-1 text-muted-foreground hover:text-destructive" onClick={() => setDraft(d => ({ ...d, [table]: d[table].filter((_, idx) => idx !== i) }))}><X size={12} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">{formulaField(overflow)}</div>
    </div>
  );

  return (
    <Card className="paper-panel">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><FunctionSquare className="text-primary" /> Fórmulas da campanha</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Toda a mesa usa o preset ativo: fichas, rolagens, dano e HP.</p>
          </div>
          {onClose && <Button variant="ghost" size="sm" onClick={onClose}><X size={15} /> Fechar</Button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.presets.map(p => (
            <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${p.id === selectedId ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`} data-testid={`button-preset-${p.id}`}>
              {p.id === settings.activePresetId && <Star size={13} className="fill-current" />}{p.name}
            </button>
          ))}
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => create(ORIGINAL_PRESET)} data-testid="button-preset-new"><Plus size={14} /> Novo</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
          {readOnly
            ? <Input value={draft.name} disabled className="h-9 w-48" />
            : <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className="h-9 w-48" aria-label="Nome do preset" data-testid="input-preset-name" />}
          {readOnly && <Badge variant="outline">Original · somente leitura</Badge>}
          {stored.id === settings.activePresetId ? <Badge>Ativo</Badge> : <Button size="sm" variant="outline" onClick={() => activate(stored.id)} disabled={dirty || saving} data-testid="button-preset-activate"><Check size={14} /> Ativar</Button>}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => create(draft)}><CopyPlus size={14} /> Duplicar</Button>
            {!readOnly && <>
              <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setDraft(clonePreset(stored))}><RotateCcw size={14} /> Descartar</Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}><Trash2 size={14} /> Excluir</Button>
              <Button size="sm" disabled={!dirty || hasErrors || saving} onClick={save} data-testid="button-preset-save"><Save size={14} /> Salvar</Button>
            </>}
          </div>
        </div>

        {structureErrors.length > 0 && !readOnly && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" data-testid="text-formula-errors">
            <p className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> {structureErrors.length} problema(s) impedem salvar</p>
            <ul className="list-inside list-disc space-y-0.5 text-xs">{structureErrors.slice(0, 8).map(e => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        <section className="space-y-3">
          <h3 className="eyebrow">Dados de teste</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {([['iv', 'Por IV', 'SS 5 · S 4 · A 3 · B 2 · C 1 · D 0'], ['base', 'Por stat base', '<10 = 0 · 10–29 = 1 · 30–49 = 2 · +1 a cada 20']] as const).map(([mode, label, hint]) => (
              <button key={mode} type="button" disabled={readOnly} onClick={() => setDraft(d => ({ ...d, diceMode: mode }))} aria-pressed={draft.diceMode === mode} className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed ${draft.diceMode === mode ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`} data-testid={`button-dice-mode-${mode}`}>
                <p className="font-semibold">{label}</p><p className="font-mono text-xs text-muted-foreground">{hint}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Natureza soma ou subtrai 1 dado em ambos os modos, nunca abaixo de 0. Com 0 dados: rola 2 e fica com o pior. Com 1 ou mais: rola a quantidade e fica com o melhor.</p>
          {draft.diceMode === 'base' && (
            <div className="rounded-xl border border-border bg-background/60 p-3">
              <p className="mb-2 text-sm font-semibold">Valor numérico do IV <code className="text-xs text-muted-foreground">(IVs)</code></p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {IV_RANKS.map(r => (
                  <label key={r} className="text-center text-xs font-bold text-muted-foreground">{r}
                    <Input type="number" disabled={readOnly} value={Number.isFinite(draft.ivValues[r]) ? draft.ivValues[r] : ''} onChange={e => setDraft(d => ({ ...d, ivValues: { ...d.ivValues, [r]: e.target.value === '' ? NaN : Number(e.target.value) } }))} className="mt-1 h-8 text-center font-mono" />
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <details className="rounded-xl border border-border bg-secondary/10 p-3">
          <summary className="cursor-pointer text-sm font-semibold">Variáveis disponíveis nas fórmulas</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {VARIABLE_REFERENCE.map(([variable, description]) => (
              <div key={variable} className="rounded-lg border border-border/70 bg-background/60 p-2 text-xs">
                <code className="font-semibold text-primary">{variable}</code>
                <p className="mt-1 text-muted-foreground">{description}</p>
              </div>
            ))}
            <div className="rounded-lg border border-border/70 bg-background/60 p-2 text-xs">
              <code className="font-semibold text-primary">X, E</code>
              <p className="mt-1 text-muted-foreground">Valor antes do estágio e estágio atual; usados nas fórmulas de estágio.</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-2 text-xs">
              <code className="font-semibold text-primary">P, Pt, Bt</code>
              <p className="mt-1 text-muted-foreground">Poder atual, poder da última linha e bônus da última linha das tabelas de dano.</p>
            </div>
          </div>
        </details>

        <section className="space-y-3">
          <div><h3 className="eyebrow">Modo de Pontos de Poder</h3><p className="text-xs text-muted-foreground">Escolha entre PP contados em cada ataque ou uma única barra compartilhada.</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ['individual', 'PP por ataque', 'Cada ataque mantém sua própria contagem de usos.'],
              ['pool', 'Barra de PP compartilhada', 'Todos os ataques gastam da mesma reserva de Pontos de Poder.'],
            ] as const).map(([mode, label, hint]) => (
              <button key={mode} type="button" disabled={readOnly} onClick={() => setDraft(d => ({ ...d, ppMode: mode }))} aria-pressed={draft.ppMode === mode} className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed ${draft.ppMode === mode ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`} data-testid={`button-pp-mode-${mode}`}>
                <p className="font-semibold">{label}</p><p className="text-xs text-muted-foreground">{hint}</p>
              </button>
            ))}
          </div>
          {draft.ppMode === 'pool' && (
            <div className="grid gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">PP inicial sem custo
                <Input type="number" min={0} step={1} disabled={readOnly} value={Number.isFinite(draft.ppFreeThreshold) ? draft.ppFreeThreshold : ''} onChange={e => setDraft(d => ({ ...d, ppFreeThreshold: e.target.value === '' ? NaN : Math.max(0, Math.floor(Number(e.target.value))) }))} className="mt-1 h-9 font-mono" data-testid="input-pp-free-threshold" />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">Ataques com PP igual ou abaixo deste valor custam zero pontos.</span>
              </label>
              <label className="text-sm font-semibold">Média para cada ponto de custo
                <Input type="number" min={1} step={1} disabled={readOnly} value={Number.isFinite(draft.ppStep) ? draft.ppStep : ''} onChange={e => setDraft(d => ({ ...d, ppStep: e.target.value === '' ? NaN : Math.max(1, Math.floor(Number(e.target.value))) }))} className="mt-1 h-9 font-mono" data-testid="input-pp-step" />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">Acima do valor inicial, cada bloco deste tamanho acrescenta 1 ponto ao custo do ataque.</span>
              </label>
            </div>
          )}
        </section>

        {GROUPS.filter(group => group.id !== 'pp' || draft.ppMode === 'pool').map(g => (
          <section key={g.id} className="space-y-3">
            <div><h3 className="eyebrow">{g.title}</h3><p className="text-xs text-muted-foreground">{g.note}</p></div>
            {g.id === 'table'
              ? <div className="grid gap-3 lg:grid-cols-2">{tableEditor('physTable', 'Físico', 'physOverflow')}{tableEditor('specTable', 'Especial', 'specOverflow')}</div>
              : <div className="grid gap-3 lg:grid-cols-2">{(Object.keys(FORMULA_META) as FormulaKey[]).filter(k => FORMULA_META[k].group === g.id).map(formulaField)}</div>}
          </section>
        ))}

        <section className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="eyebrow">Prévia com este rascunho</h3>
            <select value={sampleId} onChange={e => setSampleId(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm" aria-label="Pokémon de exemplo">
              {pokemon.map(p => <option key={p.id} value={p.id}>{p.name || 'Sem nome'} · LV {p.level}</option>)}
            </select>
          </div>
          {hasErrors ? <p className="text-sm text-destructive">Corrija as expressões para ver a prévia.</p>
            : preview?.error ? <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle size={14} /> Erro ao calcular: {preview.error}</p>
            : preview?.d && preview.dice ? <div className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
              {[['HP', preview.d.hp], ['RD Fís.', preview.d.rdFisica], ['RD Esp.', preview.d.rdEspecial], ['Esquiva', preview.d.esquiva], ['Iniciativa', preview.d.iniciativa], ['Dano Fís.', preview.d.bonusDanoFis], ['Dano Esp.', preview.d.bonusDanoEsp], ['Teste SPE', preview.dice.str], ['PP máximo', preview.ppMax], ...Object.entries(preview.evCaps).map(([key, value]) => [`Cap EV ${key}`, value])].map(([l, v]) => (
                <div key={l as string} className="rounded-lg border border-border bg-background/70 px-2 py-1.5"><p className="text-[10px] uppercase text-muted-foreground">{l}</p><p className="font-bold">{v}</p></div>
              ))}
            </div> : <p className="text-sm text-muted-foreground">Nenhum Pokémon cadastrado.</p>}
          <p className="text-[11px] text-muted-foreground">Funções: floor, ceil, round, abs, sqrt, min, max, pow, clamp(v,min,max), if(c,a,b). Operadores: + − * / % ^, comparações e c ? a : b.</p>
        </section>
      </CardContent>
    </Card>
  );
}
