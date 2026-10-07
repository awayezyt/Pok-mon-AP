import { Minus, Plus } from "lucide-react";
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
      className="rounded-lg border border-primary/20 bg-primary/[0.045] px-3 py-2.5"
      data-testid="panel-pokemon-pp"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id="pokemon-pp-title" className="text-sm font-semibold leading-tight">
            Pontos de Poder
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Usar ataques consome pontos neste modo.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Diminuir pontos de poder em 1"
            data-testid="button-decrease-pokemon-pp"
            disabled={disabled || safeCurrent <= 0}
            onClick={() => onChange(Math.max(0, safeCurrent - 1))}
          >
            <Minus aria-hidden="true" className="size-3.5" />
          </Button>
          <output
            className="min-w-[3.25rem] text-center font-mono text-sm font-bold tabular-nums"
            aria-label={`${safeCurrent} de ${safeMax} pontos de poder`}
            data-testid="text-pokemon-pp-value"
          >
            {safeCurrent}<span className="px-0.5 text-muted-foreground">/</span>{safeMax}
          </output>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
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
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted"
        data-testid="progress-pokemon-pp"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </section>
  );
}
