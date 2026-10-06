import { Moon, Sun } from 'lucide-react';
import { useAppTheme } from '@/lib/theme';

export function ThemeFooter() {
  const { theme, toggleTheme } = useAppTheme();
  const nextTheme = theme === 'dark' ? 'claro' : 'escuro';

  return (
    <footer className="mt-auto border-t border-border bg-card/70 px-4 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Pokémon RPG · preferência salva neste dispositivo</p>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Ativar tema ${nextTheme}`}
          data-testid="button-toggle-theme"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          Tema {nextTheme}
        </button>
      </div>
    </footer>
  );
}