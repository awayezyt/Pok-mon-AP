import { useState } from 'react';
import { Check, Minus, Pencil, Plus, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import './_group.css';

type AttributeKey = 'agi' | 'car' | 'for' | 'int' | 'vig' | 'von';
type Skill = { name: string; value: number; extraPoints?: number; trained: boolean };
type Ability = { name: string; detail: string; uses: string };
type Npc = {
  name: string; className: string; path: string; level: number; hp: number; hpMax: number;
  focus: number; focusMax: number; attributes: Record<AttributeKey, number>; skills: Skill[];
  abilities: Ability[]; notes: string; pokemon: string[];
};
const attributeKeys: AttributeKey[] = ['agi', 'car', 'for', 'int', 'vig', 'von'];
const attributeLabels: Record<AttributeKey, string> = { agi: 'Agilidade', car: 'Carisma', for: 'Força', int: 'Inteligência', vig: 'Vigor', von: 'Vontade' };
const skillNames = ['Acrobacia', 'Artes', 'Adestramento', 'Atletismo', 'Atualidade', 'Crime', 'Ciências', 'Diplomacia', 'Determinação', 'Enganação', 'Engajamento', 'Exploração', 'Furtividade', 'Fortitude', 'Iniciativa', 'Intimidação', 'Intuição', 'Investigação', 'Luta', 'Medicina', 'Ofício', 'Pontaria', 'Percepção', 'Reflexo', 'Sorte', 'Sobrevivência', 'Tática', 'Tecnologia'];
const initialNpc: Npc = {
  name: 'Mara Solis', className: 'Treinador', path: 'Estrategista', level: 7, hp: 24, hpMax: 31,
  focus: 12, focusMax: 18, attributes: { agi: 3, car: 2, for: 1, int: 4, vig: 3, von: 3 },
  skills: skillNames.map((name, index) => ({ name, value: index === 2 ? 4 : index === 15 ? 3 : index === 26 ? 5 : 0, extraPoints: 0, trained: index === 2 || index === 15 || index === 26 })),
  abilities: [{ name: 'Leitura de combate', detail: 'Analisa a formação adversária antes de dar ordens.', uses: '1 vez por cena' }],
  notes: 'Conhece bem as rotas do norte. Desconfia de visitantes que perguntam sobre a antiga estação.',
  pokemon: ['Mimikyu', 'Mareep'],
};
const classPaths: Record<string, string[]> = {
  Contestante: ['Artista de rua', 'Cantor', 'Duelista', 'Dançarino', 'Estilista'],
  Aventureiro: ['Audacioso', 'Engenheiro', 'Cozinheiro', 'Caçador de tesouros', 'Mochileiro'],
  Pesquisador: ['Arqueólogo', 'Cientista', 'Estudado', 'Teólogo', 'Médico'],
  Treinador: ['Artista marcial', 'Estrategista', 'Médium', 'Ninja', 'Obstinado'],
};
const skillCap = (level: number) => level <= 5 ? 5 : level <= 9 ? 10 : 20;

export function ViewMode() {
  const [npc, setNpc] = useState(initialNpc);
  const [editing, setEditing] = useState(false);
  const [editTab, setEditTab] = useState<'ficha' | 'anotacoes' | 'pokemon'>('ficha');
  const patch = (data: Partial<Npc>) => setNpc(current => ({ ...current, ...data }));
  const changeResource = (key: 'hp' | 'focus', value: number) => {
    const max = key === 'hp' ? npc.hpMax : npc.focusMax;
    patch({ [key]: Math.max(0, Math.min(max, value)) });
  };
  const renderResource = (label: string, key: 'hp' | 'focus', current: number, max: number, tone: string) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">{label}</p><span className={`font-mono text-xs ${tone}`}>{max ? Math.round(current / max * 100) : 0}%</span></div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label={`Diminuir ${label}`} onClick={() => changeResource(key, current - 1)}><Minus size={14} /></Button>
        <label className="flex items-center gap-2"><Input aria-label={`${label} atual`} type="number" min={0} max={max} value={current} onChange={event => changeResource(key, Number(event.target.value) || 0)} className="h-10 w-20 text-center font-mono text-lg font-bold" /><span className="font-mono text-sm text-muted-foreground">/ {max}</span></label>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label={`Aumentar ${label}`} onClick={() => changeResource(key, current + 1)}><Plus size={14} /></Button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${key === 'hp' ? 'bg-rose-500' : 'bg-sky-500'}`} style={{ width: `${max ? Math.max(0, Math.min(100, current / max * 100)) : 0}%` }} /></div>
    </div>
  );
  const saveSkill = (index: number, value: number, extraPoints?: number) => patch({ skills: npc.skills.map((skill, i) => i === index ? { ...skill, ...(extraPoints === undefined ? { value: Math.max(0, Math.min(skillCap(npc.level), value)) } : { extraPoints: Math.max(0, extraPoints) }) } : skill) });

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-secondary/30 px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-primary"><Shield size={14} /> Ficha de NPC</p>
            <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{npc.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{npc.className} <span className="mx-1">·</span> {npc.path} <span className="mx-1">·</span> Nível {npc.level}</p>
          </div>
          <Button size="sm" variant={editing ? 'default' : 'outline'} onClick={() => setEditing(value => !value)} aria-label={editing ? 'Concluir edição' : 'Editar ficha'}>
            {editing ? <><Check size={15} className="mr-2" />Concluir</> : <><Pencil size={15} className="mr-2" />Editar ficha</>}
          </Button>
        </header>

        {editing && <nav className="flex gap-1 overflow-x-auto border-b border-border px-5 sm:px-7" aria-label="Seções da ficha">
          {([['ficha', 'Ficha'], ['anotacoes', 'Anotações'], ['pokemon', 'Pokémon']] as const).map(([value, label]) => <button key={value} onClick={() => setEditTab(value)} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${editTab === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</button>)}
        </nav>}

        {editing && editTab === 'ficha' ? (
          <div className="space-y-6 p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input aria-label="Nome" value={npc.name} onChange={event => patch({ name: event.target.value })} />
              <select aria-label="Classe" value={npc.className} onChange={event => patch({ className: event.target.value, path: classPaths[event.target.value][0] })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{Object.keys(classPaths).map(item => <option key={item}>{item}</option>)}</select>
              <select aria-label="Trilha" value={npc.path} onChange={event => patch({ path: event.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{classPaths[npc.className].map(item => <option key={item}>{item}</option>)}</select>
              <Input aria-label="Nível" type="number" min={1} value={npc.level} onChange={event => patch({ level: Math.max(1, Number(event.target.value) || 1) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">{renderResource('PV', 'hp', npc.hp, npc.hpMax, 'text-rose-600')}{renderResource('PE', 'focus', npc.focus, npc.focusMax, 'text-sky-600')}</div>
            <div><SectionTitle>Atributos</SectionTitle><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{attributeKeys.map(key => <label key={key} className="rounded-lg border border-border p-2 text-xs text-muted-foreground">{attributeLabels[key]}<Input type="number" min={1} value={npc.attributes[key]} onChange={event => patch({ attributes: { ...npc.attributes, [key]: Math.max(1, Number(event.target.value) || 1) } })} className="mt-1 h-8 px-1 text-center font-mono text-foreground" /></label>)}</div></div>
            <div><SectionTitle>Perícias</SectionTitle><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{npc.skills.map((skill, index) => <div key={skill.name} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"><span className="text-sm">{skill.name}</span><div className="flex items-center gap-1"><Input aria-label={`${skill.name} pontos`} type="number" min={0} max={skillCap(npc.level)} value={skill.value} onChange={event => saveSkill(index, Number(event.target.value) || 0)} className="h-8 w-12 px-1 text-center font-mono" /><span className="text-xs text-muted-foreground">+</span><Input aria-label={`${skill.name} extra`} type="number" min={0} value={skill.extraPoints ?? 0} onChange={event => saveSkill(index, 0, Number(event.target.value) || 0)} className="h-8 w-12 px-1 text-center font-mono" /></div></div>)}</div></div>
            <div><div className="mb-2 flex items-center justify-between"><SectionTitle>Habilidades</SectionTitle><Button size="sm" variant="outline" onClick={() => patch({ abilities: [...npc.abilities, { name: '', detail: '', uses: '' }] })}><Plus size={14} className="mr-1" />Nova</Button></div><div className="space-y-2">{npc.abilities.map((ability, index) => <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1.4fr_1fr]"><Input aria-label="Nome da habilidade" value={ability.name} onChange={event => patch({ abilities: npc.abilities.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} placeholder="Nome" /><Textarea aria-label="Descrição da habilidade" value={ability.detail} onChange={event => patch({ abilities: npc.abilities.map((item, i) => i === index ? { ...item, detail: event.target.value } : item) })} rows={2} placeholder="Descrição" /><Input aria-label="Usos" value={ability.uses} onChange={event => patch({ abilities: npc.abilities.map((item, i) => i === index ? { ...item, uses: event.target.value } : item) })} placeholder="Usos ou custo" /></div>)}</div></div>
          </div>
        ) : editing && editTab === 'anotacoes' ? (
          <div className="p-5 sm:p-7"><Textarea aria-label="Anotações do NPC" value={npc.notes} onChange={event => patch({ notes: event.target.value })} className="min-h-52" placeholder="Informações importantes sobre este NPC..." /></div>
        ) : editing && editTab === 'pokemon' ? (
          <div className="space-y-4 p-5 sm:p-7"><SectionTitle>Pokémon associados</SectionTitle><div className="flex flex-wrap gap-2">{npc.pokemon.map((name, index) => <div key={name} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">{name}<button onClick={() => patch({ pokemon: npc.pokemon.filter((_, i) => i !== index) })} className="text-muted-foreground hover:text-destructive" aria-label={`Remover ${name}`}>×</button></div>)}</div><Button variant="outline" onClick={() => patch({ pokemon: [...npc.pokemon, 'Pikachu'] })}><Plus size={14} className="mr-2" />Adicionar Pokémon</Button></div>
        ) : (
          <div className="space-y-7 p-5 sm:p-7">
            <section className="grid gap-3 sm:grid-cols-2">{renderResource('PV', 'hp', npc.hp, npc.hpMax, 'text-rose-600')}{renderResource('PE', 'focus', npc.focus, npc.focusMax, 'text-sky-600')}</section>
            <section><SectionTitle>Atributos</SectionTitle><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{attributeKeys.map(key => <div key={key} className="rounded-xl border border-border bg-background px-3 py-3"><p className="text-xs text-muted-foreground">{attributeLabels[key]}</p><p className="mt-1 font-mono text-xl font-bold">{npc.attributes[key]}</p></div>)}</div></section>
            <section><SectionTitle>Perícias</SectionTitle><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{npc.skills.map(skill => <div key={skill.name} className={`flex items-center justify-between rounded-lg border border-border px-3 py-2 ${skill.value || skill.extraPoints ? 'bg-primary/5' : 'bg-background'}`}><span className="text-sm">{skill.name}</span><span className={`font-mono text-sm ${skill.value || skill.extraPoints ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{skill.value}{(skill.extraPoints ?? 0) > 0 ? ` + ${skill.extraPoints}` : ''}</span></div>)}</div></section>
            <section><SectionTitle>Habilidades</SectionTitle>{npc.abilities.length ? <div className="grid gap-3 sm:grid-cols-2">{npc.abilities.map((ability, index) => <article key={`${ability.name}-${index}`} className="rounded-xl border border-border bg-background p-4"><div className="flex items-start gap-2"><Sparkles size={16} className="mt-0.5 shrink-0 text-primary" /><div><h3 className="font-semibold">{ability.name || 'Habilidade sem nome'}</h3><p className="mt-1 text-sm text-muted-foreground">{ability.detail || 'Sem descrição.'}</p>{ability.uses && <p className="mt-3 text-xs font-semibold text-primary">{ability.uses}</p>}</div></div></article>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma habilidade cadastrada.</p>}</section>
            <section className="grid gap-3 border-t border-border pt-5 sm:grid-cols-2"><div><SectionTitle>Anotações</SectionTitle><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{npc.notes || 'Nenhuma anotação registrada.'}</p></div><div><SectionTitle>Pokémon associados</SectionTitle>{npc.pokemon.length ? <div className="flex flex-wrap gap-2">{npc.pokemon.map(name => <span key={name} className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-sm">{name}</span>)}</div> : <p className="text-sm text-muted-foreground">Nenhum Pokémon associado.</p>}</div></section>
          </div>
        )}
      </section>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">{children}</h2>;
}
