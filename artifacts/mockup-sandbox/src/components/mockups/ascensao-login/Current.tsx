import { useState } from 'react';
import { BookOpen, KeyRound, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import './_group.css';

const characters = [{ id: 'lyra', name: 'Lyra', player: 'Marina' }];

export function Current() {
  const [code, setCode] = useState('');
  const [gmMode, setGmMode] = useState(false);
  const [showPublic, setShowPublic] = useState(false);
  const [characterId, setCharacterId] = useState(characters[0].id);

  if (showPublic) {
    return <main className="min-h-screen rpg-shell flex items-center justify-center p-6"><section className="w-full max-w-xl rounded-2xl border border-border bg-card/95 p-10 text-center"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><BookOpen /></div><p className="eyebrow mb-3">Mesa aberta</p><h1 className="font-display mb-3 text-4xl">Arquivo público da campanha</h1><p className="mb-8 text-muted-foreground">Consulte a Pokédex e as anotações que o mestre decidiu compartilhar.</p><Button className="w-full">Abrir arquivo público</Button><button className="mt-5 text-sm text-muted-foreground" onClick={() => setShowPublic(false)}>Voltar ao acesso</button></section></main>;
  }

  return (
    <main className="min-h-screen rpg-shell flex items-center justify-center p-5">
      <section className="paper-panel grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card/95 lg:grid-cols-[1.05fr_.95fr]">
        <div className="relative hidden min-h-[620px] flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(120deg, transparent 0 45%, hsl(var(--accent)) 45% 46%, transparent 46%), radial-gradient(circle at 80% 20%, hsl(var(--accent) / .8), transparent 24%)' }} />
          <div className="relative">
            <div className="mb-16 flex items-center gap-3"><ShieldCheck size={26} /><span className="font-mono text-xs uppercase tracking-[.2em]">Caderno de campo</span></div>
            <p className="eyebrow mb-4 text-primary-foreground/65">Ascenção e Presságio</p>
            <h1 className="font-display text-6xl leading-[.95]">Toda boa<br />aventura<br /><i>deixa marca.</i></h1>
          </div>
          <div className="relative flex items-end justify-between gap-6"><p className="max-w-xs text-sm text-primary-foreground/70">Fichas, criaturas e segredos da mesa no mesmo lugar. Feito para jogar, não para administrar.</p><div className="font-mono text-xs text-primary-foreground/60">v. 2.4 / PORTO SALITRE</div></div>
        </div>
        <div className="flex flex-col justify-center p-7 md:p-12">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><ShieldCheck className="text-primary" /><span className="font-mono text-xs uppercase tracking-[.2em]">Caderno de campo</span></div>
          <p className="eyebrow mb-3">{gmMode ? 'Sala de comando' : 'Acesso da mesa'}</p>
          <h2 className="font-display mb-3 text-4xl">{gmMode ? 'Escudo do mestre' : 'Entre na campanha'}</h2>
          <p className="mb-8 text-muted-foreground">{gmMode ? 'Os segredos ficam aqui. Compartilhe somente o que estiver pronto.' : 'Use a senha entregue pelo mestre para abrir suas fichas.'}</p>
          <form onSubmit={event => event.preventDefault()} className="space-y-4">
            {!gmMode && <div><label className="mb-2 block text-sm font-semibold" htmlFor="current-character">Ficha</label><select id="current-character" value={characterId} onChange={event => setCharacterId(event.target.value)} className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm">{characters.map(character => <option key={character.id} value={character.id}>{character.name} · {character.player}</option>)}</select></div>}
            <div><label className="mb-2 block text-sm font-semibold" htmlFor="current-code">Senha de {gmMode ? 'mestre' : 'jogador'}</label><div className="relative"><KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} /><Input id="current-code" type="password" value={code} onChange={event => setCode(event.target.value)} className="h-12 pl-10" placeholder="Digite o código da mesa" /></div></div>
            <Button type="submit" className="h-12 w-full text-base">{gmMode ? 'Abrir escudo' : 'Abrir minhas fichas'}</Button>
          </form>
          <div className="mt-8 flex items-center justify-between border-t border-border pt-5"><button onClick={() => { setGmMode(!gmMode); setCode(''); }} className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground"><LockKeyhole size={14} /> {gmMode ? 'Sou jogador' : 'Acesso do mestre'}</button><button onClick={() => setShowPublic(true)} className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground"><UsersRound size={14} /> Área pública</button></div>
        </div>
      </section>
    </main>
  );
}