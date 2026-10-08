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
      className="rounded-xl border border-primary/25 bg-card/90 px-2.5 py-2 shadow-sm sm:px-3"
      data-testid="panel-pokemon-pp"
    >
      <h3 id="pokemon-pp-title" className="sr-only">PP · Power Points</h3>
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background/70 p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
            aria-label="Diminuir pontos de poder em 1"
            data-testid="button-decrease-pokemon-pp"
            disabled={disabled || safeCurrent <= 0}
            onClick={() => onChange(Math.max(0, safeCurrent - 1))}
          >
            <Minus aria-hidden="true" className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
            aria-label="Aumentar pontos de poder em 1"
            data-testid="button-increase-pokemon-pp"
            disabled={disabled || safeCurrent >= safeMax}
            onClick={() => onChange(Math.min(safeMax, safeCurrent + 1))}
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Zap aria-hidden="true" className="size-3.5 shrink-0 fill-primary/20 text-primary" />
            <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-primary">PP · Power Points</span>
          </div>
          <div
            role="progressbar"
            aria-label="Pontos de Poder disponíveis"
            aria-valuemin={0}
            aria-valuemax={safeMax}
            aria-valuenow={safeCurrent}
            aria-valuetext={`${safeCurrent} de ${safeMax} pontos de poder`}
            className="relative h-2.5 overflow-hidden rounded-full border border-primary/20 bg-muted"
            data-testid="progress-pokemon-pp"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-accent to-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <output
          className="min-w-[4.5rem] shrink-0 text-right font-mono text-sm font-bold tabular-nums text-foreground sm:min-w-[5rem] sm:text-base"
          aria-label={`${safeCurrent} de ${safeMax} pontos de poder`}
          data-testid="text-pokemon-pp-value"
        >
          <span className="text-primary">{safeCurrent}</span>
          <span className="px-0.5 text-muted-foreground">/</span>
          <span>{safeMax}</span>
        </output>
      </div>
    </section>
  );
}
