import { AlertTriangle, Check, LoaderCircle, RefreshCw, Server, ShieldCheck, Sparkles, Swords } from "lucide-react";

export type StartupPhase = "server" | "session" | "campaign" | "prepare";

interface ServerStartupScreenProps {
  phase: StartupPhase;
  elapsedSeconds: number;
  retryCount: number;
  error?: boolean;
  onRetry?: () => void;
}

const STEPS: { id: StartupPhase; label: string; Icon: typeof Server }[] = [
  { id: "server", label: "Conectando ao servidor", Icon: Server },
  { id: "session", label: "Validando acesso", Icon: ShieldCheck },
  { id: "campaign", label: "Carregando o database", Icon: Swords },
  { id: "prepare", label: "Preparando a campanha", Icon: Sparkles },
];

export function ServerStartupScreen({
  phase,
  elapsedSeconds,
  retryCount,
  error = false,
  onRetry,
}: ServerStartupScreenProps) {
  const activeStep = STEPS.findIndex(step => step.id === phase);

  const subtitle = error
    ? "A conexão falhou antes de o site carregar. Confira sua conexão e tente novamente."
    : retryCount > 0
      ? elapsedSeconds >= 60
        ? "A inicialização está demorando mais que o normal. Continuo aguardando o servidor responder."
        : "O servidor ainda não respondeu. O Render pode estar iniciando o serviço após um período sem uso."
      : "Estamos verificando o servidor e carregando os dados compartilhados da campanha.";

  return (
    <main
        className="rpg-shell relative grid min-h-[100dvh] place-items-center overflow-hidden px-4 py-8 text-foreground sm:py-10"
      aria-live="polite"
      data-testid="screen-server-startup"
    >
      <section className="paper-panel relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card/90 shadow-xl backdrop-blur">
        <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
        <div className="space-y-6 p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className={`grid size-12 place-items-center rounded-xl border ${error ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-primary/25 bg-primary/10 text-primary"}`}>
              {error
                ? <AlertTriangle aria-hidden="true" className="size-6" />
                : <LoaderCircle aria-hidden="true" className="size-6 motion-safe:animate-spin" />}
            </div>
            <div>
              <p className="eyebrow text-primary">Pokémon AP</p>
              <p className="mt-1 text-xs text-muted-foreground">Inicialização do servidor</p>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {error
                ? "Não foi possível conectar"
                : retryCount > 0
                  ? "Acordando o servidor"
                  : phase === "server"
                    ? "Conectando database"
                    : "Preparando satabase"}
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>

          {!error && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full border border-border bg-muted">
                <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary via-accent to-primary motion-safe:animate-pulse" />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{retryCount > 0 ? `Nova tentativa ${retryCount + 1}` : "Conexão em andamento"}</span>
                <span>{elapsedSeconds}s</span>
              </div>
            </div>
          )}

          {(retryCount > 0 || elapsedSeconds >= 15) && !error && (
            <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground sm:px-4">
              O servidor ainda está inicializando. Se ficou um período de 2 min ou mais em loading, fale com o ezy. As tentativas de conexão continuam automaticamente.
            </p>
          )}

          <ol className="space-y-2 rounded-xl border border-border bg-background/60 p-3 sm:p-4">
            {STEPS.map((step, index) => {
              const isDone = !error && index < activeStep;
              const isCurrent = !error && index === activeStep;
              const Icon = step.Icon;
              return (
                <li
                  key={step.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${isCurrent ? "bg-primary/10 text-foreground" : isDone ? "text-primary" : "text-muted-foreground"}`}
                >
                  <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${isDone ? "bg-primary/15 text-primary" : isCurrent ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                    {isDone
                      ? <Check aria-hidden="true" className="size-4" />
                      : isCurrent
                        ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
                        : <Icon aria-hidden="true" className="size-4" />}
                  </span>
                  <span className="flex-1">{step.label}</span>
                  {isCurrent && <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Agora</span>}
                </li>
              );
            })}
          </ol>

          {error && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Tentar novamente
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
