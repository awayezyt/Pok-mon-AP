import { Minus, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PokemonPPBarProps {
  current: number;
  max: number;
  disabled: boolean;
  onChange: (nextValue: number) => void;
}

export function PokemonPPBar({ current, max, disabled, onChange }: PokemonPPBarProps) {
  const safeMax = Math.max(0, Math.floor(max));
  const safeCurrent = Math.min(safeMax, Math.max(0, Math.floor(current)));
  const percentage = safeMax > 0 ? (safeCurrent / safeMax) * 100 : 0;

  return (
    <section
      aria-labelledby="pokemon-pp-title"
      className="relative overflow-hidden rounded-xl border border-amber-400/35 bg-gradient-to-br from-amber-50 via-background to-yellow-100/80 px-3 py-3 shadow-sm shadow-amber-950/5 dark:from-amber-950/25 dark:via-card dark:to-yellow-950/20"
      data-testid="panel-pokemon-pp"
    >
      <div className="pointer-events-none absolute -right-5 -top-8 size-24 rounded-full bg-amber-300/15 blur-2xl dark:bg-amber-300/10" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-amber-300/70 bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 shadow-inner shadow-white/50 dark:border-amber-300/25 dark:shadow-amber-950/30">
            <Zap aria-hidden="true" className="size-[18px] fill-current" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 id="pokemon-pp-title" className="text-sm font-bold leading-tight">
                Pontos de Poder
              </h3>
              <span className="rounded-full border border-amber-500/25 bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.13em] text-amber-800 dark:text-amber-200">
                Energia
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Usar ataques consome pontos.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 border-amber-500/25 bg-background/70 text-amber-800 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-200 dark:hover:bg-amber-900/50"
            aria-label="Diminuir pontos de poder em 1"
            data-testid="button-decrease-pokemon-pp"
            disabled={disabled || safeCurrent <= 0}
            onClick={() => onChange(Math.max(0, safeCurrent - 1))}
          >
            <Minus aria-hidden="true" className="size-3.5" />
          </Button>
          <output
            className="min-w-[3.75rem] text-center font-mono text-base font-black tabular-nums text-amber-900 dark:text-amber-100"
            aria-label={`${safeCurrent} de ${safeMax} pontos de poder`}
            data-testid="text-pokemon-pp-value"
          >
            {safeCurrent}<span className="px-0.5 text-amber-700/50 dark:text-amber-200/50">/</span>{safeMax}
          </output>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 border-amber-500/25 bg-background/70 text-amber-800 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-200 dark:hover:bg-amber-900/50"
            aria-label="Aumentar pontos de poder em 1"
            data-testid="button-increase-pokemon-pp"
            disabled={disabled || safeCurrent >= safeMax}
            onClick={() => onChange(Math.min(safeMax, safeCurrent + 1))}
          >
            <Plus aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Pontos de Poder disponíveis"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeCurrent}
        aria-valuetext={`${safeCurrent} de ${safeMax} pontos de poder`}
        className="relative mt-3 h-3 overflow-hidden rounded-full border border-amber-500/35 bg-amber-950/10 shadow-inner dark:bg-black/30"
        data-testid="progress-pokemon-pp"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.48)] transition-[width] duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0, transparent 17px, rgba(120, 53, 15, .24) 17px, rgba(120, 53, 15, .24) 19px)" }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-1 top-px h-px bg-white/65" />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-amber-800/70 dark:text-amber-200/65">
        <span>Energia disponível</span>
        <span>{Math.round(percentage)}%</span>
      </div>
    </section>
  );
}
