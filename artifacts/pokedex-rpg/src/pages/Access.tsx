import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BookOpen, KeyRound, LockKeyhole, MoonStar, Orbit, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useCharacterSheets, useSessionRole } from '../lib/campaign';
import { hydrateGameState } from '../lib/cloudSync';

export default function Access() {
  const [, setLocation] = useLocation();
  const { setRole, role, activeCharacterId } = useSessionRole();
  const { characters } = useCharacterSheets();
  const [code, setCode] = useState('');
  const [gmMode, setGmMode] = useState(false);
  const [showPublic, setShowPublic] = useState(false);
  const [characterId, setCharacterId] = useState(characters[0]?.id || '');
  useEffect(() => {
    if (role === 'gm') setLocation('/mestre');
    if (role === 'player') setLocation(`/personagem?id=${encodeURIComponent(activeCharacterId || '')}`);
  }, [role, activeCharacterId, setLocation]);

  const enter = (event: FormEvent) => {
    event.preventDefault();
    if (gmMode) {
      void fetch('/api/auth/gm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: code }),
      }).then(async response => {
        if (!response.ok) throw new Error('invalid');
        await hydrateGameState();
        window.dispatchEvent(new CustomEvent('pokemon-rpg-state-change'));
        setRole('gm');
        setLocation('/mestre');
      }).catch(() => toast.error('Senha do mestre incorreta ou não configurada.'));
      return;
    }
    const character = characters.find(item => item.id === characterId);
    if (!character || !code) {
      toast.error('Senha da ficha incorreta.');
      return;
    }
    void fetch('/api/auth/player', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: character.id, password: code }),
    }).then(async response => {
      if (!response.ok) throw new Error('invalid');
      await hydrateGameState();
      window.dispatchEvent(new CustomEvent('pokemon-rpg-state-change'));
      setRole('player', character.id);
      setLocation(`/personagem?id=${character.id}`);
    }).catch(() => toast.error('Senha da ficha incorreta ou servidor indisponível.'));
  };

  if (showPublic) {
    return (
      <main className="min-h-[100dvh] rpg-shell flex items-center justify-center p-6">
        <section className="w-full max-w-xl paper-panel rounded-2xl border border-border bg-card/95 p-8 md:p-12 text-center rise-in">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><BookOpen /></div>
          <p className="eyebrow mb-3">Mesa aberta</p>
          <h1 className="font-display text-4xl mb-8">Arquivo público</h1>
          <Button className="w-full" onClick={() => setLocation('/publico')} data-testid="button-open-public">Abrir arquivo público</Button>
           <Link href="/sistema" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-foreground" data-testid="link-public-system"><BookOpen size={15} /> Consultar Sistema</Link>
          <button className="mt-5 text-sm text-muted-foreground hover:text-primary" onClick={() => setShowPublic(false)} data-testid="button-back-access">Voltar ao acesso</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] rpg-shell flex items-center justify-center p-4 sm:p-6">
      <section className="w-full max-w-6xl grid lg:grid-cols-[1.08fr_.92fr] overflow-hidden rounded-[1.75rem] border border-border bg-card/95 paper-panel rise-in">
        <div className="relative hidden min-h-[650px] overflow-hidden bg-[#0b1728] p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_80%,rgba(44,177,225,0.20),transparent_46%),radial-gradient(ellipse_at_84%_16%,rgba(105,129,201,0.13),transparent_35%),linear-gradient(150deg,rgba(3,9,20,0.12),rgba(3,9,20,0.84))]" />
          <div className="pointer-events-none absolute -right-28 top-24 h-96 w-96 rounded-full border border-cyan-100/10" />
          <div className="pointer-events-none absolute -right-8 top-44 h-56 w-56 rounded-full border border-cyan-100/15" />
          <div className="pointer-events-none absolute right-36 top-72 h-3 w-3 rounded-full bg-cyan-100 shadow-[0_0_24px_rgba(165,232,255,0.9)]" />
          <div className="relative">
            <div className="mb-16 inline-flex items-center gap-3 rounded-full border border-cyan-100/15 bg-white/[0.04] px-4 py-2.5 backdrop-blur">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-100/10 text-cyan-100"><Orbit size={21} /></span>
              <span className="font-display text-sm font-semibold tracking-wide">Pokémon: Ascensão e Presságio</span>
            </div>
            <div className="max-w-xl">
              <p className="eyebrow mb-5 text-cyan-100/65">Pokémon</p>
              <h1 className="font-display text-6xl leading-[.98] tracking-tight text-white xl:text-7xl">
                Ascensão
                <span className="mt-2 block text-cyan-100">e Presságio</span>
              </h1>
              <div className="mt-8 flex items-center gap-3 text-cyan-50/55">
                <span className="h-px w-12 bg-cyan-100/35" />
                <MoonStar size={16} />
                <span className="h-px w-12 bg-cyan-100/35" />
              </div>
            </div>
          </div>
          <div className="relative flex items-end justify-between gap-6">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[.18em] text-cyan-50/45">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/75" />
              C.CORP
            </div>
            <div className="font-mono text-[10px] tracking-[.18em] text-cyan-50/35">A · P</div>
          </div>
        </div>
        <div className="flex flex-col justify-center p-7 sm:p-10 md:p-14">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary"><Orbit size={22} /></span>
            <span className="font-display text-base font-semibold">Pokémon: Ascensão e Presságio</span>
          </div>
          <p className="eyebrow mb-3">{gmMode ? 'Mestre' : 'Jogador'}</p>
          <h2 className="font-display text-4xl tracking-tight">{gmMode ? 'Acesso do mestre' : 'Acessar ficha'}</h2>
          <form onSubmit={enter} className="mt-8 space-y-5">
            {!gmMode && (
              <div>
                <label className="mb-2 block text-sm font-semibold" htmlFor="character-select">Ficha</label>
                <select id="character-select" value={characterId} onChange={event => setCharacterId(event.target.value)} className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-character-access">
                  {characters.map(character => <option key={character.id} value={character.id}>{character.name} · {character.player}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="access-code">Senha de {gmMode ? 'mestre' : 'jogador'}</label>
              <div className="relative"><KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} /><Input id="access-code" autoFocus type="password" autoComplete={gmMode ? 'current-password' : 'off'} value={code} onChange={event => setCode(event.target.value)} className="h-12 pl-10" placeholder="Digite sua senha" data-testid="input-access-code" /></div>
            </div>
            <Button type="submit" className="h-12 w-full text-base" data-testid="button-enter-session">{gmMode ? 'Entrar como mestre' : 'Entrar'}</Button>
          </form>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
            <button onClick={() => { setGmMode(!gmMode); setCode(''); }} className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary" data-testid="button-toggle-gm"><LockKeyhole size={14} /> {gmMode ? 'Acesso do jogador' : 'Acesso do mestre'}</button>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/sistema" className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary transition-colors hover:text-foreground" data-testid="link-public-system"><BookOpen size={14} /> Sistema</Link>
              <button onClick={() => setShowPublic(true)} className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary" data-testid="button-public-access"><UsersRound size={14} /> Arquivo público</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}