import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link, useLocation } from 'wouter';
import { AlertTriangle, BookOpen, CircleCheck, CircleDot, CloudOff, LoaderCircle, LogOut, Orbit, Shield, Swords, Users, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionRole } from '../lib/campaign';
import { getSyncStatus, type SyncStatusSnapshot } from '../lib/cloudSync';

export function Navigation() {
  const [location] = useLocation();
  const { role, activeCharacterId, signOut } = useSessionRole();
  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>(getSyncStatus);

  useEffect(() => {
    const update = (event: Event) => {
      setSyncStatus((event as CustomEvent<SyncStatusSnapshot>).detail);
    };
    window.addEventListener('pokemon-rpg-sync-status', update);
    return () => window.removeEventListener('pokemon-rpg-sync-status', update);
  }, []);

  if (role === 'public' && location === '/publico') {
    return (
      <nav aria-label="Navegação pública" className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-sm font-bold" data-testid="link-public-brand">
            <span className="rounded-full border border-primary/35 bg-primary/10 p-2 text-primary"><Orbit size={20} /></span>
            <span className="hidden font-display sm:inline">Pokémon: Ascensão e Presságio</span>
          </Link>
          <div className="flex min-w-0 items-center gap-4 overflow-x-auto text-sm font-medium">
            <Link href="/publico" aria-current="page" className="flex shrink-0 items-center gap-2 text-foreground" data-testid="link-nav-public-archive"><BookOpen size={16} /> Arquivo</Link>
            <Link href="/sistema" className="flex shrink-0 items-center gap-2 text-foreground/65 transition-colors hover:text-foreground" data-testid="link-nav-public-system"><BookOpen size={16} /> Sistema</Link>
          </div>
        </div>
      </nav>
    );
  }

  if (location === '/' || location === '/sistema' || role === 'public') return null;

  const statusLabel = {
    connecting: 'Conectando',
    connected: 'Sincronizado',
    saving: 'Salvando',
    offline: 'Sem conexão',
    error: 'Falha de sincronização',
  }[syncStatus.state];
  const StatusIcon = {
    connecting: LoaderCircle,
    connected: CircleCheck,
    saving: LoaderCircle,
    offline: CloudOff,
    error: AlertTriangle,
  }[syncStatus.state];
  const statusColor = syncStatus.state === 'connected'
    ? 'text-emerald-500'
    : syncStatus.state === 'saving' || syncStatus.state === 'connecting'
      ? 'text-muted-foreground'
      : 'text-destructive';
  const characterHref = role === 'player' && activeCharacterId
    ? `/personagem?id=${encodeURIComponent(activeCharacterId)}`
    : '/personagem';

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center mx-auto gap-4 px-4">
        <div className="mr-1 flex shrink-0 items-center gap-2.5">
          <div className="rounded-full border border-primary/35 bg-primary/10 p-2 text-primary">
            <Orbit size={21} />
          </div>
          <span className="hidden max-w-48 font-display text-sm font-bold leading-tight sm:inline-block md:max-w-none md:text-base">
            Pokémon: Ascensão e Presságio
          </span>
        </div>
        
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto text-sm font-medium">
          {role === 'gm' && <Link 
            href="/fichas"
            className={`transition-colors hover:text-foreground flex items-center gap-2 ${location === '/fichas' ? 'text-foreground' : 'text-foreground/60'}`}
            data-testid="link-nav-sheets"
          >
            <Users size={16} />
            Fichas
          </Link>}
          <Link href={characterHref} className={`transition-colors hover:text-foreground flex items-center gap-2 ${location.startsWith('/personagem') ? 'text-foreground' : 'text-foreground/60'}`} data-testid="link-nav-character"><WandSparkles size={16} /> Personagem</Link>
          <Link href="/publico" className={`transition-colors hover:text-foreground flex items-center gap-2 ${location === '/publico' ? 'text-foreground' : 'text-foreground/60'}`} data-testid="link-nav-public"><BookOpen size={16} /> Arquivo</Link>
          <Link href="/sistema" className={`transition-colors hover:text-foreground flex items-center gap-2 ${location === '/sistema' ? 'text-foreground' : 'text-foreground/60'}`} data-testid="link-nav-system"><BookOpen size={16} /> Sistema</Link>
          {role === 'gm' && <Link href="/pokemon" className={`transition-colors hover:text-foreground flex items-center gap-2 ${location === '/pokemon' ? 'text-foreground' : 'text-foreground/60'}`} data-testid="link-nav-pokemon"><CircleDot size={16} /> Pokédex</Link>}
          {role === 'gm' && <Link
            href="/attacks" 
            className={`transition-colors hover:text-foreground flex items-center gap-2 ${location === '/attacks' ? 'text-foreground' : 'text-foreground/60'}`}
            data-testid="link-nav-attacks"
          >
            <Swords size={16} />
            Ataques
          </Link>}
          {role === 'gm' && <Link href="/mestre" className={`transition-colors hover:text-foreground flex items-center gap-2 ${location === '/mestre' ? 'text-foreground' : 'text-foreground/60'}`} data-testid="link-nav-gm"><Shield size={16} /> Mestre</Link>}
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 text-xs ${statusColor}`}
          title={syncStatus.message || statusLabel}
          aria-label={syncStatus.message ? `${statusLabel}: ${syncStatus.message}` : statusLabel}
          role="status"
          aria-live="polite"
          data-testid="sync-status"
        >
          <StatusIcon
            size={15}
            className={syncStatus.state === 'connecting' || syncStatus.state === 'saving' ? 'animate-spin' : ''}
          />
          <span className="hidden md:inline">{statusLabel}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => { void signOut().catch(() => toast.error('Não foi possível sair. Tente novamente.')); }} className="text-muted-foreground" data-testid="button-sign-out"><LogOut size={15} className="mr-2" /> Sair</Button>
      </div>
    </nav>
  );
}