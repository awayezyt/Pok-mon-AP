import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import './_group.css';

type AttributeKey = 'agi' | 'car' | 'for' | 'int' | 'vig' | 'von';
type Skill = { name: string; value: number; extraPoints?: number; trained: boolean };
type Ability = { name: string; detail: string; uses: string };
type Npc = {
  name: string; className: string; path: string; level: number; hp: number; hpMax: number;
  focus: number; focusMax: number; attributes: Record<AttributeKey, number>; skills: Skill[]; abilities: Ability[];
};
const classPaths: Record<string, string[]> = {
  Contestante: ['Artista de rua', 'Cantor', 'Duelista', 'Dançarino', 'Estilista'],
  Aventureiro: ['Audacioso', 'Engenheiro', 'Cozinheiro', 'Caçador de tesouros', 'Mochileiro'],
  Pesquisador: ['Arqueólogo', 'Cientista', 'Estudado', 'Teólogo', 'Médico'],
  Treinador: ['Artista marcial', 'Estrategista', 'Médium', 'Ninja', 'Obstinado'],
};
const skillNames = ['Acrobacia', 'Artes', 'Adestramento', 'Atletismo', 'Atualidade', 'Crime', 'Ciências', 'Diplomacia', 'Determinação', 'Enganação', 'Engajamento', 'Exploração', 'Furtividade', 'Fortitude', 'Iniciativa', 'Intimidação', 'Intuição', 'Investigação', 'Luta', 'Medicina', 'Ofício', 'Pontaria', 'Percepção', 'Reflexo', 'Sorte', 'Sobrevivência', 'Tática', 'Tecnologia'];
const attributeKeys: AttributeKey[] = ['agi', 'car', 'for', 'int', 'vig', 'von'];
const attributeLabels: Record<AttributeKey, string> = { agi: 'Agilidade', car: 'Carisma', for: 'Força', int: 'Inteligência', vig: 'Vigor', von: 'Vontade' };
const initialNpc: Npc = {
  name: 'Mara Solis', className: 'Treinador', path: 'Estrategista', level: 7, hp: 24, hpMax: 31,
  focus: 12, focusMax: 18, attributes: { agi: 3, car: 2, for: 1, int: 4, vig: 3, von: 3 },
  skills: skillNames.map((name, index) => ({ name, value: index === 2 ? 4 : index === 15 ? 3 : index === 26 ? 5 : 0, extraPoints: 0, trained: index === 2 || index === 15 || index === 26 })),
  abilities: [{ name: 'Leitura de combate', detail: 'Analisa a formação adversária antes de dar ordens.', uses: '1 vez por cena' }],
};
const skillCap = (level: number) => level <= 5 ? 5 : level <= 9 ? 10 : 20;

export function Current() {
  const [npc, setNpc] = useState(initialNpc);
  const patch = (data: Partial<Npc>) => setNpc(current => ({ ...current, ...data }));
  const className = npc.className || 'Treinador';
  const attributes = npc.attributes;
  const skills = npc.skills || skillNames.map(name => ({ name, value: 0, trained: false }));
  const abilities = npc.abilities || [];
  const updateAbility = (index: number, data: Partial<Ability>) => patch({ abilities: abilities.map((ability, abilityIndex) => abilityIndex === index ? { ...ability, ...data } : ability) });
  const addAbility = () => patch({ abilities: [...abilities, { name: '', detail: '', uses: '' }] });

  return (
    <div className="min-h-screen bg-background p-5 text-foreground">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="max-h-[72vh] space-y-5 overflow-y-auto overscroll-contain pr-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={npc.name} onChange={event => patch({ name: event.target.value })} placeholder="Nome" />
            <select value={className} onChange={event => patch({ className: event.target.value, path: classPaths[event.target.value][0] })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{Object.keys(classPaths).map(item => <option key={item}>{item}</option>)}</select>
            <select value={npc.path || classPaths[className][0]} onChange={event => patch({ path: event.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">{classPaths[className].map(item => <option key={item}>{item}</option>)}</select>
            <Input type="number" min={1} value={npc.level || 1} onChange={event => patch({ level: Math.max(1, Number(event.target.value) || 1) })} placeholder="Nível" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PV</p><p className="font-mono text-xl">{npc.hp || 0} / {npc.hpMax || 0}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PE</p><p className="font-mono text-xl">{npc.focus || 0} / {npc.focusMax || 0}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{attributeKeys.map(key => <label key={key} className="rounded-lg border border-primary/20 bg-secondary/20 p-2 text-center"><span className="font-mono text-xs font-bold text-primary">{key.toUpperCase()}</span><Input type="number" min={1} value={attributes[key]} onChange={event => patch({ attributes: { ...attributes, [key]: Math.max(1, Number(event.target.value) || 1) } })} className="mt-1 h-8 px-1 text-center" /></label>)}</div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Perícias</p>
            <p className="mb-2 text-xs text-muted-foreground">Pontos extras são separados: normal + extra.</p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {skills.map((skill, index) => <div key={skill.name} className="flex items-center justify-between gap-1 rounded-md border border-border px-2 py-1.5 text-xs">
                <span className="min-w-0 truncate">{skill.name}</span>
                <Input type="number" min={0} max={skillCap(npc.level || 1)} step={1} value={skill.value} aria-label={`Pontos normais de ${skill.name}`} onChange={event => patch({ skills: skills.map((item, itemIndex) => itemIndex === index ? { ...item, value: Math.max(0, Math.min(skillCap(npc.level || 1), Math.floor(Number(event.target.value) || 0))) } : item) })} className="h-7 w-10 shrink-0 px-1 text-center" />
                <span className="text-muted-foreground" aria-hidden="true">+</span>
                <Input type="number" min={0} step={1} value={skill.extraPoints ?? 0} aria-label={`Pontos extras de ${skill.name}`} onChange={event => patch({ skills: skills.map((item, itemIndex) => itemIndex === index ? { ...item, extraPoints: Math.max(0, Math.floor(Number(event.target.value) || 0)) } : item) })} className="h-7 w-10 shrink-0 px-1 text-center" />
              </div>)}
            </div>
          </div>
          <section className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Habilidades</p><Button size="sm" variant="outline" onClick={addAbility}><Plus size={14} className="mr-2" />Nova habilidade</Button></div>
            {abilities.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma habilidade cadastrada.</p>}
            {abilities.map((ability, index) => <div key={`${ability.name}-${index}`} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(130px,.8fr)_minmax(160px,1.4fr)_minmax(110px,.7fr)_auto]">
              <Input value={ability.name} onChange={event => updateAbility(index, { name: event.target.value })} placeholder="Nome da habilidade" />
              <Textarea value={ability.detail} onChange={event => updateAbility(index, { detail: event.target.value })} placeholder="Descrição" rows={2} className="min-h-10 resize-y" />
              <Input value={ability.uses || ''} onChange={event => updateAbility(index, { uses: event.target.value })} placeholder="Usos ou custo" />
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => patch({ abilities: abilities.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Excluir habilidade ${index + 1}`}><Trash2 size={15} /></Button>
            </div>)}
          </section>
        </div>
      </div>
    </div>
  );
}
