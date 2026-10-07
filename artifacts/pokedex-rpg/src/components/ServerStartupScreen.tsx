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
  { id: "campaign", label: "Carregando os dados da mesa", Icon: Swords },
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
    ? "A conexão falhou antes de a mesa carregar. Confira sua conexão e tente novamente."
    : retryCount > 0
      ? elapsedSeconds >= 60
        ? "A inicialização está demorando mais que o normal. Continuo aguardando o servidor responder."
        : "O servidor ainda não respondeu. O Render pode estar iniciando o serviço após um período sem uso."
      : "Estamos verificando o servidor e carregando os dados compartilhados da campanha.";

  return (
    <main
      className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-slate-950 px-4 py-10 text-white"
      aria-live="polite"
      data-testid="screen-server-startup"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 -top-28 size-80 rounded-full bg-amber-400/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-24 size-96 rounded-full bg-sky-500/10 blur-3xl" />

      <section className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="h-1 bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-300" />
        <div className="space-y-7 p-6 sm:p-9">
          <div className="flex items-center gap-3">
            <div className={`grid size-12 place-items-center rounded-2xl border ${error ? "border-rose-300/20 bg-rose-300/10 text-rose-200" : "border-amber-300/25 bg-amber-300/10 text-amber-200"}`}>
              {error
                ? <AlertTriangle aria-hidden="true" className="size-6" />
                : <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-200/75">Pokémon RPG · mesa online</p>
              <p className="mt-1 text-xs text-slate-400">Inicialização do servidor</p>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {error
                ? "Não foi possível conectar"
                : retryCount > 0
                  ? "Acordando o servidor"
                  : phase === "server"
                    ? "Conectando à mesa"
                    : "Preparando sua mesa"}
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-slate-300">{subtitle}</p>
          </div>

          {!error && (
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500" />
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>{retryCount > 0 ? `Nova tentativa ${retryCount + 1}` : "Conexão em andamento"}</span>
                <span>{elapsedSeconds}s</span>
              </div>
            </div>
          )}

          <ol className="space-y-2 rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-4">
            {STEPS.map((step, index) => {
              const isDone = !error && index < activeStep;
              const isCurrent = !error && index === activeStep;
              const Icon = step.Icon;
              return (
                <li
                  key={step.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isCurrent ? "bg-white/[0.06] text-white" : isDone ? "text-amber-100/75" : "text-slate-500"}`}
                >
                  <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${isDone ? "bg-amber-300/15 text-amber-200" : isCurrent ? "bg-amber-300/10 text-amber-200" : "bg-white/[0.04]"}`}>
                    {isDone
                      ? <Check aria-hidden="true" className="size-4" />
                      : isCurrent
                        ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                        : <Icon aria-hidden="true" className="size-4" />}
                  </span>
                  <span className="flex-1">{step.label}</span>
                  {isCurrent && <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">Agora</span>}
                </li>
              );
            })}
          </ol>

          {error && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 font-semibold text-slate-950 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
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
