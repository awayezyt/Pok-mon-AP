import React, { useState } from 'react';
import { useAttackData } from '../lib/hooks';
import { Attack, PokemonType } from '../lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TypeIconBadge, CategoryIcon } from '@/components/TypeIcon';
import { RichText } from '@/components/RichText';
import { Search, Plus, Trash2, Edit, ChevronDown, ChevronUp, Swords } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { defaultPokemonTypes } from '../lib/constants';
import { useFormulaSettings } from '../lib/formulas';
import { getPhysicalDamage, getSpecialDamage } from '../lib/calculations';
import { formatStatusChance } from '../lib/attackLocalization';
import { toast } from 'sonner';

export default function Attacks() {
  const { attacks, addAttack, updateAttack, deleteAttack } = useAttackData();
  useFormulaSettings(); // re-render damage notation when presets change
  const [searchTerm, setSearchTerm]       = useState('');
  const [typeFilter, setTypeFilter]       = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [expandedId, setExpandedId]       = useState<string | null>(null);

  const defaultAttack: Omit<Attack, 'id'> = {
    name: '', type: 'Normal', category: 'Físico',
    pp: 35, power: 40, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false,
    effectSummary: '', effectFull: '',
    statusChances: [], stab: true
  };

  const [formData, setFormData] = useState<Omit<Attack, 'id'>>(defaultAttack);

  const filteredAttacks = attacks.filter(a => {
    const matchName = a.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === 'all' || a.type === typeFilter;
    const matchCat  = categoryFilter === 'all' || a.category === categoryFilter;
    return matchName && matchType && matchCat;
  });

  const handleOpenCreate = () => { setFormData(defaultAttack); setEditingId(null); setIsModalOpen(true); };
  const handleOpenEdit   = (attack: Attack) => { setFormData({ ...attack }); setEditingId(attack.id); setIsModalOpen(true); };

  const handleSave = () => {
    if (!formData.name) { toast.error('O ataque precisa de um nome.'); return; }
    if (editingId) { updateAttack(editingId, formData); toast.success('Ataque atualizado.'); }
    else           { addAttack(formData);               toast.success('Ataque criado.'); }
    setIsModalOpen(false);
  };

  const getDamageNotation = (attack: Attack) => {
    if (!attack.power || attack.category === 'Status') return null;
    return attack.category === 'Físico'
      ? getPhysicalDamage(attack.power).notation
      : getSpecialDamage(attack.power).notation;
  };

  return (
    <div className="container mx-auto p-4 max-w-5xl animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Banco de Ataques</h1>
          <p className="text-muted-foreground mt-1">Gerencie os movimentos disponíveis no jogo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleOpenCreate}><Plus className="mr-2 h-4 w-4" /> Novo Ataque</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar ataque..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger><SelectValue placeholder="Filtrar por Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            {defaultPokemonTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger><SelectValue placeholder="Filtrar por Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            <SelectItem value="Físico">Físico</SelectItem>
            <SelectItem value="Especial">Especial</SelectItem>
            <SelectItem value="Status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3">Nome</th>
                <th className="px-3 py-3 text-center">Tipo</th>
                <th className="px-3 py-3 text-center">Cat.</th>
                <th className="px-3 py-3 text-center">Poder</th>
                <th className="px-3 py-3 text-center">Dano</th>
                <th className="px-3 py-3 text-center">Acc</th>
                <th className="px-3 py-3 text-center">PP</th>
                <th className="px-3 py-3 text-center">Crítico</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttacks.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Nenhum ataque encontrado.</td></tr>
              ) : (
                filteredAttacks.map(attack => (
                  <React.Fragment key={attack.id}>
                    <tr className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-3 text-center cursor-pointer" onClick={() => setExpandedId(expandedId === attack.id ? null : attack.id)}>
                        {expandedId === attack.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                      <td className="px-3 py-3 font-bold text-foreground">
                        {attack.name}
                        {attack.makesContact && <span className="ml-1 text-[10px] text-muted-foreground">(contato)</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex justify-center"><TypeIconBadge type={attack.type} size={24} /></div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex justify-center"><CategoryIcon category={attack.category} size={22} /></div>
                      </td>
                      <td className="px-3 py-3 text-center font-mono">{attack.power ?? '-'}</td>
                      <td className="px-3 py-3 text-center font-mono text-xs text-primary/80">
                        {getDamageNotation(attack) ?? '-'}
                      </td>
                      <td className="px-3 py-3 text-center font-mono">{attack.accuracy}%</td>
                      <td className="px-3 py-3 text-center font-mono">{attack.pp}</td>
                      <td className="px-3 py-3 text-center font-mono">{attack.critRange}+</td>
                      <td className="px-3 py-3 text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(attack)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/20" onClick={() => { if (confirm(`Excluir ${attack.name}?`)) deleteAttack(attack.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                    {expandedId === attack.id && (
                      <tr className="bg-secondary/20">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div><p className="font-semibold mb-1 text-primary">Efeito Curto:</p><p className="text-muted-foreground"><RichText text={attack.effectSummary || 'Nenhum.'} replaceTypeNames /></p></div>
                            <div><p className="font-semibold mb-1">Alvo:</p><p className="text-muted-foreground"><RichText text={attack.target} replaceTypeNames /></p></div>
                            <div className="md:col-span-2"><p className="font-semibold mb-1">Descrição:</p><p className="whitespace-pre-wrap text-muted-foreground"><RichText text={attack.effectFull || 'Sem descrição.'} replaceTypeNames /></p></div>
                            <div className="md:col-span-2 flex flex-wrap gap-4 text-xs">
                              <span><b>Prioridade:</b> {attack.priority > 0 ? `+${attack.priority}` : attack.priority}</span>
                              <span><b>Contato:</b> {attack.makesContact ? 'Sim' : 'Não'}</span>
                              {attack.statusChances?.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <b>Chances:</b>
                                  {attack.statusChances.map((sc, i) => (
                                    <span key={i} className="rounded bg-accent px-2 py-0.5"><RichText text={`${sc.effect} (${formatStatusChance(sc.chance)})`} replaceTypeNames /></span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Ataque' : 'Novo Ataque'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Ataque</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.type} onValueChange={(val: any) => setFormData({...formData, type: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {defaultPokemonTypes.map(t => (
                    <SelectItem key={t} value={t}>
                      <div className="flex items-center gap-2"><TypeIconBadge type={t as PokemonType} size={16} /> {t}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={formData.category} onValueChange={(val: any) => setFormData({...formData, category: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Físico"><div className="flex items-center gap-2"><CategoryIcon category="Físico" size={18}/> Físico</div></SelectItem>
                  <SelectItem value="Especial"><div className="flex items-center gap-2"><CategoryIcon category="Especial" size={18}/> Especial</div></SelectItem>
                  <SelectItem value="Status"><div className="flex items-center gap-2"><CategoryIcon category="Status" size={18}/> Status</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>Poder</Label>
                <Input type="number" value={formData.power === null ? '' : formData.power} onChange={e => setFormData({...formData, power: e.target.value ? Number(e.target.value) : null})} />
              </div>
              <div className="space-y-2">
                <Label>Acc (%)</Label>
                <Input type="number" value={formData.accuracy} onChange={e => setFormData({...formData, accuracy: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>PP</Label>
                <Input type="number" value={formData.pp} onChange={e => setFormData({...formData, pp: Number(e.target.value)})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Margem de Crítico</Label>
                <Input type="number" value={formData.critRange} onChange={e => setFormData({...formData, critRange: Number(e.target.value)})} />
                <p className="text-xs text-muted-foreground">Ex: 20 (apenas 20), 19 (19-20)</p>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Input type="number" value={formData.priority} onChange={e => setFormData({...formData, priority: Number(e.target.value)})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Alvo</Label>
              <Input value={formData.target} onChange={e => setFormData({...formData, target: e.target.value})} placeholder="Ex: Alvo único" />
            </div>
            <div className="space-y-2">
              <Label>Resumo do Efeito</Label>
              <Input value={formData.effectSummary} onChange={e => setFormData({...formData, effectSummary: e.target.value})} placeholder="Efeito curto" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição Completa</Label>
              <Textarea value={formData.effectFull} onChange={e => setFormData({...formData, effectFull: e.target.value})} rows={3} />
            </div>
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center space-x-2 bg-secondary/30 p-3 rounded-lg border border-border">
                <Checkbox id="stab" checked={formData.stab} onCheckedChange={c => setFormData({...formData, stab: !!c})} />
                <label htmlFor="stab" className="text-sm font-medium cursor-pointer">Aplica STAB automático (se o tipo coincidir)</label>
              </div>
              <div className="flex items-center space-x-2 bg-secondary/30 p-3 rounded-lg border border-border">
                <Checkbox id="contact" checked={formData.makesContact} onCheckedChange={c => setFormData({...formData, makesContact: !!c})} />
                <label htmlFor="contact" className="text-sm font-medium cursor-pointer">Faz contato físico</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}><Swords className="mr-2 h-4 w-4" /> Salvar Ataque</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
